/**
 * sort_logic.js — 物品栏排序纯逻辑模块
 *
 * 不依赖 @minecraft/server，可独立单元测试。
 * 输入输出均为“类 ItemStack”对象：{ typeId, data?, amount, maxAmount? }
 *
 * 排序顺序对齐 Java 版一键整理 mod Inventory Profiles Next 的默认规则：
 * 它的默认 profile 是 `@creative_menu_order`（创造模式物品栏顺序），也就是
 *
 *   建筑方块 → 染色方块 → 自然方块 → 功能方块 → 红石 → 工具与实用物品
 *   → 战斗用品 → 食物与饮品 → 原材料 → 刷怪蛋
 *
 * 每个大类内部再按「段落 → 材料（木种 / 颜色 / 石料）→ 形态 → 修饰 → ID」排列，
 * 让同一种材料的基础块、楼梯、台阶、墙……紧挨在一起，和创造模式物品栏一致。
 */

/**
 * @typedef {Object} SortableStack
 * @property {string} typeId
 * @property {number} [data]
 * @property {number} amount
 * @property {number} [maxAmount]
 */

// ---------- 大类（顺序即创造模式物品栏的分页顺序） ----------
export const CAT = {
  BUILDING: 0,    // 建筑方块
  COLORED: 1,     // 染色方块
  NATURAL: 2,     // 自然方块
  FUNCTIONAL: 3,  // 功能方块
  REDSTONE: 4,    // 红石
  TOOLS: 5,       // 工具与实用物品
  COMBAT: 6,      // 战斗用品
  FOOD: 7,        // 食物与饮品
  INGREDIENTS: 8, // 原材料
  SPAWN_EGGS: 9,  // 刷怪蛋
  MISC: 10,       // 其他（管理员方块等）
};

const CAT_NAMES = {
  [CAT.BUILDING]: "建筑方块",
  [CAT.COLORED]: "染色方块",
  [CAT.NATURAL]: "自然方块",
  [CAT.FUNCTIONAL]: "功能方块",
  [CAT.REDSTONE]: "红石",
  [CAT.TOOLS]: "工具与实用物品",
  [CAT.COMBAT]: "战斗用品",
  [CAT.FOOD]: "食物与饮品",
  [CAT.INGREDIENTS]: "原材料",
  [CAT.SPAWN_EGGS]: "刷怪蛋",
  [CAT.MISC]: "其他",
};

// ---------- 词表：顺序即创造模式物品栏里的先后 ----------

/** 木种顺序（原版注册顺序，白杨是 1.26 新增的基岩版木种） */
const WOOD_ORDER = [
  "oak", "spruce", "birch", "jungle", "acacia", "dark_oak", "mangrove",
  "cherry", "pale_oak", "poplar", "bamboo", "crimson", "warped",
];

/** 染料颜色顺序 */
const COLOR_ORDER = [
  "white", "orange", "magenta", "light_blue", "yellow", "lime", "pink",
  "gray", "light_gray", "cyan", "purple", "blue", "brown", "green", "red", "black",
];

/** 基岩版历史别名 */
const COLOR_ALIAS = { silver: "light_gray" };

/** 石料家族顺序：基础块排在各自变体前面 */
const STONE_BASE_ORDER = [
  "stone", "cobblestone", "granite", "diorite", "andesite",
  "deepslate", "tuff", "calcite", "dripstone", "blackstone", "basalt",
  "obsidian", "netherrack", "nether", "red_nether",
  "end_stone", "end", "purpur", "prismarine", "dark_prismarine",
  "sandstone", "red_sandstone", "quartz", "brick", "mud", "packed_mud",
  "resin", "cinnabar", "sulfur", "magma", "clay", "hardened_clay",
];

/** 石料形态后缀（先剥掉，再匹配家族；长的在前） */
const STONE_SHAPE_SUFFIX = [
  "_stairs", "_slab", "_wall", "_fence", "_pillar",
  "_bricks", "_brick", "_tiles", "_tile", "_block", "_grate", "_bars",
  "_chain", "_door", "_trapdoor", "_statue", "_spike",
];

/** 铜制建材允许的形态词 */
const COPPER_REST = new Set([
  "", "block", "stairs", "slab", "grate", "bars", "chain", "door",
  "trapdoor", "statue", "golem_statue", "bulb", "lantern", "torch", "chest",
]);

/** 矿物块顺序 */
const MINERAL_BLOCK_ORDER = [
  "coal_block", "iron_block", "raw_iron_block", "gold_block", "raw_gold_block",
  "raw_copper_block",
  "diamond_block", "emerald_block", "lapis_block", "netherite_block",
  "bone_block", "dried_kelp_block", "hay_block", "honey_block",
  "honeycomb_block", "slime", "resin_block", "nether_wart_block",
  "warped_wart_block", "sponge", "wet_sponge", "moss_block",
  "pale_moss_block", "sculk",
];

/** 工具材质等级 */
const TOOL_LEVEL = ["wooden", "stone", "copper", "iron", "golden", "diamond", "netherite"];
/** 护甲材质等级 */
const ARMOR_LEVEL = ["leather", "chainmail", "copper", "iron", "golden", "diamond", "netherite", "turtle"];
/** 远程/杂项武器的固定顺序 */
const RANGED_ORDER = ["bow", "crossbow", "arrow", "trident", "mace"];

/**
 * 段落内的固定顺序（大致等于创造模式物品栏的展示顺序）。
 * 查表时先剥掉修饰前缀，所以 exposed_lightning_rod 会落在 lightning_rod 旁边。
 */
const ITEM_ORDER = {
  build_light: [
    "torch", "soul_torch", "copper_torch",
    "lantern", "soul_lantern", "copper_lantern", "sea_lantern",
    "glowstone", "shroomlight", "ochre_froglight", "verdant_froglight",
    "pearlescent_froglight", "end_rod",
  ],
  build_misc: [
    "iron_bars", "iron_chain", "ladder", "scaffolding",
    "iron_door", "iron_trapdoor", "ice_crystal", "icicle",
    "creaking_heart", "dried_ghast", "reinforced_deepslate",
  ],
  nat_flower: [
    "dandelion", "poppy", "blue_orchid", "allium", "azure_bluet",
    "red_tulip", "orange_tulip", "white_tulip", "pink_tulip", "oxeye_daisy",
    "cornflower", "lily_of_the_valley", "wither_rose", "golden_dandelion",
    "closed_eyeblossom", "open_eyeblossom", "torchflower", "cactus_flower",
    "sunflower", "lilac", "rose_bush", "peony", "pitcher_plant",
    "wildflowers", "pink_petals",
  ],
  nat_plant: [
    "short_grass", "tall_grass", "fern", "large_fern", "deadbush", "bush",
    "firefly_bush", "short_dry_grass", "tall_dry_grass", "red_shrub",
    "cactus", "sugar_cane", "bamboo", "vine", "twisting_vines",
    "weeping_vines", "seagrass", "kelp", "waterlily", "big_dripleaf",
    "small_dripleaf_block", "spore_blossom", "azalea", "flowering_azalea",
    "hanging_roots", "roots", "mangrove_roots", "muddy_mangrove_roots",
    "nether_sprouts", "glow_lichen", "leaf_litter", "moss_carpet",
    "pale_moss_carpet", "pale_hanging_moss", "chorus_plant",
    "chorus_flower", "web",
  ],
  nat_dirt: [
    "grass_block", "grass_path", "dirt", "coarse_dirt", "dirt_with_roots",
    "podzol", "mycelium", "mud", "clay", "gravel", "sand", "red_sand",
    "suspicious_sand", "suspicious_gravel", "soul_sand", "soul_soil",
    "farmland", "pointed_dripstone", "dripstone_block", "turtle_egg",
    "sniffer_egg", "dragon_egg", "frog_spawn",
  ],
  nat_crop: [
    "wheat", "wheat_seeds", "beetroot_seeds", "melon_seeds",
    "pumpkin_seeds", "torchflower_seeds", "pitcher_pod", "nether_wart",
    "pumpkin", "carved_pumpkin", "lit_pumpkin", "melon_block",
  ],
  nat_ore: [
    "coal_ore", "deepslate_coal_ore", "copper_ore", "deepslate_copper_ore",
    "iron_ore", "deepslate_iron_ore", "gold_ore", "deepslate_gold_ore",
    "redstone_ore", "deepslate_redstone_ore", "lapis_ore",
    "deepslate_lapis_ore", "emerald_ore", "deepslate_emerald_ore",
    "diamond_ore", "deepslate_diamond_ore", "quartz_ore",
    "nether_gold_ore", "gilded_blackstone",
  ],
  nat_amethyst: [
    "amethyst_block", "budding_amethyst", "amethyst_cluster",
    "large_amethyst_bud", "medium_amethyst_bud", "small_amethyst_bud",
  ],
  nat_ice: ["snow", "snow_layer", "ice", "packed_ice", "blue_ice", "frosted_ice"],
  red_rail: ["rail", "golden_rail", "detector_rail", "activator_rail"],
  fun_station: [
    "crafting_table", "stonecutter_block", "cartography_table",
    "fletching_table", "smithing_table", "loom", "grindstone", "composter",
    "barrel", "furnace", "blast_furnace", "smoker", "brewing_stand",
    "cauldron", "enchanting_table", "anvil", "chipped_anvil", "damaged_anvil",
  ],
  fun_storage: ["chest", "trapped_chest", "ender_chest", "copper_chest", "undyed_shulker_box"],
  fun_use: [
    "beacon", "conduit", "respawn_anchor", "lodestone", "end_portal_frame",
    "jukebox", "campfire", "soul_campfire", "beehive", "bee_nest",
    "trial_spawner", "vault", "flower_pot", "decorated_pot", "armor_stand",
    "frame", "glow_frame", "painting", "banner", "creeper_head",
    "dragon_head", "piglin_head", "player_head", "skeleton_skull",
    "wither_skeleton_skull", "zombie_head", "mob_spawner", "heavy_core",
  ],
  red_component: [
    "redstone", "redstone_torch", "repeater", "comparator", "observer",
    "piston", "sticky_piston", "dispenser", "dropper", "hopper", "crafter",
    "lectern", "noteblock", "bell", "target", "daylight_detector",
    "sculk_sensor", "calibrated_sculk_sensor", "tripwire_hook", "lever",
    "redstone_lamp", "redstone_block", "tnt", "lightning_rod", "copper_bulb",
  ],
  red_power: [
    ...WOOD_ORDER.map((w) => w + "_button"),
    "stone_button", "blackstone_button", "wooden_button",
    ...WOOD_ORDER.map((w) => w + "_pressure_plate"),
    "stone_pressure_plate", "blackstone_pressure_plate",
    "wooden_pressure_plate", "light_weighted_pressure_plate",
    "heavy_weighted_pressure_plate",
  ],
  tool_bucket: [
    "bucket", "water_bucket", "lava_bucket", "milk_bucket",
    "powder_snow_bucket", "axolotl_bucket", "cod_bucket", "salmon_bucket",
    "pufferfish_bucket", "tropical_fish_bucket", "tadpole_bucket",
    "sulfur_cube_bucket",
  ],
  tool_transport: [
    "minecart", "chest_minecart", "hopper_minecart", "tnt_minecart",
    "command_block_minecart",
    ...WOOD_ORDER.map((w) => w + "_boat"),
    "bamboo_raft",
    ...WOOD_ORDER.map((w) => w + "_chest_boat"),
    "bamboo_chest_raft",
    "saddle", "carrot_on_a_stick", "warped_fungus_on_a_stick",
  ],
  tool_utility: [
    "compass", "recovery_compass", "lodestone_compass", "clock", "map",
    "empty_map", "filled_map", "spyglass", "lead", "name_tag", "goat_horn",
    "firework_rocket", "firework_star", "snowball", "ice_ball", "fire_charge",
  ],
  food_meat: [
    "beef", "cooked_beef", "porkchop", "cooked_porkchop", "mutton",
    "cooked_mutton", "chicken", "cooked_chicken", "rabbit", "cooked_rabbit",
    "rotten_flesh",
  ],
  food_fish: ["cod", "cooked_cod", "salmon", "cooked_salmon", "tropical_fish", "pufferfish"],
  food_veg: [
    "carrot", "golden_carrot", "potato", "baked_potato", "poisonous_potato",
    "beetroot", "melon_slice", "dried_kelp",
  ],
  food_fruit: [
    "apple", "golden_apple", "enchanted_golden_apple", "sweet_berries",
    "glow_berries", "chorus_fruit", "honey_bottle",
  ],
  food_staple: ["bread", "cookie", "cake", "pumpkin_pie"],
  food_stew: ["mushroom_stew", "beetroot_soup", "rabbit_stew", "suspicious_stew"],
  ing_metal: [
    "copper_ingot", "copper_nugget", "iron_ingot", "iron_nugget",
    "gold_ingot", "gold_nugget", "netherite_ingot",
  ],
  ing_gem: [
    "coal", "charcoal", "diamond", "emerald", "lapis_lazuli", "quartz",
    "amethyst_shard", "echo_shard", "glowstone_dust", "prismarine_shard",
    "prismarine_crystals", "nether_star",
  ],
  ing_potion: ["potion", "splash_potion", "lingering_potion", "glass_bottle", "ominous_bottle"],
};

/** 形态档位：基础块 → 楼梯 → 台阶 → 墙 → …… */
const SHAPE_SUFFIX = [
  ["_stained_glass_pane", 0], ["_concrete_powder", 0], ["_glazed_terracotta", 0],
  ["_stained_glass", 0], ["_concrete_stairs", 1], ["_concrete_slab", 2],
  ["_wool_stairs", 1], ["_wool_slab", 2], ["_mosaic_stairs", 1], ["_mosaic_slab", 2],
  ["_hanging_sign", 9], ["_fence_gate", 5], ["_trapdoor", 7],
  ["_stairs", 1], ["_slab", 2], ["_wall", 3], ["_fence", 4], ["_door", 6],
  ["_sign", 8], ["_shelf", 10], ["_bricks", 11], ["_brick", 11],
  ["_tiles", 12], ["_tile", 12], ["_pillar", 13], ["_grate", 14],
  ["_bars", 15], ["_chain", 16], ["_golem_statue", 17], ["_statue", 17],
  ["_spike", 18], ["_mosaic", 19], ["_planks", 0], ["_wool", 0], ["_carpet", 0],
  ["_concrete", 0], ["_terracotta", 0], ["_candle", 0], ["_cushion", 0],
  ["_harness", 0], ["_bundle", 0], ["_bed", 0], ["_shulker_box", 0],
  // 战斗装备：头盔 → 胸甲 → 护腿 → 靴子
  ["_helmet", 0], ["_chestplate", 1], ["_leggings", 2], ["_boots", 3],
  ["_horse_armor", 0], ["_nautilus_armor", 0],
  ["_sword", 0], ["_spear", 1],
];

/** 修饰前缀 → 档位（同材料内：纯净 → 变体） */
const MODIFIER_ORDER = [
  ["smooth_", 1], ["polished_", 2], ["cobbled_", 2], ["crying_", 2],
  ["cut_", 3], ["chiseled_", 4], ["cracked_", 5], ["potent_", 5],
  ["mossy_", 6], ["infested_", 7], ["dead_", 8], ["stripped_", 9],
  ["flowered_", 10],
];

const OXIDATION = ["exposed", "weathered", "oxidized"];

/** 基岩版遗留的无木种 ID → 视作橡木 */
const LEGACY_WOOD = {
  fence_gate: "oak_fence_gate",
  trapdoor: "oak_trapdoor",
  wooden_door: "oak_door",
  petrified_oak_slab: "oak_slab",
};

// ---------- 段落（section）：数组下标即排序名次 ----------
const SECTIONS = [
  // 建筑方块
  "build_wood", "build_stone", "build_copper", "build_glass", "build_light", "build_block", "build_misc",
  // 染色方块
  "clr_wool", "clr_carpet", "clr_concrete", "clr_concrete_powder", "clr_terracotta",
  "clr_glazed", "clr_stained_glass", "clr_stained_pane", "clr_candle", "clr_cushion", "clr_harness",
  // 自然方块
  "nat_log", "nat_leaves", "nat_sapling", "nat_flower", "nat_plant", "nat_mushroom",
  "nat_fungus", "nat_crop", "nat_dirt", "nat_ore", "nat_ice", "nat_coral", "nat_amethyst",
  // 功能方块
  "fun_station", "fun_storage", "fun_bed", "fun_shelf", "fun_use",
  // 红石
  "red_component", "red_power", "red_rail",
  // 工具与实用物品
  "tool_kit", "tool_bucket", "tool_transport", "tool_utility", "tool_bundle",
  // 战斗用品
  "cbt_weapon", "cbt_ranged", "cbt_armor", "cbt_mount", "cbt_shield",
  // 食物与饮品
  "food_meat", "food_fish", "food_veg", "food_fruit", "food_staple", "food_stew", "food_snack",
  // 原材料
  "ing_metal", "ing_raw", "ing_gem", "ing_craft", "ing_dye", "ing_potion",
  "ing_disc", "ing_sherd", "ing_pattern", "ing_template", "ing_key",
  // 刷怪蛋 / 其他
  "egg_spawn", "misc_other",
];

const SECTION_INDEX = new Map(SECTIONS.map((name, index) => [name, index]));

/** 段落的中文名（用于文档与调试输出） */
export const SECTION_TITLES = {
  build_wood: "木材建筑件", build_stone: "石料与砖", build_copper: "铜制建材",
  build_glass: "玻璃", build_light: "光源", build_block: "矿物与资源块",
  build_misc: "其他建筑方块",
  clr_wool: "羊毛", clr_carpet: "地毯", clr_concrete: "混凝土",
  clr_concrete_powder: "混凝土粉末", clr_terracotta: "陶瓦", clr_glazed: "带釉陶瓦",
  clr_stained_glass: "染色玻璃", clr_stained_pane: "染色玻璃板", clr_candle: "蜡烛",
  clr_cushion: "坐垫", clr_harness: "挽具",
  nat_log: "原木与菌柄", nat_leaves: "树叶", nat_sapling: "树苗",
  nat_flower: "花", nat_plant: "植物", nat_mushroom: "蘑菇",
  nat_fungus: "菌类", nat_crop: "作物与种子", nat_dirt: "泥土与沙石",
  nat_ore: "矿石", nat_ice: "冰雪", nat_coral: "珊瑚", nat_amethyst: "紫水晶",
  fun_station: "工作站", fun_storage: "容器", fun_bed: "床",
  fun_shelf: "书架", fun_use: "功能与装饰",
  red_component: "红石元件", red_power: "开关与踏板", red_rail: "铁轨",
  tool_kit: "工具", tool_bucket: "桶", tool_transport: "交通工具",
  tool_utility: "实用物品", tool_bundle: "收纳袋",
  cbt_weapon: "武器", cbt_ranged: "远程武器", cbt_armor: "护甲",
  cbt_mount: "坐骑护甲", cbt_shield: "盾牌与图腾",
  food_meat: "肉类", food_fish: "鱼类", food_veg: "蔬菜", food_fruit: "水果",
  food_staple: "主食与甜点", food_stew: "汤羹", food_snack: "杂项食物",
  ing_metal: "金属锭与粒", ing_raw: "原矿", ing_gem: "宝石与矿物",
  ing_craft: "合成材料", ing_dye: "染料", ing_potion: "药水",
  ing_disc: "唱片", ing_sherd: "陶片", ing_pattern: "旗帜图案",
  ing_template: "锻造模板", ing_key: "试炼钥匙",
  egg_spawn: "刷怪蛋", misc_other: "其他（管理员方块）",
};

const SECTION_CAT = {
  build_wood: CAT.BUILDING, build_stone: CAT.BUILDING, build_copper: CAT.BUILDING,
  build_glass: CAT.BUILDING, build_light: CAT.BUILDING, build_block: CAT.BUILDING,
  build_misc: CAT.BUILDING,
  clr_wool: CAT.COLORED, clr_carpet: CAT.COLORED, clr_concrete: CAT.COLORED,
  clr_concrete_powder: CAT.COLORED, clr_terracotta: CAT.COLORED, clr_glazed: CAT.COLORED,
  clr_stained_glass: CAT.COLORED, clr_stained_pane: CAT.COLORED, clr_candle: CAT.COLORED,
  clr_cushion: CAT.COLORED, clr_harness: CAT.COLORED,
  nat_log: CAT.NATURAL, nat_leaves: CAT.NATURAL, nat_sapling: CAT.NATURAL,
  nat_flower: CAT.NATURAL, nat_plant: CAT.NATURAL, nat_mushroom: CAT.NATURAL,
  nat_fungus: CAT.NATURAL, nat_crop: CAT.NATURAL, nat_dirt: CAT.NATURAL,
  nat_ore: CAT.NATURAL, nat_ice: CAT.NATURAL, nat_coral: CAT.NATURAL,
  nat_amethyst: CAT.NATURAL,
  fun_station: CAT.FUNCTIONAL, fun_storage: CAT.FUNCTIONAL, fun_bed: CAT.FUNCTIONAL,
  fun_shelf: CAT.FUNCTIONAL, fun_use: CAT.FUNCTIONAL,
  red_component: CAT.REDSTONE, red_power: CAT.REDSTONE, red_rail: CAT.REDSTONE,
  tool_kit: CAT.TOOLS, tool_bucket: CAT.TOOLS, tool_transport: CAT.TOOLS,
  tool_utility: CAT.TOOLS, tool_bundle: CAT.TOOLS,
  cbt_weapon: CAT.COMBAT, cbt_ranged: CAT.COMBAT, cbt_armor: CAT.COMBAT,
  cbt_mount: CAT.COMBAT, cbt_shield: CAT.COMBAT,
  food_meat: CAT.FOOD, food_fish: CAT.FOOD, food_veg: CAT.FOOD, food_fruit: CAT.FOOD,
  food_staple: CAT.FOOD, food_stew: CAT.FOOD, food_snack: CAT.FOOD,
  ing_metal: CAT.INGREDIENTS, ing_raw: CAT.INGREDIENTS, ing_gem: CAT.INGREDIENTS,
  ing_craft: CAT.INGREDIENTS, ing_dye: CAT.INGREDIENTS, ing_potion: CAT.INGREDIENTS,
  ing_disc: CAT.INGREDIENTS, ing_sherd: CAT.INGREDIENTS, ing_pattern: CAT.INGREDIENTS,
  ing_template: CAT.INGREDIENTS, ing_key: CAT.INGREDIENTS,
  egg_spawn: CAT.SPAWN_EGGS, misc_other: CAT.MISC,
};

// ---------- 物品 ID 集合 ----------
const set = (...ids) => new Set(ids.map((id) => "minecraft:" + id));

/** 显式指定段落的零散物品（无法用规律匹配的） */
const EXACT_SECTION = new Map();

function put(section, ...ids) {
  for (const id of ids) EXACT_SECTION.set(id, section);
}

put("build_wood", "wooden_door", "trapdoor", "fence_gate", "petrified_oak_slab",
  "bamboo_mosaic", "bamboo_mosaic_stairs", "bamboo_mosaic_slab");
put("build_stone", "normal_stone_stairs", "normal_stone_slab", "end_bricks", "hardened_clay", "packed_mud");
put("build_copper", "copper_golem_statue");
put("build_glass", "glass", "glass_pane", "tinted_glass");
put("build_light", "end_rod", "torch", "soul_torch", "copper_torch", "lantern",
  "soul_lantern", "glowstone", "sea_lantern", "shroomlight", "ochre_froglight",
  "verdant_froglight", "pearlescent_froglight");
put("build_block", "sponge", "wet_sponge", "slime", "honeycomb_block", "moss_block",
  "pale_moss_block", "sculk", "sculk_catalyst", "sculk_vein", "sculk_shrieker",
  "resin_block", "bone_block", "dried_kelp_block", "hay_block", "honey_block",
  "coal_block", "iron_block", "raw_iron_block", "gold_block", "raw_gold_block",
  "raw_copper_block",
  "diamond_block", "emerald_block", "lapis_block", "netherite_block",
  "nether_wart_block", "warped_wart_block");
put("build_misc", "ladder", "scaffolding", "iron_bars", "iron_chain", "ice_crystal",
  "icicle", "reinforced_deepslate", "dried_ghast", "creaking_heart",
  "iron_door", "iron_trapdoor");
put("clr_cushion", "cushion");
put("clr_harness", "harness");
put("clr_candle", "candle");
put("clr_terracotta", "hardened_terracotta");
put("nat_log", "bamboo_block", "stripped_bamboo_block");
put("nat_leaves", "azalea_leaves", "azalea_leaves_flowered");
put("nat_sapling", "mangrove_propagule");
put("nat_flower", "dandelion", "poppy", "blue_orchid", "allium", "azure_bluet",
  "red_tulip", "orange_tulip", "white_tulip", "pink_tulip", "oxeye_daisy",
  "cornflower", "lily_of_the_valley", "wither_rose", "golden_dandelion",
  "torchflower", "closed_eyeblossom", "open_eyeblossom", "sunflower", "lilac",
  "rose_bush", "peony", "cactus_flower", "pitcher_plant", "wildflowers",
  "pink_petals");
put("nat_plant", "short_grass", "tall_grass", "fern", "large_fern", "deadbush",
  "cactus", "sugar_cane", "bamboo", "vine", "twisting_vines", "weeping_vines",
  "seagrass", "kelp", "waterlily", "big_dripleaf", "small_dripleaf_block",
  "spore_blossom", "hanging_roots", "roots", "mangrove_roots",
  "muddy_mangrove_roots", "nether_sprouts", "glow_lichen", "leaf_litter",
  "firefly_bush", "bush", "short_dry_grass", "tall_dry_grass", "azalea",
  "flowering_azalea", "chorus_plant", "chorus_flower", "moss_carpet",
  "pale_moss_carpet", "pale_hanging_moss", "web", "red_shrub");
put("nat_mushroom", "brown_mushroom", "red_mushroom", "shelf_mushroom",
  "brown_mushroom_block", "red_mushroom_block", "mushroom_stem");
put("nat_fungus", "crimson_fungus", "warped_fungus", "crimson_roots",
  "warped_roots", "crimson_nylium", "warped_nylium");
put("nat_crop", "wheat", "wheat_seeds", "beetroot_seeds", "melon_seeds",
  "pumpkin_seeds", "torchflower_seeds", "pitcher_pod", "nether_wart",
  "pumpkin", "carved_pumpkin", "lit_pumpkin", "melon_block");
put("nat_dirt", "dirt", "coarse_dirt", "dirt_with_roots", "grass_block",
  "grass_path", "podzol", "mycelium", "mud", "clay", "sand", "red_sand",
  "gravel", "suspicious_sand", "suspicious_gravel", "farmland", "soul_sand",
  "soul_soil", "pointed_dripstone", "turtle_egg", "dragon_egg", "sniffer_egg",
  "frog_spawn", "dripstone_block");
put("nat_ice", "ice", "packed_ice", "blue_ice", "frosted_ice", "snow", "snow_layer");
put("nat_coral", "sea_pickle", "tube_coral", "brain_coral", "bubble_coral",
  "fire_coral", "horn_coral", "dead_tube_coral", "dead_brain_coral",
  "dead_bubble_coral", "dead_fire_coral", "dead_horn_coral",
  "tube_coral_fan", "brain_coral_fan", "bubble_coral_fan", "fire_coral_fan",
  "horn_coral_fan", "dead_tube_coral_fan", "dead_brain_coral_fan",
  "dead_bubble_coral_fan", "dead_fire_coral_fan", "dead_horn_coral_fan",
  "tube_coral_block", "brain_coral_block", "bubble_coral_block",
  "fire_coral_block", "horn_coral_block", "dead_tube_coral_block",
  "dead_brain_coral_block", "dead_bubble_coral_block", "dead_fire_coral_block",
  "dead_horn_coral_block");
put("nat_amethyst", "amethyst_block", "budding_amethyst", "amethyst_cluster",
  "small_amethyst_bud", "medium_amethyst_bud", "large_amethyst_bud");

put("fun_station", "crafting_table", "stonecutter", "stonecutter_block",
  "cartography_table", "fletching_table", "smithing_table", "loom", "grindstone",
  "composter", "barrel", "furnace", "blast_furnace", "smoker", "brewing_stand",
  "cauldron", "enchanting_table", "anvil", "chipped_anvil", "damaged_anvil");
put("fun_storage", "chest", "trapped_chest", "ender_chest", "undyed_shulker_box");
put("fun_bed", "bed", "straw_bed");
put("fun_shelf", "bookshelf", "chiseled_bookshelf");
put("fun_use", "beacon", "conduit", "lodestone", "respawn_anchor", "jukebox",
  "campfire", "soul_campfire", "beehive", "bee_nest", "end_portal_frame",
  "trial_spawner", "vault", "decorated_pot", "flower_pot", "armor_stand",
  "frame", "glow_frame", "painting", "banner", "mob_spawner", "heavy_core",
  "creeper_head", "dragon_head", "piglin_head", "player_head",
  "skeleton_skull", "wither_skeleton_skull", "zombie_head");

put("red_component", "redstone", "redstone_torch", "repeater", "comparator",
  "observer", "piston", "sticky_piston", "dispenser", "dropper", "hopper",
  "crafter", "target", "daylight_detector", "sculk_sensor",
  "calibrated_sculk_sensor", "tripwire_hook", "lever", "noteblock", "bell",
  "lectern", "redstone_lamp", "redstone_block", "tnt");
put("red_power", "wooden_button", "wooden_pressure_plate", "stone_button",
  "stone_pressure_plate", "polished_blackstone_button",
  "polished_blackstone_pressure_plate", "heavy_weighted_pressure_plate",
  "light_weighted_pressure_plate");
put("red_rail", "rail", "golden_rail", "detector_rail", "activator_rail");

put("tool_kit", "shears", "flint_and_steel", "fishing_rod", "brush");
put("tool_bucket", "bucket", "water_bucket", "lava_bucket", "milk_bucket",
  "powder_snow_bucket", "axolotl_bucket", "cod_bucket", "pufferfish_bucket",
  "salmon_bucket", "tadpole_bucket", "tropical_fish_bucket", "sulfur_cube_bucket");
put("tool_transport", "minecart", "chest_minecart", "hopper_minecart",
  "tnt_minecart", "command_block_minecart", "saddle", "carrot_on_a_stick",
  "warped_fungus_on_a_stick");
put("tool_utility", "compass", "recovery_compass", "clock", "map", "empty_map",
  "filled_map", "lodestone_compass", "spyglass", "lead", "name_tag",
  "goat_horn", "firework_rocket", "firework_star", "ice_ball", "snowball",
  "fire_charge");
put("tool_bundle", "bundle");

put("cbt_ranged", "bow", "crossbow", "trident", "mace", "arrow");
put("cbt_shield", "shield", "totem_of_undying");

put("ing_metal", "copper_ingot", "iron_ingot", "gold_ingot", "netherite_ingot",
  "copper_nugget", "iron_nugget", "gold_nugget");
put("ing_raw", "raw_iron", "raw_gold", "raw_copper", "ancient_debris",
  "netherite_scrap");
put("ing_gem", "coal", "charcoal", "diamond", "emerald", "lapis_lazuli",
  "quartz", "amethyst_shard", "glowstone_dust", "prismarine_shard",
  "prismarine_crystals", "echo_shard", "nether_star");
put("ing_craft", "stick", "string", "feather", "leather", "paper", "book",
  "writable_book", "enchanted_book", "clay_ball", "brick", "netherbrick",
  "flint", "bone", "bone_meal", "gunpowder", "slime_ball", "blaze_rod",
  "blaze_powder", "breeze_rod", "wind_charge", "ender_pearl", "ender_eye",
  "ghast_tear", "magma_cream", "nautilus_shell", "heart_of_the_sea",
  "phantom_membrane", "shulker_shell", "popped_chorus_fruit", "dragon_breath",
  "experience_bottle", "sugar", "glistering_melon_slice", "ink_sac",
  "glow_ink_sac", "honeycomb", "resin_clump", "rabbit_hide", "rabbit_foot",
  "armadillo_scute", "turtle_scute", "fermented_spider_eye", "end_crystal",
  "egg", "bowl", "disc_fragment_5", "cocoa_beans", "blue_egg", "brown_egg");
put("ing_potion", "potion", "splash_potion", "lingering_potion", "glass_bottle",
  "ominous_bottle");
put("ing_key", "trial_key", "ominous_trial_key");

/** 食物 */
const FOOD_MEAT = set("beef", "cooked_beef", "porkchop", "cooked_porkchop",
  "chicken", "cooked_chicken", "mutton", "cooked_mutton", "rabbit",
  "cooked_rabbit", "rotten_flesh");
const FOOD_FISH = set("cod", "cooked_cod", "salmon", "cooked_salmon",
  "tropical_fish", "pufferfish");
const FOOD_VEG = set("carrot", "golden_carrot", "potato", "baked_potato",
  "poisonous_potato", "beetroot", "melon_slice", "dried_kelp");
const FOOD_FRUIT = set("apple", "golden_apple", "enchanted_golden_apple",
  "sweet_berries", "glow_berries", "chorus_fruit", "honey_bottle");
const FOOD_STAPLE = set("bread", "cookie", "cake", "pumpkin_pie");
const FOOD_STEW = set("mushroom_stew", "beetroot_soup", "rabbit_stew",
  "suspicious_stew");
const FOOD_SNACK = set("spider_eye");

/** 快捷后缀集合 */
const TOOL_KIT_SUFFIX = ["_pickaxe", "_shovel", "_axe", "_hoe"];
const COMBAT_ARMOR_SUFFIX = ["_helmet", "_chestplate", "_leggings", "_boots"];
const COMBAT_WEAPON_SUFFIX = ["_sword", "_spear"];
const MOUNT_ARMOR_SUFFIX = ["_horse_armor", "_nautilus_armor"];
const WOOD_BUILD_SUFFIX = new Set([
  "planks", "stairs", "slab", "fence", "fence_gate", "door", "trapdoor",
  "sign", "hanging_sign", "mosaic",
]);
const WOOD_LOG_SUFFIX = new Set(["log", "wood", "stem", "hyphae", "block"]);

// ---------- 解析函数 ----------
const WOOD_SORTED = [...WOOD_ORDER].sort((a, b) => b.length - a.length);
const COLOR_SORTED = [...COLOR_ORDER].sort((a, b) => b.length - a.length);
const STONE_SORTED = [...STONE_BASE_ORDER].sort((a, b) => b.length - a.length);

const sectionCache = new Map();
const materialCache = new Map();
const shapeCache = new Map();
const modifierCache = new Map();

function bareId(id) {
  return id.startsWith("minecraft:") ? id.slice("minecraft:".length) : id;
}

/** 拆出木种与剩余形态词，例如 stripped_oak_log → { wood: "oak", rest: "log" } */
function woodParts(s) {
  let t = s;
  if (t.startsWith("stripped_")) t = t.slice("stripped_".length);
  for (const wood of WOOD_SORTED) {
    if (t === wood) return { wood, rest: "" };
    if (t.startsWith(wood + "_")) return { wood, rest: t.slice(wood.length + 1) };
  }
  return null;
}

/** 拆出颜色与剩余形态词，例如 light_blue_wool → { color: "light_blue", rest: "wool" } */
function colorParts(s) {
  for (const color of COLOR_SORTED) {
    if (s.startsWith(color + "_")) return { color, rest: s.slice(color.length + 1) };
  }
  for (const [alias, target] of Object.entries(COLOR_ALIAS)) {
    if (s.startsWith(alias + "_")) return { color: target, rest: s.slice(alias.length + 1) };
  }
  return null;
}

/** 剥掉修饰前缀（smooth_/polished_/mossy_/waxed_/exposed_ …） */
function stripModifiers(s) {
  let t = s;
  for (;;) {
    let changed = false;
    for (const [prefix] of MODIFIER_ORDER) {
      if (t.startsWith(prefix)) { t = t.slice(prefix.length); changed = true; }
    }
    for (const ox of OXIDATION) {
      if (t.startsWith(ox + "_")) { t = t.slice(ox.length + 1); changed = true; }
    }
    if (t.startsWith("waxed_")) { t = t.slice("waxed_".length); changed = true; }
    if (!changed) return t;
  }
}

/** 拆出石料家族与形态词，例如 mossy_cobblestone_wall → { base: "cobblestone", rest: "wall" } */
function stoneParts(s) {
  let t = stripModifiers(s);
  let rest = "";
  for (const suffix of STONE_SHAPE_SUFFIX) {
    if (t.endsWith(suffix)) {
      t = t.slice(0, t.length - suffix.length);
      rest = suffix.slice(1);
      break;
    }
  }
  // stone_bricks / deepslate_tile 这类「砖/瓦」词也要剥掉才算得到家族名
  for (;;) {
    const word = ["bricks", "brick", "tiles", "tile"]
      .find((w) => t !== w && t.endsWith("_" + w));
    if (!word) break;
    t = t.slice(0, t.length - word.length - 1);
  }
  for (const base of STONE_SORTED) {
    if (t === base) return { base, rest };
  }
  return null;
}

/** 铜制建材：copper / exposed_copper / waxed_weathered_cut_copper … */
function copperParts(s) {
  const t = stripModifiers(s);
  if (t === "copper") return { rest: "" };
  if (!t.startsWith("copper_")) return null;
  const rest = t.slice("copper_".length);
  return COPPER_REST.has(rest) ? { rest } : null;
}

/** 段落判定 */
function resolveSection(id) {
  const s = bareId(id);

  if (s.endsWith("_spawn_egg")) return "egg_spawn";

  const exact = EXACT_SECTION.get(s);
  if (exact) return exact;

  // ---- 染色方块 ----
  const cp = colorParts(s);
  if (cp) {
    switch (cp.rest) {
      case "wool": case "wool_stairs": case "wool_slab": return "clr_wool";
      case "carpet": return "clr_carpet";
      case "concrete": case "concrete_stairs": case "concrete_slab": return "clr_concrete";
      case "concrete_powder": return "clr_concrete_powder";
      case "terracotta": return "clr_terracotta";
      case "glazed_terracotta": return "clr_glazed";
      case "stained_glass": return "clr_stained_glass";
      case "stained_glass_pane": return "clr_stained_pane";
      case "candle": return "clr_candle";
      case "cushion": return "clr_cushion";
      case "harness": return "clr_harness";
      case "bundle": return "tool_bundle";
      case "shulker_box": return "fun_storage";
      case "bed": return "fun_bed";
      case "dye": return "ing_dye";
      case "poplar_leaves": return "nat_leaves";
      case "sand": return "nat_dirt";
      default: break;
    }
  }

  // ---- 木种相关 ----
  const wp = woodParts(s);
  if (wp) {
    const rest = wp.rest;
    if (WOOD_BUILD_SUFFIX.has(rest)) return "build_wood";
    if (WOOD_LOG_SUFFIX.has(rest)) return "nat_log";
    if (rest === "leaves") return "nat_leaves";
    if (rest === "sapling" || rest === "propagule") return "nat_sapling";
    if (rest === "shelf") return "fun_shelf";
    if (rest === "button" || rest === "pressure_plate") return "red_power";
    if (rest === "boat" || rest === "chest_boat" || rest === "raft" || rest === "chest_raft") return "tool_transport";
    if (rest === "roots") return "nat_plant";
  }

  // ---- 矿石 ----
  if (s.endsWith("_ore") || s === "gilded_blackstone") return "nat_ore";

  // ---- 红石 ----
  if (s.endsWith("_button") || s.endsWith("_pressure_plate")) return "red_power";
  if (s.endsWith("_rail")) return "red_rail";
  if (s.endsWith("_bulb")) return "red_component";
  if (s.endsWith("lightning_rod")) return "red_component";

  // ---- 工具 / 战斗 ----
  if (TOOL_KIT_SUFFIX.some((suffix) => s.endsWith(suffix))) return "tool_kit";
  if (s.endsWith("_bucket")) return "tool_bucket";
  if (s.endsWith("_bundle")) return "tool_bundle";
  if (MOUNT_ARMOR_SUFFIX.some((suffix) => s.endsWith(suffix))) return "cbt_mount";
  if (COMBAT_ARMOR_SUFFIX.some((suffix) => s.endsWith(suffix))) return "cbt_armor";
  if (COMBAT_WEAPON_SUFFIX.some((suffix) => s.endsWith(suffix))) return "cbt_weapon";
  if (s === "turtle_helmet" || s === "elytra" || s === "wolf_armor") return "cbt_armor";

  // ---- 食物 ----
  const full = "minecraft:" + s;
  if (FOOD_MEAT.has(full)) return "food_meat";
  if (FOOD_FISH.has(full)) return "food_fish";
  if (FOOD_VEG.has(full)) return "food_veg";
  if (FOOD_FRUIT.has(full)) return "food_fruit";
  if (FOOD_STAPLE.has(full)) return "food_staple";
  if (FOOD_STEW.has(full)) return "food_stew";
  if (FOOD_SNACK.has(full)) return "food_snack";

  // ---- 原材料后缀 ----
  if (s.endsWith("_dye")) return "ing_dye";
  if (s.endsWith("_ingot") || s.endsWith("_nugget")) return "ing_metal";
  if (s.startsWith("raw_") && !s.endsWith("_block")) return "ing_raw";
  if (s.startsWith("music_disc_")) return "ing_disc";
  if (s.endsWith("_pottery_sherd")) return "ing_sherd";
  if (s.endsWith("_banner_pattern")) return "ing_pattern";
  if (s.endsWith("_smithing_template")) return "ing_template";

  // ---- 铜制建材 ----
  const copper = copperParts(s);
  if (copper) {
    if (copper.rest === "bulb") return "red_component";
    if (copper.rest === "lantern" || copper.rest === "torch") return "build_light";
    if (copper.rest === "chest") return "fun_storage";
    return "build_copper";
  }

  // ---- 矿物块 / 石料 ----
  if (MINERAL_BLOCK_ORDER.includes(stripModifiers(s))) return "build_block";
  if (stoneParts(s)) return "build_stone";

  // ---- 发光方块 / 玻璃 ----
  if (s.endsWith("_lantern") || s.endsWith("_torch")) return "build_light";
  if (s.endsWith("_froglight")) return "build_light";
  if (s.endsWith("_glass_pane") || s.endsWith("_glass")) return "build_glass";

  return "misc_other";
}

/** 物品所属大类 */
export function classify(id) {
  return SECTION_CAT[sectionOf(id)] ?? CAT.MISC;
}

export function categoryName(id) {
  return CAT_NAMES[classify(id)];
}

/** 物品所属段落（排序用，也方便测试） */
export function sectionOf(id) {
  let section = sectionCache.get(id);
  if (section === undefined) {
    section = resolveSection(id);
    sectionCache.set(id, section);
  }
  return section;
}

/** 段落名次 */
export function sectionRank(id) {
  return SECTION_INDEX.get(sectionOf(id)) ?? SECTION_INDEX.get("misc_other");
}

/** 材料名次：木种 / 颜色 / 石料家族 / 矿物块 在词表中的位置 */
export function materialRank(id) {
  let rank = materialCache.get(id);
  if (rank !== undefined) return rank;
  const s = bareId(id);
  const section = sectionOf(id);

  const order = ITEM_ORDER[section];
  const listed = order ? order.indexOf(stripModifiers(s)) : -1;

  if (listed >= 0) {
    rank = listed;
  } else if (section === "fun_storage" && s.endsWith("_shulker_box")) {
    const cp = colorParts(s);
    rank = 100 + (cp ? COLOR_ORDER.indexOf(cp.color) : 0);
  } else if (section.startsWith("clr_") || section === "tool_bundle") {
    const cp = colorParts(s);
    rank = cp ? COLOR_ORDER.indexOf(cp.color) : 0;
  } else if (section === "build_wood" || section === "nat_log" || section === "nat_leaves" ||
      section === "nat_sapling" || section === "fun_shelf") {
    const canonical = LEGACY_WOOD[s] ?? s;
    const colorStripped = colorParts(canonical);
    const wp = woodParts(colorStripped ? colorStripped.rest : canonical);
    rank = wp ? WOOD_ORDER.indexOf(wp.wood) : 0;
  } else if (section === "build_stone") {
    const sp = stoneParts(s);
    rank = sp ? STONE_BASE_ORDER.indexOf(sp.base) : 0;
  } else if (section === "build_block") {
    const index = MINERAL_BLOCK_ORDER.indexOf(stripModifiers(s));
    rank = index >= 0 ? index : MINERAL_BLOCK_ORDER.length;
  } else if (section === "tool_kit") {
    const kind = TOOL_KIT_SUFFIX.findIndex((suffix) => s.endsWith(suffix));
    const level = TOOL_LEVEL.indexOf(toolLevelOf(s));
    rank = (kind >= 0 ? kind : 9) * 10 + (level >= 0 ? level : 9);
  } else if (section === "cbt_weapon") {
    const kind = COMBAT_WEAPON_SUFFIX.findIndex((suffix) => s.endsWith(suffix));
    const level = TOOL_LEVEL.indexOf(toolLevelOf(s));
    rank = (kind >= 0 ? kind : 9) * 10 + (level >= 0 ? level : 9);
  } else if (section === "cbt_ranged") {
    const index = RANGED_ORDER.indexOf(s);
    rank = index >= 0 ? index : RANGED_ORDER.length;
  } else if (section === "cbt_armor") {
    if (s === "elytra") rank = 90;
    else if (s === "wolf_armor") rank = 91;
    else rank = ARMOR_LEVEL.indexOf(toolLevelOf(s));
  } else if (section === "cbt_mount") {
    const kind = s.endsWith("_nautilus_armor") ? 1 : 0;
    const level = ARMOR_LEVEL.indexOf(toolLevelOf(s));
    rank = kind * 10 + (level >= 0 ? level : 0);
  } else if (section === "ing_dye") {
    const color = s.slice(0, s.length - "_dye".length);
    rank = COLOR_ORDER.indexOf(color);
  } else {
    rank = 0;
  }
  materialCache.set(id, rank);
  return rank;
}

function toolLevelOf(s) {
  for (const level of TOOL_LEVEL) {
    if (s.startsWith(level + "_")) return level;
  }
  for (const level of ARMOR_LEVEL) {
    if (s.startsWith(level + "_")) return level;
  }
  return "";
}

/** 形态名次（基础块 0 → 楼梯 1 → 台阶 2 → ……） */
export function shapeOf(id) {
  let shape = shapeCache.get(id);
  if (shape !== undefined) return shape;
  const s = bareId(id);
  const canonical = LEGACY_WOOD[s] ?? s;
  shape = 0;
  for (const [suffix, rank] of SHAPE_SUFFIX) {
    if (canonical.endsWith(suffix)) { shape = rank; break; }
  }
  shapeCache.set(id, shape);
  return shape;
}

/** 修饰名次（纯净 0 → 变体 → 氧化/打蜡的铜排在最后） */
export function modifierRank(id) {
  let rank = modifierCache.get(id);
  if (rank !== undefined) return rank;
  const s = bareId(id);

  if (s.includes("copper")) {
    // 铜：同一氧化阶段内 普通 → 切制 → 雕纹，打蜡系列整体靠后
    const waxed = s.startsWith("waxed_");
    let t = waxed ? s.slice("waxed_".length) : s;
    let oxidation = 0;
    for (let i = 0; i < OXIDATION.length; i++) {
      if (t.startsWith(OXIDATION[i] + "_")) {
        oxidation = i + 1;
        t = t.slice(OXIDATION[i].length + 1);
        break;
      }
    }
    let variant = 0;
    if (t.startsWith("cut_")) variant = 1;
    else if (t.startsWith("chiseled_")) variant = 2;
    rank = (waxed ? 100 : 0) + oxidation * 10 + variant;
    modifierCache.set(id, rank);
    return rank;
  }

  rank = 0;
  for (const [prefix, value] of MODIFIER_ORDER) {
    if (s.startsWith(prefix) || s.includes("_" + prefix)) rank = Math.max(rank, value);
  }
  // 非铜材料也可能有氧化/打蜡变体（避雷针等），统一排在纯净版本之后
  let oxidation = -1;
  for (let i = 0; i < OXIDATION.length; i++) {
    if (s.startsWith(OXIDATION[i] + "_") || s.includes("_" + OXIDATION[i] + "_")) oxidation = i;
  }
  if (oxidation >= 0) rank = Math.max(rank, 20 + oxidation);
  if (s.startsWith("waxed_")) rank = Math.max(rank, 30 + Math.max(oxidation, -1) + 1);

  modifierCache.set(id, rank);
  return rank;
}

// ---------- 合并 + 排序 ----------
/**
 * @param {SortableStack} st
 * @returns {string}
 */
export function stackKey(st) {
  return st.typeId + "|" + (st.data ?? 0);
}

/**
 * @param {SortableStack} st
 * @returns {number}
 */
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
 * @template {SortableStack} T
 * @param {T[][]} groups
 * @param {(st: T) => T} [cloneFn] 复制栈的函数，默认浅拷贝（测试用）；
 *        游戏中应传 (st) => st.clone()（ItemStack.clone 官方方法）
 * @returns {T[]} 合并后的物品数组（同类相邻，可能仍有多个满堆叠/余数堆叠）
 */
export function mergeGroups(groups, cloneFn = (st) => ({ ...st })) {
  const out = [];
  for (const arr of groups) {
    if (!arr || arr.length === 0) continue;

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
 * 排序键：大类 → 段落 → 材料（木种/颜色/石料）→ 形态 → 修饰 → ID → data。
 *
 * 与 Inventory Profiles Next 的默认规则一致：先按创造模式物品栏的大类分页，
 * 再按页内「同一种材料聚在一起、基础块在前」的顺序排，最后才用 ID 兜底。
 * @template {SortableStack} T
 * @param {T[]} items
 * @returns {T[]} 排序后的新数组
 */
export function sortItems(items) {
  return [...items].sort((a, b) => {
    const ca = classify(a.typeId);
    const cb = classify(b.typeId);
    if (ca !== cb) return ca - cb;

    const sa = sectionRank(a.typeId);
    const sb = sectionRank(b.typeId);
    if (sa !== sb) return sa - sb;

    const ma = materialRank(a.typeId);
    const mb = materialRank(b.typeId);
    if (ma !== mb) return ma - mb;

    const ha = shapeOf(a.typeId);
    const hb = shapeOf(b.typeId);
    if (ha !== hb) return ha - hb;

    const xa = modifierRank(a.typeId);
    const xb = modifierRank(b.typeId);
    if (xa !== xb) return xa - xb;

    if (a.typeId !== b.typeId) return a.typeId < b.typeId ? -1 : 1;
    return (a.data ?? 0) - (b.data ?? 0);
  });
}

/**
 * 一键合并 + 排序（测试/通用入口）。
 * 分组规则：默认按 typeId+data 比较；可传入自定义 stackable 判定函数
 * （游戏中可传 ItemStack.isStackableWith 以获得引擎级正确性）。
 * @template {SortableStack} T
 * @param {T[]} items
 * @param {(a: T, b: T) => boolean} [stackable] 可选：(a, b) => boolean
 * @param {(st: T) => T} [cloneFn] 可选：复制栈的函数（默认浅拷贝）
 * @returns {T[]} 排序后的物品数组
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
