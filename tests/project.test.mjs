import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const packDir = new URL("InventorySorterBP/", root);
const manifest = JSON.parse(readFileSync(new URL("manifest.json", packDir), "utf8"));
const mainSource = readFileSync(new URL("scripts/main.js", packDir), "utf8");
const sortSource = readFileSync(new URL("scripts/sort_logic.js", packDir), "utf8");

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

test("manifest targets Minecraft 1.26.60+ and @minecraft/server 2.11.0", () => {
  assert.equal(manifest.format_version, 2);
  assert.deepEqual(manifest.header.min_engine_version, [1, 26, 60]);
  assert.deepEqual(manifest.header.version, [1, 2, 0]);

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
  for (const module of manifest.modules) assert.deepEqual(module.version, [1, 2, 0]);

  const scriptModule = manifest.modules.find((m) => m.type === "script");
  assert.equal(scriptModule.language, "javascript");
  assert.equal(scriptModule.entry, "scripts/main.js");
});

test("declared entry point and pack icon exist", () => {
  assert.equal(existsSync(fileURLToPath(new URL("scripts/main.js", packDir))), true);
  assert.equal(existsSync(fileURLToPath(new URL("scripts/sort_logic.js", packDir))), true);
  assert.equal(existsSync(fileURLToPath(new URL("pack_icon.png", packDir))), true);
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

test("sorter has explicit rules for every 1.26.x item family", () => {
  const rules = [
    /"_shelf"/,
    /"_cushion"/,
    /"_bars"/,
    /"_statue"/,
    /"_spike"/,
    /"_nautilus_armor"/,
    /"_spear"/,
    /"minecraft:cinnabar"/,
    /"minecraft:sulfur"/,
    /"minecraft:ice_crystal"/,
    /"minecraft:icicle"/,
    /"minecraft:lightning_rod"/,
    /"minecraft:golden_dandelion"/,
    /"minecraft:red_shrub"/,
    /"minecraft:shelf_mushroom"/,
    /"minecraft:potent_sulfur"/,
  ];
  for (const rule of rules) assert.match(sortSource, rule, `missing rule ${rule}`);
});
