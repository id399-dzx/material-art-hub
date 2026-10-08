import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  ECHARTS_CATEGORIES,
  ECHARTS_EXAMPLES,
  ECHARTS_UPSTREAM,
  getExampleThumbnail,
  getExamplesForCategory,
} from "./catalog.ts";
import { gitBlobHash } from "../../../scripts/vendor-echarts-catalog.mjs";

const publicRoot = fileURLToPath(new URL("../../../public/", import.meta.url));
const officialRoot = path.join(publicRoot, "echarts-official");
const provenance = JSON.parse(readFileSync(path.join(officialRoot, "provenance-catalog.json"), "utf8"));
const assetsByDestination = new Map(provenance.assets.map((asset) => [asset.destination, asset]));
// Captured from the public gallery's rendered DOM using read-only browser access,
// 2026-10-08: https://echarts.apache.org/examples/zh/index.html#chart-type-line.
// This evidence is independent of the upstream source metadata generator.
const officialVisibleGallery = JSON.parse(readFileSync(new URL("./fixtures/official-visible-gallery.json", import.meta.url), "utf8"));

test("every rendered category matches the real official website's complete card order", () => {
  assert.equal(officialVisibleGallery.length, 39);
  assert.equal(officialVisibleGallery.reduce((total, group) => total + group.ids.length, 0), 365);
  assert.equal(new Set(officialVisibleGallery.flatMap((group) => group.ids)).size, 329);
  assert.deepEqual(ECHARTS_CATEGORIES.map((category) => category.id), officialVisibleGallery.map((group) => group.category));
  for (const group of officialVisibleGallery) {
    assert.deepEqual(getExamplesForCategory(group.category).map((example) => example.id), group.ids, `${group.category} preserves all original website cards in order`);
  }
});

test("the gallery retains all 39 official categories and all 329 public examples", () => {
  assert.equal(ECHARTS_UPSTREAM.commit, "88ca004030e999073a15303e5fe32462b8fefae2");
  assert.equal(ECHARTS_UPSTREAM.version, "6.1.0");
  assert.deepEqual(ECHARTS_UPSTREAM, provenance.upstream);
  assert.equal(ECHARTS_CATEGORIES.length, 39);
  assert.equal(ECHARTS_EXAMPLES.length, 329);
  assert.equal(new Set(ECHARTS_CATEGORIES.map((category) => category.id)).size, 39);
  assert.equal(new Set(ECHARTS_EXAMPLES.map((example) => example.id)).size, 329);
  assert.deepEqual(ECHARTS_EXAMPLES.map((example) => example.id), provenance.selection.exampleIds);
  assert.deepEqual(ECHARTS_CATEGORIES.map((category) => category.id), Object.keys(provenance.selection.categoryExamples));
  for (const example of ECHARTS_EXAMPLES) {
    assert.ok(example.titleCN.length > 0, `${example.id} has its original title`);
    assert.ok(!provenance.selection.hidden.includes(example.id), `${example.id} is visible upstream`);
    assert.ok(example.category.some((category) => ECHARTS_CATEGORIES.some((item) => item.id === category)));
  }
  assert.equal(getExamplesForCategory("line").length, 40);
  assert.equal(getExamplesForCategory("bar").length, 46);
  assert.equal(getExamplesForCategory("globe").length, 8);
  assert.equal(getExamplesForCategory("surface").length, 11);
});

test("multi-category examples remain present in every category in the original order", () => {
  let memberships = 0;
  for (const category of ECHARTS_CATEGORIES) {
    const examples = getExamplesForCategory(category.id);
    assert.deepEqual(examples.map((example) => example.id), provenance.selection.categoryExamples[category.id]);
    memberships += examples.length;
  }
  assert.equal(memberships, provenance.selection.categoryMemberships);
  const matrixLine = ECHARTS_EXAMPLES.find((example) => example.id === "matrix-sparkline");
  assert.ok(matrixLine);
  assert.ok(getExamplesForCategory("line").includes(matrixLine));
  assert.ok(getExamplesForCategory("matrix").includes(matrixLine));
  assert.deepEqual(getExamplesForCategory("nonexistent-category"), []);
});

test("both original preview themes exist, with the upstream fixed theme taking precedence", () => {
  for (const example of ECHARTS_EXAMPLES) {
    for (const dark of [false, true]) {
      const url = getExampleThumbnail(example, dark);
      const relativePath = url.replace(/^\/echarts-official\//, "");
      assert.ok(assetsByDestination.has(relativePath), `${example.id} ${dark ? "dark" : "light"} preview exists`);
      assert.match(url, new RegExp(`/data${example.isGL ? "-gl" : ""}/thumb`));
      if (example.theme) assert.ok(url.includes(`/thumb-${example.theme}/`));
    }
  }
  for (const category of ECHARTS_CATEGORIES) {
    assert.ok(assetsByDestination.has(category.icon.replace(/^\/echarts-official\//, "")));
  }
});

test("every vendored preview and icon is byte-for-byte identical to its pinned upstream Git blob", () => {
  assert.equal(provenance.assets.filter((asset) => asset.destination.endsWith(".webp")).length, 650);
  assert.equal(provenance.assets.filter((asset) => asset.destination.endsWith(".svg")).length, 29);
  for (const asset of provenance.assets) {
    const bytes = readFileSync(path.join(officialRoot, asset.destination));
    assert.equal(bytes.length, asset.bytes, `${asset.destination} size`);
    assert.equal(gitBlobHash(bytes), asset.gitBlob, `${asset.destination} has no cropping, redraw or recoloring`);
    if (asset.destination.endsWith(".webp")) {
      assert.equal(bytes.subarray(0, 4).toString(), "RIFF");
      assert.equal(bytes.subarray(8, 12).toString(), "WEBP");
      const chunk = bytes.subarray(12, 16).toString();
      let width, height;
      if (chunk === "VP8 ") {
        width = bytes.readUInt16LE(26) & 0x3fff;
        height = bytes.readUInt16LE(28) & 0x3fff;
      } else if (chunk === "VP8L") {
        const value = bytes.readUInt32LE(21);
        width = (value & 0x3fff) + 1;
        height = ((value >>> 14) & 0x3fff) + 1;
      } else if (chunk === "VP8X") {
        width = bytes.readUIntLE(24, 3) + 1;
        height = bytes.readUIntLE(27, 3) + 1;
      } else assert.fail(`Unknown WebP format for ${asset.destination}: ${chunk}`);
      assert.deepEqual([width, height], [600, 450], `${asset.destination} retains the original 4:3 dimensions`);
    }
  }
  const license = readFileSync(path.join(officialRoot, "LICENSE"));
  assert.equal(gitBlobHash(license), provenance.sources.find((source) => source.path === "LICENSE").gitBlob);
  assert.match(license.toString(), /Apache License/);
});
