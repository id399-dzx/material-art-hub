import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const curated = JSON.parse(readFileSync(new URL("./curation.json", import.meta.url), "utf8"));
const snapshot = JSON.parse(readFileSync(new URL("./snapshot.json", import.meta.url), "utf8"));

test("research collection uses verified public stars with real Skill files", () => {
  assert.equal(snapshot.account, "id399-dzx");
  assert.ok(snapshot.starredRepositoryCount >= snapshot.repositories.length);
  assert.equal(new Set(snapshot.repositories.map((repo) => repo.repo)).size, snapshot.repositories.length);
  for (const repo of snapshot.repositories) {
    assert.equal(repo.isStarred, true);
    assert.ok(repo.skillPaths.length, repo.repo);
    assert.ok(repo.skillPaths.every((path) => /(^|\/)SKILL\.md$/i.test(path)), repo.repo);
    assert.match(repo.treeSha, /^[a-f0-9]{40}$/);
    assert.match(repo.readmeSha, /^[a-f0-9]{40}$/);
    assert.equal(repo.url, `https://github.com/${repo.repo}`);
    assert.equal(new URL(repo.readmeUrl).hostname, "github.com");
    assert.equal(repo.owner, repo.repo.split("/")[0]);
    assert.ok(curated.some((entry) => entry.repo === repo.repo));
  }
});

test("every card has a reviewed Chinese functional overview and an explicit scope", () => {
  const categories = new Set(["literature", "figure", "writing", "presentation", "computing", "three-dimensional", "knowledge"]);
  for (const entry of curated) {
    assert.ok(categories.has(entry.category), entry.repo);
    assert.ok(["research", "support"].includes(entry.scope), entry.repo);
    for (const field of ["title", "summary", "inputs", "outputs", "environment", "note"]) assert.match(entry[field], /[\u4e00-\u9fff]/, `${entry.repo}/${field}`);
    assert.ok(entry.features.length >= 2, entry.repo);
    assert.ok(entry.features.every((feature) => /[\u4e00-\u9fff]/.test(feature)), entry.repo);
  }
});

test("scientific collections remain represented without classifying unrelated tools as Skills", () => {
  const names = new Set(snapshot.repositories.map((repo) => repo.repo));
  for (const repo of ["Yuan1z0825/nature-skills", "huangwb8/ChineseResearchLaTeX", "Haojae/scipilot-figure-skill", "ChenLiu-1996/figures4papers", "TingxiYu/academic-figure-skill", "zsyggg/paper-craft-skills", "matlab/matlab-agentic-toolkit", "matlab/simulink-agentic-toolkit"]) assert.ok(names.has(repo), repo);
  for (const repo of ["khuynh22/paper-deck", "PaddlePaddle/PaddleSeg", "jarrodwatts/jev-trader", "matlab2tikz/matlab2tikz"]) assert.equal(names.has(repo), false, repo);
  assert.equal(curated.find((entry) => entry.repo === "blader/humanizer").scope, "support");
  assert.equal(curated.find((entry) => entry.repo === "CloudAI-X/threejs-skills").scope, "support");
});
