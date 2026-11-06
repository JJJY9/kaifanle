// 清理同名菜品：每组保留 sort 最小（最早创建）的一条，其余删除
const automator = require('miniprogram-automator')
const sleep = ms => new Promise(r => setTimeout(r, ms))

;(async () => {
  const mp = await automator.connect({
    wsEndpoint: process.argv[2] || 'ws://127.0.0.1:9420'
  })

  async function callCloud(action, payload, timeout = 12000) {
    await mp.evaluate(
      function (a, p) {
        const app = getApp()
        app.globalData.__dedupeCall = { pending: true }
        wx.cloud.callFunction({
          name: 'api',
          data: { action: a, payload: p || {} },
          success: function (res) {
            app.globalData.__dedupeCall = res.result || {
              ok: false,
              error: 'empty result'
            }
          },
          fail: function (err) {
            app.globalData.__dedupeCall = {
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
      await sleep(500)
      const res = await mp.evaluate(
        () => getApp().globalData.__dedupeCall || null
      )
      if (res && !res.pending) {
        return res
      }
    }
    throw new Error('cloud call timeout: ' + action)
  }

  const res = await callCloud('getDishes')
  if (!res.ok) {
    console.error('读取菜品失败：', res.error)
    process.exit(1)
  }
  const dishes = res.data || []
  const groups = {}
  dishes.forEach(dish => {
    const key = String(dish.name || '').trim()
    if (!groups[key]) {
      groups[key] = []
    }
    groups[key].push(dish)
  })

  let removed = 0
  for (const name of Object.keys(groups)) {
    const list = groups[name]
    if (list.length <= 1) {
      continue
    }
    list.sort((a, b) => Number(a.sort || 0) - Number(b.sort || 0))
    const keep = list[0]
    for (const dish of list.slice(1)) {
      const del = await callCloud('deleteDish', { id: dish.id })
      if (del.ok) {
        removed++
        console.log(`已删除重复：${name} (${dish.id}, sort=${dish.sort})`)
      } else {
        console.error(`删除失败：${name} ${dish.id} - ${del.error}`)
      }
    }
    console.log(`保留：${name} (${keep.id}, sort=${keep.sort})`)
  }

  const after = await callCloud('getDishes')
  const left = after.ok ? (after.data || []).length : -1
  console.log(`完成：删除 ${removed} 条重复，当前菜品 ${left} 道`)
  await mp.disconnect()
  process.exit(0)
})().catch(err => {
  console.error('去重失败：', err)
  process.exit(2)
})
