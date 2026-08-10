# Inventory Sorter 一键整理物品栏

Minecraft Bedrock behavior pack (26.x). Sneak to silently sort your inventory, and also sort the container you are looking at.
Minecraft 基岩版 26.x 行为包。按下潜行键可静默整理玩家物品栏，并在准星对准存储容器时同时整理容器内容。

---

## English

### Installation

1. Double-click `InventorySorter.mcaddon` to import the behavior pack.
2. Enable "Inventory Sorter" in the Behavior Packs tab of the world settings.
3. Enter the world and press the sneak key once to sort.

No resource pack, cheats, or experimental toggles required.

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
- Storage containers: chests, trapped chests, barrels, copper chests (all oxidation states), all colors of shulker boxes, chest minecarts, and chest boats/rafts. Ender chests are not sorted.
- Functional containers (furnace, hopper, brewing stand, etc.) are left alone to protect their dedicated slots.

### Sort order

Items are first merged up to their maximum stack size, then arranged by category:

Tools/Weapons → Armor → Food → Blocks → Materials → Redstone → Plants → Miscellaneous

Items are sorted by category, then by material family, then by shape. Within each material (e.g. cobblestone, stone, quartz, oak), items are ordered base block → stairs → slab → other variants (walls, bricks, etc.). So a stone family looks like: cobblestone, cobblestone stairs, cobblestone slab, cobblestone wall, mossy cobblestone, mossy cobblestone stairs…; stone bricks, cracked stone bricks and mossy stone bricks sit together, while smooth stone slabs and quartz bricks stay in their own subgroups. Items that differ in durability or state, or that cannot stack, are never merged.

### Source structure

```text
InventorySorterBP/
|-- manifest.json
|-- pack_icon.png
`-- scripts/
    |-- main.js           # entry: sneak key / command triggers, in-game self-test
    `-- sort_logic.js     # pure sorting logic (unit-testable)
```

### Packaging

Zip the `InventorySorterBP` folder and rename the extension to `.mcaddon`. Build artifacts are not committed to Git.

---

## 中文

### 安装

1. 双击 `InventorySorter.mcaddon` 导入行为包。
2. 在世界设置的行为包选项卡中启用"一键整理物品栏"。
3. 进入世界后按一次潜行键执行整理。

不需要资源包、作弊或实验性开关。

### 触发方式

| 方式 | 效果 |
| --- | --- |
| 按下潜行键 | 整理玩家物品栏；若准星指向 8 格内的存储容器，同时整理该容器 |
| `/inv:sort` | 只整理玩家物品栏 |
| `/inv:sortchest` | 只整理准星指向的存储容器 |
| `/inv:selftest` | 运行游戏内排序逻辑自测 |

整理过程为静默模式，不播放音效，也不发送聊天提示。`/inv:selftest` 会显示测试结果。

### 支持范围

- 玩家物品栏：只整理第 9-35 格，快捷栏保持不变。
- 存储容器：普通箱子、陷阱箱、木桶、铜箱（含各氧化阶段）、各色潜影盒，以及箱子矿车、运输船/木筏。末影箱不参与整理。
- 熔炉、漏斗、酿造台等功能容器不会被整理，避免打乱专用槽位。

### 排序规则

同类物品先合并到最大堆叠数，再按以下类别排列：

工具武器 -> 护甲装备 -> 食物 -> 建材方块 -> 矿物材料 -> 红石机制 -> 植物农业 -> 杂项

物品先按类别、再按材料家族、最后按形态排列。同一种材料（如圆石、石头、石英、橡木）内按「基础块 → 楼梯 → 台阶 → 其他衍生（墙、砖等）」排序：圆石、圆石楼梯、圆石台阶、圆石墙、苔石、苔石楼梯……；石砖、裂纹石砖和苔石砖紧挨着，平滑石台阶和石英砖各自成组不会插进石砖中间。耐久或状态不同、无法堆叠的物品不会合并。

### 源码结构

```text
InventorySorterBP/
|-- manifest.json
|-- pack_icon.png
`-- scripts/
    |-- main.js           # 入口：潜行键/命令触发、游戏内自测
    `-- sort_logic.js     # 纯排序逻辑（可独立单元测试）
```

### 打包

将 `InventorySorterBP` 文件夹压缩为 zip，并把扩展名改为 `.mcaddon`。构建产物不提交到 Git。
