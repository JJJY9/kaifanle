/**
 * 订阅消息配置
 *
 * 模板 ID 获取方式：微信公众平台 → 功能 → 订阅消息 → 我的模板 → 选用模板。
 * 注意：小程序端 miniprogram/config.ts 里也要填同样的两个 ID，用于拉起授权弹窗。
 *
 * 模板字段说明：下方 data 的键（thing1 / character_string2 ...）必须和
 * 你实际选用的模板字段一一对应，否则发送会失败。选好模板后按提示改这里。
 */

const NEW_ORDER_TEMPLATE_ID = 'sUm9QOzqcjtl7gQCiU1c3tV0yB2C-CZhfrW1aqRvzC0'
const ORDER_STATUS_TEMPLATE_ID =
  'PULu2vsaJn2Ud9LwtWtCr5OdtZUJRAQBWo-AJiQ9wy0'

// 消息点开时进入的小程序版本：
// developer = 开发版，trial = 体验版，formal = 正式版
// 优先读取云函数环境变量 MINIPROGRAM_STATE（云开发控制台 → 云函数 → 配置），
// 便于不改代码切换。当前阶段没有体验版/正式版，默认 developer（真机用开发版预览验收）；
// 体验版验收时用环境变量设为 trial，正式发布后设为 formal。
const MINIPROGRAM_STATE_CANDIDATES = ['developer', 'trial', 'formal']
const MINIPROGRAM_STATE = (() => {
  const fromEnv = String(
    (typeof process !== 'undefined' &&
      process.env &&
      process.env.MINIPROGRAM_STATE) ||
      ''
  ).trim()
  return MINIPROGRAM_STATE_CANDIDATES.indexOf(fromEnv) > -1
    ? fromEnv
    : 'developer'
})()

function pad(n) {
  return n < 10 ? '0' + n : String(n)
}

// 云函数运行环境默认 UTC，这里统一按北京时间格式化
function formatTime(ts) {
  const d = new Date(ts + 8 * 60 * 60 * 1000)
  return (
    d.getUTCFullYear() +
    '-' +
    pad(d.getUTCMonth() + 1) +
    '-' +
    pad(d.getUTCDate()) +
    ' ' +
    pad(d.getUTCHours()) +
    ':' +
    pad(d.getUTCMinutes()) +
    ':' +
    pad(d.getUTCSeconds())
  )
}

function summary(items) {
  const names = (items || []).map(
    item => `${item.name}×${item.qty}`
  )
  if (!names.length) {
    return '一份好吃的'
  }
  const text =
    names.slice(0, 2).join('、') + (names.length > 2 ? '…' : '')
  return text.length > 20 ? text.slice(0, 19) + '…' : text
}

// 新订单提醒（发给管理员）
// 模板「顾客下单提醒」：thing11 / number2 / amount3 / thing4 / time36
function newOrderData(order) {
  return {
    thing11: { value: summary(order.items) },
    number2: { value: String(Number(order.no)) },
    amount3: { value: '¥' + Number(order.amount).toFixed(2) },
    thing4: { value: (order.note || '没有备注').slice(0, 20) },
    time36: { value: formatTime(order.createdAt) }
  }
}

// 订单状态提醒（发给顾客），目前只在「出锅」时发送
// 模板「订单状态提醒」：thing1 / phrase2 / character_string6 / time16 / thing5
function orderStatusData(order) {
  return {
    thing1: { value: summary(order.items) },
    phrase2: { value: '已出锅' },
    character_string6: { value: order.no },
    time16: { value: formatTime(Date.now()) },
    thing5: { value: '趁热吃，饭在等你' }
  }
}

module.exports = {
  NEW_ORDER_TEMPLATE_ID,
  ORDER_STATUS_TEMPLATE_ID,
  MINIPROGRAM_STATE,
  newOrderData,
  orderStatusData
}
