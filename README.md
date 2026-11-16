# Inventory Sorter 一键整理物品栏

Minecraft Bedrock behavior pack for **1.26.60+** (including the latest 1.26.63 hotfix), built against **`@minecraft/server` 2.11.0**. Sneak to silently sort your inventory, and also sort the storage container you are looking at.
Minecraft 基岩版 **1.26.60+**（兼容最新 1.26.63 热修复）行为包，基于 **`@minecraft/server` 2.11.0** 构建。按下潜行键可静默整理玩家物品栏，并在准星对准存储容器时同时整理容器内容。

---

## English

### Installation

1. Double-click `InventorySorter.mcaddon` to import the behavior pack.
2. Enable "Inventory Sorter" in the Behavior Packs tab of the world settings.
3. Enter the world and press the sneak key once to sort.

No resource pack, cheats, or experimental toggles required.

### Compatibility

- Minecraft Bedrock **1.26.60 or newer**. The manifest declares `min_engine_version: [1, 26, 60]`; older clients will not load the pack.
- Script API: stable **`@minecraft/server` 2.11.0** (the version shipped with 1.26.60+).
- Uses only stable APIs — no Beta APIs toggle.

### How to use

| Action | Effect |
| --- | --- |
| Press the sneak key | Sort your inventory; if a storage container is within 8 blocks in your line of sight, sort it too |
| `/inv:sort` | Sort your inventory only |
| `/inv:sortchest` | Sort the storage container you are looking at |
| `/inv:selftest` | Run the in-game sorting self-test |

Sorting is silent — no sound effects, no chat messages. `/inv:selftest` reports its results to the chat.

### Supported containers

- Player inventory: only slots 9–35 are sorted; the hotbar (slots 0–8) is never touched.
- Storage containers: chests, trapped chests, barrels, copper chests (all oxidation states), all colors of shulker boxes, **shelves** (3-slot storage, all wood types), chest minecarts, and chest boats/rafts. Ender chests are not sorted.
- Functional containers (furnace, hopper, brewing stand, etc.) are left alone to protect their dedicated slots.

### Sort order

Items are first merged up to their maximum stack size, then arranged by category:

Tools/Weapons → Armor → Food → Blocks → Materials → Redstone → Plants → Miscellaneous

Items are sorted by category, then by material family, then by shape. Within each material (e.g. cobblestone, stone, quartz, oak), items are ordered base block → stairs → slab → other variants (walls, bricks, etc.). So a stone family looks like: cobblestone, cobblestone stairs, cobblestone slab, cobblestone wall, mossy cobblestone, mossy cobblestone stairs…; stone bricks, cracked stone bricks and mossy stone bricks sit together, while smooth stone slabs and quartz bricks stay in their own subgroups. Items that differ in durability or state, or that cannot stack, are never merged.

The 1.26.x item families are covered explicitly, including:

- Cinnabar and sulfur building sets (base, polished/chiseled, stairs, slabs, walls, bricks) grouped as stone materials.
- Copper bars, chains, lanterns, torches, golem statues and lightning rods (including exposed/weathered/oxidized/waxed variants).
- Wool and concrete stairs/slabs, sorted together with their base block by color.
- Wooden shelves and colored cushions.
- Nautilus armor (copper, iron, golden, diamond, netherite) and copper/netherite horse armor.
- Spears (wooden, stone, copper, iron, golden, diamond, netherite).
- Poplar wood set, golden dandelion, red shrub, shelf mushroom, ice crystals and icicles.

See [SORT_ORDER.md](SORT_ORDER.md) for the generated order of all 1,627 items in the 1.26.60 item registry.

### Source structure

```text
InventorySorterBP/
|-- manifest.json
|-- pack_icon.png
`-- scripts/
    |-- main.js           # entry: sneak key / command triggers, in-game self-test
    `-- sort_logic.js     # pure sorting logic (unit-testable)
tests/
|-- project.test.mjs      # manifest, API usage and update regression checks
`-- sort_logic.test.mjs   # merging, classification, family/shape ordering
package.json
```

### Testing

Requires Node.js 20 or newer (no dependencies):

```powershell
node --test
# or
npm test
```

The tests cover stack merging and count conservation, 1.26.x item classification, material/family/shape grouping, manifest/version checks, and regression checks for the 2.x API call signatures.

### Packaging

From the repository root:

```powershell
Compress-Archive -Path InventorySorterBP -DestinationPath InventorySorter.zip -Force
Move-Item InventorySorter.zip InventorySorter.mcaddon -Force
```

Build artifacts (`*.mcaddon`, `*.zip`) are ignored by Git; rebuild instead of committing them.

### Changelog — v1.2.0

- Updated the target to Minecraft Bedrock 1.26.60+ and `@minecraft/server` 2.11.0; raised `min_engine_version` to `[1, 26, 60]`.
- Added sorting rules for 1.26.x content (sulfur/cinnabar, copper building set, shelves, cushions, wool/concrete stairs & slabs, nautilus armor, spears, poplar, ice caves, new plants).
- Added shelf support to container detection.
- Fixed `getEntitiesFromRay` to use the 2.x signature `(location, direction, options)`, so chest minecarts and chest boats/rafts are detected correctly.
- Replaced the removed `CustomCommandOrigin.source` fallback with `sourceEntity`.
- Regenerated `SORT_ORDER.md` from the 1.26.60 item registry (1,627 items) and added a Node test suite.

---

## 中文

### 安装

1. 双击 `InventorySorter.mcaddon` 导入行为包。
2. 在世界设置的行为包选项卡中启用“一键整理物品栏”。
3. 进入世界后按一次潜行键执行整理。

不需要资源包、作弊或实验性开关。

### 兼容性

- Minecraft 基岩版 **1.26.60 及以上**。清单中声明 `min_engine_version: [1, 26, 60]`，低于该版本的客户端不会加载此包。
- 脚本 API：稳定版 **`@minecraft/server` 2.11.0**（1.26.60+ 自带版本）。
- 只使用稳定 API，不需要开启 Beta API 开关。

### 触发方式

| 方式 | 效果 |
| --- | --- |
| 按下潜行键 | 整理玩家物品栏；若准星指向 8 格内的存储容器，同时整理该容器 |
| `/inv:sort` | 只整理玩家物品栏 |
| `/inv:sortchest` | 只整理准星指向的存储容器 |
| `/inv:selftest` | 运行游戏内排序逻辑自测 |

整理过程为静默模式，不播放音效，也不发送聊天提示。`/inv:selftest` 会显示测试结果。

### 支持范围

- 玩家物品栏：只整理第 9–35 格，快捷栏（0–8 格）保持不变。
- 存储容器：普通箱子、陷阱箱、木桶、铜箱（含各氧化阶段）、各色潜影盒、**书架**（3 格存储，全部木质变体），以及箱子矿车、运输船/木筏。末影箱不参与整理。
- 熔炉、漏斗、酿造台等功能容器不会被整理，避免打乱专用槽位。

### 排序规则

同类物品先合并到最大堆叠数，再按以下类别排列：

工具武器 → 护甲装备 → 食物 → 建材方块 → 矿物材料 → 红石机制 → 植物农业 → 杂项

物品先按类别、再按材料家族、最后按形态排列。同一种材料（如圆石、石头、石英、橡木）内按「基础块 → 楼梯 → 台阶 → 其他衍生（墙、砖等）」排序：圆石、圆石楼梯、圆石台阶、圆石墙、苔石、苔石楼梯……；石砖、裂纹石砖和苔石砖紧挨着，平滑石台阶和石英砖各自成组不会插进石砖中间。耐久或状态不同、无法堆叠的物品不会合并。

已显式覆盖 1.26.x 的新物品族，包括：

- 朱砂与硫磺建材系列（基础、磨制/雕纹、楼梯、台阶、墙、砖），按石质材料归组。
- 铜栏杆、锁链、灯笼、火把、铜傀儡雕像、避雷针（含氧化/打蜡变体）。
- 羊毛与混凝土楼梯/台阶，按颜色与基础方块相邻排列。
- 木质书架与各色坐垫。
- 鹦鹉螺盔甲（铜、铁、金、钻石、下界合金）与铜/下界合金马铠。
- 长矛（木、石、铜、铁、金、钻石、下界合金）。
- 白杨木系列、金蒲公英、红色灌木、架状蘑菇、冰晶与冰锥。

完整排序见 [SORT_ORDER.md](SORT_ORDER.md)，已按 1.26.60 物品注册表重新生成（1,627 个物品）。

### 源码结构

```text
InventorySorterBP/
|-- manifest.json
|-- pack_icon.png
`-- scripts/
    |-- main.js           # 入口：潜行键/命令触发、游戏内自测
    `-- sort_logic.js     # 纯排序逻辑（可独立单元测试）
tests/
|-- project.test.mjs      # 清单、API 用法与版本回归测试
`-- sort_logic.test.mjs   # 合并、分类、族/形态排序
package.json
```

### 测试

需要 Node.js 20 或更新版本（无第三方依赖）：

```powershell
node --test
# 或
npm test
```

测试覆盖堆叠合并与数量守恒、1.26.x 物品分类、材料/族/形态归组、清单版本检查，以及 2.x API 调用签名的回归检查。

### 打包

在仓库根目录执行：

```powershell
Compress-Archive -Path InventorySorterBP -DestinationPath InventorySorter.zip -Force
Move-Item InventorySorter.zip InventorySorter.mcaddon -Force
```

构建产物（`*.mcaddon`、`*.zip`）已被 Git 忽略，请重新打包而不是提交产物。

### 更新日志 — v1.2.0

- 目标版本升级到 Minecraft 基岩版 1.26.60+ 与 `@minecraft/server` 2.11.0；`min_engine_version` 提升为 `[1, 26, 60]`。
- 新增 1.26.x 内容排序规则（朱砂/硫磺、铜建材、书架、坐垫、羊毛/混凝土楼梯与台阶、鹦鹉螺盔甲、长矛、白杨木、冰洞、新植物）。
- 容器检测新增书架支持。
- 修复 `getEntitiesFromRay` 的调用方式，改用 2.x 签名 `(location, direction, options)`，箱子矿车与运输船/木筏现在能被正确检测。
- 移除已不存在的 `CustomCommandOrigin.source` 回退，统一使用 `sourceEntity`。
- 按 1.26.60 物品注册表重新生成 `SORT_ORDER.md`（1,627 个物品），并新增 Node 测试套件。
