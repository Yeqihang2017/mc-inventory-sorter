/**
 * sort_logic.js — 物品栏排序纯逻辑模块
 *
 * 不依赖 @minecraft/server，可独立单元测试。
 * 输入输出均为“类 ItemStack”对象：{ typeId, data?, amount, maxAmount? }
 * （游戏中的 ItemStack 副本也满足该结构，amount 会被修改，需自行保证传入的是副本）
 */

// ---------- 类别定义（数字越小越靠前） ----------
export const CAT = {
  TOOLS: 0,   // 工具/武器/弹药
  ARMOR: 1,   // 护甲装备
  FOOD: 2,    // 食物
  BLOCKS: 3,  // 建材方块
  MATERIALS: 4, // 矿物材料
  REDSTONE: 5, // 红石机制
  PLANTS: 6,  // 植物农业
  MISC: 7,    // 杂项
};

const CAT_NAMES = {
  [CAT.TOOLS]: "工具武器",
  [CAT.ARMOR]: "护甲装备",
  [CAT.FOOD]: "食物",
  [CAT.BLOCKS]: "建材方块",
  [CAT.MATERIALS]: "矿物材料",
  [CAT.REDSTONE]: "红石机制",
  [CAT.PLANTS]: "植物农业",
  [CAT.MISC]: "杂项",
};

// ---------- 食物 ----------
const FOOD_IDS = new Set([
  "minecraft:apple", "minecraft:golden_apple", "minecraft:enchanted_golden_apple",
  "minecraft:melon_slice", "minecraft:sweet_berries", "minecraft:glow_berries",
  "minecraft:carrot", "minecraft:golden_carrot", "minecraft:potato",
  "minecraft:baked_potato", "minecraft:poisonous_potato", "minecraft:beetroot",
  "minecraft:beetroot_soup", "minecraft:mushroom_stew", "minecraft:rabbit_stew",
  "minecraft:dried_kelp", "minecraft:beef", "minecraft:cooked_beef",
  "minecraft:porkchop", "minecraft:cooked_porkchop", "minecraft:chicken",
  "minecraft:cooked_chicken", "minecraft:mutton", "minecraft:cooked_mutton",
  "minecraft:rabbit", "minecraft:cooked_rabbit", "minecraft:cod",
  "minecraft:salmon", "minecraft:cooked_cod", "minecraft:cooked_salmon",
  "minecraft:tropical_fish", "minecraft:pufferfish", "minecraft:cookie",
  "minecraft:cake", "minecraft:pumpkin_pie", "minecraft:bread",
  "minecraft:chorus_fruit", "minecraft:suspicious_stew", "minecraft:honey_bottle",
  "minecraft:rotten_flesh", "minecraft:spider_eye", "minecraft:kelp",
]);

// ---------- 工具/武器 ----------
const TOOL_SUFFIXES = [
  "_sword", "_pickaxe", "_axe", "_shovel", "_hoe", "_bow", "_crossbow",
  "_trident", "_spear", "_mace", "_hammer", "_arrow", "_fishing_rod",
  "_bucket", "_boat", "_minecart",
];
const TOOL_IDS = new Set([
  "minecraft:shears", "minecraft:flint_and_steel", "minecraft:spyglass",
  "minecraft:brush", "minecraft:compass", "minecraft:recovery_compass",
  "minecraft:clock", "minecraft:map", "minecraft:empty_map", "minecraft:name_tag",
  "minecraft:lead", "minecraft:saddle", "minecraft:goat_horn", "minecraft:shield",
  "minecraft:bow", "minecraft:crossbow", "minecraft:trident", "minecraft:arrow",
  "minecraft:spectral_arrow", "minecraft:tipped_arrow", "minecraft:fishing_rod",
  "minecraft:totem_of_undying",
]);

// ---------- 护甲 ----------
const ARMOR_SUFFIXES = [
  "_helmet", "_chestplate", "_leggings", "_boots", "_horse_armor",
];
const ARMOR_IDS = new Set([
  "minecraft:elytra", "minecraft:wolf_armor",
]);

// ---------- 矿物/材料 ----------
const MATERIAL_SUFFIXES = [
  "_ore", "_ingot", "_nugget", "_scrap", "_dust", "_shard", "_crystal",
];
const MATERIAL_IDS = new Set([
  "minecraft:coal", "minecraft:charcoal", "minecraft:diamond", "minecraft:emerald",
  "minecraft:quartz", "minecraft:netherite_scrap", "minecraft:netherite_ingot",
  "minecraft:iron_ingot", "minecraft:gold_ingot", "minecraft:copper_ingot",
  "minecraft:iron_nugget", "minecraft:gold_nugget", "minecraft:raw_iron",
  "minecraft:raw_gold", "minecraft:raw_copper", "minecraft:lapis_lazuli",
  "minecraft:amethyst_shard", "minecraft:glowstone_dust",
  "minecraft:stick", "minecraft:flint", "minecraft:string", "minecraft:feather",
  "minecraft:bone", "minecraft:bone_meal", "minecraft:leather", "minecraft:rabbit_hide",
  "minecraft:ink_sac", "minecraft:glow_ink_sac", "minecraft:slime_ball",
  "minecraft:gunpowder", "minecraft:blaze_rod", "minecraft:blaze_powder",
  "minecraft:ender_pearl", "minecraft:ender_eye", "minecraft:ghast_tear",
  "minecraft:magma_cream", "minecraft:prismarine_shard", "minecraft:prismarine_crystals",
  "minecraft:nautilus_shell", "minecraft:heart_of_the_sea", "minecraft:phantom_membrane",
  "minecraft:shulker_shell", "minecraft:popped_chorus_fruit", "minecraft:echo_shard",
  "minecraft:disc_fragment_5", "minecraft:nether_star", "minecraft:dragon_breath",
  "minecraft:experience_bottle", "minecraft:sugar", "minecraft:paper",
  "minecraft:clay_ball", "minecraft:brick", "minecraft:glistering_melon_slice",
  "minecraft:breeze_rod", "minecraft:wind_charge",
]);

// ---------- 红石/机制 ----------
const REDSTONE_IDS = new Set([
  "minecraft:redstone", "minecraft:redstone_torch", "minecraft:redstone_lamp",
  "minecraft:redstone_block", "minecraft:repeater", "minecraft:comparator",
  "minecraft:observer", "minecraft:piston", "minecraft:sticky_piston",
  "minecraft:lever", "minecraft:target", "minecraft:bell", "minecraft:note_block",
  "minecraft:daylight_detector", "minecraft:tripwire_hook", "minecraft:hopper",
  "minecraft:dispenser", "minecraft:dropper", "minecraft:crafter",
  "minecraft:copper_bulb", "minecraft:sculk_sensor", "minecraft:calibrated_sculk_sensor",
  "minecraft:lectern", "minecraft:tnt", "minecraft:trapped_chest",
  "minecraft:rail", "minecraft:tnt_minecart",
]);
const REDSTONE_SUFFIXES = ["_button", "_pressure_plate", "_rail"];

// ---------- 植物/农业 ----------
const PLANT_SUFFIXES = ["_seeds", "_seed", "_sapling", "_pod", "_fungus", "_wart"];
const PLANT_IDS = new Set([
  "minecraft:wheat", "minecraft:sugar_cane", "minecraft:bamboo", "minecraft:vine",
  "minecraft:lily_pad", "minecraft:kelp", "minecraft:seagrass", "minecraft:glow_lichen",
  "minecraft:red_mushroom", "minecraft:brown_mushroom", "minecraft:crimson_fungus",
  "minecraft:warped_fungus", "minecraft:crimson_roots", "minecraft:warped_roots",
  "minecraft:nether_wart", "minecraft:cocoa_beans", "minecraft:torchflower",
  "minecraft:pitcher_plant", "minecraft:pitcher_pod", "minecraft:small_dripleaf",
  "minecraft:spore_blossom", "minecraft:hanging_roots", "minecraft:roots",
  "minecraft:dandelion", "minecraft:poppy", "minecraft:blue_orchid",
  "minecraft:allium", "minecraft:azure_bluet", "minecraft:red_tulip",
  "minecraft:orange_tulip", "minecraft:white_tulip", "minecraft:pink_tulip",
  "minecraft:oxeye_daisy", "minecraft:cornflower", "minecraft:lily_of_the_valley",
  "minecraft:wither_rose", "minecraft:torchflower", "minecraft:pitcher_plant",
  "minecraft:sunflower", "minecraft:lilac", "minecraft:rose_bush", "minecraft:peony",
  "minecraft:short_grass", "minecraft:fern", "minecraft:large_fern",
  "minecraft:dead_bush", "minecraft:cactus",
]);

// ---------- 方块/建材 ----------
const BLOCK_SUFFIXES = [
  "_planks", "_log", "_wood", "_leaves", "_wool", "_terracotta", "_concrete",
  "_glass", "_glass_pane", "_bricks", "_brick", "_cobblestone", "_sandstone",
  "_slab", "_stairs", "_wall", "_fence", "_fence_gate", "_door", "_trapdoor",
  "_carpet", "_shulker_box", "_chest", "_barrel", "_bookshelf", "_bed",
  "_lantern", "_torch", "_chain", "_anvil", "_smoker", "_furnace",
  "_blast_furnace", "_cauldron", "_table", "_campfire", "_ladder", "_sign",
  "_hanging_sign", "_banner", "_head", "_skull", "_candle", "_flower_pot",
  "_moss", "_dripstone", "_copper", "_amethyst", "_block", "_end_rod",
  "_purpur", "_mud", "_tuff", "_deepslate", "_diorite", "_andesite",
  "_granite", "_powder",
];
const BLOCK_PREFIXES = [
  "minecraft:stone", "minecraft:dirt", "minecraft:sand", "minecraft:gravel",
  "minecraft:clay", "minecraft:netherrack", "minecraft:obsidian", "minecraft:bedrock",
  "minecraft:end_stone", "minecraft:quartz_block", "minecraft:sponge", "minecraft:ice",
  "minecraft:snow_block", "minecraft:snow", "minecraft:pumpkin", "minecraft:melon",
  "minecraft:sea_lantern", "minecraft:prismarine", "minecraft:coral", "minecraft:sea_pickle",
  "minecraft:vine", "minecraft:lily_pad", "minecraft:sugar_cane", "minecraft:bamboo",
  "minecraft:mushroom", "minecraft:flower", "minecraft:tallgrass", "minecraft:grass_block",
  "minecraft:moss", "minecraft:rooted_dirt", "minecraft:podzol", "minecraft:mycelium",
  "minecraft:magma", "minecraft:sculk", "minecraft:copper", "minecraft:glass",
  "minecraft:glowstone", "minecraft:tuff", "minecraft:calcite", "minecraft:amethyst",
  "minecraft:dripstone", "minecraft:pointed_dripstone", "minecraft:blackstone",
  "minecraft:basalt", "minecraft:crying_obsidian",
];
const BLOCK_IDS = new Set([
  "minecraft:crafting_table", "minecraft:bookshelf", "minecraft:chest",
  "minecraft:barrel", "minecraft:furnace", "minecraft:spawner", "minecraft:beacon",
  "minecraft:enchanting_table", "minecraft:grindstone", "minecraft:stonecutter",
  "minecraft:loom", "minecraft:composter", "minecraft:brewing_stand",
  "minecraft:jukebox", "minecraft:respawn_anchor", "minecraft:lodestone",
  "minecraft:conduit", "minecraft:scaffolding", "minecraft:ender_chest",
  "minecraft:anvil", "minecraft:smoker", "minecraft:blast_furnace",
]);

// ---------- 分类器（带缓存） ----------
const classifyCache = new Map();
function classifyRaw(id) {
  if (id.endsWith("_spawn_egg")) return CAT.MISC;
  if (FOOD_IDS.has(id)) return CAT.FOOD;
  if (ARMOR_IDS.has(id)) return CAT.ARMOR;
  if (ARMOR_SUFFIXES.some((s) => id.endsWith(s))) return CAT.ARMOR;
  if (TOOL_IDS.has(id)) return CAT.TOOLS;
  if (TOOL_SUFFIXES.some((s) => id.endsWith(s))) return CAT.TOOLS;
  if (PLANT_IDS.has(id)) return CAT.PLANTS;
  if (PLANT_SUFFIXES.some((s) => id.endsWith(s))) return CAT.PLANTS;
  if (MATERIAL_IDS.has(id)) return CAT.MATERIALS;
  if (MATERIAL_SUFFIXES.some((s) => id.endsWith(s))) return CAT.MATERIALS;
  if (REDSTONE_IDS.has(id)) return CAT.REDSTONE;
  if (REDSTONE_SUFFIXES.some((s) => id.endsWith(s))) return CAT.REDSTONE;
  if (BLOCK_IDS.has(id)) return CAT.BLOCKS;
  if (BLOCK_SUFFIXES.some((s) => id.endsWith(s))) return CAT.BLOCKS;
  if (BLOCK_PREFIXES.some((p) => id.startsWith(p))) return CAT.BLOCKS;
  return CAT.MISC;
}

export function classify(id) {
  let c = classifyCache.get(id);
  if (c === undefined) {
    c = classifyRaw(id);
    classifyCache.set(id, c);
  }
  return c;
}

export function categoryName(id) {
  return CAT_NAMES[classify(id)];
}

// ---------- 合并 + 排序 ----------
export function stackKey(st) {
  return st.typeId + "|" + (st.data ?? 0);
}

export function maxAmountOf(st) {
  const m = Number(st.maxAmount);
  return Number.isFinite(m) && m > 0 ? m : 64;
}

/**
 * 组内堆叠合并（纯算术，不依赖游戏 API）。
 *
 * 重要：不会把任何栈的 amount 减到 0 —— ItemStack.amount 的合法范围是 [1,255]，
 * 赋值 0 会抛 "Unsupported or out of bounds value set on Property: amount"。
 * 做法：组内所有栈求和，再拆成若干合法数量（满堆叠 + 余数）的栈。
 * 第一个栈复用传入对象（原地改 amount），其余栈用 cloneFn 复制模板，保留
 * 颜色/状态/自定义数据等属性。
 *
 * @param {Array<Array<{typeId:string,data?:number,amount:number,maxAmount?:number}>>} groups
 * @param {Function} [cloneFn] 复制栈的函数，默认浅拷贝（测试用）；
 *        游戏中应传 (st) => st.clone()（ItemStack.clone 官方方法）
 * @returns 合并后的物品数组（同类相邻，可能仍有多个满堆叠/余数堆叠）
 */
export function mergeGroups(groups, cloneFn = (st) => ({ ...st })) {
  const out = [];
  for (const arr of groups) {
    if (!arr || arr.length === 0) continue;

    // 求和 + 组内最大堆叠数（同类物品一致，防御性取最大）
    let sum = 0;
    let cap = 1;
    let template = null;
    for (const st of arr) {
      if (!st || st.amount <= 0) continue;
      sum += st.amount;
      cap = Math.max(cap, maxAmountOf(st));
      if (!template) template = st;
    }
    if (sum <= 0 || !template) continue;

    // 拆成合法数量的栈：满堆叠 + 余数（余数 ≥ 1，绝不产生 0）
    let remaining = sum;
    let first = true;
    while (remaining > 0) {
      const n = Math.min(cap, remaining);
      const s = first ? template : cloneFn(template);
      first = false;
      if (s.amount !== n) s.amount = n; // n ∈ [1, cap]，恒合法
      out.push(s);
      remaining -= n;
    }
  }
  return out;
}

/**
 * 按类别 + 名称排序（纯函数，不改动原数组）。
 * @param {Array<{typeId:string,data?:number}>} items
 * @returns 排序后的新数组
 */
export function sortItems(items) {
  return [...items].sort((a, b) => {
    const ca = classify(a.typeId);
    const cb = classify(b.typeId);
    if (ca !== cb) return ca - cb;
    if (a.typeId !== b.typeId) return a.typeId < b.typeId ? -1 : 1;
    return (a.data ?? 0) - (b.data ?? 0);
  });
}

/**
 * 一键合并 + 排序（测试/通用入口）。
 * 分组规则：默认按 typeId+data 比较；可传入自定义 stackable 判定函数
 * （游戏中可传 ItemStack.isStackableWith 以获得引擎级正确性）。
 * @param {Array<{typeId:string,data?:number,amount:number,maxAmount?:number}>} items
 * @param {Function} [stackable] 可选：(a, b) => boolean
 * @param {Function} [cloneFn] 可选：复制栈的函数（默认浅拷贝）
 * @returns 排序后的物品数组
 */
export function mergeAndSort(items, stackable, cloneFn) {
  const groups = [];
  for (const st of items) {
    if (!st || !st.typeId || st.typeId === "minecraft:air" || st.amount <= 0) continue;
    let placed = false;
    for (const g of groups) {
      const same = stackable ? stackable(g[0], st) : stackKey(g[0]) === stackKey(st);
      if (same) {
        g.push(st);
        placed = true;
        break;
      }
    }
    if (!placed) groups.push([st]);
  }
  return sortItems(mergeGroups(groups, cloneFn));
}
