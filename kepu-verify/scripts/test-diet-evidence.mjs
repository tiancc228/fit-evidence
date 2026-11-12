import ts from "typescript";
import { mkdtempSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const sourcePath = "src/components/diet/evidence.ts";
const outDir = mkdtempSync(join(tmpdir(), "diet-evidence-"));
const source = await readFile(sourcePath, "utf8");
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
writeFileSync(join(outDir, "evidence.mjs"), js, "utf8");

const { DIET_EVIDENCE_EVENT, requestEvidence } = await import(
  pathToFileURL(join(outDir, "evidence.mjs")).href
);

let pass = 0;
let fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log(`  PASS ${name}`); }
  else { fail++; console.log(`  FAIL ${name}`, detail === undefined ? "" : JSON.stringify(detail)); }
}

/** 模拟全局证据抽屉:两种模式都必须打开同一个抽屉、同一个结论。 */
const opened = [];
function drawer(claimId) {
  opened.push(claimId);
}

function mountDrawerListener() {
  const target = new EventTarget();
  const seen = [];
  const listener = (event) => {
    const detail = event.detail;
    seen.push(detail);
    drawer(detail.id);
    event.preventDefault();
  };
  target.addEventListener(DIET_EVIDENCE_EVENT, listener);
  return { target, seen, listener };
}

console.log("== 回调模式 ==");
{
  const { target, seen } = mountDrawerListener();
  let callbackCalls = 0;
  const result = requestEvidence(
    (claimId) => { callbackCalls += 1; drawer(claimId); },
    "fatloss-caloric-deficit",
    "diet-balance",
    target,
  );
  ok("传入回调时返回 callback", result === "callback", result);
  ok("回调模式打开抽屉一次", opened.length === 1, opened);
  ok("回调模式不再派发 window 事件", seen.length === 0, seen);
  ok("回调模式用的结论编号正确", opened[0] === "fatloss-caloric-deficit", opened[0]);
}

console.log("== window 事件兜底模式 ==");
{
  opened.length = 0;
  const { target, seen } = mountDrawerListener();
  const claimId = "fatloss-caloric-deficit";
  const result = requestEvidence(undefined, claimId, "diet-balance", target);
  ok("没有回调时返回 event", result === "event", result);
  ok("全局监听器打开同一个抽屉", opened.length === 1 && opened[0] === claimId, opened);
  ok("事件 detail 携带 id", seen[0]?.id === claimId, seen[0]);
  ok("事件 detail 携带类型", seen[0]?.type === "claim", seen[0]);
  ok("事件 detail 携带来源", seen[0]?.source === "diet-balance", seen[0]);
  ok("两种模式打开的是同一条结论", opened[0] === claimId, opened[0]);
}

console.log("== 没有监听器 ==");
{
  opened.length = 0;
  const target = new EventTarget();
  const result = requestEvidence(undefined, "protein-intake-1-6g", "diet-advice", target);
  ok("没有监听器时返回 missing(页面据此提示,不静默)", result === "missing", result);
  ok("没有监听器时抽屉未被打开", opened.length === 0, opened);
}

console.log("== 监听器清理 ==");
{
  opened.length = 0;
  const { target, listener } = mountDrawerListener();
  target.removeEventListener(DIET_EVIDENCE_EVENT, listener);
  const result = requestEvidence(undefined, "staple-grain-grams", "diet-next-meal", target);
  ok("移除监听器后返回 missing", result === "missing", result);
  ok("移除监听器后不再打开抽屉", opened.length === 0, opened);
}

console.log("== 监听器用 detail.handled 回执 ==");
{
  opened.length = 0;
  const target = new EventTarget();
  target.addEventListener(DIET_EVIDENCE_EVENT, (event) => {
    event.detail.handled = true;
    drawer(event.detail.id);
  });
  const result = requestEvidence(undefined, "sugar-sweetened-beverages", "diet-slot", target);
  ok("detail.handled 也视为已处理", result === "event", result);
  ok("detail.handled 模式同样打开抽屉", opened[0] === "sugar-sweetened-beverages", opened);
}

console.log(`\n结果: ${pass} 通过, ${fail} 失败`);
process.exit(fail ? 1 : 0);
