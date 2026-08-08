# 一键整理物品栏（Inventory Sorter）

Minecraft 基岩版（26.x）模组：点击 HUD 按钮一键整理物品栏 —— 相同物品自动堆叠合并到最大堆叠数，并按类别分组排列。

## 安装

1. 双击 `InventorySorter.mcaddon`，Minecraft 会自动导入**两个包**（行为包「一键整理物品栏」+ 资源包「一键整理物品栏 UI」）。
2. 创建或进入世界时，在 **行为包** 和 **资源包** 两个选项卡里都勾选本模组（两个都要启用）。
3. 进入游戏，屏幕**右下角**会出现一个 ⇅ 整理按钮，点击即整理。

不需要开启作弊，不需要任何实验性开关（全部使用官方稳定版 Script API）。

## 触发方式

| 方式 | 说明 |
| --- | --- |
| 背包界面「整理」按钮 | 打开背包后，物品栏面板右上角的「整理」按钮，点击执行整理 |
| 聊天指令 `/inv:sort` | 兜底方式，与按钮效果完全一样 |

> 说明：JSON UI 按钮的 `command` 字段目前未被官方文档收录（早期版本曾用于 UI 按钮执行命令），在绝大多数版本上仍可正常触发。如果某天按钮失灵，聊天输入 `/inv:sort` 永远可用 —— 这条通道是官方 stable 的自定义命令（Custom Commands），无需作弊。

## 整理范围

**只整理物品栏主体（第 9–35 格），快捷栏（第 0–8 格）完全不参与**：快捷栏里的物品不会被合并、不会移动，保持原位。整理结果从物品栏第一格（第 9 格）开始排列。

## 排序规则

同类物品合并到最大堆叠（耐久不同的工具不会合并），然后按类别排列：

工具武器 → 护甲装备 → 食物 → 建材方块 → 矿物材料 → 红石机制 → 植物农业 → 杂项

同类别内按物品 ID 字母排序（同类物品必然相邻）。

## 源码结构

```
InventorySorter.mcaddon         # 可直接导入的安装包
├── InventorySorterBP/          # 行为包（排序逻辑）
│   ├── manifest.json
│   └── scripts/
│       ├── main.js             # 入口：注册 /inv:sort 命令 + 读写容器
│       └── sort_logic.js       # 纯逻辑：堆叠合并 + 类别分类（可独立测试）
└── InventorySorterRP/          # 资源包（HUD 按钮）
    ├── manifest.json
    ├── ui/hud_screen.json      # 基于最新 vanilla 文件，注入了 inv_sort_button
    └── textures/ui/inv_sort_button.png
```

## 自定义

- **调整按钮位置**：改 `InventorySorterRP/ui/hud_screen.json` 中 `inv_sort_button` 的 `offset`（相对右下角的偏移 `[x, y]`），如 `[-24, -64]` 表示距右 24px、距下 64px。
- **调整类别顺序/规则**：改 `InventorySorterBP/scripts/sort_logic.js` 中的 `CAT` 与分类表。
- **打包**：修改后把 `InventorySorterBP`、`InventorySorterRP` 两个文件夹压缩进一个 zip，改后缀名为 `.mcaddon` 即可。

## 故障排查

- **出现「Unsupported or out of bounds value set on Property: amount, Value: 0」**：这是 v1.0.1 早期脚本的已知 bug——合并时把被吸收的栈数量减成 0，而 `ItemStack.amount` 合法范围是 [1,255]。已修复（合并改为「求和再拆分」，不再产生 0 值）。若仍出现请确认世界里的包是最新版并彻底重装。
- **出现「Native function/property ... cannot be used in restricted execution」**：自定义命令回调和 `before` 事件一样运行在受限执行上下文，不能改世界（含 `setItem`、`ItemStack.amount` 赋值）。现版本命令回调只把玩家加入队列，整理动作在 `system.run` / `system.runInterval` 的默认上下文回调里执行，不会触发。若仍出现，说明世界里挂的还是旧包——按下方「彻底重装」操作。
- **彻底重装（重要）**：v1.0.1 换了新的包 UUID。必须先在世界的「设置 → 行为包/资源包」里**移除旧包**，再到主菜单「设置 → 存储」删除旧包（旧的显示为 1.0.0），最后重新导入新 `.mcaddon` 并重新添加。不彻底移除会同时挂新旧两套包导致旧版继续报错。
- **提示需要作弊**：设计上是免作弊的（`cheatsRequired: false`，官方 stable API）。若仍需作弊，通常是旧包缓存问题（官方已知问题 MCPE-227757 的修法就是换 UUID 重装，本版本已处理）；请确认世界里的包是 v1.0.1。
- **看不到按钮**：确认世界「资源包」里已添加「一键整理物品栏 UI」（两个包都要勾选）。按钮在**背包界面**里：打开背包，物品栏面板右上角，深色圆角方块带 ⇅ 箭头和「整理」文字。
  - **必须重新导入**：v1.0.3 换了新 UUID，旧包不会自动被覆盖。请在 设置 → 存储 里删除旧的「一键整理物品栏 UI」，再导入新版并重新添加。
  - 按钮只在**生存/冒险模式**显示（绑定 `#is_survival_layout`），创造模式不显示。
  - 按钮位置可通过 `ui/inventory_screen.json` 中 `inv_sort_button` 的 `offset` 微调（相对物品栏面板右上角）。
- **依赖版本**：manifest 中 `@minecraft/server` 依赖声明为 `2.0.0`（低版本声明可兼容更高内置 API 的引擎；BDS 1.26 实测高版本声明会导致脚本不加载）。
- **按钮点了没反应**：按钮依赖 UI 的 `command` 字段（未文档化），个别版本可能失效；此时聊天输入 `/inv:sort` 必定可用。

## 已知限制

- 排序针对物品栏全部 36 格；快捷栏物品也会参与整理（适合在安全的地方使用）。
- 护甲栏、副手不受影响。
- 潜影盒内容不参与整理。
- 目标版本为 26.x 引擎（manifest `min_engine_version: [1, 26, 0]`）。

## 测试

**真实引擎测试（已通过）**：脚本已在官方 BDS 1.26.21.1（26.x 引擎）上实际加载运行，启动自测输出 `[InventorySorter] 引擎自测通过 (5组)`，自定义命令注册成功。覆盖：合并正确性、数量守恒、`ItemStack.amount` 无越界、不同物品/工具不误合并。

**游戏内自测**：安装后输入 `/inv:selftest`，用游戏内真实 ItemStack 跑 5 组断言，结果发到聊天框（`✔ 自测全部通过` 或失败详情）。

**本地单元测试**：`sort_logic.js` 不依赖游戏 API，可在 Node 中直接跑（用带 `[1,255]` 越界校验的 mock 模拟真实 ItemStack），涉及堆叠合并、分类边界（如 `stone_sword` 是工具不是方块、`copper_ingot` 是材料）、类别排序稳定性。
