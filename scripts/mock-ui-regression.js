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
  await mp.mockWxMethod('showActionSheet', { tapIndex: 0 })
  const current = () => mp.currentPage()

  // 首页
  await mp.reLaunch('/pages/home/index')
  await sleep(2500)
  let page = await current()
  let data = await page.data()
  check('mock 首页加载', (data.sections || []).length > 0, `${data.sections.length} 个分类`)

  // 购物车按餐次隔离：早餐加的菜不会出现在午餐购物车
  await invoke(
    mp,
    "page.onSelectMeal({ currentTarget: { dataset: { meal: 'lunch' } } })"
  )
  await sleep(1400)
  page = await current()
  data = await page.data()
  const lunchBefore = data.cartCount
  await invoke(
    mp,
    "page.onSelectMeal({ currentTarget: { dataset: { meal: 'breakfast' } } })"
  )
  await sleep(1400)
  page = await current()
  data = await page.data()
  const breakfastBefore = data.cartCount
  const hasPorridge = (data.sections || []).some(section =>
    (section.dishes || []).some(dish => dish.name === '皮蛋瘦肉粥')
  )
  check('mock 早餐菜品可加购', hasPorridge)
  await invoke(
    mp,
    "page.quickAdd(page._available.find(dish => dish.name === '皮蛋瘦肉粥'))"
  )
  await sleep(500)
  page = await current()
  data = await page.data()
  check(
    'mock 早餐购物车数量',
    data.cartCount === breakfastBefore + 1,
    `早餐 ${data.cartCount} 件`
  )
  await invoke(
    mp,
    "page.onSelectMeal({ currentTarget: { dataset: { meal: 'lunch' } } })"
  )
  await sleep(1400)
  page = await current()
  data = await page.data()
  check(
    'mock 购物车按餐次隔离',
    data.cartCount === lunchBefore,
    `午餐 ${data.cartCount} 件 / 早餐 ${breakfastBefore + 1} 件`
  )
  await mp.navigateTo('/pages/checkout/index?meal=breakfast')
  await sleep(1800)
  page = await current()
  data = await page.data()
  const porridgeLine = (data.lines || []).find(
    line => line.name === '皮蛋瘦肉粥'
  )
  check(
    'mock 结算只显示当前餐次',
    data.meal === 'breakfast' &&
      Boolean(porridgeLine) &&
      (data.lines || []).every(line => line.meal === 'breakfast'),
    `${(data.lines || []).length} 道`
  )
  if (porridgeLine) {
    await invoke(
      mp,
      `page.onRemove({ currentTarget: { dataset: { key: ${JSON.stringify(
        porridgeLine.key
      )} } } })`
    )
    await sleep(800)
  }
  await mp.switchTab('/pages/home/index')
  await sleep(1200)

  await mp.reLaunch('/pages/home/index')
  await sleep(1800)
  page = await current()
  data = await page.data()

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
  check(
    'mock 厨房菜品筛选',
    (data.dishFilters || []).length === 4 &&
      (data.displayDishes || []).length === (data.dishes || []).length,
    `${(data.displayDishes || []).length} 道`
  )
  await invoke(mp, "page.onDishSearch({ detail: { value: '番茄' } })")
  await sleep(400)
  page = await current()
  data = await page.data()
  check(
    'mock 厨房菜品搜索',
    (data.displayDishes || []).length > 0 &&
      data.displayDishes.every(dish => dish.name.indexOf('番茄') > -1),
    `${(data.displayDishes || []).length} 道`
  )
  await invoke(mp, 'page.onClearDishSearch()')
  await invoke(
    mp,
    "page.onDishFilter({ currentTarget: { dataset: { filter: 'soldout' } } })"
  )
  await sleep(400)
  page = await current()
  data = await page.data()
  const soldoutCount = Number(
    ((data.dishFilters || []).find(item => item.key === 'soldout') || {})
      .count || 0
  )
  check(
    'mock 厨房售罄筛选',
    (data.displayDishes || []).length === soldoutCount &&
      data.displayDishes.every(
        dish => dish.status === 'soldout' || dish.stock === 0
      ),
    `${(data.displayDishes || []).length} 道`
  )
  await invoke(
    mp,
    "page.onDishFilter({ currentTarget: { dataset: { filter: 'all' } } })"
  )
  await sleep(300)
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

  // 三餐全部停火时，本周饭表应显示「都在休息」而不是「还没排菜单」
  await mp.navigateTo('/pages/business/index')
  await sleep(1200)
  await invoke(
    mp,
    "page.onToggleAll({ currentTarget: { dataset: { open: 'false' } } })"
  )
  await invoke(mp, 'page.onSave()')
  await sleep(1200)
  await mp.navigateTo('/pages/week-menus/index')
  await sleep(1800)
  page = await current()
  data = await page.data()
  check(
    'mock 本周饭表全周休息空态',
    data.showEmpty === true &&
      data.emptyTitle === '这一周都在休息' &&
      data.emptyAction === '去营业设置',
    `${data.emptyTitle} / ${data.emptyAction}`
  )
  await mp.navigateBack()
  await sleep(800)
  await mp.navigateTo('/pages/business/index')
  await sleep(1200)
  await invoke(
    mp,
    "page.onToggleAll({ currentTarget: { dataset: { open: 'true' } } })"
  )
  await invoke(mp, 'page.onSave()')
  await sleep(1100)

  // 排菜单
  await mp.navigateTo('/pages/menu-edit/index')
  await sleep(1800)
  page = await current()
  data = await page.data()
  check('mock 排菜单加载', (data.dishes || []).length > 0, `餐次=${data.meal}`)

  // 菜单模板：存一个，取消勾选后套用恢复
  await invoke(
    mp,
    "wx.removeStorageSync('kfl_menu_templates_v1'); page.refreshTemplates()"
  )
  await invoke(mp, 'page.onSaveTemplate()')
  await sleep(600)
  page = await current()
  data = await page.data()
  check(
    'mock 保存菜单模板',
    (data.templates || []).length === 1 &&
      (data.templates[0].dishIds || []).length === data.dishes.length,
    `${data.templates.length} 个模板 / ${data.templates[0].dishIds.length} 道`
  )
  if ((data.dishes || []).length) {
    await invoke(
      mp,
      `page.onToggleDish({ currentTarget: { dataset: { id: ${JSON.stringify(
        data.dishes[0].id
      )} } } })`
    )
    await invoke(mp, 'page.onApplyTemplate()')
    await sleep(600)
    page = await current()
    data = await page.data()
    check(
      'mock 套用菜单模板',
      data.dishes.every(dish => dish.checked),
      `${data.dishes.filter(dish => dish.checked).length} 道已选`
    )
  }

  page = await current()
  data = await page.data()
  const savedDate = data.selectedDate
  const savedMeal = data.meal
  const savedDishCount = data.dishes.filter(dish => dish.checked).length

  await invoke(mp, 'page.onSave()')
  await sleep(1400)
  page = await current()
  check('mock 排菜单保存返回', page.path === 'pages/home/index', page.path)

  // 本周饭表：7 天、保存的那一餐能看到刚排的菜
  await mp.navigateTo('/pages/week-menus/index')
  await sleep(2000)
  page = await current()
  data = await page.data()
  check(
    'mock 本周饭表加载',
    page.path === 'pages/week-menus/index' && (data.days || []).length === 7,
    `${(data.days || []).length} 天`
  )
  const savedDay = (data.days || []).find(day => day.date === savedDate)
  const savedMealRow =
    savedDay && savedDay.meals.find(meal => meal.id === savedMeal)
  check(
    'mock 本周饭表展示已排菜单',
    Boolean(savedMealRow) &&
      (savedMealRow.state === 'ready' || savedMealRow.state === 'cutoff') &&
      savedMealRow.dishes.length + savedMealRow.moreCount === savedDishCount,
    savedMealRow
      ? `${savedMealRow.state} · ${savedMealRow.dishes.length}+${savedMealRow.moreCount} 道`
      : '没找到当天'
  )
  check(
    'mock 本周饭表其余日期未排',
    (data.days || []).every(
      day =>
        day.date === savedDate ||
        day.closed ||
        day.meals.every(
          meal => meal.state === 'empty' || meal.state === 'off'
        )
    ),
    `今天 ${savedDate}`
  )
  await invoke(
    mp,
    `page.onBook({ currentTarget: { dataset: { meal: ${JSON.stringify(
      savedMeal
    )}, date: ${JSON.stringify(savedDate)} } } })`
  )
  await sleep(1900)
  page = await current()
  data = await page.data()
  check(
    'mock 本周饭表预订跳转',
    page.path === 'pages/home/index' &&
      data.selectedMeal === savedMeal &&
      data.selectedDate === savedDate,
    `${data.selectedDate} · ${data.selectedMeal}`
  )
  await mp.switchTab('/pages/home/index')
  await sleep(900)
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
  check(
    'mock 订单已完成可评价',
    Boolean(data.order) && data.order.status === 'completed',
    data.order && data.order.status
  )
  if (data.order && data.order.status === 'completed') {
    const feedbackText = `回归评价 ${Date.now()}`
    await invoke(
      mp,
      `page.setData({ feedbackDraft: ${JSON.stringify(feedbackText)} })`
    )
    await invoke(
      mp,
      'page.onRate({ currentTarget: { dataset: { value: 3 } } })'
    )
    await invoke(mp, 'page.onSubmitRating()')
    await sleep(900)
    page = await current()
    data = await page.data()
    check('mock 提交评价', data.rating === 3, `评分 ${data.rating}`)

    // 我的评价页：汇总评分与筛选
    await mp.navigateTo('/pages/reviews/index')
    await sleep(1800)
    page = await current()
    data = await page.data()
    check(
      'mock 我的评价加载',
      (data.reviews || []).length >= 1 &&
        Number((data.stats || {}).count || 0) >= 1,
      `${(data.reviews || []).length} 条`
    )
    await invoke(
      mp,
      "page.onSelectFilter({ currentTarget: { dataset: { filter: '1' } } })"
    )
    await sleep(400)
    page = await current()
    data = await page.data()
    check(
      'mock 我的评价筛选',
      data.filter === '1' &&
        (data.display || []).every(review => review.rating === 1),
      `翻车 ${(data.display || []).length} 条`
    )
    await mp.navigateBack()
    await sleep(900)

    // 厨房回复评价 → 顾客订单详情能看到
    await mp.navigateTo('/pages/kitchen/index')
    await sleep(2400)
    page = await current()
    data = await page.data()
    const repliesBefore = Number((data.todo || {}).replies || 0)
    check(
      'mock 厨房待办显示待回复',
      repliesBefore >= 1,
      `${repliesBefore} 条待回复`
    )
    await invoke(
      mp,
      "page.onTodoTap({ currentTarget: { dataset: { target: 'replies' } } })"
    )
    await sleep(600)
    page = await current()
    data = await page.data()
    check(
      'mock 厨房待回复筛选',
      data.historyOnlyPending === true &&
        (data.historyView || []).length === repliesBefore &&
        data.historyView.every(
          order => order.canReply && !order.ownerReply
        ),
      `${(data.historyView || []).length} 条`
    )
    const beforeReply =
      ((data.history || []).find(order => order.id === 'seed-2') || {})
        .ownerReply || ''
    check(
      'mock 厨房历史有回复入口',
      Boolean(
        (data.history || []).find(
          order => order.id === 'seed-2' && order.canReply
        )
      ),
      `历史 ${(data.history || []).length} 单`
    )
    await mp.mockWxMethod('showModal', {
      confirm: true,
      cancel: false,
      content: '   '
    })
    await invoke(
      mp,
      "page.onReplyRating({ currentTarget: { dataset: { id: 'seed-2' } } })"
    )
    await sleep(600)
    page = await current()
    data = await page.data()
    const afterEmpty =
      ((data.history || []).find(order => order.id === 'seed-2') || {})
        .ownerReply || ''
    check(
      'mock 空回复被拦截',
      afterEmpty === beforeReply,
      `回复仍为「${afterEmpty || '空'}」`
    )

    const firstReply = '谢谢喜欢，下次给你多加个蛋'
    await mp.mockWxMethod('showModal', {
      confirm: true,
      cancel: false,
      content: firstReply
    })
    await invoke(
      mp,
      "page.onReplyRating({ currentTarget: { dataset: { id: 'seed-2' } } })"
    )
    await sleep(900)
    page = await current()
    data = await page.data()
    check(
      'mock 厨房回复评价',
      ((data.history || []).find(order => order.id === 'seed-2') || {})
        .ownerReply === firstReply,
      firstReply
    )
    check(
      'mock 回复后待办减少',
      Number((data.todo || {}).replies || 0) === repliesBefore - 1,
      `待回复 ${(data.todo || {}).replies}`
    )

    const secondReply = '改一句：谢谢你呀'
    await mp.mockWxMethod('showModal', {
      confirm: true,
      cancel: false,
      content: secondReply
    })
    await invoke(
      mp,
      "page.onReplyRating({ currentTarget: { dataset: { id: 'seed-2' } } })"
    )
    await sleep(900)
    page = await current()
    data = await page.data()
    check(
      'mock 覆盖评价回复',
      ((data.history || []).find(order => order.id === 'seed-2') || {})
        .ownerReply === secondReply,
      secondReply
    )
    check(
      'mock 改回复不重复扣待办',
      Number((data.todo || {}).replies || 0) === repliesBefore - 1,
      `待回复 ${(data.todo || {}).replies}`
    )

    await mp.navigateBack()
    await sleep(1500)
    page = await current()
    data = await page.data()
    check(
      'mock 顾客看到掌勺人回复',
      Boolean(data.order) && data.order.ownerReply === secondReply,
      data.order && data.order.ownerReply
    )
  }

  // 经营月报
  await mp.navigateTo('/pages/report/index')
  await sleep(2200)
  page = await current()
  data = await page.data()
  check(
    'mock 经营月报加载',
    Boolean(data.report) &&
      (data.report.daily || []).length === 30 &&
      data.report.totalOrders >= 1 &&
      (data.report.topDishes || []).length >= 1,
    data.report
      ? `${data.report.totalOrders} 单 / ¥${data.report.revenue}`
      : '没有数据'
  )
  await invoke(mp, 'page.onExport()')
  await sleep(900)
  page = await current()
  data = await page.data()
  check(
    'mock 订单 CSV 导出',
    Number(data.exportCount) >= 1,
    `导出 ${data.exportCount} 单`
  )
  await mp.navigateBack()
  await sleep(600)

  // 干饭足迹
  await mp.navigateTo('/pages/my-report/index')
  await sleep(1800)
  page = await current()
  data = await page.data()
  check(
    'mock 干饭足迹加载',
    Number(data.monthOrders) >= 1 &&
      (data.topDishes || []).length >= 1 &&
      Boolean(data.monthText),
    `${data.monthText} · ${data.monthOrders} 单`
  )
  await mp.navigateBack()
  await sleep(600)

  const failed = results.filter(r => !r.ok)
  console.log(`\n结论：${results.length - failed.length}/${results.length} 通过`)
  await mp.disconnect()
  process.exit(failed.length ? 1 : 0)
})().catch(err => {
  console.error('mock 回归异常：', err)
  process.exit(2)
})
