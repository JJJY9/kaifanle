const automator = require('miniprogram-automator')
const sleep = ms => new Promise(r => setTimeout(r, ms))

;(async () => {
  const mp = await automator.connect({ wsEndpoint: 'ws://127.0.0.1:9421' })
  await mp.mockWxMethod('showModal', {
    confirm: true,
    cancel: false,
    content: '明天晚餐'
  })

  // 我的
  await mp.switchTab('/pages/profile/index')
  await sleep(1500)
  let page = await mp.currentPage()
  let data = await page.data()
  console.log(
    'profile:',
    JSON.stringify({
      isAdmin: data.isAdmin,
      entries: (data.entries || []).map(e => e.key),
      stats: data.stats
    })
  )

  // 许愿池
  await mp.navigateTo('/pages/wishes/index')
  await sleep(1800)
  page = await mp.currentPage()
  data = await page.data()
  console.log('wishes initial:', data.wishes.length, 'isAdmin:', data.isAdmin)

  await mp.evaluate(function () {
    const current = getCurrentPages()[getCurrentPages().length - 1]
    current.setData({ content: '想吃火锅' })
    current.onSubmit()
  })
  await sleep(1200)
  data = await page.data()
  const newWish = (data.wishes || []).find(w => w.content === '想吃火锅')
  console.log('wish created:', !!newWish, newWish && newWish.status)
  await mp.screenshot({ path: 'docs/mock-01-wishes.png' })

  if (newWish) {
    await mp.evaluate(function (id) {
      const current = getCurrentPages()[getCurrentPages().length - 1]
      current.onPlan({ currentTarget: { dataset: { id } } })
    }, newWish.id)
    await sleep(900)
    data = await page.data()
    const planned = (data.wishes || []).find(w => w.id === newWish.id)
    console.log('wish planned:', planned && planned.status, planned && planned.plannedDate)

    await mp.evaluate(function (id) {
      const current = getCurrentPages()[getCurrentPages().length - 1]
      current.onDone({ currentTarget: { dataset: { id } } })
    }, newWish.id)
    await sleep(900)
    data = await page.data()
    const done = (data.wishes || []).find(w => w.id === newWish.id)
    console.log('wish done:', done && done.status)
  }

  // 爱心券
  await mp.navigateTo('/pages/coupons/index')
  await sleep(1600)
  page = await mp.currentPage()
  data = await page.data()
  console.log('coupons initial:', data.coupons.length, 'isAdmin:', data.isAdmin)

  await mp.evaluate(function () {
    const current = getCurrentPages()[getCurrentPages().length - 1]
    current.setData({ newTitle: '奶茶券', newNote: '测试发券' })
    current.onCreate()
  })
  await sleep(1200)
  data = await page.data()
  const coupon = (data.coupons || []).find(c => c.title === '奶茶券')
  console.log('coupon created:', !!coupon, coupon && coupon.statusText)
  await mp.screenshot({ path: 'docs/mock-02-coupons.png' })

  if (coupon) {
    await mp.evaluate(function (id) {
      const current = getCurrentPages()[getCurrentPages().length - 1]
      current.onClaim({ currentTarget: { dataset: { id } } })
    }, coupon.id)
    await sleep(900)
    data = await page.data()
    const claimed = (data.coupons || []).find(c => c.id === coupon.id)
    console.log('coupon claimed:', claimed && claimed.statusText, 'canUse:', claimed && claimed.canUse)

    await mp.evaluate(function (id) {
      const current = getCurrentPages()[getCurrentPages().length - 1]
      current.onUse({ currentTarget: { dataset: { id } } })
    }, coupon.id)
    await sleep(900)
    data = await page.data()
    const used = (data.coupons || []).find(c => c.id === coupon.id)
    console.log('coupon used:', used && used.statusText)

    await mp.evaluate(function (id) {
      const current = getCurrentPages()[getCurrentPages().length - 1]
      current.onDelete({ currentTarget: { dataset: { id } } })
    }, coupon.id)
    await sleep(900)
    data = await page.data()
    console.log(
      'coupon deleted:',
      !(data.coupons || []).some(c => c.id === coupon.id)
    )
  }

  // 口味与地址
  await mp.navigateTo('/pages/preferences/index')
  await sleep(1600)
  page = await mp.currentPage()
  await mp.evaluate(function () {
    const current = getCurrentPages()[getCurrentPages().length - 1]
    current.setData({
      dislikesText: '香菜',
      tastesText: '微辣',
      address: '家里'
    })
    current.onSave()
  })
  await sleep(1400)
  await mp.navigateTo('/pages/preferences/index')
  await sleep(1600)
  page = await mp.currentPage()
  data = await page.data()
  console.log('profile saved:', data.dislikesText, data.tastesText, data.address)

  await mp.restoreWxMethod('showModal')
  console.log('MOCK_UI_PART1_DONE')
  process.exit(0)
})().catch(e => {
  console.error('mock ui test failed:', e)
  process.exit(1)
})
