// 菜品图片上传验收：写入临时图片 → 上传云存储 → 保存到菜品 → 还原
const automator = require('miniprogram-automator')
const sleep = ms => new Promise(r => setTimeout(r, ms))

const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

const results = []
function check(name, ok, detail) {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' · ' + detail : ''}`)
}

;(async () => {
  const mp = await automator.connect({
    wsEndpoint: process.argv[2] || 'ws://127.0.0.1:9420'
  })

  async function callCloud(action, payload, timeout = 12000) {
    await mp.evaluate(
      function (a, p) {
        const app = getApp()
        app.globalData.__imgCall = { pending: true }
        wx.cloud.callFunction({
          name: 'api',
          data: { action: a, payload: p || {} },
          success: function (res) {
            app.globalData.__imgCall = res.result || {
              ok: false,
              error: 'empty result'
            }
          },
          fail: function (err) {
            app.globalData.__imgCall = {
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
        () => getApp().globalData.__imgCall || null
      )
      if (res && !res.pending) {
        return res
      }
    }
    throw new Error('cloud call timeout: ' + action)
  }

  // 1. 在开发者工具沙盒里写一张 1x1 PNG 并上传
  await mp.evaluate(function (base64) {
    const app = getApp()
    const filePath = `${wx.env.USER_DATA_PATH}/dish-image-test.png`
    const fs = wx.getFileSystemManager()
    fs.writeFileSync(filePath, base64, 'base64')
    app.globalData.__imageUpload = { pending: true }
    wx.cloud.uploadFile({
      cloudPath: `dishes/test-${Date.now()}.png`,
      filePath,
      success: res => {
        app.globalData.__imageUpload = { ok: true, fileID: res.fileID }
      },
      fail: err => {
        app.globalData.__imageUpload = {
          ok: false,
          error: (err && err.errMsg) || String(err)
        }
      }
    })
  }, PNG_BASE64)
  let upload = null
  for (let i = 0; i < 20; i++) {
    await sleep(800)
    upload = await mp.evaluate(() => getApp().globalData.__imageUpload || null)
    if (upload && !upload.pending) {
      break
    }
  }
  check('图片上传云存储', Boolean(upload && upload.ok), upload && upload.fileID)
  if (!upload || !upload.ok) {
    process.exit(1)
  }

  // 2. 保存到菜品
  const dishRes = await callCloud('getDish', { id: 'd01' })
  const dish = dishRes.data
  const payload = {
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
    recipe: dish.recipe || '',
    image: upload.fileID
  }
  let saved = await callCloud('saveDish', payload)
  check('菜品保存图片', saved.ok && saved.data.image === upload.fileID)
  let fresh = await callCloud('getDish', { id: 'd01' })
  check('菜品读取图片', fresh.ok && fresh.data.image === upload.fileID)

  // 3. 首页展示（截图留证）
  await mp.switchTab('/pages/home/index')
  await sleep(2200)
  await mp.screenshot({ path: 'docs/image-test.png' })

  // 4. 还原图片为空，旧图会被云函数清理
  payload.image = ''
  saved = await callCloud('saveDish', payload)
  check('还原菜品图片', saved.ok && saved.data.image === '')
  fresh = await callCloud('getDish', { id: 'd01' })
  check('图片已清空', fresh.ok && !fresh.data.image)

  const failed = results.filter(r => !r.ok)
  console.log(`\n结论：${results.length - failed.length}/${results.length} 通过`)
  await mp.disconnect()
  process.exit(failed.length ? 1 : 0)
})().catch(err => {
  console.error('图片验收异常：', err)
  process.exit(2)
})
