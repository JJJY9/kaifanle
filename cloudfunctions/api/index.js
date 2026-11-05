const cloud = require('wx-server-sdk')
const seed = require('./seed')
const tpl = require('./templates')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

const CONFIG_ID = 'app'
const COLLECTIONS = ['categories', 'dishes', 'orders', 'config', 'wishes']

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

const DEFAULT_BUSINESS = {
  breakfast: { open: true, deadline: '09:30' },
  lunch: { open: true, deadline: '12:00' },
  dinner: { open: true, deadline: '20:00' },
  closedNote: '今天休息，明天见'
}

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
    case 'cancelOrder':
      return cancelOrder(payload, openid)
    case 'updateOrderStatus':
      return updateOrderStatus(payload, openid)
    case 'toggleDishStatus':
      return toggleDishStatus(payload, openid)
    case 'saveDish':
      return saveDish(payload, openid)
    case 'deleteDish':
      return deleteDish(payload, openid)
    case 'getMe':
      return getMe(openid)
    case 'initDb':
      return initDb(openid)
    case 'getBusiness':
      return getBusiness()
    case 'updateBusiness':
      return updateBusiness(payload, openid)
    case 'getMyProfile':
      return getMyProfile(openid)
    case 'saveMyProfile':
      return saveMyProfile(payload, openid)
    case 'getStats':
      return getStats(openid)
    case 'createCoupon':
      return createCoupon(payload, openid)
    case 'getCoupons':
      return getCoupons(openid)
    case 'claimCoupon':
      return claimCoupon(payload, openid)
    case 'useCoupon':
      return useCoupon(payload, openid)
    case 'deleteCoupon':
      return deleteCoupon(payload, openid)
    case 'createWish':
      return createWish(payload, openid)
    case 'getWishes':
      return getWishes(openid)
    case 'updateWish':
      return updateWish(payload, openid)
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

async function ensureCollection(name) {
  try {
    await db.createCollection(name)
  } catch (e) {
    // 集合已存在时会报错，忽略即可
  }
}

function normalizeBusiness(value) {
  const source = value && typeof value === 'object' ? value : {}
  const result = {
    closedNote: String(source.closedNote || DEFAULT_BUSINESS.closedNote).slice(
      0,
      40
    )
  }
  for (const meal of MEALS) {
    const item =
      source[meal] && typeof source[meal] === 'object' ? source[meal] : {}
    const deadline = /^\d{2}:\d{2}$/.test(item.deadline || '')
      ? item.deadline
      : DEFAULT_BUSINESS[meal].deadline
    result[meal] = {
      open: item.open !== false,
      deadline
    }
  }
  return result
}

function chinaNow() {
  const d = new Date(Date.now() + 8 * 60 * 60 * 1000)
  return { h: d.getUTCHours(), m: d.getUTCMinutes() }
}

async function getBusiness() {
  const config = await getConfig()
  return normalizeBusiness(config && config.business)
}

async function updateBusiness(payload, openid) {
  await requireAdmin(openid)
  const config = await getConfig()
  if (!config || !config.initialized) {
    throw new Error('云数据库还没初始化')
  }
  const business = normalizeBusiness(payload)
  await db
    .collection('config')
    .doc(CONFIG_ID)
    .update({ data: { business } })
  return business
}

function normalizeProfile(value) {
  const source = value && typeof value === 'object' ? value : {}
  const clean = list =>
    Array.isArray(list)
      ? list
          .map(item => String(item || '').trim())
          .filter(Boolean)
          .slice(0, 8)
          .map(item => item.slice(0, 8))
      : []
  return {
    dislikes: clean(source.dislikes),
    tastes: clean(source.tastes),
    address: String(source.address || '').slice(0, 60)
  }
}

async function getMyProfile(openid) {
  await ensureCollection('users')
  try {
    const res = await db.collection('users').doc(openid).get()
    return normalizeProfile(res.data)
  } catch (e) {
    return normalizeProfile(null)
  }
}

async function saveMyProfile(payload, openid) {
  await ensureCollection('users')
  const profile = normalizeProfile(payload)
  await db
    .collection('users')
    .doc(openid)
    .set({
      data: Object.assign({ updatedAt: Date.now() }, profile)
    })
  return profile
}

function chinaStartOfDay() {
  const china = new Date(Date.now() + 8 * 60 * 60 * 1000)
  return (
    Date.UTC(
      china.getUTCFullYear(),
      china.getUTCMonth(),
      china.getUTCDate()
    ) -
    8 * 60 * 60 * 1000
  )
}

async function getStats(openid) {
  await requireAdmin(openid)
  const res = await db
    .collection('orders')
    .orderBy('createdAt', 'desc')
    .limit(1000)
    .get()
  const start = chinaStartOfDay()
  const today = res.data.filter(order => order.createdAt >= start)
  const active = today.filter(order => order.status !== 'cancelled')
  const revenue = active.reduce((sum, order) => sum + Number(order.amount || 0), 0)
  const completed = today.filter(order => order.status === 'completed').length
  const dishCount = {}
  active.forEach(order => {
    ;(order.items || []).forEach(item => {
      dishCount[item.name] = (dishCount[item.name] || 0) + Number(item.qty || 0)
    })
  })
  const top = Object.keys(dishCount)
    .map(name => ({ name, qty: dishCount[name] }))
    .sort((a, b) => b.qty - a.qty)[0]

  return {
    orderCount: active.length,
    completed,
    revenue: Number(revenue.toFixed(2)),
    topDish: top ? top.name : '',
    topQty: top ? top.qty : 0
  }
}

async function createCoupon(payload, openid) {
  await requireAdmin(openid)
  const title = String((payload && payload.title) || '').trim()
  if (!title || title.length > 20) {
    throw new Error('券名需要 1-20 个字')
  }
  const note = String((payload && payload.note) || '').trim().slice(0, 40)
  await ensureCollection('coupons')
  const now = Date.now()
  const coupon = {
    title,
    note,
    status: 'unused',
    owner: '',
    createdAt: now,
    claimedAt: 0,
    usedAt: 0
  }
  const addRes = await db.collection('coupons').add({ data: coupon })
  return withId(Object.assign({}, coupon, { _id: addRes._id }))
}

async function getCoupons(openid) {
  await ensureCollection('coupons')
  const admin = await isAdminOpenid(openid)
  if (admin) {
    const res = await db
      .collection('coupons')
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get()
    return res.data.map(withId)
  }

  const [pool, mine] = await Promise.all([
    db
      .collection('coupons')
      .where({ owner: '' })
      .orderBy('createdAt', 'desc')
      .limit(30)
      .get(),
    db
      .collection('coupons')
      .where({ owner: openid })
      .orderBy('createdAt', 'desc')
      .limit(30)
      .get()
  ])
  const map = {}
  pool.data.concat(mine.data).forEach(coupon => {
    map[coupon._id] = coupon
  })
  return Object.keys(map)
    .map(id => map[id])
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 50)
    .map(withId)
}

async function claimCoupon(payload, openid) {
  await ensureCollection('coupons')
  if (!payload || !payload.id) {
    throw new Error('缺少券 ID')
  }
  const res = await db.collection('coupons').doc(payload.id).get()
  const coupon = res.data
  if (coupon.status === 'used') {
    throw new Error('这张券已经用掉了')
  }
  if (coupon.owner && coupon.owner !== openid) {
    throw new Error('这张券已经被领走了')
  }
  if (!coupon.owner) {
    await db
      .collection('coupons')
      .doc(payload.id)
      .update({ data: { owner: openid, claimedAt: Date.now() } })
    coupon.owner = openid
  }
  return withId(coupon)
}

async function useCoupon(payload, openid) {
  if (!payload || !payload.id) {
    throw new Error('缺少券 ID')
  }
  const res = await db.collection('coupons').doc(payload.id).get()
  const coupon = res.data
  const admin = await isAdminOpenid(openid)
  if (coupon.owner !== openid && !admin) {
    throw new Error('这张券不是你的')
  }
  if (coupon.status === 'used') {
    throw new Error('这张券已经用掉了')
  }
  const usedAt = Date.now()
  await db
    .collection('coupons')
    .doc(payload.id)
    .update({ data: { status: 'used', usedAt } })
  return withId(Object.assign({}, coupon, { status: 'used', usedAt }))
}

async function deleteCoupon(payload, openid) {
  await requireAdmin(openid)
  if (!payload || !payload.id) {
    throw new Error('缺少券 ID')
  }
  try {
    await db.collection('coupons').doc(payload.id).get()
  } catch (e) {
    throw new Error('券不存在')
  }
  await db.collection('coupons').doc(payload.id).remove()
  return { id: payload.id }
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

  const meal = MEALS.indexOf(payload && payload.meal) > -1 ? payload.meal : 'lunch'
  const business = normalizeBusiness(config.business)
  const mealBusiness = business[meal]
  if (!mealBusiness.open) {
    throw new Error('这一餐还没开火，先歇歇')
  }
  const current = chinaNow()
  const [deadlineHour, deadlineMinute] = mealBusiness.deadline
    .split(':')
    .map(Number)
  if (current.h * 60 + current.m > deadlineHour * 60 + deadlineMinute) {
    throw new Error('这一餐已经截单啦，下次早点来')
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
  const decremented = []

  try {
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

      // 有限库存：条件扣减，库存不足时整单回滚
      const stockDeducted =
        typeof dish.stock === 'number' && dish.stock >= 0
      if (stockDeducted) {
        const updateRes = await db
          .collection('dishes')
          .where({ _id: dish._id, stock: _.gte(qty) })
          .update({ data: { stock: _.inc(-qty) } })
        if (!updateRes.stats || updateRes.stats.updated !== 1) {
          throw new Error(`${dish.name} 卖完了，换一道吧`)
        }
        decremented.push({ id: dish._id, qty })
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
        note,
        stockDeducted
      })
      amount += unitPrice * qty
    }
  } catch (err) {
    for (const item of decremented) {
      try {
        await db
          .collection('dishes')
          .doc(item.id)
          .update({ data: { stock: _.inc(item.qty) } })
      } catch (e) {
        // 回滚失败时保留原始错误
      }
    }
    throw err
  }

  const expectedTime = String(payload.expectedTime || '尽快').slice(0, 20)
  const mode = String(payload.mode || '在家吃').slice(0, 20)
  const note = String(payload.note || '').slice(0, 100)
  const address = String(payload.address || '').slice(0, 60)
  let buyerProfile = { dislikes: [], tastes: [] }
  try {
    const savedProfile = await getMyProfile(openid)
    buyerProfile = {
      dislikes: savedProfile.dislikes,
      tastes: savedProfile.tastes
    }
  } catch (e) {
    // 没有口味档案时不影响下单
  }

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
    address,
    profile: buyerProfile,
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

async function cancelOrder(payload, openid) {
  if (!payload.id) {
    throw new Error('缺少订单 ID')
  }
  const res = await db.collection('orders').doc(payload.id).get()
  const order = res.data
  const admin = await isAdminOpenid(openid)
  if (order._openid !== openid && !admin) {
    throw new Error('没有权限取消这个订单')
  }
  if (order.status !== 'pending') {
    throw new Error('已经接单啦，不能取消')
  }

  const entry = {
    status: 'cancelled',
    title: STEP_TITLES.cancelled,
    time: Date.now()
  }
  await db
    .collection('orders')
    .doc(payload.id)
    .update({
      data: {
        status: 'cancelled',
        timeline: _.push([entry])
      }
    })
  await restoreStock(order)

  return withId(
    Object.assign({}, order, {
      status: 'cancelled',
      timeline: (order.timeline || []).concat([entry])
    })
  )
}

async function restoreStock(order) {
  for (const item of order.items || []) {
    if (!item.stockDeducted) {
      continue
    }
    try {
      await db
        .collection('dishes')
        .doc(item.dishId)
        .update({ data: { stock: _.inc(item.qty) } })
    } catch (e) {
      // 菜品可能已删除，忽略库存回补失败
    }
  }
}

async function updateOrderStatus(payload, openid) {  await requireAdmin(openid)
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

  // 厨房拒掉尚未接单的订单时，把扣掉的库存补回去
  if (status === 'cancelled' && order.status === 'pending') {
    await restoreStock(order)
  }

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
  // 供应中 -> 售罄；售罄/已下架 -> 恢复供应
  const status = dish.status === 'on' ? 'soldout' : 'on'
  await db
    .collection('dishes')
    .doc(payload.id)
    .update({ data: { status } })
  return withId(Object.assign({}, dish, { status }))
}

const MEAL_KEYS = ['breakfast', 'lunch', 'dinner']
const DISH_STATUS = ['on', 'soldout', 'off']

function cleanTextArray(value, maxCount, maxLength) {
  if (!Array.isArray(value)) {
    return []
  }
  return value
    .map(item => String(item || '').trim())
    .filter(Boolean)
    .slice(0, maxCount)
    .map(item => item.slice(0, maxLength))
}

async function saveDish(payload, openid) {
  await requireAdmin(openid)
  if (!payload || typeof payload !== 'object') {
    throw new Error('参数不完整')
  }

  const name = String(payload.name || '').trim()
  if (!name || name.length > 20) {
    throw new Error('菜品名称需要 1-20 个字')
  }
  const desc = String(payload.desc || '').trim().slice(0, 40)
  const price = Number(payload.price)
  if (!isFinite(price) || price < 0 || price > 999) {
    throw new Error('价格需要是 0-999 之间的数字')
  }
  const categoryId = String(payload.categoryId || '')
  if (!categoryId) {
    throw new Error('请选择分类')
  }
  try {
    await db.collection('categories').doc(categoryId).get()
  } catch (e) {
    throw new Error('分类不存在')
  }

  const meals = (Array.isArray(payload.meals) ? payload.meals : []).filter(
    meal => MEAL_KEYS.indexOf(meal) > -1
  )
  if (!meals.length) {
    throw new Error('至少选择一个餐次')
  }

  const status =
    DISH_STATUS.indexOf(payload.status) > -1 ? payload.status : 'on'
  const color = /^#[0-9a-fA-F]{6}$/.test(payload.color || '')
    ? payload.color
    : '#FFD23F'
  const tags = cleanTextArray(payload.tags, 5, 8)
  const spicyLevels = cleanTextArray(payload.spicyLevels, 5, 4)
  const addons = (Array.isArray(payload.addons) ? payload.addons : [])
    .slice(0, 10)
    .map((addon, index) => ({
      id: String((addon && addon.id) || 'a' + (index + 1)),
      name: String((addon && addon.name) || '').trim().slice(0, 10),
      price: Math.max(0, Math.min(999, Number(addon && addon.price) || 0))
    }))
    .filter(addon => addon.name)

  const stockValue = Number(payload.stock)
  const stock =
    isFinite(stockValue) && stockValue >= -1 && stockValue <= 9999
      ? Math.floor(stockValue)
      : -1

  const fields = {
    name,
    char: name.slice(0, 1),
    desc,
    price,
    categoryId,
    tags,
    spicyLevels,
    addons,
    color,
    meals,
    status,
    stock,
    isRecommended: Boolean(payload.isRecommended)
  }

  if (payload.id) {
    const id = String(payload.id)
    const res = await db.collection('dishes').doc(id).get()
    const dish = res.data
    await db.collection('dishes').doc(id).update({ data: fields })
    return withId(Object.assign({}, dish, fields))
  }

  const lastRes = await db
    .collection('dishes')
    .orderBy('sort', 'desc')
    .limit(1)
    .get()
  const sort = lastRes.data.length
    ? Number(lastRes.data[0].sort || 0) + 10
    : 10
  const data = Object.assign({}, fields, { sort })
  const addRes = await db.collection('dishes').add({ data })
  return withId(Object.assign({}, data, { _id: addRes._id }))
}

async function deleteDish(payload, openid) {
  await requireAdmin(openid)
  if (!payload.id) {
    throw new Error('缺少菜品 ID')
  }
  try {
    await db.collection('dishes').doc(payload.id).get()
  } catch (e) {
    throw new Error('菜品不存在')
  }
  await db.collection('dishes').doc(payload.id).remove()
  return { id: payload.id }
}

const WISH_STATUS = ['pending', 'planned', 'done']

async function createWish(payload, openid) {
  const content = String((payload && payload.content) || '').trim()
  if (!content || content.length > 50) {
    throw new Error('愿望需要 1-50 个字')
  }
  await ensureCollection('wishes')
  const now = Date.now()
  const wish = {
    _openid: openid,
    content,
    status: 'pending',
    plannedDate: '',
    reply: '',
    createdAt: now,
    updatedAt: now
  }
  const addRes = await db.collection('wishes').add({ data: wish })
  return withId(Object.assign({}, wish, { _id: addRes._id }))
}

async function getWishes(openid) {
  await ensureCollection('wishes')
  const admin = await isAdminOpenid(openid)
  let query = db.collection('wishes')
  if (!admin) {
    query = query.where({ _openid: openid })
  }
  const res = await query.orderBy('createdAt', 'desc').limit(50).get()
  return res.data.map(withId)
}

async function updateWish(payload, openid) {
  await requireAdmin(openid)
  const id = String((payload && payload.id) || '')
  if (!id) {
    throw new Error('缺少愿望 ID')
  }
  const res = await db.collection('wishes').doc(id).get()
  const wish = res.data
  const data = {}
  if (payload.status !== undefined) {
    if (WISH_STATUS.indexOf(payload.status) === -1) {
      throw new Error('愿望状态不正确')
    }
    data.status = payload.status
  }
  if (payload.plannedDate !== undefined) {
    data.plannedDate = String(payload.plannedDate || '').slice(0, 20)
  }
  if (payload.reply !== undefined) {
    data.reply = String(payload.reply || '').slice(0, 50)
  }
  data.updatedAt = Date.now()
  await db.collection('wishes').doc(id).update({ data })
  return withId(Object.assign({}, wish, data))
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
    business: normalizeBusiness(existing && existing.business),
    updatedAt: Date.now()
  }
  await db.collection('config').doc(CONFIG_ID).set({ data: config })

  return {
    initialized: true,
    already: false,
    isAdmin: admins.indexOf(openid) > -1
  }
}
