const automator = require('miniprogram-automator')
const sleep = ms => new Promise(r => setTimeout(r, ms))

;(async () => {
  const mp = await automator.connect({
    wsEndpoint: process.argv[2] || 'ws://127.0.0.1:9420'
  })

  await mp.navigateTo('/pages/kitchen/index')
  await sleep(2200)
  let page = await mp.currentPage()
  let data = await page.data()
  console.log(
    'kitchen initial:',
    JSON.stringify({
      dishes: (data.dishes || []).length,
      activeOrders: (data.orders || []).length,
      stats: data.stats
    })
  )

  await mp.evaluate(function () {
    const current = getCurrentPages()[getCurrentPages().length - 1]
    current.onAddDish()
  })
  await sleep(1800)
  page = await mp.currentPage()
  console.log('dish edit page:', page.path)
  await page.setData({
    name: '云端验收菜',
    desc: '云端验收用',
    price: '11',
    stock: '5',
    categoryId: 'stirfry',
    selectedMeals: ['lunch', 'dinner'],
    mealChecked: { lunch: true, dinner: true },
    tagsText: '验收',
    spicyText: '微辣',
    status: 'on',
    colorIndex: 2,
    isRecommended: false
  })
  await mp.evaluate(function () {
    const current = getCurrentPages()[getCurrentPages().length - 1]
    current.onSave()
  })
  await sleep(2400)
  page = await mp.currentPage()
  data = await page.data()
  let dish = (data.dishes || []).find(d => d.name === '云端验收菜')
  console.log(
    'dish created:',
    !!dish,
    dish && JSON.stringify({ id: dish.id, price: dish.price, stock: dish.stock })
  )

  if (dish) {
    await mp.navigateTo('/pages/dish-edit/index?id=' + dish.id)
    await sleep(1800)
    page = await mp.currentPage()
    data = await page.data()
    console.log('edit loaded:', data.name, data.price, data.stock)
    await page.setData({ price: '13', stock: '8', desc: '云端验收用（已改）' })
    await mp.evaluate(function () {
      const current = getCurrentPages()[getCurrentPages().length - 1]
      current.onSave()
    })
    await sleep(2400)
    page = await mp.currentPage()
    data = await page.data()
    dish = (data.dishes || []).find(d => d.name === '云端验收菜')
    console.log('dish updated:', dish && dish.price, dish && dish.stock)
  }

  console.log('CLOUD_DISH_DONE')
  process.exit(0)
})().catch(e => {
  console.error('cloud dish test failed:', e)
  process.exit(1)
})
