// mock 模式 UI 回归：不依赖云环境，验证新增页面与数据逻辑
const automator = require('miniprogram-automator')
const sleep = ms => new Promise(r => setTimeout(r, ms))

const results = []
function check(name, ok, detail) {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' · ' + detail : ''}`)
}

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

  // 首页
  await mp.reLaunch('/pages/home/index')
  await sleep(2500)
  let page = await current()
  let data = await page.data()
  check('mock 首页加载', (data.sections || []).length > 0, `${data.sections.length} 个分类`)

  await invoke(mp, "page.onSearchInput({ detail: { value: '饭' } })")
  await sleep(400)
  page = await current()
  data = await page.data()
  check('mock 搜索', data.searchResults.length > 0, `${data.searchResults.length} 条`)

  await invoke(mp, 'page.onClearSearch()')
  await sleep(300)

  // 收藏筛选
  await invoke(mp, 'page.onToggleFavorites()')
  await sleep(400)
  page = await current()
  data = await page.data()
  check(
    'mock 收藏筛选空态',
    data.onlyFavorites === true && String(data.emptyDesc).indexOf('收藏') > -1,
    data.emptyDesc
  )
  await invoke(mp, 'page.onToggleFavorites()')
  await sleep(300)

  // 厨房与菜品排序
  await mp.navigateTo('/pages/kitchen/index')
  await sleep(2200)
  page = await current()
  data = await page.data()
  check('mock 厨房加载', (data.dishes || []).length > 0, `${data.dishes.length} 道菜`)
  check(
    'mock 近7天柱状图',
    Array.isArray(data.weekBars) && data.weekBars.length === 7,
    `合计 ¥${data.weekBarTotal}`
  )
  const firstDish = (data.dishes || [])[0]
  const secondDish = (data.dishes || [])[1]
  if (firstDish && secondDish) {
    await invoke(
      mp,
      `page.onMoveDish({ currentTarget: { dataset: { id: '${secondDish.id}', direction: 'up' } } })`
    )
    await sleep(1200)
    page = await current()
    data = await page.data()
    check(
      'mock 菜品排序',
      data.dishes[0].id === secondDish.id,
      `${data.dishes[0].name} / ${data.dishes[1] && data.dishes[1].name}`
    )
    await invoke(
      mp,
      `page.onMoveDish({ currentTarget: { dataset: { id: '${secondDish.id}', direction: 'down' } } })`
    )
    await sleep(1200)
  }

  // 分类管理
  await mp.navigateTo('/pages/category-manage/index')
  await sleep(1600)
  page = await current()
  data = await page.data()
  check('mock 分类管理加载', (data.categories || []).length > 0)
  await invoke(mp, "page.setData({ name: '夜宵', color: '#2D9CFF' })")
  await invoke(mp, 'page.onSave()')
  await sleep(1200)
  page = await current()
  data = await page.data()
  const added = (data.categories || []).find(item => item.name === '夜宵')
  check('mock 分类新增', Boolean(added))
  if (added) {
    await invoke(
      mp,
      `page.onDelete({ currentTarget: { dataset: { id: '${added.id}' } } })`
    )
    await sleep(1200)
    page = await current()
    data = await page.data()
    check(
      'mock 分类删除',
      !(data.categories || []).some(item => item.name === '夜宵')
    )
  }

  // 菜品模板
  await mp.navigateTo('/pages/dish-templates/index')
  await sleep(1800)
  page = await current()
  data = await page.data()
  check(
    'mock 菜品模板加载',
    (data.templates || []).length > 0 && data.missingCount > 0,
    `${(data.templates || []).length} 个模板 / 缺 ${data.missingCount}`
  )
  await invoke(
    mp,
    'page.onAddOne({ currentTarget: { dataset: { index: 0 } } })'
  )
  await sleep(1600)
  page = await current()
  data = await page.data()
  check(
    'mock 模板添加一道',
    Boolean(data.templates[0] && data.templates[0].exists),
    data.templates[0] && data.templates[0].name
  )

  // 菜谱页
  await mp.navigateTo('/pages/recipe/index?id=d01')
  await sleep(1600)
  page = await current()
  data = await page.data()
  check(
    'mock 菜谱页',
    Boolean(data.dish) && (data.steps || []).length >= 3,
    data.dish && `${data.dish.name} · ${data.steps.length} 步`
  )

  // 菜谱大全
  await mp.navigateTo('/pages/recipe-list/index')
  await sleep(1600)
  page = await current()
  data = await page.data()
  check(
    'mock 菜谱大全',
    (data.groups || []).length > 0 && data.total >= 1,
    `${data.total} 道带做法`
  )
  await invoke(mp, "page.onSearch({ detail: { value: '牛腩' } })")
  await sleep(400)
  page = await current()
  data = await page.data()
  check(
    'mock 菜谱搜索',
    (data.displayGroups || []).length > 0,
    `${data.displayGroups.length} 组`
  )
  await invoke(mp, "page.onSearch({ detail: { value: '' } })")
  await sleep(300)

  // 营业设置与公告
  await mp.navigateTo('/pages/business/index')
  await sleep(1600)
  page = await current()
  data = await page.data()
  check('mock 营业设置加载', Array.isArray(data.mealViews) && data.mealViews.length === 3)
  check(
    'mock 休息日选项',
    Array.isArray(data.dateOptions) && data.dateOptions.length === 8
  )
  check(
    'mock 每周休息选项',
    Array.isArray(data.weekdays) && data.weekdays.length === 7
  )
  await invoke(mp, "page.setData({ notice: '今天只有一锅炖菜' })")
  await invoke(mp, 'page.onSave()')
  await sleep(1000)
  await mp.switchTab('/pages/home/index')
  await sleep(1600)
  page = await current()
  data = await page.data()
  check('mock 今日公告展示', data.notice === '今天只有一锅炖菜', data.notice)
  // 还原公告
  await mp.navigateTo('/pages/business/index')
  await sleep(1200)
  page = await current()
  await invoke(mp, "page.setData({ notice: '' })")
  await invoke(mp, 'page.onSave()')
  await sleep(900)

  // 排菜单
  await mp.navigateTo('/pages/menu-edit/index')
  await sleep(1800)
  page = await current()
  data = await page.data()
  check('mock 排菜单加载', (data.dishes || []).length > 0, `餐次=${data.meal}`)
  await invoke(mp, 'page.onSave()')
  await sleep(1400)
  page = await current()
  check('mock 排菜单保存返回', page.path === 'pages/home/index', page.path)
  // 恢复默认，保持 mock 状态干净
  await mp.navigateTo('/pages/menu-edit/index')
  await sleep(1600)
  await invoke(mp, 'page.onReset()')
  await sleep(1400)

  // 订单筛选
  await mp.switchTab('/pages/orders/index')
  await sleep(1600)
  page = await current()
  data = await page.data()
  check('mock 订单列表', (data.orders || []).length > 0, `${data.orders.length} 单`)

  // 订单搜索
  const orderNo = String((data.orders || [])[0].no || '')
  await invoke(
    mp,
    `page.onSearch({ detail: { value: ${JSON.stringify(orderNo)} } })`
  )
  await sleep(400)
  page = await current()
  data = await page.data()
  check(
    'mock 订单号搜索',
    orderNo.length > 0 &&
      data.displayOrders.length > 0 &&
      data.displayOrders.every(item =>
        `${item.no} ${item.summary} ${item.dateText}`.indexOf(orderNo) > -1
      ),
    `关键词 ${orderNo} → ${data.displayOrders.length} 单`
  )

  await invoke(mp, "page.onSearch({ detail: { value: 'zzz查无此单' } })")
  await sleep(400)
  page = await current()
  data = await page.data()
  check(
    'mock 订单搜索无结果',
    data.displayOrders.length === 0 && data.keyword === 'zzz查无此单',
    `还剩 ${data.displayOrders.length} 单`
  )

  await invoke(mp, 'page.onClearSearch()')
  await sleep(300)
  page = await current()
  data = await page.data()
  check(
    'mock 清空订单搜索',
    data.keyword === '' && data.displayOrders.length === data.orders.length,
    `恢复 ${data.displayOrders.length} 单`
  )

  // 订单评价
  await mp.navigateTo('/pages/order-detail/index?id=seed-2')
  await sleep(1600)
  page = await current()
  data = await page.data()
  check(
    'mock 订单评价入口',
    (data.ratingOptions || []).length === 3,
    data.order && data.order.status
  )
  if (data.order && data.order.status === 'completed') {
    await invoke(
      mp,
      'page.onRate({ currentTarget: { dataset: { value: 3 } } })'
    )
    await invoke(mp, 'page.onSubmitRating()')
    await sleep(900)
    page = await current()
    data = await page.data()
    check('mock 提交评价', data.rating === 3, `评分 ${data.rating}`)
  }

  const failed = results.filter(r => !r.ok)
  console.log(`\n结论：${results.length - failed.length}/${results.length} 通过`)
  await mp.disconnect()
  process.exit(failed.length ? 1 : 0)
})().catch(err => {
  console.error('mock 回归异常：', err)
  process.exit(2)
})
