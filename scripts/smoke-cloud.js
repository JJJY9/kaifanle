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
let transactionsEnabled = true
let beforeQueryUpdate = null
let beforeAdd = null

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
  lt(value) {
    return { __op: 'lt', value }
  },
  lte(value) {
    return { __op: 'lte', value }
  },
  exists(value) {
    return { __op: 'exists', value }
  },
  neq(value) {
    return { __op: 'neq', value }
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
    if (expected && expected.__op === 'lt') {
      return actual < expected.value
    }
    if (expected && expected.__op === 'lte') {
      return actual <= expected.value
    }
    if (expected && expected.__op === 'exists') {
      return expected.value ? actual !== undefined : actual === undefined
    }
    if (expected && expected.__op === 'neq') {
      return actual !== expected.value
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
      if (typeof beforeQueryUpdate === 'function') {
        const hook = beforeQueryUpdate
        beforeQueryUpdate = null
        hook(name, cond)
      }
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
      if (typeof beforeAdd === 'function') {
        const hook = beforeAdd
        beforeAdd = null
        hook(name, args)
      }
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
    const api = {
      command,
      async createCollection(name) {
        ensure(name)
      },
      collection: makeCollection
    }
    if (transactionsEnabled) {
      // 事务在当前单线程假库里退化为直接操作，接口保持一致
      api.startTransaction = async () => {
        if (!transactionsEnabled) {
          throw new Error('transaction disabled')
        }
        return {
          collection: makeCollection,
          async commit() {},
          async rollback() {}
        }
      }
    }
    return api
  },
  openapi: {
    subscribeMessage: {
      async send(payload) {
        sentMessages.push(payload)
        return { errCode: 0 }
      }
    },
    security: {
      async msgSecCheck({ content }) {
        if (String(content).indexOf('违规') > -1) {
          return { errCode: 0, result: { suggest: 'risky' } }
        }
        return { errCode: 0, result: { suggest: 'pass' } }
      },
      async imgSecCheck({ media }) {
        const content = String((media && media.value) || '')
        if (content.indexOf('risky') > -1) {
          return { errCode: 87014 }
        }
        return { errCode: 0 }
      }
    }
  },
  async deleteFile() {
    return { fileList: [] }
  },
  async downloadFile({ fileID }) {
    const id = String(fileID || '')
    if (id.indexOf('unavailable') > -1) {
      throw new Error('download failed')
    }
    return {
      fileContent: Buffer.from(id.indexOf('risky') > -1 ? 'risky-image' : 'safe-image')
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
      closedNote: '测试休息',
      notice: '今晚有炖汤',
      noticeFrom: '2000-01-01',
      noticeUntil: '2099-01-01',
      recommendText: '雨天暖胃',
      lowStockThreshold: 7,
      dailyGoal: 200,
      monthlyGoal: 5000
    },
    'admin-openid'
  )
  assert.strictEqual(res.ok, true)
  assert.strictEqual(res.data.recommendText, '雨天暖胃')
  assert.strictEqual(res.data.lowStockThreshold, 7)
  assert.strictEqual(res.data.dailyGoal, 200)
  assert.strictEqual(res.data.monthlyGoal, 5000)
  assert.strictEqual(res.data.noticeFrom, '2000-01-01')
  assert.strictEqual(res.data.noticeUntil, '2099-01-01')

  res = await call('getBusiness', {}, 'girl-openid')
  assert.strictEqual(res.data.lunch.open, true)
  assert.strictEqual(res.data.lunch.deadline, '23:59')
  assert.strictEqual(res.data.notice, '今晚有炖汤')
  assert.strictEqual(res.data.recommendText, '雨天暖胃')
  assert.strictEqual(res.data.lowStockThreshold, 7)
  assert.strictEqual(res.data.noticeFrom, '2000-01-01')
  assert.strictEqual(res.data.noticeUntil, '2099-01-01')
  // 顾客端不返回营收目标
  res = await call('getBusiness', {}, 'girl-openid')
  assert.strictEqual(res.data.dailyGoal, undefined)
  assert.strictEqual(res.data.monthlyGoal, undefined)

  // 公告开始日期不能晚于截止日期
  res = await call(
    'updateBusiness',
    { noticeFrom: '2099-01-02', noticeUntil: '2099-01-01' },
    'admin-openid'
  )
  assert.strictEqual(res.ok, false)

  res = await call('getCategories', {}, 'girl-openid')
  assert.strictEqual(res.ok, true)
  assert.strictEqual(res.data.length, 5)

  // 分类管理：权限、增改删、有菜品的分类不能删
  res = await call(
    'saveCategory',
    { name: '夜宵', color: '#2D9CFF' },
    'girl-openid'
  )
  assert.strictEqual(res.ok, false)
  res = await call(
    'saveCategory',
    { name: '夜宵', color: '#2D9CFF' },
    'admin-openid'
  )
  assert.strictEqual(res.ok, true)
  const newCategoryId = res.data.id
  res = await call('getCategories', {}, 'girl-openid')
  assert.ok(res.data.some(item => item.id === newCategoryId))
  const categoryIndex = res.data.findIndex(item => item.id === newCategoryId)
  res = await call(
    'moveCategory',
    { id: newCategoryId, direction: 'up' },
    'girl-openid'
  )
  assert.strictEqual(res.ok, false)
  res = await call(
    'moveCategory',
    { id: newCategoryId, direction: 'up' },
    'admin-openid'
  )
  assert.strictEqual(res.ok, true)
  assert.strictEqual(res.data.moved, true)
  res = await call('getCategories', {}, 'admin-openid')
  assert.strictEqual(
    res.data.findIndex(item => item.id === newCategoryId),
    categoryIndex - 1
  )
  res = await call(
    'moveCategory',
    { id: newCategoryId, direction: 'down' },
    'admin-openid'
  )
  assert.strictEqual(res.data.moved, true)
  res = await call('getCategories', {}, 'admin-openid')
  assert.strictEqual(
    res.data.findIndex(item => item.id === newCategoryId),
    categoryIndex
  )
  res = await call(
    'saveCategory',
    { id: newCategoryId, name: '主食', color: '#FF5C8A' },
    'admin-openid'
  )
  assert.strictEqual(res.ok, false)
  res = await call(
    'saveCategory',
    { id: newCategoryId, name: '夜宵啦', color: '#FF5C8A' },
    'admin-openid'
  )
  assert.strictEqual(res.data.name, '夜宵啦')
  res = await call('deleteCategory', { id: 'staple' }, 'admin-openid')
  assert.strictEqual(res.ok, false)
  res = await call('deleteCategory', { id: newCategoryId }, 'admin-openid')
  assert.strictEqual(res.ok, true)

  // 批量改分类：权限、结果与恢复
  res = await call(
    'batchUpdateDishCategory',
    { ids: ['d01', 'd02'], categoryId: 'soup' },
    'girl-openid'
  )
  assert.strictEqual(res.ok, false)
  res = await call(
    'batchUpdateDishCategory',
    { ids: ['d01', 'd02'], categoryId: 'soup' },
    'admin-openid'
  )
  assert.strictEqual(res.ok, true)
  assert.strictEqual(res.data.updated, 2)
  res = await call('getDish', { id: 'd01' }, 'admin-openid')
  assert.strictEqual(res.data.categoryId, 'soup')
  res = await call(
    'batchUpdateDishCategory',
    { ids: ['d01', 'd02'], categoryId: 'staple' },
    'admin-openid'
  )
  assert.strictEqual(res.ok, true)
  res = await call(
    'batchUpdateDishCategory',
    { ids: ['d01'], categoryId: 'no-such' },
    'admin-openid'
  )
  assert.strictEqual(res.ok, false)

  res = await call('getDishes', {}, 'girl-openid')
  assert.strictEqual(res.ok, true)
  assert.strictEqual(res.data.length, 14)

  // 菜品排序：相邻交换、越界不动、权限校验
  const firstDishId = res.data[0].id
  const secondDishId = res.data[1].id
  res = await call('moveDish', { id: secondDishId, direction: 'down' }, 'girl-openid')
  assert.strictEqual(res.ok, false)
  res = await call('moveDish', { id: secondDishId, direction: 'up' }, 'admin-openid')
  assert.strictEqual(res.ok, true)
  res = await call('getDishes', {}, 'admin-openid')
  assert.strictEqual(res.data[0].id, secondDishId)
  assert.strictEqual(res.data[1].id, firstDishId)
  res = await call('moveDish', { id: secondDishId, direction: 'down' }, 'admin-openid')
  assert.strictEqual(res.ok, true)
  res = await call('getDishes', {}, 'admin-openid')
  assert.strictEqual(res.data[0].id, firstDishId)
  res = await call('moveDish', { id: firstDishId, direction: 'up' }, 'admin-openid')
  assert.strictEqual(res.data.moved, false)

  // 菜品管理：权限、创建、编辑、下架
  const dishPayload = {
    name: '测试菜',
    desc: '测试用',
    price: 12,
    cost: 3.5,
    categoryId: 'staple',
    tags: ['测试'],
    spicyLevels: [],
    addons: [],
    color: '#FFD23F',
    meals: ['lunch'],
    status: 'on',
    isRecommended: false,
    image: 'cloud://test.env/dishes/test.jpg',
    recipe: '第一步切菜\n第二步开火',
    ingredients: ['番茄 2个', '盐 适量'],
    allergens: ['花生', '牛奶']
  }

  res = await call('saveDish', dishPayload, 'girl-openid')
  assert.strictEqual(res.ok, false)

  res = await call('saveDish', dishPayload, 'admin-openid')
  assert.strictEqual(res.ok, true)
  const createdDishId = res.data.id
  assert.strictEqual(res.data.char, '测')
  assert.strictEqual(res.data.cost, 3.5)
  assert.strictEqual(res.data.image, 'cloud://test.env/dishes/test.jpg')
  assert.strictEqual(res.data.recipe, '第一步切菜\n第二步开火')
  assert.deepStrictEqual(res.data.ingredients, ['番茄 2个', '盐 适量'])
  assert.deepStrictEqual(res.data.allergens, ['花生', '牛奶'])

  // 同名菜品不能重复创建
  res = await call('saveDish', dishPayload, 'admin-openid')
  assert.strictEqual(res.ok, false)

  res = await call(
    'saveDish',
    {
      id: createdDishId,
      name: '测试菜改',
      desc: '改',
      price: 15,
      priceBase: 12,
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
  assert.strictEqual(res.data.cost, 3.5)
  assert.strictEqual(res.data.status, 'off')
  // 编辑时不传 recipe 表示保持原做法
  assert.strictEqual(res.data.recipe, '第一步切菜\n第二步开火')

  res = await call('getDish', { id: createdDishId }, 'admin-openid')
  assert.strictEqual(res.data.priceHistory.length, 1)
  assert.strictEqual(res.data.priceHistory[0].from, 12)
  assert.strictEqual(res.data.priceHistory[0].to, 15)

  // 厨房补库存/上下架不带 priceBase，不能把旧价格覆盖回来
  res = await call(
    'saveDish',
    {
      id: createdDishId,
      name: '测试菜改',
      desc: '改',
      price: 12,
      categoryId: 'staple',
      tags: [],
      spicyLevels: [],
      addons: [],
      color: '#2D9CFF',
      meals: ['lunch', 'dinner'],
      status: 'off',
      stock: 5,
      stockBase: -1,
      isRecommended: false
    },
    'admin-openid'
  )
  assert.strictEqual(res.ok, true)
  res = await call('getDish', { id: createdDishId }, 'admin-openid')
  assert.strictEqual(res.data.price, 15)
  assert.strictEqual(res.data.cost, 3.5)
  assert.strictEqual(res.data.stock, 5)
  assert.strictEqual(res.data.priceHistory.length, 1)

  // 批量改价时价格基线已过期：不能覆盖别人刚改的价格，也不写价格历史
  res = await call(
    'saveDish',
    {
      id: createdDishId,
      name: '测试菜改',
      desc: '改',
      price: 18,
      priceBase: 12,
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
  res = await call('getDish', { id: createdDishId }, 'admin-openid')
  assert.strictEqual(res.data.price, 15)
  assert.strictEqual(res.data.priceHistory.length, 1)

  // 批量改价只写价格：不覆盖图片、状态、名称等其他字段
  res = await call(
    'saveDish',
    {
      id: createdDishId,
      price: 18,
      priceBase: 15,
      priceOnly: true
    },
    'admin-openid'
  )
  assert.strictEqual(res.ok, true)
  assert.strictEqual(res.data.price, 18)
  assert.strictEqual(res.data.cost, 3.5)
  assert.strictEqual(res.data.name, '测试菜改')
  assert.strictEqual(res.data.status, 'off')
  assert.strictEqual(res.data.image, 'cloud://test.env/dishes/test.jpg')
  assert.strictEqual(res.data.priceHistory.length, 2)
  // 价格基线过期时，priceOnly 也不改价
  res = await call(
    'saveDish',
    {
      id: createdDishId,
      price: 22,
      priceBase: 15,
      priceOnly: true
    },
    'admin-openid'
  )
  assert.strictEqual(res.ok, true)
  assert.strictEqual(res.data.price, 18)
  res = await call('getDish', { id: createdDishId }, 'admin-openid')
  assert.strictEqual(res.data.price, 18)
  assert.strictEqual(res.data.cost, 3.5)
  assert.strictEqual(res.data.priceHistory.length, 2)

  res = await call('getDishes', {}, 'admin-openid')
  assert.ok(
    res.data.some(dish => dish.id === createdDishId && dish.status === 'off')
  )

  res = await call('deleteDish', { id: createdDishId }, 'admin-openid')
  assert.strictEqual(res.ok, true)
  res = await call('getDishes', {}, 'admin-openid')
  assert.ok(!res.data.some(dish => dish.id === createdDishId))

  const d01ForAllergy = await call('getDish', { id: 'd01' }, 'admin-openid')
  res = await call(
    'saveDish',
    { ...d01ForAllergy.data, allergens: ['花生'] },
    'admin-openid'
  )
  assert.strictEqual(res.ok, true)
  assert.deepStrictEqual(res.data.allergens, ['花生'])

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
  assert.strictEqual(created.data._openid, undefined)
  assert.strictEqual(created.data.amount, 40)
  assert.strictEqual(created.data.items[0].price, 20)
  assert.deepStrictEqual(created.data.items[0].allergens, ['花生'])
  assert.strictEqual(created.data.status, 'pending')
  assert.strictEqual(created.data.no, '001')

  // 订单留言：双方可发，外人不行，内容留存在订单里
  res = await call(
    'sendOrderMessage',
    { id: created.data.id, content: '记得少放辣' },
    'girl-openid'
  )
  assert.strictEqual(res.ok, true)
  assert.strictEqual(res.data.message.role, 'customer')
  res = await call('getAllOrders', {}, 'admin-openid')
  let messageOrder = res.data.find(order => order.id === created.data.id)
  assert.strictEqual(Number(messageOrder.adminUnread), 1)
  assert.strictEqual(Number(messageOrder.customerUnread), 0)
  res = await call(
    'sendOrderMessage',
    { id: created.data.id, content: '收到，马上做' },
    'admin-openid'
  )
  assert.strictEqual(res.ok, true)
  assert.strictEqual(res.data.message.role, 'admin')
  res = await call('getAllOrders', {}, 'admin-openid')
  messageOrder = res.data.find(order => order.id === created.data.id)
  assert.strictEqual(Number(messageOrder.customerUnread), 1)
  assert.strictEqual(Number(messageOrder.adminUnread), 1)
  res = await call('getOrder', { id: created.data.id }, 'girl-openid')
  assert.strictEqual(res.data.messages.length, 2)
  assert.strictEqual(res.data.messages[0].content, '记得少放辣')
  assert.strictEqual(Number(res.data.customerUnread), 0)
  assert.strictEqual(res.data.viewerRole, 'customer')
  assert.ok(
    Number(res.data.customerReadAt) >= Number(res.data.messages[1].at),
    '顾客打开后应记录已读时间'
  )
  res = await call('getAllOrders', {}, 'admin-openid')
  messageOrder = res.data.find(order => order.id === created.data.id)
  assert.strictEqual(Number(messageOrder.customerUnread), 0)
  res = await call('getOrder', { id: created.data.id }, 'admin-openid')
  assert.strictEqual(Number(res.data.adminUnread), 0)
  assert.strictEqual(res.data.viewerRole, 'admin')
  assert.ok(
    Number(res.data.adminReadAt) >= Number(res.data.messages[0].at),
    '掌勺人打开后应记录已读时间'
  )
  res = await call(
    'sendOrderMessage',
    { id: created.data.id, content: '我也要说' },
    'stranger-openid'
  )
  assert.strictEqual(res.ok, false)
  res = await call(
    'sendOrderMessage',
    { id: created.data.id, content: '   ' },
    'girl-openid'
  )
  assert.strictEqual(res.ok, false)

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

  // 订单分页：按 createdAt 倒序游标，before 取上一页最后一条
  res = await call('getOrdersPage', { limit: 1 }, 'girl-openid')
  assert.strictEqual(res.ok, true)
  assert.strictEqual(res.data.orders.length, 1)
  assert.ok(res.data.nextBefore > 0)
  res = await call(
    'getOrdersPage',
    { limit: 1, before: res.data.nextBefore },
    'girl-openid'
  )
  assert.strictEqual(res.ok, true)
  assert.strictEqual(res.data.orders.length, 0)
  assert.strictEqual(res.data.hasMore, false)

  res = await call('getLastOrder', {}, 'girl-openid')
  assert.strictEqual(res.ok, true)
  assert.strictEqual(res.data.id, created.data.id)
  res = await call('getLastOrder', {}, 'admin-openid')
  assert.strictEqual(res.ok, true)
  assert.strictEqual(res.data, null)
  res = await call('getMyActiveOrder', {}, 'girl-openid')
  assert.strictEqual(res.ok, true)
  assert.strictEqual(res.data.id, created.data.id)
  assert.strictEqual(res.data.status, 'pending')
  res = await call('getMyActiveOrder', {}, 'admin-openid')
  assert.strictEqual(res.ok, true)
  assert.strictEqual(res.data, null)

  // 改整单备注：本人、开火前、内容安全
  res = await call(
    'updateOrderNote',
    { id: created.data.id, note: '多加饭' },
    'girl-openid'
  )
  assert.strictEqual(res.ok, true)
  assert.strictEqual(res.data.note, '多加饭')
  res = await call(
    'updateOrderNote',
    { id: created.data.id, note: '违规备注' },
    'girl-openid'
  )
  assert.strictEqual(res.ok, false)
  res = await call(
    'updateOrderNote',
    { id: created.data.id, note: '别人改的' },
    'stranger-openid'
  )
  assert.strictEqual(res.ok, false)
  res = await call('getOrder', { id: created.data.id }, 'girl-openid')
  assert.strictEqual(res.data.note, '多加饭')

  // 早餐专属菜品不能点成午餐（即使没有排菜单）
  res = await call(
    'createOrder',
    {
      items: [{ dishId: 'd06', qty: 1, specs: [] }],
      meal: 'lunch',
      expectedTime: '12:00',
      mode: '在家吃'
    },
    'girl-openid'
  )
  assert.strictEqual(res.ok, false)

  res = await call('getOrders', {}, 'admin-openid')
  assert.strictEqual(res.data.length, 0)

  res = await call('getAllOrders', {}, 'admin-openid')
  assert.strictEqual(res.data.length, 1)

  res = await call('getAllOrders', {}, 'girl-openid')
  assert.strictEqual(res.ok, false)

  res = await call('getActiveOrders', {}, 'admin-openid')
  assert.strictEqual(res.ok, true)
  assert.ok(res.data.some(order => order.id === created.data.id))
  res = await call('getActiveOrders', {}, 'girl-openid')
  assert.strictEqual(res.ok, false)

  res = await call('getOrder', { id: created.data.id }, 'girl-openid')
  assert.strictEqual(res.ok, true)
  assert.strictEqual(res.data._openid, undefined)

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

  res = await call('getMyPendingReviewCount', {}, 'girl-openid')
  assert.strictEqual(res.ok, true)
  assert.ok(res.data.count >= 1)
  res = await call('getMyPendingReviewCount', {}, 'admin-openid')
  assert.strictEqual(res.data.count, 0)

  // 回复评价：已完成但还没评分时不能回复，也不能写库
  res = await call(
    'replyRating',
    { id: created.data.id, reply: '谢谢' },
    'admin-openid'
  )
  assert.strictEqual(res.ok, false)
  assert.ok(String(res.error).indexOf('还没评价') > -1)
  res = await call('getOrder', { id: created.data.id }, 'admin-openid')
  assert.strictEqual(res.data.ownerReply, undefined)
  assert.strictEqual(res.data.rating, undefined)

  // 评价：只能本人评、分数受限、内容安全
  res = await call(
    'rateOrder',
    { id: created.data.id, rating: 3, feedback: '好吃' },
    'stranger-openid'
  )
  assert.strictEqual(res.ok, false)
  res = await call(
    'rateOrder',
    { id: created.data.id, rating: 5 },
    'girl-openid'
  )
  assert.strictEqual(res.ok, false)
  res = await call(
    'rateOrder',
    {
      id: created.data.id,
      rating: 3,
      feedback: '超好吃',
      tags: ['好吃', '分量足', '不存在的标签'],
      images: [
        'cloud://ok/a.jpg',
        'https://example.com/b.jpg',
        'bad-path',
        'cloud://ok/a.jpg'
      ]
    },
    'girl-openid'
  )
  assert.strictEqual(res.ok, true)
  assert.strictEqual(res.data.rating, 3)
  assert.strictEqual(res.data.feedback, '超好吃')
  assert.deepStrictEqual(res.data.ratingTags, ['好吃', '分量足'])
  assert.deepStrictEqual(res.data.ratingImages, ['cloud://ok/a.jpg'])
  // 晒图内容安全：涉敏图片拒绝，审核接口不可用时不拦截
  res = await call(
    'rateOrder',
    {
      id: created.data.id,
      rating: 3,
      feedback: '超好吃',
      images: ['cloud://ok/risky.jpg']
    },
    'girl-openid'
  )
  assert.strictEqual(res.ok, false)
  assert.ok(String(res.error).indexOf('敏感') > -1)
  res = await call('getOrder', { id: created.data.id }, 'girl-openid')
  assert.deepStrictEqual(res.data.ratingImages, ['cloud://ok/a.jpg'])
  res = await call(
    'rateOrder',
    {
      id: created.data.id,
      rating: 3,
      feedback: '超好吃',
      images: ['cloud://ok/unavailable.jpg']
    },
    'girl-openid'
  )
  assert.strictEqual(res.ok, true)
  assert.deepStrictEqual(res.data.ratingImages, ['cloud://ok/unavailable.jpg'])
  res = await call(
    'rateOrder',
    {
      id: created.data.id,
      rating: 3,
      feedback: '超好吃',
      images: ['cloud://ok/a.jpg']
    },
    'girl-openid'
  )
  assert.strictEqual(res.ok, true)
  assert.deepStrictEqual(res.data.ratingImages, ['cloud://ok/a.jpg'])
  res = await call(
    'rateOrder',
    { id: created.data.id, rating: 3, feedback: '违规评价' },
    'girl-openid'
  )
  assert.strictEqual(res.ok, false)

  // 掌勺人回复：管理员专属、只能回已评价订单、内容安全
  res = await call('replyRating', {}, 'admin-openid')
  assert.strictEqual(res.ok, false)
  assert.ok(String(res.error).indexOf('缺少订单') > -1)
  res = await call(
    'replyRating',
    { id: created.data.id, reply: '谢谢喜欢' },
    'girl-openid'
  )
  assert.strictEqual(res.ok, false)
  assert.ok(String(res.error).indexOf('权限') > -1)
  res = await call(
    'replyRating',
    { id: created.data.id, reply: '谢谢喜欢' },
    'stranger-openid'
  )
  assert.strictEqual(res.ok, false)
  res = await call(
    'replyRating',
    { id: 'no-such-order', reply: '谢谢' },
    'admin-openid'
  )
  assert.strictEqual(res.ok, false)
  assert.ok(String(res.error).indexOf('订单不存在') > -1)
  res = await call(
    'replyRating',
    { id: created.data.id, reply: '违规回复' },
    'admin-openid'
  )
  assert.strictEqual(res.ok, false)
  assert.ok(String(res.error).indexOf('不太合适') > -1)
  res = await call('getOrder', { id: created.data.id }, 'admin-openid')
  assert.strictEqual(res.data.ownerReply, undefined)
  const timelineBeforeReply = res.data.timeline.length
  res = await call(
    'replyRating',
    { id: created.data.id, reply: '谢谢喜欢，下次给你多加个蛋' },
    'admin-openid'
  )
  assert.strictEqual(res.ok, true)
  assert.strictEqual(res.data.ownerReply, '谢谢喜欢，下次给你多加个蛋')
  assert.ok(Number(res.data.ownerReplyAt) > 0)
  res = await call('getOrder', { id: created.data.id }, 'girl-openid')
  assert.strictEqual(res.data.ownerReply, '谢谢喜欢，下次给你多加个蛋')
  assert.strictEqual(res.data.rating, 3)
  assert.strictEqual(res.data.feedback, '超好吃')
  assert.strictEqual(res.data.status, 'completed')
  assert.ok(Number(res.data.ratedAt) > 0)
  res = await call('getOrder', { id: created.data.id }, 'stranger-openid')
  assert.strictEqual(res.ok, false)

  // 超长回复按字符截断且不切断 emoji；空回复不能擦掉已有回复
  res = await call(
    'replyRating',
    { id: created.data.id, reply: 'a'.repeat(49) + '😀'.repeat(10) },
    'admin-openid'
  )
  assert.strictEqual(res.ok, true)
  assert.strictEqual(Array.from(res.data.ownerReply).length, 50)
  assert.ok(res.data.ownerReply.endsWith('😀'))
  assert.ok(res.data.ownerReply.indexOf('�') === -1)
  res = await call(
    'replyRating',
    { id: created.data.id, reply: '   ' },
    'admin-openid'
  )
  assert.strictEqual(res.ok, false)
  assert.ok(String(res.error).indexOf('不能为空') > -1)
  res = await call('getOrder', { id: created.data.id }, 'girl-openid')
  assert.strictEqual(Array.from(res.data.ownerReply).length, 50)
  assert.ok(res.data.ownerReply.endsWith('😀'))

  // 重复回复按覆盖处理；不影响评分、时间轴与进行中列表
  res = await call(
    'replyRating',
    { id: created.data.id, reply: '改一句：谢谢你' },
    'admin-openid'
  )
  assert.strictEqual(res.ok, true)
  assert.strictEqual(res.data.ownerReply, '改一句：谢谢你')
  const overwriteReplyAt = res.data.ownerReplyAt
  res = await call('getOrder', { id: created.data.id }, 'admin-openid')
  assert.strictEqual(res.data.ownerReply, '改一句：谢谢你')
  assert.strictEqual(res.data.ownerReplyAt, overwriteReplyAt)
  assert.strictEqual(res.data.rating, 3)
  assert.strictEqual(res.data.feedback, '超好吃')
  assert.strictEqual(res.data.status, 'completed')
  assert.strictEqual(res.data.timeline.length, timelineBeforeReply)
  const oldRatedAt = res.data.ratedAt

  // 保证改评时间戳与旧快照不同（同毫秒内连续调用会让条件更新误通过）
  await new Promise(resolve => setTimeout(resolve, 5))

  // 顾客改评后旧回复应清空，旧评价快照不能再回复
  res = await call(
    'rateOrder',
    { id: created.data.id, rating: 1, feedback: '糊了' },
    'girl-openid'
  )
  assert.strictEqual(res.ok, true)
  assert.strictEqual(res.data.ownerReply, '')
  assert.strictEqual(res.data.ownerReplyAt, 0)
  assert.deepStrictEqual(res.data.ratingTags, [])
  assert.deepStrictEqual(res.data.ratingImages, [])
  const newRatedAt = res.data.ratedAt
  res = await call('getOrder', { id: created.data.id }, 'admin-openid')
  assert.strictEqual(res.data.rating, 1)
  assert.strictEqual(res.data.feedback, '糊了')
  assert.strictEqual(res.data.ownerReply, '')

  // 菜谱页公开统计：聚合最近 90 天点单与评分
  res = await call('getDishStats', { dishId: 'd01' }, 'girl-openid')
  assert.strictEqual(res.ok, true)
  assert.ok(res.data.orders >= 1)
  assert.ok(res.data.qty >= 2)
  assert.strictEqual(res.data.ratedCount, 1)
  assert.strictEqual(res.data.avgRating, 1)
  assert.strictEqual(res.data.goodRate, 0)
  assert.strictEqual(typeof res.data.orders, 'number')
  assert.ok(!('_openid' in res.data))
  assert.ok(!('items' in res.data))
  assert.ok(!('feedback' in res.data))
  res = await call('getDishStats', { dishId: 'no-such-dish' }, 'girl-openid')
  assert.strictEqual(res.ok, true)
  assert.strictEqual(res.data.orders, 0)
  assert.strictEqual(res.data.qty, 0)
  res = await call('getDishStats', {}, 'girl-openid')
  assert.strictEqual(res.ok, false)
  assert.ok(String(res.error).indexOf('缺少菜品') > -1)
  res = await call(
    'replyRating',
    {
      id: created.data.id,
      reply: '旧评价回复',
      ratedAt: oldRatedAt
    },
    'admin-openid'
  )
  assert.strictEqual(res.ok, false)
  assert.ok(String(res.error).indexOf('评价刚刚更新') > -1)

  // 读后写窗口里评价被改：条件更新必须拒绝
  beforeQueryUpdate = name => {
    if (name !== 'orders') {
      return
    }
    const doc = ensure('orders').get(created.data.id)
    if (doc) {
      doc.ratedAt = Number(doc.ratedAt || 0) + 1
    }
  }
  res = await call(
    'replyRating',
    { id: created.data.id, reply: '并发回复', ratedAt: newRatedAt },
    'admin-openid'
  )
  beforeQueryUpdate = null
  assert.strictEqual(res.ok, false)
  assert.ok(String(res.error).indexOf('订单刚刚变了') > -1)

  // 改回 3 分后重新回复，后续统计仍按 3 分
  res = await call(
    'rateOrder',
    { id: created.data.id, rating: 3, feedback: '超好吃' },
    'girl-openid'
  )
  assert.strictEqual(res.ok, true)
  assert.strictEqual(res.data.ownerReply, '')
  const restoredRatedAt = res.data.ratedAt
  res = await call(
    'replyRating',
    {
      id: created.data.id,
      reply: '新评价回复',
      ratedAt: restoredRatedAt
    },
    'admin-openid'
  )
  assert.strictEqual(res.ok, true)
  res = await call('getOrder', { id: created.data.id }, 'admin-openid')
  assert.strictEqual(res.data.ownerReply, '新评价回复')
  assert.strictEqual(res.data.rating, 3)
  assert.strictEqual(res.data.feedback, '超好吃')

  res = await call('getStats', {}, 'admin-openid')
  assert.strictEqual(res.data.avgRating, 3)
  res = await call('getAllOrders', {}, 'admin-openid')
  const repliedOrder = res.data.find(order => order.id === created.data.id)
  assert.strictEqual(repliedOrder.ownerReply, '新评价回复')
  res = await call('getActiveOrders', {}, 'admin-openid')
  assert.ok(!res.data.some(order => order.id === created.data.id))

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
  // 失败的订单不会占用订单号，成功订单连续递增
  assert.strictEqual(order2.data.no, '002')

  // 未完成的订单不能评价
  res = await call(
    'rateOrder',
    { id: order2.data.id, rating: 3 },
    'girl-openid'
  )
  assert.strictEqual(res.ok, false)

  // 未完成订单不能回复评价
  res = await call(
    'replyRating',
    { id: order2.data.id, reply: '谢谢' },
    'admin-openid'
  )
  assert.strictEqual(res.ok, false)
  assert.ok(String(res.error).indexOf('吃完才能回复') > -1)

  // 催单：只有本人能催，5 分钟内不能重复
  res = await call('urgeOrder', { id: order2.data.id }, 'stranger-openid')
  assert.strictEqual(res.ok, false)
  res = await call('urgeOrder', { id: order2.data.id }, 'girl-openid')
  assert.strictEqual(res.ok, true)
  assert.strictEqual(res.data.urgeCount, 1)
  assert.ok(res.data.urgedAt > 0)
  res = await call('urgeOrder', { id: order2.data.id }, 'girl-openid')
  assert.strictEqual(res.ok, false)
  res = await call('urgeOrder', { id: order2.data.id }, 'admin-openid')
  assert.strictEqual(res.ok, false)

  res = await call('cancelOrder', { id: order2.data.id }, 'stranger-openid')
  assert.strictEqual(res.ok, false)

  res = await call(
    'cancelOrder',
    { id: order2.data.id, reason: '临时有事' },
    'girl-openid'
  )
  assert.strictEqual(res.ok, true)
  assert.strictEqual(res.data.status, 'cancelled')
  assert.strictEqual(res.data.cancelReason, '临时有事')
  assert.strictEqual(res.data.cancelledBy, 'customer')
  res = await call('getOrder', { id: order2.data.id }, 'admin-openid')
  assert.strictEqual(res.data.cancelReason, '临时有事')
  assert.strictEqual(res.data.cancelledBy, 'customer')

  res = await call('cancelOrder', { id: order2.data.id }, 'admin-openid')
  assert.strictEqual(res.ok, false)

  // 事务不可用时退化为原子自增，订单号继续递增
  transactionsEnabled = false
  res = await call(
    'createOrder',
    {
      items: [{ dishId: 'd02', qty: 1, specs: [] }],
      meal: 'lunch',
      expectedTime: '12:00',
      mode: '在家吃'
    },
    'girl-openid'
  )
  assert.strictEqual(res.ok, true)
  assert.ok(res.data.no.indexOf('003') === 0)
  assert.ok(res.data.no.length > 3)
  const fallbackOrderId = res.data.id
  res = await call(
    'sendOrderMessage',
    { id: fallbackOrderId, content: '事务关闭时也能留言' },
    'girl-openid'
  )
  assert.strictEqual(res.ok, true)
  res = await call('getOrder', { id: fallbackOrderId }, 'girl-openid')
  assert.ok(
    res.data.messages.some(item => item.content === '事务关闭时也能留言')
  )
  transactionsEnabled = true

  // 厨房拒单可带原因，顾客能看到
  const adminCancelId = fallbackOrderId
  res = await call(
    'updateOrderStatus',
    { id: adminCancelId, status: 'cancelled', reason: '今天太忙了' },
    'admin-openid'
  )
  assert.strictEqual(res.ok, true)
  assert.strictEqual(res.data.cancelReason, '今天太忙了')
  assert.strictEqual(res.data.cancelledBy, 'admin')
  res = await call('getOrder', { id: adminCancelId }, 'girl-openid')
  assert.strictEqual(res.data.cancelReason, '今天太忙了')
  assert.strictEqual(res.data.cancelledBy, 'admin')

  // 编辑菜品时库存按基线差量处理，不覆盖下单已扣的库存
  res = await call(
    'saveDish',
    {
      name: '库存基线测试',
      desc: '',
      price: 8,
      categoryId: 'staple',
      tags: [],
      spicyLevels: [],
      addons: [],
      color: '#FFD23F',
      meals: ['lunch'],
      status: 'on',
      stock: 10,
      isRecommended: false
    },
    'admin-openid'
  )
  const baseDishId = res.data.id
  res = await call(
    'createOrder',
    {
      items: [{ dishId: baseDishId, qty: 2, specs: [] }],
      meal: 'lunch',
      expectedTime: '12:00',
      mode: '在家吃'
    },
    'girl-openid'
  )
  assert.strictEqual(res.ok, true)
  const baseOrderId = res.data.id
  res = await call('getDish', { id: baseDishId }, 'admin-openid')
  assert.strictEqual(res.data.stock, 8)
  res = await call(
    'saveDish',
    {
      id: baseDishId,
      name: '库存基线测试改',
      desc: '',
      price: 8,
      categoryId: 'staple',
      tags: [],
      spicyLevels: [],
      addons: [],
      color: '#FFD23F',
      meals: ['lunch'],
      status: 'on',
      stock: 10,
      stockBase: 10,
      isRecommended: false
    },
    'admin-openid'
  )
  assert.strictEqual(res.ok, true)
  res = await call('getDish', { id: baseDishId }, 'admin-openid')
  assert.strictEqual(res.data.stock, 8)
  res = await call(
    'saveDish',
    {
      id: baseDishId,
      name: '库存基线测试改',
      desc: '',
      price: 8,
      categoryId: 'staple',
      tags: [],
      spicyLevels: [],
      addons: [],
      color: '#FFD23F',
      meals: ['lunch'],
      status: 'on',
      stock: 15,
      stockBase: 10,
      isRecommended: false
    },
    'admin-openid'
  )
  assert.strictEqual(res.ok, true)
  res = await call('getDish', { id: baseDishId }, 'admin-openid')
  assert.strictEqual(res.data.stock, 13)
  res = await call(
    'updateOrderStatus',
    { id: baseOrderId, status: 'accepted' },
    'admin-openid'
  )
  assert.strictEqual(res.ok, true)
  res = await call(
    'updateOrderStatus',
    { id: baseOrderId, status: 'cancelled', reason: '临时休息' },
    'admin-openid'
  )
  assert.strictEqual(res.ok, true)
  assert.strictEqual(res.data.cancelReason, '临时休息')
  res = await call('getDish', { id: baseDishId }, 'admin-openid')
  assert.strictEqual(res.data.stock, 15)
  await call('deleteDish', { id: baseDishId }, 'admin-openid')

  // 我的统计：总数（不含已取消）、本月、最常点
  res = await call('getMyStats', {}, 'girl-openid')
  assert.strictEqual(res.ok, true)
  assert.ok(res.data.total >= 1)
  assert.ok(res.data.month >= 1)
  assert.strictEqual(typeof res.data.favorite, 'string')
  assert.strictEqual(typeof res.data.monthSpend, 'number')
  assert.ok(res.data.monthSpend > 0)
  assert.strictEqual(typeof res.data.week, 'number')
  assert.strictEqual(typeof res.data.weekSpend, 'number')
  assert.strictEqual(typeof res.data.weekFavorite, 'string')

  // 许愿池
  res = await call('createWish', { content: '想吃火锅' }, 'girl-openid')
  assert.strictEqual(res.ok, true)
  const wishId = res.data.id

  // 内容安全：违规内容会被拦截
  res = await call('createWish', { content: '这是违规内容' }, 'girl-openid')
  assert.strictEqual(res.ok, false)

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

  // 愿望删除：别人不能删；本人只能撤回待安排的；管理员可删任意
  res = await call('deleteWish', { id: wishId }, 'stranger-openid')
  assert.strictEqual(res.ok, false)
  res = await call('deleteWish', { id: wishId }, 'girl-openid')
  assert.strictEqual(res.ok, false)
  res = await call('createWish', { content: '想喝奶茶' }, 'girl-openid')
  const tempWishId = res.data.id
  res = await call('deleteWish', { id: tempWishId }, 'girl-openid')
  assert.strictEqual(res.ok, true)

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
  // 旧客户端不传低库存阈值/公告截止/营收目标时保留之前配置
  assert.strictEqual(res.data.lowStockThreshold, 7)
  assert.strictEqual(res.data.noticeUntil, '2099-01-01')
  assert.strictEqual(res.data.dailyGoal, 200)
  assert.strictEqual(res.data.monthlyGoal, 5000)
  assert.strictEqual(res.data.noticeFrom, '2000-01-01')
  res = await call('getBusiness', {}, 'girl-openid')
  assert.strictEqual(res.data.lowStockThreshold, 7)
  assert.strictEqual(res.data.noticeUntil, '2099-01-01')
  assert.strictEqual(res.data.dailyGoal, undefined)
  assert.strictEqual(res.data.monthlyGoal, undefined)
  assert.strictEqual(res.data.noticeFrom, '2000-01-01')

  // 休息日：指定日期不能下单
  const closedDate = chinaDate(5)
  const businessWithClosed = {
    breakfast: { open: true, deadline: '23:59' },
    lunch: { open: true, deadline: '23:59' },
    dinner: { open: false, deadline: '23:59' },
    closedNote: '今天休息',
    closedDates: [closedDate]
  }
  res = await call('updateBusiness', businessWithClosed, 'admin-openid')
  assert.strictEqual(res.ok, true)
  res = await call('getBusiness', {}, 'girl-openid')
  assert.deepStrictEqual(res.data.closedDates, [closedDate])
  res = await call(
    'createOrder',
    {
      items: [{ dishId: 'd02', qty: 1, specs: [] }],
      meal: 'lunch',
      expectedTime: '12:00',
      mode: '在家吃',
      scheduledDate: closedDate
    },
    'girl-openid'
  )
  assert.strictEqual(res.ok, false)
  res = await call(
    'updateBusiness',
    Object.assign({}, businessWithClosed, { closedDates: [] }),
    'admin-openid'
  )
  assert.strictEqual(res.ok, true)

  // 每周固定休息：按星期拦截
  const weeklyDate = chinaDate(6)
  const weeklyDay = new Date(
    Date.parse(weeklyDate + 'T00:00:00+08:00') + 8 * 60 * 60 * 1000
  ).getUTCDay()
  res = await call(
    'updateBusiness',
    Object.assign({}, businessWithClosed, {
      closedDates: [],
      weeklyClosed: [weeklyDay]
    }),
    'admin-openid'
  )
  assert.strictEqual(res.ok, true)
  res = await call('getBusiness', {}, 'girl-openid')
  assert.deepStrictEqual(res.data.weeklyClosed, [weeklyDay])
  res = await call(
    'createOrder',
    {
      items: [{ dishId: 'd02', qty: 1, specs: [] }],
      meal: 'lunch',
      expectedTime: '12:00',
      mode: '在家吃',
      scheduledDate: weeklyDate
    },
    'girl-openid'
  )
  assert.strictEqual(res.ok, false)
  res = await call(
    'updateBusiness',
    Object.assign({}, businessWithClosed, {
      closedDates: [],
      weeklyClosed: []
    }),
    'admin-openid'
  )
  assert.strictEqual(res.ok, true)

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

  // 每日菜单
  const todayKey = chinaDate(0)
  res = await call(
    'getMenuForDate',
    { date: todayKey, meal: 'lunch' },
    'admin-openid'
  )
  assert.strictEqual(res.ok, true)
  assert.strictEqual(res.data.exists, false)

  res = await call(
    'saveMenu',
    { date: todayKey, meal: 'lunch', dishIds: ['d02'], open: true },
    'girl-openid'
  )
  assert.strictEqual(res.ok, false)

  res = await call(
    'saveMenu',
    { date: todayKey, meal: 'lunch', dishIds: ['d02'], open: true },
    'admin-openid'
  )
  assert.strictEqual(res.ok, true)
  assert.deepStrictEqual(res.data.dishIds, ['d02'])

  res = await call(
    'getMenuForDate',
    { date: todayKey, meal: 'lunch' },
    'girl-openid'
  )
  assert.strictEqual(res.data.exists, true)
  assert.deepStrictEqual(res.data.dishIds, ['d02'])

  res = await call(
    'createOrder',
    {
      items: [{ dishId: 'd09', qty: 1, specs: [] }],
      meal: 'lunch',
      expectedTime: '12:00',
      mode: '在家吃',
      note: ''
    },
    'girl-openid'
  )
  assert.strictEqual(res.ok, false)

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
  assert.strictEqual(res.ok, true)
  res = await call('cancelOrder', { id: res.data.id }, 'girl-openid')
  assert.strictEqual(res.ok, true)

  res = await call(
    'deleteMenu',
    { date: todayKey, meal: 'lunch' },
    'admin-openid'
  )
  assert.strictEqual(res.ok, true)
  res = await call(
    'getMenuForDate',
    { date: todayKey, meal: 'lunch' },
    'admin-openid'
  )
  assert.strictEqual(res.data.exists, false)

  // 定时任务：把今天的菜单滚动复制到明天，只补空缺
  res = await call(
    'saveMenu',
    { date: todayKey, meal: 'lunch', dishIds: ['d02'], open: true },
    'admin-openid'
  )
  assert.strictEqual(res.ok, true)
  const tomorrowKey = chinaDate(1)
  // 客户端伪造 Timer 事件（带 openid）会被拒绝
  currentOpenid = 'girl-openid'
  const forgedTimer = await api.main({ Type: 'Timer' })
  assert.strictEqual(forgedTimer.ok, false)
  currentOpenid = ''
  const timerRoll = await api.main({ Type: 'Timer' })
  assert.strictEqual(timerRoll.ok, true)
  assert.strictEqual(timerRoll.data.skipped, false)
  assert.deepStrictEqual(timerRoll.data.menus, ['lunch'])
  res = await call(
    'getMenuForDate',
    { date: tomorrowKey, meal: 'lunch' },
    'admin-openid'
  )
  assert.strictEqual(res.data.exists, true)
  assert.deepStrictEqual(res.data.dishIds, ['d02'])
  // 同一天重复跑定时任务会直接跳过
  currentOpenid = ''
  const timerAgain = await api.main({ Type: 'Timer' })
  assert.strictEqual(timerAgain.data.skipped, true)
  assert.deepStrictEqual(timerAgain.data.menus, [])

  // 同一天删掉明天的菜单后，重复 Timer 不会把它补回来
  await call('deleteMenu', { date: tomorrowKey, meal: 'lunch' }, 'admin-openid')
  currentOpenid = ''
  const timerAfterDelete = await api.main({ Type: 'Timer' })
  assert.strictEqual(timerAfterDelete.data.skipped, true)
  res = await call(
    'getMenuForDate',
    { date: tomorrowKey, meal: 'lunch' },
    'admin-openid'
  )
  assert.strictEqual(res.data.exists, false)

  // 定时任务同时会把售罄菜品恢复供应，但同一天只做一次
  res = await call(
    'saveDish',
    {
      name: '定时测试菜',
      desc: '',
      price: 5,
      categoryId: 'staple',
      tags: [],
      spicyLevels: [],
      addons: [],
      color: '#FFD23F',
      meals: ['lunch'],
      status: 'on',
      isRecommended: false
    },
    'admin-openid'
  )
  const timerDishId = res.data.id
  await call('toggleDishStatus', { id: timerDishId }, 'admin-openid')
  currentOpenid = ''
  const timerSameDay = await api.main({ Type: 'Timer' })
  assert.strictEqual(timerSameDay.data.skipped, true)
  res = await call('getDish', { id: timerDishId }, 'admin-openid')
  assert.strictEqual(res.data.status, 'soldout')
  // 模拟第二天：清掉滚动记录后再跑
  const configDoc = ensure('config').get('app')
  if (configDoc) {
    configDoc.lastRollDate = ''
  }
  currentOpenid = ''
  const timerReset = await api.main({ Type: 'Timer' })
  assert.strictEqual(timerReset.data.skipped, false)
  assert.ok(timerReset.data.restored >= 1)
  res = await call('getDish', { id: timerDishId }, 'admin-openid')
  assert.strictEqual(res.data.status, 'on')
  await call('deleteDish', { id: timerDishId }, 'admin-openid')

  // 管理员补跑每日滚动；非管理员不行
  res = await call('rollMenu', {}, 'girl-openid')
  assert.strictEqual(res.ok, false)
  res = await call('rollMenu', {}, 'admin-openid')
  assert.strictEqual(res.ok, true)
  // 清理菜单，避免影响后续下单用例
  await call('deleteMenu', { date: tomorrowKey, meal: 'lunch' }, 'admin-openid')
  await call('deleteMenu', { date: todayKey, meal: 'lunch' }, 'admin-openid')

  // 菜单模板云同步：管理员读写、字段清洗
  res = await call('getMenuTemplates', {}, 'girl-openid')
  assert.strictEqual(res.ok, false)
  res = await call(
    'saveMenuTemplates',
    { templates: [] },
    'girl-openid'
  )
  assert.strictEqual(res.ok, false)
  res = await call(
    'saveMenuTemplates',
    {
      templates: [
        {
          id: 'tpl-1',
          name: '午餐A',
          meal: 'lunch',
          dishIds: ['d01', 'd02'],
          updatedAt: 1
        },
        {
          id: 'tpl-2',
          name: '',
          meal: 'bad',
          dishIds: [],
          updatedAt: 2
        }
      ]
    },
    'admin-openid'
  )
  assert.strictEqual(res.ok, true)
  assert.strictEqual(res.data.length, 1)
  assert.strictEqual(res.data[0].name, '午餐A')
  assert.strictEqual(res.data[0].meal, 'lunch')
  assert.deepStrictEqual(res.data[0].dishIds, ['d01', 'd02'])
  res = await call('getMenuTemplates', {}, 'admin-openid')
  assert.strictEqual(res.data.length, 1)
  res = await call(
    'saveMenuTemplates',
    { templates: [] },
    'admin-openid'
  )
  assert.strictEqual(res.data.length, 0)

  // 数据备份：仅管理员，返回配置与各集合快照
  res = await call('exportData', {}, 'girl-openid')
  assert.strictEqual(res.ok, false)
  res = await call('exportData', {}, 'admin-openid')
  assert.strictEqual(res.ok, true)
  assert.strictEqual(res.data.version, '1.0')
  assert.ok(res.data.exportedAt > 0)
  assert.ok(res.data.counts.dishes >= 1)
  assert.ok(Array.isArray(res.data.data.dishes))
  assert.ok(Array.isArray(res.data.data.orders))
  assert.ok(res.data.data.orders.length <= 200)
  assert.ok(res.data.data.config && res.data.data.config.business)
  assert.ok(!('_id' in res.data.data.config))
  res.data.data.dishes.forEach(dish => {
    assert.ok(!('_openid' in dish))
  })

  // 周饭表：公开读取今天起 7 天 × 3 餐，缺失的补占位
  res = await call('getWeekMenus', {}, 'girl-openid')
  assert.strictEqual(res.ok, true)
  assert.strictEqual(res.data.days.length, 7)
  assert.strictEqual(res.data.startDate, chinaDate(0))
  assert.strictEqual(res.data.endDate, chinaDate(6))
  const weekDays = res.data.days
  weekDays.forEach((day, index) => {
    assert.strictEqual(day.date, chinaDate(index))
    // 独立按日历日期算星期，避免服务端整体偏移时相对断言仍通过
    assert.strictEqual(
      day.weekday,
      new Date(chinaDate(index) + 'T00:00:00Z').getUTCDay()
    )
    assert.strictEqual(day.weekday, (weekDays[0].weekday + index) % 7)
    assert.deepStrictEqual(
      day.menus.map(menu => menu.meal),
      ['breakfast', 'lunch', 'dinner']
    )
    day.menus.forEach(menu => {
      assert.strictEqual(menu.exists, false)
      assert.deepStrictEqual(menu.dishIds, [])
      assert.strictEqual(menu.open, true)
    })
  })

  await call(
    'saveMenu',
    { date: chinaDate(0), meal: 'lunch', dishIds: ['d02'], open: true },
    'admin-openid'
  )
  await call(
    'saveMenu',
    { date: chinaDate(2), meal: 'dinner', dishIds: ['d01'], open: false },
    'admin-openid'
  )
  res = await call('getWeekMenus', {}, 'girl-openid')
  assert.strictEqual(res.ok, true)
  assert.strictEqual(res.data.days[0].menus[1].exists, true)
  assert.deepStrictEqual(res.data.days[0].menus[1].dishIds, ['d02'])
  assert.strictEqual(res.data.days[2].menus[2].exists, true)
  assert.strictEqual(res.data.days[2].menus[2].open, false)
  assert.strictEqual(res.data.days[1].menus[1].exists, false)
  await call(
    'deleteMenu',
    { date: chinaDate(0), meal: 'lunch' },
    'admin-openid'
  )
  await call(
    'deleteMenu',
    { date: chinaDate(2), meal: 'dinner' },
    'admin-openid'
  )

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

  // 违规备注在扣库存前被拦截，库存不变
  res = await call(
    'createOrder',
    {
      items: [{ dishId: limitedId, qty: 2, specs: [] }],
      meal: 'lunch',
      expectedTime: '12:00',
      mode: '在家吃',
      note: '违规备注'
    },
    'girl-openid'
  )
  assert.strictEqual(res.ok, false)
  res = await call('getDish', { id: limitedId }, 'admin-openid')
  assert.strictEqual(res.data.stock, 5)

  // 单品备注同样会被内容安全拦截
  res = await call(
    'createOrder',
    {
      items: [{ dishId: limitedId, qty: 1, specs: [], note: '违规单品备注' }],
      meal: 'lunch',
      expectedTime: '12:00',
      mode: '在家吃'
    },
    'girl-openid'
  )
  assert.strictEqual(res.ok, false)
  res = await call('getDish', { id: limitedId }, 'admin-openid')
  assert.strictEqual(res.data.stock, 5)

  // 地址和规格同样纳入内容安全
  res = await call(
    'createOrder',
    {
      items: [{ dishId: limitedId, qty: 1, specs: [] }],
      meal: 'lunch',
      expectedTime: '12:00',
      mode: '在家吃',
      address: '违规地址'
    },
    'girl-openid'
  )
  assert.strictEqual(res.ok, false)
  res = await call('getDish', { id: limitedId }, 'admin-openid')
  assert.strictEqual(res.data.stock, 5)
  res = await call(
    'createOrder',
    {
      items: [{ dishId: limitedId, qty: 1, specs: ['违规规格'] }],
      meal: 'lunch',
      expectedTime: '12:00',
      mode: '在家吃'
    },
    'girl-openid'
  )
  assert.strictEqual(res.ok, false)
  res = await call('getDish', { id: limitedId }, 'admin-openid')
  assert.strictEqual(res.data.stock, 5)

  // 写单失败时，已经扣掉的库存要回补
  beforeAdd = name => {
    if (name === 'orders') {
      throw new Error('模拟写单失败')
    }
  }
  res = await call(
    'createOrder',
    {
      items: [{ dishId: limitedId, qty: 2, specs: [] }],
      meal: 'lunch',
      expectedTime: '12:00',
      mode: '在家吃'
    },
    'girl-openid'
  )
  beforeAdd = null
  assert.strictEqual(res.ok, false)
  res = await call('getDish', { id: limitedId }, 'admin-openid')
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

  // 菜品在取消前被删掉时，取消订单仍要成功，库存回补只记日志
  res = await call(
    'saveDish',
    {
      name: '删菜回补测试',
      desc: '',
      price: 6,
      categoryId: 'staple',
      tags: [],
      spicyLevels: [],
      addons: [],
      color: '#FFD23F',
      meals: ['lunch'],
      status: 'on',
      stock: 3,
      isRecommended: false
    },
    'admin-openid'
  )
  const goneDishId = res.data.id
  const goneOrder = await call(
    'createOrder',
    {
      items: [{ dishId: goneDishId, qty: 1, specs: [] }],
      meal: 'lunch',
      expectedTime: '12:00',
      mode: '在家吃'
    },
    'girl-openid'
  )
  assert.strictEqual(goneOrder.ok, true)
  res = await call('deleteDish', { id: goneDishId }, 'admin-openid')
  assert.strictEqual(res.ok, true)
  res = await call('cancelOrder', { id: goneOrder.data.id }, 'girl-openid')
  assert.strictEqual(res.ok, true)

  // 同一个 requestId 重试只创建一单，库存只扣一次
  res = await call(
    'saveDish',
    {
      name: '幂等测试菜',
      desc: '',
      price: 7,
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
  const idemDishId = res.data.id
  const idemPayload = {
    requestId: 'smoke-idem-1',
    items: [{ dishId: idemDishId, qty: 2, specs: [] }],
    meal: 'lunch',
    expectedTime: '12:00',
    mode: '在家吃'
  }
  const idemFirst = await call('createOrder', idemPayload, 'girl-openid')
  assert.strictEqual(idemFirst.ok, true)
  const idemSecond = await call('createOrder', idemPayload, 'girl-openid')
  assert.strictEqual(idemSecond.ok, true)
  assert.strictEqual(idemSecond.data.id, idemFirst.data.id)
  assert.strictEqual(idemSecond.data.no, idemFirst.data.no)
  res = await call('getDish', { id: idemDishId }, 'admin-openid')
  assert.strictEqual(res.data.stock, 3)
  const idemThird = await call(
    'createOrder',
    { ...idemPayload, requestId: 'smoke-idem-2' },
    'girl-openid'
  )
  assert.strictEqual(idemThird.ok, true)
  assert.notStrictEqual(idemThird.data.id, idemFirst.data.id)
  res = await call('getDish', { id: idemDishId }, 'admin-openid')
  assert.strictEqual(res.data.stock, 1)
  await call('cancelOrder', { id: idemFirst.data.id }, 'girl-openid')
  await call('cancelOrder', { id: idemThird.data.id }, 'girl-openid')
  res = await call('getDish', { id: idemDishId }, 'admin-openid')
  assert.strictEqual(res.data.stock, 5)
  await call('deleteDish', { id: idemDishId }, 'admin-openid')

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

  // 生日 / 纪念日：保存、提醒排序、30 天窗口与旧客户端保留
  const specialBirthday = `2000-${chinaDate(0).slice(5)}`
  const specialAnniversary = `2000-${chinaDate(1).slice(5)}`
  const specialBirthday29 = `2000-${chinaDate(29).slice(5)}`
  const specialAnniversary30 = `2000-${chinaDate(30).slice(5)}`
  res = await call(
    'saveMyProfile',
    {
      dislikes: ['香菜'],
      tastes: ['微辣'],
      address: '家里',
      birthday: specialBirthday,
      anniversary: specialAnniversary
    },
    'girl-openid'
  )
  assert.strictEqual(res.ok, true)
  assert.strictEqual(res.data.birthday, specialBirthday)
  assert.strictEqual(res.data.anniversary, specialAnniversary)

  res = await call('getSpecialDays', {}, 'admin-openid')
  assert.strictEqual(res.ok, true)
  assert.strictEqual(res.data.today, chinaDate(0))
  assert.strictEqual(res.data.days.length, 2)
  assert.strictEqual(res.data.days[0].kind, 'birthday')
  assert.strictEqual(res.data.days[0].date, chinaDate(0).slice(5))
  assert.strictEqual(res.data.days[0].days, 0)
  assert.strictEqual(res.data.days[1].kind, 'anniversary')
  assert.strictEqual(res.data.days[1].date, chinaDate(1).slice(5))
  assert.strictEqual(res.data.days[1].days, 1)
  assert.strictEqual(res.data.days[1].openid, undefined)
  assert.strictEqual(res.data.days[1].address, undefined)
  assert.strictEqual(res.data.days[1].dislikes, undefined)
  assert.strictEqual(res.data.days[1].tastes, undefined)

  res = await call('getSpecialDays', {}, 'girl-openid')
  assert.strictEqual(res.ok, false)

  res = await call('getMySpecialDays', {}, 'girl-openid')
  assert.strictEqual(res.ok, true)
  assert.strictEqual(res.data.today, chinaDate(0))
  assert.strictEqual(res.data.days.length, 2)
  assert.strictEqual(res.data.days[0].kind, 'birthday')
  assert.strictEqual(res.data.days[0].days, 0)
  assert.strictEqual(res.data.days[0].date, chinaDate(0).slice(5))
  assert.strictEqual(res.data.days[1].kind, 'anniversary')
  assert.strictEqual(res.data.days[1].days, 1)
  assert.strictEqual(res.data.days[1].date, chinaDate(1).slice(5))
  res = await call('getMySpecialDays', {}, 'admin-openid')
  assert.strictEqual(res.ok, true)
  assert.strictEqual(res.data.days.length, 0)

  // 未来日期不能作为生日/纪念日，也不能清掉已有值
  res = await call(
    'saveMyProfile',
    { anniversary: chinaDate(1) },
    'girl-openid'
  )
  assert.strictEqual(res.ok, false)
  res = await call('getMyProfile', {}, 'girl-openid')
  assert.strictEqual(res.data.anniversary, specialAnniversary)

  // 窗口是今天起 30 个日历日（0-29 天）
  await call(
    'saveMyProfile',
    {
      birthday: specialBirthday29,
      anniversary: specialAnniversary30
    },
    'girl-openid'
  )
  res = await call('getSpecialDays', {}, 'admin-openid')
  assert.strictEqual(res.data.days.length, 1)
  assert.strictEqual(res.data.days[0].kind, 'birthday')
  assert.strictEqual(res.data.days[0].days, 29)
  // 只带日期保存时，原有口味与地址不能丢
  res = await call('getMyProfile', {}, 'girl-openid')
  assert.deepStrictEqual(res.data.dislikes, ['香菜'])
  assert.deepStrictEqual(res.data.tastes, ['微辣'])
  assert.strictEqual(res.data.address, '家里')

  // 旧客户端不带日期字段：不能清空已保存的日期
  res = await call(
    'saveMyProfile',
    { dislikes: ['香菜'], tastes: ['微辣'], address: '家里' },
    'girl-openid'
  )
  assert.strictEqual(res.data.birthday, specialBirthday29)
  assert.strictEqual(res.data.anniversary, specialAnniversary30)

  // 显式空字符串可以清除
  res = await call(
    'saveMyProfile',
    {
      dislikes: ['香菜'],
      tastes: ['微辣'],
      address: '家里',
      birthday: '',
      anniversary: ''
    },
    'girl-openid'
  )
  assert.strictEqual(res.data.birthday, '')
  assert.strictEqual(res.data.anniversary, '')
  res = await call('getSpecialDays', {}, 'admin-openid')
  assert.strictEqual(res.data.days.length, 0)

  // 闰日：2000-02-29 合法，2001-02-29 不合法
  res = await call(
    'saveMyProfile',
    { birthday: '2000-02-29' },
    'girl-openid'
  )
  assert.strictEqual(res.ok, true)

  // 非法日期拒绝保存，不会静默清掉原值
  res = await call(
    'saveMyProfile',
    { birthday: '2026-02-30' },
    'girl-openid'
  )
  assert.strictEqual(res.ok, false)
  res = await call('getMyProfile', {}, 'girl-openid')
  assert.strictEqual(res.data.birthday, '2000-02-29')

  res = await call(
    'saveMyProfile',
    { birthday: '2001-02-29' },
    'girl-openid'
  )
  assert.strictEqual(res.ok, false)
  res = await call('getMyProfile', {}, 'girl-openid')
  assert.strictEqual(res.data.birthday, '2000-02-29')

  // 顾客首页只显示今天起 4 个日历日（0-3），第 4 天不提醒
  await call(
    'saveMyProfile',
    {
      birthday: `2000-${chinaDate(3).slice(5)}`,
      anniversary: `2000-${chinaDate(4).slice(5)}`
    },
    'girl-openid'
  )
  res = await call('getMySpecialDays', {}, 'girl-openid')
  assert.strictEqual(res.data.windowDays, 4)
  assert.strictEqual(res.data.days.length, 1)
  assert.strictEqual(res.data.days[0].kind, 'birthday')
  assert.strictEqual(res.data.days[0].days, 3)
  await call(
    'saveMyProfile',
    { birthday: '', anniversary: '' },
    'girl-openid'
  )

  res = await call('getMyProfile', {}, 'admin-openid')
  assert.deepStrictEqual(res.data.dislikes, [])

  // 顾客可读的厨房忙闲（只返回数量）
  res = await call('getKitchenStatus', {}, 'girl-openid')
  assert.strictEqual(res.ok, true)
  assert.strictEqual(typeof res.data.active, 'number')
  assert.strictEqual(res.data.busy, res.data.active > 0)
  assert.strictEqual(res.data.orders, undefined)

  // 今日看板
  res = await call('getStats', {}, 'admin-openid')
  assert.strictEqual(res.ok, true)
  assert.ok(res.data.orderCount >= 1)
  assert.ok(res.data.revenue >= 40)
  assert.ok(res.data.completed >= 1)
  assert.ok(res.data.ratedCount >= 1)
  assert.ok(res.data.goodRatings >= 1)
  assert.ok(res.data.avgRating > 0)

  res = await call('getStats', {}, 'girl-openid')
  assert.strictEqual(res.ok, false)

  // 经营月报：管理员专属，30 天明细与菜品排行
  const d01ForCost = await call('getDish', { id: 'd01' }, 'admin-openid')
  res = await call(
    'saveDish',
    {
      ...d01ForCost.data,
      cost: 6,
      priceBase: Number(d01ForCost.data.price)
    },
    'admin-openid'
  )
  assert.strictEqual(res.ok, true)
  assert.strictEqual(res.data.cost, 6)
  res = await call('getDishes', {}, 'girl-openid')
  const publicDish = res.data.find(dish => dish.id === 'd01')
  assert.ok(publicDish && publicDish.cost === undefined)
  res = await call('getDish', { id: 'd01' }, 'girl-openid')
  assert.strictEqual(res.data.cost, undefined)
  res = await call('getDish', { id: 'd01' }, 'admin-openid')
  assert.strictEqual(res.data.cost, 6)
  const costOrder = await call(
    'createOrder',
    {
      items: [{ dishId: 'd01', qty: 1, specs: [], note: '' }],
      meal: 'lunch',
      expectedTime: '12:00',
      mode: '在家吃',
      note: ''
    },
    'girl-openid'
  )
  assert.strictEqual(costOrder.ok, true)
  assert.strictEqual(costOrder.data.items[0].cost, undefined)
  res = await call('getOrder', { id: costOrder.data.id }, 'girl-openid')
  assert.strictEqual(res.data.items[0].cost, undefined)
  res = await call('getOrders', {}, 'girl-openid')
  assert.ok(
    res.data.every(order =>
      (order.items || []).every(item => item.cost === undefined)
    )
  )
  // 下单后改成本：月报仍按下单时的 6 元快照计算
  res = await call(
    'saveDish',
    {
      ...d01ForCost.data,
      cost: 1,
      priceBase: Number(d01ForCost.data.price)
    },
    'admin-openid'
  )
  assert.strictEqual(res.ok, true)
  res = await call('getKitchenReport', {}, 'girl-openid')
  assert.strictEqual(res.ok, false)
  res = await call('getKitchenReport', {}, 'admin-openid')
  assert.strictEqual(res.ok, true)
  assert.strictEqual(res.data.days, 30)
  assert.strictEqual(res.data.daily.length, 30)
  assert.strictEqual(res.data.endDate, chinaDate(0))
  assert.ok(res.data.totalOrders >= 1)
  assert.ok(res.data.revenue >= 40)
  assert.ok(res.data.monthRevenue > 0)
  assert.ok(res.data.monthOrders >= 1)
  assert.ok(res.data.previousMonth)
  assert.strictEqual(typeof res.data.previousMonth.revenue, 'number')
  assert.strictEqual(typeof res.data.previousMonth.orders, 'number')
  assert.ok(
    /^\d{4}-\d{2}-\d{2}$/.test(res.data.previousMonth.startDate) &&
      /^\d{4}-\d{2}-\d{2}$/.test(res.data.previousMonth.endDate)
  )
  assert.ok(res.data.topDishes.length >= 1)
  assert.ok(res.data.topDishes[0].qty >= 1)
  const report30 = res
  res = await call('getKitchenReport', { days: 7 }, 'admin-openid')
  assert.strictEqual(res.ok, true)
  assert.strictEqual(res.data.days, 7)
  assert.strictEqual(res.data.daily.length, 7)
  assert.strictEqual(res.data.startDate, chinaDate(-6))
  assert.strictEqual(res.data.endDate, chinaDate(0))
  assert.strictEqual(
    res.data.monthRevenue,
    report30.data.monthRevenue
  )
  res = report30
  assert.strictEqual(res.data.minRatedOrders, 2)
  assert.deepStrictEqual(res.data.topRatedDishes, [])
  assert.strictEqual(typeof res.data.repliedRatings, 'number')
  assert.ok(
    res.data.replyRate ===
      Math.round(
        (res.data.repliedRatings / Math.max(1, res.data.ratedCount)) * 100
      )
  )
  const d01Top = res.data.topDishes.find(
    item => item.name === '番茄牛腩饭'
  )
  assert.ok(d01Top && d01Top.qty >= 2)
  // 只有带 6 元快照的这一单计入；早先 0 成本快照的订单不回填
  assert.strictEqual(res.data.costStats.qty, 1)
  assert.strictEqual(res.data.costStats.revenue, 18)
  assert.strictEqual(res.data.costStats.cost, 6)
  assert.strictEqual(res.data.costStats.profit, 12)
  assert.strictEqual(res.data.costStats.margin, 67)
  const d01Row = res.data.dishRows.find(
    item => item.name === '番茄牛腩饭'
  )
  assert.ok(d01Row && d01Row.qty >= 2)
  // 旧订单没有成本快照且部分菜品缺成本时，单菜成本留空，不给出误导毛利
  assert.strictEqual(d01Row.cost, null)
  // 上月同期：构造一笔上月 1 日的订单，确认区间与金额真的被统计
  const smokeChina = new Date(Date.now() + 8 * 60 * 60 * 1000)
  const previousMonthTs =
    Date.UTC(
      smokeChina.getUTCFullYear(),
      smokeChina.getUTCMonth() - 1,
      1,
      12
    ) -
    8 * 60 * 60 * 1000
  ensure('orders').set('prev-month-smoke', {
    _id: 'prev-month-smoke',
    amount: 77,
    status: 'completed',
    createdAt: previousMonthTs,
    meal: 'dinner',
    items: [{ dishId: 'd01', name: '上月测试菜', price: 77, qty: 1 }]
  })
  res = await call('getKitchenReport', {}, 'admin-openid')
  assert.strictEqual(res.data.previousMonth.revenue, 77)
  assert.strictEqual(res.data.previousMonth.orders, 1)
  ensure('orders').delete('prev-month-smoke')
  await call('cancelOrder', { id: costOrder.data.id }, 'girl-openid')
  await call(
    'saveDish',
    {
      ...d01ForCost.data,
      cost: 0,
      priceBase: Number(d01ForCost.data.price)
    },
    'admin-openid'
  )
  const slowDishPayload = {
    name: '!慢销测试菜',
    desc: '滞销榜测试',
    price: 12,
    categoryId: 'staple',
    tags: [],
    spicyLevels: [],
    addons: [],
    color: '#FFD23F',
    meals: ['lunch'],
    status: 'on',
    isRecommended: false
  }
  const slowDishRes = await call(
    'saveDish',
    slowDishPayload,
    'admin-openid'
  )
  assert.strictEqual(slowDishRes.ok, true)
  res = await call('getKitchenReport', {}, 'admin-openid')
  assert.ok(
    res.data.slowDishes.some(
      item => item.name === '!慢销测试菜' && item.qty === 0
    )
  )
  const slowFixture = res.data.slowDishes.find(
    item => item.name === '!慢销测试菜'
  )
  assert.ok(slowFixture.id)
  assert.strictEqual(slowFixture.status, 'on')
  await call(
    'deleteDish',
    { id: slowDishRes.data.id },
    'admin-openid'
  )
  const topName = res.data.topDishes[0].name
  assert.ok(res.data.ratedCount >= 1)
  assert.ok(res.data.avgRating > 0)
  // 好评菜品榜：每单每菜只计一次、同名合并、至少 2 次评价、忽略无效/取消
  const fixtureNow = Date.now()
  const fixtureOrder = (id, rating, items, status) => ({
    _id: id,
    _openid: 'girl-openid',
    no: id,
    items,
    amount: 18,
    meal: 'lunch',
    expectedTime: '12:00',
    mode: '在家吃',
    note: '',
    status: status || 'completed',
    rating,
    createdAt: fixtureNow - 2 * 24 * 60 * 60 * 1000,
    timeline: []
  })
  const fixtures = [
    fixtureOrder('fixture-d01', 3, [
      { dishId: 'd01', name: '番茄牛腩饭', price: 18, qty: 1, specs: ['微辣'] },
      { dishId: 'd01', name: '番茄牛腩饭', price: 18, qty: 1, specs: [] }
    ]),
    fixtureOrder('fixture-dup-a', 3, [
      { dishId: 'fixture-a', name: '同名菜', price: 10, qty: 1, specs: [] }
    ]),
    fixtureOrder('fixture-dup-b', 2, [
      { dishId: 'fixture-b', name: '同名菜', price: 10, qty: 1, specs: [] }
    ]),
    fixtureOrder('fixture-invalid', 4, [
      { dishId: 'd01', name: '番茄牛腩饭', price: 18, qty: 1, specs: [] }
    ]),
    fixtureOrder('fixture-cancelled', 3, [
      { dishId: 'd01', name: '番茄牛腩饭', price: 18, qty: 1, specs: [] }
    ], 'cancelled')
  ]
  fixtures.forEach(order => ensure('orders').set(order._id, order))
  res = await call('getKitchenReport', {}, 'admin-openid')
  assert.strictEqual(res.ok, true)
  assert.strictEqual(res.data.topRatedDishes.length, 2)
  assert.deepStrictEqual(res.data.topRatedDishes[0], {
    name: '番茄牛腩饭',
    avgRating: 3,
    ratedCount: 2
  })
  assert.deepStrictEqual(res.data.topRatedDishes[1], {
    name: '同名菜',
    avgRating: 2.5,
    ratedCount: 2
  })
  res.data.topRatedDishes.forEach(item => {
    assert.deepStrictEqual(Object.keys(item).sort(), [
      'avgRating',
      'name',
      'ratedCount'
    ])
  })
  fixtures.forEach(order => ensure('orders').delete(order._id))

  assert.ok(Array.isArray(res.data.topTags))
  assert.ok(res.data.topTags.length <= 5)
  assert.strictEqual(res.data.mealStats.length, 3)
  assert.strictEqual(
    res.data.mealStats.reduce((sum, item) => sum + item.count, 0),
    res.data.totalOrders
  )
  assert.strictEqual(
    Number(
      res.data.mealStats
        .reduce((sum, item) => sum + item.revenue, 0)
        .toFixed(2)
    ),
    res.data.revenue
  )

  // 单品近 30 天销量
  res = await call('getDishSales', { name: topName }, 'girl-openid')
  assert.strictEqual(res.ok, false)
  res = await call('getDishSales', { name: topName }, 'admin-openid')
  assert.strictEqual(res.ok, true)
  assert.strictEqual(res.data.name, topName)
  assert.ok(res.data.qty >= 1)
  assert.ok(res.data.orders >= 1)
  assert.strictEqual(res.data.daily.length, 7)
  assert.ok(
    res.data.daily.reduce((sum, day) => sum + day.qty, 0) >= 1
  )
  res = await call('getDishSales', { name: '不存在的菜' }, 'admin-openid')
  assert.strictEqual(res.data.qty, 0)

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

  // 已被领走的券别人不能再领
  res = await call('claimCoupon', { id: couponId }, 'stranger-openid')
  assert.strictEqual(res.ok, false)

  res = await call('useCoupon', { id: couponId }, 'girl-openid')
  assert.strictEqual(res.ok, true)
  assert.strictEqual(res.data.status, 'used')

  res = await call('useCoupon', { id: couponId }, 'girl-openid')
  assert.strictEqual(res.ok, false)

  res = await call('deleteCoupon', { id: couponId }, 'girl-openid')
  assert.strictEqual(res.ok, false)

  res = await call('deleteCoupon', { id: couponId }, 'admin-openid')
  assert.strictEqual(res.ok, true)

  // 首页提醒：只统计自己 3 天内到期的未使用券
  res = await call(
    'createCoupon',
    { title: '快过期测试券', note: '', expiresInDays: 1 },
    'admin-openid'
  )
  assert.strictEqual(res.ok, true)
  const soonId = res.data.id
  res = await call('claimCoupon', { id: soonId }, 'girl-openid')
  assert.strictEqual(res.ok, true)
  res = await call('getMyExpiringCoupons', {}, 'girl-openid')
  assert.strictEqual(res.ok, true)
  assert.ok(res.data.count >= 1)
  res = await call('getMyExpiringCoupons', {}, 'admin-openid')
  assert.strictEqual(res.ok, true)
  assert.strictEqual(res.data.count, 0)
  await call('deleteCoupon', { id: soonId }, 'admin-openid')

  // 退回券池：只能退自己的未使用券，退回后可被别人领取
  res = await call(
    'createCoupon',
    { title: '退回测试券', note: '' },
    'admin-openid'
  )
  const releaseId = res.data.id
  await call('claimCoupon', { id: releaseId }, 'girl-openid')
  res = await call('releaseCoupon', { id: releaseId }, 'stranger-openid')
  assert.strictEqual(res.ok, false)
  res = await call('releaseCoupon', { id: releaseId }, 'girl-openid')
  assert.strictEqual(res.ok, true)
  assert.strictEqual(res.data.owner, '')
  res = await call('claimCoupon', { id: releaseId }, 'stranger-openid')
  assert.strictEqual(res.ok, true)
  await call('deleteCoupon', { id: releaseId }, 'admin-openid')

  // 过期券不能领取，也不能使用
  res = await call(
    'createCoupon',
    { title: '过期券', note: '', expiresInDays: 1 },
    'admin-openid'
  )
  assert.strictEqual(res.ok, true)
  assert.ok(Number(res.data.expiresAt) > Date.now())
  const expiredId = res.data.id
  const expiredDoc = ensure('coupons').get(expiredId)
  expiredDoc.expiresAt = Date.now() - 1000
  res = await call('claimCoupon', { id: expiredId }, 'expired-openid')
  assert.strictEqual(res.ok, false)
  assert.ok(String(res.error).indexOf('过期') > -1)
  expiredDoc.owner = 'expired-openid'
  res = await call('useCoupon', { id: expiredId }, 'expired-openid')
  assert.strictEqual(res.ok, false)
  assert.ok(String(res.error).indexOf('过期') > -1)
  await call('deleteCoupon', { id: expiredId }, 'admin-openid')

  // 未使用的券最多同时持有 5 张
  const hoardedIds = []
  for (let i = 0; i < 6; i++) {
    res = await call(
      'createCoupon',
      { title: `限领测试券${i}`, note: '' },
      'admin-openid'
    )
    hoardedIds.push(res.data.id)
    res = await call('claimCoupon', { id: res.data.id }, 'hopper-openid')
    if (i < 5) {
      assert.strictEqual(res.ok, true)
    } else {
      assert.strictEqual(res.ok, false)
      assert.ok(String(res.error).indexOf('还没用完') > -1)
    }
  }
  for (const id of hoardedIds) {
    await call('deleteCoupon', { id }, 'admin-openid')
  }

  // 库存变动日志：下单扣减、取消回补、手动调整
  const stockDish = await call(
    'saveDish',
    {
      name: '库存测试菜',
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
  assert.strictEqual(stockDish.ok, true)
  // 清掉今天午餐菜单，避免新测试菜不在菜单里被拦截
  await call(
    'deleteMenu',
    { date: chinaDate(0), meal: 'lunch' },
    'admin-openid'
  )
  const stockLogOrder = await call(
    'createOrder',
    {
      items: [{ dishId: stockDish.data.id, qty: 1, specs: [] }],
      meal: 'lunch',
      expectedTime: '12:00',
      mode: '在家吃'
    },
    'girl-openid'
  )
  assert.strictEqual(stockLogOrder.ok, true)
  let stockLogs = await call(
    'getStockLogs',
    { dishId: stockDish.data.id },
    'admin-openid'
  )
  assert.strictEqual(stockLogs.ok, true)
  assert.ok(
    stockLogs.data.some(log => log.source === 'order' && log.delta === -1)
  )
  await call('cancelOrder', { id: stockLogOrder.data.id }, 'girl-openid')
  stockLogs = await call(
    'getStockLogs',
    { dishId: stockDish.data.id },
    'admin-openid'
  )
  assert.ok(
    stockLogs.data.some(log => log.source === 'cancel' && log.delta === 1)
  )
  res = await call(
    'saveDish',
    {
      id: stockDish.data.id,
      name: '库存测试菜',
      desc: '',
      price: 10,
      categoryId: 'staple',
      tags: [],
      spicyLevels: [],
      addons: [],
      color: '#FFD23F',
      meals: ['lunch'],
      status: 'on',
      stock: 8,
      stockBase: 5,
      isRecommended: false
    },
    'admin-openid'
  )
  assert.strictEqual(res.ok, true)
  assert.strictEqual(res.data.stock, 8)
  stockLogs = await call(
    'getStockLogs',
    { dishId: stockDish.data.id },
    'admin-openid'
  )
  assert.ok(
    stockLogs.data.some(log => log.source === 'edit' && log.delta === 3)
  )
  res = await call(
    'getStockLogs',
    { dishId: stockDish.data.id },
    'girl-openid'
  )
  assert.strictEqual(res.ok, false)
  await call('deleteDish', { id: stockDish.data.id }, 'admin-openid')

  // 厨房一键接单：管理员专属，只处理今天及逾期的待接单
  const batchOrder = await call(
    'createOrder',
    {
      items: [{ dishId: 'd02', qty: 1, specs: [] }],
      meal: 'lunch',
      expectedTime: '12:00',
      mode: '在家吃'
    },
    'girl-openid'
  )
  assert.strictEqual(batchOrder.ok, true)
  const futureOrder = await call(
    'createOrder',
    {
      items: [{ dishId: 'd02', qty: 1, specs: [] }],
      meal: 'lunch',
      expectedTime: '12:00',
      mode: '在家吃',
      scheduledDate: chinaDate(1)
    },
    'girl-openid'
  )
  assert.strictEqual(futureOrder.ok, true)
  // 未来预订单不能占掉「上次吃」「今天这单」的名额
  res = await call('getLastOrder', {}, 'girl-openid')
  assert.strictEqual(res.data.id, batchOrder.data.id)
  res = await call('getMyActiveOrder', {}, 'girl-openid')
  assert.strictEqual(res.data.id, batchOrder.data.id)
  res = await call('acceptPendingOrders', {}, 'girl-openid')
  assert.strictEqual(res.ok, false)
  res = await call('acceptPendingOrders', {}, 'admin-openid')
  assert.strictEqual(res.ok, true)
  assert.ok(res.data.done >= 1)
  assert.strictEqual(res.data.done, res.data.total)
  res = await call(
    'getOrder',
    { id: batchOrder.data.id },
    'admin-openid'
  )
  assert.strictEqual(res.data.status, 'accepted')
  assert.ok(
    (res.data.timeline || []).some(entry => entry.status === 'accepted')
  )
  res = await call(
    'getOrder',
    { id: futureOrder.data.id },
    'admin-openid'
  )
  assert.strictEqual(res.data.status, 'pending')

  // 备注只能在开火前改：已接单可以改，开火后条件更新失败
  res = await call(
    'updateOrderNote',
    { id: batchOrder.data.id, note: '开火前改一句' },
    'girl-openid'
  )
  assert.strictEqual(res.ok, true)
  res = await call(
    'updateOrderStatus',
    { id: batchOrder.data.id, status: 'cooking' },
    'admin-openid'
  )
  assert.strictEqual(res.ok, true)
  res = await call(
    'updateOrderNote',
    { id: batchOrder.data.id, note: '开火后改不了' },
    'girl-openid'
  )
  assert.strictEqual(res.ok, false)

  // 待接单改餐次/日期，接单后不能再改
  await call(
    'deleteMenu',
    { date: chinaDate(1), meal: 'lunch' },
    'admin-openid'
  )
  const slotOrder = await call(
    'createOrder',
    {
      items: [{ dishId: 'd02', qty: 1, specs: [] }],
      meal: 'lunch',
      expectedTime: '12:00',
      mode: '在家吃'
    },
    'girl-openid'
  )
  assert.strictEqual(slotOrder.ok, true)
  res = await call(
    'updateOrderSlot',
    {
      id: slotOrder.data.id,
      meal: 'lunch',
      scheduledDate: chinaDate(1)
    },
    'girl-openid'
  )
  assert.strictEqual(res.ok, true)
  assert.strictEqual(res.data.scheduledDate, chinaDate(1))
  res = await call(
    'updateOrderSlot',
    {
      id: slotOrder.data.id,
      meal: 'lunch',
      scheduledDate: chinaDate(1)
    },
    'stranger-openid'
  )
  assert.strictEqual(res.ok, false)
  res = await call(
    'updateOrderStatus',
    { id: slotOrder.data.id, status: 'accepted' },
    'admin-openid'
  )
  assert.strictEqual(res.ok, true)
  res = await call(
    'updateOrderSlot',
    {
      id: slotOrder.data.id,
      meal: 'lunch',
      scheduledDate: chinaDate(0)
    },
    'girl-openid'
  )
  assert.strictEqual(res.ok, false)

  console.log(
    '云函数冒烟测试通过：初始化、菜单、菜品 CRUD、下单计价、权限、状态流转、取消订单、订单评价与回复、许愿池、营业设置、每日菜单、口味档案、今日看板、爱心券、售罄拦截、订阅消息。'
  )
}

run().catch(err => {
  console.error('云函数冒烟测试失败：')
  console.error(err)
  process.exit(1)
})
