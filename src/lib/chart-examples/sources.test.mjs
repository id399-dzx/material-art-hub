import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { ECHARTS_EXAMPLES, ECHARTS_UPSTREAM } from "./catalog.ts";

const officialRoot = fileURLToPath(new URL("../../../public/echarts-official/", import.meta.url));
const provenance = JSON.parse(readFileSync(path.join(officialRoot, "provenance-sources.json"), "utf8"));
const files = provenance.files;
const sourceFiles = new Map(files.map((file) => [`${file.example}:${path.extname(file.path)}`, file]));
const stripYamlQuotes = (value) => {
  const trimmed = value?.trim();
  if (!trimmed) return trimmed;
  return /^(['"])([\s\S]*)\1$/.test(trimmed) ? trimmed.slice(1, -1) : trimmed;
};

test("all 329 visible examples have their original JavaScript and every advertised TypeScript source", () => {
  assert.deepEqual(provenance.upstream, ECHARTS_UPSTREAM);
  assert.equal(files.length, 592);
  assert.equal(sourceFiles.size, 592, "No source identifier is duplicated");
  assert.equal(files.filter((file) => file.path.endsWith(".js")).length, 329);
  assert.equal(files.filter((file) => file.path.endsWith(".ts")).length, 263);
  assert.equal(ECHARTS_EXAMPLES.filter((example) => example.ts).length, 263);
  for (const example of ECHARTS_EXAMPLES) {
    for (const extension of example.ts ? [".js", ".ts"] : [".js"]) {
      const source = sourceFiles.get(`${example.id}:${extension}`);
      assert.ok(source, `${example.id}${extension} is present`);
      assert.equal(source.path, `examples/${extension.slice(1)}/${example.isGL ? "gl/" : ""}${example.id}${extension}`);
      const officialWebsiteURL = `https://echarts.apache.org/examples/${source.path}`;
      const pinnedRepositoryURL = `https://raw.githubusercontent.com/apache/echarts-examples/${ECHARTS_UPSTREAM.commit}/public/${source.path}`;
      assert.ok([officialWebsiteURL, pinnedRepositoryURL].includes(source.url), `${source.path} comes from the official website or its pinned official repository`);
    }
  }
  const visibleIds = new Set(ECHARTS_EXAMPLES.map((example) => example.id));
  assert.ok(files.every((source) => visibleIds.has(source.example)), "Only visible official examples are mirrored");
});

test("all 592 source files preserve the original official bytes and contain JavaScript or TypeScript, not error pages", () => {
  for (const source of files) {
    const bytes = readFileSync(path.join(officialRoot, source.path));
    const code = bytes.toString("utf8");
    assert.equal(bytes.length, source.size, `${source.path} retains its original length`);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), source.sha256, `${source.path} matches its official SHA-256`);
    assert.ok(!/^\s*(?:<!doctype\s+html|<html\b)/i.test(code), `${source.path} is not an HTML error page`);
    const metadata = code.match(/^\s*\/\*([\s\S]*?)\*\//)?.[1];
    assert.ok(metadata, `${source.path} includes its original example metadata header`);
    const example = ECHARTS_EXAMPLES.find((item) => item.id === source.example);
    const title = stripYamlQuotes(metadata.match(/^title:\s*([^\n]*)/m)?.[1]);
    const titleCN = stripYamlQuotes(metadata.match(/^titleCN:\s*([^\n]*)/m)?.[1]);
    assert.equal(title, example.title, `${source.path} belongs to its matching English catalog entry`);
    assert.equal(titleCN, example.titleCN, `${source.path} belongs to its matching Chinese catalog entry`);
    assert.ok(/\b(?:option|myChart|echarts|app)\b/.test(code), `${source.path} contains original chart execution code`);
  }
});
