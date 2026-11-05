const automator = require('miniprogram-automator')
const sleep = ms => new Promise(r => setTimeout(r, ms))

;(async () => {
  const mp = await automator.connect({ wsEndpoint: 'ws://127.0.0.1:9420' })
  const page = await mp.currentPage()
  const add = await page.$('.hero-add')
  console.log('heroAdd found:', !!add)
  if (add) await add.tap()
  await sleep(1200)
  const data = await page.data()
  console.log('skuVisible:', data.skuVisible, 'activeDish:', data.activeDish && data.activeDish.name)
  for (const sel of ['.chip', '.addon', '.confirm', 'sku-sheet', '.sheet', '.mask', '.stepper .step']) {
    const els = await page.$$(sel)
    console.log(sel, els.length)
  }
  await mp.screenshot({ path: 'docs/e2e-02-sku.png' })
  process.exit(0)
})().catch(e => { console.error(e); process.exit(1) })
