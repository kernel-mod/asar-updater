import fs from "fs";
import { download, update } from "../src";

const localASAR = "./test/test.asar";
const remoteASAR =
	"https://github.com/kernel-mod/electron/releases/latest/download/kernel.asar";
const oa =
	"https://github.com/GooseMod/OpenAsar/releases/latest/download/app.asar";

console.log("Fresh download.");
try {
	fs.unlinkSync(localASAR);
} catch {}
console.log(await update(localASAR, remoteASAR));

console.log("Update if needed (no).");
console.log(await update(localASAR, remoteASAR));

console.log("Update if needed (yes).");
fs.writeFileSync(localASAR, await download(oa));
console.log(await update(localASAR, remoteASAR));
