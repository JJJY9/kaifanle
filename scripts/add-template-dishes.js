// 把菜品模板库一键补进云端菜单（管理员账号）
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

  await mp.navigateTo('/pages/dish-templates/index')
  await sleep(2500)
  let page = await mp.currentPage()
  let data = await page.data()
  console.log(
    `模板 ${(data.templates || []).length} 道，缺失 ${data.missingCount} 道`
  )

  if (data.missingCount > 0) {
    await mp.evaluate(function () {
      const current = getCurrentPages()[getCurrentPages().length - 1]
      current.onAddAll()
    })
    for (let i = 0; i < 300; i++) {
      await sleep(2000)
      page = await mp.currentPage()
      data = await page.data()
      console.log(
        `进度：剩余 ${data.missingCount} 道 ${data.addingText || ''}`
      )
      if (!data.adding && data.missingCount === 0) {
        break
      }
    }
  }

  console.log(`完成：剩余 ${data.missingCount} 道未添加`)
  await mp.disconnect()
  process.exit(data.missingCount === 0 ? 0 : 1)
})().catch(err => {
  console.error('添加模板菜品失败：', err)
  process.exit(2)
})
