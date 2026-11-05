const automator = require('miniprogram-automator')
const sleep = ms => new Promise(r => setTimeout(r, ms))

;(async () => {
  const mp = await automator.connect({ wsEndpoint: 'ws://127.0.0.1:9420' })
  await mp.switchTab('/pages/home/index')
  await sleep(1200)

  // 进入结算页，逐条删除现有购物车，测试删除流程
  await mp.evaluate(function () {
    const pages = getCurrentPages()
    pages[pages.length - 1].onCheckout()
  })
  await sleep(1500)
  let page = await mp.currentPage()
  if (page.path === 'pages/checkout/index') {
    const data = await page.data()
    console.log(
      'existing cart:',
      (data.lines || []).map(line => `${line.name} x${line.qty} ¥${line.lineTotal}`).join(', '),
      'total',
      data.total
    )
    for (const line of data.lines || []) {
      await mp.evaluate(function (key) {
        const pages = getCurrentPages()
        pages[pages.length - 1].onRemove({
          currentTarget: { dataset: { key } }
        })
      }, line.key)
      await sleep(700)
    }
  }
  await sleep(800)
  page = await mp.currentPage()
  console.log('after remove, page:', page.path)
  const cleared = await page.data()
  console.log('cart after remove:', cleared.cartCount, cleared.cartTotal)

  // 分步重新加购，模拟真实点击节奏
  await mp.evaluate(function () {
    const pages = getCurrentPages()
    const current = pages[pages.length - 1]
    current.openSku(current.data.hero)
  })
  await sleep(600)
  await mp.evaluate(function () {
    const pages = getCurrentPages()
    const sheet = pages[pages.length - 1].selectComponent('#skuSheet')
    const dish = sheet.data.dish
    sheet.onSpicy({ currentTarget: { dataset: { index: 1 } } })
    sheet.onToggleAddon({
      currentTarget: { dataset: { id: dish.addons[0].id } }
    })
  })
  await sleep(500)
  await mp.evaluate(function () {
    const pages = getCurrentPages()
    pages[pages.length - 1].selectComponent('#skuSheet').onPlus()
  })
  await sleep(500)
  await mp.evaluate(function () {
    const pages = getCurrentPages()
    pages[pages.length - 1].selectComponent('#skuSheet').onConfirm()
  })
  await sleep(900)

  page = await mp.currentPage()
  const data = await page.data()
  console.log('cart after re-add:', data.cartCount, data.cartTotal)
  await mp.screenshot({ path: 'docs/e2e-04-cart-clean.png' })
  process.exit(0)
})().catch(e => { console.error(e); process.exit(1) })
