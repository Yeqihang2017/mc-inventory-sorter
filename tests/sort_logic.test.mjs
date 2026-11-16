import test from "node:test";
import assert from "node:assert/strict";

import {
  CAT,
  classify,
  categoryName,
  familyOf,
  materialOf,
  shapeOf,
  hasModifier,
  mergeGroups,
  mergeAndSort,
  sortItems,
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

test("sortItems orders categories tools -> armor -> food -> blocks -> materials -> redstone -> plants -> misc", () => {
  const items = [
    stack("minecraft:music_disc_13"),
    stack("minecraft:oak_sapling"),
    stack("minecraft:redstone"),
    stack("minecraft:iron_ingot"),
    stack("minecraft:oak_shelf"),
    stack("minecraft:apple"),
    stack("minecraft:iron_helmet"),
    stack("minecraft:diamond_sword"),
  ];
  assert.deepEqual(idsOf(sortItems(items)), [
    "minecraft:diamond_sword",
    "minecraft:iron_helmet",
    "minecraft:apple",
    "minecraft:oak_shelf",
    "minecraft:iron_ingot",
    "minecraft:redstone",
    "minecraft:oak_sapling",
    "minecraft:music_disc_13",
  ]);
});

test("1.26.x blocks and items are classified into the right categories", () => {
  const expected = [
    ["minecraft:oak_shelf", CAT.BLOCKS],
    ["minecraft:bamboo_shelf", CAT.BLOCKS],
    ["minecraft:white_cushion", CAT.BLOCKS],
    ["minecraft:black_wool_stairs", CAT.BLOCKS],
    ["minecraft:white_concrete_slab", CAT.BLOCKS],
    ["minecraft:cinnabar", CAT.BLOCKS],
    ["minecraft:chiseled_cinnabar", CAT.BLOCKS],
    ["minecraft:polished_sulfur", CAT.BLOCKS],
    ["minecraft:sulfur_bricks", CAT.BLOCKS],
    ["minecraft:sulfur_spike", CAT.BLOCKS],
    ["minecraft:copper_bars", CAT.BLOCKS],
    ["minecraft:copper_golem_statue", CAT.BLOCKS],
    ["minecraft:copper_torch", CAT.BLOCKS],
    ["minecraft:copper_lantern", CAT.BLOCKS],
    ["minecraft:lightning_rod", CAT.REDSTONE],
    ["minecraft:exposed_lightning_rod", CAT.REDSTONE],
    ["minecraft:waxed_oxidized_lightning_rod", CAT.REDSTONE],
    ["minecraft:copper_nautilus_armor", CAT.ARMOR],
    ["minecraft:netherite_nautilus_armor", CAT.ARMOR],
    ["minecraft:copper_horse_armor", CAT.ARMOR],
    ["minecraft:netherite_horse_armor", CAT.ARMOR],
    ["minecraft:wooden_spear", CAT.TOOLS],
    ["minecraft:stone_spear", CAT.TOOLS],
    ["minecraft:netherite_spear", CAT.TOOLS],
    ["minecraft:golden_dandelion", CAT.PLANTS],
    ["minecraft:red_shrub", CAT.PLANTS],
    ["minecraft:shelf_mushroom", CAT.PLANTS],
    ["minecraft:ice_crystal", CAT.BLOCKS],
    ["minecraft:icicle", CAT.BLOCKS],
    ["minecraft:straw_bed", CAT.BLOCKS],
    ["minecraft:poplar_planks", CAT.BLOCKS],
    ["minecraft:poplar_log", CAT.BLOCKS],
    ["minecraft:poplar_sapling", CAT.PLANTS],
    ["minecraft:poplar_boat", CAT.TOOLS],
    ["minecraft:poplar_button", CAT.REDSTONE],
    ["minecraft:sulfur_cube_bucket", CAT.TOOLS],
    ["minecraft:sulfur_cube_spawn_egg", CAT.MISC],
    ["minecraft:music_disc_bounce", CAT.MISC],
  ];
  for (const [id, category] of expected) {
    assert.equal(classify(id), category, `${id} should be ${categoryName(id)} (${category})`);
  }
});

test("new block families group by material and shape", () => {
  assert.equal(familyOf("minecraft:oak_shelf"), "shelves");
  assert.equal(materialOf("minecraft:oak_shelf"), "minecraft:oak");
  assert.equal(shapeOf("minecraft:oak_shelf"), 3);

  assert.equal(familyOf("minecraft:white_cushion"), "cushions");
  assert.equal(familyOf("minecraft:white_wool"), "wool");
  assert.equal(materialOf("minecraft:white_wool"), "minecraft:white_wool");
  assert.equal(shapeOf("minecraft:white_wool"), 0);
  assert.equal(shapeOf("minecraft:white_wool_stairs"), 1);
  assert.equal(shapeOf("minecraft:white_wool_slab"), 2);

  assert.equal(familyOf("minecraft:white_concrete"), "concrete");
  assert.equal(materialOf("minecraft:white_concrete"), "minecraft:white_concrete");
  assert.equal(shapeOf("minecraft:white_concrete"), 0);
  assert.equal(shapeOf("minecraft:white_concrete_stairs"), 1);
  assert.equal(shapeOf("minecraft:white_concrete_slab"), 2);

  assert.equal(familyOf("minecraft:cinnabar"), "stones");
  assert.equal(materialOf("minecraft:cinnabar"), "minecraft:cinnabar");
  assert.equal(shapeOf("minecraft:cinnabar"), 0);
  assert.equal(shapeOf("minecraft:cinnabar_stairs"), 1);
  assert.equal(materialOf("minecraft:cinnabar_brick_stairs"), "minecraft:cinnabar");

  assert.equal(familyOf("minecraft:lightning_rod"), "rods");
  assert.equal(materialOf("minecraft:lightning_rod"), "minecraft:lightning");
  assert.equal(familyOf("minecraft:copper_nautilus_armor"), "armor");
  assert.equal(materialOf("minecraft:copper_nautilus_armor"), "minecraft:copper");
  assert.equal(familyOf("minecraft:stone_spear"), "spears");
  assert.equal(materialOf("minecraft:stone_spear"), "minecraft:stone");
  assert.equal(familyOf("minecraft:potent_sulfur"), "stones");
  assert.equal(materialOf("minecraft:potent_sulfur"), "minecraft:sulfur");
  assert.equal(hasModifier("minecraft:potent_sulfur"), true);
});

test("wool and concrete variants sort base -> stairs -> slab", () => {
  const items = [
    stack("minecraft:white_wool_slab"),
    stack("minecraft:white_wool_stairs"),
    stack("minecraft:white_wool"),
    stack("minecraft:white_concrete_slab"),
    stack("minecraft:white_concrete_stairs"),
    stack("minecraft:white_concrete"),
  ];
  const sorted = idsOf(sortItems(items));
  assert.deepEqual(sorted.slice(0, 3), [
    "minecraft:white_concrete",
    "minecraft:white_concrete_stairs",
    "minecraft:white_concrete_slab",
  ]);
  assert.deepEqual(sorted.slice(3), [
    "minecraft:white_wool",
    "minecraft:white_wool_stairs",
    "minecraft:white_wool_slab",
  ]);
});

test("shelves and spears stay in one contiguous family block", () => {
  const shelves = [
    "minecraft:oak_shelf",
    "minecraft:birch_shelf",
    "minecraft:acacia_shelf",
    "minecraft:oak_planks",
    "minecraft:spruce_shelf",
  ].map((id) => stack(id));
  const sortedShelves = idsOf(sortItems(shelves));
  const shelfPositions = sortedShelves.map((id, index) => (id.endsWith("_shelf") ? index : -1)).filter((i) => i >= 0);
  assert.deepEqual(shelfPositions, [1, 2, 3, 4]);

  const spears = [
    "minecraft:netherite_spear",
    "minecraft:stone_spear",
    "minecraft:wooden_spear",
    "minecraft:diamond_sword",
  ].map((id) => stack(id));
  const sortedSpears = idsOf(sortItems(spears));
  assert.deepEqual(sortedSpears.slice(0, 3), [
    "minecraft:netherite_spear",
    "minecraft:stone_spear",
    "minecraft:wooden_spear",
  ]);
  assert.equal(sortedSpears[3], "minecraft:diamond_sword");
});
