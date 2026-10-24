import { expect, test } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
test("embedded offline font covers every Korean source syllable",()=>{
  const coverage=JSON.parse(readFileSync("src/assets/noto-kr-u1-coverage.json","utf8")) as {sha256:string;codepoints:number[]};
  expect(createHash("sha256").update(readFileSync("src/assets/noto-kr-u1.woff")).digest("hex")).toBe(coverage.sha256);
  function sourceFiles(dir:string):string[]{return readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?sourceFiles(`${dir}/${e.name}`):/\.(tsx?|css)$/.test(e.name)?[`${dir}/${e.name}`]:[]);}
  const text=sourceFiles("src").map(p=>readFileSync(p,"utf8")).join("");
  const missing=[...new Set([...text].map(c=>c.codePointAt(0)!).filter(c=>c>=0xac00&&c<=0xd7a3&&!coverage.codepoints.includes(c)))];
  expect(missing).toEqual([]);
});
