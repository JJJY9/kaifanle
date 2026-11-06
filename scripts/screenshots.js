// 重新生成 README 用的界面截图（需要云环境可读）
const automator = require('miniprogram-automator')
const sleep = ms => new Promise(r => setTimeout(r, ms))

;(async () => {
  const mp = await automator.connect({
    wsEndpoint: process.argv[2] || 'ws://127.0.0.1:9420'
  })
  await mp.mockWxMethod('showModal', {
    confirm: true,
    cancel: false,
    content: ''
  })

  // 清空测试遗留的购物车（先切到午餐，避免早餐已截单导致进不了结算页）
  await mp.switchTab('/pages/home/index')
  await sleep(1600)
  await mp.evaluate(function () {
    const current = getCurrentPages()[getCurrentPages().length - 1]
    current.onSelectMeal({ currentTarget: { dataset: { meal: 'lunch' } } })
  })
  await sleep(1600)
  let page = await mp.currentPage()
  let data = await page.data()
  if (data.cartCount > 0) {
    await mp.evaluate(function () {
      const current = getCurrentPages()[getCurrentPages().length - 1]
      current.onCheckout()
    })
    await sleep(1400)
    const checkoutPage = await mp.currentPage()
    if (checkoutPage.path === 'pages/checkout/index') {
      await mp.evaluate(function () {
        const current = getCurrentPages()[getCurrentPages().length - 1]
        current.onClearCart()
      })
      await sleep(1400)
    }
  }
  await mp.switchTab('/pages/home/index')
  await sleep(1200)
  await mp.evaluate(function () {
    const current = getCurrentPages()[getCurrentPages().length - 1]
    current.onClearSearch()
  })
  await sleep(400)
  await mp.evaluate(function () {
    const current = getCurrentPages()[getCurrentPages().length - 1]
    current.onSelectMeal({ currentTarget: { dataset: { meal: 'lunch' } } })
  })
  await sleep(1800)
  await mp.screenshot({ path: 'docs/home-preview.png' })
  console.log('saved docs/home-preview.png')

  await mp.navigateTo('/pages/kitchen/index')
  await sleep(2500)
  await mp.screenshot({ path: 'docs/kitchen-prep.png' })
  console.log('saved docs/kitchen-prep.png')

  await mp.switchTab('/pages/home/index')
  await sleep(1500)
  await mp.evaluate(function () {
    const page = getCurrentPages()[getCurrentPages().length - 1]
    page.onSearchInput({ detail: { value: '饭' } })
  })
  await sleep(800)
  await mp.screenshot({ path: 'docs/search-result.png' })
  console.log('saved docs/search-result.png')

  await mp.evaluate(function () {
    const page = getCurrentPages()[getCurrentPages().length - 1]
    page.onClearSearch()
  })
  await mp.disconnect()
  process.exit(0)
})().catch(err => {
  console.error('截图失败：', err)
  process.exit(1)
})
