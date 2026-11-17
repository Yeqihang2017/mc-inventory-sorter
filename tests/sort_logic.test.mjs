import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  CAT,
  classify,
  categoryName,
  sectionOf,
  sortItems,
  mergeGroups,
  mergeAndSort,
} from "../InventorySorterBP/scripts/sort_logic.js";

/** Build a plain ItemStack-like object for the pure sorting logic. */
function stack(typeId, amount = 1, extra = {}) {
  return { typeId, amount, maxAmount: 64, ...extra };
}

const idsOf = (stacks) => stacks.map((s) => s.typeId);

test("mergeGroups merges 40+40+40 cobblestone into 64+56", () => {
  const out = mergeGroups([[stack("minecraft:cobblestone", 40), stack("minecraft:cobblestone", 40), stack("minecraft:cobblestone", 40)]]);
  assert.deepEqual(out.map((s) => s.amount), [64, 56]);
  assert.equal(out.reduce((sum, s) => sum + s.amount, 0), 120);
});

test("mergeGroups respects non-64 max stack sizes", () => {
  const out = mergeGroups([
    [stack("minecraft:ender_pearl", 10, { maxAmount: 16 }), stack("minecraft:ender_pearl", 10, { maxAmount: 16 })],
  ]);
  assert.deepEqual(out.map((s) => s.amount), [16, 4]);
});

test("mergeAndSort merges apples to 64+1", () => {
  const out = mergeAndSort([stack("minecraft:apple", 5), stack("minecraft:apple", 60)]);
  assert.deepEqual(out.map((s) => s.amount), [64, 1]);
});

test("mergeAndSort never merges different items, data values or non-stackables", () => {
  assert.equal(mergeAndSort([stack("minecraft:cobblestone", 30), stack("minecraft:stone", 30)]).length, 2);
  assert.equal(mergeAndSort([stack("minecraft:potion", 1, { data: 0 }), stack("minecraft:potion", 1, { data: 1 })]).length, 2);
  assert.equal(mergeAndSort([stack("minecraft:diamond_sword", 1, { maxAmount: 1 }), stack("minecraft:diamond_sword", 1, { maxAmount: 1 })]).length, 2);
});

test("mergeAndSort does not lose items when a full stack is mixed with a remainder", () => {
  const out = mergeAndSort([stack("minecraft:cobblestone", 64), stack("minecraft:cobblestone", 30)]);
  assert.equal(out.reduce((sum, s) => sum + s.amount, 0), 94);
});

test("categories follow the creative-inventory order used by Inventory Profiles Next", () => {
  const expected = [
    "minecraft:oak_planks",       // 建筑方块
    "minecraft:white_wool",       // 染色方块
    "minecraft:oak_log",          // 自然方块
    "minecraft:chest",            // 功能方块
    "minecraft:redstone",         // 红石
    "minecraft:diamond_pickaxe",  // 工具与实用物品
    "minecraft:diamond_sword",    // 战斗用品
    "minecraft:apple",            // 食物与饮品
    "minecraft:iron_ingot",       // 原材料
    "minecraft:pig_spawn_egg",    // 刷怪蛋
    "minecraft:command_block",    // 其他
  ];
  const shuffled = [
    expected[6], expected[10], expected[2], expected[8], expected[0],
    expected[9], expected[4], expected[7], expected[1], expected[5], expected[3],
  ].map((id) => stack(id));
  assert.deepEqual(idsOf(sortItems(shuffled)), expected);
});

test("classification maps 1.26.x content to the creative categories", () => {
  const expected = [
    ["minecraft:oak_shelf", CAT.FUNCTIONAL],
    ["minecraft:white_cushion", CAT.COLORED],
    ["minecraft:cinnabar", CAT.BUILDING],
    ["minecraft:chiseled_cinnabar", CAT.BUILDING],
    ["minecraft:polished_sulfur", CAT.BUILDING],
    ["minecraft:sulfur_bricks", CAT.BUILDING],
    ["minecraft:sulfur_spike", CAT.BUILDING],
    ["minecraft:copper_bars", CAT.BUILDING],
    ["minecraft:copper_golem_statue", CAT.BUILDING],
    ["minecraft:copper_torch", CAT.BUILDING],
    ["minecraft:copper_lantern", CAT.BUILDING],
    ["minecraft:lightning_rod", CAT.REDSTONE],
    ["minecraft:exposed_lightning_rod", CAT.REDSTONE],
    ["minecraft:waxed_oxidized_lightning_rod", CAT.REDSTONE],
    ["minecraft:copper_nautilus_armor", CAT.COMBAT],
    ["minecraft:netherite_nautilus_armor", CAT.COMBAT],
    ["minecraft:copper_horse_armor", CAT.COMBAT],
    ["minecraft:netherite_horse_armor", CAT.COMBAT],
    ["minecraft:wooden_spear", CAT.COMBAT],
    ["minecraft:stone_spear", CAT.COMBAT],
    ["minecraft:netherite_spear", CAT.COMBAT],
    ["minecraft:golden_dandelion", CAT.NATURAL],
    ["minecraft:red_shrub", CAT.NATURAL],
    ["minecraft:shelf_mushroom", CAT.NATURAL],
    ["minecraft:ice_crystal", CAT.BUILDING],
    ["minecraft:icicle", CAT.BUILDING],
    ["minecraft:straw_bed", CAT.FUNCTIONAL],
    ["minecraft:poplar_planks", CAT.BUILDING],
    ["minecraft:poplar_log", CAT.NATURAL],
    ["minecraft:poplar_sapling", CAT.NATURAL],
    ["minecraft:poplar_boat", CAT.TOOLS],
    ["minecraft:poplar_button", CAT.REDSTONE],
    ["minecraft:sulfur_cube_bucket", CAT.TOOLS],
    ["minecraft:sulfur_cube_spawn_egg", CAT.SPAWN_EGGS],
    ["minecraft:music_disc_bounce", CAT.INGREDIENTS],
    ["minecraft:netherite_upgrade_smithing_template", CAT.INGREDIENTS],
  ];
  for (const [id, category] of expected) {
    assert.equal(classify(id), category, `${id} should be ${categoryName(id)} (${category})`);
  }
});

test("wood family stays together: planks -> stairs -> slab -> fence -> gate -> door -> trapdoor -> sign", () => {
  const items = [
    "minecraft:oak_sign",
    "minecraft:spruce_planks",
    "minecraft:oak_trapdoor",
    "minecraft:oak_planks",
    "minecraft:oak_stairs",
    "minecraft:oak_fence_gate",
    "minecraft:oak_fence",
    "minecraft:oak_door",
    "minecraft:oak_slab",
  ].map((id) => stack(id));
  assert.deepEqual(idsOf(sortItems(items)), [
    "minecraft:oak_planks",
    "minecraft:oak_stairs",
    "minecraft:oak_slab",
    "minecraft:oak_fence",
    "minecraft:oak_fence_gate",
    "minecraft:oak_door",
    "minecraft:oak_trapdoor",
    "minecraft:oak_sign",
    "minecraft:spruce_planks",
  ]);
});

test("stone family orders base -> stairs -> slab -> wall, with weathered variants next to their shape", () => {
  const items = [
    "minecraft:mossy_cobblestone",
    "minecraft:cobblestone_wall",
    "minecraft:cobblestone_slab",
    "minecraft:cobblestone",
    "minecraft:cobblestone_stairs",
  ].map((id) => stack(id));
  assert.deepEqual(idsOf(sortItems(items)), [
    "minecraft:cobblestone",
    "minecraft:mossy_cobblestone",
    "minecraft:cobblestone_stairs",
    "minecraft:cobblestone_slab",
    "minecraft:cobblestone_wall",
  ]);
});

test("colored blocks follow the 16 dye colors and stay grouped by shape", () => {
  const items = [
    "minecraft:black_wool",
    "minecraft:white_carpet",
    "minecraft:white_wool",
    "minecraft:black_carpet",
    "minecraft:white_wool_slab",
    "minecraft:white_wool_stairs",
  ].map((id) => stack(id));
  const sorted = idsOf(sortItems(items));
  assert.deepEqual(sorted.slice(0, 3), [
    "minecraft:white_wool",
    "minecraft:white_wool_stairs",
    "minecraft:white_wool_slab",
  ]);
  assert.deepEqual(sorted.slice(3), [
    "minecraft:black_wool",
    "minecraft:white_carpet",
    "minecraft:black_carpet",
  ]);
});

test("tools and armor order by material tier", () => {
  const tools = [
    "minecraft:netherite_pickaxe",
    "minecraft:iron_pickaxe",
    "minecraft:wooden_pickaxe",
    "minecraft:stone_pickaxe",
    "minecraft:copper_pickaxe",
  ].map((id) => stack(id));
  assert.deepEqual(idsOf(sortItems(tools)), [
    "minecraft:wooden_pickaxe",
    "minecraft:stone_pickaxe",
    "minecraft:copper_pickaxe",
    "minecraft:iron_pickaxe",
    "minecraft:netherite_pickaxe",
  ]);

  const armor = [
    "minecraft:diamond_boots",
    "minecraft:iron_helmet",
    "minecraft:leather_chestplate",
    "minecraft:diamond_helmet",
    "minecraft:leather_helmet",
  ].map((id) => stack(id));
  assert.deepEqual(idsOf(sortItems(armor)), [
    "minecraft:leather_helmet",
    "minecraft:leather_chestplate",
    "minecraft:iron_helmet",
    "minecraft:diamond_helmet",
    "minecraft:diamond_boots",
  ]);
});

test("copper follows plain -> cut -> exposed -> weathered -> oxidized -> waxed", () => {
  const items = [
    "minecraft:waxed_copper",
    "minecraft:oxidized_copper",
    "minecraft:exposed_copper",
    "minecraft:copper_block",
    "minecraft:cut_copper",
  ].map((id) => stack(id));
  assert.deepEqual(idsOf(sortItems(items)), [
    "minecraft:copper_block",
    "minecraft:cut_copper",
    "minecraft:exposed_copper",
    "minecraft:oxidized_copper",
    "minecraft:waxed_copper",
  ]);
});

test("stacks that differ only by data stay adjacent and ordered", () => {
  const items = [
    stack("minecraft:potion", 1, { data: 2 }),
    stack("minecraft:potion", 1, { data: 0 }),
    stack("minecraft:potion", 1, { data: 1 }),
  ];
  assert.deepEqual(sortItems(items).map((s) => s.data), [0, 1, 2]);
});

test("every 1.26.60 registry item is classified (only admin blocks stay in 其他)", () => {
  const fixture = readFileSync(
    new URL("./fixtures/vanilla-items-1.26.60.txt", import.meta.url),
    "utf8",
  );
  const ids = fixture.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  assert.equal(ids.length, 1627, "fixture should contain the whole 1.26.60 registry");

  const adminAllowed = new Set(["minecraft:bedrock", "minecraft:barrier", "minecraft:allow", "minecraft:deny"]);
  for (const id of ids) {
    const section = sectionOf(id);
    assert.ok(section && section.length > 0, `${id} has no section`);
    if (section === "misc_other") {
      assert.ok(
        adminAllowed.has(id) ||
          id === "minecraft:structure_block" ||
          id === "minecraft:structure_void" ||
          id === "minecraft:jigsaw" ||
          id === "minecraft:border_block" ||
          id.endsWith("command_block") ||
          id.startsWith("minecraft:light_block_"),
        `${id} fell through to 其他 but is not an admin-only block`,
      );
    }
  }
});

test("sorting the whole registry keeps every section contiguous and is deterministic", () => {
  const fixture = readFileSync(
    new URL("./fixtures/vanilla-items-1.26.60.txt", import.meta.url),
    "utf8",
  );
  const items = fixture
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((id) => stack(id));

  const first = idsOf(sortItems(items));
  const second = idsOf(sortItems(items));
  assert.deepEqual(first, second, "sorting must be deterministic");

  const seen = new Set();
  let current = null;
  for (const id of first) {
    const section = sectionOf(id);
    if (section !== current) {
      assert.ok(!seen.has(section), `section ${section} appears in more than one block`);
      seen.add(section);
      current = section;
    }
  }
});
