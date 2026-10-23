import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  cpSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
execFileSync("npm", ["run", "build"], { stdio: "inherit" });
const sha = (data) => createHash("sha256").update(data).digest("hex");
function files(path) {
  return readdirSync(path)
    .sort()
    .flatMap((name) => {
      const p = join(path, name);
      return statSync(p).isDirectory() ? files(p) : [p];
    });
}
const inputs = [
  ...files("src"),
  "index.html",
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  "vite.config.ts",
  "scripts/package-artifact.mjs",
].sort();
const sourceFingerprint = sha(
  inputs.map((path) => `${path}\0${sha(readFileSync(path))}`).join("\n"),
);
const html = readFileSync("dist/index.html");
if (
  /<script\b[^>]*\bsrc=|<link\b[^>]*\b(?:stylesheet|preload)/i.test(
    html.toString(),
  )
)
  throw new Error(
    "Standalone HTML unexpectedly contains external script/style dependencies.",
  );
mkdirSync("artifacts", { recursive: true });
const name = "photonic-connector-studio-p1.2.html";
cpSync("dist/index.html", `artifacts/${name}`);
const manifest = {
  version: JSON.parse(readFileSync("package.json", "utf8")).version,
  schemaVersion: 1,
  sourceCommit: process.env.SOURCE_COMMIT || execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim(),
  sourceFingerprint,
  inputs: Object.fromEntries(
    inputs.map((path) => [path, sha(readFileSync(path))]),
  ),
  artifact: name,
  artifactSHA256: sha(html),
  artifactBytes: html.length,
};
writeFileSync(
  "artifacts/build-info-p1.2.json",
  JSON.stringify(manifest, null, 2) + "\n",
);
writeFileSync(
  "artifacts/SHA256SUMS-p1.2.txt",
  `${manifest.artifactSHA256}  ${name}\n`,
);
console.log(
  JSON.stringify({
    sourceFingerprint,
    artifactSHA256: manifest.artifactSHA256,
    bytes: html.length,
  }),
);
