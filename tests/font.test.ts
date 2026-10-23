import { expect, test } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
test("embedded offline font covers every Korean source syllable",()=>{
  const coverage=JSON.parse(readFileSync("src/assets/noto-kr-p12-coverage.json","utf8")) as {sha256:string;codepoints:number[]};
  expect(createHash("sha256").update(readFileSync("src/assets/noto-kr-p12.woff")).digest("hex")).toBe(coverage.sha256);
  const text=readdirSync("src").filter(p=>/\.(tsx?|css)$/.test(p)).map(p=>readFileSync(`src/${p}`,"utf8")).join("");
  const missing=[...new Set([...text].map(c=>c.codePointAt(0)!).filter(c=>c>=0xac00&&c<=0xd7a3&&!coverage.codepoints.includes(c)))];
  expect(missing).toEqual([]);
});
