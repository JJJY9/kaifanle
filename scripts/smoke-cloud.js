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
  }
}

function matches(doc, cond) {
  return Object.keys(cond).every(key => {
    const expected = cond[key]
    const actual = doc[key]
    if (expected && expected.__op === 'in') {
      return expected.values.indexOf(actual) > -1
    }
    return actual === expected
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
          Object.keys(data).forEach(key => {
            const value = data[key]
            if (value && value.__op === 'push') {
              doc[key] = (doc[key] || []).concat(value.values)
            } else {
              doc[key] = value
            }
          })
          return { stats: { updated: 1 } }
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

  res = await call('getCategories', {}, 'girl-openid')
  assert.strictEqual(res.ok, true)
  assert.strictEqual(res.data.length, 5)

  res = await call('getDishes', {}, 'girl-openid')
  assert.strictEqual(res.ok, true)
  assert.strictEqual(res.data.length, 14)

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

  console.log(
    '云函数冒烟测试通过：初始化、菜单、下单计价、权限、状态流转、售罄拦截、订阅消息。'
  )
}

run().catch(err => {
  console.error('云函数冒烟测试失败：')
  console.error(err)
  process.exit(1)
})
