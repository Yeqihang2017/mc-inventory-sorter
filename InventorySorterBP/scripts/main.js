/**
 * main.js — Inventory Sorter entry script
 *
 * Triggers (official stable API, no cheats required):
 *   1. Press the sneak key: sort the player's inventory, and also the storage
 *      container the player is looking at.
 *   2. /inv:sort: sort the player's inventory only.
 *   3. /inv:sortchest: sort the storage container being looked at.
 *
 * Execution context note (important):
 *   Custom command callbacks (like before events) run in the "restricted
 *   execution" context, where world state cannot be modified — including
 *   container.setItem, ItemStack.amount assignment, etc. (throws
 *   "Native function/property ... cannot be used in restricted execution").
 *   Therefore:
 *   - Command callbacks only push the player id into a queue (pure JS, no
 *     world-modifying engine API).
 *   - The actual sorting runs inside system.run / system.runInterval
 *     callbacks (default execution context, full API access).
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
const COOLDOWN_TICKS = 8;       // anti-spam cooldown (0.4 s)
const INTERVAL_TICKS = 2;       // fallback queue polling interval

// 玩家容器布局：0-8 为快捷栏，9-35 为物品栏主体
const HOTBAR_SIZE = 9;
const INVENTORY_START = 9;
// 存储容器白名单（chest 无下划线后缀，需显式列出；_chest/_shulker_box 后缀在 sortChest 匹配）
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
 * In-game self-test (/inv:selftest): runs the sorting logic against real
 * engine ItemStacks to verify merging/classification/count conservation,
 * then reports the result to the player. Never touches the player's inventory.
 */
function runGameSelfTest(player) {
  const failures = [];
  const test = (cond, msg) => { if (!cond) failures.push(msg); };
  try {
    const stackable = (a, b) => a.isStackableWith(b);
    const cloneFn = (st) => st.clone();

    // 1) Cobblestone 40×3 → total 120, split into valid stack sizes
    const c = [40, 40, 40].map((n) => new ItemStack("minecraft:cobblestone", n));
    const r1 = mergeAndSort(c, stackable, cloneFn);
    const t1 = r1.reduce((a, s) => a + s.amount, 0);
    test(t1 === 120, `Cobblestone total ${t1} != 120`);
    test(r1.every((s) => s.amount >= 1 && s.amount <= s.maxAmount), "Cobblestone stack has an invalid amount");

    // 2) Apple 5 + 60 → 64 + 1
    const a = [new ItemStack("minecraft:apple", 5), new ItemStack("minecraft:apple", 60)];
    const r2 = mergeAndSort(a, stackable, cloneFn);
    test(r2.length === 2 && r2[0].amount === 64 && r2[1].amount === 1,
      `Apple merge result wrong: ${r2.map((s) => s.amount).join("+")}`);

    // 3) Cobblestone + stone (different items) must not merge
    const d = [new ItemStack("minecraft:cobblestone", 30), new ItemStack("minecraft:stone", 30)];
    test(mergeAndSort(d, stackable, cloneFn).length === 2, "Different items were wrongly merged");

    // 4) Tools (non-stackable) 1+1 must not merge
    const sw = [new ItemStack("minecraft:diamond_sword", 1), new ItemStack("minecraft:diamond_sword", 1)];
    test(mergeAndSort(sw, stackable, cloneFn).length === 2, "Tools were wrongly merged");

    // 5) Full stack + remainder → no items lost
    const f = [new ItemStack("minecraft:cobblestone", 64), new ItemStack("minecraft:cobblestone", 30)];
    const r5 = mergeAndSort(f, stackable, cloneFn);
    test(r5.reduce((x, s) => x + s.amount, 0) === 94, "Full stack + remainder total wrong");

    if (failures.length === 0) {
      player.sendMessage("§a✔ Self-test passed (merge, sort and count conservation, 5 checks)");
    } else {
      player.sendMessage("§cSelf-test failed: " + failures.join("; "));
    }
  } catch (e) {
    player.sendMessage("§cSelf-test error: " + (e && e.message ? e.message : String(e)));
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

// 实体容器（矿车/船）：不是方块，需要实体射线检测
const ENTITY_CONTAINERS = new Set([
  "minecraft:chest_minecart",
  "minecraft:chest_boat",
  "minecraft:chest_raft",
]);

function sortChest(player) {
  try {
    const hit = player.getBlockFromViewDirection({ maxDistance: 8 });
    const block = hit && hit.block;
    // 白名单：chest/trapped_chest/barrel 显式列出；所有 *_chest（铜箱及
    // 氧化变体等）和 *_shulker_box（各色潜影盒）按后缀匹配。
    // 末影箱（_chest 后缀会匹配到）不整理；熔炉、漏斗等非存储容器也不处理。
    const isStorage = block && block.typeId !== "minecraft:ender_chest" && (
      STORAGE_BLOCKS.has(block.typeId) ||
      block.typeId.endsWith("_chest") ||
      block.typeId.endsWith("_shulker_box")
    );
    if (!isStorage) {
      // 方块不是存储容器 → 再查实体容器（箱子矿车/运输船），
      // 从玩家头部沿视线方向做实体射线检测。
      const rayHits = player.dimension.getEntitiesFromRay({
        origin: player.getHeadLocation(),
        direction: player.getViewDirection(),
      }, { maxDistance: 8 });
      for (const r of rayHits) {
        if (!ENTITY_CONTAINERS.has(r.entity.typeId)) continue;
        const comp = r.entity.getComponent("minecraft:inventory");
        const container = comp && comp.container;
        if (!container) continue;
        sortContainer(container, 0);
        break; // 只整理第一个命中的实体容器
      }
      return;
    }
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

    // 1) Cobblestone 40×3 → total 120, valid amounts
    const r1 = mergeAndSort([40, 40, 40].map((n) => new ItemStack("minecraft:cobblestone", n)), stackable, cloneFn);
    check(r1.reduce((a, s) => a + s.amount, 0) === 120, "cobblestone total wrong");
    check(r1.every((s) => s.amount >= 1 && s.amount <= s.maxAmount), "cobblestone amount out of bounds");

    // 2) Apple 5+60 → 64+1
    const r2 = mergeAndSort([new ItemStack("minecraft:apple", 5), new ItemStack("minecraft:apple", 60)], stackable, cloneFn);
    check(r2.length === 2 && r2[0].amount === 64 && r2[1].amount === 1, "apple merge wrong");

    // 3) Different items must not merge
    check(mergeAndSort([new ItemStack("minecraft:cobblestone", 30), new ItemStack("minecraft:stone", 30)], stackable, cloneFn).length === 2, "different items merged");

    // 4) Tools must not merge
    check(mergeAndSort([new ItemStack("minecraft:diamond_sword", 1), new ItemStack("minecraft:diamond_sword", 1)], stackable, cloneFn).length === 2, "tools merged");

    // 5) Full stack + remainder must not lose items
    const r5 = mergeAndSort([new ItemStack("minecraft:cobblestone", 64), new ItemStack("minecraft:cobblestone", 30)], stackable, cloneFn);
    check(r5.reduce((x, s) => x + s.amount, 0) === 94, "full stack + remainder total wrong");

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
    check(hb0 && hb0.typeId === "minecraft:diamond_sword" && hb0.amount === 1, "hotbar slot 0 was modified");
    check(hb3 && hb3.typeId === "minecraft:cobblestone" && hb3.amount === 40, "hotbar slot 3 was modified");
    // 类别顺序：食物(2) 在 方块(3) 之前 → 苹果在前，圆石在后
    const s9 = fakeItems[9], s10 = fakeItems[10], s11 = fakeItems[11];
    check(s9 && s9.typeId === "minecraft:apple" && s9.amount === 5, "slot 9 should be apple x5, got " + (s9 && s9.typeId));
    check(s10 && s10.typeId === "minecraft:cobblestone" && s10.amount === 64, "slot 10 should be cobblestone x64, got " + (s10 && s10.typeId));
    check(s11 && s11.typeId === "minecraft:cobblestone" && s11.amount === 16, "slot 11 should be cobblestone x16");
    check(fakeItems[12] === undefined, "slot 12 should be empty");

    if (failures.length === 0) console.warn("[InventorySorter] engine self-test passed (6 checks)");
    else console.warn("[InventorySorter] engine self-test failed: " + failures.join("; "));
  } catch (e) {
    console.warn("[InventorySorter] engine self-test error: " + (e && e.message ? e.message : String(e)));
  }
}

system.beforeEvents.startup.subscribe((initEvent) => {
  initEvent.customCommandRegistry.registerCommand(
    {
      name: COMMAND_NAME,
      description: "Sort your inventory",
      permissionLevel: CommandPermissionLevel.Any,
      cheatsRequired: false,
    },
    onCommand
  );

  initEvent.customCommandRegistry.registerCommand(
    {
      name: "inv:sortchest",
      description: "Sort the container you are looking at",
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
    console.warn("[InventorySorter] failed to register sneak key shortcut: " + (e && e.message ? e.message : String(e)));
  }

  // 自测命令：验证排序逻辑在当前版本引擎上运行正常
  initEvent.customCommandRegistry.registerCommand(
    {
      name: "inv:selftest",
      description: "Run the built-in sorting self-test",
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
