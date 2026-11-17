# Inventory Sorter 一键整理物品栏

Minecraft Bedrock behavior pack for **1.26.60+** (including the latest 1.26.63 hotfix), built against **`@minecraft/server` 2.11.0**. Sneak to silently sort your inventory, and also sort the storage container you are looking at.
Minecraft 基岩版 **1.26.60+**（兼容最新 1.26.63 热修复）行为包，基于 **`@minecraft/server` 2.11.0** 构建。按下潜行键可静默整理玩家物品栏，并在准星对准存储容器时同时整理容器内容。

排序顺序对齐 Java 版一键整理 mod **Inventory Profiles Next** 的默认规则（原版创造模式物品栏顺序）。

---

## English

### Installation

1. Double-click `InventorySorter-v1.3.0.mcaddon` to import the behavior pack.
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

Stacks are first merged up to their maximum stack size, then arranged exactly like the vanilla **creative inventory** — the same default rule the Java mod *Inventory Profiles Next* uses (`@creative_menu_order`):

> Building Blocks → Colored Blocks → Natural Blocks → Functional Blocks → Redstone → Tools & Utilities → Combat → Food & Drinks → Ingredients → Spawn Eggs

Inside each category:

- **Same material stays together.** Every wood type runs planks → stairs → slab → fence → fence gate → door → trapdoor → sign → hanging sign, and wood types follow the vanilla order (oak, spruce, birch, jungle, acacia, dark oak, mangrove, cherry, pale oak, poplar, bamboo, crimson, warped).
- **Stones follow a fixed material order** (stone, cobblestone, granite, diorite, andesite, deepslate, tuff, calcite, dripstone, blackstone, basalt, obsidian, netherrack, nether bricks, end stone, purpur, prismarine, sandstone, red sandstone, quartz, bricks, mud, resin, cinnabar, sulfur, copper …). Within a material the order is base block → stairs → slab → wall → bricks, and polished / smooth / cut / chiseled / cracked / mossy variants sit next to the shape they belong to.
- **Colored blocks follow the 16 dye colors** (white → orange → magenta → light blue → … → black): wool, carpet, concrete, concrete powder, terracotta, glazed terracotta, stained glass, glass panes, candles, cushions, harnesses.
- **Copper steps through its oxidation stages**: plain → cut → chiseled → exposed → weathered → oxidized → waxed.
- **Tools, weapons and armor progress through material tiers** (wooden, stone, copper, iron, golden, diamond, netherite); armor pieces run helmet → chestplate → leggings → boots, and horse / nautilus armor are separate groups.
- **Storage blocks group by kind**: chests and trapped chests, ender chest, copper chest variants, then undyed shulker box and the colored shulker boxes in dye order.

Stacks that differ in durability, enchantment or any other component are never merged; they stay adjacent and are ordered by item ID.

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
|-- project.test.mjs      # manifest, API usage and doc/order regression checks
|-- sort_logic.test.mjs   # merging, categories, family/material/shape ordering
`-- fixtures/
    `-- vanilla-items-1.26.60.txt   # 1,627-item registry snapshot used by the tests
tools/
`-- generate-sort-order.mjs
build.ps1
package.json
```

### Testing

Requires Node.js 20 or newer (no dependencies):

```powershell
node --test
# or
npm test
```

If your environment forbids child processes (some sandboxes block `node --test`), run the two test files directly:

```powershell
node tests/sort_logic.test.mjs
node tests/project.test.mjs
```

The tests cover stack merging and count conservation, category assignment for every 1.26.x item family, the creative-inventory order, family/material/shape ordering, full-registry classification (all 1,627 items), and a regression check that `SORT_ORDER.md` still matches the code.

### Regenerating the sort order table

After changing the sorting rules:

```powershell
npm run sort-order
```

This rewrites `SORT_ORDER.md` from `tests/fixtures/vanilla-items-1.26.60.txt` using the current `sort_logic.js`.

### Packaging

Build artifacts always carry the pack version in the file name — `InventorySorter-v<version>.mcaddon` — where `<version>` is read from `InventorySorterBP/manifest.json`:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\build.ps1
# -> InventorySorter-v1.3.0.mcaddon
```

`npm run build` runs the same script. It also removes the early, version-less artifact name if one is still lying around. Build artifacts (`*.mcaddon`, `*.zip`) are ignored by Git; rebuild instead of committing them.

### Changelog — v1.3.0

- Replaced the previous ad-hoc category order with the **creative-inventory order** that Inventory Profiles Next uses by default: Building Blocks → Colored Blocks → Natural → Functional → Redstone → Tools → Combat → Food → Ingredients → Spawn Eggs.
- Added per-material ordering for wood types, the 16 dye colors, stone families, copper oxidation stages, tool/armor tiers and storage kinds, so related variants are no longer scattered alphabetically.
- Classified the whole 1,627-item registry: only admin-only blocks (command blocks, barriers, light blocks, structure blocks …) fall into the "其他" bucket.
- Added `tests/fixtures/vanilla-items-1.26.60.txt`, a full-registry classification test, and `tools/generate-sort-order.mjs`.
- `SORT_ORDER.md` is now generated and verified against the sorting code.
- Pack artifacts are now named `InventorySorter-v<version>.mcaddon`; `build.ps1` reads the version from the manifest.
- Raised pack version to 1.3.0.

---

## 中文

### 安装

1. 双击 `InventorySorter-v1.3.0.mcaddon` 导入行为包。
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

同类物品先合并到最大堆叠数，然后**完全按原版创造模式物品栏的顺序**排列 —— 这正是 Java 版一键整理 mod *Inventory Profiles Next* 的默认规则（`@creative_menu_order`）：

> 建筑方块 → 染色方块 → 自然方块 → 功能方块 → 红石 → 工具与实用物品 → 战斗用品 → 食物与饮品 → 原材料 → 刷怪蛋

每个大类内部：

- **同一种材料挨在一起。** 每种木头按「木板 → 楼梯 → 台阶 → 栅栏 → 栅栏门 → 门 → 活板门 → 告示牌 → 悬挂告示牌」排列，木种本身按原版顺序（橡木、云杉、白桦、丛林、金合欢、深色橡木、红树、樱花、苍白橡木、白杨、竹、绯红、诡异）。
- **石料按固定的材料顺序**（石、圆石、花岗岩、闪长岩、安山岩、深板岩、凝灰岩、方解石、滴水石、黑石、玄武岩、黑曜石、下界岩、下界砖、末地石、紫珀、海晶石、砂岩、红砂岩、石英、砖、泥、树脂、朱砂、硫磺、铜……）。每种材料内部按「基础块 → 楼梯 → 台阶 → 墙 → 砖」，磨制/平滑/切制/雕纹/裂纹/苔藓等变体紧跟在对应形态之后。
- **染色方块按 16 种染料颜色**（白 → 橙 → 品红 → 淡蓝 → …… → 黑）：羊毛、地毯、混凝土、混凝土粉末、陶瓦、带釉陶瓦、染色玻璃、玻璃板、蜡烛、坐垫、挽具。
- **铜制建材按氧化阶段**：普通 → 切制 → 雕纹 → 斑驳 → 风化 → 氧化 → 打蜡。
- **工具、武器、护甲按材质等级**（木、石、铜、铁、金、钻石、下界合金）；护甲部件按「头盔 → 胸甲 → 护腿 → 靴子」，马铠与鹦鹉螺铠各自成组。
- **容器按种类分组**：箱子与陷阱箱、末影箱、铜箱各氧化阶段，然后是未染色潜影盒与按颜色排列的各色潜影盒。

耐久、附魔或其他组件不同、无法堆叠的物品永远不会被合并，它们会彼此相邻并按物品 ID 排序。

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
|-- project.test.mjs      # 清单、API 用法与「文档/顺序一致性」回归测试
|-- sort_logic.test.mjs   # 合并、类别、族/材料/形态排序
`-- fixtures/
    `-- vanilla-items-1.26.60.txt   # 1,627 个物品的注册表快照（测试用）
tools/
`-- generate-sort-order.mjs
build.ps1
package.json
```

### 测试

需要 Node.js 20 或更新版本（无第三方依赖）：

```powershell
node --test
# 或
npm test
```

如果当前环境禁止子进程（部分沙箱会阻止 `node --test`），可以直接运行两个测试文件：

```powershell
node tests/sort_logic.test.mjs
node tests/project.test.mjs
```

测试覆盖堆叠合并与数量守恒、全部 1.26.x 物品族的分类、创造模式物品栏顺序、材料/形态归组、全注册表分类（1,627 个物品），以及 `SORT_ORDER.md` 与排序代码是否同步的回归检查。

### 重新生成排序顺序表

修改排序规则后执行：

```powershell
npm run sort-order
```

该命令会依据 `tests/fixtures/vanilla-items-1.26.60.txt` 和当前的 `sort_logic.js` 重写 `SORT_ORDER.md`。

### 打包

构建产物始终带版本号：`InventorySorter-v<版本>.mcaddon`，版本号直接读自 `InventorySorterBP/manifest.json`：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\build.ps1
# -> InventorySorter-v1.3.0.mcaddon
```

`npm run build` 执行的是同一个脚本。它还会顺带清理早期不带版本号的旧产物。构建产物（`*.mcaddon`、`*.zip`）已被 Git 忽略，请重新打包而不是提交产物。

### 更新日志 — v1.3.0

- 排序顺序改为与 **Inventory Profiles Next 默认规则一致**的原版创造模式物品栏顺序：建筑 → 染色 → 自然 → 功能 → 红石 → 工具 → 战斗 → 食物 → 原材料 → 刷怪蛋，取代原先自定义的 8 类顺序。
- 新增木种、16 种染料颜色、石料家族、铜氧化阶段、工具/护甲材质等级、容器种类的组内顺序，相关变体不再因 ID 字母序被打散。
- 全量归类 1,627 个物品：只有管理员专用方块（命令方块、屏障、光源方块、结构方块等）落入“其他”。
- 新增 `tests/fixtures/vanilla-items-1.26.60.txt`（全量物品清单）、全注册表分类测试，以及 `tools/generate-sort-order.mjs`。
- `SORT_ORDER.md` 改为自动生成，并新增与代码同步的回归测试。
- 行为包产物改为 `InventorySorter-v<版本>.mcaddon` 命名，`build.ps1` 自动从清单读取版本号。
- 行为包版本提升到 1.3.0。
