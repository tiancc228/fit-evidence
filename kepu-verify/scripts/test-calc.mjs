import ts from "typescript";
import { mkdtempSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const files = [
  ["src/lib/calc.ts", "calc.mjs"],
  ["src/lib/source-match.ts", "source-match.mjs"],
  ["src/components/plan/trainingEngine.ts", "trainingEngine.mjs"],
];

const dir = mkdtempSync(join(tmpdir(), "calc-"));
for (const [src, out] of files) {
  const text = await readFile(src, "utf8");
  const js = ts.transpileModule(text, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText
    .replace(/from\s+"@\/src\/lib\/calc"/g, 'from "./calc.mjs"')
    .replace(/from\s+"\.\/([^"]+)\.ts"/g, 'from "./$1.mjs"');
  writeFileSync(join(dir, out), js, "utf8");
}

const calc = await import(pathToFileURL(join(dir, "calc.mjs")).href);
const sm = await import(pathToFileURL(join(dir, "source-match.mjs")).href);
const te = await import(pathToFileURL(join(dir, "trainingEngine.mjs")).href);

let pass = 0;
let fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log(`  PASS ${name}`); }
  else { fail++; console.log(`  FAIL ${name}`, detail === undefined ? "" : JSON.stringify(detail)); }
}

const profile = {
  sex: "male", age: 26, heightCm: 178, weightKg: 74,
  activity: "moderate", goal: "fatloss", level: "novice",
};

console.log("== 热量口径（模型 A：活动系数已含训练）==");
const meals = [{ kcal: 2016, protein: 150, carb: 200, fat: 60 }];
const trainings = [{ durationMin: 60, met: 5, weightKg: 74 }];
const bal = calc.dayBalance(profile, meals, trainings);

ok("净热量 = 摄入 − 目标（不再扣训练）", bal.net === 2016 - bal.target, { net: bal.net, target: bal.target });
ok("训练消耗仍被计算并保留", bal.burnExercise > 0, bal.burnExercise);
ok("净热量不等于旧的重复扣减值", bal.net !== 2016 - bal.burnExercise - bal.target, {
  newNet: bal.net,
  oldNet: 2016 - bal.burnExercise - bal.target,
});
ok("暴露维持热量供各页统一", typeof bal.maintenance === "number" && bal.maintenance === calc.tdee(profile), {
  maintenance: bal.maintenance,
});

console.log("== 三处页面同源 ==");
const bal2 = calc.dayBalance(profile, meals, trainings);
ok("同一输入两次调用结果一致", JSON.stringify(bal.net) === JSON.stringify(bal2.net) &&
  bal.target === bal2.target && bal.maintenance === bal2.maintenance);

console.log("== 判定阈值 ===");
const atTarget = calc.dayBalance(profile, [{ kcal: bal.target, protein: 0, carb: 0, fat: 0 }], []);
ok("正好等于目标判为接近目标", atTarget.verdict === "balanced", atTarget.verdict);
const over = calc.dayBalance(profile, [{ kcal: bal.target + 300, protein: 0, carb: 0, fat: 0 }], []);
ok("超出目标判为盈余", over.verdict === "surplus", over.verdict);
const under = calc.dayBalance(profile, [{ kcal: bal.target - 300, protein: 0, carb: 0, fat: 0 }], []);
ok("低于目标判为缺口", under.verdict === "deficit", under.verdict);

console.log("== 训练负重建议 ==");
const squat = { id: "s", name: "杠铃深蹲", nameEn: "Squat", part: "腿", pattern: "蹲", equipment: "杠铃", level: "novice", cues: [], commonErrors: [], videoBvid: null, met: 5 };
const noHist = te.estimateLoad(squat, "novice");
ok("无历史时不返回精确公斤", noHist.lowKg === null && noHist.highKg === null, noHist);
ok("无历史时给出 RIR 指引", /RIR|余力/.test(noHist.note), noHist.note);
const withHist = te.estimateLoad(squat, "novice", 60);
ok("有历史时按上次重量给建议", withHist.lowKg === 60 && withHist.highKg === 60, withHist);
ok("有历史时标明依据", /上次/.test(withHist.basis), withHist.basis);
const bw = te.estimateLoad({ ...squat, id: "b", name: "俯卧撑", equipment: "自重" }, "novice");
ok("自重动作仍标记为自重", bw.isBodyweight === true, bw);

console.log("== 来源匹配 ==");
ok("动作全名命中判 exact", sm.matchExercise("杠铃深蹲训练", "杠铃深蹲") === "exact");
ok("核心词+无冲突器械判 exact", sm.matchExercise("深蹲你容易出现的错误", "杠铃深蹲") === "exact");
ok("史密斯与杠铃不算同一动作", sm.matchExercise("史密斯深蹲详解", "杠铃深蹲") === "near");
ok("哑铃与杠铃不算同一动作", sm.matchExercise("哑铃卧推详解", "杠铃平板卧推") === "near",
  sm.matchExercise("哑铃卧推详解", "杠铃平板卧推"));
ok("无关内容判 none", sm.matchExercise("蹭饭五——健美备赛脱水", "杠铃深蹲") === "none");
ok("系列中的饮食视频不算动作教学", sm.matchExercise("卧推系列⑩——饮食", "杠铃平板卧推") === "none",
  sm.matchExercise("卧推系列⑩——饮食", "杠铃平板卧推"));
ok("高脚杯深蹲不等于杠铃深蹲", sm.matchExercise("高脚杯深蹲详解", "杠铃深蹲") === "near", sm.matchExercise("高脚杯深蹲详解", "杠铃深蹲"));
ok("补剂视频不算动作教学", sm.matchExercise("补剂系列①——肌酸", "杠铃弯举") === "none");
ok("时长解析 18:04", sm.toSec("18:04") === 1084, sm.toSec("18:04"));
ok("时长解析 1:02:03", sm.toSec("1:02:03") === 3723);
ok("无法解析返回 null", sm.toSec("abc") === null);

console.log("== 跨平台去重 ==");
const a = { id: "1", kind: "bilibili", author: "谭成义", durationSec: 951, url: "b", richness: 0 };
const b = { id: "2", kind: "douyin", author: "谭成义", durationSec: 950, url: "d", richness: 0 };
const c = { id: "3", kind: "douyin", author: "别人", durationSec: 951, url: "x", richness: 0 };
const e = { id: "4", kind: "douyin", author: "谭成义", durationSec: 1200, url: "y", richness: 0 };
ok("同作者同时长判为同一作品", sm.sameWork(a, b) === true);
ok("不同作者不合并", sm.sameWork(a, c) === false);
ok("时长差超 3 秒不合并", sm.sameWork(a, e) === false);
ok("同平台不合并", sm.sameWork(a, { ...a, id: "9" }) === false);

console.log(`\n结果: ${pass} 通过, ${fail} 失败`);
process.exit(fail ? 1 : 0);
