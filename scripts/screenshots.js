// 重新生成 README 用的界面截图（需要云环境可读）
const automator = require('miniprogram-automator')
const sleep = ms => new Promise(r => setTimeout(r, ms))

;(async () => {
  const mp = await automator.connect({
    wsEndpoint: process.argv[2] || 'ws://127.0.0.1:9420'
  })

  await mp.switchTab('/pages/home/index')
  await sleep(2500)
  await mp.screenshot({ path: 'docs/home-preview.png' })
  console.log('saved docs/home-preview.png')

  await mp.navigateTo('/pages/kitchen/index')
  await sleep(2500)
  await mp.screenshot({ path: 'docs/kitchen-prep.png' })
  console.log('saved docs/kitchen-prep.png')

  await mp.switchTab('/pages/home/index')
  await sleep(1200)
  await mp.evaluate(function () {
    const page = getCurrentPages()[getCurrentPages().length - 1]
    page.onSearchInput({ detail: { value: '饭' } })
  })
  await sleep(800)
  await mp.screenshot({ path: 'docs/search-result.png' })
  console.log('saved docs/search-result.png')

  await mp.disconnect()
  process.exit(0)
})().catch(err => {
  console.error('截图失败：', err)
  process.exit(1)
})
