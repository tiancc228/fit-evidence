import type { FoodItem } from "@/src/lib/types";

/**
 * Per 100 g edible portion. Reference values commonly tabulated in
 * 《中国食物成分表（标准版）》; treated as approximate and labelled as such in the UI.
 */
export const FOODS: FoodItem[] = [
  { id: "rice-cooked", name: "米饭（蒸）", category: "谷薯", kcal: 116, protein: 2.6, carb: 25.9, fat: 0.3, fiber: 0.3, unit: "碗", gramsPerUnit: 150 },
  { id: "rice-raw", name: "大米（生）", category: "谷薯", kcal: 346, protein: 7.4, carb: 77.9, fat: 0.8, fiber: 0.7, unit: "份", gramsPerUnit: 50 },
  { id: "mantou", name: "馒头", category: "谷薯", kcal: 223, protein: 7.0, carb: 47.0, fat: 1.1, fiber: 1.3, unit: "个", gramsPerUnit: 100 },
  { id: "noodle-cooked", name: "面条（煮）", category: "谷薯", kcal: 110, protein: 3.9, carb: 22.8, fat: 0.4, fiber: 0.9, unit: "碗", gramsPerUnit: 200 },
  { id: "oats", name: "燕麦片", category: "谷薯", kcal: 377, protein: 15.0, carb: 61.6, fat: 6.7, fiber: 5.3, unit: "份", gramsPerUnit: 40 },
  { id: "sweet-potato", name: "红薯", category: "谷薯", kcal: 102, protein: 1.1, carb: 24.7, fat: 0.2, fiber: 1.6, unit: "个", gramsPerUnit: 150 },
  { id: "potato", name: "土豆", category: "谷薯", kcal: 77, protein: 2.0, carb: 17.2, fat: 0.2, fiber: 0.7, unit: "个", gramsPerUnit: 150 },
  { id: "corn", name: "玉米（鲜）", category: "谷薯", kcal: 112, protein: 4.0, carb: 22.8, fat: 1.2, fiber: 2.9, unit: "根", gramsPerUnit: 200 },
  { id: "wholewheat-bread", name: "全麦面包", category: "谷薯", kcal: 246, protein: 9.0, carb: 45.0, fat: 3.5, fiber: 6.0, unit: "片", gramsPerUnit: 40 },
  { id: "millet", name: "小米（生）", category: "谷薯", kcal: 361, protein: 9.0, carb: 75.1, fat: 3.1, fiber: 1.6, unit: "份", gramsPerUnit: 50 },

  { id: "chicken-breast", name: "鸡胸肉", category: "蛋白质", kcal: 133, protein: 19.4, carb: 2.5, fat: 5.0, fiber: 0, unit: "块", gramsPerUnit: 120 },
  { id: "chicken-thigh", name: "鸡腿肉（去皮）", category: "蛋白质", kcal: 146, protein: 20.2, carb: 0, fat: 7.2, fiber: 0, unit: "只", gramsPerUnit: 100 },
  { id: "beef-lean", name: "牛肉（瘦）", category: "蛋白质", kcal: 106, protein: 20.2, carb: 1.2, fat: 2.3, fiber: 0, unit: "份", gramsPerUnit: 100 },
  { id: "pork-lean", name: "猪肉（瘦）", category: "蛋白质", kcal: 143, protein: 20.3, carb: 1.5, fat: 6.2, fiber: 0, unit: "份", gramsPerUnit: 100 },
  { id: "salmon", name: "三文鱼", category: "蛋白质", kcal: 139, protein: 17.2, carb: 0, fat: 7.8, fiber: 0, unit: "份", gramsPerUnit: 100 },
  { id: "bass", name: "鲈鱼", category: "蛋白质", kcal: 105, protein: 18.6, carb: 0, fat: 3.4, fiber: 0, unit: "份", gramsPerUnit: 100 },
  { id: "shrimp", name: "虾", category: "蛋白质", kcal: 93, protein: 18.6, carb: 0.8, fat: 0.8, fiber: 0, unit: "份", gramsPerUnit: 100 },
  { id: "egg", name: "鸡蛋（全蛋）", category: "蛋白质", kcal: 144, protein: 13.3, carb: 2.8, fat: 8.8, fiber: 0, unit: "个", gramsPerUnit: 50 },
  { id: "egg-white", name: "鸡蛋白", category: "蛋白质", kcal: 60, protein: 11.6, carb: 3.1, fat: 0.1, fiber: 0, unit: "个", gramsPerUnit: 33 },
  { id: "tofu-north", name: "豆腐（北）", category: "蛋白质", kcal: 98, protein: 12.2, carb: 1.5, fat: 4.8, fiber: 0.5, unit: "块", gramsPerUnit: 100 },
  { id: "tofu-south", name: "豆腐（南）", category: "蛋白质", kcal: 57, protein: 6.2, carb: 2.4, fat: 2.5, fiber: 0.4, unit: "块", gramsPerUnit: 150 },
  { id: "soybean", name: "黄豆（干）", category: "蛋白质", kcal: 390, protein: 35.0, carb: 34.2, fat: 16.0, fiber: 15.5, unit: "份", gramsPerUnit: 25 },
  { id: "whey", name: "乳清蛋白粉", category: "蛋白质", kcal: 380, protein: 75.0, carb: 10.0, fat: 5.0, fiber: 0, unit: "勺", gramsPerUnit: 30 },

  { id: "milk", name: "牛奶（全脂）", category: "奶类", kcal: 65, protein: 3.3, carb: 4.9, fat: 3.6, fiber: 0, unit: "盒", gramsPerUnit: 250 },
  { id: "milk-skim", name: "牛奶（脱脂）", category: "奶类", kcal: 35, protein: 3.4, carb: 5.0, fat: 0.1, fiber: 0, unit: "盒", gramsPerUnit: 250 },
  { id: "yogurt-plain", name: "酸奶（无糖）", category: "奶类", kcal: 72, protein: 3.1, carb: 4.7, fat: 3.2, fiber: 0, unit: "杯", gramsPerUnit: 100 },
  { id: "yogurt-greek", name: "希腊酸奶（无糖）", category: "奶类", kcal: 97, protein: 9.0, carb: 3.6, fat: 5.0, fiber: 0, unit: "杯", gramsPerUnit: 100 },
  { id: "cheese", name: "奶酪", category: "奶类", kcal: 328, protein: 25.7, carb: 3.5, fat: 23.5, fiber: 0, unit: "片", gramsPerUnit: 20 },

  { id: "broccoli", name: "西兰花", category: "蔬菜", kcal: 36, protein: 4.1, carb: 4.3, fat: 0.6, fiber: 1.6, unit: "份", gramsPerUnit: 100 },
  { id: "spinach", name: "菠菜", category: "蔬菜", kcal: 28, protein: 2.6, carb: 4.5, fat: 0.3, fiber: 1.7, unit: "份", gramsPerUnit: 100 },
  { id: "bokchoy", name: "油菜/小白菜", category: "蔬菜", kcal: 15, protein: 1.5, carb: 2.7, fat: 0.3, fiber: 1.1, unit: "份", gramsPerUnit: 100 },
  { id: "tomato", name: "番茄", category: "蔬菜", kcal: 20, protein: 0.9, carb: 4.0, fat: 0.2, fiber: 0.5, unit: "个", gramsPerUnit: 150 },
  { id: "cucumber", name: "黄瓜", category: "蔬菜", kcal: 16, protein: 0.8, carb: 2.9, fat: 0.2, fiber: 0.5, unit: "根", gramsPerUnit: 150 },
  { id: "carrot", name: "胡萝卜", category: "蔬菜", kcal: 39, protein: 1.0, carb: 8.8, fat: 0.2, fiber: 2.8, unit: "根", gramsPerUnit: 100 },
  { id: "bell-pepper", name: "彩椒", category: "蔬菜", kcal: 26, protein: 1.0, carb: 5.4, fat: 0.2, fiber: 1.4, unit: "个", gramsPerUnit: 100 },
  { id: "mushroom", name: "香菇（鲜）", category: "蔬菜", kcal: 26, protein: 2.2, carb: 5.2, fat: 0.3, fiber: 3.3, unit: "份", gramsPerUnit: 80 },
  { id: "lettuce", name: "生菜", category: "蔬菜", kcal: 15, protein: 1.3, carb: 2.0, fat: 0.3, fiber: 0.7, unit: "份", gramsPerUnit: 80 },
  { id: "asparagus", name: "芦笋", category: "蔬菜", kcal: 22, protein: 2.2, carb: 3.9, fat: 0.1, fiber: 1.9, unit: "份", gramsPerUnit: 100 },
  { id: "cabbage", name: "卷心菜", category: "蔬菜", kcal: 24, protein: 1.5, carb: 4.6, fat: 0.2, fiber: 1.0, unit: "份", gramsPerUnit: 100 },
  { id: "eggplant", name: "茄子", category: "蔬菜", kcal: 23, protein: 1.1, carb: 4.9, fat: 0.2, fiber: 1.3, unit: "个", gramsPerUnit: 150 },

  { id: "apple", name: "苹果", category: "水果", kcal: 54, protein: 0.2, carb: 13.5, fat: 0.2, fiber: 1.2, unit: "个", gramsPerUnit: 200 },
  { id: "banana", name: "香蕉", category: "水果", kcal: 93, protein: 1.4, carb: 22.0, fat: 0.2, fiber: 1.2, unit: "根", gramsPerUnit: 120 },
  { id: "orange", name: "橙子", category: "水果", kcal: 48, protein: 0.8, carb: 11.1, fat: 0.2, fiber: 0.6, unit: "个", gramsPerUnit: 180 },
  { id: "blueberry", name: "蓝莓", category: "水果", kcal: 57, protein: 0.7, carb: 14.5, fat: 0.3, fiber: 2.4, unit: "份", gramsPerUnit: 100 },
  { id: "grape", name: "葡萄", category: "水果", kcal: 44, protein: 0.5, carb: 10.3, fat: 0.2, fiber: 0.4, unit: "份", gramsPerUnit: 150 },
  { id: "kiwi", name: "猕猴桃", category: "水果", kcal: 61, protein: 0.8, carb: 14.5, fat: 0.6, fiber: 2.6, unit: "个", gramsPerUnit: 100 },

  { id: "almond", name: "杏仁", category: "油脂坚果", kcal: 578, protein: 22.5, carb: 19.7, fat: 45.4, fiber: 8.0, unit: "份", gramsPerUnit: 15 },
  { id: "walnut", name: "核桃", category: "油脂坚果", kcal: 646, protein: 14.9, carb: 19.1, fat: 58.8, fiber: 9.5, unit: "份", gramsPerUnit: 15 },
  { id: "peanut", name: "花生", category: "油脂坚果", kcal: 574, protein: 24.8, carb: 21.7, fat: 44.3, fiber: 5.5, unit: "份", gramsPerUnit: 15 },
  { id: "olive-oil", name: "橄榄油", category: "油脂坚果", kcal: 899, protein: 0, carb: 0, fat: 99.9, fiber: 0, unit: "勺", gramsPerUnit: 10 },
  { id: "cooking-oil", name: "烹调油（植物油）", category: "油脂坚果", kcal: 899, protein: 0, carb: 0, fat: 99.9, fiber: 0, unit: "勺", gramsPerUnit: 10 },
  { id: "peanut-butter", name: "花生酱", category: "油脂坚果", kcal: 600, protein: 25.0, carb: 20.0, fat: 50.0, fiber: 6.0, unit: "勺", gramsPerUnit: 15 },
  { id: "avocado", name: "牛油果", category: "油脂坚果", kcal: 171, protein: 2.0, carb: 7.4, fat: 15.3, fiber: 2.1, unit: "个", gramsPerUnit: 100 },

  { id: "cola", name: "可乐", category: "饮品零食", kcal: 43, protein: 0, carb: 10.6, fat: 0, fiber: 0, unit: "罐", gramsPerUnit: 330 },
  { id: "milk-tea", name: "奶茶（含糖）", category: "饮品零食", kcal: 70, protein: 0.7, carb: 12.0, fat: 2.0, fiber: 0, unit: "杯", gramsPerUnit: 500 },
  { id: "fried-chicken", name: "炸鸡", category: "饮品零食", kcal: 279, protein: 17.3, carb: 10.5, fat: 19.0, fiber: 0.5, unit: "份", gramsPerUnit: 150 },
  { id: "chips", name: "薯片", category: "饮品零食", kcal: 548, protein: 4.0, carb: 49.7, fat: 37.6, fiber: 1.9, unit: "包", gramsPerUnit: 70 },
  { id: "cookie", name: "饼干", category: "饮品零食", kcal: 435, protein: 8.0, carb: 71.0, fat: 12.7, fiber: 1.0, unit: "份", gramsPerUnit: 30 },
  { id: "dark-choc", name: "黑巧克力", category: "饮品零食", kcal: 546, protein: 6.6, carb: 53.4, fat: 31.3, fiber: 5.9, unit: "份", gramsPerUnit: 20 },
  { id: "instant-noodle", name: "方便面", category: "饮品零食", kcal: 473, protein: 9.5, carb: 61.6, fat: 21.1, fiber: 0.7, unit: "包", gramsPerUnit: 100 },
];

export const FOOD_CATEGORIES = ["谷薯", "蛋白质", "奶类", "蔬菜", "水果", "油脂坚果", "饮品零食"];

export const FOOD_BY_ID = new Map(FOODS.map((f) => [f.id, f]));

export function scaleFood(f: FoodItem, grams: number) {
  const k = grams / 100;
  return {
    kcal: Math.round(f.kcal * k),
    protein: +(f.protein * k).toFixed(1),
    carb: +(f.carb * k).toFixed(1),
    fat: +(f.fat * k).toFixed(1),
    fiber: +(f.fiber * k).toFixed(1),
  };
}

/** Vegetable suggestions grouped by the guideline's "深色蔬菜占 1/2" requirement. */
export const VEGETABLE_PICKS = {
  dark: [
    { id: "broccoli", why: "十字花科，膳食纤维与维生素C密度高" },
    { id: "spinach", why: "深绿叶菜，叶酸与钾含量高" },
    { id: "bokchoy", why: "深绿叶菜，钙含量在蔬菜中较高" },
    { id: "carrot", why: "橙红色蔬菜，β-胡萝卜素来源" },
    { id: "bell-pepper", why: "维生素C密度高，可生食减少损失" },
    { id: "tomato", why: "番茄红素来源，熟制吸收率更高" },
  ],
  light: [
    { id: "cucumber", why: "能量密度极低，适合增加饱腹体积" },
    { id: "lettuce", why: "体积大热量低，适合减脂期加量" },
    { id: "mushroom", why: "菌菇类，提供鲜味与膳食纤维" },
    { id: "asparagus", why: "叶酸与膳食纤维来源" },
    { id: "cabbage", why: "耐储存，适合批量备餐" },
    { id: "eggplant", why: "注意烹调吸油，建议蒸制" },
  ],
};

export const STAPLE_PICKS = [
  { id: "rice-cooked", why: "基础主食，训练前后易消化" },
  { id: "oats", why: "全谷物，β-葡聚糖有助于饱腹" },
  { id: "sweet-potato", why: "薯类，钾与膳食纤维较高" },
  { id: "wholewheat-bread", why: "全谷物，便于备餐" },
  { id: "corn", why: "全谷物，可替代部分精制谷类" },
  { id: "millet", why: "全谷杂豆搭配，符合指南粗细搭配要求" },
];

/** Anti-inflammatory style pattern: emphasises whole foods, omega-3 sources, polyphenols. */
export const ANTI_INFLAMMATORY_PICKS = [
  { id: "salmon", why: "富含 EPA/DHA 的深海鱼，指南建议优先选择鱼类" },
  { id: "blueberry", why: "多酚类色素来源" },
  { id: "broccoli", why: "十字花科蔬菜，植物化学物来源" },
  { id: "spinach", why: "深绿叶菜，镁与叶酸来源" },
  { id: "walnut", why: "植物性 omega-3（ALA）来源，注意份量" },
  { id: "olive-oil", why: "单不饱和脂肪为主，替代部分动物油脂" },
  { id: "tomato", why: "番茄红素，熟制配油脂吸收更好" },
  { id: "soybean", why: "大豆异黄酮与优质植物蛋白" },
];