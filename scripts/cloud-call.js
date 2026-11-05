/**
 * 在开发者工具里直接调用云函数，用于部署后验证。
 * 用法：node scripts/cloud-call.js <action> [jsonPayload] [wsEndpoint]
 */
const automator = require('miniprogram-automator')
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

const action = process.argv[2]
const payload = process.argv[3] ? JSON.parse(process.argv[3]) : {}
const wsEndpoint = process.argv[4] || 'ws://127.0.0.1:9420'

if (!action) {
  console.error('用法: node scripts/cloud-call.js <action> [jsonPayload] [wsEndpoint]')
  process.exit(1)
}

;(async () => {
  const mp = await automator.connect({ wsEndpoint })
  await mp.evaluate(
    function (actionName, data) {
      const app = getApp()
      app.globalData.__cloudCall = { pending: true }
      wx.cloud.callFunction({
        name: 'api',
        data: { action: actionName, payload: data },
        success: function (res) {
          app.globalData.__cloudCall = res.result || {
            ok: false,
            error: 'empty result'
          }
        },
        fail: function (err) {
          app.globalData.__cloudCall = {
            ok: false,
            error: (err && err.errMsg) || String(err)
          }
        }
      })
    },
    action,
    payload
  )

  let result = null
  for (let i = 0; i < 20; i++) {
    await sleep(700)
    result = await mp.evaluate(function () {
      return getApp().globalData.__cloudCall || null
    })
    if (result && !result.pending) {
      break
    }
  }
  console.log(JSON.stringify(result, null, 2))
  process.exit(result && result.ok ? 0 : 1)
})().catch(err => {
  console.error(err)
  process.exit(1)
})
