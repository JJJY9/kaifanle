const automator = require('miniprogram-automator')
const sleep = ms => new Promise(r => setTimeout(r, ms))

const TEMPLATE_ORDER_STATUS =
  'PULu2vsaJn2Ud9LwtWtCr5OdtZUJRAQBWo-AJiQ9wy0'

async function waitForPath(mp, path, timeout = 12000) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    const page = await mp.currentPage()
    if (page.path === path) return page
    await sleep(500)
  }
  return null
}

async function currentData(mp) {
  const page = await mp.currentPage()
  return { page, data: await page.data() }
}

;(async () => {
  const mp = await automator.connect({ wsEndpoint: 'ws://127.0.0.1:9420' })
  const exceptions = []
  mp.on('exception', e => exceptions.push(e))

  // 1. 首页 -> 结算
  await mp.switchTab('/pages/home/index')
  await sleep(1200)
  await mp.evaluate(function () {
    const pages = getCurrentPages()
    pages[pages.length - 1].onCheckout()
  })
  let checkout = await waitForPath(mp, 'pages/checkout/index')
  if (!checkout) throw new Error('未进入结算页')
  let data = await checkout.data()
  console.log(
    '结算页:',
    (data.lines || []).map(line => `${line.name} x${line.qty} ¥${line.lineTotal}`).join(' | '),
    '合计',
    data.total
  )

  // 写个备注方便识别测试订单
  await checkout.setData({ note: 'E2E 闭环测试' })

  // 2. 模拟订阅授权后提交订单
  await mp.mockWxMethod('requestSubscribeMessage', {
    [TEMPLATE_ORDER_STATUS]: 'accept'
  })
  await mp.evaluate(function () {
    const pages = getCurrentPages()
    pages[pages.length - 1].onSubmit()
  })
  const detailPage = await waitForPath(mp, 'pages/order-detail/index', 15000)
  if (!detailPage) {
    const current = await mp.currentPage()
    throw new Error('下单后未进入订单详情，当前页面: ' + current.path)
  }
  await sleep(1200)
  let detailData = await detailPage.data()
  const order = detailData.order
  if (!order) throw new Error('订单详情没有数据')
  console.log(
    '下单成功:',
    JSON.stringify({
      id: order.id,
      no: order.no,
      amount: order.amount,
      status: order.status,
      items: order.items.map(item => `${item.name} x${item.qty} ¥${item.price}`),
      note: order.note
    })
  )
  await mp.screenshot({ path: 'docs/e2e-05-order-detail.png' })
  await mp.restoreWxMethod('requestSubscribeMessage')

  // 3. 进入厨房端，推进状态 pending -> accepted -> cooking -> ready -> completed
  await mp.navigateTo('/pages/kitchen/index')
  let kitchen = await waitForPath(mp, 'pages/kitchen/index')
  if (!kitchen) throw new Error('未进入厨房端')
  await sleep(2200)

  const flow = ['pending', 'accepted', 'cooking', 'ready']
  for (const status of flow) {
    const kd = await (await mp.currentPage()).data()
    const target = (kd.orders || []).find(item => item.id === order.id)
    if (!target) throw new Error('厨房端找不到订单，当前状态: ' + status)
    console.log('厨房端当前状态:', target.status, '-> 推进')
    await mp.evaluate(function (id, currentStatus) {
      const pages = getCurrentPages()
      pages[pages.length - 1].onAdvance({
        currentTarget: { dataset: { id, status: currentStatus } }
      })
    }, order.id, target.status)
    await sleep(2200)
  }

  const kitchenAfter = await (await mp.currentPage()).data()
  console.log(
    '厨房端剩余待处理订单:',
    (kitchenAfter.orders || []).map(item => `${item.no}:${item.status}`).join(', ') || '无'
  )
  await mp.screenshot({ path: 'docs/e2e-06-kitchen.png' })

  // 4. 订单列表与详情时间轴
  await mp.switchTab('/pages/orders/index')
  await sleep(2500)
  let ordersPage = await mp.currentPage()
  let ordersData = await ordersPage.data()
  const found = (ordersData.orders || []).find(item => item.id === order.id)
  console.log(
    '订单列表:',
    (ordersData.orders || []).map(item => `${item.no}:${item.statusText}:¥${item.amount}`).join(' | ')
  )
  if (!found) throw new Error('订单列表里找不到测试订单')
  if (found.status !== 'completed') throw new Error('订单没有完成: ' + found.status)
  await mp.screenshot({ path: 'docs/e2e-07-orders.png' })

  await mp.navigateTo('/pages/order-detail/index?id=' + order.id)
  await sleep(2200)
  ordersPage = await mp.currentPage()
  const finalDetail = await ordersPage.data()
  console.log(
    '订单详情状态:',
    finalDetail.order && finalDetail.order.status,
    '时间轴:',
    (finalDetail.steps || []).map(step => `${step.title}${step.done ? '✓' : '·'}`).join(' > ')
  )
  await mp.screenshot({ path: 'docs/e2e-08-timeline.png' })

  // 5. 售罄切换：厨房下架 d09，首页应显示售罄，再恢复
  await mp.navigateTo('/pages/kitchen/index')
  await waitForPath(mp, 'pages/kitchen/index')
  await sleep(1800)
  await mp.evaluate(function () {
    const pages = getCurrentPages()
    pages[pages.length - 1].onToggleDish({
      currentTarget: { dataset: { id: 'd09' } }
    })
  })
  await sleep(1500)
  let kd = await (await mp.currentPage()).data()
  let dish = (kd.dishes || []).find(item => item.id === 'd09')
  console.log('厨房端 d09 状态:', dish && dish.status)

  await mp.switchTab('/pages/home/index')
  await sleep(2200)
  const home = await mp.currentPage()
  const homeData = await home.data()
  const homeDish = (homeData.sections || [])
    .flatMap(section => section.dishes)
    .find(item => item.id === 'd09')
  console.log('首页 d09 状态:', homeDish && homeDish.status)
  await mp.screenshot({ path: 'docs/e2e-09-soldout.png' })

  await mp.navigateTo('/pages/kitchen/index')
  await waitForPath(mp, 'pages/kitchen/index')
  await sleep(1600)
  await mp.evaluate(function () {
    const pages = getCurrentPages()
    pages[pages.length - 1].onToggleDish({
      currentTarget: { dataset: { id: 'd09' } }
    })
  })
  await sleep(1400)
  kd = await (await mp.currentPage()).data()
  dish = (kd.dishes || []).find(item => item.id === 'd09')
  console.log('恢复后 d09 状态:', dish && dish.status)

  console.log('exceptions:', JSON.stringify(exceptions.slice(-5)))
  process.exit(0)
})().catch(e => {
  console.error('E2E 失败:', e)
  process.exit(1)
})
