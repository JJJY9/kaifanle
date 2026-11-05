// 云函数新版本验收：每日菜单保存/删除、下单、催单、取消
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
  const current = () => mp.currentPage()

  async function callCloud(action, payload, timeout = 12000) {
    await mp.evaluate(
      function (a, p) {
        const app = getApp()
        app.globalData.__acceptCall = { pending: true }
        wx.cloud.callFunction({
          name: 'api',
          data: { action: a, payload: p || {} },
          success: function (res) {
            app.globalData.__acceptCall = res.result || {
              ok: false,
              error: 'empty result'
            }
          },
          fail: function (err) {
            app.globalData.__acceptCall = {
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
        () => getApp().globalData.__acceptCall || null
      )
      if (res && !res.pending) {
        return res
      }
    }
    throw new Error('cloud call timeout: ' + action)
  }

  // 1. 管理员与菜单页
  const me = await callCloud('getMe')
  check(
    '管理员身份',
    me.ok && me.data && me.data.isAdmin,
    me.data && me.data.openid
  )

  await mp.switchTab('/pages/home/index')
  await sleep(1500)
  await mp.navigateTo('/pages/menu-edit/index')
  await sleep(2200)
  let page = await current()
  let data = await page.data()
  const meal = data.meal
  const eligible = (data.dishes || []).length
  const selected = Object.keys(data.selectedMap || {}).filter(
    id => data.selectedMap[id]
  ).length
  check('菜单编排加载', eligible > 0, `餐次=${meal} 可选=${eligible}`)

  await mp.evaluate(function () {
    const p = getCurrentPages()[getCurrentPages().length - 1]
    p.onSave()
  })
  await sleep(2000)
  const today = dateString(0)
  let menu = await callCloud('getMenuForDate', { date: today, meal })
  check(
    '菜单保存生效',
    menu.ok && menu.data.exists && menu.data.dishIds.length === selected,
    menu.data
      ? `exists=${menu.data.exists} 菜数=${menu.data.dishIds.length}/${selected}`
      : ''
  )

  // 首页按菜单过滤后应正常加载
  await sleep(800)
  page = await current()
  data = await page.data()
  const homeCount = (data.sections || []).reduce(
    (sum, section) => sum + section.dishes.length,
    0
  )
  check('首页按菜单展示', homeCount > 0, `${homeCount} 道菜`)

  // 2. 恢复默认（删除今日菜单）
  await mp.navigateTo('/pages/menu-edit/index')
  await sleep(2200)
  await mp.evaluate(function () {
    const p = getCurrentPages()[getCurrentPages().length - 1]
    p.onReset()
  })
  await sleep(2000)
  menu = await callCloud('getMenuForDate', { date: today, meal })
  check('恢复默认菜单', menu.ok && menu.data.exists === false)

  // 3. 下单 → 催单 → 取消
  const tomorrow = dateString(1)
  const order = await callCloud('createOrder', {
    items: [{ dishId: 'd01', qty: 1, specs: [], note: '' }],
    meal: 'lunch',
    expectedTime: '12:00',
    mode: '在家吃',
    note: '',
    scheduledDate: tomorrow
  })
  check('下单成功', order.ok && Boolean(order.data && order.data.id), order.data && '#' + order.data.no)
  if (order.ok && order.data) {
    const urge = await callCloud('urgeOrder', { id: order.data.id })
    check('催单成功', urge.ok && urge.data.urgeCount >= 1)
    const cancel = await callCloud('cancelOrder', { id: order.data.id })
    check(
      '取消订单',
      cancel.ok && cancel.data && cancel.data.status === 'cancelled'
    )
  }

  const failed = results.filter(r => !r.ok)
  console.log(`\n结论：${results.length - failed.length}/${results.length} 通过`)
  await mp.disconnect()
  process.exit(failed.length ? 1 : 0)
})().catch(err => {
  console.error('验收脚本异常：', err)
  process.exit(2)
})
