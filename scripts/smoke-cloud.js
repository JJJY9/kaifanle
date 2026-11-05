#!/usr/bin/env node
/**
 * 云函数本地冒烟测试：用内存数据库桩替代 wx-server-sdk，
 * 覆盖初始化、菜单读取、下单计价、权限校验、状态流转、售罄拦截。
 * 用法：node scripts/smoke-cloud.js
 */
const assert = require('assert')
const path = require('path')
const Module = require('module')

const store = new Map()
const sentMessages = []
let currentOpenid = 'admin-openid'

function chinaDate(offset) {
  const d = new Date(
    Date.now() + 8 * 60 * 60 * 1000 + (offset || 0) * 24 * 60 * 60 * 1000
  )
  return d.toISOString().slice(0, 10)
}

function ensure(name) {
  if (!store.has(name)) {
    store.set(name, new Map())
  }
  return store.get(name)
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

const command = {
  in(values) {
    return { __op: 'in', values }
  },
  push(values) {
    return { __op: 'push', values }
  },
  gte(value) {
    return { __op: 'gte', value }
  },
  inc(value) {
    return { __op: 'inc', value }
  }
}

function matches(doc, cond) {
  return Object.keys(cond).every(key => {
    const expected = cond[key]
    const actual = doc[key]
    if (expected && expected.__op === 'in') {
      return expected.values.indexOf(actual) > -1
    }
    if (expected && expected.__op === 'gte') {
      return actual >= expected.value
    }
    return actual === expected
  })
}

function applyData(doc, data) {
  Object.keys(data).forEach(key => {
    const value = data[key]
    if (value && value.__op === 'push') {
      doc[key] = (doc[key] || []).concat(value.values)
    } else if (value && value.__op === 'inc') {
      doc[key] = Number(doc[key] || 0) + Number(value.value)
    } else {
      doc[key] = value
    }
  })
}

function makeQuery(name, cond, order, limit) {
  return {
    where(nextCond) {
      return makeQuery(name, nextCond, order, limit)
    },
    orderBy(field, dir) {
      return makeQuery(name, cond, { field, dir }, limit)
    },
    limit(n) {
      return makeQuery(name, cond, order, n)
    },
    async get() {
      let docs = Array.from(ensure(name).values())
        .filter(doc => matches(doc, cond))
        .map(clone)
      if (order) {
        docs.sort((a, b) => {
          const av = a[order.field]
          const bv = b[order.field]
          if (av === bv) return 0
          return (av > bv ? 1 : -1) * (order.dir === 'desc' ? -1 : 1)
        })
      }
      if (typeof limit === 'number') {
        docs = docs.slice(0, limit)
      }
      return { data: docs }
    },
    async count() {
      return {
        total: Array.from(ensure(name).values()).filter(doc =>
          matches(doc, cond)
        ).length
      }
    },
    async update({ data }) {
      let updated = 0
      for (const doc of ensure(name).values()) {
        if (!matches(doc, cond)) {
          continue
        }
        applyData(doc, data)
        updated++
      }
      return { stats: { updated } }
    }
  }
}

function makeCollection(name) {
  ensure(name)
  return {
    doc(id) {
      return {
        async get() {
          const doc = ensure(name).get(id)
          if (!doc) {
            const err = new Error('document does not exist')
            err.errCode = -1
            throw err
          }
          return { data: clone(doc) }
        },
        async set({ data }) {
          ensure(name).set(id, Object.assign({ _id: id }, data))
          return { _id: id }
        },
        async update({ data }) {
          const doc = ensure(name).get(id)
          if (!doc) {
            throw new Error('document does not exist')
          }
          applyData(doc, data)
          return { stats: { updated: 1 } }
        },
        async remove() {
          const existed = ensure(name).delete(id)
          return { stats: { removed: existed ? 1 : 0 } }
        }
      }
    },
    async add(args) {
      const id = `${name}-${Math.random().toString(36).slice(2, 10)}`
      ensure(name).set(id, Object.assign({}, args.data, { _id: id }))
      return { _id: id }
    },
    async count() {
      return { total: ensure(name).size }
    },
    where(cond) {
      return makeQuery(name, cond)
    },
    orderBy(field, dir) {
      return makeQuery(name, {}).orderBy(field, dir)
    },
    limit(n) {
      return makeQuery(name, {}).limit(n)
    },
    async get() {
      return makeQuery(name, {}).get()
    }
  }
}

const fakeSdk = {
  DYNAMIC_CURRENT_ENV: 'test-env',
  init() {},
  database() {
    return {
      command,
      async createCollection(name) {
        ensure(name)
      },
      collection: makeCollection
    }
  },
  openapi: {
    subscribeMessage: {
      async send(payload) {
        sentMessages.push(payload)
        return { errCode: 0 }
      }
    }
  },
  getWXContext() {
    return { OPENID: currentOpenid }
  }
}

const originalLoad = Module._load
Module._load = function (request, parent, isMain) {
  if (request === 'wx-server-sdk') {
    return fakeSdk
  }
  return originalLoad.apply(this, arguments)
}

// 打开订阅消息开关，验证通知逻辑（模板 ID 仅在测试进程内存里改）
const templatesPath = path.join(
  __dirname,
  '..',
  'cloudfunctions',
  'api',
  'templates.js'
)
const templates = require(templatesPath)
templates.NEW_ORDER_TEMPLATE_ID = 'tpl-new-order'
templates.ORDER_STATUS_TEMPLATE_ID = 'tpl-order-status'
templates.MINIPROGRAM_STATE = 'trial'

const api = require(path.join(__dirname, '..', 'cloudfunctions', 'api', 'index.js'))

async function call(action, payload, openid) {
  currentOpenid = openid
  return api.main({ action, payload })
}

async function run() {
  let res = await call('getMe', {}, 'admin-openid')
  assert.strictEqual(res.ok, true)
  assert.strictEqual(res.data.initialized, false)
  assert.strictEqual(res.data.isAdmin, false)

  res = await call('initDb', {}, 'admin-openid')
  assert.strictEqual(res.ok, true)
  assert.strictEqual(res.data.initialized, true)
  assert.strictEqual(res.data.isAdmin, true)

  res = await call('initDb', {}, 'admin-openid')
  assert.strictEqual(res.ok, true)
  assert.strictEqual(res.data.already, true)

  // 测试期间把三餐都开到 23:59，避免测试受当前时间影响
  res = await call(
    'updateBusiness',
    {
      breakfast: { open: true, deadline: '23:59' },
      lunch: { open: true, deadline: '23:59' },
      dinner: { open: true, deadline: '23:59' },
      closedNote: '测试休息'
    },
    'admin-openid'
  )
  assert.strictEqual(res.ok, true)

  res = await call('getBusiness', {}, 'girl-openid')
  assert.strictEqual(res.data.lunch.open, true)
  assert.strictEqual(res.data.lunch.deadline, '23:59')

  res = await call('getCategories', {}, 'girl-openid')
  assert.strictEqual(res.ok, true)
  assert.strictEqual(res.data.length, 5)

  res = await call('getDishes', {}, 'girl-openid')
  assert.strictEqual(res.ok, true)
  assert.strictEqual(res.data.length, 14)

  // 菜品管理：权限、创建、编辑、下架
  const dishPayload = {
    name: '测试菜',
    desc: '测试用',
    price: 12,
    categoryId: 'staple',
    tags: ['测试'],
    spicyLevels: [],
    addons: [],
    color: '#FFD23F',
    meals: ['lunch'],
    status: 'on',
    isRecommended: false
  }

  res = await call('saveDish', dishPayload, 'girl-openid')
  assert.strictEqual(res.ok, false)

  res = await call('saveDish', dishPayload, 'admin-openid')
  assert.strictEqual(res.ok, true)
  const createdDishId = res.data.id
  assert.strictEqual(res.data.char, '测')

  res = await call(
    'saveDish',
    {
      id: createdDishId,
      name: '测试菜改',
      desc: '改',
      price: 15,
      categoryId: 'staple',
      tags: [],
      spicyLevels: [],
      addons: [],
      color: '#2D9CFF',
      meals: ['lunch', 'dinner'],
      status: 'off',
      isRecommended: false
    },
    'admin-openid'
  )
  assert.strictEqual(res.ok, true)
  assert.strictEqual(res.data.price, 15)
  assert.strictEqual(res.data.status, 'off')

  res = await call('getDishes', {}, 'admin-openid')
  assert.ok(
    res.data.some(dish => dish.id === createdDishId && dish.status === 'off')
  )

  res = await call('deleteDish', { id: createdDishId }, 'admin-openid')
  assert.strictEqual(res.ok, true)
  res = await call('getDishes', {}, 'admin-openid')
  assert.ok(!res.data.some(dish => dish.id === createdDishId))

  const created = await call(
    'createOrder',
    {
      items: [
        { dishId: 'd01', qty: 2, specs: ['微辣', '溏心蛋'], note: '少葱' }
      ],
      meal: 'lunch',
      expectedTime: '12:00',
      mode: '在家吃',
      note: '辛苦啦'
    },
    'girl-openid'
  )
  assert.strictEqual(created.ok, true)
  assert.strictEqual(created.data.amount, 40)
  assert.strictEqual(created.data.items[0].price, 20)
  assert.strictEqual(created.data.status, 'pending')

  // 新订单通知发给管理员
  assert.strictEqual(sentMessages.length, 1)
  assert.strictEqual(sentMessages[0].touser, 'admin-openid')
  assert.strictEqual(sentMessages[0].templateId, 'tpl-new-order')
  assert.strictEqual(sentMessages[0].page, 'pages/kitchen/index')
  assert.strictEqual(sentMessages[0].miniprogramState, 'trial')
  assert.strictEqual(sentMessages[0].data.number2.value, '1')
  assert.strictEqual(sentMessages[0].data.amount3.value, '¥40.00')
  assert.ok(
    sentMessages[0].data.thing11.value.includes('番茄牛腩饭')
  )

  res = await call('getOrders', {}, 'girl-openid')
  assert.strictEqual(res.data.length, 1)

  res = await call('getOrders', {}, 'admin-openid')
  assert.strictEqual(res.data.length, 0)

  res = await call('getAllOrders', {}, 'admin-openid')
  assert.strictEqual(res.data.length, 1)

  res = await call('getAllOrders', {}, 'girl-openid')
  assert.strictEqual(res.ok, false)

  res = await call('getOrder', { id: created.data.id }, 'girl-openid')
  assert.strictEqual(res.ok, true)

  res = await call('updateOrderStatus', { id: created.data.id, status: 'accepted' }, 'girl-openid')
  assert.strictEqual(res.ok, false)

  res = await call('updateOrderStatus', { id: created.data.id, status: 'accepted' }, 'admin-openid')
  assert.strictEqual(res.ok, true)
  assert.strictEqual(res.data.status, 'accepted')
  assert.strictEqual(res.data.timeline.length, 2)

  res = await call('updateOrderStatus', { id: created.data.id, status: 'ready' }, 'admin-openid')
  assert.strictEqual(res.ok, false)

  res = await call('updateOrderStatus', { id: created.data.id, status: 'cooking' }, 'admin-openid')
  assert.strictEqual(res.ok, true)

  res = await call('updateOrderStatus', { id: created.data.id, status: 'ready' }, 'admin-openid')
  assert.strictEqual(res.ok, true)

  // 出锅通知发给顾客
  const readyMessage = sentMessages.find(
    message => message.templateId === 'tpl-order-status'
  )
  assert.ok(readyMessage)
  assert.strictEqual(readyMessage.touser, 'girl-openid')
  assert.strictEqual(readyMessage.data.phrase2.value, '已出锅')
  assert.strictEqual(readyMessage.data.character_string6.value, '001')
  assert.ok(readyMessage.data.thing1.value.includes('番茄牛腩饭'))
  assert.ok(readyMessage.data.time16.value)
  assert.strictEqual(
    readyMessage.page,
    'pages/order-detail/index?id=' + created.data.id
  )

  res = await call(
    'updateOrderStatus',
    { id: created.data.id, status: 'completed' },
    'admin-openid'
  )
  assert.strictEqual(res.ok, true)

  res = await call('toggleDishStatus', { id: 'd01' }, 'admin-openid')
  assert.strictEqual(res.ok, true)
  assert.strictEqual(res.data.status, 'soldout')

  res = await call(
    'createOrder',
    {
      items: [{ dishId: 'd01', qty: 1, specs: [] }],
      meal: 'lunch',
      expectedTime: '12:00',
      mode: '在家吃'
    },
    'girl-openid'
  )
  assert.strictEqual(res.ok, false)

  res = await call(
    'createOrder',
    {
      items: [{ dishId: 'd02', qty: 0, specs: [] }],
      meal: 'lunch',
      expectedTime: '12:00',
      mode: '在家吃'
    },
    'girl-openid'
  )
  assert.strictEqual(res.ok, false)

  res = await call('getMe', {}, 'girl-openid')
  assert.strictEqual(res.data.isAdmin, false)

  // 顾客取消未接单订单
  const order2 = await call(
    'createOrder',
    {
      items: [{ dishId: 'd02', qty: 1, specs: [] }],
      meal: 'lunch',
      expectedTime: '12:30',
      mode: '在家吃',
      note: ''
    },
    'girl-openid'
  )
  assert.strictEqual(order2.ok, true)

  res = await call('cancelOrder', { id: order2.data.id }, 'stranger-openid')
  assert.strictEqual(res.ok, false)

  res = await call('cancelOrder', { id: order2.data.id }, 'girl-openid')
  assert.strictEqual(res.ok, true)
  assert.strictEqual(res.data.status, 'cancelled')

  res = await call('cancelOrder', { id: order2.data.id }, 'admin-openid')
  assert.strictEqual(res.ok, false)

  // 许愿池
  res = await call('createWish', { content: '想吃火锅' }, 'girl-openid')
  assert.strictEqual(res.ok, true)
  const wishId = res.data.id

  res = await call('getWishes', {}, 'girl-openid')
  assert.strictEqual(res.data.length, 1)

  res = await call('getWishes', {}, 'admin-openid')
  assert.strictEqual(res.data.length, 1)

  res = await call(
    'updateWish',
    { id: wishId, status: 'planned', plannedDate: '明天晚餐' },
    'girl-openid'
  )
  assert.strictEqual(res.ok, false)

  res = await call(
    'updateWish',
    { id: wishId, status: 'planned', plannedDate: '明天晚餐' },
    'admin-openid'
  )
  assert.strictEqual(res.ok, true)
  assert.strictEqual(res.data.status, 'planned')
  assert.strictEqual(res.data.plannedDate, '明天晚餐')

  // 营业设置：非管理员不能改；关掉的餐次不能下单；截单时间后不能下单
  res = await call(
    'updateBusiness',
    {
      breakfast: { open: true, deadline: '23:59' },
      lunch: { open: true, deadline: '23:59' },
      dinner: { open: false, deadline: '23:59' },
      closedNote: '今天休息'
    },
    'girl-openid'
  )
  assert.strictEqual(res.ok, false)

  res = await call(
    'updateBusiness',
    {
      breakfast: { open: true, deadline: '23:59' },
      lunch: { open: true, deadline: '23:59' },
      dinner: { open: false, deadline: '23:59' },
      closedNote: '今天休息'
    },
    'admin-openid'
  )
  assert.strictEqual(res.ok, true)
  assert.strictEqual(res.data.dinner.open, false)

  res = await call(
    'createOrder',
    {
      items: [{ dishId: 'd02', qty: 1, specs: [] }],
      meal: 'dinner',
      expectedTime: '18:00',
      mode: '在家吃',
      note: ''
    },
    'girl-openid'
  )
  assert.strictEqual(res.ok, false)

  res = await call(
    'updateBusiness',
    {
      breakfast: { open: true, deadline: '23:59' },
      lunch: { open: true, deadline: '00:00' },
      dinner: { open: true, deadline: '23:59' },
      closedNote: '测试休息'
    },
    'admin-openid'
  )
  assert.strictEqual(res.ok, true)

  res = await call(
    'createOrder',
    {
      items: [{ dishId: 'd02', qty: 1, specs: [] }],
      meal: 'lunch',
      expectedTime: '12:00',
      mode: '在家吃',
      note: ''
    },
    'girl-openid'
  )
  assert.strictEqual(res.ok, false)

  // 未来日期不受当天截单时间限制
  res = await call(
    'createOrder',
    {
      items: [{ dishId: 'd02', qty: 1, specs: [] }],
      meal: 'lunch',
      expectedTime: '12:00',
      mode: '在家吃',
      note: '',
      scheduledDate: chinaDate(1)
    },
    'girl-openid'
  )
  assert.strictEqual(res.ok, true)
  res = await call('cancelOrder', { id: res.data.id }, 'girl-openid')
  assert.strictEqual(res.ok, true)

  res = await call(
    'updateBusiness',
    {
      breakfast: { open: true, deadline: '23:59' },
      lunch: { open: true, deadline: '23:59' },
      dinner: { open: true, deadline: '23:59' },
      closedNote: '测试休息'
    },
    'admin-openid'
  )
  assert.strictEqual(res.ok, true)

  // 库存扣减与取消回补
  res = await call(
    'saveDish',
    {
      name: '限量菜',
      desc: '',
      price: 10,
      categoryId: 'staple',
      tags: [],
      spicyLevels: [],
      addons: [],
      color: '#FFD23F',
      meals: ['lunch'],
      status: 'on',
      stock: 5,
      isRecommended: false
    },
    'admin-openid'
  )
  assert.strictEqual(res.ok, true)
  const limitedId = res.data.id
  assert.strictEqual(res.data.stock, 5)

  res = await call(
    'createOrder',
    {
      items: [{ dishId: limitedId, qty: 6, specs: [] }],
      meal: 'lunch',
      expectedTime: '12:00',
      mode: '在家吃',
      note: ''
    },
    'girl-openid'
  )
  assert.strictEqual(res.ok, false)

  res = await call('getDish', { id: limitedId }, 'girl-openid')
  assert.strictEqual(res.data.stock, 5)

  const stockOrder = await call(
    'createOrder',
    {
      items: [{ dishId: limitedId, qty: 2, specs: [] }],
      meal: 'lunch',
      expectedTime: '12:00',
      mode: '在家吃',
      note: ''
    },
    'girl-openid'
  )
  assert.strictEqual(stockOrder.ok, true)

  res = await call('getDish', { id: limitedId }, 'girl-openid')
  assert.strictEqual(res.data.stock, 3)

  res = await call('cancelOrder', { id: stockOrder.data.id }, 'girl-openid')
  assert.strictEqual(res.ok, true)

  res = await call('getDish', { id: limitedId }, 'girl-openid')
  assert.strictEqual(res.data.stock, 5)

  res = await call('deleteDish', { id: limitedId }, 'admin-openid')
  assert.strictEqual(res.ok, true)

  // 口味档案
  res = await call('getMyProfile', {}, 'girl-openid')
  assert.deepStrictEqual(res.data.dislikes, [])

  res = await call(
    'saveMyProfile',
    { dislikes: ['香菜'], tastes: ['微辣'], address: '家里' },
    'girl-openid'
  )
  assert.strictEqual(res.ok, true)

  res = await call('getMyProfile', {}, 'girl-openid')
  assert.deepStrictEqual(res.data.dislikes, ['香菜'])
  assert.strictEqual(res.data.address, '家里')

  res = await call('getMyProfile', {}, 'admin-openid')
  assert.deepStrictEqual(res.data.dislikes, [])

  // 今日看板
  res = await call('getStats', {}, 'admin-openid')
  assert.strictEqual(res.ok, true)
  assert.ok(res.data.orderCount >= 1)
  assert.ok(res.data.revenue >= 40)
  assert.ok(res.data.completed >= 1)

  res = await call('getStats', {}, 'girl-openid')
  assert.strictEqual(res.ok, false)

  // 爱心券
  res = await call(
    'createCoupon',
    { title: '洗碗券', note: '测试' },
    'girl-openid'
  )
  assert.strictEqual(res.ok, false)

  res = await call(
    'createCoupon',
    { title: '洗碗券', note: '测试' },
    'admin-openid'
  )
  assert.strictEqual(res.ok, true)
  const couponId = res.data.id
  assert.strictEqual(res.data.owner, '')

  res = await call('getCoupons', {}, 'girl-openid')
  assert.ok(
    res.data.some(coupon => coupon.id === couponId && !coupon.owner)
  )

  res = await call('claimCoupon', { id: couponId }, 'girl-openid')
  assert.strictEqual(res.ok, true)
  assert.strictEqual(res.data.owner, 'girl-openid')

  res = await call('useCoupon', { id: couponId }, 'girl-openid')
  assert.strictEqual(res.ok, true)
  assert.strictEqual(res.data.status, 'used')

  res = await call('useCoupon', { id: couponId }, 'girl-openid')
  assert.strictEqual(res.ok, false)

  res = await call('deleteCoupon', { id: couponId }, 'girl-openid')
  assert.strictEqual(res.ok, false)

  res = await call('deleteCoupon', { id: couponId }, 'admin-openid')
  assert.strictEqual(res.ok, true)

  console.log(
    '云函数冒烟测试通过：初始化、菜单、菜品 CRUD、下单计价、权限、状态流转、取消订单、许愿池、营业设置、口味档案、今日看板、爱心券、售罄拦截、订阅消息。'
  )
}

run().catch(err => {
  console.error('云函数冒烟测试失败：')
  console.error(err)
  process.exit(1)
})
