/**
 * 依据排序逻辑重新生成 SORT_ORDER.md。
 *
 * 用法（仓库根目录）：
 *   node tools/generate-sort-order.mjs
 *
 * 物品清单来自 tests/fixtures/vanilla-items-1.26.60.txt（1.26.60 注册表快照），
 * 排序结果完全由 InventorySorterBP/scripts/sort_logic.js 决定。
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  CAT,
  SECTION_TITLES,
  categoryName,
  classify,
  sectionOf,
  sortItems,
} from "../InventorySorterBP/scripts/sort_logic.js";

const root = new URL("../", import.meta.url);
const fixture = new URL("tests/fixtures/vanilla-items-1.26.60.txt", root);
const target = new URL("SORT_ORDER.md", root);

const ids = readFileSync(fixture, "utf8").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
const sorted = sortItems(ids.map((typeId) => ({ typeId, amount: 1, maxAmount: 64 })));

/** 大类顺序与说明 */
const CATEGORY_ORDER = [
  CAT.BUILDING, CAT.COLORED, CAT.NATURAL, CAT.FUNCTIONAL, CAT.REDSTONE,
  CAT.TOOLS, CAT.COMBAT, CAT.FOOD, CAT.INGREDIENTS, CAT.SPAWN_EGGS, CAT.MISC,
];

const lines = [];
lines.push("# Inventory Sorter 排序顺序表");
lines.push("");
lines.push(`按当前排序逻辑对 Minecraft 基岩版 1.26.60 物品注册表（${ids.length} 个物品）的排序结果。`);
lines.push("");
lines.push("排序顺序对齐 Java 版一键整理 mod **Inventory Profiles Next** 的默认规则，");
lines.push("即原版**创造模式物品栏**的顺序：");
lines.push("");
lines.push("> 建筑方块 → 染色方块 → 自然方块 → 功能方块 → 红石 → 工具与实用物品 → 战斗用品 → 食物与饮品 → 原材料 → 刷怪蛋");
lines.push("");
lines.push("每个大类内部按「段落 → 材料（木种 / 颜色 / 石料）→ 形态 → 修饰 → ID」排列：");
lines.push("");
lines.push("- 同一种材料挨在一起：木板、楼梯、台阶、栅栏、栅栏门、门、活板门、告示牌依次排列；");
lines.push("- 石料按 石 → 圆石 → 花岗岩 → 闪长岩 → 安山岩 → 深板岩 → …… 的固定顺序，每种材料内部按 基础块 → 楼梯 → 台阶 → 墙 → 砖；");
lines.push("- 羊毛、混凝土、陶瓦等按 白 → 橙 → 品红 → 淡蓝 → …… → 黑的固定 16 色顺序；");
lines.push("- 铜制建材按 普通 → 斑驳 → 风化 → 氧化 → 打蜡 的氧化阶段排列。");
lines.push("");

for (const category of CATEGORY_ORDER) {
  const items = sorted.filter((stack) => classify(stack.typeId) === category);
  if (items.length === 0) continue;
  const title = categoryName(items[0].typeId);
  lines.push(`## ${title}（${items.length}）`);
  lines.push("");
  let currentSection = "";
  for (const stack of items) {
    const section = sectionOf(stack.typeId);
    if (section !== currentSection) {
      if (currentSection !== "") lines.push("");
      lines.push(`### ${SECTION_TITLES[section] ?? section}`);
      lines.push("");
      currentSection = section;
    }
    lines.push(`- ${stack.typeId}`);
  }
  lines.push("");
}

writeFileSync(target, lines.join("\n"), "utf8");
console.log(`SORT_ORDER.md written: ${ids.length} items, ${lines.length} lines`);
