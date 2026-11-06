import type { DishInput } from '../services/types'

// 家常菜模板扩展包（由 scripts/generate-dish-bank.js 生成）
export const DISH_BANK: DishInput[] = [
  {
    "name": "扬州炒饭",
    "desc": "火腿虾仁配隔夜饭，粒粒分明",
    "price": 14,
    "categoryId": "staple",
    "tags": [
      "快手"
    ],
    "spicyLevels": [],
    "addons": [],
    "color": "#FFD23F",
    "meals": [
      "lunch",
      "dinner"
    ],
    "status": "on",
    "stock": -1,
    "isRecommended": false,
    "recipe": "火腿、虾仁、胡萝卜切丁，鸡蛋炒散\n下隔夜饭大火炒散，加配料翻炒\n调盐和少许生抽，撒葱花出锅"
  },
  {
    "name": "腊肠煲仔饭",
    "desc": "腊肠油香渗进米饭，锅巴焦脆",
    "price": 20,
    "categoryId": "staple",
    "tags": [
      "招牌"
    ],
    "spicyLevels": [],
    "addons": [],
    "color": "#FFD23F",
    "meals": [
      "lunch",
      "dinner"
    ],
    "status": "on",
    "stock": -1,
    "isRecommended": false,
    "recipe": "大米泡30分钟，砂锅加水煮开\n铺腊肠片，转小火焖15分钟\n淋生抽蚝油汁，焖2分钟，撒葱花"
  },
  {
    "name": "咖喱鸡肉饭",
    "desc": "咖喱浓郁，土豆胡萝卜软糯",
    "price": 18,
    "categoryId": "staple",
    "tags": [
      "下饭"
    ],
    "spicyLevels": [
      "不辣",
      "微辣"
    ],
    "addons": [],
    "color": "#FFD23F",
    "meals": [
      "lunch",
      "dinner"
    ],
    "status": "on",
    "stock": -1,
    "isRecommended": false,
    "recipe": "鸡腿肉切块用盐腌10分钟\n炒香洋葱，下鸡肉和咖喱块，加水煮15分钟\n加土豆胡萝卜再煮10分钟，浇饭"
  },
  {
    "name": "黑椒牛柳饭",
    "desc": "黑椒汁裹着嫩牛柳，很下饭",
    "price": 22,
    "categoryId": "staple",
    "tags": [
      "招牌"
    ],
    "spicyLevels": [
      "不辣",
      "微辣"
    ],
    "addons": [],
    "color": "#FFD23F",
    "meals": [
      "lunch",
      "dinner"
    ],
    "status": "on",
    "stock": -1,
    "isRecommended": false,
    "recipe": "牛柳切条用生抽淀粉腌15分钟\n大火快炒牛柳盛出，炒香洋葱彩椒\n回锅加黑椒汁翻匀，浇饭"
  },
  {
    "name": "蜜汁叉烧饭",
    "desc": "甜咸叉烧配米饭，广式味道",
    "price": 20,
    "categoryId": "staple",
    "tags": [
      "招牌"
    ],
    "spicyLevels": [],
    "addons": [],
    "color": "#FFD23F",
    "meals": [
      "lunch",
      "dinner"
    ],
    "status": "on",
    "stock": -1,
    "isRecommended": false,
    "recipe": "梅花肉用叉烧酱生抽蜂蜜腌一夜\n烤箱200度烤25分钟，中途翻面刷蜜\n切片铺饭，淋烤汁"
  },
  {
    "name": "卤肉饭",
    "desc": "肥瘦相间的卤肉浇在热饭上",
    "price": 16,
    "categoryId": "staple",
    "tags": [
      "下饭"
    ],
    "spicyLevels": [],
    "addons": [],
    "color": "#FFD23F",
    "meals": [
      "lunch",
      "dinner"
    ],
    "status": "on",
    "stock": -1,
    "isRecommended": false,
    "recipe": "五花肉切丁煸出油\n加红葱酥、生抽、老抽、冰糖和热水\n小火卤40分钟，浇在米饭上配卤蛋"
  },
  {
    "name": "猪脚饭",
    "desc": "猪脚软糯，胶质满满",
    "price": 22,
    "categoryId": "staple",
    "tags": [
      "胶原蛋白"
    ],
    "spicyLevels": [],
    "addons": [],
    "color": "#FFD23F",
    "meals": [
      "lunch",
      "dinner"
    ],
    "status": "on",
    "stock": -1,
    "isRecommended": false,
    "recipe": "猪脚焯水后炒糖色\n加生抽老抽八角姜片和热水，炖60分钟\n收汁后浇饭，配酸菜"
  },
  {
    "name": "番茄鸡蛋盖饭",
    "desc": "最简单的家常味，酸甜下饭",
    "price": 12,
    "categoryId": "staple",
    "tags": [
      "家常"
    ],
    "spicyLevels": [],
    "addons": [],
    "color": "#FFD23F",
    "meals": [
      "lunch",
      "dinner"
    ],
    "status": "on",
    "stock": -1,
    "isRecommended": false,
    "recipe": "番茄切块炒出汁，倒入蛋液炒散\n加盐和少许糖调味\n浇在热米饭上"
  },
  {
    "name": "青椒肉丝盖饭",
    "desc": "青椒脆、肉丝嫩，经典盖饭",
    "price": 15,
    "categoryId": "staple",
    "tags": [
      "下饭"
    ],
    "spicyLevels": [
      "不辣",
      "微辣"
    ],
    "addons": [],
    "color": "#FFD23F",
    "meals": [
      "lunch",
      "dinner"
    ],
    "status": "on",
    "stock": -1,
    "isRecommended": false,
    "recipe": "肉丝用生抽淀粉腌10分钟\n大火炒肉丝变色，下青椒丝\n加盐生抽翻匀，浇饭"
  },
  {
    "name": "土豆牛腩盖饭",
    "desc": "牛腩炖到软烂，土豆吸满汤汁",
    "price": 20,
    "categoryId": "staple",
    "tags": [
      "招牌"
    ],
    "spicyLevels": [],
    "addons": [],
    "color": "#FFD23F",
    "meals": [
      "lunch",
      "dinner"
    ],
    "status": "on",
    "stock": -1,
    "isRecommended": false,
    "recipe": "牛腩焯水，炒香洋葱下牛腩\n加生抽老抽和热水炖50分钟\n下土豆块再炖15分钟，浇饭"
  },
  {
    "name": "麻婆豆腐盖饭",
    "desc": "麻辣鲜香，拌饭一绝",
    "price": 14,
    "categoryId": "staple",
    "tags": [
      "下饭"
    ],
    "spicyLevels": [
      "不辣",
      "微辣",
      "中辣"
    ],
    "addons": [],
    "color": "#FFD23F",
    "meals": [
      "lunch",
      "dinner"
    ],
    "status": "on",
    "stock": -1,
    "isRecommended": false,
    "recipe": "豆腐切块焯水\n炒香豆瓣酱和肉末，加水下豆腐\n勾芡撒花椒粉葱花，浇饭"
  },
  {
    "name": "鱼香茄子盖饭",
    "desc": "酸甜微辣，茄子软糯",
    "price": 14,
    "categoryId": "staple",
    "tags": [
      "下饭"
    ],
    "spicyLevels": [
      "不辣",
      "微辣"
    ],
    "addons": [],
    "color": "#FFD23F",
    "meals": [
      "lunch",
      "dinner"
    ],
    "status": "on",
    "stock": -1,
    "isRecommended": false,
    "recipe": "茄子切条炸软或煎软\n炒香蒜末豆瓣酱，下茄子\n倒鱼香汁翻匀，浇饭"
  },
  {
    "name": "香菇鸡肉焖饭",
    "desc": "一锅出，米饭吸满鸡汁",
    "price": 17,
    "categoryId": "staple",
    "tags": [
      "一锅出"
    ],
    "spicyLevels": [],
    "addons": [],
    "color": "#FFD23F",
    "meals": [
      "lunch",
      "dinner"
    ],
    "status": "on",
    "stock": -1,
    "isRecommended": false,
    "recipe": "鸡腿肉切块腌10分钟，香菇泡软\n电饭锅下米、鸡肉、香菇和生抽\n正常煮饭，跳闸后焖10分钟拌匀"
  },
  {
    "name": "排骨焖饭",
    "desc": "排骨和米饭一起焖，省事又香",
    "price": 18,
    "categoryId": "staple",
    "tags": [
      "一锅出"
    ],
    "spicyLevels": [],
    "addons": [],
    "color": "#FFD23F",
    "meals": [
      "lunch",
      "dinner"
    ],
    "status": "on",
    "stock": -1,
    "isRecommended": false,
    "recipe": "排骨焯水后用生抽腌10分钟\n电饭锅放米、排骨、胡萝卜丁和酱油\n正常煮饭，跳闸后焖10分钟"
  },
  {
    "name": "上海菜饭",
    "desc": "青菜咸肉和米饭，清清爽爽",
    "price": 13,
    "categoryId": "staple",
    "tags": [
      "家常"
    ],
    "spicyLevels": [],
    "addons": [],
    "color": "#FFD23F",
    "meals": [
      "lunch",
      "dinner"
    ],
    "status": "on",
    "stock": -1,
    "isRecommended": false,
    "recipe": "青菜切碎，咸肉切丁\n米加水煮到半熟，下咸肉和青菜\n焖10分钟，拌入猪油和盐"
  },
  {
    "name": "蛋包饭",
    "desc": "蛋皮包着番茄鸡肉炒饭",
    "price": 16,
    "categoryId": "staple",
    "tags": [
      "番茄酱"
    ],
    "spicyLevels": [],
    "addons": [],
    "color": "#FFD23F",
    "meals": [
      "lunch",
      "dinner"
    ],
    "status": "on",
    "stock": -1,
    "isRecommended": false,
    "recipe": "炒一份番茄鸡肉炒饭\n鸡蛋打散摊成蛋皮\n包入炒饭，挤番茄酱"
  },
  {
    "name": "牛肉炒乌冬",
    "desc": "乌冬弹牙，牛肉嫩滑",
    "price": 18,
    "categoryId": "staple",
    "tags": [
      "快手"
    ],
    "spicyLevels": [],
    "addons": [],
    "color": "#FFD23F",
    "meals": [
      "lunch",
      "dinner"
    ],
    "status": "on",
    "stock": -1,
    "isRecommended": false,
    "recipe": "乌冬面煮1分钟捞出\n牛肉片用生抽腌5分钟，大火炒变色\n下乌冬和洋葱，加酱油黑胡椒炒匀"
  },
  {
    "name": "鲜虾云吞面",
    "desc": "鲜虾云吞配细面，暖胃汤面",
    "price": 16,
    "categoryId": "staple",
    "tags": [
      "汤面"
    ],
    "spicyLevels": [],
    "addons": [],
    "color": "#FFD23F",
    "meals": [
      "breakfast",
      "lunch",
      "dinner"
    ],
    "status": "on",
    "stock": -1,
    "isRecommended": false,
    "recipe": "云吞皮包虾仁肉馅\n水开下云吞和面条煮熟\n碗里加汤、盐、香油，捞入云吞面"
  },
  {
    "name": "红烧牛肉面",
    "desc": "大块牛肉，汤头浓郁",
    "price": 20,
    "categoryId": "staple",
    "tags": [
      "招牌"
    ],
    "spicyLevels": [],
    "addons": [],
    "color": "#FFD23F",
    "meals": [
      "lunch",
      "dinner"
    ],
    "status": "on",
    "stock": -1,
    "isRecommended": false,
    "recipe": "牛腩焯水炒糖色\n加生抽老抽八角姜片热水炖60分钟\n面条煮熟捞入碗，浇牛肉汤"
  },
  {
    "name": "酸辣粉",
    "desc": "酸辣开胃，粉条弹滑",
    "price": 10,
    "categoryId": "staple",
    "tags": [
      "酸辣"
    ],
    "spicyLevels": [
      "不辣",
      "微辣",
      "中辣"
    ],
    "addons": [],
    "color": "#FFD23F",
    "meals": [
      "lunch",
      "dinner"
    ],
    "status": "on",
    "stock": -1,
    "isRecommended": false,
    "recipe": "红薯粉泡软煮3分钟\n碗底放醋、辣椒油、花椒粉、生抽\n捞入粉条，加汤、花生碎和香菜"
  },
  {
    "name": "葱油饼",
    "desc": "层层酥脆，葱香十足",
    "price": 6,
    "categoryId": "staple",
    "tags": [
      "酥脆"
    ],
    "spicyLevels": [],
    "addons": [],
    "color": "#FFD23F",
    "meals": [
      "breakfast",
      "lunch"
    ],
    "status": "on",
    "stock": -1,
    "isRecommended": false,
    "recipe": "面团擀薄抹油撒盐和葱花\n卷起盘成团再擀平\n平底锅小火煎到两面金黄"
  },
  {
    "name": "韭菜盒子",
    "desc": "韭菜鸡蛋馅，煎得焦香",
    "price": 7,
    "categoryId": "staple",
    "tags": [
      "家常"
    ],
    "spicyLevels": [],
    "addons": [],
    "color": "#FFD23F",
    "meals": [
      "breakfast",
      "lunch"
    ],
    "status": "on",
    "stock": -1,
    "isRecommended": false,
    "recipe": "鸡蛋炒碎，韭菜切末拌馅\n面团擀皮包入馅料，捏边\n平底锅小火煎到两面金黄"
  },
  {
    "name": "小笼包",
    "desc": "皮薄馅大，一咬有汤",
    "price": 12,
    "categoryId": "staple",
    "tags": [
      "现蒸"
    ],
    "spicyLevels": [],
    "addons": [],
    "color": "#FFD23F",
    "meals": [
      "breakfast",
      "lunch"
    ],
    "status": "on",
    "stock": -1,
    "isRecommended": false,
    "recipe": "肉馅加葱姜水搅上劲\n面皮包馅收口\n水开上锅蒸8分钟"
  },
  {
    "name": "玉米虾仁粥",
    "desc": "清甜玉米配虾仁，早餐舒服",
    "price": 9,
    "categoryId": "staple",
    "tags": [
      "清淡"
    ],
    "spicyLevels": [],
    "addons": [],
    "color": "#FFD23F",
    "meals": [
      "breakfast"
    ],
    "status": "on",
    "stock": -1,
    "isRecommended": false,
    "recipe": "大米煮30分钟成粥\n下玉米粒和虾仁再煮5分钟\n加盐和白胡椒，撒葱花"
  },
  {
    "name": "麻婆豆腐",
    "desc": "麻辣烫嘴，豆腐嫩滑",
    "price": 12,
    "categoryId": "stirfry",
    "tags": [
      "下饭"
    ],
    "spicyLevels": [
      "不辣",
      "微辣",
      "中辣"
    ],
    "addons": [],
    "color": "#2D9CFF",
    "meals": [
      "lunch",
      "dinner"
    ],
    "status": "on",
    "stock": -1,
    "isRecommended": false,
    "recipe": "豆腐切块焯水\n炒香豆瓣酱肉末，加水下豆腐煮3分钟\n勾芡，撒花椒粉和葱花"
  },
  {
    "name": "回锅肉",
    "desc": "肥而不腻，蒜苗提香",
    "price": 18,
    "categoryId": "stirfry",
    "tags": [
      "下饭"
    ],
    "spicyLevels": [
      "不辣",
      "微辣"
    ],
    "addons": [],
    "color": "#2D9CFF",
    "meals": [
      "lunch",
      "dinner"
    ],
    "status": "on",
    "stock": -1,
    "isRecommended": false,
    "recipe": "五花肉煮15分钟切薄片\n煸炒出油，下豆瓣酱炒香\n加青蒜和青椒，翻匀出锅"
  },
  {
    "name": "木须肉",
    "desc": "肉片木耳黄瓜，家常又清爽",
    "price": 15,
    "categoryId": "stirfry",
    "tags": [
      "家常"
    ],
    "spicyLevels": [],
    "addons": [],
    "color": "#2D9CFF",
    "meals": [
      "lunch",
      "dinner"
    ],
    "status": "on",
    "stock": -1,
    "isRecommended": false,
    "recipe": "肉片用生抽淀粉腌10分钟\n炒散鸡蛋盛出，炒肉片和木耳黄瓜\n回锅加鸡蛋，调盐翻匀"
  },
  {
    "name": "京酱肉丝",
    "desc": "甜面酱裹肉丝，配葱丝豆腐皮",
    "price": 16,
    "categoryId": "stirfry",
    "tags": [
      "下饭"
    ],
    "spicyLevels": [],
    "addons": [],
    "color": "#2D9CFF",
    "meals": [
      "lunch",
      "dinner"
    ],
    "status": "on",
    "stock": -1,
    "isRecommended": false,
    "recipe": "肉丝腌10分钟，滑炒盛出\n甜面酱加糖炒香\n倒回肉丝翻匀，配葱丝豆腐皮"
  },
  {
    "name": "干煸四季豆",
    "desc": "四季豆干香，越嚼越香",
    "price": 12,
    "categoryId": "stirfry",
    "tags": [
      "下饭"
    ],
    "spicyLevels": [
      "不辣",
      "微辣"
    ],
    "addons": [],
    "color": "#2D9CFF",
    "meals": [
      "lunch",
      "dinner"
    ],
    "status": "on",
    "stock": -1,
    "isRecommended": false,
    "recipe": "四季豆撕筋，煸到表皮起皱\n下肉末和干辣椒炒香\n加生抽和盐，翻匀"
  },
  {
    "name": "地三鲜",
    "desc": "土豆茄子青椒，东北家常味",
    "price": 12,
    "categoryId": "stirfry",
    "tags": [
      "家常"
    ],
    "spicyLevels": [],
    "addons": [],
    "color": "#2D9CFF",
    "meals": [
      "lunch",
      "dinner"
    ],
    "status": "on",
    "stock": -1,
    "isRecommended": false,
    "recipe": "土豆茄子切块煎软\n炒香蒜末，下青椒\n回锅土豆茄子，加生抽糖勾芡"
  },
  {
    "name": "红烧茄子",
    "desc": "茄子吸满酱汁，软糯下饭",
    "price": 12,
    "categoryId": "stirfry",
    "tags": [
      "下饭"
    ],
    "spicyLevels": [],
    "addons": [],
    "color": "#2D9CFF",
    "meals": [
      "lunch",
      "dinner"
    ],
    "status": "on",
    "stock": -1,
    "isRecommended": false,
    "recipe": "茄子切条煎软\n炒香蒜末，下茄子\n加生抽糖和水，烧2分钟收汁"
  },
  {
    "name": "鱼香茄子",
    "desc": "酸甜微辣，没有鱼也香",
    "price": 12,
    "categoryId": "stirfry",
    "tags": [
      "下饭"
    ],
    "spicyLevels": [
      "不辣",
      "微辣"
    ],
    "addons": [],
    "color": "#2D9CFF",
    "meals": [
      "lunch",
      "dinner"
    ],
    "status": "on",
    "stock": -1,
    "isRecommended": false,
    "recipe": "茄子煎软\n炒香豆瓣酱蒜末，下茄子\n倒鱼香汁翻匀，撒葱花"
  },
  {
    "name": "家常豆腐",
    "desc": "豆腐外焦里嫩，配青椒很香",
    "price": 10,
    "categoryId": "stirfry",
    "tags": [
      "家常"
    ],
    "spicyLevels": [],
    "addons": [],
    "color": "#2D9CFF",
    "meals": [
      "lunch",
      "dinner"
    ],
    "status": "on",
    "stock": -1,
    "isRecommended": false,
    "recipe": "豆腐切片煎金黄\n炒香蒜末和青椒\n下豆腐加生抽蚝油，烧2分钟"
  },
  {
    "name": "番茄炒蛋",
    "desc": "酸甜经典，永远吃不腻",
    "price": 9,
    "categoryId": "stirfry",
    "tags": [
      "家常"
    ],
    "spicyLevels": [],
    "addons": [],
    "color": "#2D9CFF",
    "meals": [
      "lunch",
      "dinner"
    ],
    "status": "on",
    "stock": -1,
    "isRecommended": false,
    "recipe": "鸡蛋炒散盛出\n番茄炒出汁\n回锅鸡蛋，加盐糖翻匀"
  },
  {
    "name": "韭菜炒蛋",
    "desc": "快手小炒，韭菜香嫩",
    "price": 9,
    "categoryId": "stirfry",
    "tags": [
      "快手"
    ],
    "spicyLevels": [],
    "addons": [],
    "color": "#2D9CFF",
    "meals": [
      "lunch",
      "dinner"
    ],
    "status": "on",
    "stock": -1,
    "isRecommended": false,
    "recipe": "鸡蛋炒散\n下韭菜大火炒30秒\n加盐翻匀出锅"
  },
  {
    "name": "黄瓜炒蛋",
    "desc": "清爽解腻，夏天适合",
    "price": 9,
    "categoryId": "stirfry",
    "tags": [
      "清淡"
    ],
    "spicyLevels": [],
    "addons": [],
    "color": "#2D9CFF",
    "meals": [
      "lunch",
      "dinner"
    ],
    "status": "on",
    "stock": -1,
    "isRecommended": false,
    "recipe": "鸡蛋炒散\n下黄瓜片大火翻炒\n加盐和少许生抽，出锅"
  },
  {
    "name": "木耳炒肉",
    "desc": "木耳脆、肉片嫩",
    "price": 13,
    "categoryId": "stirfry",
    "tags": [
      "家常"
    ],
    "spicyLevels": [],
    "addons": [],
    "color": "#2D9CFF",
    "meals": [
      "lunch",
      "dinner"
    ],
    "status": "on",
    "stock": -1,
    "isRecommended": false,
    "recipe": "肉片腌10分钟\n炒肉片变色，下木耳和青椒\n加盐生抽翻匀"
  },
  {
    "name": "香菇青菜",
    "desc": "香菇鲜香，青菜清甜",
    "price": 8,
    "categoryId": "stirfry",
    "tags": [
      "素菜"
    ],
    "spicyLevels": [],
    "addons": [],
    "color": "#2D9CFF",
    "meals": [
      "lunch",
      "dinner"
    ],
    "status": "on",
    "stock": -1,
    "isRecommended": false,
    "recipe": "香菇切片，青菜洗净\n炒香蒜末，下香菇炒软\n下青菜大火炒1分钟，加盐"
  },
  {
    "name": "蚝油生菜",
    "desc": "爽脆生菜淋蚝油，简单好吃",
    "price": 7,
    "categoryId": "stirfry",
    "tags": [
      "素菜"
    ],
    "spicyLevels": [],
    "addons": [],
    "color": "#2D9CFF",
    "meals": [
      "lunch",
      "dinner"
    ],
    "status": "on",
    "stock": -1,
    "isRecommended": false,
    "recipe": "生菜掰开洗净\n水开焯10秒捞出\n淋蚝油、生抽和热油"
  },
  {
    "name": "蒜蓉空心菜",
    "desc": "蒜香浓郁，脆嫩不出水",
    "price": 7,
    "categoryId": "stirfry",
    "tags": [
      "素菜"
    ],
    "spicyLevels": [],
    "addons": [],
    "color": "#2D9CFF",
    "meals": [
      "lunch",
      "dinner"
    ],
    "status": "on",
    "stock": -1,
    "isRecommended": false,
    "recipe": "空心菜切段\n蒜末爆香\n大火下空心菜炒1分钟，加盐出锅"
  },
  {
    "name": "清炒荷兰豆",
    "desc": "荷兰豆脆甜，颜色好看",
    "price": 9,
    "categoryId": "stirfry",
    "tags": [
      "素菜"
    ],
    "spicyLevels": [],
    "addons": [],
    "color": "#2D9CFF",
    "meals": [
      "lunch",
      "dinner"
    ],
    "status": "on",
    "stock": -1,
    "isRecommended": false,
    "recipe": "荷兰豆撕筋焯水30秒\n蒜末爆香\n下荷兰豆大火炒1分钟，加盐"
  },
  {
    "name": "干锅花菜",
    "desc": "花菜微焦，带点辣更香",
    "price": 12,
    "categoryId": "stirfry",
    "tags": [
      "下饭"
    ],
    "spicyLevels": [
      "不辣",
      "微辣"
    ],
    "addons": [],
    "color": "#2D9CFF",
    "meals": [
      "lunch",
      "dinner"
    ],
    "status": "on",
    "stock": -1,
    "isRecommended": false,
    "recipe": "花菜掰小朵焯水\n炒香五花肉和干辣椒\n下花菜加生抽，炒到微焦"
  },
  {
    "name": "辣子鸡丁",
    "desc": "干辣椒里找鸡丁，越吃越香",
    "price": 18,
    "categoryId": "stirfry",
    "tags": [
      "下饭"
    ],
    "spicyLevels": [
      "不辣",
      "微辣",
      "中辣"
    ],
    "addons": [],
    "color": "#2D9CFF",
    "meals": [
      "lunch",
      "dinner"
    ],
    "status": "on",
    "stock": -1,
    "isRecommended": false,
    "recipe": "鸡丁用生抽淀粉腌10分钟\n炸到金黄捞出\n炒香干辣椒花椒，回锅鸡丁翻匀"
  },
  {
    "name": "糖醋里脊",
    "desc": "外酥里嫩，酸甜开胃",
    "price": 18,
    "categoryId": "stirfry",
    "tags": [
      "酸甜"
    ],
    "spicyLevels": [],
    "addons": [],
    "color": "#2D9CFF",
    "meals": [
      "lunch",
      "dinner"
    ],
    "status": "on",
    "stock": -1,
    "isRecommended": false,
    "recipe": "里脊切条用盐料酒腌10分钟\n裹淀粉炸到金黄\n倒糖醋汁翻匀"
  },
  {
    "name": "锅包肉",
    "desc": "东北酸甜口，外壳酥脆",
    "price": 20,
    "categoryId": "stirfry",
    "tags": [
      "酸甜"
    ],
    "spicyLevels": [],
    "addons": [],
    "color": "#2D9CFF",
    "meals": [
      "lunch",
      "dinner"
    ],
    "status": "on",
    "stock": -1,
    "isRecommended": false,
    "recipe": "里脊切片裹淀粉糊\n炸两遍到酥脆\n倒糖醋汁快速翻匀，撒葱丝"
  },
  {
    "name": "红烧鸡块",
    "desc": "酱香浓郁，鸡肉入味",
    "price": 16,
    "categoryId": "stirfry",
    "tags": [
      "家常"
    ],
    "spicyLevels": [],
    "addons": [],
    "color": "#2D9CFF",
    "meals": [
      "lunch",
      "dinner"
    ],
    "status": "on",
    "stock": -1,
    "isRecommended": false,
    "recipe": "鸡块焯水\n炒糖色下鸡块，加生抽老抽姜片\n加热水炖25分钟收汁"
  },
  {
    "name": "啤酒鸭",
    "desc": "啤酒去腥提香，鸭肉软烂",
    "price": 22,
    "categoryId": "stirfry",
    "tags": [
      "招牌"
    ],
    "spicyLevels": [
      "不辣",
      "微辣"
    ],
    "addons": [],
    "color": "#2D9CFF",
    "meals": [
      "lunch",
      "dinner"
    ],
    "status": "on",
    "stock": -1,
    "isRecommended": false,
    "recipe": "鸭块焯水煸出油\n加姜片、生抽、老抽和啤酒\n中小火炖40分钟收汁"
  },
  {
    "name": "小炒黄牛肉",
    "desc": "牛肉嫩，小米辣够劲",
    "price": 24,
    "categoryId": "stirfry",
    "tags": [
      "下饭"
    ],
    "spicyLevels": [
      "不辣",
      "微辣",
      "中辣"
    ],
    "addons": [],
    "color": "#2D9CFF",
    "meals": [
      "lunch",
      "dinner"
    ],
    "status": "on",
    "stock": -1,
    "isRecommended": false,
    "recipe": "牛肉切薄片用生抽淀粉腌10分钟\n大火快炒牛肉盛出\n炒香小米辣蒜末，回锅牛肉翻匀"
  },
  {
    "name": "孜然羊肉",
    "desc": "孜然香像烧烤，配洋葱绝了",
    "price": 24,
    "categoryId": "stirfry",
    "tags": [
      "烧烤味"
    ],
    "spicyLevels": [
      "不辣",
      "微辣"
    ],
    "addons": [],
    "color": "#2D9CFF",
    "meals": [
      "lunch",
      "dinner"
    ],
    "status": "on",
    "stock": -1,
    "isRecommended": false,
    "recipe": "羊肉片用盐和料酒腌10分钟\n大火炒到变色\n加孜然粉辣椒粉和洋葱，翻匀"
  },
  {
    "name": "洋葱炒牛肉",
    "desc": "洋葱微甜，牛肉嫩滑",
    "price": 20,
    "categoryId": "stirfry",
    "tags": [
      "家常"
    ],
    "spicyLevels": [],
    "addons": [],
    "color": "#2D9CFF",
    "meals": [
      "lunch",
      "dinner"
    ],
    "status": "on",
    "stock": -1,
    "isRecommended": false,
    "recipe": "牛肉片腌10分钟\n大火炒牛肉盛出\n炒香洋葱，回锅牛肉加黑胡椒"
  },
  {
    "name": "青椒肉丝",
    "desc": "青椒脆爽，肉丝入味",
    "price": 14,
    "categoryId": "stirfry",
    "tags": [
      "下饭"
    ],
    "spicyLevels": [
      "不辣",
      "微辣"
    ],
    "addons": [],
    "color": "#2D9CFF",
    "meals": [
      "lunch",
      "dinner"
    ],
    "status": "on",
    "stock": -1,
    "isRecommended": false,
    "recipe": "肉丝腌10分钟\n滑炒肉丝变色\n下青椒丝，加盐生抽翻匀"
  },
  {
    "name": "酸豆角肉末",
    "desc": "酸豆角开胃，配粥配饭都行",
    "price": 12,
    "categoryId": "stirfry",
    "tags": [
      "下饭"
    ],
    "spicyLevels": [
      "不辣",
      "微辣"
    ],
    "addons": [],
    "color": "#2D9CFF",
    "meals": [
      "lunch",
      "dinner"
    ],
    "status": "on",
    "stock": -1,
    "isRecommended": false,
    "recipe": "酸豆角切丁\n炒香肉末和蒜末\n下酸豆角和小米辣，炒2分钟"
  },
  {
    "name": "肉末茄子",
    "desc": "茄子软糯，肉末咸香",
    "price": 12,
    "categoryId": "stirfry",
    "tags": [
      "下饭"
    ],
    "spicyLevels": [],
    "addons": [],
    "color": "#2D9CFF",
    "meals": [
      "lunch",
      "dinner"
    ],
    "status": "on",
    "stock": -1,
    "isRecommended": false,
    "recipe": "茄子切条煎软\n炒香肉末和蒜末\n下茄子加生抽糖，烧2分钟"
  },
  {
    "name": "蒜苔炒肉",
    "desc": "蒜苔脆嫩，家常下饭",
    "price": 14,
    "categoryId": "stirfry",
    "tags": [
      "家常"
    ],
    "spicyLevels": [],
    "addons": [],
    "color": "#2D9CFF",
    "meals": [
      "lunch",
      "dinner"
    ],
    "status": "on",
    "stock": -1,
    "isRecommended": false,
    "recipe": "肉片腌10分钟\n炒肉片变色\n下蒜苔炒2分钟，加盐生抽"
  },
  {
    "name": "西芹百合",
    "desc": "清清爽爽，脆甜解腻",
    "price": 10,
    "categoryId": "stirfry",
    "tags": [
      "清淡"
    ],
    "spicyLevels": [],
    "addons": [],
    "color": "#2D9CFF",
    "meals": [
      "lunch",
      "dinner"
    ],
    "status": "on",
    "stock": -1,
    "isRecommended": false,
    "recipe": "西芹切段焯水30秒\n炒香蒜末\n下西芹和百合大火炒1分钟，加盐"
  },
  {
    "name": "醋溜白菜",
    "desc": "酸香开胃，白菜帮最脆",
    "price": 7,
    "categoryId": "stirfry",
    "tags": [
      "素菜"
    ],
    "spicyLevels": [],
    "addons": [],
    "color": "#2D9CFF",
    "meals": [
      "lunch",
      "dinner"
    ],
    "status": "on",
    "stock": -1,
    "isRecommended": false,
    "recipe": "白菜切片，帮叶分开\n热油下辣椒和蒜末，先炒帮\n下叶子加醋和盐，大火炒1分钟"
  },
  {
    "name": "干煸杏鲍菇",
    "desc": "杏鲍菇干香有嚼劲",
    "price": 10,
    "categoryId": "stirfry",
    "tags": [
      "素菜"
    ],
    "spicyLevels": [
      "不辣",
      "微辣"
    ],
    "addons": [],
    "color": "#2D9CFF",
    "meals": [
      "lunch",
      "dinner"
    ],
    "status": "on",
    "stock": -1,
    "isRecommended": false,
    "recipe": "杏鲍菇撕条\n干锅煸到微焦\n加孜然粉辣椒粉和盐，翻匀"
  },
  {
    "name": "椒盐杏鲍菇",
    "desc": "外酥里嫩，椒盐味十足",
    "price": 11,
    "categoryId": "stirfry",
    "tags": [
      "下饭"
    ],
    "spicyLevels": [],
    "addons": [],
    "color": "#2D9CFF",
    "meals": [
      "lunch",
      "dinner"
    ],
    "status": "on",
    "stock": -1,
    "isRecommended": false,
    "recipe": "杏鲍菇撕条裹薄淀粉\n炸到金黄\n撒椒盐翻匀"
  },
  {
    "name": "蒜香排骨",
    "desc": "蒜味浓郁，排骨外酥里嫩",
    "price": 22,
    "categoryId": "stirfry",
    "tags": [
      "招牌"
    ],
    "spicyLevels": [],
    "addons": [],
    "color": "#2D9CFF",
    "meals": [
      "lunch",
      "dinner"
    ],
    "status": "on",
    "stock": -1,
    "isRecommended": false,
    "recipe": "排骨用蒜末生抽腌1小时\n裹淀粉炸到金黄\n复炸一遍，撒蒜末"
  },
  {
    "name": "清蒸鲈鱼",
    "desc": "鱼肉鲜嫩，清淡不腻",
    "price": 24,
    "categoryId": "stirfry",
    "tags": [
      "清淡",
      "高蛋白"
    ],
    "spicyLevels": [],
    "addons": [],
    "color": "#2D9CFF",
    "meals": [
      "lunch",
      "dinner"
    ],
    "status": "on",
    "stock": -1,
    "isRecommended": false,
    "recipe": "鲈鱼处理干净划刀，铺姜片\n水开上锅蒸8分钟\n倒掉汤汁，淋蒸鱼豉油和热油，撒葱丝"
  },
  {
    "name": "紫菜虾皮汤",
    "desc": "快手鲜汤，三分钟搞定",
    "price": 5,
    "categoryId": "soup",
    "tags": [
      "快手"
    ],
    "spicyLevels": [],
    "addons": [],
    "color": "#2FBF71",
    "meals": [
      "lunch",
      "dinner"
    ],
    "status": "on",
    "stock": -1,
    "isRecommended": false,
    "recipe": "水开撕入紫菜\n加虾皮、盐和生抽\n淋蛋液，滴香油"
  },
  {
    "name": "海带排骨汤",
    "desc": "海带软糯，排骨汤清甜",
    "price": 12,
    "categoryId": "soup",
    "tags": [
      "家常"
    ],
    "spicyLevels": [],
    "addons": [],
    "color": "#2FBF71",
    "meals": [
      "lunch",
      "dinner"
    ],
    "status": "on",
    "stock": -1,
    "isRecommended": false,
    "recipe": "排骨焯水\n加海带结和姜片炖40分钟\n加盐和白胡椒"
  },
  {
    "name": "莲藕排骨汤",
    "desc": "莲藕粉糯，汤头清甜",
    "price": 13,
    "categoryId": "soup",
    "tags": [
      "家常"
    ],
    "spicyLevels": [],
    "addons": [],
    "color": "#2FBF71",
    "meals": [
      "lunch",
      "dinner"
    ],
    "status": "on",
    "stock": -1,
    "isRecommended": false,
    "recipe": "排骨焯水\n加莲藕块和姜片炖50分钟\n加盐调味"
  },
  {
    "name": "山药排骨汤",
    "desc": "山药软糯，暖胃养生",
    "price": 12,
    "categoryId": "soup",
    "tags": [
      "养生"
    ],
    "spicyLevels": [],
    "addons": [],
    "color": "#2FBF71",
    "meals": [
      "lunch",
      "dinner"
    ],
    "status": "on",
    "stock": -1,
    "isRecommended": false,
    "recipe": "排骨焯水\n加山药块炖30分钟\n加盐和枸杞"
  },
  {
    "name": "番茄牛腩汤",
    "desc": "番茄酸甜，牛腩软烂",
    "price": 18,
    "categoryId": "soup",
    "tags": [
      "招牌"
    ],
    "spicyLevels": [],
    "addons": [],
    "color": "#2FBF71",
    "meals": [
      "lunch",
      "dinner"
    ],
    "status": "on",
    "stock": -1,
    "isRecommended": false,
    "recipe": "牛腩焯水\n番茄炒出汁，下牛腩加水炖60分钟\n加盐和糖调味"
  },
  {
    "name": "萝卜牛腩汤",
    "desc": "白萝卜吸满牛肉汤",
    "price": 18,
    "categoryId": "soup",
    "tags": [
      "家常"
    ],
    "spicyLevels": [],
    "addons": [],
    "color": "#2FBF71",
    "meals": [
      "lunch",
      "dinner"
    ],
    "status": "on",
    "stock": -1,
    "isRecommended": false,
    "recipe": "牛腩焯水加姜片炖50分钟\n下白萝卜块再炖15分钟\n加盐和白胡椒"
  },
  {
    "name": "菌菇鸡汤",
    "desc": "多种菌菇，汤鲜味美",
    "price": 16,
    "categoryId": "soup",
    "tags": [
      "养生"
    ],
    "spicyLevels": [],
    "addons": [],
    "color": "#2FBF71",
    "meals": [
      "lunch",
      "dinner"
    ],
    "status": "on",
    "stock": -1,
    "isRecommended": false,
    "recipe": "鸡块焯水\n加香菇、杏鲍菇和姜片炖40分钟\n加盐调味"
  },
  {
    "name": "老母鸡汤",
    "desc": "慢炖一锅，汤色金黄",
    "price": 20,
    "categoryId": "soup",
    "tags": [
      "养生"
    ],
    "spicyLevels": [],
    "addons": [],
    "color": "#2FBF71",
    "meals": [
      "lunch",
      "dinner"
    ],
    "status": "on",
    "stock": -1,
    "isRecommended": false,
    "recipe": "鸡块焯水\n加姜片和足量水炖90分钟\n加盐，撒枸杞"
  },
  {
    "name": "银耳莲子羹",
    "desc": "胶质浓稠，甜而不腻",
    "price": 8,
    "categoryId": "soup",
    "tags": [
      "甜汤"
    ],
    "spicyLevels": [],
    "addons": [],
    "color": "#2FBF71",
    "meals": [
      "breakfast",
      "lunch",
      "dinner"
    ],
    "status": "on",
    "stock": -1,
    "isRecommended": false,
    "recipe": "银耳泡发撕小朵\n加莲子和水炖40分钟\n加冰糖和红枣再炖10分钟"
  },
  {
    "name": "绿豆汤",
    "desc": "夏天必备，解暑清爽",
    "price": 5,
    "categoryId": "soup",
    "tags": [
      "解暑"
    ],
    "spicyLevels": [],
    "addons": [],
    "color": "#2FBF71",
    "meals": [
      "lunch",
      "dinner"
    ],
    "status": "on",
    "stock": -1,
    "isRecommended": false,
    "recipe": "绿豆洗净加水煮开\n转小火煮30分钟\n加冰糖，放凉"
  },
  {
    "name": "红豆汤",
    "desc": "红豆软烂，暖胃甜品",
    "price": 6,
    "categoryId": "soup",
    "tags": [
      "暖胃"
    ],
    "spicyLevels": [],
    "addons": [],
    "color": "#2FBF71",
    "meals": [
      "lunch",
      "dinner"
    ],
    "status": "on",
    "stock": -1,
    "isRecommended": false,
    "recipe": "红豆提前泡2小时\n加水煮40分钟到软烂\n加冰糖煮化"
  },
  {
    "name": "南瓜浓汤",
    "desc": "南瓜香甜，口感顺滑",
    "price": 8,
    "categoryId": "soup",
    "tags": [
      "西式"
    ],
    "spicyLevels": [],
    "addons": [],
    "color": "#2FBF71",
    "meals": [
      "breakfast",
      "lunch",
      "dinner"
    ],
    "status": "on",
    "stock": -1,
    "isRecommended": false,
    "recipe": "南瓜蒸熟压泥\n加牛奶和少许水煮开\n加盐和黑胡椒，搅匀"
  },
  {
    "name": "奶油蘑菇汤",
    "desc": "奶香浓郁，蘑菇鲜美",
    "price": 10,
    "categoryId": "soup",
    "tags": [
      "西式"
    ],
    "spicyLevels": [],
    "addons": [],
    "color": "#2FBF71",
    "meals": [
      "lunch",
      "dinner"
    ],
    "status": "on",
    "stock": -1,
    "isRecommended": false,
    "recipe": "蘑菇切片炒香\n加黄油面粉和牛奶煮开\n加盐黑胡椒，打成浓汤"
  },
  {
    "name": "罗宋汤",
    "desc": "番茄牛肉蔬菜汤，酸甜开胃",
    "price": 12,
    "categoryId": "soup",
    "tags": [
      "西式"
    ],
    "spicyLevels": [],
    "addons": [],
    "color": "#2FBF71",
    "meals": [
      "lunch",
      "dinner"
    ],
    "status": "on",
    "stock": -1,
    "isRecommended": false,
    "recipe": "牛肉切块焯水\n番茄洋葱土豆胡萝卜炒香\n加牛肉和水炖40分钟，加盐和番茄酱"
  },
  {
    "name": "冬瓜丸子汤",
    "desc": "清淡鲜美，丸子嫩滑",
    "price": 10,
    "categoryId": "soup",
    "tags": [
      "清淡"
    ],
    "spicyLevels": [],
    "addons": [],
    "color": "#2FBF71",
    "meals": [
      "lunch",
      "dinner"
    ],
    "status": "on",
    "stock": -1,
    "isRecommended": false,
    "recipe": "肉末加盐淀粉搅上劲，挤成丸子\n水开下丸子煮3分钟\n下冬瓜片再煮5分钟，加盐"
  },
  {
    "name": "可乐",
    "desc": "冰镇快乐水",
    "price": 3,
    "categoryId": "drink",
    "tags": [
      "冰饮"
    ],
    "spicyLevels": [],
    "addons": [],
    "color": "#FF5C8A",
    "meals": [
      "lunch",
      "dinner"
    ],
    "status": "on",
    "stock": -1,
    "isRecommended": false,
    "recipe": "冰镇可乐倒入杯中\n加冰块和柠檬片"
  },
  {
    "name": "雪碧",
    "desc": "气泡足，清凉解渴",
    "price": 3,
    "categoryId": "drink",
    "tags": [
      "冰饮"
    ],
    "spicyLevels": [],
    "addons": [],
    "color": "#FF5C8A",
    "meals": [
      "lunch",
      "dinner"
    ],
    "status": "on",
    "stock": -1,
    "isRecommended": false,
    "recipe": "冰镇雪碧倒入杯中\n加冰块和薄荷叶"
  },
  {
    "name": "鲜榨橙汁",
    "desc": "现榨橙汁，酸甜新鲜",
    "price": 8,
    "categoryId": "drink",
    "tags": [
      "鲜榨"
    ],
    "spicyLevels": [],
    "addons": [],
    "color": "#FF5C8A",
    "meals": [
      "breakfast",
      "lunch",
      "dinner"
    ],
    "status": "on",
    "stock": -1,
    "isRecommended": false,
    "recipe": "橙子去皮切块\n榨汁机榨汁\n加冰块，可加一点蜂蜜"
  },
  {
    "name": "西瓜汁",
    "desc": "夏天来一杯，清甜解暑",
    "price": 8,
    "categoryId": "drink",
    "tags": [
      "鲜榨"
    ],
    "spicyLevels": [],
    "addons": [],
    "color": "#FF5C8A",
    "meals": [
      "lunch",
      "dinner"
    ],
    "status": "on",
    "stock": -1,
    "isRecommended": false,
    "recipe": "西瓜去籽切块\n榨汁\n过滤后加冰块"
  },
  {
    "name": "芒果汁",
    "desc": "芒果香浓，口感顺滑",
    "price": 9,
    "categoryId": "drink",
    "tags": [
      "鲜榨"
    ],
    "spicyLevels": [],
    "addons": [],
    "color": "#FF5C8A",
    "meals": [
      "lunch",
      "dinner"
    ],
    "status": "on",
    "stock": -1,
    "isRecommended": false,
    "recipe": "芒果切块\n加少许牛奶榨汁\n加冰块"
  },
  {
    "name": "草莓奶昔",
    "desc": "草莓加奶，甜甜的",
    "price": 12,
    "categoryId": "drink",
    "tags": [
      "奶昔"
    ],
    "spicyLevels": [],
    "addons": [],
    "color": "#FF5C8A",
    "meals": [
      "lunch",
      "dinner"
    ],
    "status": "on",
    "stock": -1,
    "isRecommended": false,
    "recipe": "草莓洗净去蒂\n加牛奶和酸奶打成奶昔\n加冰块"
  },
  {
    "name": "香蕉牛奶",
    "desc": "香蕉和牛奶，早餐好搭档",
    "price": 9,
    "categoryId": "drink",
    "tags": [
      "奶昔"
    ],
    "spicyLevels": [],
    "addons": [],
    "color": "#FF5C8A",
    "meals": [
      "breakfast",
      "lunch"
    ],
    "status": "on",
    "stock": -1,
    "isRecommended": false,
    "recipe": "香蕉切段\n加牛奶榨匀\n加蜂蜜调味"
  },
  {
    "name": "拿铁",
    "desc": "咖啡加奶，温柔一点",
    "price": 12,
    "categoryId": "drink",
    "tags": [
      "咖啡"
    ],
    "spicyLevels": [],
    "addons": [],
    "color": "#FF5C8A",
    "meals": [
      "breakfast",
      "lunch"
    ],
    "status": "on",
    "stock": -1,
    "isRecommended": false,
    "recipe": "浓缩咖啡一份\n牛奶加热打奶泡\n先倒牛奶再淋咖啡"
  },
  {
    "name": "卡布奇诺",
    "desc": "奶泡厚厚一层",
    "price": 12,
    "categoryId": "drink",
    "tags": [
      "咖啡"
    ],
    "spicyLevels": [],
    "addons": [],
    "color": "#FF5C8A",
    "meals": [
      "breakfast",
      "lunch"
    ],
    "status": "on",
    "stock": -1,
    "isRecommended": false,
    "recipe": "浓缩咖啡一份\n牛奶打发奶泡\n倒牛奶撒可可粉"
  },
  {
    "name": "热可可",
    "desc": "冬天喝一杯，暖到心里",
    "price": 10,
    "categoryId": "drink",
    "tags": [
      "热饮"
    ],
    "spicyLevels": [],
    "addons": [],
    "color": "#FF5C8A",
    "meals": [
      "breakfast",
      "lunch",
      "dinner"
    ],
    "status": "on",
    "stock": -1,
    "isRecommended": false,
    "recipe": "可可粉加少许热水化开\n倒入热牛奶搅匀\n加糖和棉花糖"
  },
  {
    "name": "珍珠奶茶",
    "desc": "珍珠弹牙，奶茶香浓",
    "price": 12,
    "categoryId": "drink",
    "tags": [
      "奶茶"
    ],
    "spicyLevels": [],
    "addons": [],
    "color": "#FF5C8A",
    "meals": [
      "lunch",
      "dinner"
    ],
    "status": "on",
    "stock": -1,
    "isRecommended": false,
    "recipe": "珍珠煮熟过冷水\n红茶加牛奶和糖调成奶茶\n杯底放珍珠，倒入奶茶"
  },
  {
    "name": "芋泥奶茶",
    "desc": "芋泥绵密，奶茶顺滑",
    "price": 14,
    "categoryId": "drink",
    "tags": [
      "奶茶"
    ],
    "spicyLevels": [],
    "addons": [],
    "color": "#FF5C8A",
    "meals": [
      "lunch",
      "dinner"
    ],
    "status": "on",
    "stock": -1,
    "isRecommended": false,
    "recipe": "芋头蒸熟压泥加牛奶\n红茶加牛奶和糖\n杯底放芋泥，倒入奶茶"
  },
  {
    "name": "柠檬红茶",
    "desc": "清爽解腻，酸甜刚好",
    "price": 8,
    "categoryId": "drink",
    "tags": [
      "茶饮"
    ],
    "spicyLevels": [],
    "addons": [],
    "color": "#FF5C8A",
    "meals": [
      "lunch",
      "dinner"
    ],
    "status": "on",
    "stock": -1,
    "isRecommended": false,
    "recipe": "红茶泡开\n加柠檬片和糖\n加冰块"
  },
  {
    "name": "蜂蜜柠檬水",
    "desc": "简单清爽，随时能喝",
    "price": 7,
    "categoryId": "drink",
    "tags": [
      "茶饮"
    ],
    "spicyLevels": [],
    "addons": [],
    "color": "#FF5C8A",
    "meals": [
      "breakfast",
      "lunch",
      "dinner"
    ],
    "status": "on",
    "stock": -1,
    "isRecommended": false,
    "recipe": "柠檬切片\n加温水和蜂蜜搅匀\n可加冰块"
  },
  {
    "name": "酸梅汤",
    "desc": "解腻开胃，冰镇更好喝",
    "price": 6,
    "categoryId": "drink",
    "tags": [
      "解暑"
    ],
    "spicyLevels": [],
    "addons": [],
    "color": "#FF5C8A",
    "meals": [
      "lunch",
      "dinner"
    ],
    "status": "on",
    "stock": -1,
    "isRecommended": false,
    "recipe": "乌梅山楂加水煮30分钟\n加冰糖煮化\n过滤放凉"
  },
  {
    "name": "椰子水",
    "desc": "清甜补水",
    "price": 8,
    "categoryId": "drink",
    "tags": [
      "冰饮"
    ],
    "spicyLevels": [],
    "addons": [],
    "color": "#FF5C8A",
    "meals": [
      "lunch",
      "dinner"
    ],
    "status": "on",
    "stock": -1,
    "isRecommended": false,
    "recipe": "椰子水倒入杯中\n加冰块和薄荷"
  },
  {
    "name": "气泡水",
    "desc": "无糖气泡水，清爽",
    "price": 5,
    "categoryId": "drink",
    "tags": [
      "冰饮"
    ],
    "spicyLevels": [],
    "addons": [],
    "color": "#FF5C8A",
    "meals": [
      "lunch",
      "dinner"
    ],
    "status": "on",
    "stock": -1,
    "isRecommended": false,
    "recipe": "气泡水倒入杯中\n加柠檬片和冰块"
  },
  {
    "name": "原味酸奶",
    "desc": "饭后一杯，助消化",
    "price": 6,
    "categoryId": "drink",
    "tags": [
      "酸奶"
    ],
    "spicyLevels": [],
    "addons": [],
    "color": "#FF5C8A",
    "meals": [
      "breakfast",
      "lunch"
    ],
    "status": "on",
    "stock": -1,
    "isRecommended": false,
    "recipe": "酸奶倒入杯中\n加水果丁或蜂蜜\n搅匀"
  },
  {
    "name": "米浆",
    "desc": "米香浓郁，早餐暖胃",
    "price": 5,
    "categoryId": "drink",
    "tags": [
      "热饮"
    ],
    "spicyLevels": [],
    "addons": [],
    "color": "#FF5C8A",
    "meals": [
      "breakfast"
    ],
    "status": "on",
    "stock": -1,
    "isRecommended": false,
    "recipe": "大米提前泡2小时\n加水打成米浆\n煮沸后加糖"
  },
  {
    "name": "红枣枸杞茶",
    "desc": "养生热饮，甜甜的",
    "price": 6,
    "categoryId": "drink",
    "tags": [
      "热饮"
    ],
    "spicyLevels": [],
    "addons": [],
    "color": "#FF5C8A",
    "meals": [
      "breakfast",
      "lunch",
      "dinner"
    ],
    "status": "on",
    "stock": -1,
    "isRecommended": false,
    "recipe": "红枣去核，枸杞洗净\n加热水泡10分钟\n可加冰糖"
  },
  {
    "name": "提拉米苏",
    "desc": "咖啡和可可粉，入口即化",
    "price": 18,
    "categoryId": "dessert",
    "tags": [
      "西式"
    ],
    "spicyLevels": [],
    "addons": [],
    "color": "#FF6B35",
    "meals": [
      "lunch",
      "dinner"
    ],
    "status": "on",
    "stock": -1,
    "isRecommended": false,
    "recipe": "马斯卡彭加糖和蛋黄拌匀\n手指饼干蘸咖啡液铺底\n分层铺奶酪糊，冷藏4小时，撒可可粉"
  },
  {
    "name": "芝士蛋糕",
    "desc": "芝士味浓，口感绵密",
    "price": 16,
    "categoryId": "dessert",
    "tags": [
      "西式"
    ],
    "spicyLevels": [],
    "addons": [],
    "color": "#FF6B35",
    "meals": [
      "lunch",
      "dinner"
    ],
    "status": "on",
    "stock": -1,
    "isRecommended": false,
    "recipe": "奶油奶酪加糖软化拌匀\n加鸡蛋和酸奶搅匀，倒模具\n烤箱160度40分钟，冷藏后脱模"
  },
  {
    "name": "巧克力布朗尼",
    "desc": "浓郁巧克力，外脆内软",
    "price": 14,
    "categoryId": "dessert",
    "tags": [
      "西式"
    ],
    "spicyLevels": [],
    "addons": [],
    "color": "#FF6B35",
    "meals": [
      "lunch",
      "dinner"
    ],
    "status": "on",
    "stock": -1,
    "isRecommended": false,
    "recipe": "黑巧和黄油融化\n加糖鸡蛋面粉拌匀\n烤箱180度20分钟，切块"
  },
  {
    "name": "葡式蛋挞",
    "desc": "挞皮酥脆，蛋香浓郁",
    "price": 6,
    "categoryId": "dessert",
    "tags": [
      "现烤"
    ],
    "spicyLevels": [],
    "addons": [],
    "color": "#FF6B35",
    "meals": [
      "breakfast",
      "lunch"
    ],
    "status": "on",
    "stock": -1,
    "isRecommended": false,
    "recipe": "蛋挞皮解冻\n牛奶淡奶油加糖蛋黄调成挞液\n倒入挞皮，烤箱200度20分钟"
  },
  {
    "name": "奶油泡芙",
    "desc": "一口爆浆，奶油满满",
    "price": 10,
    "categoryId": "dessert",
    "tags": [
      "西式"
    ],
    "spicyLevels": [],
    "addons": [],
    "color": "#FF6B35",
    "meals": [
      "lunch",
      "dinner"
    ],
    "status": "on",
    "stock": -1,
    "isRecommended": false,
    "recipe": "黄油水煮开，加面粉烫熟\n分次加蛋液搅匀，挤成小球\n烤箱190度25分钟，挤入奶油"
  },
  {
    "name": "芒果班戟",
    "desc": "薄皮包着奶油和芒果",
    "price": 14,
    "categoryId": "dessert",
    "tags": [
      "港式"
    ],
    "spicyLevels": [],
    "addons": [],
    "color": "#FF6B35",
    "meals": [
      "lunch",
      "dinner"
    ],
    "status": "on",
    "stock": -1,
    "isRecommended": false,
    "recipe": "面糊摊成薄皮\n打发奶油，芒果切条\n饼皮包奶油和芒果，冷藏"
  },
  {
    "name": "杨枝甘露",
    "desc": "芒果西柚西米，港式经典",
    "price": 16,
    "categoryId": "dessert",
    "tags": [
      "港式"
    ],
    "spicyLevels": [],
    "addons": [],
    "color": "#FF6B35",
    "meals": [
      "lunch",
      "dinner"
    ],
    "status": "on",
    "stock": -1,
    "isRecommended": false,
    "recipe": "芒果打成果泥加牛奶\n西柚剥粒，西米煮透\n碗里放西米、芒果泥和西柚"
  },
  {
    "name": "红豆沙",
    "desc": "细腻香甜，热乎的最好喝",
    "price": 8,
    "categoryId": "dessert",
    "tags": [
      "中式"
    ],
    "spicyLevels": [],
    "addons": [],
    "color": "#FF6B35",
    "meals": [
      "lunch",
      "dinner"
    ],
    "status": "on",
    "stock": -1,
    "isRecommended": false,
    "recipe": "红豆泡2小时煮软\n加冰糖压成泥\n可加牛奶或椰浆"
  },
  {
    "name": "绿豆糕",
    "desc": "入口即化，清甜不腻",
    "price": 8,
    "categoryId": "dessert",
    "tags": [
      "中式"
    ],
    "spicyLevels": [],
    "addons": [],
    "color": "#FF6B35",
    "meals": [
      "lunch",
      "dinner"
    ],
    "status": "on",
    "stock": -1,
    "isRecommended": false,
    "recipe": "绿豆蒸熟压泥\n加糖和黄油炒干\n压模成型，冷藏"
  },
  {
    "name": "桂花糕",
    "desc": "软糯清香，桂花味很秋天",
    "price": 8,
    "categoryId": "dessert",
    "tags": [
      "中式"
    ],
    "spicyLevels": [],
    "addons": [],
    "color": "#FF6B35",
    "meals": [
      "breakfast",
      "lunch"
    ],
    "status": "on",
    "stock": -1,
    "isRecommended": false,
    "recipe": "糯米粉加糖水拌成糊\n上锅蒸20分钟\n撒桂花，放凉切块"
  },
  {
    "name": "糯米糍",
    "desc": "糯米皮包馅，软糯拉丝",
    "price": 9,
    "categoryId": "dessert",
    "tags": [
      "中式"
    ],
    "spicyLevels": [],
    "addons": [],
    "color": "#FF6B35",
    "meals": [
      "lunch",
      "dinner"
    ],
    "status": "on",
    "stock": -1,
    "isRecommended": false,
    "recipe": "糯米粉加糖水蒸熟\n包入豆沙或芒果\n滚椰蓉"
  },
  {
    "name": "芋圆烧仙草",
    "desc": "仙草配芋圆，料很足",
    "price": 13,
    "categoryId": "dessert",
    "tags": [
      "台式"
    ],
    "spicyLevels": [],
    "addons": [],
    "color": "#FF6B35",
    "meals": [
      "lunch",
      "dinner"
    ],
    "status": "on",
    "stock": -1,
    "isRecommended": false,
    "recipe": "仙草粉煮成冻\n芋圆红薯圆煮熟\n碗里放仙草、芋圆和牛奶"
  },
  {
    "name": "香草冰淇淋",
    "desc": "奶香浓郁，冰冰凉凉",
    "price": 8,
    "categoryId": "dessert",
    "tags": [
      "冰品"
    ],
    "spicyLevels": [],
    "addons": [],
    "color": "#FF6B35",
    "meals": [
      "lunch",
      "dinner"
    ],
    "status": "on",
    "stock": -1,
    "isRecommended": false,
    "recipe": "牛奶淡奶油加糖和香草精\n搅匀冷冻，每30分钟搅拌一次\n冻到定型"
  },
  {
    "name": "雪媚娘",
    "desc": "软糯外皮，奶油水果馅",
    "price": 10,
    "categoryId": "dessert",
    "tags": [
      "港式"
    ],
    "spicyLevels": [],
    "addons": [],
    "color": "#FF6B35",
    "meals": [
      "lunch",
      "dinner"
    ],
    "status": "on",
    "stock": -1,
    "isRecommended": false,
    "recipe": "糯米皮蒸熟摊平\n包入奶油和水果\n收口后冷藏"
  },
  {
    "name": "肉松小贝",
    "desc": "蛋糕裹肉松，咸甜适口",
    "price": 12,
    "categoryId": "dessert",
    "tags": [
      "烘焙"
    ],
    "spicyLevels": [],
    "addons": [],
    "color": "#FF6B35",
    "meals": [
      "breakfast",
      "lunch"
    ],
    "status": "on",
    "stock": -1,
    "isRecommended": false,
    "recipe": "蛋糕片抹沙拉酱\n裹肉松\n可再加一层夹心"
  },
  {
    "name": "戚风蛋糕",
    "desc": "松软细腻，蛋香十足",
    "price": 14,
    "categoryId": "dessert",
    "tags": [
      "烘焙"
    ],
    "spicyLevels": [],
    "addons": [],
    "color": "#FF6B35",
    "meals": [
      "lunch",
      "dinner"
    ],
    "status": "on",
    "stock": -1,
    "isRecommended": false,
    "recipe": "蛋黄加牛奶油和面粉拌匀\n蛋白加糖打发，翻拌入蛋黄糊\n烤箱150度50分钟，倒扣放凉"
  },
  {
    "name": "舒芙蕾",
    "desc": "厚松饼，蓬松柔软",
    "price": 16,
    "categoryId": "dessert",
    "tags": [
      "烘焙"
    ],
    "spicyLevels": [],
    "addons": [],
    "color": "#FF6B35",
    "meals": [
      "lunch",
      "dinner"
    ],
    "status": "on",
    "stock": -1,
    "isRecommended": false,
    "recipe": "蛋黄加牛奶面粉拌匀\n蛋白加糖打发，翻拌\n小火煎成厚松饼"
  },
  {
    "name": "华夫饼",
    "desc": "格子松饼，淋蜂蜜",
    "price": 12,
    "categoryId": "dessert",
    "tags": [
      "烘焙"
    ],
    "spicyLevels": [],
    "addons": [],
    "color": "#FF6B35",
    "meals": [
      "breakfast",
      "lunch"
    ],
    "status": "on",
    "stock": -1,
    "isRecommended": false,
    "recipe": "面糊加鸡蛋牛奶和面粉\n倒入华夫机\n烤到金黄，淋蜂蜜"
  },
  {
    "name": "铜锣烧",
    "desc": "两片松饼夹红豆沙",
    "price": 9,
    "categoryId": "dessert",
    "tags": [
      "中式"
    ],
    "spicyLevels": [],
    "addons": [],
    "color": "#FF6B35",
    "meals": [
      "breakfast",
      "lunch"
    ],
    "status": "on",
    "stock": -1,
    "isRecommended": false,
    "recipe": "面糊摊成小圆饼\n两片夹红豆沙\n压实"
  },
  {
    "name": "甜甜圈",
    "desc": "外脆内软，裹糖好吃",
    "price": 8,
    "categoryId": "dessert",
    "tags": [
      "烘焙"
    ],
    "spicyLevels": [],
    "addons": [],
    "color": "#FF6B35",
    "meals": [
      "breakfast",
      "lunch"
    ],
    "status": "on",
    "stock": -1,
    "isRecommended": false,
    "recipe": "面团发酵后整成圈\n油炸到金黄\n裹糖或巧克力"
  },
  {
    "name": "提子奶酥",
    "desc": "奶香酥脆，提子干点缀",
    "price": 10,
    "categoryId": "dessert",
    "tags": [
      "烘焙"
    ],
    "spicyLevels": [],
    "addons": [],
    "color": "#FF6B35",
    "meals": [
      "lunch",
      "dinner"
    ],
    "status": "on",
    "stock": -1,
    "isRecommended": false,
    "recipe": "黄油加糖打发，加面粉和提子干\n整形成小饼\n烤箱170度18分钟"
  },
  {
    "name": "蛋奶烤布蕾",
    "desc": "表面焦糖脆，里面嫩滑",
    "price": 12,
    "categoryId": "dessert",
    "tags": [
      "西式"
    ],
    "spicyLevels": [],
    "addons": [],
    "color": "#FF6B35",
    "meals": [
      "lunch",
      "dinner"
    ],
    "status": "on",
    "stock": -1,
    "isRecommended": false,
    "recipe": "牛奶淡奶油加蛋黄和糖拌匀过筛\n倒入烤碗\n烤箱160度25分钟，表面撒糖烤脆"
  }
]
