const automator = require('miniprogram-automator')
const sleep = ms => new Promise(r => setTimeout(r, ms))

const TEMPLATE_ORDER_STATUS =
  'PULu2vsaJn2Ud9LwtWtCr5OdtZUJRAQBWo-AJiQ9wy0'

function dateInput(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

async function currentData(mp) {
  const page = await mp.currentPage()
  return { page, data: await page.data() }
}

;(async () => {
  const mp = await automator.connect({
    wsEndpoint: process.argv[2] || 'ws://127.0.0.1:9420'
  })
  await mp.mockWxMethod('requestSubscribeMessage', {
    [TEMPLATE_ORDER_STATUS]: 'accept'
  })

  // 清空可能残留的购物车
  await mp.switchTab('/pages/home/index')
  await sleep(1600)
  let { page, data } = await currentData(mp)
  if (data.cartCount > 0) {
    await mp.evaluate(function () {
      const current = getCurrentPages()[getCurrentPages().length - 1]
      current.onCheckout()
    })
    await sleep(1600)
    ;({ page, data } = await currentData(mp))
    for (const line of data.lines || []) {
      await mp.evaluate(function (key) {
        const current = getCurrentPages()[getCurrentPages().length - 1]
        current.onRemove({ currentTarget: { dataset: { key } } })
      }, line.key)
      await sleep(800)
    }
  }
  await mp.switchTab('/pages/home/index')
  await sleep(1400)

  // 选晚餐，找到云端验收菜
  await mp.evaluate(function () {
    const current = getCurrentPages()[getCurrentPages().length - 1]
    current.setData({ selectedMeal: 'dinner' })
    current.loadMenu()
  })
  await sleep(1800)
  ;({ page, data } = await currentData(mp))
  const dish = (data.sections || [])
    .flatMap(section => section.dishes)
    .find(item => item.name === '云端验收菜')
  console.log('test dish on home:', !!dish, dish && JSON.stringify({ price: dish.price, stock: dish.stock }))
  if (!dish) throw new Error('首页找不到云端验收菜')

  // 加购
  await mp.evaluate(function (target) {
    const current = getCurrentPages()[getCurrentPages().length - 1]
    current.openSku(target)
  }, dish)
  await sleep(800)
  await mp.evaluate(function () {
    const current = getCurrentPages()[getCurrentPages().length - 1]
    const sheet = current.selectComponent('#skuSheet')
    sheet.onSpicy({ currentTarget: { dataset: { index: 0 } } })
    sheet.onConfirm()
  })
  await sleep(1000)
  ;({ page, data } = await currentData(mp))
  console.log('cart after add:', data.cartCount, data.cartTotal)

  // 结算
  await mp.evaluate(function () {
    const current = getCurrentPages()[getCurrentPages().length - 1]
    current.onCheckout()
  })
  await sleep(1800)
  ;({ page, data } = await currentData(mp))
  console.log('checkout page:', page.path, 'total:', data.total, 'address prefill:', data.address)

  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowString = dateInput(tomorrow)
  await mp.evaluate(function (value) {
    const current = getCurrentPages()[getCurrentPages().length - 1]
    current.onDateChange({ detail: { value } })
  }, tomorrowString)
  await sleep(600)
  await mp.evaluate(function () {
    const current = getCurrentPages()[getCurrentPages().length - 1]
    current.onModeSelect({ currentTarget: { dataset: { index: 1 } } })
    current.onNote({ detail: { value: '云端验收订单' } })
    current.setData({ address: '云端验收地址' })
  })
  await sleep(500)
  ;({ page, data } = await currentData(mp))
  console.log('checkout date:', data.scheduledDate, data.dateDisplay, 'closed:', data.closed)

  await mp.evaluate(function () {
    const current = getCurrentPages()[getCurrentPages().length - 1]
    current.onSubmit()
  })
  let detail = null
  for (let i = 0; i < 24; i++) {
    await sleep(700)
    const current = await mp.currentPage()
    if (current.path === 'pages/order-detail/index') {
      detail = current
      break
    }
  }
  if (!detail) throw new Error('未进入订单详情')
  await sleep(1500)
  data = await detail.data()
  const order = data.order
  console.log(
    'order created:',
    JSON.stringify({
      id: order.id,
      no: order.no,
      amount: order.amount,
      status: order.status,
      scheduledDate: order.scheduledDate,
      scheduledText: order.scheduledText,
      address: order.address,
      profileText: order.profileText,
      items: order.items.map(item => ({
        name: item.name,
        qty: item.qty,
        specText: item.specText
      }))
    })
  )
  await mp.screenshot({ path: 'docs/cloud-04-order-detail.png' })

  // 厨房详情与状态流转
  await mp.navigateTo('/pages/kitchen/index')
  await sleep(2200)
  ;({ page, data } = await currentData(mp))
  let kitchenOrder = (data.orders || []).find(item => item.id === order.id)
  console.log(
    'kitchen order details:',
    kitchenOrder &&
      JSON.stringify({
        dateText: kitchenOrder.dateText,
        itemLines: kitchenOrder.itemLines,
        profileText: kitchenOrder.profileText,
        address: kitchenOrder.address,
        note: kitchenOrder.note
      })
  )
  await mp.screenshot({ path: 'docs/cloud-05-kitchen-order.png' })

  for (let i = 0; i < 4; i++) {
    ;({ page, data } = await currentData(mp))
    kitchenOrder = (data.orders || []).find(item => item.id === order.id)
    if (!kitchenOrder) break
    console.log('advance from:', kitchenOrder.status)
    await mp.evaluate(function (id, status) {
      const current = getCurrentPages()[getCurrentPages().length - 1]
      current.onAdvance({
        currentTarget: { dataset: { id, status } }
      })
    }, order.id, kitchenOrder.status)
    await sleep(2300)
  }
  ;({ page, data } = await currentData(mp))
  console.log(
    'kitchen remaining:',
    (data.orders || []).length
  )

  // 订单列表
  await mp.switchTab('/pages/orders/index')
  await sleep(2200)
  ;({ page, data } = await currentData(mp))
  const listed = (data.orders || []).find(item => item.id === order.id)
  console.log(
    'order list:',
    listed &&
      JSON.stringify({
        status: listed.status,
        statusText: listed.statusText,
        dateText: listed.dateText,
        amount: listed.amount
      })
  )
  await mp.screenshot({ path: 'docs/cloud-06-orders.png' })

  // 清理：删除测试菜品
  await mp.navigateTo('/pages/kitchen/index')
  await sleep(1800)
  ;({ page, data } = await currentData(mp))
  const cleanupDish = (data.dishes || []).find(d => d.name === '云端验收菜')
  if (cleanupDish) {
    await mp.mockWxMethod('showModal', { confirm: true, cancel: false })
    await mp.navigateTo('/pages/dish-edit/index?id=' + cleanupDish.id)
    await sleep(1600)
    await mp.evaluate(function () {
      const current = getCurrentPages()[getCurrentPages().length - 1]
      current.onDelete()
    })
    await sleep(1800)
    await mp.navigateTo('/pages/kitchen/index')
    await sleep(1600)
    ;({ page, data } = await currentData(mp))
    console.log(
      'test dish cleaned:',
      !(data.dishes || []).some(d => d.name === '云端验收菜')
    )
  }

  // 还原口味档案
  await mp.navigateTo('/pages/preferences/index')
  await sleep(1500)
  await mp.evaluate(function () {
    const current = getCurrentPages()[getCurrentPages().length - 1]
    current.setData({ dislikesText: '', tastesText: '', address: '' })
    current.onSave()
  })
  await sleep(1200)

  await mp.restoreWxMethod('showModal')
  await mp.restoreWxMethod('requestSubscribeMessage')
  console.log('CLOUD_ORDER_DONE')
  process.exit(0)
})().catch(e => {
  console.error('cloud order test failed:', e)
  process.exit(1)
})
