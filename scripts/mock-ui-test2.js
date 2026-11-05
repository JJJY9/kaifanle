const automator = require('miniprogram-automator')
const sleep = ms => new Promise(r => setTimeout(r, ms))

;(async () => {
  const mp = await automator.connect({
    wsEndpoint: process.argv[2] || 'ws://127.0.0.1:9421'
  })
  await mp.mockWxMethod('showModal', {
    confirm: true,
    cancel: false,
    content: ''
  })

  // 厨房
  await mp.navigateTo('/pages/kitchen/index')
  await sleep(2200)
  let page = await mp.currentPage()
  let data = await page.data()
  console.log(
    'kitchen:',
    JSON.stringify({
      dishes: (data.dishes || []).length,
      activeOrders: (data.orders || []).length,
      stats: data.stats
    })
  )

  // 新增菜品
  await mp.evaluate(function () {
    const current = getCurrentPages()[getCurrentPages().length - 1]
    current.onAddDish()
  })
  await sleep(1800)
  page = await mp.currentPage()
  console.log('dish edit page:', page.path)
  await page.setData({
    name: '自动化小炒',
    desc: '测试菜品',
    price: '12',
    stock: '6',
    categoryId: 'stirfry',
    selectedMeals: ['lunch', 'dinner'],
    mealChecked: { lunch: true, dinner: true },
    tagsText: '测试',
    spicyText: '微辣',
    status: 'on',
    colorIndex: 1,
    isRecommended: false
  })
  await mp.evaluate(function () {
    const current = getCurrentPages()[getCurrentPages().length - 1]
    current.onSave()
  })
  await sleep(2200)
  page = await mp.currentPage()
  console.log('after create page:', page.path)
  data = await page.data()
  let newDish = (data.dishes || []).find(d => d.name === '自动化小炒')
  console.log(
    'dish created:',
    !!newDish,
    newDish && JSON.stringify({ id: newDish.id, price: newDish.price, stock: newDish.stock, status: newDish.status })
  )
  await mp.screenshot({ path: 'docs/mock-03-kitchen.png' })

  if (newDish) {
    // 编辑
    await mp.navigateTo('/pages/dish-edit/index?id=' + newDish.id)
    await sleep(1800)
    page = await mp.currentPage()
    data = await page.data()
    console.log('dish edit loaded:', data.name, data.price, data.stock)
    await page.setData({ price: '15', stock: '9' })
    await mp.evaluate(function () {
      const current = getCurrentPages()[getCurrentPages().length - 1]
      current.onSave()
    })
    await sleep(2200)
    page = await mp.currentPage()
    data = await page.data()
    newDish = (data.dishes || []).find(d => d.name === '自动化小炒')
    console.log('dish updated:', newDish && newDish.price, newDish && newDish.stock)

    // 删除
    await mp.navigateTo('/pages/dish-edit/index?id=' + newDish.id)
    await sleep(1800)
    await mp.evaluate(function () {
      const current = getCurrentPages()[getCurrentPages().length - 1]
      current.onDelete()
    })
    await sleep(2200)
    page = await mp.currentPage()
    data = await page.data()
    console.log(
      'dish deleted:',
      !(data.dishes || []).some(d => d.name === '自动化小炒')
    )
  }

  // 营业设置：关掉晚餐
  await mp.navigateTo('/pages/business/index')
  await sleep(1800)
  page = await mp.currentPage()
  data = await page.data()
  console.log(
    'business initial:',
    (data.mealViews || []).map(v => `${v.id}:${v.open}:${v.deadline}`).join(', ')
  )
  await mp.evaluate(function () {
    const current = getCurrentPages()[getCurrentPages().length - 1]
    const views = current.data.mealViews.slice()
    const index = views.findIndex(v => v.id === 'dinner')
    views[index].open = false
    current.setData({ mealViews: views })
    current.onSave()
  })
  await sleep(1800)
  await mp.switchTab('/pages/home/index')
  await sleep(1800)
  page = await mp.currentPage()
  await mp.evaluate(function () {
    const current = getCurrentPages()[getCurrentPages().length - 1]
    current.setData({ selectedMeal: 'dinner' })
    current.loadMenu()
  })
  await sleep(1500)
  data = await page.data()
  console.log(
    'home dinner closed:',
    JSON.stringify({ isOpen: data.isOpen, notice: data.mealNotice })
  )
  await mp.screenshot({ path: 'docs/mock-04-business-closed.png' })

  // 恢复晚餐
  await mp.navigateTo('/pages/business/index')
  await sleep(1800)
  await mp.evaluate(function () {
    const current = getCurrentPages()[getCurrentPages().length - 1]
    const views = current.data.mealViews.slice()
    const index = views.findIndex(v => v.id === 'dinner')
    views[index].open = true
    current.setData({ mealViews: views })
    current.onSave()
  })
  await sleep(1800)
  await mp.switchTab('/pages/home/index')
  await sleep(1500)
  page = await mp.currentPage()
  data = await page.data()
  console.log('home dinner restored:', data.isOpen, data.mealNotice)

  await mp.restoreWxMethod('showModal')
  console.log('MOCK_UI_PART2_DONE')
  process.exit(0)
})().catch(e => {
  console.error('mock ui part2 failed:', e)
  process.exit(1)
})
