// 云端订单闭环验收：下单 → 催单 → 接单 → 开火 → 出锅 → 完成
const automator = require('miniprogram-automator')
const sleep = ms => new Promise(r => setTimeout(r, ms))

const results = []
function check(name, ok, detail) {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' · ' + detail : ''}`)
}

function dateString(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000)
  return (
    d.getFullYear() +
    '-' +
    String(d.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(d.getDate()).padStart(2, '0')
  )
}

;(async () => {
  const mp = await automator.connect({
    wsEndpoint: process.argv[2] || 'ws://127.0.0.1:9420'
  })
  await mp.mockWxMethod('showModal', {
    confirm: true,
    cancel: false,
    content: ''
  })
  await mp.mockWxMethod('requestSubscribeMessage', {
    'PULu2vsaJn2Ud9LwtWtCr5OdtZUJRAQBWo-AJiQ9wy0': 'accept'
  })

  async function callCloud(action, payload, timeout = 12000) {
    await mp.evaluate(
      function (a, p) {
        const app = getApp()
        app.globalData.__e2eCall = { pending: true }
        wx.cloud.callFunction({
          name: 'api',
          data: { action: a, payload: p || {} },
          success: function (res) {
            app.globalData.__e2eCall = res.result || {
              ok: false,
              error: 'empty result'
            }
          },
          fail: function (err) {
            app.globalData.__e2eCall = {
              ok: false,
              error: (err && err.errMsg) || String(err)
            }
          }
        })
      },
      action,
      payload
    )
    const started = Date.now()
    while (Date.now() - started < timeout) {
      await sleep(600)
      const res = await mp.evaluate(
        () => getApp().globalData.__e2eCall || null
      )
      if (res && !res.pending) {
        return res
      }
    }
    throw new Error('cloud call timeout: ' + action)
  }

  const today = dateString(0)
  const created = await callCloud('createOrder', {
    items: [{ dishId: 'd01', qty: 1, specs: [], note: '' }],
    meal: 'lunch',
    expectedTime: '12:00',
    mode: '在家吃',
    note: '',
    scheduledDate: today
  })
  check(
    '下单',
    created.ok && Boolean(created.data && created.data.id),
    created.data && '#' + created.data.no
  )
  if (!created.ok || !created.data) {
    throw new Error('下单失败：' + (created.error || 'unknown'))
  }
  const orderId = created.data.id

  const urged = await callCloud('urgeOrder', { id: orderId })
  check('催单', urged.ok && urged.data.urgeCount === 1)

  let current = created.data
  for (const status of ['accepted', 'cooking', 'ready', 'completed']) {
    const res = await callCloud('updateOrderStatus', {
      id: orderId,
      status
    })
    if (!res.ok) {
      check('状态流转 ' + status, false, res.error)
      throw new Error('状态流转失败：' + res.error)
    }
    current = res.data
    check('状态流转 ' + status, current.status === status)
  }
  check('时间轴完整', (current.timeline || []).length === 5)

  // 订单详情页展示完成状态
  await mp.switchTab('/pages/home/index')
  await sleep(1200)
  await mp.navigateTo('/pages/order-detail/index?id=' + orderId)
  await sleep(2200)
  const page = await mp.currentPage()
  const data = await page.data()
  check(
    '订单详情展示',
    Boolean(data.order) && data.order.status === 'completed',
    data.order && '#' + data.order.no + ' ' + data.statusText
  )
  check('时间轴步骤', (data.steps || []).length === 5, `${(data.steps || []).length} 步`)

  const failed = results.filter(r => !r.ok)
  console.log(`\n结论：${results.length - failed.length}/${results.length} 通过`)
  await mp.disconnect()
  process.exit(failed.length ? 1 : 0)
})().catch(err => {
  console.error('订单闭环验收异常：', err)
  process.exit(2)
})
