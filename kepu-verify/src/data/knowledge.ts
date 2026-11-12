import type { BloggerSource, Claim, EvidenceRef, Verdict } from "@/src/lib/types";
import { GUIDELINE_2022 } from "@/src/lib/calc";
import rawSources from "./real-sources.json";
import douyinRaw from "./douyin-sources.json";

/**
 * 四层分离的知识卡片。
 * layer1 博主原话：仅取自 real-sources.json / douyin-sources.json 中视频标题/简介的逐字连续子串（≤60字）。
 *   未获取到任何逐字字幕（B站/抖音字幕接口需登录），startSec/endSec 一律为 null。
 *   抖音的 platform_summary 与 chapters 是平台自动生成的 AI 摘要，不是博主原话，
 *   只能带标注前缀放进 layer2.rationale，绝不进 layer1.quote。
 * layer2 AI 拆解结论：可被文献检验的一句话，generatedBy = "ai"。
 * layer3 科学证据：仅按 doi 从 real-sources.json 的 evidence 中精确取用，绝不手打文献。
 * layer4 产品最终建议：给新手的可执行建议；具体克数只来自 calc.ts 公式或膳食指南，
 *   并明确标注是产品计算结果而非博主数字；reviewedBy = null（待人工审核）。
 * 拿不到素材的卡片如实标注「素材不足」，verdict 用 insufficient，不用猜测填补。
 */

interface RawSources {
  videos: BloggerSource[];
  evidence: EvidenceRef[];
}

const sources = rawSources as unknown as RawSources;

/** 全部真实 B站视频（60 条；过滤空 bvid 兜底，空 bvid 的付费课程已从素材中移除）。 */
export const BLOGGER_VIDEOS: BloggerSource[] = sources.videos.filter(
  (v) => typeof v.bvid === "string" && v.bvid.length > 0,
);

/** 全量真实文献（36 篇，含 33 个 DOI / 32 个 PMID）。 */
export const EVIDENCE: EvidenceRef[] = sources.evidence;

const VIDEO_BY_BVID: Map<string, BloggerSource> = new Map(BLOGGER_VIDEOS.map((v) => [v.bvid as string, v]));
const EVIDENCE_BY_DOI: Map<string, EvidenceRef> = new Map(
  EVIDENCE.filter((e) => typeof e.doi === "string" && e.doi.length > 0).map((e) => [e.doi as string, e]),
);

function video(bvid: string): BloggerSource {
  const v = VIDEO_BY_BVID.get(bvid);
  if (!v) throw new Error(`real-sources.json 中不存在视频 ${bvid}`);
  return v;
}

function paper(doi: string): EvidenceRef {
  const e = EVIDENCE_BY_DOI.get(doi);
  if (!e) throw new Error(`real-sources.json 中不存在文献 ${doi}`);
  return e;
}

interface DouyinChapter {
  start: string;
  startSec: number;
  title: string;
  summary: string | null;
  endSec: number | null;
}

interface DouyinVideo {
  platform: "douyin";
  aweme_id: string;
  title: string;
  author: string;
  collection: string | null;
  published_text: string | null;
  duration_text: string | null;
  duration_sec: number | null;
  likes_text: string | null;
  url: string;
  desc: string | null;
  platform_summary: string | null;
  chapters: DouyinChapter[];
  /** 博主重复投稿归并后的从属 id（引用时只用主 aweme_id，不用这里的 id）。 */
  duplicate_ids?: string[];
}

interface DouyinBlogger {
  platform: "douyin";
  name: string;
  unique_id: string;
  sec_uid: string;
  url: string;
  followers_text: string;
  likes_text: string;
  work_count: number;
  signature: string;
  ip_location: string;
  age_text: string;
}

interface DouyinSources {
  bloggers: DouyinBlogger[];
  videos: DouyinVideo[];
}

const douyin = douyinRaw as unknown as DouyinSources;

/** 抖音来源视频原样导出（chapters 为平台AI章节摘要，不是博主逐字原话，展示时必须标注）。 */
export const DOUYIN_VIDEOS: DouyinVideo[] = douyin.videos;

/** 抖音博主主页信息（谭成义）。 */
export const DOUYIN_BLOGGER: DouyinBlogger = douyin.bloggers[0];

const DOUYIN_BY_ID: Map<string, DouyinVideo> = new Map(DOUYIN_VIDEOS.map((v) => [v.aweme_id, v]));

const DOUYIN_REASON = "抖音逐字字幕需登录未获取；平台AI章节摘要见 layer2.rationale，不等同博主原话。";

/** published_text 为北京时间（UTC+8），转 unix 秒；缺失时省略 pubdate 字段。 */
function douyinSource(awemeId: string): BloggerSource {
  const v = DOUYIN_BY_ID.get(awemeId);
  if (!v) throw new Error(`douyin-sources.json 中不存在视频 ${awemeId}`);
  return {
    platform: "douyin",
    aweme_id: v.aweme_id,
    title: v.title,
    author: v.author,
    ...(v.published_text
      ? { pubdate: Math.floor(new Date(v.published_text.replace(" ", "T") + ":00+08:00").getTime() / 1000) }
      : {}),
    duration: v.duration_text ?? undefined,
    description: v.desc ?? undefined,
    url: v.url,
    pic: null,
  };
}

type GuidelineEntry = Claim["layer3"]["guideline"][number];

function guideline(key: string): GuidelineEntry {
  const c = GUIDELINE_2022.clauses.find((x) => x.key === key);
  if (!c) throw new Error(`GUIDELINE_2022 中不存在条款 ${key}`);
  return {
    title: GUIDELINE_2022.title,
    issuer: GUIDELINE_2022.issuer,
    publishedAt: GUIDELINE_2022.publishedAt,
    clause: `${c.label}：${c.range}${c.note ? `（${c.note}）` : ""}`,
    url: GUIDELINE_2022.url,
  };
}

/** 数据拆解时间（固定值，保证构建可复现）。 */
const EXTRACTED_AT = "2026-11-11T14:00:00.000Z";
const NO_SUBTITLE_REASON = "未获取到逐字字幕，引用来自视频标题/简介原文";

type Relation = "supports" | "refutes" | "partial" | "context";
type Strength = "high" | "medium" | "low";
type ClaimType = Claim["layer2"]["claimType"];

interface ClaimSeed {
  id: string;
  topic: string;
  topicLabel: string;
  bvid: string | null;
  awemeId?: string;
  quote: string | null;
  missingReason?: string;
  statement: string;
  claimType: ClaimType;
  rationale: string;
  verdict: Verdict;
  evidence?: { doi: string; relation: Relation; strength: Strength; note: string }[];
  guidelineKeys?: string[];
  verdictReason: string;
  advice: string;
  appliesTo: string[];
  notFor: string[];
  exerciseIds?: string[];
}

function makeClaim(s: ClaimSeed): Claim {
  return {
    id: s.id,
    topic: s.topic,
    topicLabel: s.topicLabel,
    layer1: {
      quote: s.quote,
      startSec: null,
      endSec: null,
      source: s.awemeId ? douyinSource(s.awemeId) : s.bvid ? video(s.bvid) : null,
      missingReason: s.awemeId ? DOUYIN_REASON : s.bvid ? NO_SUBTITLE_REASON : (s.missingReason ?? "素材不足"),
    },
    layer2: {
      statement: s.statement,
      claimType: s.claimType,
      generatedBy: "ai",
      rationale: s.rationale,
    },
    layer3: {
      verdict: s.verdict,
      evidence: (s.evidence ?? []).map((e) => ({ ref: paper(e.doi), relation: e.relation, strength: e.strength, note: e.note })),
      guideline: (s.guidelineKeys ?? []).map(guideline),
      verdictReason: s.verdictReason,
    },
    layer4: {
      advice: s.advice,
      appliesTo: s.appliesTo,
      notFor: s.notFor,
      reviewedBy: null,
    },
    review: {
      state: "ai_extracted",
      history: [
        { at: EXTRACTED_AT, actor: "ai", action: "extract", from: null, to: "ai_extracted", note: "自动拆解，等待人工审核" },
      ],
    },
    exerciseIds: s.exerciseIds ?? [],
  };
}

export const CLAIMS: Claim[] = [
  // ===================== 蛋白质摄入量 =====================
  makeClaim({
    id: "protein-intake-1-6g",
    topic: "protein-intake",
    topicLabel: "蛋白质摄入量",
    bvid: "BV1A4zjB7EcE",
    quote: "蛋白质摄入量详讲",
    statement: "增肌期每日蛋白质摄入达到约 1.6 g/kg 体重后，继续增加摄入量不再带来更多瘦体重增长。",
    claimType: "dosage",
    rationale: "原话仅为「蛋白质摄入量详讲」主题，未给出具体数字；AI 将其拆解为「增肌蛋白质摄入的剂量上限」这一可核验问题，具体阈值由文献层独立给出。",
    verdict: "supported",
    evidence: [
      { doi: "10.1136/bjsports-2017-097608", relation: "supports", strength: "high", note: "49 项 RCT、1863 人的 meta 回归：蛋白质补充显著增加抗阻训练带来的去脂体重；总摄入超过约 1.62 g/kg/d 后未见进一步收益。" },
      { doi: "10.1186/s12970-017-0177-8", relation: "supports", strength: "high", note: "ISSN 立场声明：1.4–2.0 g/kg/d 足以满足大多数训练者增肌与保肌需求，与 meta 分析的平台点一致。" },
    ],
    verdictReason: "高质量 meta 分析（被引 823）与 ISSN 立场声明互相印证，平台点约 1.6 g/kg/d。注意这是群体平均值，个体反应存在差异，实操中留出余量是合理的。",
    advice: "增肌期按每天 1.6–2.2 g/kg 体重吃蛋白质：70 kg 的人约 112–154 g，分到 3–4 餐，每餐约 30–40 g（≈ 一个手掌大的瘦肉/鱼 + 一份蛋奶）。超过 2.2 g/kg 不会更快增肌，只是更贵。",
    appliesTo: ["进行规律抗阻训练的健康成年人", "增肌或塑形期新手"],
    notFor: ["已有肾脏疾病者（蛋白质摄入量需遵医嘱）", "不训练的久坐人群（无需按此上限执行）"],
    exerciseIds: ["barbell-bench-press", "goblet-squat", "lat-pulldown"],
  }),
  makeClaim({
    id: "protein-per-meal-distribution",
    topic: "protein-intake",
    topicLabel: "蛋白质摄入量",
    bvid: "BV1A4zjB7EcE",
    quote: "蛋白质摄入量详讲",
    statement: "蛋白质每餐摄入 20–40 g、每隔 3–4 小时均匀分配，比集中在一餐更有利于肌肉蛋白合成。",
    claimType: "dosage",
    rationale: "从「蛋白质摄入量详讲」主题中拆出「怎么分配」这一独立于总量的可核验问题。",
    verdict: "supported",
    evidence: [
      { doi: "10.1186/s12970-017-0177-8", relation: "supports", strength: "high", note: "ISSN 声明：每餐约 0.25 g/kg 或 20–40 g 优质蛋白、含 700–3000 mg 亮氨酸，理想情况下每 3–4 小时均匀分配；同时指出每餐最优剂量的证据并不一致，与年龄和训练刺激有关。" },
    ],
    verdictReason: "均匀分配是 ISSN 立场声明的明确建议；但声明本身承认每餐最优剂量证据不一，因此 20–40 g 应理解为实用区间而非精确阈值。",
    advice: "把全天蛋白质平均分到 3–4 餐，每餐 20–40 g：早餐别只吃包子稀饭，加 1–2 个鸡蛋和一杯奶；训练后那一餐正常吃即可，不用迷信「30 分钟窗口期」。",
    appliesTo: ["规律训练的健康成年人"],
    notFor: ["需要限制蛋白质的肾病患者", "间歇性断食执行者（分配策略需另行评估）"],
  }),
  makeClaim({
    id: "protein-kidney-safety",
    topic: "protein-intake",
    topicLabel: "蛋白质摄入量",
    bvid: "BV1A4zjB7EcE",
    quote: "蛋白质摄入量详讲",
    statement: "健康训练者每日 1.4–2.0 g/kg 体重的蛋白质摄入是安全的，不会损害肾功能或骨代谢。",
    claimType: "safety",
    rationale: "蛋白质摄入话题下新手最常见的顾虑是「伤肾」，拆解为安全性问题单独核验。",
    verdict: "supported",
    evidence: [
      { doi: "10.1186/1550-2783-4-8", relation: "supports", strength: "high", note: "ISSN 2007 声明第 2、3 条：1.4–2.0 g/kg/d 对活动人群安全，在均衡饮食下不损害健康人的肾功能与骨代谢。" },
      { doi: "10.1186/s12970-017-0177-8", relation: "supports", strength: "medium", note: "ISSN 2017 声明：减脂期抗阻训练者可能需要更高摄入（2.3–3.1 g/kg/d）以保留瘦体重，适用对象为健康训练者。" },
    ],
    verdictReason: "两份 ISSN 立场声明一致支持健康人群的安全性；结论边界清晰——「健康」是前提，已有肾病者不适用。",
    advice: "肾功能正常的训练者可以放心吃到 1.6–2.2 g/kg；体检时关注肌酐等指标即可。已有肾病、蛋白尿或家族肾病史的人，先问医生再定蛋白质目标。",
    appliesTo: ["肾功能正常的健康训练者"],
    notFor: ["慢性肾病患者", "蛋白尿或肾功能指标异常者"],
  }),
  // ===================== 碳水倍数 =====================
  makeClaim({
    id: "carb-per-kg-multiplier",
    topic: "carb-multiplier",
    topicLabel: "碳水倍数",
    bvid: "BV1ev411w7bs",
    quote: "保姆式增肌饮食分享/比例/碳蛋脂算法",
    statement: "增肌期碳水摄入应按体重倍数（g/kg）设定起点，再按总热量与训练量调整，而非套用固定克数。",
    claimType: "dosage",
    rationale: "原话提到「比例/碳蛋脂算法」，AI 拆解出其中隐含的「碳水按体重倍数计算」做法；原话未给出具体倍数，倍数起点由产品层建议。",
    verdict: "partial",
    evidence: [
      { doi: "10.1186/1550-2783-11-20", relation: "partial", strength: "medium", note: "Helms 备赛综述：脂肪占 15–30% 热量、蛋白质按瘦体重设定后，剩余热量由碳水提供——碳水是分配结果，文献未验证某一固定倍数。" },
      { doi: "10.1186/s12970-017-0174-y", relation: "context", strength: "medium", note: "ISSN 饮食与身体成分声明：饮食方案需个体化并考虑依从性，未给出碳水的固定 g/kg 倍数。" },
    ],
    verdictReason: "「按体重倍数估算」是可操作的起点工具，方向与文献的个体化原则一致；但库内 36 篇文献没有直接检验「碳水 X g/kg」的试验，具体倍数属于经验性建议而非被验证的阈值。",
    advice: "增肌新手碳水从 3–5 g/kg 起步（70 kg 约 210–350 g），蛋白质和脂肪定好后用碳水填满剩余热量；每 2 周看体重趋势：增重太慢加半碗饭，太快先减油。",
    appliesTo: ["规律抗阻训练、以增肌为目标的成年人"],
    notFor: ["糖尿病或糖代谢异常者（碳水分配需遵医嘱）", "生酮饮食执行者"],
  }),
  makeClaim({
    id: "carb-adjust-by-training",
    topic: "carb-multiplier",
    topicLabel: "碳水倍数",
    bvid: "BV1fempB5EV5",
    quote: "碳水调整以训练状态和水平提升为主保持微微饥饿感",
    statement: "碳水摄入应根据训练状态与水平提升动态调整，并以体重记录和形体对比作为调整依据。",
    claimType: "dosage",
    rationale: "原话明确说「碳水调整以训练状态和水平提升为主」「以体重记录形体对比图」，直接拆解为「按训练表现与体成分反馈调碳水」的可核验做法。",
    verdict: "partial",
    evidence: [
      { doi: "10.1186/s12970-017-0174-y", relation: "context", strength: "low", note: "ISSN 声明：饮食的长期成功取决于依从性，增肌饮食需支持递增的训练需求；但未直接检验「按训练状态调碳水」这一具体做法。" },
    ],
    verdictReason: "「按反馈调整」与文献的个体化、依从性原则方向一致，但库内没有直接比较「按训练状态调碳水」与「固定碳水」的试验，证据强度低。",
    advice: "训练日碳水照常或略多，休息日可略少；每周固定时间称体重 2–3 次取平均，每 4 周拍一次同光线对比照。连续 2 周体重不动且训练没劲，先加碳水而不是先怀疑动作。",
    appliesTo: ["有规律训练记录习惯的健身者"],
    notFor: ["无法规律记录饮食与体重的人群（建议先用固定方案）"],
  }),
  // ===================== 减脂热量缺口 =====================
  makeClaim({
    id: "fatloss-caloric-deficit",
    topic: "fatloss-deficit",
    topicLabel: "减脂热量缺口",
    bvid: "BV1WB4y1K7DQ",
    quote: "减脂的必要条件",
    statement: "减脂的必要条件是持续的热量缺口，缺口大小应参考基线体脂水平。",
    claimType: "diet",
    rationale: "原话列出「减脂的必要条件」与「热量的控制与安排」，AI 拆解出其核心命题：热量缺口是减脂的驱动因素。",
    verdict: "supported",
    evidence: [
      { doi: "10.1186/s12970-017-0174-y", relation: "supports", strength: "high", note: "ISSN 声明第 3 条：以减脂为目标的饮食由持续热量缺口驱动；基线体脂越高可承受越激进的缺口，较瘦者宜用慢速以保留瘦体重。" },
    ],
    verdictReason: "ISSN 立场声明直接支持「持续热量缺口驱动减脂」，并给出缺口幅度的个体化边界，与博主「必要条件」的说法一致。",
    advice: "减脂期每天比维持热量（TDEE）少吃约 300–500 kcal（约 15–20%）：先砍含糖饮料和多余烹调油，而不是砍主食。体脂较高者可取上限，较瘦者取下限。",
    appliesTo: ["体脂偏高、以减脂为目标的健康成年人"],
    notFor: ["BMI < 18.5 的偏瘦人群", "孕期/哺乳期女性", "有进食障碍史者"],
  }),
  makeClaim({
    id: "fatloss-weekly-rate",
    topic: "fatloss-deficit",
    topicLabel: "减脂热量缺口",
    bvid: "BV1g2A7zdENX",
    quote: "三个月减脂计划安排，具体怎么操作？吃什么？吃多少？",
    statement: "减脂期每周减重约 0.5–1% 体重（慢速减重）比更快减重更能保留瘦体重与力量。",
    claimType: "dosage",
    rationale: "原话是三个月减脂计划的实操主题，AI 拆解出其中最关键的可核验变量——减重速度。",
    verdict: "supported",
    evidence: [
      { doi: "10.1123/ijsnem.21.2.97", relation: "supports", strength: "high", note: "24 名运动员 RCT：每周减 0.7% 体重组瘦体重增加 2.1%，每周减 1.4% 组瘦体重不变；慢速组力量表现也更好。" },
      { doi: "10.1186/1550-2783-11-20", relation: "supports", strength: "high", note: "Helms 备赛综述：热量摄入应设定为每周减重约 0.5–1%，以最大化肌肉保留。" },
    ],
    verdictReason: "一项直接比较两种减重速度的 RCT 与循证综述结论一致：慢速减重保肌。注意 Garthe 研究对象是运动员，新手缺口可更保守。",
    advice: "把目标定在每周减 0.5–1% 体重：80 kg 的人每周 0.4–0.8 kg。连续两周掉秤超过 1%，每天加回约 200 kcal；完全不掉秤再减 100–200 kcal。快不等于好，掉肌肉的减脂是亏本买卖。",
    appliesTo: ["配合抗阻训练的减脂人群"],
    notFor: ["需要在医学监督下快速减重的重度肥胖者（遵医嘱）", "赛前需控体重的运动员（另有专门策略）"],
  }),
  makeClaim({
    id: "fatloss-high-protein",
    topic: "fatloss-deficit",
    topicLabel: "减脂热量缺口",
    bvid: "BV1tEkxBsE8M",
    quote: "蹭饭十二——掉肌肉详解",
    statement: "减脂期提高蛋白质摄入（高于增肌期）有助于在热量缺口下保留瘦体重。",
    claimType: "dosage",
    rationale: "原话主题为「掉肌肉详解」，AI 拆解出减脂期保肌的营养手段——蛋白质摄入量是否需要上调。",
    verdict: "supported",
    evidence: [
      { doi: "10.1186/s12970-017-0177-8", relation: "supports", strength: "high", note: "ISSN 声明：低热量期间，抗阻训练者可能需要 2.3–3.1 g/kg/d 的更高蛋白质摄入以最大化瘦体重保留。" },
      { doi: "10.1186/1550-2783-11-20", relation: "partial", strength: "medium", note: "Helms 综述建议 2.3–3.1 g/kg 去脂体重/天——注意单位是瘦体重而非总体重，换算后数值低于按总体重计。" },
    ],
    verdictReason: "两份文献一致支持减脂期上调蛋白质；但 Helms 的单位是 g/kg 瘦体重，直接照搬到总体重会高估需求，产品建议取两者之间的实用区间。",
    advice: "减脂期蛋白质吃到 2.0–2.4 g/kg 体重（70 kg 约 140–168 g），每餐都有蛋白质：鸡胸、鱼虾、瘦牛肉、鸡蛋、低脂奶换着来。同时保持力量训练，只靠吃蛋白不练，肌肉照样掉。",
    appliesTo: ["热量缺口下坚持抗阻训练的健康成年人"],
    notFor: ["肾病患者", "不训练、只靠节食减重者（证据前提包含抗阻训练）"],
    exerciseIds: ["barbell-bench-press", "goblet-squat", "lat-pulldown"],
  }),
  makeClaim({
    id: "fatloss-lowcarb-myth",
    topic: "fatloss-deficit",
    topicLabel: "减脂热量缺口",
    bvid: "BV1qvF3eUEuA",
    quote: "高碳减脂？碳水详解",
    statement: "减脂必须采用低碳水饮食，碳水吃高了就减不了脂。",
    claimType: "diet",
    rationale: "原话标题以疑问形式探讨「高碳减脂」，AI 拆解出其对立命题「减脂必须低碳水」作为待核验的常见说法；原话本身并未断言必须低碳水。",
    verdict: "conflict",
    evidence: [
      { doi: "10.1186/s12970-017-0174-y", relation: "refutes", strength: "high", note: "ISSN 声明第 5 条：从低脂到低碳/生酮的广泛饮食方式可同样有效地改善身体成分；第 3 条：减脂由持续热量缺口驱动，而非碳水高低本身。" },
    ],
    verdictReason: "「必须低碳水」与 ISSN 立场声明直接冲突：碳水比例不是减脂的决定因素，持续缺口才是。低碳水只是制造缺口的一种手段，不是必要条件。",
    advice: "减脂不用戒主食：训练日碳水保留约 2–3 g/kg，优先砍含糖饮料、酒精和多余烹调油。把白米饭的一部分换成杂粮饭更抗饿，但「不吃主食」换来的快速掉秤大多是水分。",
    appliesTo: ["以减脂为目标的健康训练者"],
    notFor: ["遵医嘱执行生酮饮食的特定疾病人群", "糖尿病用药者（调整碳水需医生指导）"],
  }),
  // ===================== 增肌热量盈余 =====================
  makeClaim({
    id: "muscle-caloric-surplus",
    topic: "muscle-surplus",
    topicLabel: "增肌热量盈余",
    bvid: "BV1caH56PEdD",
    quote: "增肌饮食详解",
    statement: "增肌期应维持持续的热量盈余，以支持肌肉合成与递增的训练需求。",
    claimType: "diet",
    rationale: "原话为「增肌饮食详解」主题，AI 拆解出增肌饮食的能量方向问题：是否需要热量盈余。",
    verdict: "supported",
    evidence: [
      { doi: "10.1186/s12970-017-0174-y", relation: "supports", strength: "high", note: "ISSN 声明第 4 条：以增加瘦体重为目标的饮食由持续热量盈余驱动，以支持合成过程与递增的抗阻训练需求；盈余的构成与幅度会影响增重的成分。" },
    ],
    verdictReason: "「增肌需要持续盈余」有 ISSN 立场声明直接支持；但声明同时指出盈余幅度影响增重成分，库内没有检验「最佳盈余幅度」的 RCT，因此 +10–15% 的具体幅度属于产品建议。",
    advice: "增肌期每天比维持热量多吃约 10–15%（约 200–350 kcal），目标每周增重 0.25–0.5% 体重。连续 2 周体重不涨就加 150 kcal；涨太快说明脂肪也在长，先回调。",
    appliesTo: ["体脂不高、以增肌为目标的规律训练者"],
    notFor: ["体脂率偏高者（先减脂或走身体重塑路线）", "减脂期人群"],
  }),
  // ===================== 训练频率 =====================
  makeClaim({
    id: "training-frequency-2x",
    topic: "training-frequency",
    topicLabel: "训练频率",
    bvid: "BV14v4y1G7A3",
    quote: "一分化训练 理论+计划+讲解",
    statement: "每个肌群每周训练至少 2 次，比每周只练 1 次更有利于增肌。",
    claimType: "dosage",
    rationale: "原话推荐「一分化训练」（每次练全身、每肌群每周约 1–2 次），AI 拆解出背后的频率变量：每肌群每周练几次更好。",
    verdict: "partial",
    evidence: [
      { doi: "10.1007/s40279-016-0543-8", relation: "supports", strength: "medium", note: "Schoenfeld 2016 meta：容量匹配的对比中，每肌群每周 2 次的肥大效应优于 1 次。" },
      { doi: "10.1080/02640414.2018.1555906", relation: "partial", strength: "high", note: "Schoenfeld 2019 meta（25 项研究）：每周总容量相等时，频率差异不显著，可按个人偏好选择。" },
      { doi: "10.1007/s40279-025-02344-w", relation: "context", strength: "medium", note: "Pelland 2026 meta 回归：频率对肥大的独立效应可能很小；对力量有剂量反应但边际递减。" },
    ],
    verdictReason: "两项 meta 分析看似矛盾、实则互补：容量不匹配时更高频率有利（便于堆积总容量），容量严格相等时频率本身影响不大。因此「至少 2 次」是稳妥的实操建议，但不是不可违背的铁律。",
    advice: "新手每周练 2–3 次，每次覆盖全身主要肌群（推、拉、蹲各 1–2 个动作），比「一周只练一次胸」效果好。时间多再考虑上下肢分化，把每肌群频率提到每周 2 次。",
    appliesTo: ["每周能训练 2–4 次的新手"],
    notFor: ["每周只能练 1 次者（低频也有效，优先保证坚持）"],
    exerciseIds: ["goblet-squat", "barbell-bench-press", "lat-pulldown", "dumbbell-shoulder-press"],
  }),
  // ===================== 训练容量 =====================
  makeClaim({
    id: "training-volume-dose-response",
    topic: "training-volume",
    topicLabel: "训练容量",
    bvid: "BV14v4y1G7A3",
    quote: "训练计划，理论到实操【5x5】",
    statement: "每周训练组数（容量）与增肌效果存在剂量反应关系：容量越高收益越大，但边际递减。",
    claimType: "dosage",
    rationale: "简介中推荐「训练计划，理论到实操【5x5】」（5 组 5 次的经典容量安排），AI 拆解出其背后的容量—效果关系。",
    verdict: "supported",
    evidence: [
      { doi: "10.1007/s40279-025-02344-w", relation: "supports", strength: "high", note: "67 项研究、2058 人的 meta 回归：每周组数与肥大、力量的剂量反应后验概率达 100%，但最佳拟合模型显示边际递减，力量的递减更明显。" },
    ],
    verdictReason: "最新剂量反应 meta 分析直接支持「更多组数→更多增长，但收益递减」；具体「每周 10–20 组」的常用区间在库内无直接验证，属于产品建议。",
    advice: "新手每个肌群从每周 6–10 组开始（例如胸：卧推 3 组 + 俯卧撑 3 组，每周 2 次），适应 4–6 周后再慢慢加到 10–15 组。一次练 20 组不如分两次各 10 组。",
    appliesTo: ["恢复能力正常的规律训练者"],
    notFor: ["睡眠不足、恢复差的人群（先保恢复再加量）", "伤后恢复期（遵医嘱）"],
    exerciseIds: ["barbell-bench-press", "lat-pulldown", "goblet-squat"],
  }),
  // ===================== 力竭训练 =====================
  makeClaim({
    id: "training-failure-every-set",
    topic: "training-failure",
    topicLabel: "力竭训练",
    bvid: null,
    quote: null,
    missingReason: "素材不足：61 条视频的标题/简介中未找到直接讨论「力竭训练」的原文；未获取到逐字字幕（B站字幕接口需登录），无法确认视频内是否讲过。",
    statement: "每组都必须练到力竭（一次都做不动）才能增肌。",
    claimType: "dosage",
    rationale: "这是新手社区流传的常见说法，但素材库中未找到对应博主原话，作为待核验说法收录，不代表任何博主观点。",
    verdict: "insufficient",
    verdictReason: "素材不足：库内 36 篇文献中没有直接比较「力竭 vs 非力竭」的试验（Pelland 2026 检验的是组数与频率，而非力竭程度），无法裁决。需要人工补充力竭相关 RCT 后再审。",
    advice: "新手每组保留约 2–3 次余力（感觉还能再做 2–3 次就停），优先把动作做标准。每组都力竭会拖慢恢复、让动作变形，新手期得不偿失。",
    appliesTo: ["健身新手"],
    notFor: ["有心血管疾病者（极限用力需医生评估）", "动作尚未定型的新手（不应冲击极限）"],
    exerciseIds: ["dumbbell-curl", "push-up"],
  }),
  // ===================== 碳水循环 =====================
  makeClaim({
    id: "carb-cycling-superiority",
    topic: "carb-cycling",
    topicLabel: "碳水循环",
    bvid: "BV1Gh411479A",
    quote: "碳水循环的计算方法",
    statement: "碳水循环（高碳日与低碳日交替）比每天稳定摄入更能改善身体成分。",
    claimType: "diet",
    rationale: "原话简介列出碳水循环的「计算方法、实操方法、误区、优点」，AI 拆解出其隐含的效果主张——碳水循环是否更优。",
    verdict: "partial",
    evidence: [
      { doi: "10.1186/s12970-017-0174-y", relation: "partial", strength: "medium", note: "ISSN 声明第 7 条：间歇性热量限制与每日热量限制相比，在改善身体成分上无显著优势；第 3 条：减脂由持续热量缺口驱动。碳水循环若造成缺口则有效，但「循环」本身未见额外收益。" },
    ],
    verdictReason: "碳水循环可以是有效的依从性工具（高碳日贴合训练与社交），但库内证据不支持它比稳定缺口「更优」；关键仍是周总热量缺口与蛋白质达标。",
    advice: "可以用碳水循环：训练日碳水 3–4 g/kg，休息日 1.5–2 g/kg，蛋白质每天固定不变。把它当成「让饮食更好坚持」的安排，而不是燃脂魔法；周总热量不超标才有效。",
    appliesTo: ["训练日与休息日分明、能记录饮食的训练者"],
    notFor: ["饮食记录困难的新手（先用固定方案）", "有暴食倾向或进食障碍史者"],
  }),
  // ===================== 抗炎饮食 =====================
  makeClaim({
    id: "anti-inflammatory-diet-recovery",
    topic: "anti-inflammatory",
    topicLabel: "抗炎饮食",
    bvid: "BV1KJj4zVE2D",
    quote: "蹭饭七——抗氧化详解",
    statement: "抗氧化/抗炎饮食（多吃蔬果等富含抗氧化物的食物）能减轻训练后的炎症、加速恢复。",
    claimType: "diet",
    rationale: "原话主题为「抗氧化详解」，AI 拆解出「抗氧化饮食→训练恢复」的因果主张。注意抗氧化与抗炎是相关但不同的概念，原话标题只涉及抗氧化。",
    verdict: "insufficient",
    verdictReason: "素材不足：库内 36 篇文献中没有抗炎/抗氧化饮食的干预试验；膳食指南的蔬果条款支持一般健康，但不能验证「抗氧化→训练恢复加速」这条因果链。多吃蔬果本身是好建议，「加速恢复」的额外收益无法核验。",
    guidelineKeys: ["veg", "fruit"],
    advice: "每天蔬菜 300–500 g、水果 200–350 g，深色蔬菜占一半，优先从天然食物获取抗氧化物；不要把大剂量抗氧化补剂当恢复捷径。恢复的地基仍是睡眠、蛋白质和总热量。",
    appliesTo: ["所有健身人群（作为一般健康饮食）"],
    notFor: ["把抗氧化补剂替代正常饮食的人群"],
  }),
  // ===================== 主食选择与克数 =====================
  makeClaim({
    id: "staple-grain-grams",
    topic: "staple-choice",
    topicLabel: "主食选择与克数",
    bvid: "BV1kSsozkEEJ",
    quote: "碳水化合物详解",
    statement: "一般成人每日谷类主食 200–300 g（生重），其中全谷物和杂豆 50–150 g，另搭配薯类 50–100 g。",
    claimType: "diet",
    rationale: "原话为「碳水化合物详解」主题，碳水的主要膳食来源是主食，AI 拆解出主食的选择与量化问题，由膳食指南条款核验。",
    verdict: "supported",
    evidence: [],
    guidelineKeys: ["grain", "tuber"],
    verdictReason: "数值直接来自《中国居民膳食指南（2022）》的谷类与薯类条款，属于权威膳食建议；注意它面向一般成人，训练人群总碳水需求更高时，可在「粗细搭配」结构不变的前提下按目标克数上调。",
    advice: "每餐主食约 1 拳头（生重谷类 50–100 g），其中 1/3–1/2 换成糙米、燕麦、玉米、杂豆；每天再吃 50–100 g 红薯/土豆。增肌期碳水目标高时优先加主食量，而不是加油和糖。",
    appliesTo: ["一般健康成年人", "以主食为主要碳水来源的健身者"],
    notFor: ["麸质不耐受/乳糜泻者（全谷物选择需避开小麦）", "遵医嘱限制碳水的人群"],
  }),
  // ===================== 蔬菜摄入量与深色比例 =====================
  makeClaim({
    id: "vegetable-intake-dark-ratio",
    topic: "vegetable-intake",
    topicLabel: "蔬菜摄入与深色比例",
    bvid: "BV1V4mvBBEjU",
    quote: "全天饮食计划可以参考参考哈",
    statement: "每天应摄入至少 300 g 蔬菜（上限建议 500 g），其中深色蔬菜占一半以上。",
    claimType: "diet",
    rationale: "原话为全天饮食计划分享，AI 拆解出饮食计划中蔬菜部分的量化标准，由膳食指南条款核验。",
    verdict: "supported",
    evidence: [],
    guidelineKeys: ["veg"],
    verdictReason: "数值直接来自《中国居民膳食指南（2022）》蔬菜条款：≥300 g、深色蔬菜占 1/2 以上。指南同时建议上限约 500 g，避免蔬菜挤占其他食物类别。",
    advice: "午晚餐各吃 1.5–2 拳头蔬菜（全天 300–500 g），深色蔬菜（菠菜、西兰花、胡萝卜、紫甘蓝、番茄）占一半以上；土豆、莲藕淀粉多，算主食不算蔬菜份额。",
    appliesTo: ["所有健康成年人"],
    notFor: ["遵医嘱需限制膳食纤维的肠道疾病急性期患者"],
  }),
  // ===================== 肌酸 =====================
  makeClaim({
    id: "creatine-efficacy",
    topic: "creatine",
    topicLabel: "肌酸",
    bvid: "BV13CJuzCEF9",
    quote: "补剂系列①——肌酸",
    statement: "一水肌酸补充能提高高强度运动表现，并有助于增加抗阻训练带来的瘦体重。",
    claimType: "efficacy",
    rationale: "原话为「补剂系列①——肌酸」主题，AI 拆解出肌酸的核心效果主张：是否真的有用。",
    verdict: "supported",
    evidence: [
      { doi: "10.1186/s12970-017-0173-z", relation: "supports", strength: "high", note: "ISSN 肌酸立场声明：补充肌酸提高肌肉内肌酸储量，改善高强度运动表现并带来更大训练适应；还可能促进恢复、帮助承受大训练量。" },
      { doi: "10.1186/1550-2783-11-20", relation: "supports", strength: "medium", note: "Helms 备赛综述：一水肌酸是对备赛有有益证据的少数补剂之一。" },
    ],
    verdictReason: "ISSN 立场声明（被引 514）与循证备赛综述一致支持肌酸的有效性，是库内证据最充分的补剂。",
    advice: "选一水肌酸（creatine monohydrate），每天 3–5 g 随餐服用，无需冲击期，连续吃 3–4 周后肌肉储量逐渐饱和。多喝水。它不是药，效果是「训练表现略好」，不练就没用。",
    appliesTo: ["规律抗阻训练的健康成年人"],
    notFor: ["已有肾病者（先咨询医生）", "未成年人（建议优先饮食与训练）"],
    exerciseIds: ["barbell-back-squat", "barbell-bench-press"],
  }),
  makeClaim({
    id: "creatine-longterm-safety",
    topic: "creatine",
    topicLabel: "肌酸",
    bvid: "BV13CJuzCEF9",
    quote: "补剂系列①——肌酸",
    statement: "健康人群长期补充肌酸是安全的，不会损害肾功能。",
    claimType: "safety",
    rationale: "肌酸话题下新手最常见的顾虑是「伤肾/副作用」，从同一视频主题拆解为安全性问题单独核验。",
    verdict: "supported",
    evidence: [
      { doi: "10.1080/15502783.2025.2488937", relation: "supports", strength: "high", note: "685 项临床试验、12839 名肌酸组受试者的系统分析：副作用报告率与安慰剂无显著差异（13.7% vs 13.2%），包括肾功能指标在内的各项副作用均无显著差异。" },
      { doi: "10.1186/s12970-017-0173-z", relation: "supports", strength: "high", note: "ISSN 声明：短期与长期补充（最高 30 g/天、持续 5 年）在健康人群中安全且耐受良好。" },
    ],
    verdictReason: "2025 年大样本系统分析直接回应了社交媒体上的副作用传言，与 ISSN 声明一致；结论限于健康人群，肾病患者仍需医生评估。",
    advice: "健康人可以按 3–5 g/天长期吃，不需要「循环停药」。体检肌酐略升高先别慌，告诉医生你在吃肌酸。已有肾病或肾功能指标异常者，先问医生。",
    appliesTo: ["肾功能正常的健康成年人"],
    notFor: ["慢性肾病患者", "肾功能指标异常者"],
  }),
  // ===================== 乳清蛋白 =====================
  makeClaim({
    id: "whey-protein-necessity",
    topic: "whey-protein",
    topicLabel: "乳清蛋白",
    bvid: "BV1A4zjB7EcE",
    quote: "蛋白质摄入量详讲",
    statement: "乳清蛋白粉是增肌的必需品，且增肌效果优于其他蛋白质来源。",
    claimType: "efficacy",
    rationale: "该视频详讲蛋白质摄入，乳清蛋白是蛋白质补充的最常见形式；原话标题未直接出现「乳清」，本条为围绕蛋白质摄入主题拆解出的延伸问题，不代表博主断言过乳清必需。",
    verdict: "partial",
    evidence: [
      { doi: "10.1136/bjsports-2017-097608", relation: "partial", strength: "high", note: "Morton meta 支持的是「蛋白质补充」整体有效，检验的是总蛋白质摄入，不能推出「必须通过乳清」。" },
      { doi: "10.1186/1550-2783-4-8", relation: "partial", strength: "medium", note: "ISSN 2007 声明第 4、5 条：日常多样化饮食即可满足蛋白质需求，补剂只是便捷手段；一种蛋白质类型优于另一种尚未被有力证明。" },
      { doi: "10.3390/nu15153424", relation: "context", strength: "low", note: "乳清+抗阻在老年肌少症人群中有小效应（SMD 0.24），但研究人群是 60 岁以上肌少症患者，不能直接外推到健康新手。" },
    ],
    verdictReason: "「蛋白质吃够有效」证据充分，但「必须乳清」「乳清优于食物」缺乏证据：ISSN 明确指出蛋白类型间的优劣未被有力证明。乳清是便捷选项，不是必需品。",
    advice: "先算饮食：如果每天能吃到 1.6–2.2 g/kg 蛋白质（肉蛋奶豆），不用买蛋白粉。吃不够或图方便时，乳清蛋白是性价比高的补充方式，每次 20–40 g，当作「食物的替补」而不是「增肌神药」。",
    appliesTo: ["饮食蛋白质不足的规律训练者", "训练后不便进食正餐的人群"],
    notFor: ["乳糖不耐受严重者（选分离乳清或植物蛋白）", "牛奶蛋白过敏者", "肾病患者"],
  }),
  // ===================== 睡眠与恢复 =====================
  makeClaim({
    id: "sleep-recovery-body-composition",
    topic: "sleep-recovery",
    topicLabel: "睡眠与恢复",
    bvid: null,
    quote: null,
    missingReason: "素材不足：61 条视频的标题/简介中未找到睡眠主题的原文（「卧推系列⑦——睡眠」仅在简介中被提及，该视频未抓取）；未获取到逐字字幕。",
    statement: "睡眠不足会损害训练恢复与体成分（掉肌肉、影响减脂效率）。",
    claimType: "mechanism",
    rationale: "睡眠与恢复是新手常见关切，但素材库中无对应博主原话，作为待核验说法收录，不代表任何博主观点。",
    verdict: "insufficient",
    evidence: [
      { doi: "10.3390/nu16244255", relation: "context", strength: "low", note: "库内唯一睡眠相关文献：重度肥胖合并阻塞性睡眠呼吸暂停（OSA）患者的 12 个月减重干预 RCT。人群是患者而非健康训练者，干预是减重而非睡眠时长，不能直接验证本说法。" },
    ],
    verdictReason: "素材不足：库内没有健康人群「睡眠时长/质量→训练恢复」的直接试验，唯一的睡眠相关文献人群与干预都不匹配。睡眠重要是普遍健康共识，但在本素材库中无法给出有证据支撑的裁决，需人工补充睡眠限制/延长 RCT。",
    advice: "固定起床和入睡时间，争取每晚 7–9 小时睡眠（一般健康建议）。在本应用的睡眠页记录时长与质量，对照训练页的力量表现，观察自己的关联；连续熬夜后别安排大重量训练。",
    appliesTo: ["所有健身人群"],
    notFor: ["确诊睡眠呼吸暂停等睡眠疾病者（需就医，不只是「早点睡」）"],
  }),
  // ===================== 体态矫正 =====================
  makeClaim({
    id: "posture-round-shoulder-correction",
    topic: "posture-correction",
    topicLabel: "体态矫正",
    bvid: "BV1ie4y1W7iZ",
    quote: "肱骨前移和圆肩驼背的区别、成因及矫正训练方法",
    statement: "圆肩驼背、肱骨前移等上肢体态问题可以通过针对性矫正训练改善。",
    claimType: "technique",
    rationale: "原话明确说分享「区别、成因及矫正训练方法」，直接拆解为「矫正训练是否有效」的可核验主张。",
    verdict: "insufficient",
    verdictReason: "素材不足：库内 36 篇文献中没有体态矫正训练的对照试验，无法核验效果大小与适用边界。博主视频含自查讲解与跟练，属实践经验；「训练能改善体态」方向合理，但改善程度与多久见效在本库中无证据。",
    advice: "每天花 5–10 分钟：靠墙天使 2×10、门框胸肌拉伸每侧 30 秒×2、弹力带扩胸 2×15、面拉 2×15（轻重量）。坚持 8–12 周并每月拍侧面照对比；伴随疼痛、麻木时先看医生或物理治疗师，别硬练。",
    appliesTo: ["久坐办公、无疼痛性症状的圆肩驼背人群"],
    notFor: ["肩颈疼痛、手麻等神经症状者（先就医）", "脊柱结构性病变者（遵医嘱）"],
    exerciseIds: ["wall-slide", "doorway-chest-stretch", "band-pull-apart", "cable-face-pull", "scapular-push-up"],
  }),
  makeClaim({
    id: "posture-pelvic-tilt-screening",
    topic: "posture-correction",
    topicLabel: "体态矫正",
    bvid: "BV1nv4y177sQ",
    quote: "骨盆前倾的筛查与解决方法来了",
    statement: "骨盆前倾可以通过自我筛查识别，并通过训练与拉伸改善。",
    claimType: "technique",
    rationale: "原话明确说「骨盆前倾的筛查与解决方法」，拆解为「自我筛查+训练改善」的可核验主张。",
    verdict: "insufficient",
    verdictReason: "素材不足：库内无骨盆前倾筛查准确性或矫正效果的对照试验；自我筛查的可靠性、训练改善的幅度都无法核验。博主提供的是实践方法，裁决需人工补充康复医学文献。",
    advice: "先别急着给自己下诊断：很多人只是正常腰曲。可以每天练臀桥 3×12、死虫式 3×10（每侧）、髋屈肌拉伸每侧 30 秒×2，久坐每小时起身活动；腰痛明显或自测拿不准时，找物理治疗师评估。",
    appliesTo: ["久坐、无腰痛的疑似骨盆前倾人群"],
    notFor: ["腰痛急性期、腰椎间盘突出确诊者（先就医）", "孕期女性（骨盆变化属生理现象）"],
    exerciseIds: ["glute-bridge", "hip-flexor-stretch", "dead-bug", "cat-cow"],
  }),
  // ===================== 动作幅度 =====================
  makeClaim({
    id: "squat-range-of-motion",
    topic: "range-of-motion",
    topicLabel: "动作幅度",
    bvid: "BV1iQ4y1e7YL",
    quote: "能找到自己的错误，就可以提高动作效率，降低受伤风险",
    statement: "深蹲幅度越大越好，所有人都应该蹲到最低点。",
    claimType: "technique",
    rationale: "原话强调找错误以「提高动作效率，降低受伤风险」，AI 拆解出深蹲教学中的常见争议——幅度是否越大越好。原话未直接断言幅度，本条为延伸核验。",
    verdict: "insufficient",
    verdictReason: "素材不足：库内 36 篇文献中没有比较深蹲幅度（全幅度 vs 半幅度）效果与安全性的试验，无法裁决「越大越好」。幅度应受个体活动度与控制能力约束，这一边界在本库中同样无直接证据。",
    advice: "新手先用高脚杯深蹲学动作，每周 2–3 次、每次 3 组 8–12 次：在腰背中立、脚跟不离地、膝盖不内扣、无痛的前提下，蹲到尽可能低。蹲不到底不丢人，弓腰硬蹲才危险；踝关节活动度差可先每天练 2 分钟踝背屈拉伸。",
    appliesTo: ["学习深蹲的新手"],
    notFor: ["髋/膝/踝有伤病者（幅度遵医嘱）", "深蹲底部骨盆后倾无法控制者（先减幅度）"],
    exerciseIds: ["goblet-squat", "barbell-back-squat"],
  }),
  // ===================== 有氧与力量并行 =====================
  makeClaim({
    id: "concurrent-training-interference",
    topic: "concurrent-training",
    topicLabel: "有氧与力量并行",
    bvid: null,
    quote: null,
    missingReason: "素材不足：61 条视频的标题/简介中未找到直接讨论有氧与力量并行安排的原文；未获取到逐字字幕。",
    statement: "有氧运动会干扰增肌，增肌期不能做有氧。",
    claimType: "efficacy",
    rationale: "「有氧掉肌肉」是新手社区常见说法，但素材库中无对应博主原话，作为待核验说法收录，不代表任何博主观点。",
    verdict: "partial",
    evidence: [
      { doi: "10.1007/s40279-021-01587-7", relation: "refutes", strength: "high", note: "Schumann 2022 meta（43 项研究）：并行训练不损害肌肉肥大（SMD −0.01）与最大力量；仅爆发力小幅下降（−0.28），同一训练课内进行时更明显，间隔 3 小时以上可减弱。" },
      { doi: "10.1519/jsc.0b013e31823a3e2d", relation: "partial", strength: "medium", note: "Wilson 2012 meta（21 项研究）：与跑步（而非骑车）并行时肥大与力量出现显著干扰；干扰随有氧频率与时长增加而加大。" },
    ],
    verdictReason: "「有氧会掉肌肉、增肌不能做有氧」的强说法被 2022 年 meta 分析反驳（肥大不受损）；但 2012 年 meta 显示高频率、长时间的跑步类有氧确实可能干扰力量与肥大。结论取决于有氧的模式、剂量与安排，不能一概而论。",
    advice: "增肌期可以做有氧：每周 2–3 次、每次 20–30 分钟低强度（快走、骑车优先），与力量课分开上/下午或隔 6 小时以上。减脂期有氧可加量，但力量训练必须保留——它是保肌的关键。",
    appliesTo: ["增肌或减脂期、希望兼顾心肺健康的训练者"],
    notFor: ["以力量举/爆发力专项成绩为目标的运动员（需精细安排）", "恢复能力差、训练量已很大的人群"],
  }),
  // ===================== 添加糖与含糖饮料 =====================
  makeClaim({
    id: "sugar-sweetened-beverages",
    topic: "added-sugar",
    topicLabel: "添加糖与含糖饮料",
    bvid: "BV1cQ4y1d7J9",
    quote: "比烟瘾还可怕的糖瘾",
    statement: "含糖饮料不利于体重控制，用水或无糖饮料替代有助于减重。",
    claimType: "diet",
    rationale: "原话强调「糖瘾」对减脂饮食执行的破坏，AI 拆解出含糖饮料与体重的关系及替代策略。",
    verdict: "supported",
    evidence: [
      { doi: "10.1001/jamanetworkopen.2022.2092", relation: "supports", strength: "high", note: "JAMA 子刊 17 项 RCT 网络 meta：以无糖饮料替代含糖饮料与体重 −1.06 kg、BMI −0.32、体脂率 −0.60% 相关；用水替代同样有效。" },
    ],
    guidelineKeys: ["sugar"],
    verdictReason: "高质量 RCT 网络 meta 分析支持「替代含糖饮料→体重下降」；膳食指南同时建议添加糖每天 <50 g、最好 <25 g。证据与指南方向一致。",
    advice: "把奶茶、可乐、果汁换成水、无糖茶或黑咖啡；买包装食品看配料表，白砂糖/果葡糖浆排前三的少买。添加糖每天控制在 25 g 以内（约 6 茶匙），一瓶 500 ml 可乐就超了。",
    appliesTo: ["所有控体重人群"],
    notFor: ["1 型糖尿病等需快速补糖的特殊情况（低血糖时糖是急救品）"],
  }),
  // ===================== 新手神经适应 =====================
  makeClaim({
    id: "novice-neural-strength-gains",
    topic: "novice-adaptation",
    topicLabel: "新手神经适应",
    bvid: null,
    quote: null,
    missingReason: "素材不足：61 条视频的标题/简介中未找到直接讨论「新手早期力量增长机制」的原文；未获取到逐字字幕。",
    statement: "新手开始力量训练的头几周，力量快速增长主要来自神经适应（动作更熟练、肌肉募集更好），而非肌肉体积明显增大。",
    claimType: "mechanism",
    rationale: "新手期「力量猛涨但围度没变」是常见困惑，素材库中无对应博主原话，作为待核验的机制说法收录。",
    verdict: "partial",
    evidence: [
      { doi: "10.1519/jsc.0b013e318212de69", relation: "supports", strength: "medium", note: "Kidgell TMS 综述：短期力量训练后可观察到神经层面变化，支持快速力量增长存在神经机制。" },
      { doi: "10.1111/j.1748-1716.2011.02271.x", relation: "partial", strength: "medium", note: "Carroll 综述结论：神经适应的证据仍不一致、不完整；机制被广泛接受，但「早期增长中神经适应占多少」没有定量结论。" },
    ],
    verdictReason: "神经适应的存在有证据支持，但「早期力量增长主要来源于神经适应」的定量划分在库内文献中没有精确结论（Carroll 明确指出证据不完整），故裁决为部分支持而非完全支持。",
    advice: "新手前 8 周把重点放在学动作、每周小幅加重上；力量涨得快不代表肌肉长了这么多，别因此判断「饮食有效/无效」。看增肌效果用围度、体重趋势和对比照，而不是只看力量数字。",
    appliesTo: ["刚开始系统力量训练的新手"],
    notFor: ["停训多年后恢复训练者（机制类似但时间线不同）"],
    exerciseIds: ["goblet-squat", "push-up", "dumbbell-bench-press"],
  }),
  // ===================== 关节养护 =====================
  makeClaim({
    id: "joint-cracking-damage",
    topic: "joint-care",
    topicLabel: "关节养护",
    bvid: "BV1nX4y1z7hn",
    quote: "关节弹响，大家要重视哦",
    statement: "关节弹响意味着关节损伤，必须停止训练。",
    claimType: "safety",
    rationale: "原话提醒「关节弹响，大家要重视」，AI 拆解出新手最容易过度解读的版本——「弹响=损伤」，核验其是否成立。",
    verdict: "insufficient",
    verdictReason: "素材不足：库内 36 篇文献中没有关节弹响（生理性 vs 病理性）相关研究，无法核验「弹响=损伤」。原话「要重视」不等于「都是损伤」，二者之间的边界需要康复医学文献补充后人工审核。",
    advice: "无痛、无肿胀、不影响活动的弹响可以先观察并记录出现场景；伴随疼痛、肿胀、卡顿或无力时，停止相关动作并就医。训练前做 5–10 分钟动态热身，膝关节不适者从靠墙静蹲等低冲击动作开始。",
    appliesTo: ["训练中偶发关节弹响的人群"],
    notFor: ["弹响伴疼痛/肿胀/关节交锁者（立即就医，不适用本建议）"],
    exerciseIds: ["wall-sit", "glute-bridge"],
  }),
  // ===================== 拉伸放松 =====================
  makeClaim({
    id: "post-workout-stretch-dom-soreness",
    topic: "stretching",
    topicLabel: "拉伸放松",
    bvid: "BV1Eu41187oU",
    quote: "练后拉伸给大家安排上",
    statement: "练后静态拉伸能显著缓解延迟性肌肉酸痛（第二天酸痛）并预防受伤。",
    claimType: "efficacy",
    rationale: "原话安排「练后拉伸」跟练，AI 拆解出其隐含的效果主张——拉伸是否能消酸痛、防伤。",
    verdict: "insufficient",
    verdictReason: "素材不足：库内 36 篇文献中没有拉伸与酸痛缓解/损伤预防的直接试验，无法裁决效果大小。拉伸作为放松手段可以做，但「显著消酸痛、防伤」在本库中无证据支撑。",
    advice: "练后可以花 5–10 分钟做静态拉伸当放松（每个部位 20–30 秒、不弹震），但别指望它消除酸痛；酸痛明显时优先保证睡眠和蛋白质。训练前用动态热身（开合跳、徒手深蹲、肩环绕）而不是长时间静态拉伸。",
    appliesTo: ["所有健身人群（作为放松手段）"],
    notFor: ["急性肌肉拉伤期（拉伸需遵医嘱）"],
    exerciseIds: ["cat-cow", "hip-flexor-stretch", "doorway-chest-stretch"],
  }),
  // ===================== 抖音来源：谭成义（以下 14 条） =====================
  // layer1.quote 均为 title/desc 逐字连续子串；章节摘要为平台AI生成，只进 layer2.rationale 并带标注前缀。
  makeClaim({
    id: "douyin-fatloss-carb-plan",
    topic: "carb-multiplier",
    topicLabel: "碳水倍数",
    bvid: null,
    awemeId: "7618962209967965617",
    quote: "吃多少？吃什么？如何调整？",
    statement: "减脂期三大营养素应按运动量与体重计算摄入量，并根据体重记录和形体对比动态调整碳水。",
    claimType: "dosage",
    rationale: "依据抖音平台AI章节摘要（非博主逐字原话）：01:28「减脂计划的基础」——介绍了身体的三大营养元素，根据运动量和体重计算出碳水、蛋白质和脂肪的摄入量；06:03「饮食计划的调整」——通过记录体重变化和对比图，调整碳水摄入量。博主标题只承诺教「吃多少、吃什么、如何调整」，未给出任何具体克数。",
    verdict: "partial",
    evidence: [
      { doi: "10.1186/s12970-017-0174-y", relation: "context", strength: "medium", note: "ISSN 声明：减脂由持续热量缺口驱动，饮食方案需个体化并考虑依从性；未给出按体重倍数计算碳水的具体公式。" },
      { doi: "10.1186/1550-2783-11-20", relation: "partial", strength: "medium", note: "Helms 备赛综述：蛋白质与脂肪设定后剩余热量由碳水提供——碳水是分配结果，支持「先定蛋白脂肪、碳水填余量」的思路，但未检验视频中的具体计算流程。" },
    ],
    verdictReason: "「按体重与活动量计算、按反馈调整」与文献的个体化原则方向一致；但库内 36 篇文献没有直接检验该计算流程的试验，具体倍数未被验证。平台章节摘要不含任何数字，不能据此写出克数。",
    advice: "产品按 calc.ts 的 macroTargets 公式计算（非博主给出的数字）：减脂期热量 ≈ TDEE×0.8，蛋白质 2.2 g/kg，脂肪取 0.7 g/kg 与 22% 热量中的较大值，碳水填满剩余热量（约 2–3.5 g/kg，随体重与活动量变化）。在饮食页记录后，对照每周体重趋势微调碳水。",
    appliesTo: ["配合抗阻训练的减脂人群", "能规律记录饮食与体重者"],
    notFor: ["BMI < 18.5 的偏瘦人群", "孕期/哺乳期女性", "有进食障碍史者"],
  }),
  makeClaim({
    id: "douyin-fatloss-food-exchange",
    topic: "staple-choice",
    topicLabel: "主食选择与克数",
    bvid: null,
    awemeId: "7618962209967965617",
    quote: "非常完整的减脂计划视频，教会你了解食物",
    statement: "减脂饮食应建立在了解食物成分与均衡饮食结构上，主食、蔬菜、蛋白质食物合理搭配。",
    claimType: "diet",
    rationale: "依据抖音平台AI章节摘要（非博主逐字原话）：07:49「饮食结构的介绍」——包括早餐、午餐和晚餐的食物选择，强调营养均衡；12:19「饮食计划的换算」——以85公斤为例列出燕麦、鸡蛋、蓝莓、米饭、肉类、蔬菜、红薯、紫薯、土豆、贝贝南瓜、坚果等食物。注意：该章节摘要只列食物种类，没有给出任何具体克数，本库不据此编造克数。",
    verdict: "partial",
    evidence: [
      { doi: "10.1186/s12970-017-0174-y", relation: "context", strength: "low", note: "ISSN 声明：多种饮食方式可同样有效，长期成功取决于依从性；未给出具体食物克数，无法核验视频中的换算表。" },
    ],
    guidelineKeys: ["grain", "veg", "animal"],
    verdictReason: "「了解食物、均衡搭配」与膳食指南及 ISSN 的饮食结构原则方向一致；但视频中的具体食物换算数值未获取（章节摘要不含克数，逐字字幕需登录），无法核验，故判部分支持。本条给出的克数全部来自膳食指南与产品公式，不是博主数字。",
    advice: "克数依据《中国居民膳食指南（2022）》与产品公式（非博主数字）：每天谷类 200–300 g（全谷物和杂豆 50–150 g）、蔬菜 ≥300 g（深色占一半）、鱼禽蛋瘦肉 120–200 g；减脂期在此基础上按 macroTargets 的碳水目标微调主食量，优先用红薯、土豆、杂豆替换部分精米白面。",
    appliesTo: ["以减脂为目标的健康成年人"],
    notFor: ["麸质不耐受/乳糜泻者（全谷物选择需避开小麦）", "遵医嘱限制特定食物的人群"],
  }),
  makeClaim({
    id: "douyin-recomp-balance",
    topic: "recomp-balance",
    topicLabel: "增肌减脂平衡",
    bvid: null,
    awemeId: "7699679326988050873",
    quote: "围绕训练状态和训练强度的提升才是最重要的",
    statement: "增肌减脂能否同时进行，关键在保持训练状态与强度提升；训练水平提高后，热量平衡或略盈余也能减脂。",
    claimType: "efficacy",
    rationale: "依据抖音平台AI章节摘要（非博主逐字原话）：01:17「增肌与减脂的逻辑」——增肌关键是训练强度，减脂是保证缺口，训练水平提高后，即使热量平衡或稍多，也能达到减脂效果；10:55「训练状态与饮食」——训练状态与饮食适量有关，多了少了都不好，要根据训练状态调节减脂。",
    verdict: "partial",
    evidence: [
      { doi: "10.1186/s12970-017-0174-y", relation: "partial", strength: "medium", note: "ISSN 声明第 3、4 条：减脂由持续缺口驱动、增肌由持续盈余驱动；「热量平衡或稍多也能减脂」与该原则存在张力，仅在新手/高体脂等身体重塑情形下成立。" },
      { doi: "10.1007/s40279-025-02344-w", relation: "context", strength: "medium", note: "Pelland 2026 meta 回归：组数与频率对力量增长有剂量反应——支持「训练强度/水平提升」是进步的核心驱动，但未检验增肌减脂同步的可行性。" },
    ],
    verdictReason: "「以训练状态和强度为核心」与剂量反应证据一致；但「热量平衡或稍多也能减脂」只对特定人群（新手、体脂较高、停训恢复者）成立，长期增肌仍需盈余、减脂仍需缺口。对训练水平较高者同时最大化两者不现实，故判部分支持。",
    advice: "新手或体脂偏高者：热量设在 TDEE 附近（产品 macroTargets 重塑档，非博主数字），蛋白质 2.0 g/kg，每周 2–3 次力量训练并记录重量×次数，力量持续上涨就说明方向对。训练 1 年以上、体脂已较低者：增肌与减脂分阶段做，别指望同时最大化。",
    appliesTo: ["训练新手", "体脂偏高或停训恢复的训练者"],
    notFor: ["体脂已较低的高级训练者（增肌减脂需分阶段）", "以比赛台型为目标的备赛选手"],
    exerciseIds: ["barbell-bench-press", "goblet-squat", "lat-pulldown"],
  }),
  makeClaim({
    id: "douyin-rest-day-carb",
    topic: "carb-multiplier",
    topicLabel: "碳水倍数",
    bvid: null,
    awemeId: "7586889620748225841",
    quote: "休息日饮食和疲劳管理的方法",
    statement: "休息日可根据饥饿程度下调碳水与脂肪摄入，并刻意安排休息以促进恢复。",
    claimType: "diet",
    rationale: "来源：抖音合集「训练，营养，体态和恢复教学合集」第25集。依据抖音平台AI章节摘要（非博主逐字原话）：00:08「饮食安排」——休息日根据饥饿程度调整碳水摄入量，减少脂肪摄入；22:26「休息日的重要性」——要刻意安排，做自己喜欢的事情。摘要未给出任何具体克数。",
    verdict: "partial",
    evidence: [
      { doi: "10.1186/s12970-017-0174-y", relation: "context", strength: "low", note: "ISSN 声明：饮食的长期成功取决于依从性，增肌饮食需支持递增的训练需求；未直接检验「休息日降碳」或「按饥饿感调整」的做法。" },
    ],
    verdictReason: "「休息日略降摄入、刻意安排恢复」与个体化、依从性原则方向一致，但库内没有直接检验「按饥饿感调碳水」的试验；饥饿感是主观信号，不能作为精确计量。证据强度低，判部分支持。",
    advice: "产品建议（非博主数字）：休息日可比训练日少吃约 100–200 kcal，主要减主食和烹调油，蛋白质保持不变（按 macroTargets 的 1.8–2.2 g/kg）。别用「今天没练」当暴食借口，也别饿一整天——休息日的目标是让下次训练表现更好。",
    appliesTo: ["训练日与休息日分明的规律训练者"],
    notFor: ["有暴食倾向或进食障碍史者（按饥饿感调节可能放大风险）", "无法规律记录饮食的新手（先用固定方案）"],
  }),
  makeClaim({
    id: "douyin-split-synergist",
    topic: "training-split",
    topicLabel: "训练分化与搭配",
    bvid: null,
    awemeId: "7700836420282731898",
    quote: "力量训练如何安排计划，以及侧重点",
    statement: "训练分化应按动作模式与协同肌群搭配（如胸带三头、背带二头），并根据个人情况调整，不必迷信固定分化。",
    claimType: "technique",
    rationale: "依据抖音平台AI章节摘要（非博主逐字原话）：00:30「胸部训练」——以推类动作为主，胸带三头属于相对协同状态，胸带二头训练强度更大；05:37「背部训练」——背加二头容量更高，背加三头强度更大；13:13「训练计划的安排」——需根据个人情况调整，关注训练质量，无需过分纠结训练分化。",
    verdict: "partial",
    evidence: [
      { doi: "10.1080/02640414.2018.1555906", relation: "partial", strength: "high", note: "Schoenfeld 2019 meta（25 项研究）：每周总容量相等时频率/分化差异不显著，可按个人偏好选择——支持「不必过分纠结分化」。" },
      { doi: "10.1007/s40279-025-02344-w", relation: "context", strength: "medium", note: "Pelland 2026：区分直接/间接组数对预测适应很重要——协同肌群确实贡献训练容量，但未比较「胸带三头 vs 胸带二头」等具体配对的优劣。" },
    ],
    verdictReason: "「不必过分纠结分化、按个人情况调整」有 meta 分析支持；但「胸带三头 vs 胸带二头哪个强度更大」这类具体搭配优劣在库内无对照试验，间接组数折算只说明协同肌群贡献容量，不能裁决具体配对。",
    advice: "新手每周 2–3 次全身训练即可；进阶到每周 4 次时用「推/拉/腿」或「胸+三头、背+二头、腿+肩」分化，复合动作放前面、协同小肌群放后面。每个肌群每周总量 6–15 组（产品建议区间），分化只是把容量装进日程的容器。",
    appliesTo: ["每周能训练 3–5 次的进阶新手"],
    notFor: ["每周只能练 1–2 次者（全身训练优先，分化意义不大）"],
    exerciseIds: ["barbell-bench-press", "triceps-pushdown", "lat-pulldown", "dumbbell-curl"],
  }),
  makeClaim({
    id: "douyin-load-reps-progression",
    topic: "load-equipment",
    topicLabel: "重量与器械选择",
    bvid: null,
    awemeId: "7684636286796509105",
    quote: "大重量少次数和小重量多次数的选择",
    statement: "大重量少次数与小重量多次数是进退阶关系，目的都是增肌并保持肌肉质量。",
    claimType: "technique",
    rationale: "依据抖音平台AI章节摘要（非博主逐字原话）：00:16「重量的问题」——大重量少次数和小重量多次数是进退阶关系，目的是增肌并保持优秀的肌肉质量；07:30「动作姿势的选择」——与重量挂钩，新手应从简单姿势开始，逐步提高目标肌肉能力。",
    verdict: "insufficient",
    evidence: [
      { doi: "10.1007/s40279-025-02344-w", relation: "context", strength: "low", note: "Pelland 2026 检验的是每周组数与频率的剂量反应，不是负荷区间（大重量低次数 vs 小重量高次数）的比较，不能裁决本说法。" },
    ],
    verdictReason: "素材不足：库内 36 篇文献中没有直接比较大重量低次数 vs 小重量高次数肥大效果的试验，无法裁决「进退阶关系」是否成立。该问题在更广文献中有讨论，但本库未收录，需人工补充负荷区间相关 meta 分析后再审。",
    advice: "产品保守建议（非文献裁决）：新手先用能标准完成 8–12 次的重量，离力竭留 2–3 次余力；动作稳定后再逐渐加到 6–8 次的较大重量。重量是工具不是目的，动作变形就减重。",
    appliesTo: ["动作模式已稳定的新手到中级训练者"],
    notFor: ["动作尚未定型的新手（不应冲击大重量）", "有心血管疾病者（极限用力需医生评估）"],
    exerciseIds: ["goblet-squat", "dumbbell-bench-press", "lat-pulldown"],
  }),
  makeClaim({
    id: "douyin-machine-vs-freeweight",
    topic: "load-equipment",
    topicLabel: "重量与器械选择",
    bvid: null,
    awemeId: "7684636286796509105",
    quote: "训练重量的取舍，动作姿势的选择，固定器械的安排",
    statement: "固定器械目标肌肉受力更好、损耗小，但可能引起关节不适；自由重量更符合人体自然状态。",
    claimType: "technique",
    rationale: "依据抖音平台AI章节摘要（非博主逐字原话）：05:36「固定器械与自由训练」——固定器械损耗小，目标肌肉受力更好，但可能导致关节不适；自由训练更简单，更符合人体状态。",
    verdict: "insufficient",
    verdictReason: "素材不足：库内 36 篇文献中没有固定器械 vs 自由重量的肥大/安全性对照试验，无法核验「受力更好」「关节不适」的方向与幅度。器械轨迹是否适合个体关节结构属于实践经验，需人工补充生物力学与对照研究后再审。",
    advice: "新手两者都可以用：先用固定器械（腿举、坐姿推胸类）找目标肌肉感觉，每个动作 2–3 组、8–12 次；再学自由重量（哑铃卧推、高脚杯深蹲）练稳定。任何器械做着关节疼就换动作或调座椅，别硬扛——疼痛是信号不是勋章。",
    appliesTo: ["健身房训练的新手"],
    notFor: ["已有明确关节伤病者（器械选择遵医嘱）"],
    exerciseIds: ["leg-press", "leg-extension", "barbell-bench-press", "dumbbell-bench-press"],
  }),
  makeClaim({
    id: "douyin-back-goal-oriented",
    topic: "range-of-motion",
    topicLabel: "动作幅度",
    bvid: null,
    awemeId: "7582048702325181745",
    quote: "背部训练需要明确训练目标，审视自己的形体哪里薄弱就多去加强哪里",
    statement: "背部训练应以形体薄弱环节为导向选择动作，而非盲目追求重量与动作幅度。",
    claimType: "technique",
    rationale: "博主标题明确说「明确训练目标…哪里薄弱就多去加强哪里」；依据抖音平台AI章节摘要（非博主逐字原话）：24:05「训练建议」——不要局限于动作，要关注训练方向和目标；平台整体摘要另提到「不要过分追求重量和幅度，注重动作标准和肌肉收缩」（同为平台AI摘要，非原话）。",
    verdict: "insufficient",
    verdictReason: "素材不足：库内没有检验「以薄弱环节为导向安排训练」或「背部训练中重量/幅度取舍」的对照试验。「弱项优先」与训练特异性原则方向一致，但效果大小与具体安排在本库中无证据，需人工补充后再审。",
    advice: "每 4–6 周拍一次背面照：背阔肌宽度不够就优先高位下拉类动作，厚度不够就优先划船类动作；每次背部训练 4–6 个动作、总量 10–15 组（产品建议）。重量加到动作变形就是过头了。",
    appliesTo: ["有一定训练基础、希望改善背部形体的训练者"],
    notFor: ["动作模式尚未建立的新手（先全面学动作，再谈弱项优先）"],
    exerciseIds: ["lat-pulldown", "seated-cable-row"],
  }),
  makeClaim({
    id: "douyin-lat-scapular",
    topic: "exercise-technique",
    topicLabel: "动作技巧",
    bvid: null,
    awemeId: "7696330468475857893",
    quote: "背部感受差怎么调整 具体动作以及训练思路调整",
    statement: "背阔肌训练感受差主要源于肩胛骨下沉与内收能力不足，可通过强化下锯肌、背阔肌与中下斜方肌改善。",
    claimType: "mechanism",
    rationale: "依据抖音平台AI章节摘要（非博主逐字原话）：00:00「背部训练逻辑」——背阔肌感受不好的原因是肩胛骨下沉和内收能力不够，需要提高下锯肌、背阔肌和中下斜方肌的力量；00:47「高位下拉」——强调肩胛骨下沉和内收，多次数中等重量，可作为日常基本功训练。",
    verdict: "insufficient",
    verdictReason: "素材不足：库内没有检验「肩胛控制能力→背阔肌激活/训练感受」的肌电或对照试验，因果归因与改善幅度均无法核验。肩胛下沉内收是常见教学提示，方向合理，但「感受差的主要原因」这一归因需要肌电/生物力学证据，本库未收录。",
    advice: "练背前先做 2 组肩胛激活：弹力带扩胸 2×15、肩胛俯卧撑 2×10；高位下拉用中等重量做 12–15 次，先沉肩再拉肘，把注意力放在「肘往裤兜方向走」。感受是主观信号，可作参考，别当成肌肉增长的唯一判据。",
    appliesTo: ["练背时找不到背部发力的训练者"],
    notFor: ["肩颈疼痛或肩袖损伤者（先就医评估）"],
    exerciseIds: ["lat-pulldown", "scapular-push-up", "band-pull-apart"],
  }),
  makeClaim({
    id: "douyin-shoulder-discomfort",
    topic: "joint-care",
    topicLabel: "关节养护",
    bvid: null,
    awemeId: "7694102180848707505",
    quote: "卧推，下拉，推肩动作中肩部不适如何改善",
    statement: "卧推、下拉、推肩时的肩部不适可通过前锯肌/冈上肌激活、肩胛后缩热身与握距调整改善。",
    claimType: "technique",
    rationale: "依据抖音平台AI章节摘要（非博主逐字原话）：00:20「拉类动作」——支撑位内旋和前锯肌训练；04:49「推肩」——前锯肌和冈上肌激活，也可尝试窄握推；07:07「推类动作」——二头肌放松和三头肌激活；11:06「预防措施」——提前激活肩胛后缩和外展，多做热身。",
    verdict: "insufficient",
    verdictReason: "素材不足：库内 36 篇文献中没有肩部不适的激活/热身干预对照试验，无法核验这些具体方案的有效性与安全性。肩部不适成因复杂（肩袖、撞击、关节不稳等），视频方案不能替代专业评估；需人工补充康复医学文献，且此类内容必须经专业人员审核。",
    advice: "训练中肩部出现刺痛、卡顿或夜间痛，先停该动作并就医/找物理治疗师，不要靠「激活」硬顶。无痛前提下的产品保守建议：推类训练前做肩胛俯卧撑 2×10、弹力带扩胸 2×15、面拉 2×15 热身；卧推不适可试窄握或哑铃对握。",
    appliesTo: ["训练中偶发肩部不适、无明确损伤诊断的人群"],
    notFor: ["肩袖损伤、肩峰撞击确诊者", "疼痛持续或夜间痛者（先就医，不适用本建议）"],
    exerciseIds: ["barbell-bench-press", "lat-pulldown", "dumbbell-shoulder-press", "scapular-push-up", "cable-face-pull"],
  }),
  makeClaim({
    id: "douyin-neutral-grip-incline",
    topic: "exercise-technique",
    topicLabel: "动作技巧",
    bvid: null,
    awemeId: "7686888075494347697",
    quote: "对卧上斜推胸动作详细做法，以及为何要去做对握的原因和逻辑",
    statement: "上斜推胸采用对握（掌心相对）比正握更能降低肩部压力、收紧上胸内侧。",
    claimType: "technique",
    rationale: "博主标题原文为「对卧上斜推胸」（保留原字，未改写）；依据抖音平台AI章节摘要（非博主逐字原话）：01:19「对握的好处」——对握降低肩膀压力，收紧上胸内侧；02:44「上斜推胸动作示范」——凳子角度45度，保持目标肌肉收紧；06:13「对握与正手的区别」——对握更易收紧上胸，保持肌张力平衡。45度凳角等细节仅来自平台AI摘要，非博主逐字原话。",
    verdict: "insufficient",
    verdictReason: "素材不足：库内没有比较对握 vs 正握上斜推胸的肌电/肥大/关节负荷试验，「降肩压、收上胸内侧」无法核验。握距与角度调整属常见实践经验，个体差异大，需人工补充生物力学证据后再审。",
    advice: "上斜哑铃推胸可以两种握法都试：凳子 30–45 度，对握（掌心相对）时肘略内收，选肩部更舒服、胸部感觉更好的那种；每次 3 组 8–12 次（产品建议）。没有任何握法适合所有人，关节疼痛就换。",
    appliesTo: ["有哑铃与可调凳的训练者", "正握推胸肩部不适的人群"],
    notFor: ["肩袖损伤急性期（先就医）", "无训练基础者（先学平板哑铃卧推）"],
    exerciseIds: ["incline-dumbbell-press"],
  }),
  makeClaim({
    id: "douyin-single-arm-pulldown",
    topic: "exercise-technique",
    topicLabel: "动作技巧",
    bvid: null,
    awemeId: "7703372555957598650",
    quote: "器械系列之单手下拉动作讲解，平替动作安排",
    statement: "单手下拉可通过调整手位、肘角与躯干姿态更好刺激背阔肌，绳索可作为器械的平替但行程较短。",
    claimType: "technique",
    rationale: "依据抖音平台AI章节摘要（非博主逐字原话）：00:39「动作讲解」——手的位置、握法、手肘角度、呼吸节奏；07:06「呼吸节奏」——放的时候吸气，拉的时候呼气；10:41「绳索替代」——绳索可以替代器械，但行程较短，对躯干要求更高；15:18「总结」——行程变化影响刺激部位。",
    verdict: "insufficient",
    verdictReason: "素材不足：库内没有单臂下拉的肌电/对照试验，「行程变化影响刺激部位」「绳索平替等效性」均无法核验。单侧训练对躯干抗侧屈要求更高是合理推断，但具体刺激差异需肌电证据，本库未收录。",
    advice: "单臂下拉用中等重量做 3 组 10–15 次/侧（产品建议）：坐姿稳定、先沉肩，肘往同侧髋部拉，放回时吸气、拉时呼气。没有单臂器械时用龙门架绳索跪姿替代，重量减半起步，躯干别晃。",
    appliesTo: ["想改善背部两侧均衡的训练者", "有龙门架或单臂下拉器械的人群"],
    notFor: ["核心控制差的新手（先练双手版本）", "腰椎伤病者（抗侧屈负荷需评估）"],
    exerciseIds: ["lat-pulldown"],
  }),
  makeClaim({
    id: "douyin-lower-functional",
    topic: "joint-care",
    topicLabel: "关节养护",
    bvid: null,
    awemeId: "7688311849762979057",
    quote: "关节不适的逻辑，动作的详细讲解，力量训练中呼吸的关键",
    statement: "下肢功能训练（关节活动度、身体位置感受与呼吸配合）能改善关节不适并提升下肢肌力。",
    claimType: "efficacy",
    rationale: "依据抖音平台AI章节摘要（非博主逐字原话）：01:11「热身」——青蛙趴、支撑青蛙趴、单腿支撑旋转、单腿臀推、弓步蹲推肩、罗马尼亚硬拉、交替弓步蹲、高位下拉；平台整体摘要称训练旨在提高关节能力、身体感觉、心肺功能和爆发力，适合关节不适人群（同为平台AI摘要，非原话）。",
    verdict: "insufficient",
    verdictReason: "素材不足：库内没有「功能性训练改善关节不适」的对照试验；关节不适成因多样，一套通用动作流程的有效性与安全性无法核验。此类内容涉及伤病人群，必须人工补充康复文献并由专业人员审核。",
    advice: "关节不适先就医明确原因，别照视频自诊。无痛前提下的产品保守起步：臀桥 3×12、罗马尼亚硬拉轻重量 3×10、交替弓步蹲 3×8/侧，每周 2 次；动作中保持躯干稳定、用力时呼气。任何动作引发疼痛就停止。",
    appliesTo: ["无明确损伤诊断、想改善下肢功能的人群"],
    notFor: ["膝/髋/踝急性损伤期", "关节疼痛持续或肿胀者（先就医）"],
    exerciseIds: ["romanian-deadlift", "dumbbell-lunge", "glute-bridge"],
  }),
  makeClaim({
    id: "douyin-upper-functional",
    topic: "exercise-technique",
    topicLabel: "动作技巧",
    bvid: null,
    awemeId: "7690225219625580977",
    quote: "脊柱的旋转，抗旋转，心肺，肩胛的运动",
    statement: "上肢功能性训练（多平面运动、脊柱抗旋转、肩胛控制结合心肺间歇）能同时提升关节功能与心肺能力。",
    claimType: "efficacy",
    rationale: "依据抖音平台AI章节摘要（非博主逐字原话）：02:07「正式动作」——身体旋转、坐姿划船、哑铃卧推、支撑后滑、站姿实力推，共14组；15:53「二头和三头超级组」——坐姿绳索弯曲和三头下压，共3组；18:14「间歇跑」——共4个循环。",
    verdict: "partial",
    evidence: [
      { doi: "10.1007/s40279-021-01587-7", relation: "partial", strength: "high", note: "Schumann 2022 meta（43 项研究）：力量与心肺并行不损害肥大与最大力量——支持「同练可行」；但同课并行对爆发力有小幅干扰，且未检验「多平面功能训练更优」。" },
    ],
    verdictReason: "「力量与心肺可以同练且不掉肌肉」有 2022 年 meta 分析支持；但「多平面/抗旋转功能训练优于传统力量训练」在库内无对照试验，且该 meta 提示同课并行对爆发力有小幅干扰。功能训练可作为补充，不能据此宣称优于常规训练。",
    advice: "每周 1–2 次把功能训练当补充：鸟狗式 3×8/侧、弹力带扩胸 2×15 穿插在力量动作之间，收尾做 10–15 分钟间歇（快走/慢跑交替）。主项仍是推、拉、蹲的渐进超负荷，别用「功能性」替代基础力量。",
    appliesTo: ["想兼顾心肺与关节功能的训练者"],
    notFor: ["以最大力量/爆发力为专项目标的运动员（同课并行需精细安排）", "腰椎伤病者（旋转负荷需评估）"],
    exerciseIds: ["seated-cable-row", "dumbbell-bench-press", "barbell-overhead-press", "bird-dog", "band-pull-apart"],
  }),
  // ===================== 抖音来源·第三轮扩充（以下 14 条，合集素材为主） =====================
  makeClaim({
    id: "douyin-creatine-dose",
    topic: "creatine",
    topicLabel: "肌酸",
    bvid: null,
    awemeId: "7604123900088481009",
    quote: "肌酸的作用？用量？以及啥时候吃更适合",
    statement: "肌酸每天补充 3–5 克、与碳水一起吃利用率更高，减脂期也应持续补充。",
    claimType: "dosage",
    rationale: "来源：抖音合集「补剂系列」第1集。依据抖音平台AI章节摘要（非博主逐字原话）：00:10「用量」——每天3-5克，与碳水一起吃，利用率更高；01:18「减脂是否需要吃」——减脂也需要吃，每天3-5克，长效补充，促进糖原合成和储存；01:12「作用」——提高运动表现、耐力和力量。剂量数字来自平台AI摘要转述，非博主逐字原话。",
    verdict: "partial",
    evidence: [
      { doi: "10.1186/s12970-017-0173-z", relation: "partial", strength: "high", note: "ISSN 肌酸立场声明：提高肌肉肌酸储量、改善高强度运动表现与训练适应；提到每日约 3 g 的习惯性摄入有益——与 3–5 g/天方向一致，但摘要未直接验证「与碳水同吃提高利用率」「减脂期促进糖原合成储存」两条具体机制。" },
      { doi: "10.1080/15502783.2025.2488937", relation: "context", strength: "medium", note: "685 项试验系统分析：肌酸组副作用报告率与安慰剂无显著差异，支持长期每天补充的安全性前提。" },
    ],
    verdictReason: "肌酸有效性与长期安全性证据充分，3–5 g/天与 ISSN 提到的约 3 g/天习惯摄入方向一致；但「与碳水同吃利用率更高」「减脂期促进糖原合成」在库内摘要中无直接验证，故判部分支持而非完全支持。",
    advice: "产品建议：每天 3–5 g 一水肌酸随餐服用（与 ISSN 声明的每日约 3 g 习惯摄入方向一致），训练日休息日都吃，减脂期不用停，多喝水。随含碳水的一餐吃即可，不必为此额外喝含糖饮料。",
    appliesTo: ["规律抗阻训练的健康成年人", "减脂期希望保留训练表现的人群"],
    notFor: ["已有肾病者（先咨询医生）", "未成年人（优先饮食与训练）"],
    exerciseIds: ["barbell-bench-press", "barbell-back-squat"],
  }),
  makeClaim({
    id: "douyin-rest-interval",
    topic: "rest-interval",
    topicLabel: "组间休息",
    bvid: null,
    awemeId: "7640030849136819377",
    quote: "增肌力量训练的组数安排，组间休息的时长参考",
    statement: "增肌力量训练组间应休息约 3–5 分钟以恢复 ATP（ATP 主要供能 6–10 秒），单次训练推荐 80–90 分钟。",
    claimType: "dosage",
    rationale: "来源：抖音合集「补剂系列」第5集。依据抖音平台AI章节摘要（非博主逐字原话）：00:26「ATP系统」——提高磷酸肌酸储备有助于更快合成ATP，ATP主要供能时间在6-10秒，恢复时间约3-5分钟，推荐训练时间80-90分钟。时间参数来自平台AI摘要转述，非博主逐字原话。",
    verdict: "insufficient",
    evidence: [
      { doi: "10.1007/s40279-025-02344-w", relation: "context", strength: "low", note: "Pelland 2026 检验的是每周组数与频率的剂量反应，不是组间休息时长，不能裁决「3–5 分钟」是否最优。" },
    ],
    verdictReason: "素材不足：库内 36 篇文献中没有组间休息时长的对照试验（短休息 vs 长休息对肥大/力量的影响），ATP-PCr 供能时间参数属教科书生理知识但本库未收录验证。「80–90 分钟训练时长」同样无直接证据。需人工补充组间休息相关 meta 分析后再审。",
    advice: "产品保守建议（非文献裁决）：卧推、深蹲等复合动作组间休 2–3 分钟，孤立动作 60–90 秒；单次训练控制在 60–90 分钟，优先保证每组质量而不是熬时长。",
    appliesTo: ["以增肌/力量为目标的规律训练者"],
    notFor: ["以代谢压力/减脂为目标的循环训练者（休息策略不同）"],
    exerciseIds: ["barbell-bench-press", "barbell-back-squat"],
  }),
  makeClaim({
    id: "douyin-ab-frequency",
    topic: "training-frequency",
    topicLabel: "训练频率",
    bvid: null,
    awemeId: "7554608696765697340",
    quote: "最推荐的两个腹肌动作",
    statement: "腹肌需要一周练 4–5 次、刻意多练才能明显。",
    claimType: "dosage",
    rationale: "来源：抖音合集「训练，营养，体态和恢复教学合集」第4集。依据抖音平台AI章节摘要（非博主逐字原话）：00:00「引言」——腹肌训练重要，需刻意练习，一周4-5次，多练可使腹肌明显；01:08「拉伸」——训练前做海豹式拉伸，连续四组，每组20秒；03:26「悬垂举腿」与04:30「反向山羊挺身」为两个推荐动作。频率数字来自平台AI摘要转述，非博主逐字原话。",
    verdict: "partial",
    evidence: [
      { doi: "10.1007/s40279-016-0543-8", relation: "partial", strength: "medium", note: "Schoenfeld 2016 meta：容量匹配时每肌群每周 2 次肥大优于 1 次——支持腹肌需要规律刺激，但未检验 4–5 次是否更优。" },
      { doi: "10.1080/02640414.2018.1555906", relation: "partial", strength: "high", note: "Schoenfeld 2019 meta：周总容量相等时频率差异不显著——「必须 4–5 次」不被支持，频率可按总量与恢复安排。" },
      { doi: "10.1007/s40279-025-02344-w", relation: "context", strength: "medium", note: "Pelland 2026：频率对肥大的独立效应可能很小，容量才是主驱动——高频只是堆容量的手段之一。" },
    ],
    verdictReason: "「一周 4–5 次」与文献存在张力：频率证据显示容量匹配时 2–3 次与更高频率差异不大，「必须 4–5 次才明显」不被支持；但 4–5 次本身也无害（把总量分摊即可）。腹肌是否明显还取决于体脂，库内无腹肌专项试验，故判部分支持。",
    advice: "腹肌每周练 2–3 次、每次 2–3 个动作各 3 组（产品建议，与频率文献一致）；想练 4–5 次也可以，把总量分摊、别每次力竭。腹肌明不明显主要看体脂——减脂靠饮食缺口，不是靠多卷腹。",
    appliesTo: ["想强化腹肌/核心的规律训练者"],
    notFor: ["腰椎伤病者（卷腹/举腿类需评估）", "产后恢复期女性（遵医嘱）"],
    exerciseIds: ["lying-leg-raise", "crunch"],
  }),
  makeClaim({
    id: "douyin-pulldown-grip",
    topic: "exercise-technique",
    topicLabel: "动作技巧",
    bvid: null,
    awemeId: "7662562022056718449",
    quote: "高位下拉动作讲解",
    statement: "高位下拉握法影响刺激区域：宽距正手偏背阔肌上段、反手偏下背部，对握综合两者、最值得推荐。",
    claimType: "technique",
    rationale: "来源：抖音合集「健身房器械和动作详解」第3集。依据抖音平台AI章节摘要（非博主逐字原话）：00:59「握法与锻炼部位」——宽距正手练背阔肌上段，反手练下背部，对握综合两者，推荐对握；14:14「高阶技巧」——提高肩胛骨回旋能力、避免骨盆后倾。",
    verdict: "insufficient",
    verdictReason: "素材不足：库内没有比较下拉握法（正手/反手/对握）肌肉激活差异的肌电或对照试验，「上段/下段」的区域划分与「对握最优」均无法核验。握法选择属常见实践经验，个体关节结构差异大，需人工补充生物力学证据后再审。",
    advice: "三种握法都可以练背：新手先用对握或反手（肩部通常更舒服），每次 3–4 组 8–12 次（产品建议）；正手宽距下拉时别过度后仰借力。没有哪种握法「必须选」，肩舒服、背部有感觉就对了。",
    appliesTo: ["有高位下拉器械的训练者"],
    notFor: ["肩袖损伤急性期（先就医）", "握距调整引发腕肘疼痛者（换握法或减重）"],
    exerciseIds: ["lat-pulldown"],
  }),
  makeClaim({
    id: "douyin-rdl-progression",
    topic: "exercise-technique",
    topicLabel: "动作技巧",
    bvid: null,
    awemeId: "7671852814386030521",
    quote: "罗马尼亚硬拉动作介绍",
    statement: "新手应先掌握罗马尼亚硬拉，再进阶直腿硬拉与传统硬拉。",
    claimType: "technique",
    rationale: "来源：抖音合集「健身房器械和动作详解」第6集。依据抖音平台AI章节摘要（非博主逐字原话）：00:24「罗马尼亚硬拉」——主要锻炼大腿后侧、臀部和核心，保持重心稳定；07:04「直腿硬拉」——注意幅度，避免过度拉伸导致腰部压力过大；10:30「总结」——推荐先掌握罗马尼亚硬拉，再尝试其他形式。",
    verdict: "insufficient",
    verdictReason: "素材不足：库内没有检验「硬拉动作进阶顺序」的对照试验，「先 RDL 再其他」的教学顺序效果无法核验。RDL 作为髋铰链学习动作方向合理（动作模式教学共识），但进阶顺序的优劣与安全性在本库中无证据，需人工补充后再审。",
    advice: "先学罗马尼亚硬拉：轻哑铃起步 3 组 10–12 次（产品建议），髋部后推、背保持中立、哑铃贴腿下放到膝下附近；动作稳定后再考虑直腿/传统硬拉。腰部疼痛就停，先找原因而不是加重量。",
    appliesTo: ["学习髋铰链动作的新手"],
    notFor: ["腰椎间盘突出/腰痛急性期（先就医）", "无人指导且无法录像自查动作者（建议先找教练）"],
    exerciseIds: ["romanian-deadlift"],
  }),
  makeClaim({
    id: "douyin-shoulder-elbow-wrist",
    topic: "posture-correction",
    topicLabel: "体态矫正",
    bvid: null,
    awemeId: "7675287401501176506",
    quote: "肩肘腕不适动作安排和思路",
    statement: "肩肘腕不适可通过弹力带肩胛上回旋/后倾训练与 TYW 动作（强化中下斜方肌、菱形肌）改善。",
    claimType: "technique",
    rationale: "来源：抖音合集「健身房器械和动作详解」第8集。依据抖音平台AI章节摘要（非博主逐字原话）：00:12「肩胛骨上回旋」与04:40「肩胛骨后倾」——弹力带训练改善肩胛不稳定和肩屈功能；07:03「肘弹响」——弹力带训练肘伸缓解肘弹响和手腕不适；11:34「tyw动作」——训练下斜方、中下斜方和菱形肌，提高肩袖稳定性。",
    verdict: "insufficient",
    verdictReason: "素材不足：库内 36 篇文献中没有肩肘腕不适的矫正训练对照试验，TYW/肩胛训练的有效性与安全性无法核验。涉及「肩袖损伤」话题的内容必须经康复专业人员审核；网络视频方案不能替代评估。",
    advice: "无痛前提下每天 5–10 分钟：弹力带扩胸 2×15、靠墙天使 2×10、面拉 2×15（轻重量）；TYW 类动作俯身或趴姿做，轻重量 10–15 次。肘弹响伴疼痛、手腕持续不适或肩袖确诊损伤者，先就医/找物理治疗师，别照视频硬练。",
    appliesTo: ["久坐、无明确损伤诊断的肩肘腕不适人群"],
    notFor: ["肩袖损伤确诊者", "肘/腕疼痛持续或肿胀者（先就医）"],
    exerciseIds: ["band-pull-apart", "cable-face-pull", "wall-slide", "scapular-push-up"],
  }),
  makeClaim({
    id: "douyin-lateral-raise-breathing",
    topic: "exercise-technique",
    topicLabel: "动作技巧",
    bvid: null,
    awemeId: "7666644718105452666",
    quote: "保持动作流畅，胸腔充盈，姿势稳定",
    statement: "侧平举采用「呼气上抬、吸气下放」并保持胸腔充盈，能减少肩部压力、提高训练效果。",
    claimType: "technique",
    rationale: "来源：抖音合集「健身房器械和动作详解」第1集。依据抖音平台AI章节摘要（非博主逐字原话）：01:04「呼吸调整」——先深吸一口气，呼气向上抬，吸气下来，保持胸腔充盈，减少肩膀压力；04:45「细节注意」——避免肋骨外翻和颈椎不稳定；06:18「位置变化」——前平举针对前束，侧平举针对中束。",
    verdict: "insufficient",
    verdictReason: "素材不足：库内没有检验「呼吸节奏/胸腔充盈对侧平举肩部负荷与训练效果影响」的试验，无法核验。用力时呼气是常见教学提示，方向合理，但「减少肩膀压力」的定量效果在本库中无证据，需人工补充后再审。",
    advice: "侧平举用轻哑铃 3 组 12–15 次（产品建议）：抬手时呼气、下放时吸气，核心收紧别翻肋；重量大到要憋气甩腰就减重。呼吸节奏是辅助工具，不是增肌开关。",
    appliesTo: ["学习侧平举的新手到中级训练者"],
    notFor: ["肩峰撞击/肩袖损伤急性期（先就医）"],
    exerciseIds: ["dumbbell-lateral-raise"],
  }),
  makeClaim({
    id: "douyin-daily-meal-grams",
    topic: "staple-choice",
    topicLabel: "主食选择与克数",
    bvid: null,
    awemeId: "7583147740042120485",
    quote: "给大家看看我的饮食是如何安排的",
    statement: "博主全天饮食以生米、红薯、玉米为主食，搭配牛肉、鸡胸与鸡蛋，并按体重、形体对比与训练状态调整碳水。",
    claimType: "diet",
    rationale: "来源：抖音合集「训练，营养，体态和恢复教学合集」第26集。依据抖音平台AI章节摘要（非博主逐字原话）：00:53「早餐」——130克生米、3个鸡蛋、10克猪油，加草莓和酸奶；10:14「练前餐」——500克红薯、200克牛肉、1个西红柿；16:47「练后餐」——130克生米、200克牛肉、5克猪油；17:39「晚餐」——700克玉米、200克鸡胸肉、1个西红柿；18:17「总结」——按体重、形体对比图、训练状态和精神状态调整，保持微微饥饿感。上述克数为平台AI转述的博主个人安排，非逐字原话、非给用户的推荐量。",
    verdict: "partial",
    evidence: [
      { doi: "10.1186/s12970-017-0174-y", relation: "context", strength: "low", note: "ISSN 声明：饮食方案需个体化、依从性关键；未给出具体食物克数，不能核验博主的个人换算表。" },
    ],
    guidelineKeys: ["grain", "veg", "animal"],
    verdictReason: "「主食+蛋白质食物+按反馈调整」的结构方向与指南一致；但平台摘要中全天蔬菜仅 2 个西红柿，与指南「蔬菜 ≥300 g、深色占一半」有明显差距；具体克数是博主个人安排（平台AI转述），不构成对用户的推荐剂量，故判部分支持。本条 layer4 的克数全部来自膳食指南与产品公式。",
    advice: "按《中国居民膳食指南（2022）》与产品公式（非博主数字）：每天谷类 200–300 g（全谷物和杂豆 50–150 g）、薯类 50–100 g、蔬菜 ≥300 g（深色占一半）、鱼禽蛋瘦肉 120–200 g。训练者碳水目标高时按 macroTargets 计算结果上调主食。注意：博主摘要中蔬菜偏少，不要照抄他的蔬菜量。",
    appliesTo: ["增肌或规律训练的健康成年人"],
    notFor: ["麸质不耐受/乳糜泻者（全谷物避开小麦）", "遵医嘱限制碳水或特定食物的人群"],
  }),
  makeClaim({
    id: "douyin-diet-for-training",
    topic: "recomp-balance",
    topicLabel: "增肌减脂平衡",
    bvid: null,
    awemeId: "7577618867309183589",
    quote: "热量不等于营养，饮食是为了服务于训练",
    statement: "增肌减脂同时进行需要让饮食服务于训练：热量不等于营养，应按训练安排调整饮食结构。",
    claimType: "diet",
    rationale: "来源：抖音合集「训练，营养，体态和恢复教学合集」第22集。该视频无平台摘要、无章节（素材较薄），无平台AI章节摘要可引用；拆解仅基于博主标题原文「热量不等于营养，饮食是为了服务于训练，根据训练安排调整饮食」。标题提到的「四点」具体内容未获取，不编造。",
    verdict: "partial",
    evidence: [
      { doi: "10.1186/s12970-017-0174-y", relation: "partial", strength: "medium", note: "ISSN 声明：增肌饮食需支持递增的抗阻训练需求（第 4 条），饮食长期成功取决于依从性（第 8 条）——支持「饮食服务训练」；但「热量不等于营养」的具体四点未获取，无法逐条核验。" },
    ],
    verdictReason: "「饮食服务训练、按训练调整」与 ISSN 原则方向一致；但视频正文素材缺失（无摘要无章节），「四点」具体内容无法核验，只能基于标题判部分支持。",
    advice: "把饮食当训练的一部分：训练日碳水按 macroTargets 目标吃够（产品计算，非博主数字），练前 1–2 小时有一顿含主食+蛋白质的餐，练后正常吃饭。别只盯热量数字——指南的谷薯、蔬果、奶豆结构是地基。",
    appliesTo: ["以增肌或身体重塑为目标的规律训练者"],
    notFor: ["有进食障碍史者（严格饮食控制需专业指导）"],
  }),
  makeClaim({
    id: "douyin-glutamine",
    topic: "glutamine",
    topicLabel: "谷氨酰胺",
    bvid: null,
    awemeId: "7612569129154079461",
    quote: "谷氨酰胺的作用和效果，以及补充时间",
    statement: "谷氨酰胺补充对健身人群的恢复或免疫有额外收益。",
    claimType: "efficacy",
    rationale: "来源：抖音合集「补剂系列」第3集。依据抖音平台AI章节摘要（非博主逐字原话）：章节仅标题「谷氨酰胺作用以及补充时间」「50份抽奖活动」，无正文摘要，platform_summary 为 null——素材较薄，未给出任何剂量数字，不声称博主说过具体用法。",
    verdict: "insufficient",
    verdictReason: "素材不足：视频正文素材缺失（章节无摘要），且库内 36 篇文献中没有谷氨酰胺的干预试验，无法裁决其对健康训练者的额外收益。需人工补充谷氨酰胺 RCT 后再审。",
    advice: "产品建议：先把蛋白质吃够（1.6–2.2 g/kg）、睡眠睡够，再考虑补剂。谷氨酰胺对健康训练者的额外收益证据不足，钱优先花在肉蛋奶上；肠道疾病等临床用途遵医嘱。",
    appliesTo: ["饮食与恢复已达标、仍想尝试补剂的训练者"],
    notFor: ["肝肾功能异常者（氨基酸补充需遵医嘱）", "把补剂当正餐替代的人群"],
  }),
  makeClaim({
    id: "douyin-protein-timing",
    topic: "protein-intake",
    topicLabel: "蛋白质摄入量",
    bvid: null,
    awemeId: "7620313918720746673",
    quote: "给大家说一下作用，推荐使用量以及什么时候补充更好",
    statement: "蛋白质补充时机：训练前后摄入与抗阻训练协同刺激肌肉蛋白合成，全天每 3–4 小时均匀分配即可，不必纠结精确窗口。",
    claimType: "dosage",
    rationale: "来源：抖音合集「补剂系列」第2集。依据抖音平台AI章节摘要（非博主逐字原话）：章节仅标题「蛋白质怎么吃？吃多少？」「乳清蛋白粉」，无正文摘要，platform_summary 为 null——素材较薄，未给出任何剂量数字；用量与时机结论由文献层独立给出，不声称博主说过数字。",
    verdict: "supported",
    evidence: [
      { doi: "10.1186/s12970-017-0177-8", relation: "supports", strength: "high", note: "ISSN 声明：抗阻训练与蛋白质摄入协同刺激 MPS，训练前或后摄入均有益；每餐约 0.25 g/kg 或 20–40 g、每 3–4 小时均匀分配；运动的合成效应持续至少 24 小时，时机更多取决于个体耐受。" },
      { doi: "10.1136/bjsports-2017-097608", relation: "context", strength: "medium", note: "Morton meta：蛋白质补充整体有效、约 1.62 g/kg/d 后收益趋于平台——总量比时机更关键。" },
    ],
    verdictReason: "ISSN 立场声明直接支持「训练前后协同、全天均匀分配、不必迷信窗口期」；视频本身素材薄（章节无摘要），本条裁决完全由文献层支撑，与博主标题主题一致。",
    advice: "每天蛋白质 1.6–2.2 g/kg 分到 3–4 餐、每餐 20–40 g（ISSN 区间）；训练前后 1–2 小时内有一餐即可，不用卡「30 分钟窗口」。乳清蛋白只在饮食吃不够时当替补。",
    appliesTo: ["规律抗阻训练的健康成年人"],
    notFor: ["需要限制蛋白质的肾病患者", "间歇性断食执行者（分配策略需另行评估）"],
  }),
  makeClaim({
    id: "douyin-electrolyte-water",
    topic: "hydration",
    topicLabel: "电解质与补水",
    bvid: null,
    awemeId: "7627845492777962865",
    quote: "电解质的作用讲解，出汗多以及喝水少都比较适合",
    statement: "训练人群每日饮水约 1–1.5 升比较合适，出汗多或喝水少时适合补充电解质。",
    claimType: "dosage",
    rationale: "来源：抖音合集「补剂系列」第4集。依据抖音平台AI章节摘要（非博主逐字原话）：章节标题「水1-1.5升比较合适」（仅标题无正文），platform_summary 为 null——素材较薄；「渗透压和酸碱平衡很重要」来自博主标题原文。",
    verdict: "partial",
    evidence: [],
    guidelineKeys: ["water"],
    verdictReason: "指南建议温和气候、轻身体活动成人每天饮水 1500–1700 ml——「1–1.5 升」与指南下限接近，但训练人群出汗多、需求通常更高，照搬可能偏低；「出汗多补电解质」方向合理，但库内无运动人群电解质干预试验，故判部分支持。",
    advice: "按《中国居民膳食指南（2022）》：温和气候轻活动成人每天饮水 1500–1700 ml；训练日出汗多要在此基础上加量（产品建议），大量出汗超过 1 小时可考虑含电解质饮料。日常均衡饮食一般不缺电解质，别把电解质水当日常水喝。",
    appliesTo: ["规律训练、出汗较多的健康成年人"],
    notFor: ["心衰/肾病等需限水限钠人群（遵医嘱）", "高血压者（电解质饮料含钠，需计入总量）"],
  }),
  makeClaim({
    id: "douyin-cardio-for-lifting",
    topic: "concurrent-training",
    topicLabel: "有氧与力量并行",
    bvid: null,
    awemeId: "7587970862046973425",
    quote: "哪种有氧对力量训练帮助更大？以及有氧的强度和时间具体如何安排",
    statement: "增肌期应选择时间短、强度大的有氧（间歇跑、坡跑、负重跑），比低强度有氧对力量训练帮助更大。",
    claimType: "efficacy",
    rationale: "来源：抖音合集「训练，营养，体态和恢复教学合集」第24集。依据抖音平台AI章节摘要（非博主逐字原话）：00:11「有氧选择的建议」——推荐时间短、强度大的有氧，消耗更大、对呼吸要求更高，能提高力量训练强度；01:13「间歇跑」——20分钟分四个循环，走两分钟跑两分钟交替，逐渐提高强度；02:14「其他有氧方式」——坡跑和负重跑。",
    verdict: "partial",
    evidence: [
      { doi: "10.1007/s40279-021-01587-7", relation: "partial", strength: "high", note: "Schumann 2022 meta：并行训练不损害肥大与最大力量，但爆发力小幅下降、同课进行时更明显——支持「可以同练」，不支持「高强度有氧对力量帮助更大」。" },
      { doi: "10.1519/jsc.0b013e31823a3e2d", relation: "partial", strength: "medium", note: "Wilson 2012 meta：跑步类（而非骑车）并行时肥大与力量干扰更明显，干扰随有氧频率与时长增加——与「高强度跑类更优」的说法存在张力。" },
    ],
    verdictReason: "「力量与有氧可以同练」有 meta 支持；但「高强度短时有氧比低强度对力量帮助更大」在库内无直接比较证据，且 Wilson 提示跑步类、高剂量有氧干扰更明显，爆发力目标者需谨慎。判部分支持：心肺收益成立，「更帮力量」不成立。",
    advice: "增肌期有氧以低中强度为主：每周 2–3 次、每次 20–30 分钟快走或骑车（产品建议）；间歇跑每周不超过 1–2 次，与力量课间隔 6 小时以上。减脂期有氧可加量，但力量训练必须保留。",
    appliesTo: ["想兼顾心肺与力量的训练者"],
    notFor: ["以力量举/爆发力专项成绩为目标的运动员（需精细安排）", "恢复能力差、训练量已很大的人群"],
  }),
  makeClaim({
    id: "douyin-foam-rolling",
    topic: "stretching",
    topicLabel: "拉伸放松",
    bvid: null,
    awemeId: "7622584923861727601",
    quote: "如何用泡沫轴放松全身，一个视频搞定",
    statement: "泡沫轴滚动（每部位约 30 秒、找酸痛点）能放松肌肉、促进恢复。",
    claimType: "efficacy",
    rationale: "来源：抖音合集「训练，营养，体态和恢复教学合集」第28集。依据抖音平台AI章节摘要（非博主逐字原话）：00:08「小腿」、01:15「大腿」、04:24「臀部」、04:50「上肢」——各部位在最酸的地方滚 30 秒左右；10:15「颈椎」——泡沫轴放在脖子后面放松颈椎（此做法存在安全风险，产品层不建议照做）。",
    verdict: "insufficient",
    verdictReason: "素材不足：库内 36 篇文献中没有泡沫轴滚动对酸痛缓解/恢复效果的对照试验，无法裁决效果大小。且平台摘要中「滚压颈椎」的做法有安全风险，产品层明确不建议。需人工补充泡沫轴 RCT 后再审。",
    advice: "泡沫轴当放松工具可以：每个部位 20–30 秒、缓慢滚动（产品建议），只滚肌肉（小腿肚、大腿、臀、上背），避开颈椎、腰椎和关节；别指望它消除酸痛，恢复的地基仍是睡眠和蛋白质。",
    appliesTo: ["训练后想放松的健康人群"],
    notFor: ["急性肌肉拉伤期", "骨质疏松/血栓风险者（滚压需遵医嘱）", "颈椎腰椎伤病者（禁止滚压脊柱）"],
  }),
];

/** 去重后的主题列表（按卡片首次出现顺序）。 */
export const TOPICS: { id: string; label: string }[] = [
  ...new Map<string, { id: string; label: string }>(CLAIMS.map((c) => [c.topic, { id: c.topic, label: c.topicLabel }])).values(),
];