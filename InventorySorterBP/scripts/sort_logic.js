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
  "minecraft:totem_of_undying", "minecraft:bucket", "minecraft:carrot_on_a_stick",
  "minecraft:warped_fungus_on_a_stick",
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
  "minecraft:ancient_debris", "minecraft:book", "minecraft:armadillo_scute",
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
const REDSTONE_SUFFIXES = ["_button", "_pressure_plate", "_rail", "_bulb"];

// ---------- 植物/农业 ----------
const PLANT_SUFFIXES = ["_seeds", "_seed", "_sapling", "_pod", "_fungus", "_wart", "_nylium", "_vines", "_flowered"];
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
  "minecraft:big_dripleaf", "minecraft:chorus_plant", "minecraft:chorus_flower",
  "minecraft:cocoa", "minecraft:carrots", "minecraft:beetroots",
  "minecraft:azalea", "minecraft:bush", "minecraft:cactus_flower",
  "minecraft:closed_eyeblossom", "minecraft:open_eyeblossom",
  "minecraft:crimson_nylium", "minecraft:warped_nylium",
  "minecraft:cave_vines", "minecraft:cave_vines_body_with_berries",
  "minecraft:cave_vines_head_with_berries",
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
  "_granite", "_powder", "_stem", "_hyphae", "_grate", "_pillar",
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
  // 无下划线的基础石块（后缀匹配不到，必须显式前缀）
  "minecraft:cobblestone", "minecraft:granite", "minecraft:diorite",
  "minecraft:andesite", "minecraft:deepslate", "minecraft:sandstone",
  "minecraft:soul_sand", "minecraft:soul_soil",
  // 无下划线/无规律后缀的建材
  "minecraft:dark_prismarine", "minecraft:beehive", "minecraft:bee_nest",
  "minecraft:deadbush", "minecraft:blue_ice", "minecraft:carved_pumpkin",
  "minecraft:campfire",
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
  if (id.endsWith("_candle_cake") || id === "minecraft:candle_cake") return CAT.FOOD; // 蜡烛蛋糕（可食用）
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
  // 兜底：剥离修饰前缀后再试一次（polished_basalt → basalt，smooth_stone → stone，
  // chiseled_polished_blackstone → blackstone）。防死循环：剥完没变化就返回 MISC。
  const stripped = stripPrefixes(id);
  if (stripped !== id) return classifyRaw(stripped);
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

// ---------- 物品族（family）、材料（material）、形态（shape） ----------
// family：大类相邻（原木一族、木板一族、石料一族……）
// material：剥掉修饰前缀 + 形态后缀后的基材（cobblestone_stairs → cobblestone）
// shape：形态档位（0=基础块/基材，1=楼梯，2=台阶，3=其他衍生：墙/砖/矿石/块等）
// 排序键：类别 → 族 → 材料 → 形态档 → 有无修饰 → ID → data
// 效果（用户要求）：每种石料按「基础块 → 楼梯 → 台阶 → 其他衍生」排，
// 例如：圆石、圆石楼梯、圆石台阶、圆石墙、苔石、苔石楼梯……；
// 石砖、裂纹石砖、苔石砖紧邻，平滑石台阶（台阶形态）不会插进砖中间。

// 修饰前缀：剥掉后再判断（waxed_weathered_copper_chest → copper_chest 等）。
// deepslate_ 是岩层前缀（deepslate_diamond_ore → diamond_ore，与普通矿相邻）；
// raw_ 是原矿前缀（raw_iron → iron，与铁锭/铁矿相邻）；
// cobbled_ 是"圆石化"前缀（cobbled_deepslate → deepslate）。
const FAMILY_STRIP = [
  "waxed_", "weathered_", "oxidized_", "exposed_", "stripped_", "crying_",
  "polished_", "chiseled_", "cut_", "smooth_", "cracked_", "mossy_",
  "infested_", "dead_", "glazed_", "tinted_", "deepslate_", "cobbled_",
  "raw_",
];

// 形态后缀表：后缀 → 档位（长的在前，避免 _concrete 抢先匹配 _concrete_powder）。
// 同时用于提取材料（迭代剥掉这些后缀得到基材）和判断形态档位。
const SHAPE_SUFFIX = [
  ["_pressure_plate", 3], ["_fence_gate", 3], ["_hanging_sign", 3],
  ["_glass_pane", 3], ["_flower_pot", 3], ["_concrete_powder", 3],
  ["_smithing_template", 3], ["_pottery_sherd", 3], ["_music_disc", 3],
  ["_spawn_egg", 3], ["_shulker_box", 3],
  ["_stairs", 1], ["_slab", 2],
  ["_trapdoor", 3], ["_tiles", 3], ["_tile", 3], ["_bricks", 3],
  ["_brick", 3], ["_planks", 3], ["_leaves", 3], ["_sapling", 3],
  ["_wall", 3], ["_fence", 3], ["_door", 3], ["_button", 3],
  ["_pillar", 3], ["_ore", 3], ["_block", 3], ["_wool", 3],
  ["_carpet", 3], ["_concrete", 3], ["_glass", 3], ["_terracotta", 3],
  ["_log", 3], ["_wood", 3], ["_stem", 3], ["_hyphae", 3],
  ["_ingot", 3], ["_nugget", 3], ["_boat", 3], ["_minecart", 3],
  ["_sign", 3], ["_banner", 3], ["_bed", 3], ["_candle", 3],
  ["_torch", 3], ["_lantern", 3], ["_head", 3], ["_skull", 3],
  ["_chest", 3], ["_barrel", 3], ["_anvil", 3], ["_cauldron", 3],
  ["_chain", 3], ["_campfire", 3], ["_bucket", 3], ["_egg", 3],
];

// 石质材料：这些材料的所有变体（墙/台阶/楼梯/砖/柱/瓦等）都归入 stones 大类
const STONE_MATERIALS = new Set([
  "minecraft:stone", "minecraft:cobblestone", "minecraft:granite",
  "minecraft:diorite", "minecraft:andesite", "minecraft:sandstone",
  "minecraft:red_sandstone", "minecraft:quartz", "minecraft:brick",
  "minecraft:deepslate", "minecraft:blackstone", "minecraft:basalt",
  "minecraft:tuff", "minecraft:calcite", "minecraft:end_stone",
  "minecraft:purpur", "minecraft:prismarine", "minecraft:magma",
  "minecraft:obsidian", "minecraft:netherrack", "minecraft:nether",
]);

// 剥离修饰前缀（迭代，直到无可剥离）
function stripPrefixes(id) {
  let s = id;
  for (;;) {
    let changed = false;
    for (const p of FAMILY_STRIP) {
      const pre = "minecraft:" + p;
      if (s.startsWith(pre)) {
        s = "minecraft:" + s.slice(pre.length);
        changed = true;
      }
    }
    if (!changed) break;
  }
  return s;
}

const materialCache = new Map();

/**
 * 提取材料：剥掉修饰前缀 + 迭代剥掉形态后缀（楼梯/台阶/墙/砖/矿石/块等），
 * 得到基材。例：cobblestone_stairs → minecraft:cobblestone；
 *     mossy_cobblestone_wall → minecraft:cobblestone；
 *     cracked_stone_bricks → minecraft:stone；deepslate_diamond_ore → minecraft:diamond。
 * @param {string} id 物品 ID
 * @returns {string} 材料标识
 */
export function materialOf(id) {
  let m = materialCache.get(id);
  if (m !== undefined) return m;
  let s = stripPrefixes(id);
  for (;;) {
    let stripped = false;
    for (const [suf] of SHAPE_SUFFIX) {
      if (s.endsWith(suf) && s.length - suf.length > "minecraft:".length) {
        s = s.slice(0, s.length - suf.length);
        stripped = true;
        break;
      }
    }
    if (!stripped) break;
  }
  m = s;
  materialCache.set(id, m);
  return m;
}

const shapeCache = new Map();

/**
 * 形态档位：0=基础块/基材，1=楼梯，2=台阶，3=其他衍生（墙/砖/块/矿石/栅栏等）。
 * 组内排序：基础块 → 楼梯 → 台阶 → 其他衍生。
 * @param {string} id 物品 ID
 * @returns {number} 档位
 */
export function shapeOf(id) {
  let sh = shapeCache.get(id);
  if (sh !== undefined) return sh;
  const s = stripPrefixes(id);
  sh = 0;
  for (const [suf, level] of SHAPE_SUFFIX) {
    if (s.endsWith(suf)) { sh = level; break; }
  }
  shapeCache.set(id, sh);
  return sh;
}

const modifierCache = new Map();

/**
 * 是否带修饰前缀（cracked_/mossy_/stripped_/waxed_ 等）。
 * 修饰变体排在纯净系列之后：圆石 → 圆石楼梯 → 圆石台阶 → 圆石墙 → 苔石系列。
 * @param {string} id 物品 ID
 * @returns {boolean}
 */
export function hasModifier(id) {
  let h = modifierCache.get(id);
  if (h === undefined) {
    h = stripPrefixes(id) !== id;
    modifierCache.set(id, h);
  }
  return h;
}

// 后缀族（顺序即优先级，长的在前，避免 _concrete 抢先匹配 _concrete_powder）
const FAMILY_SUFFIX = [
  ["_concrete_powder", "concrete_powder"],
  ["_smithing_template", "smithing_templates"],
  ["_pottery_sherd", "pottery_sherds"],
  ["_music_disc", "music_discs"],
  ["_spawn_egg", "spawn_eggs"],
  ["_shulker_box", "shulker_boxes"],
  ["_pressure_plate", "fittings"],
  ["_fence_gate", "fittings"],
  ["_hanging_sign", "signs"],
  ["_glass_pane", "glass"],
  ["_terracotta", "terracotta"],
  ["_cobblestone", "stones"],
  ["_sandstone", "stones"],
  ["_stone_bricks", "stones"],
  ["_nether_bricks", "bricks"],
  ["_bricks", "bricks"],
  ["_brick", "bricks"],
  ["_trapdoor", "fittings"],
  ["_planks", "planks"],
  ["_log", "logs"],
  ["_wood", "logs"],
  ["_stem", "logs"],
  ["_hyphae", "logs"],
  ["_leaves", "leaves"],
  ["_sapling", "saplings"],
  ["_wool", "wool"],
  ["_carpet", "carpets"],
  ["_concrete", "concrete"],
  ["_glass", "glass"],
  ["_slab", "fittings"],
  ["_stairs", "fittings"],
  ["_wall", "fittings"],
  ["_fence", "fittings"],
  ["_door", "fittings"],
  ["_button", "fittings"],
  ["_rail", "rails"],
  ["_sign", "signs"],
  ["_banner", "banners"],
  ["_bed", "beds"],
  ["_boat", "boats"],
  ["_minecart", "minecarts"],
  ["_ingot", "ingots"],
  ["_nugget", "nuggets"],
  ["_ore", "ores"],
  ["_helmet", "armor"],
  ["_chestplate", "armor"],
  ["_leggings", "armor"],
  ["_boots", "armor"],
  ["_horse_armor", "armor"],
  ["_sword", "weapons"],
  ["_pickaxe", "tools"],
  ["_axe", "tools"],
  ["_shovel", "tools"],
  ["_hoe", "tools"],
  ["_arrow", "arrows"],
  ["_seeds", "seeds"],
  ["_dye", "dyes"],
  ["_head", "heads"],
  ["_skull", "heads"],
  ["_candle", "candles"],
  ["_torch", "torches"],
  ["_lantern", "lanterns"],
  ["_flower_pot", "flower_pots"],
  ["_chest", "chests"],
  ["_egg", "eggs"],
  ["_bucket", "buckets"],
  ["_campfire", "campfires"],
  ["_chain", "chains"],
  ["_anvil", "anvils"],
  ["_cauldron", "cauldrons"],
];

// 前缀族
const FAMILY_PREFIX = [
  ["minecraft:raw_", "raw_ores"],
];

// 精确匹配族（无规律后缀/前缀可用的）
const FAMILY_EXACT = {
  "minecraft:chest": "chests",
  "minecraft:stone": "stones",
  "minecraft:cobblestone": "stones",
  "minecraft:granite": "stones",
  "minecraft:diorite": "stones",
  "minecraft:andesite": "stones",
  "minecraft:tuff": "stones",
  "minecraft:deepslate": "stones",
  "minecraft:basalt": "stones",
  "minecraft:blackstone": "stones",
  "minecraft:calcite": "stones",
  "minecraft:obsidian": "stones",
  "minecraft:crying_obsidian": "stones",
  "minecraft:end_stone": "stones",
  "minecraft:netherrack": "stones",
  "minecraft:magma": "stones",
  "minecraft:soul_sand": "stones",
  "minecraft:soul_soil": "stones",
  "minecraft:dripstone_block": "stones",
  "minecraft:coal": "minerals",
  "minecraft:charcoal": "minerals",
  "minecraft:diamond": "minerals",
  "minecraft:emerald": "minerals",
  "minecraft:lapis_lazuli": "minerals",
  "minecraft:quartz": "minerals",
  "minecraft:netherite_scrap": "minerals",
  "minecraft:amethyst_shard": "minerals",
  "minecraft:prismarine_shard": "minerals",
  "minecraft:prismarine_crystals": "minerals",
  "minecraft:glowstone_dust": "minerals",
};

const familyCache = new Map();

/**
 * 计算物品族：把"同种东西的不同变体"归为一组，用于类别内相邻排序。
 * 石质材料（含墙/台阶/楼梯/砖等构件）统一归入 stones 族，
 * 非石质材料按 精确匹配 → 前缀 → 后缀 规则归族。
 * @param {string} id 物品 ID，如 minecraft:oak_log
 * @returns {string} 族名；无匹配时返回剥离修饰前缀后的 ID 本身
 */
export function familyOf(id) {
  let f = familyCache.get(id);
  if (f !== undefined) return f;
  const s = stripPrefixes(id);
  // 石质材料优先：圆石墙/石台阶/裂纹石砖等与圆石/石砖同族
  if (STONE_MATERIALS.has(materialOf(id))) {
    f = "stones";
  } else {
    f = FAMILY_EXACT[s];
    if (!f) {
      for (const [pre, fam] of FAMILY_PREFIX) {
        if (s.startsWith(pre)) { f = fam; break; }
      }
    }
    if (!f) {
      for (const [suf, fam] of FAMILY_SUFFIX) {
        if (s.endsWith(suf)) { f = fam; break; }
      }
    }
    if (!f) f = s; // 兜底：以剥离后的 ID 本身为族（同物品天然相邻）
  }
  familyCache.set(id, f);
  return f;
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
 * 按 类别 → 物品族 → 材料 → 形态档 → 修饰 → ID → data 排序（纯函数）。
 * 族让大类相邻（石料/原木/木板/矿石…）；材料让"同一种东西的变体"聚组
 * （cobblestone_stairs 与 cobblestone 同材料）；形态档让组内按
 * 基础块 → 楼梯 → 台阶 → 其他衍生 排列（圆石、圆石楼梯、圆石台阶、圆石墙）；
 * 修饰标记让纯净系列在前、裂纹/苔藓等变体在后。
 * @param {Array<{typeId:string,data?:number}>} items
 * @returns 排序后的新数组
 */
export function sortItems(items) {
  return [...items].sort((a, b) => {
    const ca = classify(a.typeId);
    const cb = classify(b.typeId);
    if (ca !== cb) return ca - cb;
    const fa = familyOf(a.typeId);
    const fb = familyOf(b.typeId);
    if (fa !== fb) return fa < fb ? -1 : 1;
    const ma = materialOf(a.typeId);
    const mb = materialOf(b.typeId);
    if (ma !== mb) return ma < mb ? -1 : 1;
    const sa = shapeOf(a.typeId);
    const sb = shapeOf(b.typeId);
    if (sa !== sb) return sa - sb;
    const ha = hasModifier(a.typeId);
    const hb = hasModifier(b.typeId);
    if (ha !== hb) return ha ? 1 : -1;
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
