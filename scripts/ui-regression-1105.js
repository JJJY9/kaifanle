// 2026-11-05 功能回归：首页搜索、订单筛选、再来一单、厨房历史
const automator = require('miniprogram-automator')
const sleep = ms => new Promise(r => setTimeout(r, ms))

const results = []
function check(name, ok, detail) {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' · ' + detail : ''}`)
}

// 在页面上下文里直接执行方法，避免 callMethod 的序列化问题
function invoke(mp, body) {
  return mp.evaluate(
    new Function(
      'return (() => { const page = getCurrentPages()[getCurrentPages().length - 1]; ' +
        body +
        ' })()'
    )
  )
}

;(async () => {
  const mp = await automator.connect({
    wsEndpoint: process.argv[2] || 'ws://127.0.0.1:9420'
  })
  await mp.mockWxMethod('showModal', {
    confirm: true,
    cancel: false,
    content: ''
  })

  const current = () => mp.currentPage()

  // ---------- 首页搜索 ----------
  await mp.switchTab('/pages/home/index')
  await sleep(2500)
  let page = await current()
  let data = await page.data()
  const sections = data.sections || []
  const dishTotal = sections.reduce((sum, s) => sum + s.dishes.length, 0)
  const sampleDish = sections.length ? sections[0].dishes[0] : null
  check('首页加载菜品', dishTotal > 0, `${sections.length} 个分类 / ${dishTotal} 道菜`)

  page = await current()
  const searchBar = await page.$$('.search-bar')
  check('搜索框渲染', searchBar.length === 1)

  await invoke(mp, "page.onSearchInput({ detail: { value: '饭' } })")
  await sleep(400)
  page = await current()
  data = await page.data()
  check(
    '关键词「饭」命中',
    data.keyword === '饭' && data.searchResults.length > 0,
    `关键词=${data.keyword} 结果=${data.searchResults.length}`
  )

  await invoke(mp, "page.onSearchInput({ detail: { value: '不存在的菜名xyz' } })")
  await sleep(400)
  page = await current()
  data = await page.data()
  check(
    '无结果时为空',
    data.searchResults.length === 0,
    `结果=${data.searchResults.length}`
  )
  // 自定义组件在 automator 里选不到，用截图做视觉证据
  await mp.screenshot({ path: 'docs/search-empty.png' })

  await invoke(mp, 'page.onClearSearch()')
  await sleep(400)
  page = await current()
  data = await page.data()
  check('清空搜索恢复菜单', data.keyword === '' && data.sections.length > 0)

  // 推荐位图片分支
  await invoke(
    mp,
    "page.setData({ hero: Object.assign({}, page.data.hero, { image: 'cloud://test.env/hero.jpg' }) })"
  )
  await sleep(300)
  page = await current()
  check('推荐位图片渲染', (await page.$$('.hero-img')).length === 1)
  await invoke(
    mp,
    "page.setData({ hero: Object.assign({}, page.data.hero, { image: '' }) })"
  )
  await sleep(200)

  // ---------- 订单筛选 ----------
  await mp.switchTab('/pages/orders/index')
  await sleep(2000)
  page = await current()
  data = await page.data()
  const orders = data.orders || []
  check('订单列表加载', orders.length > 0, `共 ${orders.length} 单`)
  const expectDone = orders.filter(
    o => o.status === 'completed' || o.status === 'cancelled'
  ).length
  const expectActive = orders.length - expectDone
  check(
    '筛选计数正确',
    data.counts.all === orders.length &&
      data.counts.done === expectDone &&
      data.counts.active === expectActive,
    JSON.stringify(data.counts)
  )
  check(
    '订单日期分组',
    (data.displayOrders || []).length > 0 &&
      data.displayOrders[0].showHeader === true,
    data.displayOrders && data.displayOrders[0] && data.displayOrders[0].dateText
  )

  await invoke(
    mp,
    "page.onSelectFilter({ currentTarget: { dataset: { filter: 'active' } } })"
  )
  await sleep(400)
  page = await current()
  data = await page.data()
  check(
    '进行中筛选',
    data.displayOrders.length === expectActive &&
      data.displayOrders.every(
        o => o.status !== 'completed' && o.status !== 'cancelled'
      ),
    `${data.displayOrders.length} 单`
  )

  await invoke(
    mp,
    "page.onSelectFilter({ currentTarget: { dataset: { filter: 'done' } } })"
  )
  await sleep(400)
  page = await current()
  data = await page.data()
  check(
    '已结束筛选',
    data.displayOrders.length === expectDone &&
      data.displayOrders.every(
        o => o.status === 'completed' || o.status === 'cancelled'
      ),
    `${data.displayOrders.length} 单`
  )

  // ---------- 再来一单 ----------
  const firstOrder = orders[0]
  await mp.navigateTo(`/pages/order-detail/index?id=${firstOrder.id}`)
  await sleep(2000)
  page = await current()
  data = await page.data()
  check('订单详情加载', Boolean(data.order), data.order && '#' + data.order.no)
  const polling = await mp.evaluate(
    () => Boolean(getCurrentPages()[getCurrentPages().length - 1]._pollTimer)
  )
  check('订单详情自动刷新', polling === true)

  await invoke(
    mp,
    "page.setData({ order: Object.assign({}, page.data.order, { status: 'completed' }) })"
  )
  await sleep(300)
  page = await current()
  check('评价入口渲染', (await page.$$('.rating-option')).length === 3)

  await invoke(
    mp,
    "page.setData({ order: Object.assign({}, page.data.order, { status: 'pending', urgeCooling: false }) })"
  )
  await sleep(300)
  page = await current()
  check('催单按钮渲染', (await page.$$('.urge')).length === 1)

  const readCartCount = raw => {
    try {
      const lines = JSON.parse(raw || '[]')
      return lines.reduce((sum, l) => sum + l.qty, 0)
    } catch (e) {
      return 0
    }
  }
  const before = await mp.callWxMethod('getStorageSync', 'kfl_cart_v1')
  // 云端历史订单的菜可能已删除，注入一道当前在售的菜来验证加购逻辑
  if (sampleDish) {
    const line = JSON.stringify({
      dishId: sampleDish.id,
      name: sampleDish.name,
      price: sampleDish.price,
      qty: 1,
      specs: [],
      note: ''
    })
    await invoke(
      mp,
      `page.setData({ order: Object.assign({}, page.data.order, { meal: '${sampleDish.meals[0]}', items: [${line}] }) })`
    )
    await sleep(300)
  }
  await invoke(mp, 'page.onReorder()')
  await sleep(2500)
  const after = await mp.callWxMethod('getStorageSync', 'kfl_cart_v1')
  check(
    '再来一单加入购物车',
    readCartCount(after) > readCartCount(before) ||
      (readCartCount(before) === 0 && readCartCount(after) > 0),
    `购物车 ${readCartCount(before)} → ${readCartCount(after)}`
  )

  // ---------- 厨房历史 ----------
  await mp.navigateTo('/pages/kitchen/index')
  await sleep(2500)
  page = await current()
  data = await page.data()
  check('厨房加载', Boolean(data.stats), `待处理 ${data.orders.length} 单`)
  check(
    '厨房历史订单',
    Array.isArray(data.history),
    `历史 ${data.history.length} 单`
  )
  await invoke(mp, 'page.onToggleHistory()')
  await sleep(300)
  page = await current()
  data = await page.data()
  check('历史展开', data.showHistory === true)

  check(
    '今日备菜汇总',
    Array.isArray(data.prepItems) &&
      typeof data.prepTotal === 'number' &&
      data.prepTotal ===
        data.prepItems.reduce((sum, item) => sum + item.qty, 0),
    `${data.prepItems.length} 道 / ${data.prepTotal} 份`
  )
  check(
    '近 7 天统计',
    Boolean(data.weekStats) &&
      typeof data.weekStats.count === 'number' &&
      typeof data.weekStats.revenue === 'number',
    data.weekStats &&
      `近 7 天 ${data.weekStats.count} 单 / ¥${data.weekStats.revenue}`
  )
  check(
    '近 7 天柱状图',
    Array.isArray(data.weekBars) && data.weekBars.length === 7,
    `合计 ¥${data.weekBarTotal}`
  )
  await invoke(mp, 'page.onTogglePrep()')
  await sleep(300)
  page = await current()
  data = await page.data()
  check('备菜清单展开', data.showPrep === true)

  const clipboard = await invoke(
    mp,
    "const today = (() => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') })();" +
      "page._rawOrders = [{ no: '999', meal: 'lunch', status: 'pending', amount: 10, items: [{ name: '测试菜', qty: 2 }], scheduledDate: today }];" +
      'let captured = "";' +
      'const orig = wx.setClipboardData;' +
      'wx.setClipboardData = (opts) => { captured = String(opts.data || ""); if (opts.success) opts.success({}); };' +
      'page.onCopySummary();' +
      'wx.setClipboardData = orig;' +
      'return captured;'
  )
  check(
    '今日清单复制',
    String(clipboard).indexOf('张饱饭堂') > -1 &&
      String(clipboard).indexOf('测试菜×2') > -1,
    String(clipboard).split('\n')[0]
  )

  // ---------- 菜品图片入口 ----------
  await mp.navigateTo(`/pages/dish-edit/index?id=${sampleDish.id}`)
  await sleep(2200)
  page = await current()
  data = await page.data()
  check('菜品编辑加载', Boolean(data.name), data.name)
  check('图片选择入口', (await page.$$('.image-add')).length === 1)

  // ---------- 菜谱页 ----------
  await mp.navigateTo(`/pages/recipe/index?id=${sampleDish.id}`)
  await sleep(1800)
  page = await current()
  data = await page.data()
  check(
    '菜谱页加载',
    Boolean(data.dish) && (data.steps || []).length >= 2,
    data.dish && `${data.dish.name} · ${(data.steps || []).length} 步`
  )

  // 菜谱大全
  await mp.navigateTo('/pages/recipe-list/index')
  await sleep(1800)
  page = await current()
  data = await page.data()
  check(
    '菜谱大全加载',
    (data.groups || []).length > 0 && data.total >= 1,
    `${data.total} 道带做法`
  )

  // ---------- 首页帮我选 ----------
  await mp.switchTab('/pages/home/index')
  await sleep(1800)
  const tabCount = await mp.evaluate(() => {
    const p = getCurrentPages()[getCurrentPages().length - 1]
    const t = p.getTabBar && p.getTabBar()
    return t ? t.data.cartCount : -1
  })
  check('购物车角标同步', tabCount > 0, `角标 ${tabCount}`)
  page = await current()
  await invoke(mp, 'page.onSurprise()')
  await sleep(500)
  page = await current()
  data = await page.data()
  check(
    '帮我选打开规格',
    data.skuVisible === true && Boolean(data.activeDish),
    data.activeDish && data.activeDish.name
  )
  await invoke(mp, 'page.onSkuClose()')
  await sleep(300)

  // ---------- 结算快捷备注 ----------
  if (readCartCount(after) > 0) {
    await mp.navigateTo('/pages/checkout/index?meal=lunch')
    await sleep(1600)
    page = await current()
    await invoke(
      mp,
      "page.onNotePreset({ currentTarget: { dataset: { phrase: '少放辣' } } })"
    )
    await invoke(
      mp,
      "page.onNotePreset({ currentTarget: { dataset: { phrase: '多加点饭' } } })"
    )
    await sleep(300)
    page = await current()
    data = await page.data()
    check('快捷备注拼接', data.note === '少放辣，多加点饭', data.note)
    await mp.navigateBack()
    await sleep(600)
  }

  // ---------- 我的统计 ----------
  await mp.switchTab('/pages/profile/index')
  await sleep(2000)
  page = await current()
  data = await page.data()
  check(
    '我的累计统计',
    Boolean(data.stats) && typeof data.stats.total === 'number',
    data.stats && `本月 ${data.stats.month} / 累计 ${data.stats.total}`
  )

  // ---------- 分类管理 ----------
  await mp.navigateTo('/pages/category-manage/index')
  await sleep(2000)
  page = await current()
  data = await page.data()
  check(
    '分类管理加载',
    (data.categories || []).length > 0,
    `${(data.categories || []).length} 个分类`
  )
  await invoke(mp, "page.setData({ name: '回归测试', color: '#2D9CFF' })")
  await invoke(mp, 'page.onSave()')
  await sleep(1500)
  page = await current()
  data = await page.data()
  const addedCategory = (data.categories || []).find(
    item => item.name === '回归测试'
  )
  check('分类新增', Boolean(addedCategory))
  if (addedCategory) {
    await invoke(
      mp,
      `page.onDelete({ currentTarget: { dataset: { id: '${addedCategory.id}' } } })`
    )
    await sleep(1500)
    page = await current()
    data = await page.data()
    check(
      '分类删除',
      !(data.categories || []).some(item => item.name === '回归测试')
    )
  }

  const failed = results.filter(r => !r.ok)
  console.log(`\n结论：${results.length - failed.length}/${results.length} 通过`)
  await mp.disconnect()
  process.exit(failed.length ? 1 : 0)
})().catch(err => {
  console.error('回归脚本异常：', err)
  process.exit(2)
})
