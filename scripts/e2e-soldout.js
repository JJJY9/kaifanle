const automator = require('miniprogram-automator')
const sleep = ms => new Promise(r => setTimeout(r, ms))

async function findHomeDish(mp, id) {
  const page = await mp.currentPage()
  const data = await page.data()
  const dish = (data.sections || [])
    .flatMap(section => section.dishes)
    .find(item => item.id === id)
  return dish ? dish.status : null
}

async function findKitchenDish(mp, id) {
  const page = await mp.currentPage()
  const data = await page.data()
  const dish = (data.dishes || []).find(item => item.id === id)
  return dish ? dish.status : null
}

;(async () => {
  const mp = await automator.connect({
    wsEndpoint: process.argv[2] || 'ws://127.0.0.1:9420'
  })

  await mp.switchTab('/pages/home/index')
  await sleep(2500)
  console.log('首页 d09 初始状态:', await findHomeDish(mp, 'd09'))

  await mp.navigateTo('/pages/kitchen/index')
  await sleep(2200)
  console.log('厨房 d09 初始状态:', await findKitchenDish(mp, 'd09'))
  await mp.evaluate(function () {
    const pages = getCurrentPages()
    pages[pages.length - 1].onToggleDish({
      currentTarget: { dataset: { id: 'd09' } }
    })
  })
  await sleep(1600)
  console.log('厨房切换到:', await findKitchenDish(mp, 'd09'))

  await mp.switchTab('/pages/home/index')
  await sleep(2600)
  console.log('切回首页后 d09:', await findHomeDish(mp, 'd09'))
  await mp.screenshot({ path: 'docs/e2e-10-soldout-sync.png' })

  await mp.navigateTo('/pages/kitchen/index')
  await sleep(2000)
  await mp.evaluate(function () {
    const pages = getCurrentPages()
    pages[pages.length - 1].onToggleDish({
      currentTarget: { dataset: { id: 'd09' } }
    })
  })
  await sleep(1600)
  console.log('厨房恢复为:', await findKitchenDish(mp, 'd09'))

  await mp.switchTab('/pages/home/index')
  await sleep(2400)
  console.log('首页最终 d09:', await findHomeDish(mp, 'd09'))
  process.exit(0)
})().catch(e => { console.error(e); process.exit(1) })
