/**
 * 订阅消息配置
 *
 * 模板 ID 获取方式：微信公众平台 → 功能 → 订阅消息 → 我的模板 → 选用模板。
 * 注意：小程序端 miniprogram/config.ts 里也要填同样的两个 ID，用于拉起授权弹窗。
 *
 * 模板字段说明：下方 data 的键（thing1 / character_string2 ...）必须和
 * 你实际选用的模板字段一一对应，否则发送会失败。选好模板后按提示改这里。
 */

const NEW_ORDER_TEMPLATE_ID = ''
const ORDER_STATUS_TEMPLATE_ID = ''

// 消息点开时进入的小程序版本：
// developer = 开发版，trial = 体验版，formal = 正式版
const MINIPROGRAM_STATE = 'trial'

function pad(n) {
  return n < 10 ? '0' + n : String(n)
}

function formatTime(ts) {
  const d = new Date(ts)
  return (
    d.getFullYear() +
    '-' +
    pad(d.getMonth() + 1) +
    '-' +
    pad(d.getDate()) +
    ' ' +
    pad(d.getHours()) +
    ':' +
    pad(d.getMinutes())
  )
}

function summary(items) {
  const names = (items || []).map(item => item.name)
  if (!names.length) {
    return '一份好吃的'
  }
  const text = names.length > 1 ? `${names[0]} 等 ${names.length} 样` : names[0]
  return text.length > 20 ? text.slice(0, 19) + '…' : text
}

// 新订单提醒（发给管理员）
function newOrderData(order) {
  return {
    thing1: { value: summary(order.items) },
    time2: { value: formatTime(order.createdAt) },
    amount3: { value: order.amount + '元' },
    thing4: { value: (order.note || '没有备注').slice(0, 20) }
  }
}

// 订单状态提醒（发给顾客），目前只在「出锅」时发送
function orderStatusData(order) {
  return {
    thing1: { value: summary(order.items) },
    character_string2: { value: order.no },
    phrase3: { value: '已出锅' },
    time4: { value: formatTime(Date.now()) },
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
