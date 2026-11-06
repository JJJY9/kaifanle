const cloud = require('wx-server-sdk')
const seed = require('./seed')
const tpl = require('./templates')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

const CONFIG_ID = 'app'
const COLLECTIONS = ['categories', 'dishes', 'orders', 'config', 'wishes']

const RATING_TAGS = ['好吃', '分量足', '准时', '有点辣', '下次还想吃']

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
  closedNote: '今天休息，明天见',
  notice: '',
  recommendText: '今日推荐',
  lowStockThreshold: 3,
  closedDates: [],
  weeklyClosed: []
}

exports.main = async event => {
  // 定时触发器：每天凌晨把今天的菜单补到明天，只填空缺不覆盖。
  // 定时调用没有用户 openid；如果带 openid 说明是客户端伪造的 Timer 事件。
  if (event && event.Type === 'Timer') {
    const { OPENID } = cloud.getWXContext()
    if (OPENID) {
      return { ok: false, error: '未知操作' }
    }
    try {
      const data = await autoRollMenu()
      return { ok: true, data }
    } catch (err) {
      console.error('[api] timer failed:', err)
      return { ok: false, error: (err && err.message) || '定时任务失败' }
    }
  }

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
    case 'saveCategory':
      return saveCategory(payload, openid)
    case 'moveCategory':
      return moveCategory(payload, openid)
    case 'deleteCategory':
      return deleteCategory(payload, openid)
    case 'getDishes':
      return getDishes()
    case 'getDish':
      return getDish(payload.id)
    case 'getOrders':
      return getOrders(openid)
    case 'getOrdersPage':
      return getOrdersPage(payload, openid)
    case 'getLastOrder':
      return getLastOrder(openid)
    case 'getMyActiveOrder':
      return getMyActiveOrder(openid)
    case 'getMyPendingReviewCount':
      return getMyPendingReviewCount(openid)
    case 'getMyStats':
      return getMyStats(openid)
    case 'getAllOrders':
      return getAllOrders(openid)
    case 'exportData':
      return exportData(openid)
    case 'getActiveOrders':
      return getActiveOrders(openid)
    case 'acceptPendingOrders':
      return acceptPendingOrders(openid)
    case 'getOrder':
      return getOrder(payload.id, openid)
    case 'createOrder':
      return createOrder(payload, openid)
    case 'cancelOrder':
      return cancelOrder(payload, openid)
    case 'updateOrderNote':
      return updateOrderNote(payload, openid)
    case 'updateOrderSlot':
      return updateOrderSlot(payload, openid)
    case 'urgeOrder':
      return urgeOrder(payload, openid)
    case 'rateOrder':
      return rateOrder(payload, openid)
    case 'replyRating':
      return replyRating(payload, openid)
    case 'updateOrderStatus':
      return updateOrderStatus(payload, openid)
    case 'toggleDishStatus':
      return toggleDishStatus(payload, openid)
    case 'saveDish':
      return saveDish(payload, openid)
    case 'deleteDish':
      return deleteDish(payload, openid)
    case 'moveDish':
      return moveDish(payload, openid)
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
    case 'getKitchenStatus':
      return getKitchenStatus()
    case 'getKitchenReport':
      return getKitchenReport(openid)
    case 'getDishSales':
      return getDishSales(payload, openid)
    case 'getStockLogs':
      return getStockLogs(payload, openid)
    case 'createCoupon':
      return createCoupon(payload, openid)
    case 'getCoupons':
      return getCoupons(openid)
    case 'getMyExpiringCoupons':
      return getMyExpiringCoupons(openid)
    case 'claimCoupon':
      return claimCoupon(payload, openid)
    case 'useCoupon':
      return useCoupon(payload, openid)
    case 'releaseCoupon':
      return releaseCoupon(payload, openid)
    case 'deleteCoupon':
      return deleteCoupon(payload, openid)
    case 'getMenuForDate':
      return getMenuForDate(payload)
    case 'getMenuTemplates':
      return getMenuTemplates(openid)
    case 'saveMenuTemplates':
      return saveMenuTemplates(payload, openid)
    case 'getWeekMenus':
      return getWeekMenus()
    case 'rollMenu':
      return rollMenu(openid)
    case 'saveMenu':
      return saveMenu(payload, openid)
    case 'deleteMenu':
      return deleteMenu(payload, openid)
    case 'createWish':
      return createWish(payload, openid)
    case 'getWishes':
      return getWishes(openid)
    case 'updateWish':
      return updateWish(payload, openid)
    case 'deleteWish':
      return deleteWish(payload, openid)
    default:
      throw new Error('未知操作: ' + action)
  }
}

function withId(doc) {
  if (!doc) {
    return null
  }
  const result = Object.assign({}, doc, { id: doc._id })
  // _openid 只在服务端做归属校验用，不需要发给客户端
  delete result._openid
  return result
}

// 只有「文档/集合不存在」才算未初始化；额度、网络等错误要往上抛，
// 避免把读取失败误判成“没有数据”。
function isMissingDocError(e) {
  const message = String((e && (e.errMsg || e.message)) || '')
  return /does not exist|not exist|not found|DOCUMENT_NOT_FOUND|DATABASE_COLLECTION_NOT_EXIST|-502005/i.test(
    message
  )
}

async function getConfig() {
  try {
    const res = await db.collection('config').doc(CONFIG_ID).get()
    return res.data
  } catch (e) {
    if (isMissingDocError(e)) {
      return null
    }
    throw e
  }
}

// 订单号取号：优先用事务，保证并发下单不会拿到同一个号；
// 环境不支持事务时退化为原子自增。
async function reserveOrderSeq() {
  if (typeof db.startTransaction === 'function') {
    for (let attempt = 0; attempt < 4; attempt++) {
      let transaction = null
      try {
        transaction = await db.startTransaction()
        const res = await transaction
          .collection('config')
          .doc(CONFIG_ID)
          .get()
        const seq = Number((res.data && res.data.orderSeq) || 0) + 1
        await transaction
          .collection('config')
          .doc(CONFIG_ID)
          .update({ data: { orderSeq: seq } })
        await transaction.commit()
        return { seq, fallback: false }
      } catch (err) {
        if (transaction) {
          try {
            await transaction.rollback()
          } catch (e) {
            // 回滚失败时忽略，继续重试
          }
        }
        if (attempt === 3) {
          console.warn('[api] 事务取号失败，退化为自增:', err)
          break
        }
        await new Promise(resolve => setTimeout(resolve, 20 * (attempt + 1)))
      }
    }
  }
  await db
    .collection('config')
    .doc(CONFIG_ID)
    .update({ data: { orderSeq: _.inc(1) } })
  const fresh = await db.collection('config').doc(CONFIG_ID).get()
  return {
    seq: Number((fresh.data && fresh.data.orderSeq) || 1),
    fallback: true
  }
}

// 可在云函数环境变量里配置 ADMIN_OPENIDS（逗号分隔）固定管理员，
// 这样即使数据库被清空重建，管理员也不会变化。
function envAdminOpenids() {
  return String(process.env.ADMIN_OPENIDS || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
}

// 管理员 = 环境变量 ADMIN_OPENIDS ∪ 数据库 config.adminOpenids
function adminOpenidsFrom(config) {
  const list =
    config && Array.isArray(config.adminOpenids)
      ? config.adminOpenids.slice()
      : []
  envAdminOpenids().forEach(openid => {
    if (list.indexOf(openid) === -1) {
      list.push(openid)
    }
  })
  return list
}

async function isAdminOpenid(openid) {
  const config = await getConfig()
  return adminOpenidsFrom(config).indexOf(openid) > -1
}

async function ensureCollection(name) {
  try {
    await db.createCollection(name)
  } catch (e) {
    // 集合已存在时会报错，忽略即可
  }
}

// 库存变动日志：失败不影响主流程，主要用于事后核对
async function logStock(entry) {
  try {
    await ensureCollection('stock_logs')
    await db.collection('stock_logs').add({
      data: Object.assign({}, entry, { createdAt: Date.now() })
    })
    // 偶尔清理 90 天前的旧日志，避免集合无限增长
    if (Math.random() < 0.05) {
      try {
        await db
          .collection('stock_logs')
          .where({
            createdAt: _.lt(Date.now() - 90 * 24 * 60 * 60 * 1000)
          })
          .remove()
      } catch (e) {
        // 清理失败不影响日志写入
      }
    }
  } catch (e) {
    console.warn('[api] logStock failed:', entry, e)
  }
}

function normalizeBusiness(value) {
  const source = value && typeof value === 'object' ? value : {}
  const result = {
    closedNote: String(source.closedNote || DEFAULT_BUSINESS.closedNote).slice(
      0,
      40
    ),
    // 今日公告：显示在首页，让她一眼看到
    notice: String(source.notice || '').slice(0, 60),
    // 首页今日推荐角标文案，可留空用默认
    recommendText:
      String(source.recommendText || '')
        .trim()
        .slice(0, 12) || DEFAULT_BUSINESS.recommendText,
    lowStockThreshold: (() => {
      const raw = source.lowStockThreshold
      if (raw === undefined || raw === null || String(raw).trim() === '') {
        return DEFAULT_BUSINESS.lowStockThreshold
      }
      const value = Number(raw)
      return isFinite(value) && value >= 0 && value <= 99
        ? Math.floor(value)
        : DEFAULT_BUSINESS.lowStockThreshold
    })(),
    // 指定休息日（YYYY-MM-DD），最多 14 天
    closedDates: Array.isArray(source.closedDates)
      ? source.closedDates
          .map(date => String(date || '').slice(0, 10))
          .filter(
            (date, index, list) =>
              /^\d{4}-\d{2}-\d{2}$/.test(date) &&
              list.indexOf(date) === index
          )
          .slice(0, 14)
      : [],
    // 每周固定休息：0=周日 ... 6=周六
    weeklyClosed: Array.isArray(source.weeklyClosed)
      ? source.weeklyClosed
          .map(Number)
          .filter(
            (day, index, list) =>
              Number.isInteger(day) &&
              day >= 0 &&
              day <= 6 &&
              list.indexOf(day) === index
          )
          .slice(0, 7)
      : []
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

function pad2(n) {
  return n < 10 ? '0' + n : String(n)
}

// YYYY-MM-DD 在北京时间下的星期（0=周日）
function chinaWeekday(dateString) {
  const ts = Date.parse(dateString + 'T00:00:00+08:00')
  if (!isFinite(ts)) {
    return -1
  }
  return new Date(ts + 8 * 60 * 60 * 1000).getUTCDay()
}

function chinaDateString(ts) {  const d = new Date((ts || Date.now()) + 8 * 60 * 60 * 1000)
  return (
    d.getUTCFullYear() +
    '-' +
    pad2(d.getUTCMonth() + 1) +
    '-' +
    pad2(d.getUTCDate())
  )
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
  const source = Object.assign({}, payload)
  if (source.lowStockThreshold === undefined) {
    // 旧客户端不带这个字段时保留已配置的阈值
    source.lowStockThreshold =
      config.business && config.business.lowStockThreshold
  }
  const business = normalizeBusiness(source)
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
    // 只有「还没有档案」才返回空档案；额度和网络错误必须上抛，
    // 否则会被客户端当成空档案保存，冲掉已有的口味和地址。
    if (isMissingDocError(e)) {
      return normalizeProfile(null)
    }
    throw e
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

async function getKitchenStatus() {
  try {
    const today = chinaDateString()
    const res = await db
      .collection('orders')
      .where({
        status: _.in(['pending', 'accepted', 'cooking'])
      })
      .limit(100)
      .get()
    const active = (res.data || []).filter(
      order =>
        (order.scheduledDate || chinaDateString(order.createdAt)) === today
    ).length
    return { active, busy: active > 0 }
  } catch (e) {
    if (isMissingDocError(e)) {
      return { active: 0, busy: false }
    }
    throw e
  }
}

async function getStats(openid) {
  await requireAdmin(openid)
  const start = chinaStartOfDay()
  const todayKey = chinaDateString()
  // 只取今天相关的小部分订单，避免每次看板都扫全表
  const [createdRes, scheduledRes] = await Promise.all([
    db
      .collection('orders')
      .where({ createdAt: _.gte(start) })
      .limit(200)
      .get(),
    db
      .collection('orders')
      .where({ scheduledDate: todayKey })
      .limit(200)
      .get()
  ])
  const map = {}
  createdRes.data.concat(scheduledRes.data).forEach(order => {
    map[order._id] = order
  })
  const today = Object.keys(map)
    .map(id => map[id])
    .filter(
      order =>
        (order.scheduledDate || chinaDateString(order.createdAt)) === todayKey
    )
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

  const rated = today.filter(
    order => typeof order.rating === 'number' && order.rating > 0
  )
  const avgRating = rated.length
    ? Number(
        (
          rated.reduce((sum, order) => sum + Number(order.rating), 0) /
          rated.length
        ).toFixed(1)
      )
    : 0
  const goodRatings = today.filter(order => order.rating === 3).length

  let totalOrders = 0
  try {
    const [allRes, cancelledRes] = await Promise.all([
      db.collection('orders').count(),
      db.collection('orders').where({ status: 'cancelled' }).count()
    ])
    totalOrders = (allRes.total || 0) - (cancelledRes.total || 0)
  } catch (e) {
    // 总数失败不影响今日看板
  }

  return {
    orderCount: active.length,
    completed,
    revenue: Number(revenue.toFixed(2)),
    topDish: top ? top.name : '',
    topQty: top ? top.qty : 0,
    ratedCount: rated.length,
    avgRating,
    goodRatings,
    totalOrders
  }
}

function chinaStartOfMonth() {
  const china = new Date(Date.now() + 8 * 60 * 60 * 1000)
  return (
    Date.UTC(china.getUTCFullYear(), china.getUTCMonth(), 1) -
    8 * 60 * 60 * 1000
  )
}

// 厨房近 30 天经营概览：营收、订单、客单价、菜品排行与评分
// 菜品库存变动记录（管理员）
async function getStockLogs(payload, openid) {
  await requireAdmin(openid)
  const dishId = String((payload && payload.dishId) || '')
  const limit = Math.min(
    50,
    Math.max(1, Number((payload && payload.limit) || 10))
  )
  try {
    let query = db.collection('stock_logs')
    if (dishId) {
      query = query.where({ dishId })
    }
    const res = await query.orderBy('createdAt', 'desc').limit(limit).get()
    return (res.data || []).map(withId)
  } catch (e) {
    // 集合还没建立时返回空
    return []
  }
}

async function getDishSales(payload, openid) {
  await requireAdmin(openid)
  const name = String((payload && payload.name) || '')
    .trim()
    .slice(0, 30)
  if (!name) {
    throw new Error('缺少菜品名称')
  }
  const start = chinaStartOfDay() - 29 * 24 * 60 * 60 * 1000
  const res = await db
    .collection('orders')
    .where({ createdAt: _.gte(start) })
    .limit(1000)
    .get()
  const todayStart = chinaStartOfDay()
  const dailyMap = {}
  for (let i = 6; i >= 0; i--) {
    const date = chinaDateString(todayStart - i * 24 * 60 * 60 * 1000)
    dailyMap[date] = { date, qty: 0 }
  }
  let qty = 0
  let orders = 0
  ;(res.data || []).forEach(order => {
    if (order.status === 'cancelled') {
      return
    }
    let matched = 0
    ;(order.items || []).forEach(item => {
      if (item.name === name) {
        const count = Number(item.qty || 0)
        qty += count
        matched += count
      }
    })
    if (matched > 0) {
      orders++
      const key = chinaDateString(order.createdAt)
      if (dailyMap[key]) {
        dailyMap[key].qty += matched
      }
    }
  })
  const daily = Object.keys(dailyMap)
    .sort()
    .map(key => ({
      date: key,
      label: `${Number(key.slice(5, 7))}/${Number(key.slice(8, 10))}`,
      qty: dailyMap[key].qty
    }))
  return { name, qty, orders, daily }
}

async function getKitchenReport(openid) {
  await requireAdmin(openid)
  const days = 30
  const todayStart = chinaStartOfDay()
  const start = todayStart - (days - 1) * 24 * 60 * 60 * 1000
  const res = await db
    .collection('orders')
    .where({ createdAt: _.gte(start) })
    .limit(1000)
    .get()
  const orders = res.data || []
  const active = orders.filter(order => order.status !== 'cancelled')
  const revenue = active.reduce(
    (sum, order) => sum + Number(order.amount || 0),
    0
  )

  const dailyMap = {}
  for (let i = 0; i < days; i++) {
    const date = chinaDateString(start + i * 24 * 60 * 60 * 1000)
    dailyMap[date] = { date, amount: 0, count: 0 }
  }
  active.forEach(order => {
    const key = chinaDateString(order.createdAt)
    if (dailyMap[key]) {
      dailyMap[key].amount += Number(order.amount || 0)
      dailyMap[key].count += 1
    }
  })
  const daily = Object.keys(dailyMap)
    .sort()
    .map(key => ({
      ...dailyMap[key],
      amount: Number(dailyMap[key].amount.toFixed(2)),
      label:
        Number(key.slice(5, 7)) + '/' + Number(key.slice(8, 10))
    }))

  const dishMap = {}
  active.forEach(order => {
    ;(order.items || []).forEach(item => {
      const name = item.name || '未命名'
      if (!dishMap[name]) {
        dishMap[name] = { name, qty: 0, revenue: 0 }
      }
      const qty = Number(item.qty || 0)
      dishMap[name].qty += qty
      dishMap[name].revenue += Number(item.price || 0) * qty
    })
  })
  const topDishes = Object.keys(dishMap)
    .map(name => ({
      ...dishMap[name],
      revenue: Number(dishMap[name].revenue.toFixed(2))
    }))
    .sort((a, b) => b.qty - a.qty || b.revenue - a.revenue)
    .slice(0, 8)

  const rated = active.filter(
    order => typeof order.rating === 'number' && order.rating > 0
  )
  const avgRating = rated.length
    ? Number(
        (
          rated.reduce((sum, order) => sum + Number(order.rating), 0) /
          rated.length
        ).toFixed(1)
      )
    : 0
  const goodRate = rated.length
    ? Math.round(
        (rated.filter(order => order.rating === 3).length / rated.length) *
          100
      )
    : 0
  const tagMap = {}
  active.forEach(order => {
    ;(order.ratingTags || []).forEach(tag => {
      const name = String(tag || '')
      if (name) {
        tagMap[name] = (tagMap[name] || 0) + 1
      }
    })
  })
  const topTags = Object.keys(tagMap)
    .map(name => ({ name, count: tagMap[name] }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
  const mealStats = MEALS.map(meal => {
    const list = active.filter(order => order.meal === meal)
    return {
      meal,
      count: list.length,
      revenue: Number(
        list
          .reduce((sum, order) => sum + Number(order.amount || 0), 0)
          .toFixed(2)
      )
    }
  })

  return {
    days,
    startDate: chinaDateString(start),
    endDate: chinaDateString(todayStart),
    totalOrders: active.length,
    cancelled: orders.length - active.length,
    completed: active.filter(order => order.status === 'completed').length,
    revenue: Number(revenue.toFixed(2)),
    avgOrder: active.length
      ? Number((revenue / active.length).toFixed(2))
      : 0,
    daily,
    topDishes,
    ratedCount: rated.length,
    avgRating,
    goodRate,
    topTags,
    mealStats
  }
}

// 「我的」页统计：总数用 count，月度明细最多取 200 单算最常点
async function getMyStats(openid) {
  const start = chinaStartOfMonth()
  const [allRes, cancelledRes, monthRes] = await Promise.all([
    db.collection('orders').where({ _openid: openid }).count(),
    db
      .collection('orders')
      .where({ _openid: openid, status: 'cancelled' })
      .count(),
    db
      .collection('orders')
      .where({ _openid: openid, createdAt: _.gte(start) })
      .limit(200)
      .get()
  ])
  const monthOrders = monthRes.data.filter(
    order => order.status !== 'cancelled'
  )
  const dishCount = {}
  monthOrders.forEach(order => {
    ;(order.items || []).forEach(item => {
      dishCount[item.name] = (dishCount[item.name] || 0) + Number(item.qty || 0)
    })
  })
  const favorite =
    Object.keys(dishCount).sort((a, b) => dishCount[b] - dishCount[a])[0] ||
    '还没点过'
  return {
    total: (allRes.total || 0) - (cancelledRes.total || 0),
    month: monthOrders.length,
    monthSpend: Number(
      monthOrders
        .reduce((sum, order) => sum + Number(order.amount || 0), 0)
        .toFixed(2)
    ),
    favorite
  }
}

async function createCoupon(payload, openid) {
  await requireAdmin(openid)
  const title = String((payload && payload.title) || '').trim()
  if (!title || title.length > 20) {
    throw new Error('券名需要 1-20 个字')
  }
  const note = String((payload && payload.note) || '').trim().slice(0, 40)
  const expiresInDaysRaw = Number((payload && payload.expiresInDays) || 0)
  const expiresInDays =
    isFinite(expiresInDaysRaw) && expiresInDaysRaw > 0
      ? Math.min(365, Math.floor(expiresInDaysRaw))
      : 0
  await ensureCollection('coupons')
  const now = Date.now()
  const coupon = {
    title,
    note,
    status: 'unused',
    owner: '',
    createdAt: now,
    claimedAt: 0,
    usedAt: 0,
    expiresAt: expiresInDays ? now + expiresInDays * 24 * 60 * 60 * 1000 : 0
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

// 首页提醒：我手里 3 天内到期、还没用的券
async function getMyExpiringCoupons(openid) {
  await ensureCollection('coupons')
  const now = Date.now()
  const soon = now + 3 * 24 * 60 * 60 * 1000
  const res = await db
    .collection('coupons')
    .where({
      owner: openid,
      status: 'unused',
      expiresAt: _.gte(now)
    })
    .limit(50)
    .get()
  const count = (res.data || []).filter(
    coupon => Number(coupon.expiresAt || 0) <= soon
  ).length
  return { count }
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
  if (coupon.expiresAt && Number(coupon.expiresAt) < Date.now()) {
    throw new Error('这张券过期了')
  }
  if (!coupon.owner) {
    // 手里的未使用券太多时先别领，避免把券池占满；过期券不占名额
    const now = Date.now()
    const [expiring, permanent, legacy] = await Promise.all([
      db
        .collection('coupons')
        .where({
          owner: openid,
          status: 'unused',
          expiresAt: _.gte(now)
        })
        .count(),
      db
        .collection('coupons')
        .where({ owner: openid, status: 'unused', expiresAt: 0 })
        .count(),
      db
        .collection('coupons')
        .where({
          owner: openid,
          status: 'unused',
          expiresAt: _.exists(false)
        })
        .count()
    ])
    const activeHeld =
      Number(expiring.total || 0) +
      Number(permanent.total || 0) +
      Number(legacy.total || 0)
    if (activeHeld >= 5) {
      throw new Error('手里的券还没用完，先用掉再领')
    }
    // 条件更新保证同一张券只会被一个人领走（且只能领未使用的券）
    const upd = await db
      .collection('coupons')
      .where({ _id: payload.id, owner: '', status: 'unused' })
      .update({ data: { owner: openid, claimedAt: Date.now() } })
    if (!upd.stats.updated) {
      const fresh = await db.collection('coupons').doc(payload.id).get()
      if (fresh.data.owner !== openid) {
        throw new Error('这张券已经被领走了')
      }
      return withId(fresh.data)
    }
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
  if (coupon.expiresAt && Number(coupon.expiresAt) < Date.now()) {
    throw new Error('这张券过期了')
  }
  const usedAt = Date.now()
  // 条件更新：并发下同一张券只会被用掉一次
  const upd = await db
    .collection('coupons')
    .where({ _id: payload.id, status: 'unused' })
    .update({ data: { status: 'used', usedAt } })
  if (!upd.stats.updated) {
    throw new Error('这张券已经用掉了')
  }
  return withId(Object.assign({}, coupon, { status: 'used', usedAt }))
}

// 把自己的未使用券退回券池，别人可以重新领取
async function releaseCoupon(payload, openid) {
  if (!payload || !payload.id) {
    throw new Error('缺少券 ID')
  }
  const res = await db.collection('coupons').doc(payload.id).get()
  const coupon = res.data
  if (coupon.owner !== openid) {
    throw new Error('这张券不是你的')
  }
  if (coupon.status === 'used') {
    throw new Error('这张券已经用掉了')
  }
  if (coupon.expiresAt && Number(coupon.expiresAt) < Date.now()) {
    throw new Error('这张券过期了')
  }
  const upd = await db
    .collection('coupons')
    .where({
      _id: payload.id,
      owner: openid,
      status: 'unused'
    })
    .update({ data: { owner: '', claimedAt: 0 } })
  if (!upd.stats || upd.stats.updated !== 1) {
    throw new Error('这张券刚刚变了，刷新看看')
  }
  return withId(
    Object.assign({}, coupon, { owner: '', claimedAt: 0 })
  )
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

function normalizeMenuDate(value) {
  const todayKey = chinaDateString()
  let date = String(value || '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    date = todayKey
  }
  const todayStart = Date.parse(todayKey + 'T00:00:00+08:00')
  const start = Date.parse(date + 'T00:00:00+08:00')
  if (
    !isFinite(start) ||
    start < todayStart ||
    start > todayStart + 7 * 24 * 60 * 60 * 1000
  ) {
    throw new Error('只能安排今天到 7 天内的菜单')
  }
  return date
}

function menuDocId(date, meal) {
  return date + '_' + meal
}

async function getMenuDoc(date, meal) {
  await ensureCollection('menus')
  try {
    const res = await db.collection('menus').doc(menuDocId(date, meal)).get()
    return Object.assign(
      { exists: true, date, meal, dishIds: [], open: true },
      res.data
    )
  } catch (e) {
    if (isMissingDocError(e)) {
      return { exists: false, date, meal, dishIds: [], open: true }
    }
    throw e
  }
}

async function getMenuForDate(payload) {
  const date = normalizeMenuDate(payload && payload.date)
  const meal =
    payload && MEALS.indexOf(payload.meal) > -1 ? payload.meal : 'lunch'
  return getMenuDoc(date, meal)
}

async function getMenuTemplates(openid) {
  await requireAdmin(openid)
  const config = await getConfig()
  return config && Array.isArray(config.menuTemplates)
    ? config.menuTemplates
    : []
}

async function saveMenuTemplates(payload, openid) {
  await requireAdmin(openid)
  const raw =
    payload && Array.isArray(payload.templates) ? payload.templates : []
  const templates = raw
    .slice(0, 15)
    .map((item, index) => {
      const name = String((item && item.name) || '')
        .trim()
        .slice(0, 12)
      const meal =
        item && MEALS.indexOf(item.meal) > -1 ? item.meal : 'lunch'
      const dishIds = Array.isArray(item && item.dishIds)
        ? item.dishIds
            .filter(id => typeof id === 'string')
            .slice(0, 50)
        : []
      const id = String((item && item.id) || `tpl-${index}`).slice(0, 40)
      const updatedAt = Number((item && item.updatedAt) || Date.now())
      return { id, name, meal, dishIds, updatedAt }
    })
    .filter(item => item.name && item.dishIds.length)
  await db
    .collection('config')
    .doc(CONFIG_ID)
    .update({ data: { menuTemplates: templates } })
  return templates
}

// 周饭表固定展示北京时间今天起 7 天（今天..今天+6），共 21 个菜单文档；
// 不接受客户端传入日期，避免被用来扫任意区间。
async function getWeekMenus() {
  const now = Date.now()
  const dates = []
  for (let i = 0; i < 7; i++) {
    dates.push(chinaDateString(now + i * 24 * 60 * 60 * 1000))
  }
  const ids = []
  dates.forEach(date => {
    MEALS.forEach(meal => ids.push(menuDocId(date, meal)))
  })
  let docs = []
  try {
    const res = await db
      .collection('menus')
      .where({ _id: _.in(ids) })
      .limit(50)
      .get()
    docs = res.data || []
  } catch (e) {
    // menus 集合还没创建过时视为整周都没排菜单
    if (!isMissingDocError(e)) {
      throw e
    }
  }
  const map = {}
  docs.forEach(doc => {
    map[doc._id] = doc
  })
  return {
    startDate: dates[0],
    endDate: dates[dates.length - 1],
    days: dates.map(date => ({
      date,
      weekday: chinaWeekday(date),
      menus: MEALS.map(meal => {
        const doc = map[menuDocId(date, meal)]
        if (!doc) {
          return { exists: false, date, meal, dishIds: [], open: true }
        }
        return {
          exists: true,
          date,
          meal,
          dishIds: Array.isArray(doc.dishIds) ? doc.dishIds : [],
          open: doc.open !== false
        }
      })
    }))
  }
}

// 管理员补跑一次「每日滚动」：打开厨房时如果今天还没跑过，客户端会自动调用
async function rollMenu(openid) {
  await requireAdmin(openid)
  return autoRollMenu()
}

async function saveMenu(payload, openid) {
  await requireAdmin(openid)
  if (!payload) {
    throw new Error('参数不完整')
  }
  const date = normalizeMenuDate(payload.date)
  const meal = MEALS.indexOf(payload.meal) > -1 ? payload.meal : ''
  if (!meal) {
    throw new Error('请选择餐次')
  }
  const rawIds = Array.isArray(payload.dishIds) ? payload.dishIds : []
  const ids = []
  rawIds.forEach(id => {
    const value = String(id || '')
    if (value && ids.indexOf(value) === -1) {
      ids.push(value)
    }
  })
  let validIds = []
  if (ids.length) {
    const dishRes = await db
      .collection('dishes')
      .where({ _id: _.in(ids.slice(0, 50)) })
      .get()
    validIds = dishRes.data.map(dish => dish._id)
  }
  const data = {
    date,
    meal,
    dishIds: validIds,
    open: payload.open !== false,
    updatedAt: Date.now()
  }
  await ensureCollection('menus')
  await db
    .collection('menus')
    .doc(menuDocId(date, meal))
    .set({ data })
  return Object.assign({ exists: true }, data)
}

async function deleteMenu(payload, openid) {  await requireAdmin(openid)
  if (!payload) {
    throw new Error('参数不完整')
  }
  const date = normalizeMenuDate(payload.date)
  const meal = MEALS.indexOf(payload.meal) > -1 ? payload.meal : ''
  if (!meal) {
    throw new Error('请选择餐次')
  }
  await ensureCollection('menus')
  try {
    await db.collection('menus').doc(menuDocId(date, meal)).remove()
  } catch (e) {
    // 菜单本来就不存在
  }
  return { date, meal }
}

// 每天凌晨把今天的菜单复制到明天：只补空缺，不覆盖已排好的菜单；
// 同时把「已售罄」的菜品恢复供应，新的一天重新开卖。
async function autoRollMenu() {
  const today = chinaDateString()
  const tomorrow = chinaDateString(Date.now() + 24 * 60 * 60 * 1000)
  // 每天只滚动一次：重复打开厨房或定时器补跑都不能再恢复已手动售罄的菜、
  // 也不能重建管理员已经删掉的次日菜单。
  const config = await getConfig()
  if (config && config.lastRollDate === today) {
    return { date: tomorrow, menus: [], restored: 0, skipped: true }
  }
  const rolled = []
  for (const meal of MEALS) {
    const next = await getMenuDoc(tomorrow, meal)
    if (next.exists) {
      continue
    }
    const current = await getMenuDoc(today, meal)
    if (!current.exists) {
      continue
    }
    const data = {
      date: tomorrow,
      meal,
      dishIds: current.dishIds,
      open: current.open !== false,
      updatedAt: Date.now()
    }
    await db
      .collection('menus')
      .doc(menuDocId(tomorrow, meal))
      .set({ data })
    rolled.push(meal)
  }

  // 售罄状态按天重置（下架 off 不受影响），一次批量更新，避免定时任务超时
  let restored = 0
  try {
    const upd = await db
      .collection('dishes')
      .where({ status: 'soldout' })
      .update({ data: { status: 'on' } })
    restored = (upd.stats && upd.stats.updated) || 0
  } catch (e) {
    console.warn('[api] reset soldout failed:', e)
  }

  try {
    await db
      .collection('config')
      .doc(CONFIG_ID)
      .update({ data: { lastRollDate: today } })
  } catch (e) {
    // 记录失败时宁可下次重复一次，也不要把当天的滚动结果吞掉
    console.warn('[api] save lastRollDate failed:', e)
  }

  return { date: tomorrow, menus: rolled, restored, skipped: false }
}

// 内容安全检测：违规内容直接拒绝；接口未开通或异常时不阻断正常使用。
async function checkContentSafety(openid, content) {
  const text = String(content || '').trim()
  if (!text) {
    return
  }
  let suggest = ''
  try {
    const res = await cloud.openapi.security.msgSecCheck({
      openid,
      scene: 2,
      version: 2,
      content: text.slice(0, 500)
    })
    suggest = (res && res.result && res.result.suggest) || ''
  } catch (err) {
    if (err && String(err.errCode) === '87014') {
      throw new Error('内容好像不太合适，换个说法吧')
    }
    console.warn('[api] msgSecCheck skipped:', (err && err.errMsg) || err)
    return
  }
  if (suggest && suggest !== 'pass') {
    throw new Error('内容好像不太合适，换个说法吧')
  }
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

async function saveCategory(payload, openid) {
  await requireAdmin(openid)
  if (!payload) {
    throw new Error('参数不完整')
  }
  const name = String(payload.name || '').trim()
  if (!name || name.length > 8) {
    throw new Error('分类名称需要 1-8 个字')
  }
  const color = /^#[0-9a-fA-F]{6}$/.test(payload.color || '')
    ? payload.color
    : '#FFD23F'
  const id = payload.id ? String(payload.id) : ''
  if (id) {
    const res = await db.collection('categories').doc(id).get()
    const dup = await db
      .collection('categories')
      .where({ name })
      .limit(5)
      .get()
    if ((dup.data || []).some(item => item._id !== id)) {
      throw new Error('已经有同名分类了')
    }
    await db
      .collection('categories')
      .doc(id)
      .update({ data: { name, color } })
    return withId(Object.assign({}, res.data, { name, color }))
  }
  const dup = await db.collection('categories').where({ name }).count()
  if (dup.total > 0) {
    throw new Error('已经有同名分类了')
  }
  const lastRes = await db
    .collection('categories')
    .orderBy('sort', 'desc')
    .limit(1)
    .get()
  const sort = lastRes.data.length
    ? Number(lastRes.data[0].sort || 0) + 10
    : 10
  const data = { name, color, sort }
  const addRes = await db.collection('categories').add({ data })
  return withId(Object.assign({}, data, { _id: addRes._id }))
}

async function moveCategory(payload, openid) {
  await requireAdmin(openid)
  if (!payload || !payload.id) {
    throw new Error('缺少分类 ID')
  }
  const direction = payload.direction === 'up' ? -1 : 1
  const res = await db
    .collection('categories')
    .orderBy('sort', 'asc')
    .limit(100)
    .get()
  const list = res.data || []
  const index = list.findIndex(item => item._id === payload.id)
  if (index === -1) {
    throw new Error('分类不存在')
  }
  const target = index + direction
  if (target < 0 || target >= list.length) {
    return { moved: false }
  }
  const current = list[index]
  const neighbor = list[target]
  const currentSort = Number(current.sort || 0)
  const neighborSort = Number(neighbor.sort || 0)
  let nextCurrent = neighborSort
  let nextNeighbor = currentSort
  if (currentSort === neighborSort) {
    nextCurrent = neighborSort + (direction > 0 ? 1 : -1)
    nextNeighbor = currentSort
  }
  await db
    .collection('categories')
    .doc(current._id)
    .update({ data: { sort: nextCurrent } })
  await db
    .collection('categories')
    .doc(neighbor._id)
    .update({ data: { sort: nextNeighbor } })
  return { moved: true }
}

async function deleteCategory(payload, openid) {
  await requireAdmin(openid)
  if (!payload || !payload.id) {
    throw new Error('缺少分类 ID')
  }
  const id = String(payload.id)
  const dishCount = await db
    .collection('dishes')
    .where({ categoryId: id })
    .count()
  if (dishCount.total > 0) {
    throw new Error('这个分类下还有菜品，先移走再删')
  }
  try {
    await db.collection('categories').doc(id).get()
  } catch (e) {
    throw new Error('分类不存在')
  }
  await db.collection('categories').doc(id).remove()
  return { id }
}

async function getDishes() {
  const res = await db
    .collection('dishes')
    .orderBy('sort', 'asc')
    .limit(1000)
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
    isAdmin: adminOpenidsFrom(config).indexOf(openid) > -1,
    initialized: Boolean(config && config.initialized)
  }
}

// 用户自己的订单（最近 50 单）
async function getOrders(openid) {
  const res = await db
    .collection('orders')
    .where({ _openid: openid })
    .orderBy('createdAt', 'desc')
    .limit(50)
    .get()
  return res.data.map(withId)
}

// 订单分页：before 传上一页最后一条的 createdAt
async function getOrdersPage(payload, openid) {
  const limit = Math.min(
    50,
    Math.max(1, Number((payload && payload.limit) || 20))
  )
  const before = Number((payload && payload.before) || 0)
  const cond = { _openid: openid }
  if (before > 0) {
    cond.createdAt = _.lt(before)
  }
  const res = await db
    .collection('orders')
    .where(cond)
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get()
  const orders = res.data.map(withId)
  return {
    orders,
    hasMore: (res.data || []).length === limit,
    nextBefore: orders.length
      ? Number(orders[orders.length - 1].createdAt || 0)
      : 0
  }
}

// 首页「上次吃」：最近一笔今天或更早的非取消订单
async function getLastOrder(openid) {
  const today = chinaDateString()
  const tomorrowStart = chinaStartOfDay() + 24 * 60 * 60 * 1000
  // 日期条件下推到查询，避免未来预订单占满 limit 后把历史单挤掉
  const [scheduledRes, legacyRes] = await Promise.all([
    db
      .collection('orders')
      .where({
        _openid: openid,
        status: _.neq('cancelled'),
        scheduledDate: _.lte(today)
      })
      .orderBy('createdAt', 'desc')
      .limit(10)
      .get(),
    db
      .collection('orders')
      .where({
        _openid: openid,
        status: _.neq('cancelled'),
        scheduledDate: _.exists(false),
        createdAt: _.lt(tomorrowStart)
      })
      .orderBy('createdAt', 'desc')
      .limit(10)
      .get()
  ])
  const map = {}
  ;(scheduledRes.data || []).concat(legacyRes.data || []).forEach(order => {
    map[order._id] = order
  })
  const order = Object.keys(map)
    .map(id => map[id])
    .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))[0]
  return order ? withId(order) : null
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

// 管理员数据备份：配置 + 菜品/分类/菜单/券/许愿 + 最近订单。
// 只用于换设备或误删后的恢复参考，不做自动回写。
async function exportData(openid) {
  await requireAdmin(openid)
  const safeList = async (name, limit, orderField) => {
    try {
      let query = db.collection(name)
      if (orderField) {
        query = query.orderBy(orderField, 'desc')
      }
      const res = await query.limit(limit).get()
      return (res.data || []).map(withId)
    } catch (e) {
      // 某个集合还没建或读取失败时，备份里留空数组
      return []
    }
  }
  const [categories, dishes, menus, coupons, wishes, orders] =
    await Promise.all([
      safeList('categories', 200),
      safeList('dishes', 1000),
      safeList('menus', 1000),
      safeList('coupons', 1000),
      safeList('wishes', 500),
      safeList('orders', 200, 'createdAt')
    ])
  let config = null
  try {
    const raw = await getConfig()
    if (raw) {
      config = Object.assign({}, raw)
      delete config._id
      delete config._openid
    }
  } catch (e) {
    config = null
  }
  return {
    exportedAt: Date.now(),
    version: '1.0',
    ordersLimit: 200,
    counts: {
      categories: categories.length,
      dishes: dishes.length,
      menus: menus.length,
      coupons: coupons.length,
      wishes: wishes.length,
      orders: orders.length
    },
    data: {
      categories,
      dishes,
      menus,
      coupons,
      wishes,
      orders,
      config
    }
  }
}

// 厨房一键接单：只处理今天及逾期的待接单订单，逐单条件更新
async function acceptPendingOrders(openid) {
  await requireAdmin(openid)
  const today = chinaDateString()
  const todayEnd = chinaStartOfDay() + 24 * 60 * 60 * 1000
  // 日期条件下推到查询，未来预订单不会占满 50 条名额
  const [scheduledRes, legacyRes] = await Promise.all([
    db
      .collection('orders')
      .where({ status: 'pending', scheduledDate: _.lte(today) })
      .limit(50)
      .get(),
    db
      .collection('orders')
      .where({
        status: 'pending',
        scheduledDate: _.exists(false),
        createdAt: _.lt(todayEnd)
      })
      .limit(50)
      .get()
  ])
  const map = {}
  ;(scheduledRes.data || []).concat(legacyRes.data || []).forEach(order => {
    map[order._id] = order
  })
  const targets = Object.keys(map).map(id => map[id])
  let done = 0
  for (const order of targets) {
    const entry = {
      status: 'accepted',
      title: STEP_TITLES.accepted,
      time: Date.now()
    }
    try {
      const upd = await db
        .collection('orders')
        .where({ _id: order._id, status: 'pending' })
        .update({
          data: { status: 'accepted', timeline: _.push([entry]) }
        })
      if (upd.stats && upd.stats.updated === 1) {
        done++
      }
    } catch (e) {
      console.warn('[api] acceptPendingOrders skip:', order._id, e)
    }
  }
  return { done, total: targets.length }
}

// 首页「今天这单」：当前用户今天最近的进行中订单
async function getMyActiveOrder(openid) {
  const today = chinaDateString()
  const activeStatus = ['pending', 'accepted', 'cooking', 'ready']
  const [scheduledRes, legacyRes] = await Promise.all([
    db
      .collection('orders')
      .where({
        _openid: openid,
        status: _.in(activeStatus),
        scheduledDate: today
      })
      .limit(10)
      .get(),
    db
      .collection('orders')
      .where({
        _openid: openid,
        status: _.in(activeStatus),
        scheduledDate: _.exists(false),
        createdAt: _.gte(chinaStartOfDay())
      })
      .limit(10)
      .get()
  ])
  const map = {}
  ;(scheduledRes.data || []).concat(legacyRes.data || []).forEach(order => {
    map[order._id] = order
  })
  const order = Object.keys(map)
    .map(id => map[id])
    .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))[0]
  return order ? withId(order) : null
}

// 首页提醒：已完成但还没评价的订单数
async function getMyPendingReviewCount(openid) {
  const res = await db
    .collection('orders')
    .where({ _openid: openid, status: 'completed' })
    .limit(100)
    .get()
  const count = (res.data || []).filter(
    order => [1, 2, 3].indexOf(Number(order.rating)) === -1
  ).length
  return { count }
}

// 厨房轮询专用：只取未完成订单，减少每次刷新读取的文档数
async function getActiveOrders(openid) {
  await requireAdmin(openid)
  const res = await db
    .collection('orders')
    .where({ status: _.in(['pending', 'accepted', 'cooking', 'ready']) })
    .limit(50)
    .get()
  return res.data
    .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))
    .map(withId)
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

  // 同一个下单请求重试（例如超时但订单已写入）直接返回原订单，避免重复扣库存
  const requestId = String((payload && payload.requestId) || '').slice(0, 64)
  if (requestId) {
    try {
      const existing = await db
        .collection('orders')
        .where({ _openid: openid, requestId })
        .limit(1)
        .get()
      if (existing.data && existing.data.length) {
        return withId(existing.data[0])
      }
    } catch (e) {
      // 去重查询失败不阻断下单，服务端库存与订单仍会做基本校验
      console.warn('[api] createOrder dedupe failed:', e)
    }
  }

  const meal = MEALS.indexOf(payload && payload.meal) > -1 ? payload.meal : 'lunch'
  const business = normalizeBusiness(config.business)
  const mealBusiness = business[meal]
  if (!mealBusiness.open) {
    throw new Error('这一餐还没开火，先歇歇')
  }

  const todayKey = chinaDateString()
  let scheduledDate = String(payload.scheduledDate || '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(scheduledDate)) {
    scheduledDate = todayKey
  }
  const todayStart = Date.parse(todayKey + 'T00:00:00+08:00')
  const scheduledStart = Date.parse(scheduledDate + 'T00:00:00+08:00')
  if (
    !isFinite(scheduledStart) ||
    scheduledStart < todayStart ||
    scheduledStart > todayStart + 7 * 24 * 60 * 60 * 1000
  ) {
    throw new Error('只能预订今天到 7 天内的餐')
  }

  // 只对「今天」的订单检查截单时间，提前预订不受当天截单限制
  if (scheduledDate === todayKey) {
    const current = chinaNow()
    const [deadlineHour, deadlineMinute] = mealBusiness.deadline
      .split(':')
      .map(Number)
    if (current.h * 60 + current.m > deadlineHour * 60 + deadlineMinute) {
      throw new Error('这一餐已经截单啦，下次早点来')
    }
  }

  if (
    Array.isArray(business.closedDates) &&
    business.closedDates.indexOf(scheduledDate) > -1
  ) {
    throw new Error('这一天休息，换个日子吧')
  }
  if (
    Array.isArray(business.weeklyClosed) &&
    business.weeklyClosed.indexOf(chinaWeekday(scheduledDate)) > -1
  ) {
    throw new Error('这一天固定休息，换个日子吧')
  }

  const menu = await getMenuDoc(scheduledDate, meal)
  if (menu.exists && menu.open === false) {
    throw new Error('这一餐还没排菜单')
  }

  if (!payload || !Array.isArray(payload.items) || payload.items.length === 0) {
    throw new Error('订单是空的')
  }
  if (payload.items.length > 20) {
    throw new Error('一次最多点 20 道菜')
  }

  // 备注（整单 + 每道菜）、地址和规格先做内容安全检查，避免扣完库存再失败
  const note = String(payload.note || '').slice(0, 100)
  const itemNotes = payload.items
    .map(item => String((item && item.note) || '').trim())
    .filter(Boolean)
    .join('\n')
    .slice(0, 400)
  const address = String(payload.address || '').trim().slice(0, 60)
  const specsText = payload.items
    .map(item =>
      Array.isArray(item && item.specs) ? item.specs.join(' / ') : ''
    )
    .filter(Boolean)
    .join('\n')
    .slice(0, 300)
  const expectedTime = String(payload.expectedTime || '尽快').slice(0, 20)
  const mode = String(payload.mode || '在家吃').slice(0, 20)
  await checkContentSafety(
    openid,
    [note, itemNotes, address, specsText, mode, expectedTime]
      .filter(Boolean)
      .join('\n')
      .slice(0, 500)
  )

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
      // 即使这一餐没有排菜单，也要校验菜品是否供应这一餐
      if (!Array.isArray(dish.meals) || dish.meals.indexOf(meal) === -1) {
        throw new Error(`${dish.name} 这一餐不供应`)
      }
      if (menu.exists && menu.dishIds.indexOf(raw.dishId) === -1) {
        throw new Error(`${dish.name} 这一餐不供应`)
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
    await rollbackStock(decremented)
    throw err
  }

  try {
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

    const seqInfo = await reserveOrderSeq()

    const now = Date.now()
    // 事务不可用时序号可能并发重复，加一小段随机后缀保证展示号唯一
    const orderNo =
      String(seqInfo.seq).padStart(3, '0') +
      (seqInfo.fallback ? '-' + Math.random().toString(36).slice(2, 5) : '')
    const order = {
      _openid: openid,
      no: orderNo,
      items,
      amount,
      meal,
      expectedTime,
      mode,
      note,
      address,
      scheduledDate,
      profile: buyerProfile,
      status: 'pending',
      urgedAt: 0,
      urgeCount: 0,
      urgeBucket: 0,
      timeline: [{ status: 'pending', title: STEP_TITLES.pending, time: now }],
      createdAt: now
    }
    if (requestId) {
      order.requestId = requestId
    }

    const addRes = await db.collection('orders').add({ data: order })

    for (const item of items) {
      if (item.stockDeducted) {
        await logStock({
          dishId: item.dishId,
          dishName: item.name,
          delta: -Number(item.qty || 0),
          source: 'order',
          orderId: addRes._id,
          orderNo
        })
      }
    }

    // 新订单提醒：只发给已订阅「新订单提醒」模板的管理员。
    // 发送失败（没订阅 / 模板未配置）不影响下单。
    if (tpl.NEW_ORDER_TEMPLATE_ID) {
      const adminOpenids = adminOpenidsFrom(config)
      const data = tpl.newOrderData(order)
      for (const adminOpenid of adminOpenids) {
        await sendSubscribe(
          adminOpenid,
          tpl.NEW_ORDER_TEMPLATE_ID,
          'pages/kitchen/index',
          data
        )
      }
    }

    return withId(Object.assign({}, order, { _id: addRes._id }))
  } catch (err) {
    // 取号或写入订单失败时，把已经扣掉的库存补回去
    await rollbackStock(decremented)
    console.error('[api] createOrder rollback:', decremented, err)
    throw err
  }
}

async function rollbackStock(items) {
  for (const item of items) {
    try {
      await db
        .collection('dishes')
        .doc(item.id)
        .update({ data: { stock: _.inc(item.qty) } })
    } catch (e) {
      console.error('[api] rollback stock failed:', item, e)
    }
  }
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
  const cancelReason = String(payload.reason || '').trim().slice(0, 50)
  await checkContentSafety(openid, cancelReason)

  const entry = {
    status: 'cancelled',
    title: STEP_TITLES.cancelled,
    time: Date.now()
  }
  // 条件更新：并发取消时只会成功一次，避免库存重复回补
  const upd = await db
    .collection('orders')
    .where({ _id: payload.id, status: 'pending' })
    .update({
      data: {
        status: 'cancelled',
        cancelReason,
        cancelledBy: admin ? 'admin' : 'customer',
        timeline: _.push([entry])
      }
    })
  if (!upd.stats || upd.stats.updated !== 1) {
    throw new Error('订单状态刚刚变了，刷新看看')
  }
  await restoreStock(order)

  return withId(
    Object.assign({}, order, {
      status: 'cancelled',
      cancelReason,
      cancelledBy: admin ? 'admin' : 'customer',
      timeline: (order.timeline || []).concat([entry])
    })
  )
}

// 顾客改整单备注：开火前都可以补一句，厨房端看到的是最新备注
async function updateOrderNote(payload, openid) {
  const id = String((payload && payload.id) || '')
  if (!id) {
    throw new Error('缺少订单 ID')
  }
  let order
  try {
    const res = await db.collection('orders').doc(id).get()
    order = res.data
  } catch (e) {
    if (isMissingDocError(e)) {
      throw new Error('订单不存在')
    }
    throw e
  }
  if (order._openid !== openid) {
    throw new Error('只能改自己的订单')
  }
  if (['pending', 'accepted'].indexOf(order.status) === -1) {
    throw new Error('开火后就不能改备注啦')
  }
  const note = Array.from(String((payload && payload.note) || '').trim())
    .slice(0, 100)
    .join('')
  if (note === String(order.note || '')) {
    return withId(order)
  }
  await checkContentSafety(openid, note)
  const data = { note, noteUpdatedAt: Date.now() }
  const upd = await db
    .collection('orders')
    .where({ _id: id, status: _.in(['pending', 'accepted']) })
    .update({ data })
  if (!upd.stats || upd.stats.updated !== 1) {
    throw new Error('订单状态刚刚变了，刷新看看')
  }
  return withId(Object.assign({}, order, data))
}

// 顾客改餐次/日期：仅未接单时，重新校验营业状态与菜单供应
async function updateOrderSlot(payload, openid) {
  const id = String((payload && payload.id) || '')
  const meal = MEALS.indexOf(payload && payload.meal) > -1
    ? payload.meal
    : ''
  if (!id || !meal) {
    throw new Error('参数不完整')
  }
  let order
  try {
    const res = await db.collection('orders').doc(id).get()
    order = res.data
  } catch (e) {
    if (isMissingDocError(e)) {
      throw new Error('订单不存在')
    }
    throw e
  }
  if (order._openid !== openid) {
    throw new Error('只能改自己的订单')
  }
  if (order.status !== 'pending') {
    throw new Error('接单后就不能改时间啦')
  }
  const today = chinaDateString()
  const date = String((payload && payload.scheduledDate) || '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error('日期不正确')
  }
  const todayStart = Date.parse(today + 'T00:00:00+08:00')
  const targetStart = Date.parse(date + 'T00:00:00+08:00')
  if (
    !isFinite(targetStart) ||
    targetStart < todayStart ||
    targetStart > todayStart + 7 * 24 * 60 * 60 * 1000
  ) {
    throw new Error('只能改到今天到 7 天内')
  }
  const config = await getConfig()
  const business = normalizeBusiness(config && config.business)
  const setting = business[meal]
  if (!setting.open) {
    throw new Error('这一餐还没开火，换一餐吧')
  }
  if (date === today) {
    const current = chinaNow()
    const [hour, minute] = setting.deadline.split(':').map(Number)
    if (current.h * 60 + current.m > hour * 60 + minute) {
      throw new Error('这一餐已经截单啦')
    }
  }
  if (
    Array.isArray(business.closedDates) &&
    business.closedDates.indexOf(date) > -1
  ) {
    throw new Error('这一天休息，换个日子吧')
  }
  if (
    Array.isArray(business.weeklyClosed) &&
    business.weeklyClosed.indexOf(chinaWeekday(date)) > -1
  ) {
    throw new Error('这一天固定休息，换个日子吧')
  }
  const menu = await getMenuDoc(date, meal)
  if (menu.exists && menu.open === false) {
    throw new Error('这一餐还没排菜单')
  }
  const ids = order.items.map(item => item.dishId)
  const dishRes = await db
    .collection('dishes')
    .where({ _id: _.in(ids) })
    .get()
  const dishMap = {}
  dishRes.data.forEach(dish => {
    dishMap[dish._id] = dish
  })
  for (const item of order.items) {
    const dish = dishMap[item.dishId]
    if (!dish || dish.status === 'off') {
      throw new Error(`${item.name} 已经下架了`)
    }
    if (!Array.isArray(dish.meals) || dish.meals.indexOf(meal) === -1) {
      throw new Error(`${item.name} 这一餐不供应`)
    }
    if (menu.exists && menu.dishIds.indexOf(item.dishId) === -1) {
      throw new Error(`${item.name} 不在这一餐的菜单里`)
    }
  }
  const data = {
    meal,
    scheduledDate: date,
    slotUpdatedAt: Date.now()
  }
  if (meal !== order.meal) {
    data.expectedTime = '尽快'
  }
  const upd = await db
    .collection('orders')
    .where({ _id: id, status: 'pending' })
    .update({ data })
  if (!upd.stats || upd.stats.updated !== 1) {
    throw new Error('订单状态刚刚变了，刷新看看')
  }
  return withId(Object.assign({}, order, data))
}

// 顾客催单：只记录时间，厨房端展示「她催了」；5 分钟内不能重复催。
async function urgeOrder(payload, openid) {
  if (!payload.id) {
    throw new Error('缺少订单 ID')
  }
  const res = await db.collection('orders').doc(payload.id).get()
  const order = res.data
  if (order._openid !== openid) {
    throw new Error('只能催自己的订单')
  }
  if (['pending', 'accepted', 'cooking'].indexOf(order.status) === -1) {
    throw new Error('这一单不用催啦')
  }
  const now = Date.now()
  // 5 分钟冷却桶：条件更新保证并发催单只会成功一次
  const urgeBucket = Math.floor(now / (5 * 60 * 1000))
  const upd = await db
    .collection('orders')
    .where({
      _id: payload.id,
      status: _.in(['pending', 'accepted', 'cooking']),
      urgeBucket: _.neq(urgeBucket)
    })
    .update({
      data: {
        urgedAt: now,
        urgeCount: _.inc(1),
        urgeBucket
      }
    })
  if (!upd.stats || upd.stats.updated !== 1) {
    throw new Error('刚催过啦，掌勺人正在忙')
  }
  return withId(
    Object.assign({}, order, {
      urgedAt: now,
      urgeBucket,
      urgeCount: Number(order.urgeCount || 0) + 1
    })
  )
}

// 顾客给已完成的订单打分：1 翻车 / 2 一般 / 3 好吃，可附一句话
async function rateOrder(payload, openid) {
  if (!payload || !payload.id) {
    throw new Error('缺少订单 ID')
  }
  const res = await db.collection('orders').doc(payload.id).get()
  const order = res.data
  if (order._openid !== openid) {
    throw new Error('只能评价自己的订单')
  }
  if (order.status !== 'completed') {
    throw new Error('吃完才能评价哦')
  }
  const rating = Number(payload.rating)
  if ([1, 2, 3].indexOf(rating) === -1) {
    throw new Error('评价不太对')
  }
  const feedback = String(payload.feedback || '').trim().slice(0, 50)
  await checkContentSafety(openid, feedback)
  const tags = []
  ;(Array.isArray(payload.tags) ? payload.tags : []).forEach(tag => {
    const name = String(tag || '').trim()
    if (
      RATING_TAGS.indexOf(name) > -1 &&
      tags.indexOf(name) === -1 &&
      tags.length < 4
    ) {
      tags.push(name)
    }
  })
  const images = []
  ;(Array.isArray(payload.images) ? payload.images : []).forEach(src => {
    const value = String(src || '').trim()
    if (
      /^cloud:\/\//.test(value) &&
      images.indexOf(value) === -1 &&
      images.length < 3
    ) {
      images.push(value.slice(0, 300))
    }
  })
  const now = Date.now()
  const oldTags = Array.isArray(order.ratingTags) ? order.ratingTags : []
  const oldImages = Array.isArray(order.ratingImages)
    ? order.ratingImages
    : []
  const tagsChanged =
    tags.length !== oldTags.length ||
    tags.some(tag => oldTags.indexOf(tag) === -1)
  const imagesChanged =
    images.length !== oldImages.length ||
    images.some(src => oldImages.indexOf(src) === -1)
  const changed =
    Number(order.rating) !== rating ||
    String(order.feedback || '') !== feedback ||
    tagsChanged ||
    imagesChanged
  const data = {
    rating,
    feedback,
    ratingTags: tags,
    ratingImages: images,
    ratedAt: now
  }
  // 评价变了，旧回复不再对应这条评价，清掉避免错配
  if (changed && order.ownerReply) {
    data.ownerReply = ''
    data.ownerReplyAt = 0
  }
  await db.collection('orders').doc(payload.id).update({ data })
  return withId(Object.assign({}, order, data))
}

// 掌勺人回复顾客评价：管理员专属，覆盖式更新，写库前做内容安全
async function replyRating(payload, openid) {
  await requireAdmin(openid)
  if (!payload || !payload.id) {
    throw new Error('缺少订单 ID')
  }
  let order
  try {
    const res = await db.collection('orders').doc(payload.id).get()
    order = res.data
  } catch (e) {
    if (isMissingDocError(e)) {
      throw new Error('订单不存在')
    }
    throw e
  }
  if (order.status !== 'completed') {
    throw new Error('吃完才能回复哦')
  }
  if ([1, 2, 3].indexOf(Number(order.rating)) === -1) {
    throw new Error('她还没评价，先等等')
  }
  // 客户端带上它看到的评价时间，避免回复写到刚被改过的新评价上
  const seenRatedAt = Number(payload.ratedAt || 0)
  if (seenRatedAt && Number(order.ratedAt || 0) !== seenRatedAt) {
    throw new Error('她的评价刚刚更新了，刷新看看')
  }
  const reply = Array.from(String(payload.reply || '').trim())
    .slice(0, 50)
    .join('')
  if (!reply) {
    throw new Error('回复不能为空')
  }
  await checkContentSafety(openid, reply)
  const now = Date.now()
  const cond = {
    _id: payload.id,
    status: 'completed',
    rating: _.in([1, 2, 3])
  }
  // 读后写窗口里如果顾客改了评价，ratedAt 会变，条件更新就不会命中
  if (order.ratedAt) {
    cond.ratedAt = order.ratedAt
  }
  const upd = await db
    .collection('orders')
    .where(cond)
    .update({ data: { ownerReply: reply, ownerReplyAt: now } })
  if (!upd.stats || upd.stats.updated !== 1) {
    throw new Error('订单刚刚变了，刷新看看')
  }
  return withId(
    Object.assign({}, order, { ownerReply: reply, ownerReplyAt: now })
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
      await logStock({
        dishId: item.dishId,
        dishName: item.name,
        delta: Number(item.qty || 0),
        source: 'cancel',
        orderId: order._id,
        orderNo: order.no
      })
    } catch (e) {
      if (isMissingDocError(e)) {
        // 菜品被删掉了，库存没有可回补的目标
        console.warn('[api] restoreStock dish missing:', {
          orderId: order._id,
          no: order.no,
          dishId: item.dishId,
          qty: item.qty
        })
        continue
      }
      // 网络/额度等错误必须留下可追踪记录，方便事后补库存
      console.error('[api] restoreStock failed:', {
        orderId: order._id,
        no: order.no,
        dishId: item.dishId,
        qty: item.qty,
        error: e
      })
    }
  }
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
  const cancellableBefore =
    order.status === 'pending' || order.status === 'accepted'
  const cancelReason =
    status === 'cancelled' && cancellableBefore
      ? String(payload.reason || '').trim().slice(0, 50)
      : ''
  if (cancelReason) {
    await checkContentSafety(openid, cancelReason)
  }
  const data = {
    status,
    timeline: _.push([entry])
  }
  if (status === 'cancelled') {
    data.cancelReason = cancelReason
    data.cancelledBy = 'admin'
  }
  // 条件更新：并发操作只有一次会生效
  const upd = await db
    .collection('orders')
    .where({ _id: id, status: order.status })
    .update({ data })
  if (!upd.stats || upd.stats.updated !== 1) {
    throw new Error('订单状态刚刚变了，刷新看看')
  }

  // 厨房拒掉尚未出锅的订单时，把扣掉的库存补回去
  if (status === 'cancelled' && cancellableBefore) {
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
    }, status === 'cancelled'
      ? { cancelReason, cancelledBy: 'admin' }
      : {})
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
  const priceBaseValue = Number(payload.priceBase)
  const priceBase =
    isFinite(priceBaseValue) && priceBaseValue >= 0 && priceBaseValue <= 999
      ? priceBaseValue
      : null
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
  const ingredients = (Array.isArray(payload.ingredients)
    ? payload.ingredients
    : []
  )
    .map(line => String(line || '').trim().slice(0, 30))
    .filter(Boolean)
    .slice(0, 15)
  const allergens = (Array.isArray(payload.allergens)
    ? payload.allergens
    : []
  )
    .map(line => String(line || '').trim().slice(0, 10))
    .filter(Boolean)
    .slice(0, 6)
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
  const stockBaseValue = Number(payload.stockBase)
  const stockBase =
    isFinite(stockBaseValue) && stockBaseValue >= -1 && stockBaseValue <= 9999
      ? Math.floor(stockBaseValue)
      : null

  // 云存储 fileID 或 https 图片地址；为空时前端用色块 + 首字占位。
  // 编辑时不传 image 表示保持原图不变。
  const image =
    payload.image === undefined
      ? null
      : String(payload.image || '').trim().slice(0, 300)
  // 做法步骤：每行一步；编辑时不传表示保持原做法
  const recipe =
    payload.recipe === undefined
      ? null
      : String(payload.recipe || '').trim().slice(0, 1200)

  const fields = {
    name,
    char: name.slice(0, 1),
    desc,
    price,
    categoryId,
    tags,
    spicyLevels,
    ingredients,
    allergens,
    addons,
    color,
    meals,
    status,
    stock,
    isRecommended: Boolean(payload.isRecommended)
  }
  if (image !== null) {
    fields.image = image
  }
  if (recipe !== null) {
    fields.recipe = recipe
  }

  if (payload.id) {
    const id = String(payload.id)
    const res = await db.collection('dishes').doc(id).get()
    const dish = res.data
    // 编辑时库存按「基线 + 变化量」处理，避免把下单已扣的库存覆盖回去
    if (stockBase === null) {
      delete fields.stock
    } else if (stock === stockBase) {
      delete fields.stock
    } else if (stock === -1 || stockBase === -1) {
      fields.stock = stock
    } else {
      const currentStock = Number(dish.stock)
      fields.stock =
        isFinite(currentStock) && currentStock >= 0
          ? currentStock === stockBase
            ? stock
            : Math.max(0, currentStock + (stock - stockBase))
          : stock
    }
    // 非菜品编辑页（补库存/上下架）不传 priceBase，避免把旧价格覆盖回来
    const priceApplied =
      priceBase !== null && priceBase === Number(dish.price)
    if (!priceApplied) {
      delete fields.price
    }
    await db.collection('dishes').doc(id).update({ data: fields })
    if (priceApplied && Number(dish.price) !== price) {
      const priceHistory = Array.isArray(dish.priceHistory)
        ? dish.priceHistory.slice()
        : []
      priceHistory.push({
        from: Number(dish.price) || 0,
        to: price,
        at: Date.now()
      })
      await db
        .collection('dishes')
        .doc(id)
        .update({ data: { priceHistory: priceHistory.slice(-20) } })
    }
    const beforeStock =
      typeof dish.stock === 'number' ? Number(dish.stock) : null
    if (
      typeof fields.stock === 'number' &&
      beforeStock !== null &&
      Number(fields.stock) !== beforeStock
    ) {
      const afterStock = Number(fields.stock)
      await logStock({
        dishId: id,
        dishName: name,
        before: beforeStock,
        after: afterStock,
        delta:
          beforeStock >= 0 && afterStock >= 0
            ? afterStock - beforeStock
            : null,
        source: 'edit',
        openid
      })
    }
    // 换图后顺手删掉旧图，避免云存储堆积
    if (
      image !== null &&
      dish.image &&
      dish.image !== image &&
      String(dish.image).indexOf('cloud://') === 0
    ) {
      try {
        await cloud.deleteFile({ fileList: [dish.image] })
      } catch (e) {
        // 旧图删除失败不影响保存
      }
    }
    return withId(Object.assign({}, dish, fields))
  }

  const dupRes = await db
    .collection('dishes')
    .where({ name })
    .limit(1)
    .get()
  if (dupRes.data.length) {
    throw new Error('已经有同名菜品了')
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
  let dish = null
  try {
    const res = await db.collection('dishes').doc(payload.id).get()
    dish = res.data
  } catch (e) {
    throw new Error('菜品不存在')
  }
  await db.collection('dishes').doc(payload.id).remove()
  if (dish && dish.image && String(dish.image).indexOf('cloud://') === 0) {
    try {
      await cloud.deleteFile({ fileList: [dish.image] })
    } catch (e) {
      // 图片删除失败不影响菜品删除
    }
  }
  return { id: payload.id }
}

// 菜品排序：与相邻菜品交换 sort，direction 为 up / down
async function moveDish(payload, openid) {
  await requireAdmin(openid)
  const id = String((payload && payload.id) || '')
  if (!id) {
    throw new Error('缺少菜品 ID')
  }
  const direction = payload.direction === 'up' ? -1 : 1
  const res = await db
    .collection('dishes')
    .orderBy('sort', 'asc')
    .limit(200)
    .get()
  const list = res.data
  const index = list.findIndex(dish => dish._id === id)
  if (index === -1) {
    throw new Error('菜品不存在')
  }
  const target = index + direction
  if (target < 0 || target >= list.length) {
    return { moved: false }
  }
  const current = list[index]
  const neighbor = list[target]
  const currentSort =
    typeof current.sort === 'number' ? current.sort : (index + 1) * 10
  const neighborSort =
    typeof neighbor.sort === 'number' ? neighbor.sort : (target + 1) * 10
  await db
    .collection('dishes')
    .doc(current._id)
    .update({ data: { sort: neighborSort } })
  await db
    .collection('dishes')
    .doc(neighbor._id)
    .update({ data: { sort: currentSort } })
  return { moved: true }
}

const WISH_STATUS = ['pending', 'planned', 'done']

async function createWish(payload, openid) {
  const content = String((payload && payload.content) || '').trim()
  if (!content || content.length > 50) {
    throw new Error('愿望需要 1-50 个字')
  }
  await checkContentSafety(openid, content)
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
    const reply = String(payload.reply || '').slice(0, 50)
    await checkContentSafety(openid, reply)
    data.reply = reply
  }
  data.updatedAt = Date.now()
  await db.collection('wishes').doc(id).update({ data })
  return withId(Object.assign({}, wish, data))
}

async function deleteWish(payload, openid) {
  const id = String((payload && payload.id) || '')
  if (!id) {
    throw new Error('缺少愿望 ID')
  }
  const res = await db.collection('wishes').doc(id).get()
  const wish = res.data
  const admin = await isAdminOpenid(openid)
  if (!admin) {
    if (wish._openid !== openid) {
      throw new Error('没有权限删除这个愿望')
    }
    if (wish.status !== 'pending') {
      throw new Error('已经安排的愿望不能撤回了')
    }
  }
  await db.collection('wishes').doc(id).remove()
  return { id }
}

// 一次性初始化：写入默认菜单并确定管理员。
// 设置了环境变量 ADMIN_OPENIDS 时只认这些管理员；
// 否则把第一个调用者设为管理员（仅适合私用）。
// 初始化完成后再次调用不会改动任何数据。
async function initDb(openid) {
  const envAdmins = envAdminOpenids()
  const existing = await getConfig()
  if (existing && existing.initialized) {
    return {
      initialized: true,
      already: true,
      isAdmin: envAdmins.length
        ? envAdmins.indexOf(openid) > -1
        : Boolean(
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
  if (envAdmins.length) {
    envAdmins.forEach(admin => {
      if (admins.indexOf(admin) === -1) {
        admins.push(admin)
      }
    })
  } else if (admins.indexOf(openid) === -1) {
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
