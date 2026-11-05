const automator = require('miniprogram-automator')
const sleep = ms => new Promise(r => setTimeout(r, ms))

;(async () => {
  const mp = await automator.connect({ wsEndpoint: 'ws://127.0.0.1:9420' })
  await mp.switchTab('/pages/home/index')
  await sleep(1500)
  const page = await mp.currentPage()

  await mp.evaluate(function () {
    const pages = getCurrentPages()
    const current = pages[pages.length - 1]
    current.openSku(current.data.hero)
  })
  await sleep(600)

  const result = await mp.evaluate(function () {
    const pages = getCurrentPages()
    const current = pages[pages.length - 1]
    const sheet = current.selectComponent('#skuSheet')
    if (!sheet) return { error: 'skuSheet not found' }
    const dish = sheet.data.dish
    if (!dish) return { error: 'dish missing' }
    const spicy = dish.spicyLevels.length > 1 ? 1 : 0
    sheet.onSpicy({ currentTarget: { dataset: { index: spicy } } })
    if (dish.addons.length) {
      sheet.onToggleAddon({
        currentTarget: { dataset: { id: dish.addons[0].id } }
      })
    }
    sheet.onPlus()
    sheet.onConfirm()
    return {
      dish: dish.name,
      spicy: dish.spicyLevels[spicy] || '',
      addon: dish.addons[0] ? dish.addons[0].name : '',
      qty: sheet.data.qty
    }
  })
  console.log('sku actions:', JSON.stringify(result))
  await sleep(900)

  const data = await page.data()
  console.log('skuVisible:', data.skuVisible)
  console.log('cartCount:', data.cartCount, 'cartTotal:', data.cartTotal)
  await mp.screenshot({ path: 'docs/e2e-03-cart.png' })
  process.exit(0)
})().catch(e => { console.error(e); process.exit(1) })
