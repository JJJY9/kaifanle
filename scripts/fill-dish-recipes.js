// 给线上已有菜品补充做法（只填空缺，不覆盖手写做法）
// 用法：node scripts/fill-dish-recipes.js ws://127.0.0.1:9420
const automator = require('miniprogram-automator')
const seed = require('../cloudfunctions/api/seed')

const sleep = ms => new Promise(r => setTimeout(r, ms))

;(async () => {
  const mp = await automator.connect({
    wsEndpoint: process.argv[2] || 'ws://127.0.0.1:9420'
  })

  async function callCloud(action, payload, timeout = 12000) {
    await mp.evaluate(
      function (a, p) {
        const app = getApp()
        app.globalData.__fillCall = { pending: true }
        wx.cloud.callFunction({
          name: 'api',
          data: { action: a, payload: p || {} },
          success: function (res) {
            app.globalData.__fillCall = res.result || {
              ok: false,
              error: 'empty result'
            }
          },
          fail: function (err) {
            app.globalData.__fillCall = {
              ok: false,
              error: (err && err.errMsg) || String(err)
            }
          }
        })
      },
      action,
      payload
    )
    const started = Date.now()
    while (Date.now() - started < timeout) {
      await sleep(600)
      const res = await mp.evaluate(
        () => getApp().globalData.__fillCall || null
      )
      if (res && !res.pending) {
        return res
      }
    }
    throw new Error('cloud call timeout: ' + action)
  }

  const dishesRes = await callCloud('getDishes')
  if (!dishesRes.ok) {
    console.error('读取菜品失败：', dishesRes.error)
    process.exit(1)
  }
  const recipes = {}
  seed.dishes.forEach(dish => {
    if (dish.recipe) {
      recipes[dish.name] = dish.recipe
    }
  })

  let filled = 0
  let skipped = 0
  let custom = 0
  for (const dish of dishesRes.data) {
    const recipe = recipes[dish.name]
    if (!recipe) {
      skipped++
      continue
    }
    if (dish.recipe) {
      custom++
      continue
    }
    const res = await callCloud('saveDish', {
      id: dish.id,
      name: dish.name,
      desc: dish.desc,
      price: dish.price,
      categoryId: dish.categoryId,
      tags: dish.tags || [],
      spicyLevels: dish.spicyLevels || [],
      addons: dish.addons || [],
      color: dish.color,
      meals: dish.meals,
      status: dish.status,
      stock: typeof dish.stock === 'number' ? dish.stock : -1,
      isRecommended: Boolean(dish.isRecommended),
      image: dish.image || '',
      recipe
    })
    if (!res.ok) {
      console.error(`「${dish.name}」补充失败：`, res.error)
      process.exit(1)
    }
    filled++
    console.log(`已补充做法：${dish.name}`)
  }

  console.log(
    `完成：补充 ${filled} 道，已有做法 ${custom} 道，无匹配模板 ${skipped} 道`
  )
  await mp.disconnect()
  process.exit(0)
})().catch(err => {
  console.error('补充做法失败：', err)
  process.exit(2)
})
