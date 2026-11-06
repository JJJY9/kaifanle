// 生成卡通菜品插画（SVG）：按菜名和分类组合碗/盘/杯/甜品与食材
const fs = require('fs')
const path = require('path')

const OUT_DIR = path.join(__dirname, '..', 'miniprogram', 'images', 'dishes')
const seed = require('../cloudfunctions/api/seed')

function readBank() {
  const src = fs.readFileSync(
    path.join(__dirname, '..', 'miniprogram', 'utils', 'dish-bank.ts'),
    'utf8'
  )
  const start = src.indexOf('= [')
  const json = src.slice(start + 2).trim()
  return JSON.parse(json)
}

function readBaseTemplates() {
  const src = fs.readFileSync(
    path.join(__dirname, '..', 'miniprogram', 'utils', 'dish-templates.ts'),
    'utf8'
  )
  const out = []
  const re =
    /^    name: '([^']+)',\n(?:.*\n)*?    categoryId: '([^']+)',\n(?:.*\n)*?    color: '([^']+)'/gm
  let m
  while ((m = re.exec(src))) {
    out.push({ name: m[1], categoryId: m[2], color: m[3] })
  }
  return out
}

const dishes = []
const seen = {}
function add(dish) {
  if (!dish || !dish.name || seen[dish.name]) return
  seen[dish.name] = true
  dishes.push(dish)
}
seed.dishes.forEach(add)
readBaseTemplates().forEach(add)
readBank().forEach(add)

const O = '#111111'
const CREAM = '#FFF6E3'

function shadow(cx = 100, cy = 170, rx = 58, ry = 9) {
  return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="rgba(17,17,17,0.12)"/>`
}

function steam(x, y, color = O) {
  return `<path d="M${x} ${y} q-6 -10 0 -18 q6 -8 0 -16" fill="none" stroke="${color}" stroke-width="4" stroke-linecap="round" opacity="0.5"/>`
}

function sparkle(x, y, color) {
  return `<path d="M${x} ${y} l4 8 l8 -4" fill="none" stroke="${color}" stroke-width="4" stroke-linecap="round"/>`
}

function bowl(fill = '#FFFFFF', rim = '#FFFFFF') {
  return `
    <path d="M38 100 Q40 160 100 160 Q160 160 162 100 Z" fill="${fill}" stroke="${O}" stroke-width="6" stroke-linejoin="round"/>
    <ellipse cx="100" cy="100" rx="62" ry="17" fill="${rim}" stroke="${O}" stroke-width="6"/>
  `
}

function riceMound(color = '#FFF1CF') {
  return `<path d="M48 100 Q52 74 100 74 Q148 74 152 100 Q128 110 100 110 Q72 110 48 100 Z" fill="${color}" stroke="${O}" stroke-width="4" stroke-linejoin="round"/>`
}

function noodleBowl(noodleColor = '#F4C977') {
  return `
    ${bowl()}
    <path d="M56 96 Q64 82 78 90 Q90 98 102 86 Q114 74 128 86 Q140 96 148 88" fill="none" stroke="${O}" stroke-width="9" stroke-linecap="round"/>
    <path d="M56 96 Q64 82 78 90 Q90 98 102 86 Q114 74 128 86 Q140 96 148 88" fill="none" stroke="${noodleColor}" stroke-width="5" stroke-linecap="round"/>
    <path d="M60 106 Q72 94 86 102 Q98 110 112 98 Q124 88 140 100" fill="none" stroke="${noodleColor}" stroke-width="8" stroke-linecap="round"/>
    <path d="M132 40 L170 78" stroke="${O}" stroke-width="5" stroke-linecap="round"/>
    <path d="M142 34 L180 72" stroke="${O}" stroke-width="5" stroke-linecap="round"/>
  `
}

function plate(fill = '#FFFFFF') {
  return `
    <ellipse cx="100" cy="152" rx="78" ry="26" fill="${fill}" stroke="${O}" stroke-width="6"/>
    <ellipse cx="100" cy="148" rx="62" ry="18" fill="#FFFDF6" stroke="${O}" stroke-width="3"/>
  `
}

function meat(x, y, s = 1, color = '#B4632C') {
  return `<path d="M${x - 14 * s} ${y} q0 -12 ${14 * s} -12 q${14 * s} 0 ${14 * s} 12 q0 12 -${14 * s} 12 q-${14 * s} 0 -${14 * s} -12 Z" fill="${color}" stroke="${O}" stroke-width="4"/>`
}

function chicken(x, y, s = 1) {
  return `<path d="M${x - 13 * s} ${y} q0 -12 ${13 * s} -12 q${13 * s} 0 ${13 * s} 12 q0 12 -${13 * s} 12 q-${13 * s} 0 -${13 * s} -12 Z" fill="#E8A33D" stroke="${O}" stroke-width="4"/><circle cx="${x - 4 * s}" cy="${y - 3 * s}" r="${2.5 * s}" fill="#FFF1CF"/>`
}

function tomato(x, y, r = 10) {
  return `<circle cx="${x}" cy="${y}" r="${r}" fill="#FF5C5C" stroke="${O}" stroke-width="4"/><path d="M${x - 5} ${y - r} l5 -5 l5 5" fill="none" stroke="#2FBF71" stroke-width="4" stroke-linecap="round"/>`
}

function egg(x, y, s = 1) {
  return `<path d="M${x - 16 * s} ${y} q0 -14 ${16 * s} -14 q${16 * s} 0 ${16 * s} 14 q0 12 -${16 * s} 12 q-${16 * s} 0 -${16 * s} -12 Z" fill="#FFFFFF" stroke="${O}" stroke-width="4"/><circle cx="${x + 2 * s}" cy="${y - 1 * s}" r="${6 * s}" fill="#FFC93C" stroke="${O}" stroke-width="3"/>`
}

function greens(x, y, color = '#2FBF71') {
  return `<path d="M${x - 14} ${y + 4} q-2 -14 12 -18 q4 12 -2 18 Z" fill="${color}" stroke="${O}" stroke-width="4" stroke-linejoin="round"/><path d="M${x + 2} ${y + 6} q0 -14 14 -16 q2 12 -6 16 Z" fill="${color}" stroke="${O}" stroke-width="4" stroke-linejoin="round"/>`
}

function shrimp(x, y, s = 1) {
  return `<path d="M${x - 14 * s} ${y} q10 -10 ${22 * s} -4 q6 4 0 9 q-8 5 -${16 * s} 1" fill="#FF8A5B" stroke="${O}" stroke-width="4" stroke-linecap="round"/><circle cx="${x - 12 * s}" cy="${y + 2}" r="${2.5 * s}" fill="${O}"/>`
}

function mushroom(x, y, s = 1) {
  return `<path d="M${x - 14 * s} ${y} q0 -14 ${14 * s} -14 q${14 * s} 0 ${14 * s} 14 Z" fill="#B98A62" stroke="${O}" stroke-width="4"/><rect x="${x - 4 * s}" y="${y}" width="${8 * s}" height="${10 * s}" fill="${CREAM}" stroke="${O}" stroke-width="3"/>`
}

function tofu(x, y, s = 1) {
  return `<rect x="${x - 11 * s}" y="${y - 11 * s}" width="${22 * s}" height="${22 * s}" rx="4" fill="#FFFDF6" stroke="${O}" stroke-width="4"/>`
}

function potato(x, y, s = 1) {
  return `<path d="M${x - 12 * s} ${y} q0 -10 ${12 * s} -10 q${12 * s} 0 ${12 * s} 10 q0 10 -${12 * s} 10 q-${12 * s} 0 -${12 * s} -10 Z" fill="#F4C542" stroke="${O}" stroke-width="4"/>`
}

function eggplant(x, y, s = 1) {
  return `<path d="M${x - 16 * s} ${y + 4} q4 -16 ${18 * s} -12 q10 4 8 12 q-4 8 -${14 * s} 4 Z" fill="#8E5CD9" stroke="${O}" stroke-width="4"/><path d="M${x - 16 * s} ${y + 4} l-6 -6" stroke="#2FBF71" stroke-width="4" stroke-linecap="round"/>`
}

function fish(x, y, s = 1) {
  return `<path d="M${x - 22 * s} ${y} q${10 * s} -12 ${26 * s} -12 q${10 * s} 0 ${14 * s} 12 q-${4 * s} 12 -${14 * s} 12 q-${16 * s} 0 -${26 * s} -12 Z" fill="#7EC8F2" stroke="${O}" stroke-width="4"/><path d="M${x + 18 * s} ${y} l${10 * s} -8 v16 Z" fill="#7EC8F2" stroke="${O}" stroke-width="4"/><circle cx="${x - 12 * s}" cy="${y - 2}" r="${2.5 * s}" fill="${O}"/>`
}

function chili(x, y, s = 1) {
  return `<path d="M${x - 14 * s} ${y} q${10 * s} -10 ${22 * s} 0 q4 8 -6 10 q-${10 * s} 4 -${16 * s} -2 Z" fill="#FF4D3D" stroke="${O}" stroke-width="4"/><path d="M${x - 14 * s} ${y} l-6 -6" stroke="#2FBF71" stroke-width="4" stroke-linecap="round"/>`
}

function peanut(x, y) {
  return `<ellipse cx="${x - 4}" cy="${y}" rx="7" ry="5" fill="#E9C48D" stroke="${O}" stroke-width="3" transform="rotate(-20 ${x} ${y})"/><ellipse cx="${x + 5}" cy="${y + 2}" rx="7" ry="5" fill="#E9C48D" stroke="${O}" stroke-width="3" transform="rotate(20 ${x} ${y})"/>`
}

function corn(x, y) {
  return `<ellipse cx="${x}" cy="${y}" rx="10" ry="6" fill="#FFD23F" stroke="${O}" stroke-width="3"/><circle cx="${x - 4}" cy="${y - 1}" r="1.6" fill="${O}"/><circle cx="${x + 3}" cy="${y + 1}" r="1.6" fill="${O}"/>`
}

function lemon(x, y, r = 9) {
  return `<circle cx="${x}" cy="${y}" r="${r}" fill="#FFE45C" stroke="${O}" stroke-width="4"/><path d="M${x - r + 2} ${y} h${2 * r - 4} M${x} ${y - r + 2} v${2 * r - 4}" stroke="${O}" stroke-width="2"/>`
}

function strawberry(x, y) {
  return `<path d="M${x} ${y + 10} q-12 -6 -10 -16 q2 -8 10 -8 q8 0 10 8 q2 10 -10 16 Z" fill="#FF5C8A" stroke="${O}" stroke-width="4"/><circle cx="${x - 3}" cy="${y - 4}" r="1.4" fill="${O}"/><circle cx="${x + 3}" cy="${y - 1}" r="1.4" fill="${O}"/>`
}

function peach(x, y) {
  return `<circle cx="${x}" cy="${y}" r="10" fill="#FFB35C" stroke="${O}" stroke-width="4"/><path d="M${x} ${y - 9} q3 6 0 9" stroke="${O}" stroke-width="2"/>`
}

function melon(x, y) {
  return `<path d="M${x - 12} ${y + 8} q-2 -16 12 -16 q14 0 12 16 Z" fill="#FF6B6B" stroke="${O}" stroke-width="4"/><path d="M${x - 10} ${y + 6} q8 -6 18 0" fill="none" stroke="#2FBF71" stroke-width="3"/>`
}

function iceCube(x, y) {
  return `<rect x="${x - 8}" y="${y - 8}" width="16" height="16" rx="3" fill="#E8F7FF" stroke="${O}" stroke-width="3" opacity="0.9"/>`
}

function bubble(x, y, r = 3) {
  return `<circle cx="${x}" cy="${y}" r="${r}" fill="${O}"/>`
}

function cupBase(fill = '#FFFFFF', straw = '#FF5C8A') {
  return `
    <path d="M66 62 L74 160 Q100 168 126 160 L134 62 Z" fill="${fill}" stroke="${O}" stroke-width="6" stroke-linejoin="round"/>
    <path d="M104 58 L128 18" stroke="${O}" stroke-width="7" stroke-linecap="round"/>
    <path d="M104 58 L128 18" stroke="${straw}" stroke-width="4" stroke-linecap="round"/>
  `
}

function mug(fill = '#FFFFFF') {
  return `
    <path d="M60 76 L68 150 Q100 158 132 150 L140 76 Z" fill="${fill}" stroke="${O}" stroke-width="6" stroke-linejoin="round"/>
    <path d="M140 92 q26 0 22 20 q-4 18 -24 16" fill="none" stroke="${O}" stroke-width="6"/>
  `
}

function can(fill = '#FF5C5C') {
  return `
    <rect x="70" y="58" width="60" height="104" rx="10" fill="${fill}" stroke="${O}" stroke-width="6"/>
    <rect x="70" y="84" width="60" height="34" fill="#FFFFFF" stroke="${O}" stroke-width="4"/>
    <path d="M78 58 h44" stroke="${O}" stroke-width="6" stroke-linecap="round"/>
  `
}

function cakeSlice() {
  return `
    <path d="M52 150 L100 128 L148 150 L100 172 Z" fill="#FFFFFF" stroke="${O}" stroke-width="6" stroke-linejoin="round"/>
    <path d="M52 150 L100 128 L100 96 L52 118 Z" fill="#FFE0B2" stroke="${O}" stroke-width="5" stroke-linejoin="round"/>
    <path d="M100 128 L148 150 L148 118 L100 96 Z" fill="#FFCC80" stroke="${O}" stroke-width="5" stroke-linejoin="round"/>
    <path d="M52 132 L100 110 L148 132" fill="none" stroke="${O}" stroke-width="5"/>
    <circle cx="112" cy="88" r="8" fill="#FF5C8A" stroke="${O}" stroke-width="4"/>
  `
}

function pudding() {
  return `
    <path d="M62 96 Q70 156 100 156 Q130 156 138 96 Z" fill="#FFE3A3" stroke="${O}" stroke-width="6"/>
    <ellipse cx="100" cy="96" rx="38" ry="12" fill="#F4B942" stroke="${O}" stroke-width="5"/>
    <path d="M80 76 Q100 66 120 76" fill="none" stroke="${O}" stroke-width="5" stroke-linecap="round"/>
  `
}

function tart() {
  return `
    <path d="M56 108 L64 150 Q100 166 136 150 L144 108 Z" fill="#D9A15B" stroke="${O}" stroke-width="6"/>
    <ellipse cx="100" cy="108" rx="44" ry="14" fill="#FFD23F" stroke="${O}" stroke-width="5"/>
    <circle cx="84" cy="106" r="4" fill="#B4632C"/>
    <circle cx="112" cy="110" r="4" fill="#B4632C"/>
  `
}

function donut() {
  return `
    <circle cx="100" cy="112" r="44" fill="#E8A33D" stroke="${O}" stroke-width="6"/>
    <circle cx="100" cy="112" r="34" fill="#FF8FC7" stroke="${O}" stroke-width="5"/>
    <circle cx="100" cy="112" r="14" fill="${CREAM}" stroke="${O}" stroke-width="5"/>
    <path d="M74 94 q8 -6 16 0 M108 88 q8 -4 14 2" fill="none" stroke="#FFFFFF" stroke-width="4" stroke-linecap="round"/>
  `
}

function waffle() {
  return `
    <rect x="56" y="72" width="88" height="88" rx="14" fill="#E8A33D" stroke="${O}" stroke-width="6"/>
    <path d="M78 72 v88 M100 72 v88 M122 72 v88 M56 94 h88 M56 116 h88 M56 138 h88" stroke="${O}" stroke-width="3" opacity="0.6"/>
    <path d="M70 72 q10 -14 30 -12" fill="none" stroke="#FFFFFF" stroke-width="5" stroke-linecap="round"/>
  `
}

function iceCream() {
  return `
    <path d="M78 104 L100 172 L122 104 Z" fill="#E8A33D" stroke="${O}" stroke-width="6" stroke-linejoin="round"/>
    <circle cx="88" cy="92" r="18" fill="#FF8FC7" stroke="${O}" stroke-width="5"/>
    <circle cx="112" cy="88" r="16" fill="#FFF1CF" stroke="${O}" stroke-width="5"/>
    <circle cx="100" cy="70" r="16" fill="#8ED9F5" stroke="${O}" stroke-width="5"/>
  `
}

function pancakeStack() {
  return `
    <ellipse cx="100" cy="148" rx="46" ry="12" fill="#E8A33D" stroke="${O}" stroke-width="5"/>
    <ellipse cx="100" cy="132" rx="44" ry="12" fill="#F4C977" stroke="${O}" stroke-width="5"/>
    <ellipse cx="100" cy="116" rx="42" ry="12" fill="#F4C977" stroke="${O}" stroke-width="5"/>
    <rect x="90" y="96" width="20" height="18" fill="#FFE45C" stroke="${O}" stroke-width="4"/>
  `
}

function mochi() {
  return `
    <circle cx="82" cy="122" r="24" fill="#FFFDF6" stroke="${O}" stroke-width="5"/>
    <circle cx="118" cy="118" r="22" fill="#FFFDF6" stroke="${O}" stroke-width="5"/>
    <circle cx="82" cy="122" r="9" fill="#FFB3C7"/>
    <circle cx="118" cy="118" r="8" fill="#FFD23F"/>
  `
}

function cupDessert() {
  return `
    <path d="M64 86 L72 154 Q100 162 128 154 L136 86 Z" fill="#FFFFFF" stroke="${O}" stroke-width="6"/>
    <path d="M68 100 L72 154 Q100 162 128 154 L132 100 Z" fill="#FFE3A3"/>
    <circle cx="86" cy="112" r="7" fill="#FF8FC7" stroke="${O}" stroke-width="3"/>
    <circle cx="112" cy="118" r="6" fill="#FFD23F" stroke="${O}" stroke-width="3"/>
    <circle cx="100" cy="132" r="5" fill="#8ED9F5" stroke="${O}" stroke-width="3"/>
  `
}

function cookies() {
  return `
    <circle cx="80" cy="120" r="24" fill="#E8C07A" stroke="${O}" stroke-width="5"/>
    <circle cx="120" cy="112" r="22" fill="#E8C07A" stroke="${O}" stroke-width="5"/>
    <circle cx="74" cy="114" r="3" fill="#8E5CD9"/><circle cx="88" cy="128" r="3" fill="#8E5CD9"/>
    <circle cx="116" cy="106" r="3" fill="#8E5CD9"/><circle cx="126" cy="120" r="3" fill="#8E5CD9"/>
  `
}

function bun() {
  return `
    <circle cx="100" cy="118" r="40" fill="#F4C977" stroke="${O}" stroke-width="6"/>
    <path d="M72 108 q28 -20 56 0" fill="none" stroke="#E8A33D" stroke-width="4"/>
    <path d="M82 130 q18 10 36 0" fill="none" stroke="#E8A33D" stroke-width="4"/>
  `
}

function dumplings() {
  return `
    <ellipse cx="84" cy="132" rx="24" ry="14" fill="#FFFDF6" stroke="${O}" stroke-width="5"/>
    <ellipse cx="118" cy="128" rx="24" ry="14" fill="#FFFDF6" stroke="${O}" stroke-width="5"/>
    <ellipse cx="100" cy="110" rx="26" ry="15" fill="#FFFDF6" stroke="${O}" stroke-width="5"/>
    <path d="M76 132 q8 -8 16 0 M110 128 q8 -8 16 0 M88 110 q12 -10 24 0" fill="none" stroke="#D9A15B" stroke-width="3"/>
  `
}

function sandwich() {
  return `
    <path d="M56 96 L144 96 L132 110 L68 110 Z" fill="#F4C977" stroke="${O}" stroke-width="5" stroke-linejoin="round"/>
    <path d="M60 110 L140 110 L136 124 L64 124 Z" fill="#FFD23F" stroke="${O}" stroke-width="5"/>
    <path d="M64 124 L136 124 L144 138 L56 138 Z" fill="#F4C977" stroke="${O}" stroke-width="5" stroke-linejoin="round"/>
    <path d="M56 138 L144 138 L140 148 L60 148 Z" fill="#E8A33D" stroke="${O}" stroke-width="5"/>
    <circle cx="86" cy="118" r="4" fill="#FF5C5C"/><circle cx="112" cy="118" r="4" fill="#2FBF71"/>
  `
}

function pancake() {
  return `
    <circle cx="100" cy="124" r="46" fill="#F4C977" stroke="${O}" stroke-width="6"/>
    <path d="M64 120 q36 -14 72 0" fill="none" stroke="#E8A33D" stroke-width="4"/>
    <path d="M70 134 q30 -12 60 0" fill="none" stroke="#E8A33D" stroke-width="4"/>
    <circle cx="90" cy="112" r="4" fill="#2FBF71"/><circle cx="112" cy="116" r="4" fill="#2FBF71"/>
  `
}

function porridge() {
  return `
    ${bowl()}
    <ellipse cx="100" cy="98" rx="52" ry="13" fill="#FFFdf6" stroke="${O}" stroke-width="4"/>
    <circle cx="84" cy="96" r="5" fill="#B4632C"/><circle cx="112" cy="100" r="4" fill="#7FBF5F"/>
    <path d="M136 52 L168 84" stroke="${O}" stroke-width="5" stroke-linecap="round"/>
  `
}

function soupBowl(broth = '#F4D58D') {
  return `
    ${bowl()}
    <ellipse cx="100" cy="98" rx="52" ry="13" fill="${broth}" stroke="${O}" stroke-width="4"/>
  `
}

function chooseArt(dish) {
  const name = dish.name
  const cat = dish.categoryId
  const inner = []

  if (cat === 'drink') {
    if (/可乐|雪碧|气泡水/.test(name)) {
      inner.push(can(/可乐/.test(name) ? '#FF5C5C' : /雪碧/.test(name) ? '#2FBF71' : '#8ED9F5'))
      inner.push(bubble(88, 150, 3), bubble(108, 144, 3), bubble(120, 152, 2))
    } else if (/咖啡|拿铁|卡布奇诺|美式|热可可/.test(name)) {
      inner.push(mug('#FFFDF6'))
      inner.push(`<path d="M72 90 q10 8 20 0 q10 -8 20 0 q10 8 20 0" fill="none" stroke="#8B5A2B" stroke-width="4"/>`)
      inner.push(steam(78, 60), steam(100, 54), steam(122, 60))
    } else if (/茶/.test(name)) {
      inner.push(mug('#FFFFFF'))
      inner.push(`<path d="M74 92 q26 -10 52 0" fill="none" stroke="#D9A15B" stroke-width="6"/>`)
      inner.push(lemon(86, 88, 8))
    } else if (/牛奶|豆浆|米浆|酸奶/.test(name)) {
      inner.push(`<path d="M72 70 L80 154 Q100 160 120 154 L128 70 Z" fill="#FFFFFF" stroke="${O}" stroke-width="6"/><path d="M76 92 L80 154 Q100 160 120 154 L124 92 Z" fill="#FFF1CF"/>`)
      inner.push(`<path d="M100 60 L112 34" stroke="${O}" stroke-width="6" stroke-linecap="round"/>`)
    } else {
      inner.push(cupBase('#FFFDF6'))
      inner.push(`<path d="M72 86 L76 154 Q100 160 124 154 L128 86 Z" fill="#FFE3C2" opacity="0.9"/>`)
      if (/奶茶/.test(name)) {
        inner.push(bubble(84, 146), bubble(98, 150), bubble(112, 144), bubble(104, 136), bubble(92, 134))
      } else {
        inner.push(iceCube(88, 110), iceCube(110, 118), iceCube(98, 128))
      }
    }
    return svgWrap(inner.join(''))
  }

  if (cat === 'dessert') {
    if (/蛋挞/.test(name)) inner.push(tart())
    else if (/甜甜圈/.test(name)) inner.push(donut())
    else if (/华夫饼/.test(name)) inner.push(waffle())
    else if (/冰淇淋|冰激凌/.test(name)) inner.push(iceCream())
    else if (/布丁|布蕾|双皮奶/.test(name)) inner.push(pudding())
    else if (/铜锣烧|舒芙蕾|班戟|葱油饼|饼/.test(name)) inner.push(pancakeStack())
    else if (/糯米糍|雪媚娘/.test(name)) inner.push(mochi())
    else if (/奶酥|饼干/.test(name)) inner.push(cookies())
    else if (/肉松小贝/.test(name)) inner.push(bun())
    else if (/杨枝甘露|烧仙草|芋圆|水果/.test(name)) {
      inner.push(cupDessert())
    } else {
      inner.push(cakeSlice())
      if (/巧克力|布朗尼|提拉米苏/.test(name)) {
        inner.push(`<path d="M60 136 L100 118 L140 136" fill="none" stroke="#8B5A2B" stroke-width="4" opacity="0.6"/>`)
      }
    }
    return svgWrap(shadow() + inner.join(''))
  }

  if (cat === 'soup') {
    const broth = /酸辣|罗宋|番茄/.test(name) ? '#F2A36B' : /南瓜|奶油/.test(name) ? '#F8D48A' : '#F4E3B2'
    inner.push(soupBowl(broth))
    inner.push(steam(80, 66), steam(100, 60), steam(120, 66))
    if (/排骨|猪蹄|猪脚/.test(name)) inner.push(meat(88, 94, 0.8), meat(112, 98, 0.7))
    else if (/鸡/.test(name)) inner.push(chicken(90, 94, 0.7), chicken(112, 98, 0.6))
    else if (/牛肉|牛腩/.test(name)) inner.push(meat(90, 94, 0.8, '#8A4B25'), meat(112, 98, 0.7, '#8A4B25'))
    else if (/冬瓜|萝卜|玉米|山药|莲藕/.test(name)) {
      inner.push(`<path d="M78 94 q10 -10 20 0 q-10 10 -20 0 Z" fill="#EAF7D9" stroke="${O}" stroke-width="4"/>`)
      inner.push(corn(116, 96))
    } else if (/紫菜|海带/.test(name)) {
      inner.push(`<path d="M80 96 q12 -10 22 0 q10 8 18 0" fill="none" stroke="#2E6B4F" stroke-width="5"/>`)
    } else if (/银耳|莲子/.test(name)) {
      inner.push(`<circle cx="88" cy="96" r="8" fill="#FFFDF6" stroke="${O}" stroke-width="3"/><circle cx="112" cy="98" r="7" fill="#FFFDF6" stroke="${O}" stroke-width="3"/>`)
    } else if (/豆腐|丸子/.test(name)) {
      inner.push(tofu(92, 96, 0.8), tofu(110, 100, 0.7))
    }
    inner.push(greens(126, 92, '#2FBF71'))
    return svgWrap(shadow() + inner.join(''))
  }

  if (cat === 'stirfry') {
    inner.push(plate())
    inner.push(`<ellipse cx="100" cy="140" rx="54" ry="16" fill="#F4C977" opacity="0.55"/>`)
    if (/西兰花/.test(name)) {
      inner.push(`<circle cx="82" cy="128" r="14" fill="#2FBF71" stroke="${O}" stroke-width="4"/><circle cx="100" cy="120" r="15" fill="#2FBF71" stroke="${O}" stroke-width="4"/><circle cx="118" cy="130" r="13" fill="#2FBF71" stroke="${O}" stroke-width="4"/>`)
    } else if (/茄子/.test(name)) {
      inner.push(eggplant(84, 128), eggplant(112, 132, 0.9), eggplant(98, 144, 0.8))
    } else if (/豆腐/.test(name)) {
      inner.push(tofu(84, 128), tofu(106, 122, 0.9), tofu(120, 138, 0.8))
    } else if (/土豆/.test(name)) {
      inner.push(potato(84, 130), potato(108, 126, 0.9), potato(120, 140, 0.8))
    } else if (/鱼香|肉丝|肉末|里脊|锅包肉|回锅肉|京酱|木须/.test(name)) {
      inner.push(meat(84, 128, 0.9), meat(108, 124, 0.8), meat(120, 140, 0.7))
    } else if (/鸡/.test(name)) {
      inner.push(chicken(84, 128), chicken(108, 124, 0.9), chicken(122, 140, 0.7))
    } else if (/牛|羊/.test(name)) {
      inner.push(meat(84, 128, 0.9, '#8A4B25'), meat(108, 124, 0.8, '#8A4B25'), meat(122, 140, 0.7, '#8A4B25'))
    } else if (/虾/.test(name)) {
      inner.push(shrimp(86, 130), shrimp(112, 126, 0.9))
    } else if (/鱼/.test(name)) {
      inner.push(fish(100, 130, 0.9))
    } else if (/排骨|猪/.test(name)) {
      inner.push(meat(86, 128), meat(112, 132, 0.9))
    } else if (/蛋/.test(name)) {
      inner.push(egg(88, 128), egg(112, 132, 0.9))
    } else {
      inner.push(greens(84, 130), greens(108, 126), greens(122, 140))
    }
    if (/辣|宫保|麻婆|干煸|辣子/.test(name)) inner.push(chili(70, 116, 0.8))
    if (/宫保/.test(name)) inner.push(peanut(130, 130))
    if (/蒜|葱/.test(name)) inner.push(greens(130, 112, '#7FBF5F'))
    inner.push(steam(74, 100), steam(126, 96))
    return svgWrap(shadow() + inner.join(''))
  }

  // staple
  if (/面|粉|乌冬/.test(name)) {
    inner.push(noodleBowl())
    if (/牛/.test(name)) inner.push(meat(84, 94, 0.8, '#8A4B25'), meat(112, 90, 0.7, '#8A4B25'))
    else if (/鸡/.test(name)) inner.push(chicken(84, 94, 0.7), chicken(112, 90, 0.6))
    else if (/虾|云吞/.test(name)) inner.push(shrimp(86, 96), shrimp(112, 92, 0.8))
    else if (/蛋/.test(name)) inner.push(egg(96, 92, 0.7))
    inner.push(greens(122, 96))
    if (/酸辣/.test(name)) inner.push(chili(72, 92, 0.7))
    if (/葱油/.test(name)) inner.push(greens(78, 90, '#7FBF5F'))
    inner.push(steam(70, 58), steam(130, 56))
    return svgWrap(shadow() + inner.join(''))
  }

  if (/粥/.test(name)) {
    inner.push(porridge())
    if (/皮蛋/.test(name)) {
      inner.push(`<circle cx="80" cy="96" r="6" fill="#4B5D4B" stroke="${O}" stroke-width="3"/><circle cx="116" cy="98" r="6" fill="#4B5D4B" stroke="${O}" stroke-width="3"/>`)
    }
    if (/虾|玉米/.test(name)) inner.push(corn(112, 98), shrimp(84, 94, 0.7))
    if (/南瓜|小米/.test(name)) inner.push(`<ellipse cx="100" cy="98" rx="40" ry="9" fill="#F4C542" opacity="0.5"/>`)
    inner.push(steam(76, 58), steam(124, 56))
    return svgWrap(shadow() + inner.join(''))
  }

  if (/饺子|包子|小笼|盒子|馄饨/.test(name)) {
    inner.push(dumplings())
    if (/盒/.test(name)) inner.push(greens(132, 112))
    inner.push(steam(84, 70), steam(116, 66))
    return svgWrap(shadow() + inner.join(''))
  }

  if (/三明治/.test(name)) {
    inner.push(sandwich())
    return svgWrap(shadow() + inner.join(''))
  }

  if (/饼/.test(name)) {
    inner.push(pancake())
    return svgWrap(shadow() + inner.join(''))
  }

  // rice bowls & fried rice
  inner.push(bowl())
  if (/咖喱/.test(name)) {
    inner.push(`<path d="M50 100 Q56 78 100 78 Q144 78 150 100 Q126 110 100 110 Q74 110 50 100 Z" fill="#F4C542" stroke="${O}" stroke-width="4"/>`)
  } else {
    inner.push(riceMound())
  }
  if (/蛋包饭/.test(name)) {
    inner.push(`<path d="M58 96 Q100 60 142 96 Q120 108 100 106 Q78 108 58 96 Z" fill="#FFD23F" stroke="${O}" stroke-width="4"/>`)
  }
  if (/番茄/.test(name)) inner.push(tomato(82, 92), tomato(116, 88, 9))
  if (/牛|腩/.test(name)) inner.push(meat(94, 100, 0.8, '#8A4B25'), meat(116, 96, 0.7, '#8A4B25'))
  if (/鸡|照烧|叉烧/.test(name)) inner.push(chicken(90, 98), chicken(116, 94, 0.8))
  if (/猪|排骨|卤肉|红烧肉/.test(name)) inner.push(meat(90, 98, 0.9), meat(116, 94, 0.7))
  if (/腊肠|煲仔/.test(name)) {
    inner.push(`<ellipse cx="84" cy="94" rx="11" ry="7" fill="#C0392B" stroke="${O}" stroke-width="3"/><ellipse cx="112" cy="98" rx="11" ry="7" fill="#C0392B" stroke="${O}" stroke-width="3"/>`)
  }
  if (/虾/.test(name)) inner.push(shrimp(92, 96), shrimp(116, 92, 0.8))
  if (/蛋/.test(name) && !/蛋包饭/.test(name)) inner.push(egg(92, 94, 0.7))
  if (/香菇|蘑菇/.test(name)) inner.push(mushroom(112, 96, 0.8))
  if (/咖喱/.test(name)) inner.push(potato(90, 92, 0.8))
  if (/咖喱/.test(name)) inner.push(`<circle cx="112" cy="94" r="6" fill="#E8A33D" stroke="${O}" stroke-width="3"/>`)
  if (/玉米/.test(name)) inner.push(corn(116, 96))
  inner.push(greens(128, 94, '#2FBF71'))
  inner.push(steam(76, 56), steam(100, 50), steam(124, 56))
  inner.push(sparkle(58, 60, '#FF6B35'))
  return svgWrap(shadow() + inner.join(''))
}

function svgWrap(content) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">${content}</svg>`
}

fs.mkdirSync(OUT_DIR, { recursive: true })
// 清掉旧图，保持一次生成一致
for (const file of fs.readdirSync(OUT_DIR)) {
  if (file.endsWith('.svg')) {
    fs.unlinkSync(path.join(OUT_DIR, file))
  }
}

const map = {}
dishes.forEach((dish, index) => {
  const file = `dish-${String(index + 1).padStart(3, '0')}.svg`
  const svg = chooseArt({
    name: dish.name,
    categoryId: dish.categoryId,
    color: dish.color || '#FFD23F'
  })
  fs.writeFileSync(path.join(OUT_DIR, file), svg)
  map[dish.name] = `/images/dishes/${file}`
})

const ts =
  '// 菜品卡通插画映射（菜名 -> 本地 SVG），由 scripts/generate-dish-art.js 生成\n' +
  'export const DISH_ART: Record<string, string> = ' +
  JSON.stringify(map, null, 2) +
  '\n'
fs.writeFileSync(
  path.join(__dirname, '..', 'miniprogram', 'utils', 'dish-art-map.ts'),
  ts
)
console.log(`生成了 ${dishes.length} 张卡通插画`)
