/**
 * main.js — 一键整理物品栏 入口脚本
 *
 * 触发方式（官方 stable API，无需作弊）：
 *   1. 按下潜行键：整理玩家物品栏，并同时整理视线指向的存储容器
 *   2. /inv:sort：整理玩家物品栏
 *   3. /inv:sortchest：整理视线指向的存储容器
 *
 * 执行上下文说明（重要）：
 *   自定义命令的回调与 before 事件一样，运行在「受限执行上下文」
 *   （restricted execution），此模式下不能修改世界状态——
 *   包括 container.setItem、ItemStack.amount 赋值等（会抛
 *   "Native function/property ... cannot be used in restricted execution"）。
 *   因此：
 *   - 命令回调里只把玩家 id 放入队列（纯 JS 操作，不碰引擎改世界的 API）；
 *   - 真正的整理在 system.run / system.runInterval 的回调里执行
 *     （默认执行上下文，拥有全部 API）。
 */
import {
  world,
  system,
  Player,
  ItemStack,
  CommandPermissionLevel,
  ButtonState,
  InputButton,
} from "@minecraft/server";
import { mergeGroups, sortItems, mergeAndSort } from "./sort_logic.js";

const COMMAND_NAME = "inv:sort";
const COOLDOWN_TICKS = 8;       // 防连点（0.4 秒）
const INTERVAL_TICKS = 2;       // 兜底队列轮询间隔

// 玩家容器布局：0-8 为快捷栏，9-35 为物品栏主体
const HOTBAR_SIZE = 9;
const INVENTORY_START = 9;
const STORAGE_BLOCKS = new Set([
  "minecraft:chest",
  "minecraft:trapped_chest",
  "minecraft:barrel",
]);

const queue = new Map();   // 待处理玩家 id -> inventory | chest | auto
const busy = new Set();    // 正在整理的玩家 id（防重入）
const lastUse = new Map(); // 玩家 id -> 上次触发 tick

function drainQueue() {
  if (queue.size === 0) return;
  const ids = [...queue.keys()];
  for (const id of ids) {
    if (busy.has(id)) continue;
    const mode = queue.get(id);
    queue.delete(id);
    busy.add(id);
    try {
      // 事件对象在受限上下文结束后会被清空，不能持有玩家引用，
      // 按 id 重新从世界取回玩家对象。
      const player = world.getAllPlayers().find((p) => p.id === id);
      if (!player) continue;
      if (mode === "chest") sortChest(player);
      else if (mode === "auto") {
        sortInventory(player);
        sortChest(player);
      } else sortInventory(player);
    } catch (_) {
      // 出错静默，避免定时回调异常中断
    } finally {
      busy.delete(id);
    }
  }
}

function onCommand(origin) {
  // 兼容 sourceEntity / source 两种取值
  const entity = origin && (origin.sourceEntity ?? origin.source);
  if (!entity || !(entity instanceof Player)) return;

  // 冷却
  const now = system.currentTick;
  const last = lastUse.get(entity.id);
  if (last !== undefined && now - last < COOLDOWN_TICKS) return;
  lastUse.set(entity.id, now);

  // 只入队 + 尝试立即处理，不做任何改世界的调用
  queue.set(entity.id, "inventory");
  system.run(() => drainQueue());
}

function onChestCommand(origin) {
  const entity = origin && (origin.sourceEntity ?? origin.source);
  if (!entity || !(entity instanceof Player)) return;

  const now = system.currentTick;
  const last = lastUse.get(entity.id);
  if (last !== undefined && now - last < COOLDOWN_TICKS) return;
  lastUse.set(entity.id, now);

  queue.set(entity.id, "chest");
  system.run(() => drainQueue());
}

/**
 * 游戏内自测（/inv:selftest）：用真实引擎的 ItemStack 跑一遍排序逻辑，
 * 验证合并/分类/数量守恒，并把结果发给玩家。不触碰玩家物品栏。
 */
function runGameSelfTest(player) {
  const failures = [];
  const test = (cond, msg) => { if (!cond) failures.push(msg); };
  try {
    const stackable = (a, b) => a.isStackableWith(b);
    const cloneFn = (st) => st.clone();

    // 1) 圆石 40×3 → 总量 120，拆成合法数量栈
    const c = [40, 40, 40].map((n) => new ItemStack("minecraft:cobblestone", n));
    const r1 = mergeAndSort(c, stackable, cloneFn);
    const t1 = r1.reduce((a, s) => a + s.amount, 0);
    test(t1 === 120, `圆石总量 ${t1} != 120`);
    test(r1.every((s) => s.amount >= 1 && s.amount <= s.maxAmount), "圆石存在越界数量");

    // 2) 苹果 5 + 60 → 64 + 1
    const a = [new ItemStack("minecraft:apple", 5), new ItemStack("minecraft:apple", 60)];
    const r2 = mergeAndSort(a, stackable, cloneFn);
    test(r2.length === 2 && r2[0].amount === 64 && r2[1].amount === 1,
      `苹果合并结果错误: ${r2.map((s) => s.amount).join("+")}`);

    // 3) 圆石 + 石头（不同物品）不合并
    const d = [new ItemStack("minecraft:cobblestone", 30), new ItemStack("minecraft:stone", 30)];
    test(mergeAndSort(d, stackable, cloneFn).length === 2, "不同物品被误合并");

    // 4) 工具（不可堆叠）1+1 不合并
    const sw = [new ItemStack("minecraft:diamond_sword", 1), new ItemStack("minecraft:diamond_sword", 1)];
    test(mergeAndSort(sw, stackable, cloneFn).length === 2, "工具被误合并");

    // 5) 同物品满堆叠 + 余数 → 不丢物品
    const f = [new ItemStack("minecraft:cobblestone", 64), new ItemStack("minecraft:cobblestone", 30)];
    const r5 = mergeAndSort(f, stackable, cloneFn);
    test(r5.reduce((x, s) => x + s.amount, 0) === 94, "满堆叠+余数总量错误");

    if (failures.length === 0) {
      player.sendMessage("§a✔ 自测全部通过（合并/分类/数量守恒，共 5 组）");
    } else {
      player.sendMessage("§c自测失败：" + failures.join("；"));
    }
  } catch (e) {
    player.sendMessage("§c自测异常：" + (e && e.message ? e.message : String(e)));
  }
}

/**
 * 整理容器：只处理物品栏主体（9-35），快捷栏（0-8）完全不参与——
 * 不读取、不合并、不写回，快捷栏物品保持原位不动。
 * @param {Container} container 玩家物品栏容器
 * @returns {number} 写回的物品组数
 */
function sortContainer(container, startIndex = INVENTORY_START) {
  if (!container || container.size <= startIndex) return 0;

  // 1) 只读取物品栏主体（getItem 返回副本，可安全修改 amount）
  const stacks = [];
  for (let i = startIndex; i < container.size; i++) {
    const st = container.getItem(i);
    if (st && st.typeId !== "minecraft:air" && st.amount > 0) stacks.push(st);
  }
  if (stacks.length === 0) return 0;

  // 2) 用引擎的 isStackableWith 分组（自动处理颜色/状态/自定义数据），
  //    再交给纯逻辑模块做合并与类别排序
  const groups = [];
  for (const st of stacks) {
    let placed = false;
    for (const g of groups) {
      if (g[0].isStackableWith(st)) {
        g.push(st);
        placed = true;
        break;
      }
    }
    if (!placed) groups.push([st]);
  }
  const merged = mergeGroups(groups, (st) => st.clone());
  const sorted = sortItems(merged);

  // 3) 只清空并写回物品栏主体，快捷栏一个格子都不碰
  for (let i = startIndex; i < container.size; i++) container.setItem(i, undefined);
  for (let i = 0; i < sorted.length && startIndex + i < container.size; i++) {
    container.setItem(startIndex + i, sorted[i]);
  }
  return sorted.length;
}

function sortInventory(player) {
  try {
    const inv = player.getComponent("minecraft:inventory");
    const container = inv && inv.container;
    sortContainer(container, INVENTORY_START);
  } catch (_) { /* 静默模式 */ }
}

function sortChest(player) {
  try {
    const hit = player.getBlockFromViewDirection({ maxDistance: 8 });
    const block = hit && hit.block;
    const isStorage = block && (
      STORAGE_BLOCKS.has(block.typeId) || block.typeId.endsWith("_shulker_box")
    );
    if (!isStorage) return;
    const component = block && block.getComponent("minecraft:inventory");
    const container = component && component.container;
    if (!container) return;
    sortContainer(container, 0);
  } catch (_) { /* 静默模式 */ }
}

function onSneakInput(event) {
  if (event.button !== InputButton.Sneak || event.newButtonState !== ButtonState.Pressed) return;
  const player = event.player;
  const now = system.currentTick;
  const last = lastUse.get(player.id);
  if (last !== undefined && now - last < COOLDOWN_TICKS) return;
  lastUse.set(player.id, now);

  queue.set(player.id, "auto");
  system.run(() => drainQueue());
}

/**
 * 启动时引擎自测：用真实 ItemStack 跑排序逻辑，结果输出到服务器日志。
 * （BDS 上 console.warn 会写入 server.log；客户端上静默）
 */
function runStartupSelfTest() {
  try {
    const stackable = (a, b) => a.isStackableWith(b);
    const cloneFn = (st) => st.clone();
    const failures = [];
    const check = (cond, msg) => { if (!cond) failures.push(msg); };

    // 1) 圆石 40×3 → 总量 120，数量合法
    const r1 = mergeAndSort([40, 40, 40].map((n) => new ItemStack("minecraft:cobblestone", n)), stackable, cloneFn);
    check(r1.reduce((a, s) => a + s.amount, 0) === 120, "圆石总量错误");
    check(r1.every((s) => s.amount >= 1 && s.amount <= s.maxAmount), "圆石存在越界数量");

    // 2) 苹果 5+60 → 64+1
    const r2 = mergeAndSort([new ItemStack("minecraft:apple", 5), new ItemStack("minecraft:apple", 60)], stackable, cloneFn);
    check(r2.length === 2 && r2[0].amount === 64 && r2[1].amount === 1, "苹果合并错误");

    // 3) 不同物品不合并
    check(mergeAndSort([new ItemStack("minecraft:cobblestone", 30), new ItemStack("minecraft:stone", 30)], stackable, cloneFn).length === 2, "不同物品误合并");

    // 4) 工具不合并
    check(mergeAndSort([new ItemStack("minecraft:diamond_sword", 1), new ItemStack("minecraft:diamond_sword", 1)], stackable, cloneFn).length === 2, "工具误合并");

    // 5) 满堆叠+余数不丢物品
    const r5 = mergeAndSort([new ItemStack("minecraft:cobblestone", 64), new ItemStack("minecraft:cobblestone", 30)], stackable, cloneFn);
    check(r5.reduce((x, s) => x + s.amount, 0) === 94, "满堆叠+余数总量错误");

    // 6) 容器范围测试：只整理物品栏主体（9-35），快捷栏（0-8）完全不动
    const fakeItems = new Array(36).fill(undefined);
    const fakeContainer = {
      size: 36,
      getItem(i) { return fakeItems[i]; },
      setItem(i, st) { fakeItems[i] = st; },
    };
    fakeItems[0] = new ItemStack("minecraft:diamond_sword", 1);   // 快捷栏 0：剑
    fakeItems[3] = new ItemStack("minecraft:cobblestone", 40);    // 快捷栏 3：圆石 40
    fakeItems[10] = new ItemStack("minecraft:cobblestone", 40);   // 物品栏 10：圆石 40
    fakeItems[15] = new ItemStack("minecraft:cobblestone", 40);   // 物品栏 15：圆石 40
    fakeItems[20] = new ItemStack("minecraft:apple", 5);          // 物品栏 20：苹果
    sortContainer(fakeContainer);
    const hb0 = fakeItems[0], hb3 = fakeItems[3];
    check(hb0 && hb0.typeId === "minecraft:diamond_sword" && hb0.amount === 1, "快捷栏0被改动");
    check(hb3 && hb3.typeId === "minecraft:cobblestone" && hb3.amount === 40, "快捷栏3被改动");
    // 类别顺序：食物(2) 在 方块(3) 之前 → 苹果在前，圆石在后
    const s9 = fakeItems[9], s10 = fakeItems[10], s11 = fakeItems[11];
    check(s9 && s9.typeId === "minecraft:apple" && s9.amount === 5, "物品栏9应为苹果5, 实际 " + (s9 && s9.typeId));
    check(s10 && s10.typeId === "minecraft:cobblestone" && s10.amount === 64, "物品栏10应为圆石64, 实际 " + (s10 && s10.typeId));
    check(s11 && s11.typeId === "minecraft:cobblestone" && s11.amount === 16, "物品栏11应为圆石16");
    check(fakeItems[12] === undefined, "物品栏12应为空");

    if (failures.length === 0) console.warn("[InventorySorter] 引擎自测通过 (6组)");
    else console.warn("[InventorySorter] 引擎自测失败: " + failures.join("；"));
  } catch (e) {
    console.warn("[InventorySorter] 引擎自测异常: " + (e && e.message ? e.message : String(e)));
  }
}

system.beforeEvents.startup.subscribe((initEvent) => {
  initEvent.customCommandRegistry.registerCommand(
    {
      name: COMMAND_NAME,
      description: "一键整理物品栏：堆叠合并并按类别分组",
      permissionLevel: CommandPermissionLevel.Any,
      cheatsRequired: false,
    },
    onCommand
  );

  initEvent.customCommandRegistry.registerCommand(
    {
      name: "inv:sortchest",
      description: "整理视线指向的箱子或其它容器",
      permissionLevel: CommandPermissionLevel.Any,
      cheatsRequired: false,
    },
    onChestCommand
  );

  try {
    world.afterEvents.playerButtonInput.subscribe(onSneakInput, {
      buttons: [InputButton.Sneak],
      state: ButtonState.Pressed,
    });
  } catch (e) {
    console.warn("[InventorySorter] 潜行快捷键注册失败: " + (e && e.message ? e.message : String(e)));
  }

  // 自测命令：验证排序逻辑在当前版本引擎上运行正常
  initEvent.customCommandRegistry.registerCommand(
    {
      name: "inv:selftest",
      description: "一键整理物品栏：运行内置自测",
      permissionLevel: CommandPermissionLevel.Any,
      cheatsRequired: false,
    },
    (origin) => {
      const entity = origin && (origin.sourceEntity ?? origin.source);
      if (!entity || !(entity instanceof Player)) return;
      system.run(() => runGameSelfTest(entity));
    }
  );

  // 定时兜底：在默认执行上下文中处理队列。
  // 若个别版本 system.run 仍处于受限上下文，这里也能保证整理正常执行。
  try {
    system.runInterval(() => drainQueue(), INTERVAL_TICKS);
  } catch (_) {
    // startup 阶段不允许则忽略，命令触发时的 system.run 也能处理
  }

  // 启动自测（延迟到正常执行上下文）
  try {
    system.run(() => runStartupSelfTest());
  } catch (_) { /* 不阻塞启动 */ }
});
