#!/usr/bin/env node
/**
 * 通过微信开发者工具的自动化接口完成云数据库初始化。
 *
 * 前置：
 *   1. 开发者工具已登录，项目已打开
 *   2. api 云函数已部署
 *   3. 已执行：cli auto --project <项目路径> --auto-port 9420
 *
 * 用法：node scripts/init-cloud-db.js [ws://127.0.0.1:9421]
 */
const automator = require('miniprogram-automator')

const wsEndpoint = process.argv[2] || 'ws://127.0.0.1:9421'
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

async function run() {
  const miniProgram = await automator.connect({ wsEndpoint })
  console.log('已连接开发者工具')

  // 在 App 上下文直接调用 initDb，结果写进 globalData 再轮询读取，
  // 避免依赖自动化接口对 Promise 返回值的序列化。
  await miniProgram.evaluate(function () {
    const app = getApp()
    app.globalData.__kflInit = { pending: true }
    wx.cloud.callFunction({
      name: 'api',
      data: { action: 'initDb', payload: {} },
      success: function (res) {
        app.globalData.__kflInit = res.result || {
          ok: false,
          error: 'empty result'
        }
      },
      fail: function (err) {
        app.globalData.__kflInit = {
          ok: false,
          error: (err && (err.errMsg || err.message)) || String(err)
        }
      }
    })
  })

  let result = null
  for (let i = 0; i < 30; i++) {
    await sleep(1000)
    result = await miniProgram.evaluate(function () {
      return getApp().globalData.__kflInit || null
    })
    if (result && !result.pending) {
      break
    }
    if (i % 5 === 4) {
      console.log('等待初始化…', i + 1, 's')
    }
  }
  console.log('initDb 返回:', JSON.stringify(result))

  // 强制重新加载「我的」页，让页面重新获取身份
  try {
    await miniProgram.reLaunch('/pages/profile/index')
  } catch (e) {
    await miniProgram.switchTab('/pages/home/index')
    await sleep(800)
    await miniProgram.switchTab('/pages/profile/index')
  }
  await sleep(3000)
  const page = await miniProgram.currentPage()
  const data = await page.data()
  console.log(
    '页面状态: initialized =',
    data.initialized,
    ', isAdmin =',
    data.isAdmin
  )
  console.log('entries =', (data.entries || []).map(item => item.key).join(', '))

  await miniProgram.disconnect()

  const initOk = Boolean(
    result && result.ok && result.data && result.data.initialized
  )
  if (!initOk) {
    console.error('初始化未完成')
    process.exit(1)
  }
  console.log('云数据库初始化完成')
}

run().catch(err => {
  console.error(err)
  process.exit(1)
})
