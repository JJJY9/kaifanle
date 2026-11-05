const automator = require('miniprogram-automator')
const sleep = ms => new Promise(r => setTimeout(r, ms))

;(async () => {
  const mp = await automator.connect({
    wsEndpoint: process.argv[2] || 'ws://127.0.0.1:9420'
  })
  await mp.mockWxMethod('showModal', {
    confirm: true,
    cancel: false,
    content: '明天晚餐'
  })

  // 许愿池
  await mp.navigateTo('/pages/wishes/index')
  await sleep(1800)
  let page = await mp.currentPage()
  let data = await page.data()
  console.log('wishes initial:', (data.wishes || []).length)

  await mp.evaluate(function () {
    const current = getCurrentPages()[getCurrentPages().length - 1]
    current.setData({ content: '云端验收许愿' })
    current.onSubmit()
  })
  await sleep(1400)
  data = await page.data()
  const wish = (data.wishes || []).find(w => w.content === '云端验收许愿')
  console.log('wish created:', !!wish, wish && wish.status)
  if (wish) {
    await mp.evaluate(function (id) {
      const current = getCurrentPages()[getCurrentPages().length - 1]
      current.onPlan({ currentTarget: { dataset: { id } } })
    }, wish.id)
    await sleep(1200)
    data = await page.data()
    const planned = (data.wishes || []).find(w => w.id === wish.id)
    console.log('wish planned:', planned && planned.status, planned && planned.plannedDate)
    await mp.evaluate(function (id) {
      const current = getCurrentPages()[getCurrentPages().length - 1]
      current.onDone({ currentTarget: { dataset: { id } } })
    }, wish.id)
    await sleep(1200)
    data = await page.data()
    const done = (data.wishes || []).find(w => w.id === wish.id)
    console.log('wish done:', done && done.status)
  }
  await mp.screenshot({ path: 'docs/cloud-01-wishes.png' })

  // 爱心券
  await mp.navigateTo('/pages/coupons/index')
  await sleep(1600)
  page = await mp.currentPage()
  data = await page.data()
  console.log('coupons initial:', (data.coupons || []).length)
  await mp.evaluate(function () {
    const current = getCurrentPages()[getCurrentPages().length - 1]
    current.setData({ newTitle: '云端验收券', newNote: '验收用' })
    current.onCreate()
  })
  await sleep(1400)
  data = await page.data()
  const coupon = (data.coupons || []).find(c => c.title === '云端验收券')
  console.log('coupon created:', !!coupon, coupon && coupon.statusText)
  if (coupon) {
    await mp.evaluate(function (id) {
      const current = getCurrentPages()[getCurrentPages().length - 1]
      current.onClaim({ currentTarget: { dataset: { id } } })
    }, coupon.id)
    await sleep(1000)
    data = await page.data()
    console.log(
      'coupon claimed:',
      (data.coupons || []).find(c => c.id === coupon.id).statusText
    )
    await mp.evaluate(function (id) {
      const current = getCurrentPages()[getCurrentPages().length - 1]
      current.onUse({ currentTarget: { dataset: { id } } })
    }, coupon.id)
    await sleep(1000)
    data = await page.data()
    console.log(
      'coupon used:',
      (data.coupons || []).find(c => c.id === coupon.id).statusText
    )
    await mp.evaluate(function (id) {
      const current = getCurrentPages()[getCurrentPages().length - 1]
      current.onDelete({ currentTarget: { dataset: { id } } })
    }, coupon.id)
    await sleep(1000)
    data = await page.data()
    console.log(
      'coupon deleted:',
      !(data.coupons || []).some(c => c.id === coupon.id)
    )
  }
  await mp.screenshot({ path: 'docs/cloud-02-coupons.png' })

  // 口味与地址
  await mp.navigateTo('/pages/preferences/index')
  await sleep(1600)
  await mp.evaluate(function () {
    const current = getCurrentPages()[getCurrentPages().length - 1]
    current.setData({
      dislikesText: '香菜',
      tastesText: '微辣',
      address: '云端验收地址'
    })
    current.onSave()
  })
  await sleep(1500)
  await mp.navigateTo('/pages/preferences/index')
  await sleep(1600)
  page = await mp.currentPage()
  data = await page.data()
  console.log(
    'profile saved:',
    data.dislikesText,
    data.tastesText,
    data.address
  )
  await mp.screenshot({ path: 'docs/cloud-03-preferences.png' })

  await mp.restoreWxMethod('showModal')
  console.log('CLOUD_SOCIAL_DONE')
  process.exit(0)
})().catch(e => {
  console.error('cloud social test failed:', e)
  process.exit(1)
})
