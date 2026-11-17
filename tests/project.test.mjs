import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { CAT, classify, categoryName, sortItems } from "../InventorySorterBP/scripts/sort_logic.js";

const root = new URL("../", import.meta.url);
const packDir = new URL("InventorySorterBP/", root);
const manifest = JSON.parse(readFileSync(new URL("manifest.json", packDir), "utf8"));
const mainSource = readFileSync(new URL("scripts/main.js", packDir), "utf8");

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

test("manifest targets Minecraft 1.26.60+ and @minecraft/server 2.11.0", () => {
  assert.equal(manifest.format_version, 2);
  assert.deepEqual(manifest.header.min_engine_version, [1, 26, 60]);
  assert.deepEqual(manifest.header.version, [1, 3, 0]);

  const server = manifest.dependencies.find((d) => d.module_name === "@minecraft/server");
  assert.ok(server, "missing @minecraft/server dependency");
  assert.equal(server.version, "2.11.0");
});

test("manifest UUIDs are unique and valid, versions are consistent", () => {
  const uuids = [manifest.header.uuid, ...manifest.modules.map((m) => m.uuid)];
  assert.equal(new Set(uuids).size, uuids.length);
  for (const uuid of uuids) assert.match(uuid, UUID_RE);

  assert.deepEqual(
    manifest.modules.map((m) => m.type),
    ["data", "script"],
  );
  for (const module of manifest.modules) assert.deepEqual(module.version, [1, 3, 0]);

  const scriptModule = manifest.modules.find((m) => m.type === "script");
  assert.equal(scriptModule.language, "javascript");
  assert.equal(scriptModule.entry, "scripts/main.js");
});

test("declared entry point and pack icon exist", () => {
  assert.equal(existsSync(fileURLToPath(new URL("scripts/main.js", packDir))), true);
  assert.equal(existsSync(fileURLToPath(new URL("scripts/sort_logic.js", packDir))), true);
  assert.equal(existsSync(fileURLToPath(new URL("pack_icon.png", packDir))), true);
});

test("build script names the artifact after the manifest version", () => {
  const buildScript = readFileSync(new URL("build.ps1", root), "utf8");
  assert.match(buildScript, /InventorySorter-v\$version\.mcaddon/);
  assert.match(buildScript, /manifest\.json/);

  const [major, minor, patch] = manifest.header.version;
  const expected = `InventorySorter-v${major}.${minor}.${patch}.mcaddon`;
  const readme = readFileSync(new URL("README.md", root), "utf8");
  assert.ok(readme.includes(expected), `README should mention ${expected}`);

  const mentions = readme.match(/InventorySorter[^\s`]*\.mcaddon/g) ?? [];
  assert.ok(mentions.length > 0, "README should mention a build artifact");
  for (const name of mentions) {
    assert.match(
      name,
      /^InventorySorter-v(\d+\.\d+\.\d+|<[^>]+>)\.mcaddon$/,
      `unversioned artifact name in README: ${name}`,
    );
  }
});

test("sortChest uses the 2.x getEntitiesFromRay(location, direction, options) signature", () => {
  assert.match(
    mainSource,
    /getEntitiesFromRay\(\s*player\.getHeadLocation\(\),\s*player\.getViewDirection\(\),\s*\{ maxDistance: 8 \}\s*\)/,
  );
  assert.doesNotMatch(mainSource, /\.source(?!Entity)/, "legacy CustomCommandOrigin.source fallback should be gone");
});

test("storage detection covers chests, shulker boxes and shelves", () => {
  assert.match(mainSource, /endsWith\("_chest"\)/);
  assert.match(mainSource, /endsWith\("_shulker_box"\)/);
  assert.match(mainSource, /endsWith\("_shelf"\)/);
  assert.match(mainSource, /minecraft:ender_chest/);
});

test("sorter knows every 1.26.x item family", () => {
  const expected = [
    ["minecraft:oak_shelf", CAT.FUNCTIONAL],
    ["minecraft:white_cushion", CAT.COLORED],
    ["minecraft:copper_bars", CAT.BUILDING],
    ["minecraft:copper_golem_statue", CAT.BUILDING],
    ["minecraft:sulfur_spike", CAT.BUILDING],
    ["minecraft:copper_nautilus_armor", CAT.COMBAT],
    ["minecraft:diamond_spear", CAT.COMBAT],
    ["minecraft:cinnabar", CAT.BUILDING],
    ["minecraft:sulfur", CAT.BUILDING],
    ["minecraft:ice_crystal", CAT.BUILDING],
    ["minecraft:icicle", CAT.BUILDING],
    ["minecraft:lightning_rod", CAT.REDSTONE],
    ["minecraft:golden_dandelion", CAT.NATURAL],
    ["minecraft:red_shrub", CAT.NATURAL],
    ["minecraft:shelf_mushroom", CAT.NATURAL],
    ["minecraft:potent_sulfur", CAT.BUILDING],
  ];
  for (const [id, category] of expected) {
    assert.equal(classify(id), category, `${id} should be ${categoryName(id)}`);
  }
});

test("SORT_ORDER.md matches the current sorting logic", () => {
  const fixture = readFileSync(new URL("tests/fixtures/vanilla-items-1.26.60.txt", root), "utf8");
  const ids = fixture.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const expected = sortItems(ids.map((typeId) => ({ typeId, amount: 1 }))).map((s) => s.typeId);

  const doc = readFileSync(new URL("SORT_ORDER.md", root), "utf8");
  const documented = doc
    .split(/\r?\n/)
    .filter((line) => line.startsWith("- minecraft:"))
    .map((line) => line.slice("- ".length));

  assert.equal(documented.length, ids.length);
  assert.deepEqual(documented, expected);
});
