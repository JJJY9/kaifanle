const cloud = require('wx-server-sdk')
const seed = require('./seed')
const tpl = require('./templates')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

const CONFIG_ID = 'app'
const COLLECTIONS = ['categories', 'dishes', 'orders', 'config']

const STEP_TITLES = {
  pending: '已下单',
  accepted: '已接单 · 锅已热',
  cooking: '制作中 · 正在炒',
  ready: '出锅啦',
  completed: '已完成',
  cancelled: '已取消'
}

const ALLOWED_TRANSITIONS = {
  pending: ['accepted', 'cancelled'],
  accepted: ['cooking', 'cancelled'],
  cooking: ['ready'],
  ready: ['completed']
}

const MEALS = ['breakfast', 'lunch', 'dinner']

exports.main = async event => {
  const { OPENID } = cloud.getWXContext()
  const action = (event && event.action) || ''
  const payload = (event && event.payload) || {}

  try {
    const data = await route(action, payload, OPENID)
    return { ok: true, data }
  } catch (err) {
    console.error(`[api] ${action} failed:`, err)
    return {
      ok: false,
      error: (err && err.message) || '服务异常',
      code: (err && err.code) || 'ERROR'
    }
  }
}

async function route(action, payload, openid) {
  switch (action) {
    case 'getCategories':
      return getCategories()
    case 'getDishes':
      return getDishes()
    case 'getDish':
      return getDish(payload.id)
    case 'getOrders':
      return getOrders(openid)
    case 'getAllOrders':
      return getAllOrders(openid)
    case 'getOrder':
      return getOrder(payload.id, openid)
    case 'createOrder':
      return createOrder(payload, openid)
    case 'updateOrderStatus':
      return updateOrderStatus(payload, openid)
    case 'toggleDishStatus':
      return toggleDishStatus(payload, openid)
    case 'getMe':
      return getMe(openid)
    case 'initDb':
      return initDb(openid)
    default:
      throw new Error('未知操作: ' + action)
  }
}

function withId(doc) {
  if (!doc) {
    return null
  }
  return Object.assign({}, doc, { id: doc._id })
}

async function getConfig() {
  try {
    const res = await db.collection('config').doc(CONFIG_ID).get()
    return res.data
  } catch (e) {
    return null
  }
}

async function isAdminOpenid(openid) {
  const config = await getConfig()
  return Boolean(
    config &&
      Array.isArray(config.adminOpenids) &&
      config.adminOpenids.indexOf(openid) > -1
  )
}

async function requireAdmin(openid) {
  const ok = await isAdminOpenid(openid)
  if (!ok) {
    throw new Error('没有权限，只有管理员可以操作')
  }
}

async function getCategories() {
  const res = await db
    .collection('categories')
    .orderBy('sort', 'asc')
    .limit(100)
    .get()
  return res.data.map(withId)
}

async function getDishes() {
  const res = await db
    .collection('dishes')
    .orderBy('sort', 'asc')
    .limit(100)
    .get()
  return res.data.map(withId)
}

async function getDish(id) {
  if (!id) {
    return null
  }
  try {
    const res = await db.collection('dishes').doc(id).get()
    return withId(res.data)
  } catch (e) {
    return null
  }
}

async function getMe(openid) {
  const config = await getConfig()
  return {
    openid,
    isAdmin: Boolean(
      config &&
        Array.isArray(config.adminOpenids) &&
        config.adminOpenids.indexOf(openid) > -1
    ),
    initialized: Boolean(config && config.initialized)
  }
}

// 用户自己的订单
async function getOrders(openid) {
  const res = await db
    .collection('orders')
    .where({ _openid: openid })
    .orderBy('createdAt', 'desc')
    .limit(50)
    .get()
  return res.data.map(withId)
}

// 厨房端：管理员查看全部订单
async function getAllOrders(openid) {
  await requireAdmin(openid)
  const res = await db
    .collection('orders')
    .orderBy('createdAt', 'desc')
    .limit(100)
    .get()
  return res.data.map(withId)
}

async function getOrder(id, openid) {
  if (!id) {
    throw new Error('缺少订单 ID')
  }
  const res = await db.collection('orders').doc(id).get()
  const order = res.data
  const admin = await isAdminOpenid(openid)
  if (order._openid !== openid && !admin) {
    throw new Error('没有权限查看这个订单')
  }
  return withId(order)
}

async function createOrder(payload, openid) {
  const config = await getConfig()
  if (!config || !config.initialized) {
    throw new Error('云数据库还没初始化，请先到「我的」完成初始化')
  }
  if (!payload || !Array.isArray(payload.items) || payload.items.length === 0) {
    throw new Error('订单是空的')
  }
  if (payload.items.length > 20) {
    throw new Error('一次最多点 20 道菜')
  }

  const ids = payload.items.map(item => item && item.dishId).filter(Boolean)
  const dishRes = await db
    .collection('dishes')
    .where({ _id: _.in(ids) })
    .get()
  const dishMap = {}
  dishRes.data.forEach(dish => {
    dishMap[dish._id] = dish
  })

  const items = []
  let amount = 0

  for (const raw of payload.items) {
    const dish = dishMap[raw.dishId]
    if (!dish) {
      throw new Error('有菜品已经下架了，请刷新菜单')
    }
    if (dish.status !== 'on') {
      throw new Error(`${dish.name} 已售罄，换一道吧`)
    }
    const qty = Number(raw.qty)
    if (!Number.isInteger(qty) || qty < 1 || qty > 20) {
      throw new Error('菜品数量不正确')
    }
    const specs = Array.isArray(raw.specs) ? raw.specs.slice(0, 10) : []
    // 服务端按菜品单价 + 已选加料重新计价，不信任客户端传来的价格
    const addonSum = (dish.addons || [])
      .filter(addon => specs.indexOf(addon.name) > -1)
      .reduce((sum, addon) => sum + addon.price, 0)
    const unitPrice = dish.price + addonSum
    const note = String(raw.note || '').slice(0, 50)

    items.push({
      dishId: dish._id,
      name: dish.name,
      price: unitPrice,
      qty,
      specs,
      note
    })
    amount += unitPrice * qty
  }

  const meal = MEALS.indexOf(payload.meal) > -1 ? payload.meal : 'lunch'
  const expectedTime = String(payload.expectedTime || '尽快').slice(0, 20)
  const mode = String(payload.mode || '在家吃').slice(0, 20)
  const note = String(payload.note || '').slice(0, 100)

  const seq = Number(config.orderSeq || 0) + 1
  await db
    .collection('config')
    .doc(CONFIG_ID)
    .update({ data: { orderSeq: seq } })

  const now = Date.now()
  const order = {
    _openid: openid,
    no: String(seq).padStart(3, '0'),
    items,
    amount,
    meal,
    expectedTime,
    mode,
    note,
    status: 'pending',
    timeline: [{ status: 'pending', title: STEP_TITLES.pending, time: now }],
    createdAt: now
  }

  const addRes = await db.collection('orders').add({ data: order })

  // 新订单提醒：只发给已订阅「新订单提醒」模板的管理员。
  // 发送失败（没订阅 / 模板未配置）不影响下单。
  if (tpl.NEW_ORDER_TEMPLATE_ID && Array.isArray(config.adminOpenids)) {
    const data = tpl.newOrderData(order)
    for (const adminOpenid of config.adminOpenids) {
      await sendSubscribe(
        adminOpenid,
        tpl.NEW_ORDER_TEMPLATE_ID,
        'pages/kitchen/index',
        data
      )
    }
  }

  return Object.assign({}, order, { id: addRes._id })
}

async function updateOrderStatus(payload, openid) {
  await requireAdmin(openid)
  const id = payload.id
  const status = payload.status
  if (!id || !status) {
    throw new Error('参数不完整')
  }

  const res = await db.collection('orders').doc(id).get()
  const order = res.data
  const allowed = ALLOWED_TRANSITIONS[order.status] || []
  if (allowed.indexOf(status) === -1) {
    throw new Error('当前状态不能变更为 ' + status)
  }

  const entry = {
    status,
    title: STEP_TITLES[status] || status,
    time: Date.now()
  }
  await db
    .collection('orders')
    .doc(id)
    .update({
      data: {
        status,
        timeline: _.push([entry])
      }
    })

  // 出锅时给顾客发一条一次性订阅消息（模板未配置或未订阅则自动跳过）
  if (status === 'ready' && tpl.ORDER_STATUS_TEMPLATE_ID) {
    await sendSubscribe(
      order._openid,
      tpl.ORDER_STATUS_TEMPLATE_ID,
      'pages/order-detail/index?id=' + id,
      tpl.orderStatusData(Object.assign({}, order, { status }))
    )
  }

  return withId(
    Object.assign({}, order, {
      status,
      timeline: (order.timeline || []).concat([entry])
    })
  )
}

async function sendSubscribe(touser, templateId, page, data) {
  if (!touser || !templateId) {
    return
  }
  try {
    await cloud.openapi.subscribeMessage.send({
      touser,
      templateId,
      page,
      data,
      miniprogramState: tpl.MINIPROGRAM_STATE,
      lang: 'zh_CN'
    })
  } catch (e) {
    // 43101 = 用户没有订阅（或订阅次数已用完），属于正常情况
    console.warn(
      '[notify] subscribeMessage.send skipped:',
      (e && (e.errCode || e.errMsg)) || e
    )
  }
}

async function toggleDishStatus(payload, openid) {
  await requireAdmin(openid)
  if (!payload.id) {
    throw new Error('缺少菜品 ID')
  }
  const res = await db.collection('dishes').doc(payload.id).get()
  const dish = res.data
  const status = dish.status === 'soldout' ? 'on' : 'soldout'
  await db
    .collection('dishes')
    .doc(payload.id)
    .update({ data: { status } })
  return withId(Object.assign({}, dish, { status }))
}

// 一次性初始化：写入默认菜单，并把第一个调用者设为管理员。
// 初始化完成后再次调用不会改动任何数据。
async function initDb(openid) {
  const existing = await getConfig()
  if (existing && existing.initialized) {
    return {
      initialized: true,
      already: true,
      isAdmin: Boolean(
        Array.isArray(existing.adminOpenids) &&
          existing.adminOpenids.indexOf(openid) > -1
      )
    }
  }

  for (const name of COLLECTIONS) {
    try {
      await db.createCollection(name)
    } catch (e) {
      // 集合已存在时会报错，忽略即可
    }
  }

  try {
    const categoryCount = await db.collection('categories').count()
    if (categoryCount.total === 0) {
      for (const category of seed.categories) {
        const data = Object.assign({}, category)
        const id = data.id
        delete data.id
        await db.collection('categories').doc(id).set({ data })
      }
    }

    const dishCount = await db.collection('dishes').count()
    if (dishCount.total === 0) {
      for (const dish of seed.dishes) {
        const data = Object.assign({}, dish)
        const id = data.id
        delete data.id
        await db.collection('dishes').doc(id).set({ data })
      }
    }
  } catch (e) {
    console.error('[initDb] seed failed', e)
    throw new Error(
      '初始化失败：请先在云开发控制台手动创建 categories、dishes、orders、config 四个集合，然后重试'
    )
  }

  const admins =
    existing && Array.isArray(existing.adminOpenids)
      ? existing.adminOpenids.slice()
      : []
  if (admins.indexOf(openid) === -1) {
    admins.push(openid)
  }

  const config = {
    initialized: true,
    adminOpenids: admins,
    orderSeq: (existing && existing.orderSeq) || 0,
    updatedAt: Date.now()
  }
  await db.collection('config').doc(CONFIG_ID).set({ data: config })

  return {
    initialized: true,
    already: false,
    isAdmin: admins.indexOf(openid) > -1
  }
}
