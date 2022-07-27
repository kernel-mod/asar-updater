import fs from "fs";
// :)
import { $fetch } from "ohmyfetch";
import path from "path";

export enum UpdateStatus {
	CHANGE = "CHANGE",
	NONE = "NONE",
	FRESH = "FRESH",
}

export async function download(url: string, range?: string) {
	const options: RequestInit = {
		method: "GET",
	};

	if (range) {
		options.headers = {
			Range: range,
		};
	}

	return await $fetch<Buffer>(url, {
		...options,
		parseResponse: (text) => {
			return Buffer.from(text);
		},
		retry: 3,
	});
}

export async function getRemoteAsarHeaderSize(url: string) {
	const headerSizeBuffer = await download(url, "bytes=12-15");
	return headerSizeBuffer.readUint32LE();
}

export async function getRemoteAsarHeader(url: string, size?: number) {
	size ??= await getRemoteAsarHeaderSize(url);

	const headerBuffer = await download(
		url,
		// Apply the correct offset to the end position.
		`bytes=16-${size + 15}`
	);

	return headerBuffer;
}

export function getLocalAsarHeaderSize(file: string) {
	const fd = fs.openSync(file, "r");

	// The first 12 bytes are useless.
	const headerSizeBuffer = Buffer.alloc(4);
	fs.readSync(fd, headerSizeBuffer, 0, 4, 12);

	fs.closeSync(fd);

	return headerSizeBuffer.readUint32LE();
}

export function getLocalAsarHeader(file: string, size?: number) {
	size ??= getLocalAsarHeaderSize(file);

	const fd = fs.openSync(file, "r");

	// Read the actual header now.
	const headerBuffer = Buffer.alloc(size);
	fs.readSync(fd, headerBuffer, 0, size, 16);

	fs.closeSync(fd);

	return headerBuffer;
}

export async function update(localFile: string | string[], remoteFile: string) {
	// Convert to a proper path string if it's an array.
	if (Array.isArray(localFile)) localFile = localFile.join(path.sep);

	// If it doesn't exist it should be downloaded immediately.
	if (!fs.existsSync(localFile)) {
		fs.writeFileSync(localFile, await download(remoteFile));
		return UpdateStatus.FRESH;
	}

	const localHeaderSize = getLocalAsarHeaderSize(localFile);
	const remoteHeaderSize = await getRemoteAsarHeaderSize(remoteFile);

	// If the header sizes don't match it's clearly different.
	if (localHeaderSize !== remoteHeaderSize) {
		fs.writeFileSync(localFile, await download(remoteFile));
		return UpdateStatus.CHANGE;
	}

	const localHeader = getLocalAsarHeader(localFile, localHeaderSize);
	const remoteHeader = await getRemoteAsarHeader(remoteFile, remoteHeaderSize);

	// If the headers are the same, there's no need to update.
	// Why parse the JSON and iterate over it? This should be much faster.
	if (localHeader.compare(remoteHeader) === 0) {
		return UpdateStatus.NONE;
	}

	// Otherwise we can overwrite the file.
	fs.writeFileSync(localFile, await download(remoteFile));

	return UpdateStatus.CHANGE;
}
