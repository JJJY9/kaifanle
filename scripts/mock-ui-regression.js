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

function chinaDate(offset) {
  const d = new Date(Date.now() + 8 * 60 * 60 * 1000)
  d.setUTCDate(d.getUTCDate() + Number(offset || 0))
  const month = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${d.getUTCFullYear()}-${month}-${day}`
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
  await mp.evaluate(() => {
    wx.removeStorageSync('kfl_order_collapsed_dates_v1')
    wx.removeStorageSync('kfl_recipe_steps_v1')
    wx.removeStorageSync('kfl_recipe_ingredients_v1')
    wx.removeStorageSync('kfl_eaten_v1')
    wx.removeStorageSync('kfl_prep_checked_v1')
    wx.removeStorageSync('kfl_checkout_prefs_v1')
    wx.removeStorageSync('kfl_note_presets_v1')
    wx.removeStorageSync('kfl_favorites_cloud_v1')
    wx.removeStorageSync('kfl_favorites_sync_v1')
    wx.removeStorageSync('kfl_favorites_removed_v1')
    wx.removeStorageSync('kfl_eaten_cloud_v1')
    wx.removeStorageSync('kfl_eaten_sync_v1')
    wx.removeStorageSync('kfl_eaten_removed_v1')
    wx.removeStorageSync('kfl_eaten_ops_v1')
    wx.removeStorageSync('kfl_last_meal_v1')
    wx.removeStorageSync('kfl_favorites_view_v1')
    wx.removeStorageSync('kfl_favorites_poster_theme_v1')
    wx.removeStorageSync('kfl_recipe_search_v1')
    wx.removeStorageSync('kfl_last_sync_v1')
    wx.removeStorageSync('kfl_prep_dish_checked_v1')
    return true
  })
  const current = () => mp.currentPage()

  // 清空上一轮残留的购物车，保证跨次运行结果稳定
  await mp.reLaunch('/pages/cart/index')
  await sleep(1000)
  let resetPage = await current()
  let resetData = await resetPage.data()
  for (const group of resetData.groups || []) {
    await invoke(
      mp,
      `page.onClearGroup({ currentTarget: { dataset: { meal: ${JSON.stringify(
        group.meal
      )}, date: ${JSON.stringify(group.date)} } } })`
    )
    await sleep(300)
  }
  resetPage = await current()
  resetData = await resetPage.data()
  if ((resetData.groups || []).length) {
    console.log('警告：购物车未能完全清空')
  }

  // 首页
  await mp.reLaunch('/pages/home/index')
  await sleep(2500)
  let page = await current()
  let data = await page.data()
  check('mock 首页加载', (data.sections || []).length > 0, `${data.sections.length} 个分类`)
  const homeShare = await invoke(mp, 'return page.onShareAppMessage()')
  const homeTimeline = await invoke(mp, 'return page.onShareTimeline()')
  const homeDishCount = (data.sections || []).reduce(
    (sum, section) => sum + (section.dishes || []).length,
    0
  )
  check(
    'mock 首页分享标题带菜品数',
    homeDishCount >= 1 &&
      String((homeShare && homeShare.title) || '').indexOf(
        String(homeDishCount)
      ) > -1 &&
      String((homeShare && homeShare.path) || '') === '/pages/home/index' &&
      String((homeTimeline && homeTimeline.title) || '').indexOf(
        String(homeDishCount)
      ) > -1,
    (homeShare && homeShare.title) || '没有分享信息'
  )
  const heroBeforeSwitch = data.hero && data.hero.id
  await invoke(mp, 'page.onNextHero()')
  await sleep(400)
  page = await current()
  const heroData = await page.data()
  const heroAfterSwitch = heroData.hero
  check(
    'mock 首页推荐换一道',
    Boolean(heroBeforeSwitch) &&
      Boolean(heroAfterSwitch) &&
      heroAfterSwitch.id !== heroBeforeSwitch,
    `${heroBeforeSwitch} → ${heroAfterSwitch && heroAfterSwitch.id}`
  )
  check(
    'mock 首页进行中订单',
    Boolean(data.activeOrder) &&
      data.activeOrder.id === 'seed-1' &&
      String(data.activeOrder.statusText || '').length > 0 &&
      String(data.activeOrder.summary || '').length > 0 &&
      String(data.activeOrder.lastMessageText || '').includes('辛苦啦'),
    data.activeOrder
      ? `${data.activeOrder.id} · ${data.activeOrder.mealText} · ${data.activeOrder.statusText}`
      : '没有进行中订单'
  )
  const etaEl = await page.$('.active-order-eta')
  const etaText = etaEl ? String(await etaEl.text()) : ''
  check(
    'mock 首页进行中订单预计出锅',
    String((data.activeOrder || {}).expectedText || '') === '预计 12:00 出锅' &&
      etaText.indexOf('预计 12:00 出锅') > -1,
    etaText || String((data.activeOrder || {}).expectedText || '')
  )
  const homeBadgeEl = await page.$('.active-order-badge')
  const homeBadgeText = homeBadgeEl ? String(await homeBadgeEl.text()) : ''
  check(
    'mock 首页进行中订单未读角标',
    Number((data.activeOrder || {}).messageBadge) === 2 &&
      homeBadgeText.indexOf('新回复 2') > -1,
    homeBadgeText || '未渲染角标'
  )
  const homeCopiedNo = await mp.evaluate(() => {
    return new Promise(resolve => {
      const timer = setTimeout(() => resolve(''), 2000)
      const original = wx.setClipboardData
      wx.setClipboardData = function (options) {
        wx.setClipboardData = original
        clearTimeout(timer)
        try {
          if (options && options.success) options.success()
        } catch (e) {}
        resolve(options && options.data)
      }
      const page = getCurrentPages()[getCurrentPages().length - 1]
      page.onCopyActiveOrder()
    })
  })
  check(
    'mock 首页今天这单复制单号',
    Boolean((data.activeOrder || {}).no) &&
      String(homeCopiedNo || '') === String(data.activeOrder.no),
    homeCopiedNo || '没有复制到'
  )
  await invoke(mp, 'page.onQuickUrge()')
  await sleep(900)
  page = await current()
  data = await page.data()
  const urgeStore = await mp.evaluate(() => {
    try {
      const orders = JSON.parse(wx.getStorageSync('kfl_orders_v1') || '[]')
      const seed = (orders || []).find(order => order.id === 'seed-1')
      return {
        at: Number(seed && seed.urgedAt) || 0,
        count: Number(seed && seed.urgeCount) || 0
      }
    } catch (e) {
      return { at: 0, count: 0 }
    }
  })
  check(
    'mock 首页今天这单催单',
    Boolean(data.activeOrder) &&
      data.activeOrder.urgeCooling === true &&
      urgeStore.at > 0 &&
      urgeStore.count >= 1,
    `催了 ${urgeStore.count} 次`
  )
  check(
    'mock 首页本周干饭',
    String(data.weekText || '').includes('本周已吃 2 顿') &&
      String(data.weekText || '').includes('¥36') &&
      String(data.weekText || '').includes('番茄牛腩饭 ×2'),
    data.weekText
  )
  await invoke(mp, 'page.onCopyWeek()')
  await sleep(500)
  const weekClip = await mp.evaluate(
    new Function(
      "return new Promise(resolve => wx.getClipboardData({ success: r => resolve(r.data || ''), fail: () => resolve('') }))"
    )
  )
  check(
    'mock 本周小结复制',
    String(weekClip || '') === String(data.weekText || ''),
    String(weekClip || '')
  )
  await invoke(mp, 'page.onWeekReport()')
  await sleep(1800)
  page = await current()
  check(
    'mock 首页本周小结进足迹',
    page.path === 'pages/my-report/index',
    page.path
  )
  await mp.navigateBack()
  await sleep(1000)
  page = await current()
  data = await page.data()
  check(
    'mock 首页券到期提醒',
    Number(data.couponExpiring) >= 1,
    `${data.couponExpiring} 张`
  )
  check(
    'mock 首页待评价提醒',
    typeof data.pendingReviews === 'number' && data.pendingReviews >= 0,
    `${data.pendingReviews} 单`
  )
  check(
    'mock 首页厨房忙闲',
    !data.isOpen || String(data.busyText || '').length > 0,
    data.busyText || (data.isOpen ? '没有提示' : '休息中')
  )
  await invoke(mp, "page.setData({ sections: [] }); return true")
  await invoke(mp, 'page.onPullDownRefresh()')
  await sleep(1800)
  page = await current()
  data = await page.data()
  check(
    'mock 首页下拉刷新',
    page.path === 'pages/home/index' && (data.sections || []).length > 0,
    `${(data.sections || []).length} 个分类`
  )
  await invoke(
    mp,
    "page.onSelectMeal({ currentTarget: { dataset: { meal: 'dinner' } } })"
  )
  await sleep(1300)
  await mp.reLaunch('/pages/home/index')
  await sleep(2000)
  page = await current()
  data = await page.data()
  check(
    'mock 首页记住上次餐次',
    data.selectedMeal === 'dinner',
    data.selectedMeal
  )
  await invoke(
    mp,
    "page.onSelectMeal({ currentTarget: { dataset: { meal: 'lunch' } } })"
  )
  await sleep(1300)

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

  // 购物车按日期隔离：今天加的菜不会跟到明天
  const todayForCart = data.selectedDate
  const tomorrowForCart = (() => {
    const d = new Date(todayForCart + 'T12:00:00')
    d.setDate(d.getDate() + 1)
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${d.getFullYear()}-${m}-${day}`
  })()
  await invoke(
    mp,
    `page.onSelectDate({ detail: { value: '${tomorrowForCart}' } })`
  )
  await sleep(1600)
  page = await current()
  data = await page.data()
  const tomorrowBefore = data.cartCount
  check(
    'mock 切换日期后购物车清零',
    data.selectedDate === tomorrowForCart && tomorrowBefore === 0,
    `${data.selectedDate} · ${tomorrowBefore} 件`
  )
  await invoke(
    mp,
    'page.quickAdd(page._available.find(d => d.status !== "soldout" && d.stock !== 0 && !(d.spicyLevels || []).length && !(d.addons || []).length))'
  )
  await sleep(500)
  page = await current()
  data = await page.data()
  check(
    'mock 明天加购独立计数',
    data.cartCount === tomorrowBefore + 1,
    `明天 ${data.cartCount} 件`
  )
  await mp.navigateTo(
    `/pages/checkout/index?meal=lunch&date=${tomorrowForCart}`
  )
  await sleep(1600)
  page = await current()
  data = await page.data()
  check(
    'mock 结算按日期取菜',
    (data.lines || []).length >= 1 &&
      data.scheduledDate === tomorrowForCart &&
      (data.lines || []).every(line => line.date === tomorrowForCart),
    `${data.scheduledDate} · ${(data.lines || []).length} 道`
  )
  check(
    'mock 预订不显示厨房排队',
    data.kitchenHint === '',
    data.kitchenHint || '已隐藏'
  )
  const tomorrowLines = (data.lines || []).filter(
    line => line.date === tomorrowForCart
  )
  for (const line of tomorrowLines) {
    page = await current()
    data = await page.data()
    if (!(data.lines || []).some(item => item.key === line.key)) {
      continue
    }
    await invoke(
      mp,
      `page.onRemove({ currentTarget: { dataset: { key: ${JSON.stringify(
        line.key
      )} } } })`
    )
    await sleep(500)
  }
  page = await current()
  if (String(page.path).indexOf('checkout') > -1) {
    await mp.navigateBack()
    await sleep(800)
  }
  page = await current()
  await invoke(
    mp,
    `page.onSelectDate({ detail: { value: '${todayForCart}' } })`
  )
  await sleep(1600)
  page = await current()
  data = await page.data()
  check(
    'mock 切回今天购物车恢复',
    data.selectedDate === todayForCart && data.cartCount === lunchBefore,
    `今天 ${data.cartCount} 件 / 基线 ${lunchBefore} 件`
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
  check(
    'mock 结算厨房提示',
    String(data.kitchenHint || '').indexOf('厨房') > -1,
    data.kitchenHint
  )
  await invoke(
    mp,
    "page.setData({ profileDislikes: ['皮蛋'] })"
  )
  await invoke(mp, 'page.applyDislikes()')
  await sleep(400)
  page = await current()
  data = await page.data()
  check(
    'mock 结算忌口提醒',
    (data.lines || []).some(
      line => String(line.dislikeText || '').indexOf('皮蛋') > -1
    ),
    (data.lines || [])
      .map(line => line.dislikeText)
      .filter(Boolean)
      .join('、')
  )
  await invoke(mp, "page.setData({ profileDislikes: [] })")
  await invoke(mp, 'page.applyDislikes()')
  await sleep(300)
  await mp.evaluate(
    new Function(
      "wx.setStorageSync('kfl_checkout_prefs_v1', JSON.stringify({ mode: '送过来', times: { breakfast: '08:00' } })); return true;"
    )
  )
  const prefsTomorrow = chinaDate(1)
  await invoke(
    mp,
    `page.onLoad({ meal: 'breakfast', date: '${prefsTomorrow}' })`
  )
  await sleep(1500)
  page = await current()
  data = await page.data()
  check(
    'mock 结算记住就餐方式与时间',
    data.modeIndex === 1 &&
      data.timeIndex === 2 &&
      data.timeOptions[2] === '08:00' &&
      data.scheduledDate === prefsTomorrow,
    `${data.modes[data.modeIndex]} · ${data.timeOptions[data.timeIndex]}`
  )
  const nowClock = new Date()
  const nowMinutes = nowClock.getHours() * 60 + nowClock.getMinutes()
  await mp.evaluate(
    new Function(
      "wx.setStorageSync('kfl_checkout_prefs_v1', JSON.stringify({ mode: '在家吃', times: { breakfast: '07:30' } })); return true;"
    )
  )
  await invoke(mp, "page.onLoad({ meal: 'breakfast' })")
  await sleep(1500)
  page = await current()
  data = await page.data()
  const expectedPastIndex = nowMinutes >= 7 * 60 + 30 ? 0 : 1
  check(
    'mock 结算已过期望时间回退尽快',
    data.timeIndex === expectedPastIndex &&
      data.timeOptions[data.timeIndex] ===
        (expectedPastIndex === 0 ? '尽快' : '07:30'),
    `${nowMinutes} 分 · ${data.timeOptions[data.timeIndex]}`
  )
  await mp.evaluate(
    new Function("wx.removeStorageSync('kfl_checkout_prefs_v1'); return true;")
  )
  await mp.mockWxMethod('showModal', { confirm: true, content: '少油少盐' })
  await invoke(mp, 'page.onAddNotePreset()')
  await sleep(600)
  page = await current()
  data = await page.data()
  const presetStored = await mp.evaluate(() => {
    try {
      return JSON.parse(wx.getStorageSync('kfl_note_presets_v1') || '[]')
    } catch (e) {
      return []
    }
  })
  check(
    'mock 自定义备注短语',
    (data.notePresets || []).indexOf('少油少盐') > -1 &&
      presetStored.indexOf('少油少盐') > -1,
    (data.notePresets || []).join('、')
  )
  await invoke(
    mp,
    "page.onRemoveNotePreset({ currentTarget: { dataset: { phrase: '少油少盐' } } })"
  )
  await sleep(600)
  page = await current()
  data = await page.data()
  const presetStoredAfter = await mp.evaluate(() => {
    try {
      return JSON.parse(wx.getStorageSync('kfl_note_presets_v1') || '[]')
    } catch (e) {
      return []
    }
  })
  check(
    'mock 删除自定义备注短语',
    (data.notePresets || []).indexOf('少油少盐') === -1 &&
      presetStoredAfter.length === 0,
    (data.notePresets || []).join('、')
  )
  const hintToday = data.todayDate
  await invoke(
    mp,
    `page.onDateChange({ detail: { value: '${tomorrowForCart}' } })`
  )
  await sleep(1400)
  page = await current()
  data = await page.data()
  check(
    'mock 切到预订隐藏排队',
    data.scheduledDate === tomorrowForCart && data.kitchenHint === '',
    data.kitchenHint || '已隐藏'
  )
  await invoke(
    mp,
    `page.onDateChange({ detail: { value: '${hintToday}' } })`
  )
  await sleep(1400)
  page = await current()
  data = await page.data()
  check(
    'mock 切回今天恢复排队',
    data.scheduledDate === hintToday &&
      String(data.kitchenHint || '').indexOf('厨房') > -1,
    data.kitchenHint
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
  // 固定到午餐，避免跨午夜后默认餐次变成早餐导致菜品集合不同
  await invoke(
    mp,
    "page.onSelectMeal({ currentTarget: { dataset: { meal: 'lunch' } } })"
  )
  await sleep(1500)
  page = await current()
  data = await page.data()

  await invoke(mp, "page.onSearchInput({ detail: { value: '饭' } })")
  await sleep(400)
  page = await current()
  data = await page.data()
  check('mock 搜索', data.searchResults.length > 0, `${data.searchResults.length} 条`)
  const eatenTargetId = (data.searchResults[0] || {}).id
  await mp.evaluate(
    new Function(
      `const at = new Date(); at.setDate(at.getDate() - 1); at.setHours(12, 0, 0, 0); wx.setStorageSync('kfl_eaten_v1', JSON.stringify({ ${JSON.stringify(
        eatenTargetId
      )}: at.getTime() })); return true;`
    )
  )
  await invoke(mp, 'page.loadMenu()')
  await sleep(1500)
  await invoke(mp, "page.onSearchInput({ detail: { value: '饭' } })")
  await sleep(400)
  page = await current()
  data = await page.data()
  const eatenDish = (data.searchResults || []).find(
    dish => dish.id === eatenTargetId
  )
  check(
    'mock 菜品上次吃过标记',
    Boolean(eatenDish) && eatenDish.lastEatenText === '昨天吃过',
    eatenDish ? eatenDish.lastEatenText : `未找到 ${eatenTargetId}`
  )
  await invoke(mp, 'page.onClearSearch()')
  await sleep(300)
  const longNotice =
    '明天上午要出门买菜，午餐提前到 11 点截单；晚餐照常，想吃牛肉的早点说，我好多炖一会儿。'
  await invoke(
    mp,
    `page.setData({ notice: ${JSON.stringify(
      longNotice
    )}, noticeLong: true, noticeExpanded: false })`
  )
  await sleep(300)
  page = await current()
  const noticeClampedEl = await page.$('.notice-text.clamp')
  await invoke(mp, 'page.onToggleNotice()')
  await sleep(300)
  page = await current()
  data = await page.data()
  const noticeExpandedEl = await page.$('.notice-text.clamp')
  check(
    'mock 首页公告展开收起',
    Boolean(noticeClampedEl) &&
      data.noticeExpanded === true &&
      !noticeExpandedEl,
    data.noticeExpanded ? '已展开' : '未展开'
  )
  await invoke(
    mp,
    'page.setData({ notice: "", noticeLong: false, noticeExpanded: false })'
  )
  await sleep(200)
  const surpriseTarget = await invoke(
    mp,
    "const pool = (page._available || []).filter(d => d.status !== 'soldout' && d.stock !== 0); return pool[0] ? pool[0].id : ''"
  )
  await invoke(
    mp,
    `const ids = (page._available || []).map(d => d.id); const map = {}; const now = Date.now(); ids.forEach(id => { if (id !== ${JSON.stringify(
      surpriseTarget
    )}) map[id] = now }); wx.setStorageSync('kfl_eaten_v1', JSON.stringify(map)); page.onSurprise(); return true`
  )
  await sleep(400)
  page = await current()
  data = await page.data()
  check(
    'mock 帮我选避开今天吃过的',
    Boolean(surpriseTarget) &&
      data.skuVisible === true &&
      Boolean(data.activeDish) &&
      data.activeDish.id === surpriseTarget,
    data.activeDish ? data.activeDish.name : '没有推荐'
  )
  await invoke(mp, 'page.onSkuClose()')
  await mp.evaluate(
    new Function("wx.removeStorageSync('kfl_eaten_v1'); return true;")
  )
  const dishFavTarget = await invoke(
    mp,
    "const list = page.selectAllComponents('.home-dish-card') || []; const comp = list.find(item => item.data.dish && !item.data.favorite); return comp ? comp.data.dish.id : ''"
  )
  await invoke(
    mp,
    `page.onDishFavorite({ detail: { dish: { id: ${JSON.stringify(
      dishFavTarget
    )} } } })`
  )
  await sleep(500)
  const dishFavAfter = await mp.evaluate(
    new Function(
      `const page = getCurrentPages()[getCurrentPages().length - 1]
       const list = page.selectAllComponents('.home-dish-card') || []
       const comp = list.find(item => item.data.dish && item.data.dish.id === ${JSON.stringify(
         dishFavTarget
       )})
       return comp ? Boolean(comp.data.favorite) : null`
    )
  )
  const dishFavStore = await mp.evaluate(() => {
    try {
      return JSON.parse(wx.getStorageSync('kfl_favorites_v1') || '[]')
    } catch (e) {
      return []
    }
  })
  check(
    'mock 菜品卡快捷收藏',
    Boolean(dishFavTarget) &&
      dishFavAfter === true &&
      dishFavStore.indexOf(dishFavTarget) > -1,
    `${dishFavTarget} · ${dishFavAfter ? '已收藏' : '未收藏'}`
  )
  await invoke(
    mp,
    `page.onDishFavorite({ detail: { dish: { id: ${JSON.stringify(
      dishFavTarget
    )} } } })`
  )
  await sleep(400)
  const findSoldCard = async () => {
    const cards = await page.$$('.home-dish-card')
    for (const card of cards) {
      let cardData = null
      try {
        cardData = await card.data()
      } catch (e) {
        cardData = null
      }
      if (cardData && cardData.dish && cardData.dish.id === 'd03') {
        return card
      }
    }
    return null
  }
  const soldHeartCard = await findSoldCard()
  let soldHeartZ = ''
  let soldHeartFav = null
  let soldHeartSku = null
  if (soldHeartCard) {
    const soldHeartEl = await soldHeartCard.$('.media-fav')
    if (soldHeartEl) {
      soldHeartZ = String(await soldHeartEl.style('z-index'))
      await soldHeartEl.tap()
      await sleep(600)
      page = await current()
      const afterSoldHeartTap = await page.data()
      soldHeartSku = Boolean(afterSoldHeartTap.skuVisible)
      const soldHeartStore = await mp.evaluate(() => {
        try {
          return JSON.parse(wx.getStorageSync('kfl_favorites_v1') || '[]')
        } catch (e) {
          return []
        }
      })
      soldHeartFav = soldHeartStore.indexOf('d03') > -1
      const soldCardAgain = await findSoldCard()
      if (soldCardAgain) {
        const soldHeartAgain = await soldCardAgain.$('.media-fav')
        if (soldHeartAgain) {
          await soldHeartAgain.tap()
          await sleep(500)
        }
      }
    }
  }
  check(
    'mock 售罄菜品心形收藏',
    Boolean(soldHeartCard) &&
      Number(soldHeartZ) >= 2 &&
      soldHeartFav === true &&
      soldHeartSku === false,
    `z=${soldHeartZ || '?'} · ${soldHeartFav ? '已收藏' : '未收藏'} · ${
      soldHeartSku ? '误开规格' : '未开规格'
    }`
  )
  await invoke(mp, "page.onSearchInput({ detail: { value: '番茄x' } })")
  await sleep(400)
  page = await current()
  data = await page.data()
  check(
    'mock 搜索无结果推荐',
    (data.searchResults || []).length === 0 &&
      (data.searchSuggestions || []).length > 0 &&
      data.searchSuggestions.some(dish => dish.name.indexOf('番茄') > -1),
    `${(data.searchSuggestions || []).length} 个推荐`
  )
  await invoke(mp, 'page.onGoWish()')
  await sleep(1400)
  page = await current()
  check(
    'mock 搜索无果去许愿池',
    page.path === 'pages/wishes/index',
    page.path
  )
  await mp.navigateBack()
  await sleep(900)
  page = await current()
  data = await page.data()

  await invoke(mp, "page.onSearchInput({ detail: { value: '主食' } })")
  await sleep(400)
  page = await current()
  data = await page.data()
  check(
    'mock 按分类名搜索',
    (data.searchResults || []).length > 0 &&
      data.searchResults.every(dish => dish.categoryId === 'staple'),
    `${(data.searchResults || []).length} 条`
  )
  await invoke(
    mp,
    "page._available.push({ id: 'ing-test', name: '隐藏测试菜', desc: '', price: 9, categoryId: 'staple', tags: [], meals: ['lunch'], status: 'on', color: '#FFFFFF', ingredients: ['神秘食材x'], spicyLevels: [], addons: [] }); return true"
  )
  await invoke(mp, "page.onSearchInput({ detail: { value: '神秘食材' } })")
  await sleep(400)
  page = await current()
  data = await page.data()
  check(
    'mock 首页按食材搜索',
    (data.searchResults || []).some(dish => dish.id === 'ing-test'),
    `${(data.searchResults || []).length} 条`
  )
  await invoke(
    mp,
    "page._available = (page._available || []).filter(dish => dish.id !== 'ing-test'); page.onClearSearch(); return true"
  )
  await sleep(300)

  await invoke(mp, 'page.onClearSearch()')
  await sleep(300)

  // 搜索历史：确认搜索后记录，可点回填、可清空
  await invoke(mp, "page.onSearchInput({ detail: { value: '饭' } })")
  await invoke(
    mp,
    "page.onSearchConfirm({ detail: { value: '饭' } })"
  )
  await sleep(400)
  page = await current()
  data = await page.data()
  check(
    'mock 搜索历史记录',
    (data.searchHistory || [])[0] === '饭' && data.keyword === '饭',
    (data.searchHistory || []).join('、')
  )
  await invoke(mp, 'page.onClearSearch()')
  await sleep(300)
  await invoke(
    mp,
    "page.onHistoryTap({ currentTarget: { dataset: { keyword: '饭' } } })"
  )
  await sleep(400)
  page = await current()
  data = await page.data()
  check(
    'mock 搜索历史回填',
    data.keyword === '饭' && (data.searchResults || []).length > 0,
    `${(data.searchResults || []).length} 条`
  )
  await invoke(
    mp,
    "page.onSearchConfirm({ detail: { value: '汤' } })"
  )
  await sleep(300)
  await invoke(
    mp,
    "page.onSearchConfirm({ detail: { value: '饭' } })"
  )
  await sleep(300)
  page = await current()
  data = await page.data()
  check(
    'mock 搜索历史最近使用排序',
    (data.searchHistory || [])[0] === '饭' &&
      (data.searchHistory || [])[1] === '汤',
    (data.searchHistory || []).join('、')
  )
  await invoke(
    mp,
    "page.onRemoveHistory({ currentTarget: { dataset: { keyword: '汤' } } })"
  )
  await sleep(400)
  page = await current()
  data = await page.data()
  check(
    'mock 搜索历史单条删除',
    (data.searchHistory || []).length === 1 &&
      data.searchHistory[0] === '饭',
    (data.searchHistory || []).join('、')
  )
  await invoke(mp, 'page.onClearHistory()')
  await sleep(300)
  page = await current()
  data = await page.data()
  check('mock 搜索历史清空', (data.searchHistory || []).length === 0)
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

  // 辣度筛选：只剩可选微辣（或无辣度选项按不辣算也匹配）的菜
  await invoke(
    mp,
    "page.onSpiceFilter({ currentTarget: { dataset: { key: '微辣' } } })"
  )
  await sleep(500)
  page = await current()
  data = await page.data()
  const spiceDishes = (data.sections || []).reduce(
    (acc, section) => acc.concat(section.dishes || []),
    []
  )
  check(
    'mock 辣度筛选',
    data.spiceFilter === '微辣' &&
      spiceDishes.length > 0 &&
      spiceDishes.every(
        dish =>
          (dish.spicyLevels && dish.spicyLevels.length
            ? dish.spicyLevels
            : ['不辣']
          ).indexOf('微辣') > -1
      ),
    `${spiceDishes.length} 道 · ${(data.spiceFilters || []).length} 个选项`
  )
  await invoke(
    mp,
    "page.onSpiceFilter({ currentTarget: { dataset: { key: 'all' } } })"
  )
  await sleep(500)
  page = await current()
  data = await page.data()
  check(
    'mock 辣度筛选恢复',
    data.spiceFilter === 'all' && (data.sections || []).length > 0,
    `${(data.sections || []).length} 个分类`
  )

  // 标签筛选：取当前第一个可用标签
  const tagKey =
    ((data.tagFilters || []).find(item => item.key !== 'all') || {}).key || ''
  await invoke(
    mp,
    `page.onTagFilter({ currentTarget: { dataset: { key: ${JSON.stringify(
      tagKey
    )} } } })`
  )
  await sleep(500)
  page = await current()
  data = await page.data()
  const tagDishes = (data.sections || []).reduce(
    (acc, section) => acc.concat(section.dishes || []),
    []
  )
  check(
    'mock 菜品标签筛选',
    Boolean(tagKey) &&
      data.tagFilter === tagKey &&
      tagDishes.length > 0 &&
      tagDishes.every(dish => (dish.tags || []).indexOf(tagKey) > -1),
    `${tagKey} · ${tagDishes.length} 道`
  )
  await invoke(
    mp,
    "page.onTagFilter({ currentTarget: { dataset: { key: 'all' } } })"
  )
  await sleep(400)
  page = await current()
  data = await page.data()
  check('mock 菜品标签筛选恢复', data.tagFilter === 'all')

  // 分类 chips 吸顶
  await invoke(mp, 'page.onPageScroll({ scrollTop: 400 })')
  await sleep(300)
  page = await current()
  data = await page.data()
  check(
    'mock 分类吸顶显示',
    data.showCatBar === true && (data.sections || []).length > 0
  )
  await invoke(mp, 'page.onPageScroll({ scrollTop: 0 })')
  await sleep(300)
  page = await current()
  data = await page.data()
  check('mock 分类吸顶隐藏', data.showCatBar === false)

  // 只看能点的：隐藏售罄/无库存的菜
  await invoke(mp, 'page.onToggleAvailable()')
  await sleep(500)
  page = await current()
  data = await page.data()
  const availableDishes = (data.sections || []).reduce(
    (acc, section) => acc.concat(section.dishes || []),
    []
  )
  check(
    'mock 只看能点的',
    data.onlyAvailable === true &&
      availableDishes.length > 0 &&
      availableDishes.every(
        dish => dish.status !== 'soldout' && dish.stock !== 0
      ),
    `${availableDishes.length} 道`
  )
  await invoke(mp, 'page.onToggleAvailable()')
  await sleep(400)
  page = await current()
  data = await page.data()
  check('mock 只看能点的恢复', data.onlyAvailable === false)
  const weekdaySelectDate = chinaDate(2)
  await invoke(
    mp,
    `page.onSelectDate({ detail: { value: '${weekdaySelectDate}' } })`
  )
  await sleep(1600)
  page = await current()
  data = await page.data()
  const weekdayParts = weekdaySelectDate.split('-').map(Number)
  const weekdayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  const expectedWeekday =
    weekdayNames[
      new Date(weekdayParts[0], weekdayParts[1] - 1, weekdayParts[2]).getDay()
    ]
  check(
    'mock 首页日期显示星期',
    String(data.menuDateLabel || '').indexOf(expectedWeekday) > -1 &&
      String(data.menuDateLabel || '').indexOf('·') > -1,
    data.menuDateLabel
  )
  await invoke(
    mp,
    `page.onSelectDate({ detail: { value: '${chinaDate(0)}' } })`
  )
  await sleep(1400)
  page = await current()
  data = await page.data()
  check(
    'mock 首页今天日期文案',
    data.menuDateLabel === '今天',
    data.menuDateLabel
  )

  await invoke(
    mp,
    "page.onSelectMeal({ currentTarget: { dataset: { meal: 'breakfast' } } })"
  )
  await sleep(1600)
  page = await current()
  data = await page.data()
  const beforeAvoidNames = (data.sections || []).reduce(
    (list, section) =>
      list.concat((section.dishes || []).map(dish => dish.name)),
    []
  )
  const hadDislikeDish = beforeAvoidNames.some(
    name => String(name).indexOf('皮蛋') > -1
  )
  await invoke(
    mp,
    "page.setData({ dislikes: ['皮蛋'], avoidDislikes: false })"
  )
  await sleep(200)
  await invoke(mp, 'page.onToggleAvoidDislikes()')
  await sleep(400)
  page = await current()
  data = await page.data()
  const afterAvoidNames = (data.sections || []).reduce(
    (list, section) =>
      list.concat((section.dishes || []).map(dish => dish.name)),
    []
  )
  check(
    'mock 首页避开忌口',
    data.avoidDislikes === true &&
      hadDislikeDish &&
      afterAvoidNames.length < beforeAvoidNames.length &&
      afterAvoidNames.every(name => String(name).indexOf('皮蛋') === -1),
    `${beforeAvoidNames.length} → ${afterAvoidNames.length} 道`
  )
  await invoke(mp, 'page.onToggleAvoidDislikes()')
  await sleep(300)
  await invoke(mp, 'page.setData({ dislikes: [] })')
  await invoke(
    mp,
    "page.onSelectMeal({ currentTarget: { dataset: { meal: 'lunch' } } })"
  )
  await sleep(1500)
  page = await current()
  data = await page.data()

  // 首页今天/明天快捷切换
  const tomorrowQuick = data.tomorrowDate
  await invoke(
    mp,
    `page.onQuickDate({ currentTarget: { dataset: { date: '${tomorrowQuick}' } } })`
  )
  await sleep(1500)
  page = await current()
  data = await page.data()
  check(
    'mock 首页快捷切到明天',
    data.selectedDate === tomorrowQuick && data.menuDateLabel === '明天',
    `${data.selectedDate} · ${data.menuDateLabel}`
  )
  await invoke(
    mp,
    `page.onQuickDate({ currentTarget: { dataset: { date: '${data.todayDate}' } } })`
  )
  await sleep(1500)
  page = await current()
  data = await page.data()
  check(
    'mock 首页快捷切回今天',
    data.selectedDate === data.todayDate && data.menuDateLabel === '今天'
  )

  // 优惠券快过期提醒
  await mp.navigateTo('/pages/coupons/index')
  await sleep(1600)
  page = await current()
  data = await page.data()
  check(
    'mock 优惠券快过期提醒',
    Number(data.expiringCount) >= 1 &&
      Boolean(data.coupons && data.coupons[0] && data.coupons[0].expiringSoon) &&
      String(data.coupons[0].expiringText || '').length > 0,
    `${data.expiringCount} 张 · ${data.coupons && data.coupons[0] && data.coupons[0].expiringText}`
  )
  await invoke(
    mp,
    "page.onRelease({ currentTarget: { dataset: { id: 'coupon-seed-2' } } })"
  )
  await sleep(900)
  page = await current()
  data = await page.data()
  const released = (data.coupons || []).find(item => item.id === 'coupon-seed-2')
  check(
    'mock 优惠券退回券池',
    Boolean(released) && !released.owner && released.statusText === '待领取',
    released ? released.statusText : '没找到券'
  )
  await invoke(
    mp,
    "page.onClaim({ currentTarget: { dataset: { id: 'coupon-seed-2' } } })"
  )
  await sleep(900)
  page = await current()
  data = await page.data()
  const reclaimed = (data.coupons || []).find(item => item.id === 'coupon-seed-2')
  check(
    'mock 退回后可重新领取',
    Boolean(reclaimed) &&
      reclaimed.statusText === '我的' &&
      Number(data.expiringCount) >= 1,
    reclaimed ? reclaimed.statusText : '没找到券'
  )
  await mp.navigateBack()
  await sleep(800)
  await mp.navigateTo('/pages/kitchen/index')
  await sleep(2200)
  page = await current()
  data = await page.data()
  check('mock 厨房加载', (data.dishes || []).length > 0, `${data.dishes.length} 道菜`)
  check(
    'mock 低库存阈值默认',
    Number(data.lowStockThreshold) === 3,
    `${data.lowStockThreshold} 份`
  )
  check(
    'mock 今日营业开关初始',
    data.todayClosed === false,
    data.todayClosed ? '休息中' : '营业中'
  )
  await invoke(mp, 'page.onToggleTodayClosed()')
  await sleep(1300)
  page = await current()
  data = await page.data()
  check(
    'mock 一键今天休息',
    data.todayClosed === true,
    data.todayClosed ? '已休息' : '仍在营业'
  )
  await invoke(mp, 'page.onToggleTodayClosed()')
  await sleep(1300)
  page = await current()
  data = await page.data()
  check(
    'mock 一键恢复营业',
    data.todayClosed === false,
    data.todayClosed ? '仍休息' : '已恢复'
  )
  await invoke(mp, 'page.onCopyTodaySummary()')
  await sleep(600)
  const summaryClip = await mp.evaluate(
    new Function(
      "return new Promise(resolve => wx.getClipboardData({ success: r => resolve(r.data || ''), fail: () => resolve('') }))"
    )
  )
  check(
    'mock 复制今日小结',
    typeof summaryClip === 'string' &&
      summaryClip.indexOf('今日小结') > -1 &&
      summaryClip.indexOf('营收') > -1,
    `${String(summaryClip || '').length} 字`
  )
  await invoke(mp, 'page.onShareDailyPoster()')
  await sleep(2200)
  page = await current()
  data = await page.data()
  check(
    'mock 今日小结图',
    Boolean(data.posterPath),
    data.posterPath ? '已生成' : '未生成'
  )
  await invoke(
    mp,
    "wx.__saveDailyOriginal = wx.saveImageToPhotosAlbum; wx.saveImageToPhotosAlbum = (o) => { wx.__savedDailyPath = o && o.filePath; o && o.success && o.success() }; true"
  )
  await invoke(mp, 'page.onSaveDailyPoster()')
  await sleep(400)
  const savedDailyPoster = await mp.evaluate(
    () => wx.__savedDailyPath || ''
  )
  await invoke(
    mp,
    "wx.saveImageToPhotosAlbum = wx.__saveDailyOriginal; delete wx.__saveDailyOriginal; true"
  )
  check(
    'mock 小结图保存相册',
    String(savedDailyPoster || '') === String(data.posterPath || ''),
    String(savedDailyPoster || '')
  )
  await invoke(mp, 'page.onSharePrepPoster()')
  await sleep(2200)
  page = await current()
  data = await page.data()
  check(
    'mock 采购清单图',
    Boolean(data.prepPosterPath),
    data.prepPosterPath ? '已生成' : '未生成'
  )
  await invoke(
    mp,
    "wx.__savePrepOriginal = wx.saveImageToPhotosAlbum; wx.saveImageToPhotosAlbum = (o) => { wx.__savedPrepPath = o && o.filePath; o && o.success && o.success() }; true"
  )
  await invoke(mp, 'page.onSavePrepPoster()')
  await sleep(400)
  const savedPrepPoster = await mp.evaluate(
    () => wx.__savedPrepPath || ''
  )
  await invoke(
    mp,
    "wx.saveImageToPhotosAlbum = wx.__savePrepOriginal; delete wx.__savePrepOriginal; true"
  )
  check(
    'mock 采购图保存相册',
    String(savedPrepPoster || '') === String(data.prepPosterPath || ''),
    String(savedPrepPoster || '')
  )
  await invoke(mp, 'page.load()')
  await sleep(1500)
  page = await current()
  data = await page.data()
  check(
    'mock 小结图刷新失效',
    data.posterPath === '' && data.prepPosterPath === '',
    `${data.posterPath || '已清空'} / ${data.prepPosterPath || '已清空'}`
  )
  const prepGroups = data.prepGroups || []
  check(
    'mock 备菜按餐次',
    prepGroups.length >= 1 &&
      prepGroups.every(group => group.items.length > 0) &&
      prepGroups.reduce((sum, group) => sum + group.total, 0) ===
        Number(data.prepTotal) &&
      prepGroups.some(group => String(group.allergyText || '').includes('花生')),
    `${prepGroups.map(group => group.mealText).join('、')} · ${data.prepTotal} 份`
  )
  await invoke(mp, 'page.onCopyPrepCsv()')
  await sleep(500)
  const prepCsv = await mp.evaluate(
    new Function(
      "return new Promise(resolve => wx.getClipboardData({ success: r => resolve(r.data || ''), fail: () => resolve('') }))"
    )
  )
  check(
    'mock 备菜 CSV',
    String(prepCsv || '').indexOf('餐次,菜品,份数,过敏原') > -1 &&
      String(prepCsv || '').indexOf(prepGroups[0].mealText) > -1 &&
      String(prepCsv || '').indexOf(prepGroups[0].items[0].name) > -1 &&
      String(prepCsv || '').indexOf('花生') > -1,
    `${String(prepCsv || '').length} 字`
  )
  const prepFirstDish = prepGroups[0].items[0]
  await invoke(
    mp,
    `page.onCopyPrepDish({ currentTarget: { dataset: { name: ${JSON.stringify(
      prepFirstDish.name
    )}, qty: ${Number(prepFirstDish.qty)} } } })`
  )
  await sleep(500)
  const prepDishClip = await mp.evaluate(
    new Function(
      "return new Promise(resolve => wx.getClipboardData({ success: r => resolve(r.data || ''), fail: () => resolve('') }))"
    )
  )
  check(
    'mock 备菜单道菜复制',
    String(prepDishClip || '') ===
      `${prepFirstDish.name} × ${Number(prepFirstDish.qty)}`,
    String(prepDishClip || '')
  )
  const prepMealGroup = prepGroups[0] || {
    meal: 'lunch',
    mealText: '午餐',
    items: [{ name: '占位菜', qty: 1 }],
    total: 1
  }
  const originalPrepGroups = prepGroups.map(group => ({
    ...group,
    items: (group.items || []).map(item => ({ ...item }))
  }))
  await invoke(
    mp,
    `page.setData({ prepGroups: (page.data.prepGroups || []).concat([{ meal: 'dinner', mealText: '晚餐', items: [{ name: '测试晚餐菜', qty: 2 }], total: 2 }]) })`
  )
  await sleep(200)
  await invoke(
    mp,
    `page.onCopyPrepMeal({ currentTarget: { dataset: { meal: 'dinner' } } })`
  )
  await sleep(500)
  const prepMealClip = await mp.evaluate(
    new Function(
      "return new Promise(resolve => wx.getClipboardData({ success: r => resolve(r.data || ''), fail: () => resolve('') }))"
    )
  )
  const prepMealClipText = String(prepMealClip || '')
  check(
    'mock 按餐次复制采购清单',
    prepMealClipText.indexOf('晚餐备菜') > -1 &&
      prepMealClipText.indexOf('测试晚餐菜') > -1 &&
      (!prepMealGroup.items[0] ||
        prepMealClipText.indexOf(prepMealGroup.items[0].name) === -1),
    `${prepMealClipText.length} 字`
  )
  await invoke(
    mp,
    `page.setData({ prepGroups: ${JSON.stringify(originalPrepGroups)} })`
  )
  await sleep(200)
  check(
    'mock 采购食材汇总',
    (data.prepIngredients || []).some(
      item => item.name === '鸡腿' && String(item.text).indexOf('1只') > -1
    ),
    `${(data.prepIngredients || []).length} 种食材`
  )
  const prepIngredientKey = (
    (data.prepIngredients || []).find(
      item => item.name === '鸡腿' && String(item.text).indexOf('1只') > -1
    ) || (data.prepIngredients || [])[0] ||
    {}
  ).key
  await invoke(
    mp,
    `page.onTogglePrepItem({ currentTarget: { dataset: { key: ${JSON.stringify(
      prepIngredientKey
    )} } } })`
  )
  await sleep(300)
  page = await current()
  data = await page.data()
  const prepCheckedMap = await mp.evaluate(() => {
    try {
      return JSON.parse(wx.getStorageSync('kfl_prep_checked_v1') || '{}')
    } catch (e) {
      return {}
    }
  })
  check(
    'mock 采购食材勾选已买',
    Boolean(prepIngredientKey) &&
      (data.prepIngredients || []).some(
        item => item.key === prepIngredientKey && item.done === true
      ) &&
      Number(data.prepDoneCount) === 1 &&
      prepCheckedMap.date &&
      Array.isArray(prepCheckedMap.keys) &&
      prepCheckedMap.keys.indexOf(prepIngredientKey) > -1,
    `已买 ${data.prepDoneCount}/${(data.prepIngredients || []).length}`
  )
  await invoke(mp, 'page.onResetPrepChecked()')
  await sleep(300)
  page = await current()
  data = await page.data()
  check(
    'mock 采购食材重置',
    Number(data.prepDoneCount) === 0 &&
      (data.prepIngredients || []).every(item => !item.done)
  )
  const prepDishGroup = (data.prepGroups || [])[0] || {}
  const prepDishName =
    (prepDishGroup.items &&
      prepDishGroup.items[0] &&
      prepDishGroup.items[0].name) ||
    ''
  const prepDishMeal = prepDishGroup.meal || ''
  const prepDishKey = prepDishName ? `${prepDishMeal}|${prepDishName}` : ''
  await invoke(
    mp,
    `page.onTogglePrepDish({ currentTarget: { dataset: { name: ${JSON.stringify(
      prepDishName
    )}, meal: ${JSON.stringify(prepDishMeal)} } } })`
  )
  await sleep(300)
  page = await current()
  data = await page.data()
  const prepDishCheckedStore = await mp.evaluate(() => {
    try {
      return JSON.parse(
        wx.getStorageSync('kfl_prep_dish_checked_v1') || '{}'
      )
    } catch (e) {
      return {}
    }
  })
  check(
    'mock 备菜菜品勾选',
    Boolean(prepDishName) &&
      Number(data.prepDishDoneCount) === 1 &&
      (data.prepGroups || []).reduce(
        (sum, group) =>
          sum +
          (group.items || []).filter(item => item.done).length,
        0
      ) === 1 &&
      (data.prepGroups || []).some(group =>
        (group.items || []).some(
          item => item.name === prepDishName && item.done
        )
      ) &&
      prepDishCheckedStore.date === chinaDate(0) &&
      Array.isArray(prepDishCheckedStore.keys) &&
      prepDishCheckedStore.keys.indexOf(prepDishKey) > -1,
    `已备 ${data.prepDishDoneCount} 道 · ${prepDishCheckedStore.date || '无日期'}`
  )
  await invoke(mp, 'page.onResetPrepDishDone()')
  await sleep(300)
  page = await current()
  data = await page.data()
  const prepDishResetStore = await mp.evaluate(() => {
    try {
      return JSON.parse(
        wx.getStorageSync('kfl_prep_dish_checked_v1') || '{}'
      )
    } catch (e) {
      return {}
    }
  })
  check(
    'mock 备菜重置',
    Number(data.prepDishDoneCount) === 0 &&
      (data.prepGroups || []).every(group =>
        (group.items || []).every(item => !item.done)
      ) &&
      Array.isArray(prepDishResetStore.keys) &&
      prepDishResetStore.keys.length === 0,
    `存储 ${Array.isArray(prepDishResetStore.keys) ? prepDishResetStore.keys.length : '?'} 项`
  )
  const receiptOrder = (data.orders || [])[0]
  check(
    'mock 厨房待处理订单',
    Boolean(receiptOrder),
    receiptOrder ? `#${receiptOrder.no}` : '没有待处理订单'
  )
  const messageOrder = (data.orders || []).find(order => order.id === 'seed-1')
  check(
    'mock 厨房订单最新留言',
    Boolean(messageOrder) &&
      String(messageOrder.lastMessageText || '').indexOf('辛苦啦') > -1 &&
      Number(messageOrder.messageBadge) >= 1,
    messageOrder
      ? `${messageOrder.lastMessageText} · ${messageOrder.messageBadge} 条未读`
      : '没找到订单'
  )
  await mp.evaluate(
    new Function(
      "return new Promise(resolve => wx.setClipboardData({ data: '__clip_sentinel__', success: () => resolve(true), fail: () => resolve(false) }))"
    )
  )
  const kitchenOrderNo =
    ((data.ordersView || [])[0] || {}).no || ''
  const kitchenOrderCard = await page.$('.order.card')
  if (kitchenOrderCard) {
    await kitchenOrderCard.longpress()
    await sleep(700)
  }
  page = await current()
  const kitchenNoClip = await mp.evaluate(
    new Function(
      "return new Promise(resolve => wx.getClipboardData({ success: r => resolve(r.data || ''), fail: () => resolve('') }))"
    )
  )
  check(
    'mock 厨房长按复制单号',
    page.path === 'pages/kitchen/index' &&
      Boolean(kitchenOrderCard) &&
      Boolean(kitchenOrderNo) &&
      String(kitchenNoClip || '') === String(kitchenOrderNo),
    String(kitchenNoClip || '')
  )
  await invoke(mp, "page.onOrderSearch({ detail: { value: '番茄' } })")
  await invoke(mp, 'page.onOrderSearchConfirm()')
  await sleep(400)
  page = await current()
  data = await page.data()
  const orderHistoryStored = await mp.evaluate(() => {
    try {
      return JSON.parse(
        wx.getStorageSync('kfl_kitchen_order_search_v1') || '[]'
      )
    } catch (e) {
      return []
    }
  })
  const orderHistorySaved =
    (data.orderSearchHistory || [])[0] === '番茄' &&
    orderHistoryStored[0] === '番茄'
  await invoke(mp, 'page.onClearOrderSearch()')
  await sleep(300)
  await invoke(
    mp,
    "page.onOrderSearchHistoryTap({ currentTarget: { dataset: { keyword: '番茄' } } })"
  )
  await sleep(300)
  page = await current()
  data = await page.data()
  const orderHistoryTapOk = data.orderKeyword === '番茄'
  await invoke(
    mp,
    "page.onRemoveOrderSearchHistory({ currentTarget: { dataset: { keyword: '番茄' } } })"
  )
  await sleep(300)
  page = await current()
  data = await page.data()
  const orderHistoryRemoved =
    (data.orderSearchHistory || []).indexOf('番茄') === -1
  await invoke(mp, 'page.onClearOrderSearch()')
  await sleep(300)
  check(
    'mock 厨房订单搜索历史',
    orderHistorySaved && orderHistoryTapOk && orderHistoryRemoved,
    (data.orderSearchHistory || []).join('/') || '没有历史'
  )
  await invoke(
    mp,
    "wx.__vibrateCount = 0; wx.vibrateShort = function (o) { wx.__vibrateCount = (wx.__vibrateCount || 0) + 1; try { o && o.success && o.success() } catch (e) {} }; page._unreadReady = true; page._knownUnread = 0; page.load(); return true;"
  )
  await sleep(1800)
  const vibrateCount = await mp.evaluate(() => wx.__vibrateCount || 0)
  check(
    'mock 厨房新留言振动提醒',
    vibrateCount >= 1,
    `${vibrateCount} 次`
  )
  const activeOrderCard = await page.$('.order.card')
  if (activeOrderCard) {
    await activeOrderCard.tap()
    await sleep(1800)
    page = await current()
    data = await page.data()
    check(
      'mock 厨房订单卡片进详情',
      page.path === 'pages/order-detail/index' &&
        Boolean(data.order) &&
        data.order.id === 'seed-1',
      page.path
    )
    await mp.navigateBack()
    await sleep(1200)
    page = await current()
    data = await page.data()
  }
  const nowForUrgent = new Date()
  const minutesIntoDay = nowForUrgent.getHours() * 60 + nowForUrgent.getMinutes()
  const urgentOrder = (data.orders || []).find(order => order.urgent)
  check(
    'mock 厨房超时订单高亮',
    minutesIntoDay < 16 ? true : Boolean(urgentOrder),
    minutesIntoDay < 16
      ? '刚过午夜，跳过（无法构造 15 分钟前的当天订单）'
      : urgentOrder
      ? urgentOrder.waitText
      : '没有超时订单'
  )
  const orderNoForSearch = receiptOrder ? String(receiptOrder.no) : ''
  await invoke(
    mp,
    `page.onOrderSearch({ detail: { value: ${JSON.stringify(
      orderNoForSearch
    )} } })`
  )
  await sleep(400)
  page = await current()
  data = await page.data()
  check(
    'mock 厨房订单搜索',
    (data.ordersView || []).length >= 1 &&
      data.ordersView.every(order => String(order.no).indexOf(orderNoForSearch) > -1),
    `${(data.ordersView || []).length} 单`
  )
  await invoke(mp, 'page.onClearOrderSearch()')
  await sleep(300)
  page = await current()
  data = await page.data()
  await invoke(
    mp,
    "page.onOrderMeal({ currentTarget: { dataset: { meal: 'lunch' } } })"
  )
  await sleep(300)
  page = await current()
  data = await page.data()
  check(
    'mock 厨房按餐次筛选订单',
    data.orderMeal === 'lunch' &&
      (data.ordersView || []).length >= 1 &&
      data.ordersView.every(order => order.meal === 'lunch'),
    `${(data.ordersView || []).length} 单`
  )
  await invoke(mp, 'page.onOrderSort()')
  await sleep(300)
  page = await current()
  data = await page.data()
  check(
    'mock 厨房订单排序切换',
    data.orderSort === 'new',
    data.orderSort
  )
  await invoke(mp, 'page.onOrderSort()')
  await sleep(300)
  await invoke(
    mp,
    "page.onOrderMeal({ currentTarget: { dataset: { meal: 'all' } } })"
  )
  await sleep(300)
  page = await current()
  data = await page.data()
  if (receiptOrder) {
    await invoke(
      mp,
      `page.onOpenReceipt({ currentTarget: { dataset: { id: ${JSON.stringify(
        receiptOrder.id
      )} } } })`
    )
    await sleep(300)
    page = await current()
    data = await page.data()
    check(
      'mock 厨房小票预览',
      data.receiptVisible === true &&
        Boolean(data.receipt && data.receipt.no) &&
        (data.receiptLines || []).length >= 1 &&
        data.receiptLines.every(line => line.name && line.qty > 0),
      `${(data.receiptLines || []).length} 行 · ¥${data.receipt && data.receipt.amount}`
    )
    await invoke(mp, 'page.onCloseReceipt()')
    await sleep(200)
    page = await current()
    data = await page.data()
    check('mock 厨房小票关闭', data.receiptVisible === false)
  }
  const kitchenToday = (() => {
    const d = new Date()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${d.getFullYear()}-${m}-${day}`
  })()
  const preorder = (data.preorders || [])[0]
  check(
    'mock 厨房未来预订',
    Boolean(preorder) &&
      preorder.scheduledDate > kitchenToday &&
      (preorder.itemLines || []).length >= 1,
    preorder ? `${preorder.dateText} · ${preorder.summary}` : '没有预订单'
  )
  check(
    'mock 预订单不算超时',
    (data.preorders || []).every(order => !order.urgent && !order.waitText),
    `${(data.preorders || []).length} 单`
  )
  check(
    'mock 预订待办数',
    Number((data.todo || {}).preorders) === (data.preorders || []).length &&
      Number((data.todo || {}).preorders) >= 1,
    `待办 ${(data.todo || {}).preorders} 单`
  )
  check(
    'mock 厨房历史折叠',
    (data.historyView || []).length ===
      Math.min((data.history || []).length, 10)
  )
  const allergyHistoryOrder = (data.history || []).find(
    order => order.id === 'seed-2'
  )
  check(
    'mock 厨房过敏原提醒',
    Boolean(allergyHistoryOrder) &&
      String(allergyHistoryOrder.allergyText || '').indexOf('花生') > -1,
    allergyHistoryOrder ? allergyHistoryOrder.allergyText : '没找到订单'
  )
  await invoke(mp, 'page.onToggleHistoryAll()')
  await sleep(300)
  page = await current()
  data = await page.data()
  check(
    'mock 厨房历史看全部',
    data.historyAll === true &&
      (data.historyView || []).length === (data.history || []).length
  )
  const historyHeaderOrder = (data.historyView || []).find(
    order => order.showDateHeader
  )
  check(
    'mock 厨房历史日期分组',
    Boolean(historyHeaderOrder) &&
      Number(historyHeaderOrder.dateGroupCount) >= 1,
    historyHeaderOrder
      ? `${historyHeaderOrder.dateText} · ${historyHeaderOrder.dateGroupCount} 单`
      : '没有日期分组'
  )
  await invoke(mp, "page.onHistorySearch({ detail: { value: '001' } })")
  await sleep(400)
  await invoke(mp, 'page.onCopyHistoryCsv()')
  await sleep(500)
  const historyCsv = await mp.evaluate(
    new Function(
      "return new Promise(resolve => wx.getClipboardData({ success: r => resolve(r.data || ''), fail: () => resolve('') }))"
    )
  )
  check(
    'mock 厨房历史筛选 CSV',
    String(historyCsv || '').indexOf('订单号,日期,餐次,状态,金额,评分,菜品,备注') >
      -1 &&
      String(historyCsv || '').indexOf('001') > -1 &&
      String(historyCsv || '').indexOf('002') === -1,
    `${String(historyCsv || '').length} 字`
  )
  await invoke(mp, 'page.onExportHistoryFile()')
  await sleep(1000)
  page = await current()
  data = await page.data()
  check(
    'mock 厨房历史 CSV 文件',
    data.historyFileReady === true && data.historyFileBusy === false,
    data.historyFileReady ? '已生成' : '未生成'
  )
  await invoke(mp, 'page.onClearHistorySearch()')
  await sleep(300)
  await invoke(
    mp,
    "page.onLoad({ tag: encodeURIComponent('分量足') })"
  )
  await sleep(300)
  page = await current()
  data = await page.data()
  check(
    'mock 厨房标签参数解码',
    data.historyKeyword === '分量足' && data.showHistory === true,
    data.historyKeyword
  )
  await invoke(
    mp,
    "page.setData({ historyKeyword: '', showHistory: false })"
  )
  await sleep(200)
  const oldHistoryOrder = {
    id: 'history-old-test',
    no: '900',
    status: 'completed',
    statusText: '已完成',
    scheduledDate: chinaDate(-3),
    createdAt: Date.now() - 3 * 24 * 60 * 60 * 1000,
    meal: 'lunch',
    mealText: '午餐',
    rating: 1,
    canReply: false,
    ownerReply: '',
    items: [{ dishId: 'd01', name: '旧订单测试菜', price: 1, qty: 1 }],
    summary: '旧订单测试菜',
    dateText: '',
    timeText: ''
  }
  await invoke(
    mp,
    `page.setData({ history: page.data.history.concat([${JSON.stringify(
      oldHistoryOrder
    )}]) }, () => page.applyHistoryFilter())`
  )
  await sleep(300)
  await invoke(
    mp,
    "page.onHistoryRange({ currentTarget: { dataset: { range: 'today' } } })"
  )
  await sleep(300)
  page = await current()
  data = await page.data()
  const todayHistoryCount = (data.historyView || []).length
  const todayHasOld = (data.historyView || []).some(
    order => order.id === 'history-old-test'
  )
  await invoke(
    mp,
    "page.onHistoryRange({ currentTarget: { dataset: { range: 'week' } } })"
  )
  await sleep(300)
  page = await current()
  data = await page.data()
  const weekHistoryCount = (data.historyView || []).length
  const weekHasOld = (data.historyView || []).some(
    order => order.id === 'history-old-test'
  )
  await invoke(
    mp,
    "page.onHistoryRange({ currentTarget: { dataset: { range: 'all' } } })"
  )
  await sleep(300)
  page = await current()
  data = await page.data()
  const allHasOld = (data.historyView || []).some(
    order => order.id === 'history-old-test'
  )
  check(
    'mock 厨房历史日期筛选',
    data.historyRange === 'all' &&
      !todayHasOld &&
      weekHasOld &&
      allHasOld &&
      weekHistoryCount >= todayHistoryCount &&
      (data.historyView || []).length >= weekHistoryCount,
    `今天 ${todayHistoryCount} / 近7天 ${weekHistoryCount} / 全部 ${(data.historyView || []).length}`
  )
  await invoke(
    mp,
    "page.setData({ history: page.data.history.filter(order => order.id !== 'history-old-test') }, () => page.applyHistoryFilter())"
  )
  await sleep(300)
  await invoke(
    mp,
    "page.onHistoryRating({ currentTarget: { dataset: { rating: 'neutral' } } })"
  )
  await sleep(300)
  page = await current()
  data = await page.data()
  check(
    'mock 厨房历史评分筛选',
    data.historyRating === 'neutral' &&
      (data.historyView || []).length > 0 &&
      data.historyView.every(order => Number(order.rating) === 2),
    `${(data.historyView || []).length} 单一般`
  )
  await invoke(
    mp,
    "page.onHistoryRating({ currentTarget: { dataset: { rating: 'all' } } })"
  )
  await sleep(300)
  await invoke(mp, "page.onHistorySearch({ detail: { value: '001' } })")
  await sleep(300)
  page = await current()
  data = await page.data()
  check(
    'mock 厨房历史搜索',
    (data.historyView || []).length >= 1 &&
      data.historyView.every(order => String(order.no).indexOf('001') > -1),
    `${(data.historyView || []).length} 单`
  )
  await invoke(mp, 'page.onClearHistorySearch()')
  await sleep(300)
  await invoke(
    mp,
    "page.onHistorySearch({ detail: { value: '没有这个订单zzz' } })"
  )
  await sleep(300)
  page = await current()
  data = await page.data()
  check(
    'mock 厨房历史筛选空态',
    (data.historyView || []).length === 0 &&
      data.historyEmptyText === '当前筛选没有订单',
    data.historyEmptyText
  )
  await invoke(mp, 'page.onClearHistorySearch()')
  await sleep(300)
  await invoke(
    mp,
    "page.onHistoryMeal({ currentTarget: { dataset: { meal: 'lunch' } } })"
  )
  await sleep(300)
  page = await current()
  data = await page.data()
  check(
    'mock 厨房历史餐次筛选',
    data.historyMeal === 'lunch' &&
      (data.historyView || []).length > 0 &&
      data.historyView.every(order => order.meal === 'lunch'),
    `${(data.historyView || []).length} 单午餐`
  )
  await invoke(
    mp,
    "page.onHistoryMeal({ currentTarget: { dataset: { meal: 'all' } } })"
  )
  await sleep(300)
  await invoke(mp, 'page.onToggleHistoryAll()')
  await sleep(200)
  await invoke(mp, 'page.onTogglePreorders()')
  await sleep(300)
  page = await current()
  data = await page.data()
  check('mock 厨房预订展开', data.showPreorders === true)
  const allergyPreorder = (data.preorders || []).find(
    order => order.id === 'seed-3'
  )
  const allergyPreorderEl = await page.$('.order-allergy')
  const allergyPreorderText = allergyPreorderEl
    ? await allergyPreorderEl.text()
    : ''
  check(
    'mock 厨房预订过敏原',
    Boolean(allergyPreorder) &&
      String(allergyPreorder.allergyText || '').indexOf('花生') > -1 &&
      allergyPreorderText.indexOf('花生') > -1,
    allergyPreorderText || (allergyPreorder && allergyPreorder.allergyText) || '没找到预订单'
  )
  await invoke(mp, 'page.onTogglePreorders()')
  await sleep(200)
  await invoke(mp, 'page.onCopyActiveReceipts()')
  await sleep(700)
  const receiptClip = await mp.evaluate(
    new Function(
      "return new Promise(resolve => wx.getClipboardData({ success: r => resolve(r.data || ''), fail: () => resolve('') }))"
    )
  )
  check(
    'mock 批量复制小票',
    typeof receiptClip === 'string' &&
      receiptClip.indexOf('【张饱饭堂】') > -1 &&
      receiptClip.indexOf('合计') > -1,
    `${String(receiptClip || '').length} 字`
  )
  check(
    'mock 近7天柱状图',
    Array.isArray(data.weekBars) && data.weekBars.length === 7,
    `合计 ¥${data.weekBarTotal}`
  )
  check(
    'mock 厨房菜品筛选',
    (data.dishFilters || []).length === 6 &&
      (data.displayDishes || []).length === (data.dishes || []).length,
    `${(data.displayDishes || []).length} 道`
  )
  await invoke(
    mp,
    "page.onDishFilter({ currentTarget: { dataset: { filter: 'missing' } } })"
  )
  await sleep(500)
  page = await current()
  data = await page.data()
  check(
    'mock 厨房缺做法筛选',
    data.dishFilter === 'missing' &&
      (data.displayDishes || []).length > 0 &&
      data.displayDishes.every(dish => !dish.recipe),
    `${(data.displayDishes || []).length} 道`
  )
  await invoke(
    mp,
    "page.onDishFilter({ currentTarget: { dataset: { filter: 'cost' } } })"
  )
  await sleep(500)
  page = await current()
  data = await page.data()
  check(
    'mock 厨房缺成本筛选',
    data.dishFilter === 'cost' &&
      (data.displayDishes || []).length > 0 &&
      data.displayDishes.every(dish => !(Number(dish.cost) > 0)),
    `${(data.displayDishes || []).length} 道`
  )
  await invoke(
    mp,
    "page.onDishFilter({ currentTarget: { dataset: { filter: 'all' } } })"
  )
  await sleep(300)
  await invoke(mp, "page.onDishSearch({ detail: { value: '番茄' } })")
  await sleep(400)
  page = await current()
  data = await page.data()
  check(
    'mock 厨房菜品搜索',
    (data.displayDishes || []).length > 0 &&
      data.displayDishes.every(
        dish =>
          `${dish.name} ${dish.desc || ''} ${(dish.tags || []).join(' ')} ${(
            dish.ingredients || []
          ).join(' ')}`.indexOf('番茄') > -1
      ),
    `${(data.displayDishes || []).length} 道`
  )
  await invoke(mp, "page.onDishSearch({ detail: { value: '照烧汁' } })")
  await sleep(400)
  page = await current()
  data = await page.data()
  const ingredientSearchOk =
    (data.displayDishes || []).length > 0 &&
    data.displayDishes.every(
      dish =>
        `${dish.name} ${dish.desc || ''} ${(dish.tags || []).join(' ')} ${(
          dish.ingredients || []
        ).join(' ')}`.indexOf('照烧汁') > -1
    )
  await invoke(mp, "page.onDishSearch({ detail: { value: '招牌' } })")
  await sleep(400)
  page = await current()
  data = await page.data()
  const tagSearchOk =
    (data.displayDishes || []).length > 0 &&
    data.displayDishes.every(
      dish =>
        `${dish.name} ${dish.desc || ''} ${(dish.tags || []).join(' ')} ${(
          dish.ingredients || []
        ).join(' ')}`.indexOf('招牌') > -1
    )
  check(
    'mock 厨房菜品按标签与食材搜索',
    ingredientSearchOk && tagSearchOk,
    `${(data.displayDishes || []).length} 道`
  )
  await invoke(mp, 'page.onClearDishSearch()')
  await invoke(
    mp,
    "page.onDishSearchConfirm({ detail: { value: '番茄' } })"
  )
  await sleep(400)
  page = await current()
  data = await page.data()
  check(
    'mock 厨房菜品搜索历史',
    data.dishKeyword === '番茄' &&
      (data.dishSearchHistory || [])[0] === '番茄',
    (data.dishSearchHistory || []).join('、')
  )
  await invoke(mp, 'page.onClearDishSearch()')
  await invoke(
    mp,
    "page.onDishHistoryTap({ currentTarget: { dataset: { keyword: '番茄' } } })"
  )
  await sleep(400)
  page = await current()
  data = await page.data()
  const dishHistoryTapOk = data.dishKeyword === '番茄'
  await invoke(mp, 'page.onClearDishSearch()')
  await invoke(mp, 'page.onClearDishHistory()')
  await sleep(300)
  page = await current()
  data = await page.data()
  check(
    'mock 厨房菜品搜索历史回填与清空',
    dishHistoryTapOk && (data.dishSearchHistory || []).length === 0,
    String((data.dishSearchHistory || []).length)
  )
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
  await invoke(
    mp,
    "page.onDishCategory({ currentTarget: { dataset: { id: 'staple' } } })"
  )
  await sleep(400)
  page = await current()
  data = await page.data()
  check(
    'mock 厨房分类筛选',
    (data.dishCategoryOptions || []).length > 1 &&
      (data.displayDishes || []).length > 0 &&
      data.displayDishes.every(dish => dish.categoryId === 'staple'),
    `${(data.displayDishes || []).length} 道`
  )
  await invoke(
    mp,
    "page.onDishCategory({ currentTarget: { dataset: { id: 'all' } } })"
  )
  await sleep(300)

  // 批量上下架：先筛到一道菜，下架再上架
  await invoke(mp, "page.onDishSearch({ detail: { value: '番茄' } })")
  await sleep(300)
  page = await current()
  data = await page.data()
  let batchTarget = (data.displayDishes || [])[0]
  if (batchTarget && batchTarget.status !== 'on') {
    await invoke(
      mp,
      `page.onToggleDish({ currentTarget: { dataset: { id: ${JSON.stringify(
        batchTarget.id
      )} } } })`
    )
    await sleep(3000)
    page = await current()
    data = await page.data()
    batchTarget = (data.displayDishes || [])[0]
  }
  await invoke(
    mp,
    "wx.__batchSheetOriginal = wx.showActionSheet; wx.__batchToastOriginal = wx.showToast; wx.showToast = (o) => { wx.__lastBatchToast = o && o.title }; wx.showActionSheet = () => Promise.resolve({ tapIndex: 1 }); true"
  )
  await invoke(mp, 'page.onBatchStatus()')
  await sleep(2200)
  await invoke(mp, 'page.load()')
  await sleep(1200)
  page = await current()
  data = await page.data()
  let batchDish = (data.displayDishes || [])[0]
  const batchDownToast = await mp.evaluate(() => wx.__lastBatchToast || '')
  check(
    'mock 厨房批量下架',
    Boolean(batchDish) && batchDish.status === 'off',
    batchDish
      ? `${batchDish.status} · toast ${batchDownToast} · filter ${
          data.dishFilter
        } · target ${batchTarget && batchTarget.status} · busy ${
          data.batchBusy
        }`
      : '没找到菜'
  )
  await invoke(
    mp,
    "wx.showActionSheet = () => Promise.resolve({ tapIndex: 0 }); true"
  )
  await invoke(mp, 'page.onBatchStatus()')
  await sleep(1900)
  await invoke(mp, 'page.load()')
  await sleep(1200)
  page = await current()
  data = await page.data()
  batchDish = (data.displayDishes || [])[0]
  check(
    'mock 厨房批量上架',
    Boolean(batchDish) && batchDish.status === 'on',
    batchDish ? batchDish.status : '没找到菜'
  )
  await invoke(
    mp,
    "wx.showActionSheet = wx.__batchSheetOriginal; wx.showToast = wx.__batchToastOriginal; delete wx.__batchSheetOriginal; delete wx.__batchToastOriginal; true"
  )
  await invoke(
    mp,
    "wx.__failModalOriginal = wx.showModal; wx.showModal = (o) => { wx.__failModal = o; return Promise.resolve({ confirm: false, cancel: true }) }; page.showBatchFailureModal('上架', [{ name: '测试菜', reason: '库存不对' }, { name: '另一道', reason: '分类不存在' }]); true"
  )
  await sleep(400)
  const failModal = await mp.evaluate(() => wx.__failModal || null)
  await invoke(
    mp,
    "wx.showModal = wx.__failModalOriginal; delete wx.__failModalOriginal; true"
  )
  check(
    'mock 批量失败明细',
    Boolean(failModal) &&
      String(failModal.title || '').includes('2 道') &&
      String(failModal.content || '').includes('测试菜') &&
      String(failModal.content || '').includes('库存不对'),
    failModal ? `${failModal.title} · ${failModal.content}` : '没有弹窗'
  )
  await invoke(mp, 'page.onClearDishSearch()')
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

  // 补库存后菜品编辑能看到库存变动记录
  page = await current()
  data = await page.data()
  const restockDish = (data.dishes || []).find(
    dish =>
      typeof dish.stock === 'number' && dish.stock >= 0 && dish.stock <= 3
  )
  check(
    'mock 低库存菜品存在',
    Boolean(restockDish),
    restockDish ? restockDish.name : '没有低库存菜'
  )
  if (restockDish) {
    await invoke(
      mp,
      `page.onRestock({ currentTarget: { dataset: { id: '${restockDish.id}' } } })`
    )
    await sleep(1400)
    await mp.navigateTo('/pages/dish-edit/index?id=' + restockDish.id)
    await sleep(1600)
    page = await current()
    data = await page.data()
    check(
      'mock 库存变动记录',
      (data.stockLogs || []).length >= 1 &&
        data.stockLogs.some(log => String(log.text).indexOf('手动调整') > -1),
      `${(data.stockLogs || []).length} 条`
    )
    await invoke(mp, 'page.onToggleStockLogs()')
    await sleep(900)
    page = await current()
    data = await page.data()
    check(
      'mock 库存记录看全部',
      data.stockLogsAll === true &&
        (data.stockLogsView || []).length === (data.stockLogs || []).length,
      `${(data.stockLogsView || []).length} 条`
    )
    await invoke(mp, 'page.onToggleStockLogs()')
    await sleep(300)
    await mp.navigateBack()
    await sleep(900)
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
    const beforeIndex = (data.categories || []).findIndex(
      item => item.id === added.id
    )
    await invoke(
      mp,
      `page.onMove({ currentTarget: { dataset: { id: '${added.id}', direction: 'up' } } })`
    )
    await sleep(900)
    page = await current()
    data = await page.data()
    const afterIndex = (data.categories || []).findIndex(
      item => item.id === added.id
    )
    check(
      'mock 分类排序',
      beforeIndex > 0 && afterIndex === beforeIndex - 1,
      `${beforeIndex} → ${afterIndex}`
    )
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

  // 许愿池状态筛选
  await mp.navigateTo('/pages/wishes/index')
  await sleep(1600)
  page = await current()
  data = await page.data()
  check(
    'mock 许愿池加载',
    page.path === 'pages/wishes/index' &&
      (data.wishes || []).length >= 1 &&
      (data.filters || []).length === 4,
    `${(data.wishes || []).length} 个愿望`
  )
  check(
    'mock 许愿池安排倒计时',
    (data.wishes || []).some(wish => wish.planCountdown === '明天安排'),
    (data.wishes || [])
      .map(wish => wish.planCountdown)
      .filter(Boolean)
      .join('/') || '没有倒计时'
  )
  const wishCardEl = await page.$('.wish')
  if (wishCardEl) {
    await wishCardEl.longpress()
    await sleep(700)
  }
  const copiedWish = await mp.evaluate(
    new Function(
      "return new Promise(resolve => wx.getClipboardData({ success: r => resolve(r.data || ''), fail: () => resolve('') }))"
    )
  )
  const firstWishContent = String(
    ((data.display || [])[0] || {}).content || ''
  )
  check(
    'mock 许愿长按复制',
    Boolean(wishCardEl) &&
      Boolean(firstWishContent) &&
      String(copiedWish || '').indexOf('【许愿】') > -1 &&
      String(copiedWish || '').indexOf(firstWishContent) > -1 &&
      String(copiedWish || '').indexOf('状态：') > -1,
    String(copiedWish || '').split('\n')[0] || '空'
  )
  await invoke(mp, "page.setData({ wishes: [], display: [] }); return true")
  await invoke(mp, 'page.onPullDownRefresh()')
  await sleep(1200)
  page = await current()
  data = await page.data()
  check(
    'mock 许愿池下拉刷新',
    (data.wishes || []).length >= 1,
    `${(data.wishes || []).length} 个愿望`
  )
  await invoke(mp, "page.onContent({ detail: { value: '回归测试愿望' } })")
  await invoke(mp, 'page.onSubmit()')
  await sleep(900)
  page = await current()
  data = await page.data()
  const createdWish = (data.wishes || []).find(
    wish => wish.content === '回归测试愿望' && wish.status === 'pending'
  )
  await mp.mockWxMethod('showModal', { confirm: true, content: '明天' })
  if (createdWish) {
    await invoke(
      mp,
      `page.onPlan({ currentTarget: { dataset: { id: ${JSON.stringify(
        createdWish.id
      )} } } })`
    )
    await sleep(900)
  }
  page = await current()
  data = await page.data()
  const plannedWish = (data.wishes || []).find(
    wish => wish.content === '回归测试愿望'
  )
  check(
    'mock 许愿安排日期归一化',
    Boolean(plannedWish) &&
      plannedWish.status === 'planned' &&
      plannedWish.plannedDate === chinaDate(1) &&
      plannedWish.planCountdown === '明天安排',
    plannedWish
      ? `${plannedWish.plannedDate} · ${plannedWish.planCountdown}`
      : '没有愿望'
  )
  if (plannedWish) {
    await invoke(
      mp,
      `page.onDeleteWish({ currentTarget: { dataset: { id: ${JSON.stringify(
        plannedWish.id
      )} } } })`
    )
    await sleep(900)
  }
  await invoke(
    mp,
    "page.onFilter({ currentTarget: { dataset: { filter: 'pending' } } })"
  )
  await sleep(400)
  page = await current()
  data = await page.data()
  check(
    'mock 许愿池状态筛选',
    data.filter === 'pending' &&
      (data.display || []).length >= 1 &&
      data.display.every(wish => wish.status === 'pending'),
    `${(data.display || []).length} 个待安排`
  )
  await invoke(
    mp,
    "page.onFilter({ currentTarget: { dataset: { filter: 'all' } } })"
  )
  await sleep(300)
  await mp.navigateBack()
  await sleep(900)

  // 许愿池「做成菜」预填菜名
  await mp.navigateTo(
    '/pages/dish-edit/index?name=' + encodeURIComponent('许愿菜')
  )
  await sleep(1600)
  page = await current()
  data = await page.data()
  check(
    'mock 许愿菜名预填',
    page.path === 'pages/dish-edit/index' && data.name === '许愿菜',
    data.name
  )
  await invoke(
    mp,
    "page.onQuickMeals({ currentTarget: { dataset: { preset: 'all' } } })"
  )
  await sleep(300)
  page = await current()
  data = await page.data()
  check(
    'mock 餐次快捷选择',
    data.mealChecked.breakfast &&
      data.mealChecked.lunch &&
      data.mealChecked.dinner,
    `${(data.selectedMeals || []).length} 餐`
  )
  await mp.navigateBack()
  await sleep(900)

  // 菜品编辑显示近 30 天销量
  await mp.navigateTo('/pages/dish-edit/index?id=d01')
  await sleep(1700)
  page = await current()
  data = await page.data()
  check(
    'mock 菜品近30天销量',
    String(data.salesText || '').length > 0,
    data.salesText
  )
  check(
    'mock 菜品近7天销量趋势',
    (data.salesDaily || []).length === 7,
    `${(data.salesDaily || []).length} 天`
  )
  check(
    'mock 菜品食材用量',
    String(data.ingredientsText || '').indexOf('番茄') > -1,
    String(data.ingredientsText || '').split('\n').length + ' 行'
  )
  check(
    'mock 菜品过敏原',
    String(data.allergensText || '').indexOf('花生') > -1,
    data.allergensText
  )
  await invoke(mp, "page.onCost({ detail: { value: '5' } })")
  await sleep(300)
  page = await current()
  data = await page.data()
  check(
    'mock 菜品成本毛利',
    data.cost === '5' &&
      String(data.marginText || '').indexOf('¥13.00') > -1 &&
      String(data.marginText || '').indexOf('72%') > -1,
    data.marginText
  )
  const stockBeforeStep = Number(data.stock)
  await invoke(
    mp,
    "page.onStockStep({ currentTarget: { dataset: { delta: 1 } } })"
  )
  await sleep(300)
  page = await current()
  data = await page.data()
  const unlimitedStayed = Number(data.stock) === stockBeforeStep
  await invoke(mp, "page.setData({ stock: '2' })")
  await sleep(200)
  await invoke(
    mp,
    "page.onStockStep({ currentTarget: { dataset: { delta: 1 } } })"
  )
  await sleep(200)
  await invoke(
    mp,
    "page.onStockStep({ currentTarget: { dataset: { delta: -1 } } })"
  )
  await sleep(300)
  page = await current()
  data = await page.data()
  const stockStepped = Number(data.stock) === 2
  await invoke(mp, "page.setData({ stock: '-1' })")
  await sleep(200)
  check(
    'mock 菜品库存加减',
    stockBeforeStep === -1 && unlimitedStayed && stockStepped,
    `不限量保持 ${stockBeforeStep} / 2 → 3 → ${data.stock}`
  )
  await invoke(mp, 'page.onCopyDish()')
  await sleep(1600)
  page = await current()
  data = await page.data()
  check(
    'mock 菜品复制预填',
    page.path === 'pages/dish-edit/index' &&
      data.isEdit === false &&
      data.id === '' &&
      String(data.name).indexOf('副本') > -1 &&
      data.price === '18' &&
      data.categoryId === 'staple',
    `${data.name} · ¥${data.price}`
  )
  await mp.navigateBack()
  await sleep(900)

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
  const templateCategory = (data.filterCategories || [])[1]
  if (templateCategory) {
    await invoke(
      mp,
      `page.onSelectCategory({ currentTarget: { dataset: { id: ${JSON.stringify(
        templateCategory.id
      )} } } })`
    )
    await sleep(400)
    await invoke(mp, 'page.load()')
    await sleep(1200)
    page = await current()
    data = await page.data()
    const savedTemplateCategory = await mp.evaluate(() =>
      wx.getStorageSync('templateCategoryFilter')
    )
    check(
      'mock 菜品模板记住分类',
      data.activeCategory === templateCategory.id &&
        savedTemplateCategory === templateCategory.id,
      templateCategory.name
    )
    await invoke(
      mp,
      "page.onSelectCategory({ currentTarget: { dataset: { id: 'all' } } })"
    )
    await sleep(300)
  }
  await invoke(
    mp,
    "page.onSearchConfirm({ detail: { value: '香菇' } })"
  )
  await sleep(400)
  page = await current()
  data = await page.data()
  check(
    'mock 菜品模板搜索历史',
    data.keyword === '香菇' && (data.searchHistory || [])[0] === '香菇',
    (data.searchHistory || []).join('、')
  )
  await invoke(mp, 'page.onClearSearch()')
  await invoke(
    mp,
    "page.onHistoryTap({ currentTarget: { dataset: { keyword: '香菇' } } })"
  )
  await sleep(400)
  page = await current()
  data = await page.data()
  const templateHistoryTapOk = data.keyword === '香菇'
  await invoke(mp, 'page.onClearSearch()')
  await invoke(mp, 'page.onClearHistory()')
  await sleep(300)
  page = await current()
  data = await page.data()
  check(
    'mock 菜品模板搜索历史回填与清空',
    templateHistoryTapOk && (data.searchHistory || []).length === 0,
    String((data.searchHistory || []).length)
  )
  await invoke(mp, 'page.onToggleMissing()')
  await sleep(400)
  page = await current()
  data = await page.data()
  check(
    'mock 菜品模板只看未添加',
    data.onlyMissing === true &&
      (data.displayTemplates || []).length === Number(data.missingCount) &&
      data.displayTemplates.every(template => !template.exists),
    `${(data.displayTemplates || []).length} 道未添加`
  )
  await invoke(mp, 'page.onToggleMissing()')
  await sleep(300)
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

  // 批量导入菜品
  await mp.navigateTo('/pages/dish-import/index')
  await sleep(1500)
  await invoke(mp, 'page.onFillExample()')
  await sleep(400)
  page = await current()
  data = await page.data()
  check(
    'mock 批量导入填入示例',
    (data.parsed || []).length === 3 &&
      data.parsed.every(row => !row.error),
    `${(data.parsed || []).length} 行示例`
  )
  await invoke(
    mp,
    "page.onText({ detail: { value: '批量测试菜,9.9,主食,午晚,2,3.5' } })"
  )
  await sleep(400)
  page = await current()
  data = await page.data()
  check(
    'mock 批量导入预览',
    (data.parsed || []).length === 1 &&
      !data.parsed[0].error &&
      Number(data.parsed[0].cost) === 3.5,
    data.parsed[0]
      ? `${data.parsed[0].name} · 成本 ${data.parsed[0].costText}`
      : '没有解析结果'
  )
  await invoke(mp, 'page.onImport()')
  await sleep(1400)
  page = await current()
  data = await page.data()
  check(
    'mock 批量导入执行',
    String(data.result || '').indexOf('成功导入 1 道') > -1,
    data.result
  )
  await invoke(
    mp,
    "page.onText({ detail: { value: '空库存菜,3,小炒,午,' } })"
  )
  await sleep(400)
  page = await current()
  data = await page.data()
  check(
    'mock 批量导入空库存',
    (data.parsed || []).length === 1 &&
      !data.parsed[0].error &&
      Number(data.parsed[0].stock) === -1,
    data.parsed[0] ? data.parsed[0].stockText : '没有解析结果'
  )
  await mp.navigateTo('/pages/kitchen/index')
  await sleep(2300)
  page = await current()
  data = await page.data()
  const importedDish = (data.dishes || []).find(
    dish => dish.name === '批量测试菜'
  )
  check(
    'mock 批量导入菜品数据',
    Boolean(importedDish) &&
      Number(importedDish.price) === 9.9 &&
      Number(importedDish.cost) === 3.5 &&
      Number(importedDish.stock) === 2 &&
      importedDish.meals.indexOf('lunch') > -1 &&
      importedDish.meals.indexOf('dinner') > -1,
    importedDish
      ? `¥${importedDish.price} · 成本 ¥${importedDish.cost} · 库存 ${importedDish.stock}`
      : '没找到导入的菜'
  )
  // 批量改价：筛选到导入的菜，按 +10% 调整并确认预览
  const unaffected = (data.dishes || []).find(
    dish => dish.name !== '批量测试菜' && Number(dish.price) > 0
  )
  const unaffectedPrice = unaffected ? Number(unaffected.price) : null
  await invoke(mp, "page.onDishSearch({ detail: { value: '批量测试菜' } })")
  await sleep(300)
  await mp.mockWxMethod('showActionSheet', { tapIndex: 2 })
  await mp.mockWxMethod('showModal', { confirm: true, content: '10' })
  await invoke(mp, 'page.onBatchStatus()')
  await sleep(1800)
  await invoke(mp, 'page.load()')
  await sleep(1400)
  page = await current()
  data = await page.data()
  let pricedDish = (data.displayDishes || [])[0]
  const pricedHistory = (pricedDish && pricedDish.priceHistory) || []
  const lastPriceLog = pricedHistory[pricedHistory.length - 1]
  const unaffectedAfter = unaffected
    ? (data.dishes || []).find(dish => dish.id === unaffected.id)
    : null
  check(
    'mock 厨房按筛选批量改价',
    Boolean(pricedDish) &&
      Number(pricedDish.price) === 10.89 &&
      Boolean(lastPriceLog) &&
      Number(lastPriceLog.from) === 9.9 &&
      Number(lastPriceLog.to) === 10.89,
    pricedDish
      ? `¥${pricedDish.price} · 历史 ${pricedHistory.length} 条`
      : '没找到菜'
  )
  check(
    'mock 批量改价不影响筛选外的菜',
    Boolean(unaffectedAfter) &&
      Number(unaffectedAfter.price) === unaffectedPrice,
    unaffectedAfter
      ? `${unaffectedAfter.name} ¥${unaffectedAfter.price}`
      : '没有对照菜'
  )
  // 降价：10.89 → 9.8
  await mp.mockWxMethod('showModal', { confirm: true, content: '-10' })
  await invoke(mp, 'page.onBatchStatus()')
  await sleep(1800)
  page = await current()
  data = await page.data()
  pricedDish = (data.displayDishes || [])[0]
  check(
    'mock 批量改价支持降价',
    Boolean(pricedDish) && Number(pricedDish.price) === 9.8,
    pricedDish ? `¥${pricedDish.price}` : '没找到菜'
  )
  // 两次确认：第一次输入、第二次预览；取消第二次不改价
  await invoke(
    mp,
    `
    (() => {
      const calls = []
      wx.__batchPriceOriginalModal = wx.showModal
      wx.showModal = function (options) {
        calls.push({
          title: String((options && options.title) || ''),
          content: String((options && options.content) || ''),
          editable: Boolean(options && options.editable)
        })
        if (options && options.editable) {
          return Promise.resolve({ confirm: true, content: '10' })
        }
        return Promise.resolve({ confirm: false })
      }
      wx.__batchPriceCalls = calls
      return true
    })()
    `
  )
  await invoke(mp, 'page.onBatchStatus()')
  await sleep(600)
  const modalCalls = await mp.evaluate(() => ({
    calls: wx.__batchPriceCalls || []
  }))
  page = await current()
  data = await page.data()
  const inputCall = modalCalls.calls[0] || {}
  const confirmCall = modalCalls.calls[1] || {}
  check(
    'mock 批量改价二次确认预览',
    modalCalls.calls.length === 2 &&
      inputCall.editable === true &&
      inputCall.content === '' &&
      confirmCall.editable === false &&
      confirmCall.title.indexOf('涨价 10%') > -1 &&
      confirmCall.content.indexOf('批量测试菜') > -1 &&
      confirmCall.content.indexOf('¥9.8→¥10.78') > -1,
    `${inputCall.title || '无输入弹窗'} / ${confirmCall.title || '无确认弹窗'}`
  )
  check(
    'mock 批量改价取消第二次确认',
    Number((data.displayDishes || [])[0]?.price) === 9.8,
    String((data.displayDishes || [])[0]?.price)
  )
  await invoke(
    mp,
    'wx.showModal = wx.__batchPriceOriginalModal; delete wx.__batchPriceOriginalModal; true'
  )
  await mp.mockWxMethod('showModal', { confirm: true, content: 'abc' })
  await invoke(mp, 'page.onBatchStatus()')
  await sleep(600)
  page = await current()
  data = await page.data()
  check(
    'mock 批量改价拒绝非法百分比',
    Number((data.displayDishes || [])[0]?.price) === 9.8,
    String((data.displayDishes || [])[0]?.price)
  )
  await mp.mockWxMethod('showModal', { confirm: true, content: '-91' })
  await invoke(mp, 'page.onBatchStatus()')
  await sleep(600)
  page = await current()
  data = await page.data()
  check(
    'mock 批量改价超范围拦截',
    Number((data.displayDishes || [])[0]?.price) === 9.8,
    String((data.displayDishes || [])[0]?.price)
  )
  // 本地价格过期：服务端价格已变，批量不覆盖
  await invoke(
    mp,
    `page.setData({ dishes: page.data.dishes.map(dish => dish.name === '批量测试菜' ? { ...dish, price: 9.9 } : dish) }, () => page.applyDishFilter())`
  )
  await sleep(300)
  await mp.mockWxMethod('showModal', { confirm: true, content: '10' })
  await invoke(mp, 'page.onBatchStatus()')
  await sleep(1800)
  page = await current()
  data = await page.data()
  check(
    'mock 批量改价不覆盖已变价格',
    Number((data.displayDishes || [])[0]?.price) === 9.8,
    String((data.displayDishes || [])[0]?.price)
  )
  await invoke(
    mp,
    `page.setData({ displayDishes: Array.from({ length: 51 }, (_, index) => ({ id: 'fake-' + index, name: '模拟菜', price: 1 })) })`
  )
  await mp.mockWxMethod('showModal', { confirm: true, content: '10' })
  await invoke(mp, 'page.onBatchStatus()')
  await sleep(600)
  page = await current()
  data = await page.data()
  check(
    'mock 批量改价最多 50 道',
    (data.displayDishes || []).length === 51 && !data.batchBusy,
    `${(data.displayDishes || []).length} 道`
  )
  await invoke(mp, 'page.onClearDishSearch()')
  await sleep(300)
  await invoke(mp, "page.onDishSearch({ detail: { value: '批量测试菜' } })")
  await sleep(300)
  page = await current()
  data = await page.data()
  const categoryTarget = (data.dishCategoryOptions || [])[2]
  await mp.mockWxMethod('showActionSheet', { tapIndex: 1 })
  await mp.mockWxMethod('showModal', { confirm: true })
  await invoke(mp, 'page.onBatchCategory()')
  await sleep(900)
  page = await current()
  data = await page.data()
  check(
    'mock 厨房批量改分类',
    Boolean(categoryTarget) &&
      data.displayDishes.length === 1 &&
      data.displayDishes[0].categoryId === categoryTarget.id,
    categoryTarget
      ? `${data.displayDishes[0]?.name} → ${categoryTarget.name}`
      : '没有分类'
  )
  await mp.mockWxMethod('showModal', { confirm: true })
  await invoke(mp, 'page.onBatchRestock()')
  await sleep(1800)
  page = await current()
  data = await page.data()
  check(
    'mock 厨房批量补库存',
    data.displayDishes.length === 1 &&
      Number(data.displayDishes[0].stock) === 7,
    data.displayDishes[0] ? `库存 ${data.displayDishes[0].stock}` : '没找到菜'
  )
  const restockDishId = data.displayDishes[0] && data.displayDishes[0].id
  if (restockDishId) {
    await mp.navigateTo('/pages/dish-edit/index?id=' + restockDishId)
    await sleep(1600)
    await invoke(mp, "page.onStock({ detail: { value: '2' } })")
    await invoke(mp, 'page.onSave()')
    await sleep(1800)
  }
  await invoke(mp, 'page.onClearDishSearch()')
  await sleep(300)
  await mp.navigateBack()
  await sleep(800)
  await mp.navigateBack()
  await sleep(800)

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
  const stepsCountEl = await page.$('.steps-count')
  const stepsCountText = stepsCountEl
    ? String(await stepsCountEl.text())
    : ''
  check(
    'mock 菜谱步骤数标签',
    (data.steps || []).length >= 3 &&
      stepsCountText === `共 ${data.steps.length} 步`,
    stepsCountText || '未显示'
  )
  const recipeShare = await invoke(mp, 'return page.onShareAppMessage()')
  const recipeTimeline = await invoke(mp, 'return page.onShareTimeline()')
  check(
    'mock 菜谱朋友圈分享',
    Boolean(recipeTimeline) &&
      String(recipeTimeline.title || '').indexOf('做法') > -1 &&
      String(recipeTimeline.title || '').indexOf(
        String((data.dish && data.dish.name) || '')
      ) > -1 &&
      String(recipeTimeline.query || '') === 'id=d01' &&
      Boolean(recipeShare) &&
      String(recipeShare.path || '') === '/pages/recipe/index?id=d01',
    (recipeTimeline && recipeTimeline.title) || '没有分享信息'
  )
  const copiedRecipe = await mp.evaluate(() => {
    return new Promise(resolve => {
      const timer = setTimeout(() => resolve(''), 2000)
      const original = wx.setClipboardData
      wx.setClipboardData = function (options) {
        wx.setClipboardData = original
        clearTimeout(timer)
        try {
          if (options && options.success) options.success()
        } catch (e) {}
        resolve(options && options.data)
      }
      const page = getCurrentPages()[getCurrentPages().length - 1]
      page.onCopyRecipe()
    })
  })
  const recipeCopyLines = String(copiedRecipe || '').split('\n')
  const copyStepTexts = (data.stepViews || []).map(step => step.text)
  const copyIngredientTexts = (data.ingredientViews || []).map(
    view => view.text
  )
  const expectedCopyLines = [`【${(data.dish && data.dish.name) || ''}】做法`]
  if (copyIngredientTexts.length) {
    expectedCopyLines.push(`食材：${copyIngredientTexts.join('、')}`)
  }
  copyStepTexts.forEach((text, index) => {
    expectedCopyLines.push(`${index + 1}. ${text}`)
  })
  check(
    'mock 菜谱复制完整做法',
    typeof copiedRecipe === 'string' &&
      recipeCopyLines.length === expectedCopyLines.length &&
      expectedCopyLines.every(
        (line, index) => recipeCopyLines[index] === line
      ),
    `${recipeCopyLines.length} 行 · ${recipeCopyLines[0] || '没有内容'}`
  )
  check(
    'mock 菜谱食材展示',
    Boolean(data.dish) &&
      Array.isArray(data.dish.ingredients) &&
      data.dish.ingredients.length >= 1,
    data.dish ? (data.dish.ingredients || []).join('、') : '没有食材'
  )
  check(
    'mock 菜谱过敏原展示',
    Boolean(data.dish) &&
      Array.isArray(data.dish.allergens) &&
      data.dish.allergens.indexOf('花生') > -1,
    data.dish ? (data.dish.allergens || []).join('、') : '没有过敏原'
  )
  page = await current()
  data = await page.data()
  const relatedDishes = data.relatedDishes || []
  check(
    'mock 菜谱同分类推荐',
    relatedDishes.length >= 1 &&
      relatedDishes.length <= 5 &&
      relatedDishes.every(
        item =>
          item.id !== 'd01' &&
          item.categoryId === data.dish.categoryId &&
          item.hasRecipe === true &&
          item.status !== 'off' &&
          Boolean(item.name) &&
          Number(item.price) >= 0
      ),
    `${relatedDishes.length} 道`
  )
  const firstRelated = relatedDishes[0]
  const relatedItemEl = await page.$('.related-item')
  if (relatedItemEl && firstRelated) {
    await relatedItemEl.tap()
    await sleep(1500)
  }
  page = await current()
  const relatedTapData = await page.data()
  check(
    'mock 菜谱同分类推荐进入',
    Boolean(firstRelated) &&
      page.path === 'pages/recipe/index' &&
      Boolean(relatedTapData.dish) &&
      relatedTapData.dish.id === firstRelated.id,
    relatedTapData.dish ? relatedTapData.dish.name : page.path
  )
  await mp.navigateBack()
  await sleep(900)
  page = await current()
  data = await page.data()
  await invoke(
    mp,
    'page.onToggleIngredient({ currentTarget: { dataset: { index: 0 } } })'
  )
  await sleep(300)
  page = await current()
  data = await page.data()
  const ingredientProgress = await mp.evaluate(() => {
    try {
      return JSON.parse(wx.getStorageSync('kfl_recipe_ingredients_v1') || '{}')
    } catch (e) {
      return {}
    }
  })
  check(
    'mock 食材勾选与记忆',
    Boolean(
      data.ingredientViews &&
        data.ingredientViews[0] &&
        data.ingredientViews[0].done
    ) &&
      Number(data.doneIngredients) === 1 &&
      Array.isArray(ingredientProgress.d01) &&
      ingredientProgress.d01.indexOf(0) > -1,
    `已备 ${data.doneIngredients}/${(data.ingredientViews || []).length}`
  )
  const copiedIngredients = await mp.evaluate(() => {
    return new Promise(resolve => {
      const original = wx.setClipboardData
      wx.setClipboardData = function (options) {
        wx.setClipboardData = original
        try {
          if (options && options.success) options.success()
        } catch (e) {}
        resolve(options && options.data)
      }
      const page = getCurrentPages()[getCurrentPages().length - 1]
      page.onCopyIngredients()
    })
  })
  const ingredientDishName = (data.dish && data.dish.name) || ''
  const firstIngredient =
    (data.ingredientViews && data.ingredientViews[0] &&
      data.ingredientViews[0].text) ||
    ''
  check(
    'mock 食材清单复制',
    typeof copiedIngredients === 'string' &&
      copiedIngredients.indexOf(ingredientDishName) > -1 &&
      copiedIngredients.indexOf(firstIngredient) > -1 &&
      copiedIngredients.split('\n').length >= 2,
    String(copiedIngredients || '').split('\n')[0]
  )
  const cartQtyBefore = await mp.evaluate(() => {
    try {
      const lines = JSON.parse(wx.getStorageSync('kfl_cart_v1') || '[]')
      return Array.isArray(lines)
        ? lines.reduce((sum, line) => sum + (Number(line.qty) || 0), 0)
        : 0
    } catch (e) {
      return 0
    }
  })
  await invoke(mp, 'page.onOrderDish()')
  await sleep(300)
  page = await current()
  data = await page.data()
  check(
    'mock 菜谱点这道打开规格',
    Boolean(data.skuVisible) &&
      Boolean(data.skuDish) &&
      data.skuDish.id === 'd01' &&
      data.canOrder === true &&
      ['breakfast', 'lunch', 'dinner'].indexOf(data.orderMeal) > -1,
    `${data.orderMealText} · ${data.skuDish ? data.skuDish.name : '无'}`
  )
  await invoke(
    mp,
    "page.onSkuAdd({ detail: { line: { key: '', dishId: 'd01', name: '番茄牛腩饭', price: 18, qty: 2, specs: [], note: '', color: '#FFD23F' } } })"
  )
  await sleep(400)
  page = await current()
  data = await page.data()
  const cartQtyAfter = await mp.evaluate(() => {
    try {
      const lines = JSON.parse(wx.getStorageSync('kfl_cart_v1') || '[]')
      return Array.isArray(lines)
        ? lines.reduce((sum, line) => sum + (Number(line.qty) || 0), 0)
        : 0
    } catch (e) {
      return 0
    }
  })
  check(
    'mock 菜谱点单加购',
    cartQtyAfter === cartQtyBefore + 2 && data.skuVisible === false,
    `购物车 ${cartQtyBefore} → ${cartQtyAfter} 份`
  )
  await invoke(
    mp,
    'page.setData({ dish: Object.assign({}, page.data.dish, { stock: 3 }) })'
  )
  await sleep(300)
  page = await current()
  const stockHintEl = await page.$('.order-stock')
  const stockHintText = stockHintEl ? String(await stockHintEl.text()) : ''
  check(
    'mock 菜谱库存紧张提示',
    stockHintText.indexOf('仅剩 3 份') > -1,
    stockHintText || '未显示'
  )
  await invoke(
    mp,
    'page.setData({ dish: Object.assign({}, page.data.dish, { stock: null }) })'
  )
  await sleep(200)
  const recipeContextDate = chinaDate(1)
  await mp.navigateTo(
    `/pages/recipe/index?id=d01&meal=dinner&date=${recipeContextDate}`
  )
  await sleep(1600)
  page = await current()
  data = await page.data()
  check(
    'mock 菜谱沿用首页日期餐次',
    data.orderMeal === 'dinner' &&
      String(data.orderTargetText || '').indexOf('晚餐') > -1 &&
      String(data.orderTargetText || '').indexOf('明天') > -1,
    data.orderTargetText || '无目标文案'
  )
  await invoke(
    mp,
    "page.onSkuAdd({ detail: { line: { key: '', dishId: 'd01', name: '番茄牛腩饭', price: 18, qty: 1, specs: [], note: '', color: '#FFD23F' } } })"
  )
  await sleep(400)
  const contextCart = await mp.evaluate(() => {
    try {
      return JSON.parse(wx.getStorageSync('kfl_cart_v1') || '[]')
    } catch (e) {
      return []
    }
  })
  check(
    'mock 菜谱加购沿用日期餐次',
    Array.isArray(contextCart) &&
      contextCart.some(
        line =>
          line.dishId === 'd01' &&
          line.meal === 'dinner' &&
          line.date === recipeContextDate
      ),
    recipeContextDate
  )
  await mp.navigateBack()
  await sleep(900)
  page = await current()
  data = await page.data()
  check(
    'mock 菜谱点单统计',
    String(data.statsText || '').indexOf('被点') > -1 &&
      String(data.statsText || '').indexOf('最近') > -1,
    data.statsText
  )
  await mp.evaluate(
    new Function(
      "return new Promise(resolve => wx.setClipboardData({ data: '__clip_sentinel__', success: () => resolve(true), fail: () => resolve(false) }))"
    )
  )
  await mp.evaluate(
    new Function("wx.pageScrollTo({ selector: '.step-row', duration: 0 }); return true")
  )
  await sleep(600)
  const stepRowEl = await page.$('.step-row')
  if (stepRowEl) {
    await stepRowEl.longpress()
    await sleep(600)
  }
  page = await current()
  data = await page.data()
  const stepClip = await mp.evaluate(
    new Function(
      "return new Promise(resolve => wx.getClipboardData({ success: r => resolve(r.data || ''), fail: () => resolve('') }))"
    )
  )
  check(
    'mock 长按复制步骤',
    Boolean(stepRowEl) &&
      String(stepClip || '') === String((data.steps || [])[0] || '') &&
      !(data.stepViews && data.stepViews[0] && data.stepViews[0].done),
    String(stepClip || '')
  )
  await invoke(
    mp,
    'page.onToggleStep({ currentTarget: { dataset: { index: 0 } } })'
  )
  await sleep(300)
  page = await current()
  data = await page.data()
  check(
    'mock 做法步骤勾选',
    Boolean(data.stepViews && data.stepViews[0] && data.stepViews[0].done) &&
      Number(data.doneCount) === 1,
    `完成 ${data.doneCount} 步`
  )
  const stepProgress = await mp.evaluate(() => {
    try {
      return JSON.parse(wx.getStorageSync('kfl_recipe_steps_v1') || '{}')
    } catch (e) {
      return {}
    }
  })
  check(
    'mock 做法步骤记忆',
    Array.isArray(stepProgress.d01) && stepProgress.d01.indexOf(0) > -1,
    JSON.stringify(stepProgress.d01 || [])
  )
  await invoke(mp, 'page.onResetSteps()')
  await sleep(300)
  page = await current()
  data = await page.data()
  const stepProgressAfterReset = await mp.evaluate(() => {
    try {
      return JSON.parse(wx.getStorageSync('kfl_recipe_steps_v1') || '{}')
    } catch (e) {
      return {}
    }
  })
  check(
    'mock 做法步骤重置',
    Number(data.doneCount) === 0 &&
      !Array.isArray(stepProgressAfterReset.d01)
  )
  await invoke(mp, 'page.onStartCook()')
  await sleep(400)
  page = await current()
  data = await page.data()
  const cookStarted = data.cookMode === true && Number(data.cookIndex) === 0
  const cookTimerStart = String(data.cookElapsedText || '')
  await sleep(1400)
  page = await current()
  data = await page.data()
  const cookTimerTicked =
    /^\d{2}:\d{2}$/.test(String(data.cookElapsedText || '')) &&
    String(data.cookElapsedText) !== cookTimerStart
  await invoke(mp, 'page.onCookNext()')
  await sleep(500)
  page = await current()
  data = await page.data()
  const cookAdvanced =
    Number(data.cookIndex) === 1 &&
    Boolean((data.stepViews || [])[0] && data.stepViews[0].done) &&
    Number(data.doneCount) === 1
  await invoke(mp, 'page.onCookExit()')
  await sleep(300)
  page = await current()
  data = await page.data()
  const cookTimerAtExit = String(data.cookElapsedText || '')
  await sleep(1200)
  page = await current()
  data = await page.data()
  const cookTimerStopped =
    String(data.cookElapsedText || '') === cookTimerAtExit
  check(
    'mock 开做模式逐步推进',
    cookStarted &&
      cookAdvanced &&
      data.cookMode === false &&
      cookTimerTicked &&
      cookTimerStopped,
    `第 ${Number(data.cookIndex) + 1} 步 · 计时 ${cookTimerAtExit}`
  )
  await invoke(mp, 'page.onResetSteps()')
  await sleep(300)
  await invoke(
    mp,
    "wx.__cookToasts = []; wx.showToast = (o) => { wx.__cookToasts.push(o && o.title); o && o.success && o.success() }; return true"
  )
  await invoke(mp, 'page.onStartCook()')
  await sleep(300)
  page = await current()
  data = await page.data()
  const cookTotalSteps = (data.stepViews || []).length
  for (let i = 0; i < cookTotalSteps - 1; i++) {
    await invoke(mp, 'page.onCookNext()')
    await sleep(200)
  }
  await invoke(mp, 'page._cookStepSeconds = 65; return true')
  await invoke(mp, 'page.onCookNext()')
  await sleep(400)
  const cookToasts = await mp.evaluate(() => wx.__cookToasts || [])
  page = await current()
  data = await page.data()
  check(
    'mock 开做完成显示总用时',
    data.cookMode === false &&
      cookToasts.some(title => String(title).indexOf('共用时 1 分 5 秒') > -1),
    cookToasts.join(' / ') || '没有提示'
  )
  await invoke(mp, 'page.onResetSteps()')
  await sleep(200)
  await invoke(mp, 'page.onSharePoster()')
  await sleep(2500)
  page = await current()
  data = await page.data()
  check(
    'mock 菜品海报',
    Boolean(data.posterPath) &&
      String(data.posterAllergenText || '').indexOf('含：') === 0 &&
      String(data.posterAllergenText || '').indexOf('花生') > -1,
    data.posterPath
      ? data.posterAllergenText || '无过敏原行'
      : '未生成'
  )

  // 收藏页：先收藏当前菜，再取消
  await invoke(mp, 'page.onToggleFavorite()')
  await sleep(500)
  await mp.navigateTo('/pages/favorites/index')
  await sleep(1600)
  page = await current()
  data = await page.data()
  check(
    'mock 收藏页内容',
    (data.allFavorites || []).length >= 1 &&
      data.allFavorites.some(dish => dish.id === 'd01') &&
      data.allFavorites.every(dish => Boolean(dish.favoritedText)),
    `${(data.allFavorites || []).length} 道`
  )
  const favCloud = await mp.evaluate(() => {
    try {
      return JSON.parse(wx.getStorageSync('kfl_favorites_cloud_v1') || '{}')
    } catch (e) {
      return {}
    }
  })
  check(
    'mock 收藏自动同步云端',
    Array.isArray(favCloud.ids) &&
      favCloud.ids.indexOf('d01') > -1 &&
      Number(favCloud.updatedAt) > 0,
    `${(favCloud.ids || []).length} 道`
  )
  await invoke(
    mp,
    "page.setData({ allFavorites: [], display: [] }); return true"
  )
  await invoke(mp, 'page.onPullDownRefresh()')
  await sleep(1400)
  page = await current()
  data = await page.data()
  check(
    'mock 收藏下拉刷新',
    (data.allFavorites || []).length >= 1,
    `${(data.allFavorites || []).length} 道`
  )
  await invoke(mp, "page.onSearch({ detail: { value: '招牌' } })")
  await sleep(400)
  page = await current()
  const tagSearchData = await page.data()
  await invoke(mp, "page.onSearch({ detail: { value: '主食' } })")
  await sleep(400)
  page = await current()
  const categorySearchData = await page.data()
  const tagSearchIds = (tagSearchData.display || []).map(dish => dish.id)
  const categorySearchIds = (categorySearchData.display || []).map(
    dish => dish.id
  )
  await invoke(mp, 'page.onClearSearch()')
  await sleep(400)
  page = await current()
  data = await page.data()
  check(
    'mock 收藏搜索标签与分类名',
    tagSearchIds.indexOf('d01') > -1 &&
      categorySearchIds.indexOf('d01') > -1 &&
      data.keyword === '' &&
      (data.display || []).length === (data.allFavorites || []).length,
    `标签 ${tagSearchIds.join('/') || '无'} · 分类 ${categorySearchIds.join('/') || '无'}`
  )
  const favoritesShare = await invoke(mp, 'return page.onShareAppMessage()')
  const favoritesTimeline = await invoke(mp, 'return page.onShareTimeline()')
  check(
    'mock 收藏分享设置',
    Boolean(favoritesShare) &&
      String(favoritesShare.title || '').indexOf('我的收藏') > -1 &&
      favoritesShare.path === '/pages/favorites/index' &&
      Boolean(favoritesTimeline) &&
      String(favoritesTimeline.title || '').indexOf('我的收藏') > -1,
    favoritesShare ? favoritesShare.title : '没有分享信息'
  )
  const badgeTargetDish = (data.display || [])[0]
  if (badgeTargetDish) {
    const setBadgeState = state =>
      invoke(
        mp,
        `const update = dish => dish.id === ${JSON.stringify(
          badgeTargetDish.id
        )} ? Object.assign({}, dish, ${JSON.stringify(state)}) : dish
         page.setData({
           display: (page.data.display || []).map(update),
           displayGroups: (page.data.displayGroups || []).map(group =>
             Object.assign({}, group, {
               dishes: (group.dishes || []).map(update)
             })
           )
         })`
      )
    const readBadgeText = async selector => {
      const el = await page.$('.fav-badge' + selector)
      return el ? String(await el.text()) : ''
    }
    await setBadgeState({ status: 'off', stock: null })
    await sleep(400)
    const offBadgeText = await readBadgeText('.off')
    await setBadgeState({ status: 'on', stock: 0 })
    await sleep(400)
    const soldStockText = await readBadgeText('.sold')
    await setBadgeState({ status: 'soldout', stock: null })
    await sleep(400)
    const soldStatusText = await readBadgeText('.sold')
    await setBadgeState({ status: 'on', stock: null })
    await sleep(400)
    const normalBadgeText = await readBadgeText('')
    const restoreBadgeState = {
      status:
        typeof badgeTargetDish.status === 'string'
          ? badgeTargetDish.status
          : '',
      stock:
        badgeTargetDish.stock === undefined ||
        badgeTargetDish.stock === null
          ? null
          : Number(badgeTargetDish.stock)
    }
    await setBadgeState(restoreBadgeState)
    await sleep(300)
    check(
      'mock 收藏售罄与下架角标',
      offBadgeText === '已下架' &&
        soldStockText === '售罄' &&
        soldStatusText === '售罄' &&
        normalBadgeText === '',
      `${offBadgeText || '无'} / ${soldStockText || '无'} / ${
        soldStatusText || '无'
      } / 正常${normalBadgeText ? '有角标' : '无角标'}`
    )
  }
  const eatenTarget = (data.allFavorites || [])[0]
  if (eatenTarget) {
    const eatenBeforeRestore = await mp.evaluate(() => {
      try {
        return wx.getStorageSync('kfl_eaten_v1') || ''
      } catch (e) {
        return ''
      }
    })
    await mp.evaluate(
      new Function(
        `let map = {}
         try { map = JSON.parse(wx.getStorageSync('kfl_eaten_v1') || '{}') } catch (e) {}
         map[${JSON.stringify(eatenTarget.id)}] = Date.now()
         wx.setStorageSync('kfl_eaten_v1', JSON.stringify(map))
         return true`
      )
    )
    await invoke(mp, 'page.loadDishes()')
    await sleep(1200)
    page = await current()
    const eatenFavData = await page.data()
    const eatenFavDish = (eatenFavData.allFavorites || []).find(
      dish => dish.id === eatenTarget.id
    )
    const eatenFavEl = await page.$('.fav-eaten')
    const eatenFavText = eatenFavEl ? String(await eatenFavEl.text()) : ''
    check(
      'mock 收藏卡最近吃过',
      Boolean(eatenFavDish) &&
        eatenFavDish.lastEatenText === '今天吃过' &&
        eatenFavText.indexOf('今天吃过') > -1,
      `${(eatenFavDish && eatenFavDish.lastEatenText) || '无'} · ${
        eatenFavText || '未渲染'
      }`
    )
    await mp.evaluate(
      new Function(
        `wx.setStorageSync('kfl_eaten_v1', ${JSON.stringify(eatenBeforeRestore)})
         return true`
      )
    )
    await invoke(mp, 'page.loadDishes()')
    await sleep(600)
  }
  check('mock 收藏默认最近排序', data.sort === 'recent')
  const favoriteCategory = (data.allFavorites[0] || {}).categoryId
  await invoke(
    mp,
    `page.onCategory({ currentTarget: { dataset: { id: ${JSON.stringify(
      favoriteCategory
    )} } } })`
  )
  await sleep(300)
  page = await current()
  data = await page.data()
  const categoryFiltered =
    (data.categories || []).length > 0 &&
    data.category === favoriteCategory &&
    (data.display || []).length > 0 &&
    data.display.every(dish => dish.categoryId === favoriteCategory)
  await invoke(
    mp,
    "page.onCategory({ currentTarget: { dataset: { id: 'no-such-category' } } })"
  )
  await sleep(300)
  page = await current()
  data = await page.data()
  const categoryEmpty =
    (data.display || []).length === 0 &&
    data.emptyTitle === '这个分类还没有收藏'
  await invoke(
    mp,
    "page.onCategory({ currentTarget: { dataset: { id: 'all' } } })"
  )
  await sleep(300)
  page = await current()
  data = await page.data()
  check(
    'mock 收藏按分类筛选',
    categoryFiltered &&
      categoryEmpty &&
      data.category === 'all' &&
      (data.display || []).length === (data.allFavorites || []).length,
    `${(data.categories || []).length} 个分类`
  )
  await invoke(
    mp,
    "page.onSort({ currentTarget: { dataset: { sort: 'price' } } })"
  )
  await sleep(300)
  page = await current()
  data = await page.data()
  check(
    'mock 收藏按价格排序',
    data.sort === 'price' &&
      (data.display || []).every(
        (dish, index, list) =>
          index === 0 || Number(list[index - 1].price) <= Number(dish.price)
      ),
    `${(data.display || []).length} 道`
  )
  const favoritesOriginal = data.allFavorites || []
  const favoriteBase = favoritesOriginal[0]
  if (favoriteBase) {
    await invoke(
      mp,
      `page.setData({ allFavorites: [
        ${JSON.stringify({
          ...favoriteBase,
          id: 'fav-old',
          name: '旧收藏',
          favoritedAt: 1000
        })},
        ${JSON.stringify({
          ...favoriteBase,
          id: 'fav-new',
          name: '新收藏',
          favoritedAt: 2000
        })}
      ], sort: 'recent' }, () => page.applyFilter())`
    )
    await sleep(400)
    page = await current()
    data = await page.data()
    check(
      'mock 收藏按时间排序',
      (data.display || []).length === 2 &&
        data.display[0].id === 'fav-new',
      (data.display || []).map(dish => dish.id).join(' / ')
    )
    await invoke(
      mp,
      `page.setData({ allFavorites: ${JSON.stringify(
        favoritesOriginal
      )}, sort: 'recent' }, () => page.applyFilter())`
    )
    await sleep(300)
  }
  const eatenSortBase = (favoritesOriginal || [])[0]
  if (eatenSortBase) {
    const eatNow = Date.now()
    await invoke(
      mp,
      `wx.setStorageSync('kfl_eaten_v1', JSON.stringify({ 'fav-old': ${
        eatNow - 86400000
      }, 'fav-new': ${eatNow} })); page.setData({ allFavorites: [
        ${JSON.stringify({
          ...eatenSortBase,
          id: 'fav-old',
          name: '旧菜',
          favoritedAt: 2000
        })},
        ${JSON.stringify({
          ...eatenSortBase,
          id: 'fav-new',
          name: '新菜',
          favoritedAt: 1000
        })}
      ] }, () => page.applyFilter()); return true`
    )
    await invoke(
      mp,
      "page.onSort({ currentTarget: { dataset: { sort: 'eaten' } } })"
    )
    await sleep(400)
    page = await current()
    data = await page.data()
    check(
      'mock 收藏按最近点过排序',
      data.sort === 'eaten' &&
        (data.display || []).length === 2 &&
        data.display[0].id === 'fav-new',
      (data.display || []).map(dish => dish.id).join(' / ')
    )
    await invoke(
      mp,
      `page.setData({ allFavorites: ${JSON.stringify(
        favoritesOriginal
      )}, sort: 'recent' }, () => page.applyFilter()); wx.removeStorageSync('kfl_eaten_v1'); return true`
    )
    await sleep(300)
  }
  await invoke(
    mp,
    "page.onSort({ currentTarget: { dataset: { sort: 'price' } } })"
  )
  await invoke(
    mp,
    `page.onCategory({ currentTarget: { dataset: { id: ${JSON.stringify(
      favoriteCategory
    )} } } })`
  )
  await sleep(300)
  await mp.navigateBack()
  await sleep(700)
  await mp.navigateTo('/pages/favorites/index')
  await sleep(1600)
  page = await current()
  data = await page.data()
  check(
    'mock 收藏记住排序与分类',
    data.sort === 'price' && data.category === favoriteCategory,
    `${data.sort} · ${data.category}`
  )
  await invoke(
    mp,
    "page.onSort({ currentTarget: { dataset: { sort: 'recent' } } })"
  )
  await invoke(
    mp,
    "page.onCategory({ currentTarget: { dataset: { id: 'all' } } })"
  )
  await sleep(300)
  await invoke(mp, 'page.onRandomFavorite()')
  await sleep(1600)
  page = await current()
  const randomFavoriteData = await page.data()
  const favoriteIds = (favoritesOriginal || []).map(dish => dish.id)
  check(
    'mock 收藏随机挑一道',
    page.path === 'pages/recipe/index' &&
      Boolean(randomFavoriteData.dish) &&
      favoriteIds.indexOf(randomFavoriteData.dish.id) > -1,
    randomFavoriteData.dish ? randomFavoriteData.dish.name : page.path
  )
  await mp.navigateBack()
  await sleep(900)
  page = await current()
  data = await page.data()
  await invoke(mp, 'page.onMakePoster()')
  await sleep(1200)
  page = await current()
  data = await page.data()
  check(
    'mock 收藏分享海报',
    data.posterPath !== '' && data.posterMaking === false,
    data.posterPath ? '已生成' : '未生成'
  )
  await invoke(
    mp,
    "wx.__savePosterOriginal = wx.saveImageToPhotosAlbum; wx.saveImageToPhotosAlbum = (o) => { wx.__savedPosterPath = o && o.filePath; o && o.success && o.success() }; true"
  )
  await invoke(mp, 'page.onSavePoster()')
  await sleep(400)
  const savedFavoritePoster = await mp.evaluate(
    () => wx.__savedPosterPath || ''
  )
  await invoke(
    mp,
    "wx.saveImageToPhotosAlbum = wx.__savePosterOriginal; delete wx.__savePosterOriginal; true"
  )
  check(
    'mock 收藏海报保存相册',
    String(savedFavoritePoster || '') === String(data.posterPath || ''),
    String(savedFavoritePoster || '')
  )
  await invoke(mp, 'page.onCyclePosterTheme()')
  await sleep(400)
  page = await current()
  data = await page.data()
  check(
    'mock 收藏海报换配色',
    Number(data.posterThemeIndex) === 1 && data.posterPath === '',
    `配色 ${data.posterThemeIndex}`
  )
  const posterThemeStored = await mp.evaluate(() =>
    wx.getStorageSync('kfl_favorites_poster_theme_v1')
  )
  check(
    'mock 收藏海报配色记忆写入',
    String(posterThemeStored) === '1',
    String(posterThemeStored)
  )
  await mp.evaluate(
    new Function(
      "wx.setStorageSync('kfl_favorites_cloud_v1', JSON.stringify({ ids: ['d02'], times: { d02: Date.now() - 600000 }, updatedAt: Date.now() + 60000 })); return true"
    )
  )
  await mp.navigateBack()
  await sleep(700)
  await mp.navigateTo('/pages/favorites/index')
  await sleep(1800)
  page = await current()
  data = await page.data()
  check(
    'mock 收藏云端拉取合并',
    (data.allFavorites || []).length === 2 &&
      (data.allFavorites || []).some(dish => dish.id === 'd01') &&
      (data.allFavorites || []).some(dish => dish.id === 'd02'),
    (data.allFavorites || []).map(dish => dish.id).join('/') || '没有收藏'
  )
  check(
    'mock 收藏海报配色记忆恢复',
    Number(data.posterThemeIndex) === 1,
    `配色 ${data.posterThemeIndex}`
  )
  await invoke(
    mp,
    "page.onSort({ currentTarget: { dataset: { sort: 'price' } } })"
  )
  await sleep(400)
  page = await current()
  data = await page.data()
  const copiedSortedList = await mp.evaluate(() => {
    return new Promise(resolve => {
      const timer = setTimeout(() => resolve(''), 2000)
      const original = wx.setClipboardData
      wx.setClipboardData = function (options) {
        wx.setClipboardData = original
        clearTimeout(timer)
        try {
          if (options && options.success) options.success()
        } catch (e) {}
        resolve(options && options.data)
      }
      const page = getCurrentPages()[getCurrentPages().length - 1]
      page.onCopyList()
    })
  })
  const sortedListLines = String(copiedSortedList || '').split('\n')
  const sortedPrices = (data.display || []).map(dish => Number(dish.price))
  const expectedListLines = (data.display || []).map(
    dish => `${dish.name} ¥${dish.price}`
  )
  check(
    'mock 收藏复制清单按排序',
    (data.display || []).length >= 2 &&
      data.sort === 'price' &&
      sortedPrices.every(
        (price, index) => index === 0 || sortedPrices[index - 1] <= price
      ) &&
      (data.display || []).map(dish => dish.id).join('/') !==
        (data.allFavorites || []).map(dish => dish.id).join('/') &&
      sortedListLines[0].indexOf('【我的收藏】') > -1 &&
      sortedListLines.length === expectedListLines.length + 1 &&
      expectedListLines.every(
        (line, index) => sortedListLines[index + 1] === line
      ),
    `${expectedListLines.length} 道 · ${sortedListLines[0] || '没有内容'}`
  )
  await mp.switchTab('/pages/home/index')
  await sleep(1500)
  const nonStapleFavId = await invoke(
    mp,
    "const sections = page.data.sections || []; for (const section of sections) { for (const dish of section.dishes || []) { if (dish.categoryId !== 'staple' && dish.status !== 'off' && dish.stock !== 0) { return dish.id } } } return ''"
  )
  await invoke(
    mp,
    `page.onDishFavorite({ detail: { dish: { id: ${JSON.stringify(
      nonStapleFavId
    )} } } })`
  )
  await sleep(500)
  await mp.navigateTo('/pages/favorites/index')
  await sleep(1600)
  page = await current()
  data = await page.data()
  const groupFlattenIds = (data.displayGroups || []).reduce(
    (list, group) => list.concat((group.dishes || []).map(dish => dish.id)),
    []
  )
  const favGroupHeadEl = await page.$('.fav-group-head')
  const favGroupHeadText = favGroupHeadEl
    ? String(await favGroupHeadEl.text())
    : ''
  check(
    'mock 收藏分类分组',
    Boolean(nonStapleFavId) &&
      (data.displayGroups || []).length >= 2 &&
      groupFlattenIds.join('/') ===
        (data.display || []).map(dish => dish.id).join('/') &&
      (data.displayGroups || []).every(group =>
        (group.dishes || []).every(
          dish => String(dish.categoryId) === group.id
        )
      ) &&
      favGroupHeadText.length > 0 &&
      favGroupHeadText.indexOf('道') > -1,
    `${(data.displayGroups || []).length} 组 · ${favGroupHeadText || '无表头'}`
  )
  await mp.switchTab('/pages/home/index')
  await sleep(1500)
  await invoke(
    mp,
    `page.onDishFavorite({ detail: { dish: { id: ${JSON.stringify(
      nonStapleFavId
    )} } } })`
  )
  await sleep(500)
  await mp.navigateTo('/pages/favorites/index')
  await sleep(1600)
  page = await current()
  data = await page.data()
  const favCard = await page.$('.fav-card')
  const favIdsBeforeLongPress = (data.allFavorites || []).map(dish => dish.id)
  if (favCard) {
    await favCard.longpress()
    await sleep(800)
  }
  page = await current()
  data = await page.data()
  if (String(page.path).indexOf('recipe') > -1) {
    await mp.navigateBack()
    await sleep(700)
    page = await current()
    data = await page.data()
  }
  const favIdsAfterLongPress = (data.allFavorites || []).map(dish => dish.id)
  check(
    'mock 收藏长按取消',
    favIdsBeforeLongPress.length === 2 &&
      favIdsAfterLongPress.length === 1,
    `${favIdsBeforeLongPress.join('/')} → ${favIdsAfterLongPress.join('/')}`
  )
  await mp.mockWxMethod('showModal', {
    confirm: true,
    cancel: false,
    content: ''
  })
  await invoke(mp, 'page.onClearAll()')
  await sleep(800)
  await mp.navigateBack()
  await sleep(700)

  // 口味档案：生日 / 纪念日选择、清除与保存
  const specialBirthday = `2000-${chinaDate(5).slice(5)}`
  const specialAnniversary = `2000-${chinaDate(0).slice(5)}`
  await mp.navigateTo('/pages/preferences/index')
  await sleep(1500)
  page = await current()
  data = await page.data()
  check(
    'mock 档案页加载',
    Boolean(page.path === 'pages/preferences/index') &&
      !data.loading &&
      !data.loadFailed,
    page.path
  )
  await invoke(
    mp,
    `page.onBirthday({ detail: { value: '${specialBirthday}' } })`
  )
  await invoke(
    mp,
    `page.onAnniversary({ detail: { value: '${specialAnniversary}' } })`
  )
  await sleep(200)
  page = await current()
  data = await page.data()
  check(
    'mock 生日纪念日选择',
    data.birthday === specialBirthday &&
      data.anniversary === specialAnniversary &&
      data.specialHint === '生日还有 5 天，纪念日今天',
    `${data.birthday} / ${data.anniversary} · ${data.specialHint}`
  )
  await invoke(mp, 'page.onClearBirthday()')
  await sleep(200)
  page = await current()
  data = await page.data()
  check('mock 生日可清除', data.birthday === '', data.birthday)
  await invoke(
    mp,
    `page.onBirthday({ detail: { value: '${specialBirthday}' } })`
  )
  await invoke(mp, 'page.onSave()')
  await sleep(1500)
  await mp.navigateTo('/pages/preferences/index')
  await sleep(1400)
  page = await current()
  data = await page.data()
  check(
    'mock 生日纪念日保存',
    data.birthday === specialBirthday &&
      data.anniversary === specialAnniversary,
    `${data.birthday} / ${data.anniversary}`
  )
  await mp.navigateBack()
  await sleep(800)
  await mp.switchTab('/pages/home/index')
  await sleep(1600)
  page = await current()
  data = await page.data()
  check(
    'mock 首页重要日子提醒',
    page.path === 'pages/home/index' &&
      String(data.specialBanner || '').indexOf('纪念日') > -1 &&
      String(data.specialBanner || '').indexOf('今天') > -1,
    data.specialBanner || '没有提醒'
  )
  const specialReminder = await page.$('.special-reminder')
  if (specialReminder) {
    await specialReminder.tap()
  }
  await sleep(1500)
  page = await current()
  check(
    'mock 重要日子去饭表',
    page.path === 'pages/week-menus/index',
    page.path
  )
  await mp.navigateBack()
  await sleep(800)

  // 菜谱大全
  await mp.navigateTo('/pages/recipe-list/index')
  await sleep(1600)
  page = await current()
  data = await page.data()
  const recipeSubEl = await page.$('.sub')
  const recipeSubText = recipeSubEl ? String(await recipeSubEl.text()) : ''
  check(
    'mock 菜谱大全',
    (data.groups || []).length > 0 &&
      data.total >= 1 &&
      recipeSubText.indexOf(`共 ${data.total} 道`) > -1,
    recipeSubText || `${data.total} 道带做法`
  )
  const recipeListShare = await invoke(mp, 'return page.onShareAppMessage()')
  const recipeListTimeline = await invoke(mp, 'return page.onShareTimeline()')
  check(
    'mock 菜谱大全分享标题带数量',
    data.total >= 1 &&
      String((recipeListShare && recipeListShare.title) || '').indexOf(
        String(data.total)
      ) > -1 &&
      String((recipeListTimeline && recipeListTimeline.title) || '').indexOf(
        String(data.total)
      ) > -1,
    (recipeListShare && recipeListShare.title) || '没有分享信息'
  )
  const sectionCountEl = await page.$('.section-count')
  const sectionCountText = sectionCountEl
    ? String(await sectionCountEl.text())
    : ''
  const initialRecipeRows = await page.$$('.row')
  const firstSectionDishes =
    ((data.displayGroups || [])[0] || {}).dishes || []
  check(
    'mock 菜谱分类道数',
    (data.displayGroups || []).length === 1 &&
      sectionCountText === `${initialRecipeRows.length} 道` &&
      initialRecipeRows.length === firstSectionDishes.length,
    `${sectionCountText || '未显示'} · 实际 ${initialRecipeRows.length} 行`
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
  const searchedRecipeRows = await page.$$('.row')
  const searchedCountEl = await page.$('.section-count')
  const searchedCountText = searchedCountEl
    ? String(await searchedCountEl.text())
    : ''
  check(
    'mock 菜谱分类道数跟随筛选',
    searchedRecipeRows.length >= 1 &&
      searchedRecipeRows.length < initialRecipeRows.length &&
      searchedCountText === `${searchedRecipeRows.length} 道`,
    `${searchedCountText || '未显示'} · 实际 ${searchedRecipeRows.length} 行`
  )
  await invoke(mp, "page.onSearch({ detail: { value: '1碗' } })")
  await sleep(400)
  page = await current()
  data = await page.data()
  check(
    'mock 菜谱按食材搜索',
    (data.displayGroups || []).length > 0 &&
      data.displayGroups.every(group =>
        group.dishes.every(dish => dish.id === 'd01')
      ),
    `${(data.displayGroups || []).reduce(
      (sum, group) => sum + group.dishes.length,
      0
    )} 道`
  )
  await invoke(mp, "page.onSearch({ detail: { value: '' } })")
  await sleep(300)
  const recipeFavTarget = await invoke(
    mp,
    "const groups = page.data.groupList || page.data.groups || []; let target = ''; groups.some(group => (group.dishes || []).some(dish => { if (!dish.favorite) { target = dish.id; return true } return false })); return target"
  )
  const readRecipeFavState = id =>
    mp.evaluate(
      new Function(
        `const page = getCurrentPages()[getCurrentPages().length - 1]
         const scan = groups => {
           let value = null
           ;(groups || []).some(group => (group.dishes || []).some(dish => {
             if (dish.id === ${JSON.stringify(id)}) { value = Boolean(dish.favorite) }
             return false
           }))
           return value
         }
         const inGroups = scan(page.data.groups)
         const inDisplay = scan(page.data.displayGroups)
         const stored = (() => {
           try { return JSON.parse(wx.getStorageSync('kfl_favorites_v1') || '[]') } catch (e) { return [] }
         })()
         return { groups: inGroups, display: inDisplay, stored: stored.indexOf(${JSON.stringify(
           id
         )}) > -1 }`
      )
    )
  await invoke(
    mp,
    `page.onToggleFavorite({ currentTarget: { dataset: { id: ${JSON.stringify(
      recipeFavTarget
    )} } } })`
  )
  await sleep(500)
  const recipeFavOn = await readRecipeFavState(recipeFavTarget)
  check(
    'mock 菜谱大全快捷收藏',
    Boolean(recipeFavTarget) &&
      recipeFavOn.groups === true &&
      recipeFavOn.display === true &&
      recipeFavOn.stored === true,
    `${recipeFavTarget} · ${recipeFavOn.groups ? '已收藏' : '未收藏'}`
  )
  await invoke(
    mp,
    `page.onToggleFavorite({ currentTarget: { dataset: { id: ${JSON.stringify(
      recipeFavTarget
    )} } } })`
  )
  await sleep(500)
  const recipeFavOff = await readRecipeFavState(recipeFavTarget)
  check(
    'mock 菜谱大全取消收藏',
    recipeFavOff.groups === false &&
      recipeFavOff.display === false &&
      recipeFavOff.stored === false,
    `${recipeFavTarget} · ${recipeFavOff.groups ? '仍收藏' : '已取消'}`
  )
  const firstHeartId = await invoke(
    mp,
    "const groups = page.data.displayGroups || []; const first = groups[0] && groups[0].dishes && groups[0].dishes[0]; return first ? first.id : ''"
  )
  const heartBeforeTap = await mp.evaluate(
    new Function(
      `try { return JSON.parse(wx.getStorageSync('kfl_favorites_v1') || '[]').indexOf(${JSON.stringify(
        firstHeartId
      )}) > -1 } catch (e) { return false }`
    )
  )
  const rowHeartEl = await page.$('.row-fav')
  if (rowHeartEl && firstHeartId) {
    await rowHeartEl.tap()
    await sleep(600)
  }
  let heartTapPage = await current()
  const heartTapPath = heartTapPage.path
  if (heartTapPath !== 'pages/recipe-list/index') {
    await mp.navigateBack()
    await sleep(800)
  }
  page = await current()
  const heartAfterTapState = await mp.evaluate(
    new Function(
      `const page = getCurrentPages()[getCurrentPages().length - 1]
       const flatten = groups => (groups || []).reduce((list, group) => list.concat(group.dishes || []), [])
       const inStore = (() => { try { return JSON.parse(wx.getStorageSync('kfl_favorites_v1') || '[]').indexOf(${JSON.stringify(
         firstHeartId
       )}) > -1 } catch (e) { return false } })()
       const dish = flatten(page.data.displayGroups).find(item => item.id === ${JSON.stringify(
         firstHeartId
       )})
       return { store: inStore, shown: dish ? Boolean(dish.favorite) : null }`
    )
  )
  const rowHeartAgain = await page.$('.row-fav')
  if (rowHeartAgain && firstHeartId) {
    await rowHeartAgain.tap()
    await sleep(600)
  }
  const heartRestored = await mp.evaluate(
    new Function(
      `try { return JSON.parse(wx.getStorageSync('kfl_favorites_v1') || '[]').indexOf(${JSON.stringify(
        firstHeartId
      )}) > -1 } catch (e) { return false }`
    )
  )
  check(
    'mock 菜谱大全点心形收藏',
    Boolean(firstHeartId) &&
      heartTapPath === 'pages/recipe-list/index' &&
      heartAfterTapState.store === !heartBeforeTap &&
      heartAfterTapState.shown === heartAfterTapState.store &&
      heartRestored === heartBeforeTap,
    `${firstHeartId} · ${heartBeforeTap ? '已收藏' : '未收藏'} → ${
      heartAfterTapState.store ? '已收藏' : '未收藏'
    } → ${heartRestored ? '已收藏' : '未收藏'}`
  )

  // 只看收藏筛选
  await invoke(
    mp,
    `page.onToggleFavorite({ currentTarget: { dataset: { id: ${JSON.stringify(
      recipeFavTarget
    )} } } })`
  )
  await sleep(400)
  await invoke(mp, 'page.onToggleFavOnly()')
  await sleep(400)
  const readRecipeListState = () =>
    mp.evaluate(
      new Function(
        `const page = getCurrentPages()[getCurrentPages().length - 1]
         const flatten = groups => (groups || []).reduce((list, group) => list.concat(group.dishes || []), [])
         const favIds = (() => {
           try { return JSON.parse(wx.getStorageSync('kfl_favorites_v1') || '[]') } catch (e) { return [] }
         })()
         const all = flatten(page.data.groups)
         const shown = flatten(page.data.displayGroups)
         return {
           favOnly: Boolean(page.data.favOnly),
           expected: all.filter(dish => favIds.indexOf(dish.id) > -1).map(dish => dish.id).sort(),
           shown: shown.map(dish => dish.id).sort(),
           shownRaw: shown.map(dish => dish.id),
           allCount: all.length,
           emptyTitle: String(page.data.emptyTitle || ''),
           emptyDesc: String(page.data.emptyDesc || '')
         }`
      )
    )
  const favOnlyState = await readRecipeListState()
  check(
    'mock 菜谱只看收藏',
    favOnlyState.favOnly === true &&
      favOnlyState.expected.length >= 1 &&
      favOnlyState.expected.join('/') === favOnlyState.shown.join('/'),
    `${favOnlyState.shown.length} 道收藏菜谱`
  )
  let favOnlyRandomOk = true
  let favOnlyRandomLast = ''
  for (let round = 0; round < 4; round += 1) {
    await invoke(mp, 'page.onRandomRecipe()')
    await sleep(1400)
    page = await current()
    const favOnlyRandom = await page.data()
    const favOnlyRandomId = favOnlyRandom.dish && favOnlyRandom.dish.id
    favOnlyRandomLast = favOnlyRandomId || ''
    if (
      page.path !== 'pages/recipe/index' ||
      !favOnlyRandomId ||
      favOnlyState.expected.indexOf(favOnlyRandomId) === -1
    ) {
      favOnlyRandomOk = false
    }
    await mp.navigateBack()
    await sleep(800)
    page = await current()
  }
  check(
    'mock 菜谱只看收藏随机',
    favOnlyRandomOk,
    `4 轮 · 最后 ${favOnlyRandomLast || '无'}`
  )
  await invoke(mp, "page.onSearch({ detail: { value: '不存在的菜xyz' } })")
  await sleep(400)
  await invoke(
    mp,
    "wx.__randomToast = ''; wx.__randomToastOrig = wx.showToast; wx.showToast = (o) => { wx.__randomToast = o && o.title; o && o.success && o.success() }; return true"
  )
  await invoke(mp, 'page.onRandomRecipe()')
  await sleep(400)
  const randomEmptyToast = await mp.evaluate(() => {
    const title = wx.__randomToast || ''
    if (wx.__randomToastOrig) {
      wx.showToast = wx.__randomToastOrig
    }
    delete wx.__randomToastOrig
    delete wx.__randomToast
    return title
  })
  check(
    'mock 菜谱筛选空随机提示',
    randomEmptyToast === '换个关键词再试',
    randomEmptyToast || '无提示'
  )
  await invoke(mp, 'page.onSearchClear()')
  await sleep(300)
  await invoke(
    mp,
    `page.onToggleFavorite({ currentTarget: { dataset: { id: ${JSON.stringify(
      recipeFavTarget
    )} } } })`
  )
  await sleep(400)
  const favOnlyRemoved = await readRecipeListState()
  check(
    'mock 菜谱只看收藏取消后移除',
    favOnlyRemoved.shownRaw.indexOf(recipeFavTarget) === -1 &&
      (favOnlyRemoved.expected.length
        ? favOnlyRemoved.shown.join('/') === favOnlyRemoved.expected.join('/')
        : favOnlyRemoved.emptyTitle === '还没收藏菜谱' &&
          favOnlyRemoved.emptyDesc.indexOf('收藏') > -1),
    `${favOnlyRemoved.shown.length} 道 · ${favOnlyRemoved.emptyTitle}`
  )
  await invoke(mp, 'page.onToggleFavOnly()')
  await sleep(400)
  const favOffState = await readRecipeListState()
  check(
    'mock 菜谱关闭只看收藏',
    favOffState.favOnly === false &&
      favOffState.shown.length === favOffState.allCount,
    `${favOffState.shown.length}/${favOffState.allCount} 道`
  )
  const recipePool = favOffState.shownRaw
  await invoke(mp, 'page.onRandomRecipe()')
  await sleep(1500)
  page = await current()
  const firstRandom = await page.data()
  const firstRandomId = firstRandom.dish && firstRandom.dish.id
  check(
    'mock 菜谱随机一道',
    page.path === 'pages/recipe/index' &&
      Boolean(firstRandomId) &&
      recipePool.indexOf(firstRandomId) > -1,
    firstRandomId || page.path
  )
  await mp.navigateBack()
  await sleep(900)
  page = await current()
  await invoke(mp, 'page.onRandomRecipe()')
  await sleep(1500)
  page = await current()
  const secondRandom = await page.data()
  const secondRandomId = secondRandom.dish && secondRandom.dish.id
  check(
    'mock 菜谱随机不重复',
    page.path === 'pages/recipe/index' &&
      Boolean(secondRandomId) &&
      secondRandomId !== firstRandomId &&
      recipePool.indexOf(secondRandomId) > -1,
    `${firstRandomId} → ${secondRandomId}`
  )
  await mp.navigateBack()
  await sleep(900)
  page = await current()
  await mp.navigateTo(`/pages/recipe/index?id=${recipeFavTarget}`)
  await sleep(1500)
  await invoke(mp, 'page.onToggleFavorite()')
  await sleep(300)
  await mp.navigateBack()
  await sleep(900)
  const syncedFav = await mp.evaluate(
    new Function(
      `const page = getCurrentPages()[getCurrentPages().length - 1]
       const flatten = groups => (groups || []).reduce((list, group) => list.concat(group.dishes || []), [])
       const pick = groups => {
         const dish = flatten(groups).find(item => item.id === ${JSON.stringify(
           recipeFavTarget
         )})
         return dish ? Boolean(dish.favorite) : null
       }
       return { groups: pick(page.data.groups), display: pick(page.data.displayGroups) }`
    )
  )
  check(
    'mock 菜谱大全收藏返回同步',
    syncedFav.groups === true && syncedFav.display === true,
    `${recipeFavTarget} · 数据 ${syncedFav.groups ? '已同步' : '未同步'} / 展示 ${
      syncedFav.display ? '已同步' : '未同步'
    }`
  )
  await invoke(
    mp,
    `page.onToggleFavorite({ currentTarget: { dataset: { id: ${JSON.stringify(
      recipeFavTarget
    )} } } })`
  )
  await sleep(300)

  // 菜谱搜索历史
  await invoke(mp, "page.onSearchConfirm({ detail: { value: '牛腩' } })")
  await sleep(400)
  await invoke(mp, 'page.onSearchClear()')
  await sleep(400)
  const recipeHistoryState = await mp.evaluate(() => {
    const page = getCurrentPages()[getCurrentPages().length - 1]
    const stored = (() => {
      try {
        return JSON.parse(wx.getStorageSync('kfl_recipe_search_v1') || '[]')
      } catch (e) {
        return []
      }
    })()
    return {
      history: page.data.recipeSearchHistory || [],
      stored,
      keyword: page.data.keyword
    }
  })
  const historyChipEl = await page.$('.search-history-chip')
  const historyChipText = historyChipEl ? String(await historyChipEl.text()) : ''
  check(
    'mock 菜谱搜索历史记录',
    recipeHistoryState.history[0] === '牛腩' &&
      recipeHistoryState.stored[0] === '牛腩' &&
      recipeHistoryState.keyword === '' &&
      historyChipText === '牛腩',
    `${recipeHistoryState.history.join('/') || '无'} · ${historyChipText || '无 chip'}`
  )
  if (historyChipEl) {
    await historyChipEl.tap()
    await sleep(500)
  }
  page = await current()
  data = await page.data()
  const historyTapDishes = (data.displayGroups || []).reduce(
    (list, group) => list.concat(group.dishes || []),
    []
  )
  check(
    'mock 菜谱搜索历史回填',
    data.keyword === '牛腩' &&
      historyTapDishes.length > 0 &&
      historyTapDishes.every(dish =>
        `${dish.name} ${dish.recipe || ''} ${(dish.ingredients || []).join(
          ' '
        )}`.indexOf('牛腩') > -1
      ),
    data.keyword
  )
  await invoke(mp, "page.onSearchConfirm({ detail: { value: '1碗' } })")
  await sleep(300)
  const searchClearEl = await page.$('.search-clear')
  if (searchClearEl) {
    await searchClearEl.tap()
    await sleep(400)
  }
  page = await current()
  data = await page.data()
  const historyChipsForRemove = await page.$$('.search-history-chip')
  let removedChip = false
  for (const chip of historyChipsForRemove) {
    const text = String(await chip.text())
    if (text === '1碗') {
      await chip.longpress()
      removedChip = true
      break
    }
  }
  await sleep(500)
  page = await current()
  data = await page.data()
  if (data.keyword) {
    await invoke(mp, 'page.onSearchClear()')
    await sleep(300)
  }
  const recipeHistoryAfterRemove = await mp.evaluate(() => {
    const page = getCurrentPages()[getCurrentPages().length - 1]
    const stored = (() => {
      try {
        return JSON.parse(wx.getStorageSync('kfl_recipe_search_v1') || '[]')
      } catch (e) {
        return []
      }
    })()
    return { history: page.data.recipeSearchHistory || [], stored }
  })
  check(
    'mock 菜谱搜索历史长按删除',
    removedChip &&
      recipeHistoryAfterRemove.history.indexOf('1碗') === -1 &&
      recipeHistoryAfterRemove.stored.indexOf('1碗') === -1 &&
      recipeHistoryAfterRemove.stored.indexOf('牛腩') > -1,
    recipeHistoryAfterRemove.history.join('/') || '无'
  )
  const historyClearEl = await page.$('.search-history-clear')
  if (historyClearEl) {
    await historyClearEl.tap()
    await sleep(400)
  }
  const recipeHistoryCleared = await mp.evaluate(() => {
    const page = getCurrentPages()[getCurrentPages().length - 1]
    let stored = []
    try {
      stored = JSON.parse(wx.getStorageSync('kfl_recipe_search_v1') || '[]')
    } catch (e) {}
    return { history: page.data.recipeSearchHistory || [], stored }
  })
  check(
    'mock 菜谱搜索历史清空',
    recipeHistoryCleared.history.length === 0 &&
      recipeHistoryCleared.stored.length === 0,
    '已清空'
  )
  await invoke(mp, "page.onSearchConfirm({ detail: { value: '牛腩' } })")
  await sleep(500)
  page = await current()
  data = await page.data()
  const activeSearchClearEl = await page.$('.search-clear')
  const activeSearchHistoryEl = await page.$('.search-history')
  check(
    'mock 菜谱搜索中状态',
    data.searching === true &&
      Boolean(activeSearchClearEl) &&
      !activeSearchHistoryEl &&
      (data.recipeSearchHistory || []).length >= 1,
    `× ${activeSearchClearEl ? '显示' : '缺失'} · 历史 ${
      activeSearchHistoryEl ? '未隐藏' : '已隐藏'
    }`
  )
  await invoke(mp, "page.onSearch({ detail: { value: '   ' } })")
  await sleep(400)
  page = await current()
  data = await page.data()
  const blankClearEl = await page.$('.search-clear')
  const blankHistoryEl = await page.$('.search-history')
  check(
    'mock 菜谱空白关键词状态',
    data.searching === false &&
      data.keyword === '   ' &&
      !blankClearEl &&
      Boolean(blankHistoryEl) &&
      (data.displayGroups || []).length > 0,
    `searching=${data.searching}`
  )
  await invoke(mp, 'page.onSearchClear()')
  await sleep(300)

  // 营业设置与公告
  await mp.navigateTo('/pages/business/index')
  await sleep(1600)
  page = await current()
  data = await page.data()
  check('mock 营业设置加载', Array.isArray(data.mealViews) && data.mealViews.length === 3)
  check(
    'mock 低库存阈值设置加载',
    String(data.lowStockThreshold) === '3',
    `${data.lowStockThreshold} 份`
  )
  check(
    'mock 休息日选项',
    Array.isArray(data.dateOptions) && data.dateOptions.length === 8
  )
  check(
    'mock 每周休息选项',
    Array.isArray(data.weekdays) && data.weekdays.length === 7
  )
  await invoke(
    mp,
    "page.setData({ notice: '今天只有一锅炖菜', noticeFrom: '2000-01-01', recommendText: '雨天暖胃', noticeUntil: '2099-01-01', dailyGoal: '200', monthlyGoal: '5000' })"
  )
  await invoke(mp, 'page.onSave()')
  await sleep(1000)
  await mp.switchTab('/pages/home/index')
  await sleep(1600)
  page = await current()
  data = await page.data()
  check('mock 今日公告展示', data.notice === '今天只有一锅炖菜', data.notice)
  check(
    'mock 推荐角标展示',
    data.recommendText === '雨天暖胃' && data.heroTag === '雨天暖胃',
    data.heroTag
  )
  // 过期公告不再展示
  await mp.navigateTo('/pages/business/index')
  await sleep(1200)
  await invoke(
    mp,
    "page.setData({ notice: '过期公告', noticeUntil: '2000-01-01' })"
  )
  await invoke(mp, 'page.onSave()')
  await sleep(1000)
  await mp.switchTab('/pages/home/index')
  await sleep(1600)
  page = await current()
  data = await page.data()
  check('mock 过期公告隐藏', data.notice === '', data.notice || '已隐藏')
  // 还原公告与推荐语
  await mp.navigateTo('/pages/business/index')
  await sleep(1200)
  page = await current()
  await invoke(
    mp,
    "page.setData({ notice: '', recommendText: '', noticeUntil: '' })"
  )
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

  // 低库存阈值：营业设置可改，厨房筛选跟随
  await mp.navigateTo('/pages/business/index')
  await sleep(1200)
  await invoke(mp, "page.setData({ lowStockThreshold: '0' })")
  await invoke(mp, 'page.onSave()')
  await sleep(1000)
  await mp.navigateTo('/pages/kitchen/index')
  await sleep(2300)
  page = await current()
  data = await page.data()
  check(
    'mock 低库存阈值生效',
    Number(data.lowStockThreshold) === 0,
    `${data.lowStockThreshold} 份`
  )
  await invoke(
    mp,
    "page.onDishFilter({ currentTarget: { dataset: { filter: 'low' } } })"
  )
  await sleep(400)
  page = await current()
  data = await page.data()
  const lowAtZero = (data.displayDishes || []).length
  await mp.navigateBack()
  await sleep(800)
  await mp.navigateTo('/pages/business/index')
  await sleep(1200)
  await invoke(mp, "page.setData({ lowStockThreshold: '3' })")
  await invoke(mp, 'page.onSave()')
  await sleep(1000)
  await mp.navigateTo('/pages/kitchen/index')
  await sleep(2300)
  await invoke(
    mp,
    "page.onDishFilter({ currentTarget: { dataset: { filter: 'low' } } })"
  )
  await sleep(400)
  page = await current()
  data = await page.data()
  check(
    'mock 低库存阈值恢复',
    Number(data.lowStockThreshold) === 3 &&
      (data.displayDishes || []).length > lowAtZero,
    `阈值0 ${lowAtZero} 道 → 阈值3 ${(data.displayDishes || []).length} 道`
  )
  await mp.navigateBack()
  await sleep(800)

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
    await mp.mockWxMethod('showActionSheet', { tapIndex: 0 })
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
  const weekShare = await invoke(mp, 'return page.onShareAppMessage()')
  const weekTimeline = await invoke(mp, 'return page.onShareTimeline()')
  check(
    'mock 饭表分享标题带区间',
    Boolean(String(data.rangeText || '').trim()) &&
      String((weekShare && weekShare.title) || '').indexOf(
        String(data.rangeText)
      ) > -1 &&
      String((weekTimeline && weekTimeline.title) || '').indexOf(
        String(data.rangeText)
      ) > -1,
    (weekShare && weekShare.title) || '没有分享信息'
  )
  const weekTextCopy = await mp.evaluate(() => {
    return new Promise(resolve => {
      const timer = setTimeout(() => resolve(''), 2000)
      const original = wx.setClipboardData
      wx.setClipboardData = function (options) {
        wx.setClipboardData = original
        clearTimeout(timer)
        try {
          if (options && options.success) options.success()
        } catch (e) {}
        resolve(options && options.data)
      }
      const page = getCurrentPages()[getCurrentPages().length - 1]
      page.onCopyWeekText()
    })
  })
  const weekTextLines = String(weekTextCopy || '').split('\n')
  check(
    'mock 饭表复制文字版',
    typeof weekTextCopy === 'string' &&
      weekTextLines.length === 8 &&
      weekTextLines[0].indexOf('【张饱饭堂】本周饭表') > -1 &&
      weekTextLines.slice(1).every(
        line =>
          line.indexOf('周') > -1 &&
          line.indexOf('：') > -1 &&
          (line.indexOf('早餐：') > -1 || line.indexOf('休息') > -1)
      ),
    `${weekTextLines.length} 行 · ${weekTextLines[0] || '空'}`
  )
  check(
    'mock 饭表标注特别日子',
    (data.days || []).some(
      day =>
        String(day.specialText || '').indexOf('生日') > -1 &&
        day.date === chinaDate(5)
    ) &&
      (data.days || []).some(
        day => String(day.specialText || '').indexOf('纪念日') > -1
      ),
    (data.days || [])
      .filter(day => day.specialText)
      .map(day => `${day.date} ${day.specialText}`)
      .join(' / ') || '没有标注'
  )
  check(
    'mock 饭表已订标记',
    (data.days || []).some(day =>
      (day.meals || []).some(meal => meal.booked)
    ),
    `${(data.days || []).reduce(
      (sum, day) => sum + (day.meals || []).filter(meal => meal.booked).length,
      0
    )} 餐已订`
  )
  await invoke(mp, 'page.onMakeWeekPoster()')
  await sleep(2200)
  page = await current()
  data = await page.data()
  check(
    'mock 本周饭表图片',
    Boolean(data.posterPath),
    data.posterPath ? '已生成' : '未生成'
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
  const weekDishChip = await page.$('.dish-chip')
  if (weekDishChip) {
    await weekDishChip.tap()
    await sleep(1600)
    page = await current()
    const weekRecipeData = await page.data()
    check(
      'mock 饭表菜品进菜谱',
      page.path === 'pages/recipe/index' &&
        Boolean(weekRecipeData.dish) &&
        String(weekRecipeData.dish.id || '').length > 0,
      weekRecipeData.dish ? weekRecipeData.dish.name : page.path
    )
    await mp.navigateBack()
    await sleep(900)
    page = await current()
    data = await page.data()
  } else {
    check('mock 饭表菜品进菜谱', false, '没有菜品可点')
  }
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
  check(
    'mock 订单评价表情',
    (data.displayOrders || []).some(
      order => ['😋', '🙂', '😵'].indexOf(order.ratingEmoji) > -1
    ),
    (data.displayOrders || [])
      .filter(order => order.ratingEmoji)
      .map(order => order.ratingEmoji)
      .join('/') || '没有评价'
  )
  const firstOrderGroup = (data.displayOrders || [])[0]
  if (firstOrderGroup) {
    const groupBeforeCount = (data.displayOrders || []).length
    await invoke(
      mp,
      `page.onToggleDate({ currentTarget: { dataset: { date: ${JSON.stringify(
        firstOrderGroup.groupKey
      )} } } })`
    )
    await sleep(400)
    page = await current()
    data = await page.data()
    const collapsedGroupRows = (data.displayOrders || []).filter(
      order => order.groupKey === firstOrderGroup.groupKey
    )
    const storedCollapsedDates = await mp.evaluate(() => {
      try {
        return JSON.parse(
          wx.getStorageSync('kfl_order_collapsed_dates_v1') || '{}'
        )
      } catch (e) {
        return {}
      }
    })
    check(
      'mock 订单按日期折叠',
      collapsedGroupRows.length === 1 &&
        collapsedGroupRows[0].collapsed === true &&
        (data.displayOrders || []).length ===
          groupBeforeCount - (firstOrderGroup.groupCount || 1) + 1 &&
        /^\d{2}-\d{2}$/.test(firstOrderGroup.groupDateText || '') &&
        storedCollapsedDates[firstOrderGroup.groupKey] === true,
      `${firstOrderGroup.dateText} · ${firstOrderGroup.groupCount} 单`
    )
    await invoke(
      mp,
      `page.onToggleDate({ currentTarget: { dataset: { date: ${JSON.stringify(
        firstOrderGroup.groupKey
      )} } } })`
    )
    await sleep(300)
    page = await current()
    data = await page.data()
  }
  check(
    'mock 订单菜品缩略图',
    (data.orders || []).some(order => Boolean(order.thumb)),
    `${(data.orders || []).filter(order => order.thumb).length} 单带图`
  )
  check(
    'mock 订单列表最新留言',
    (data.orders || []).some(order =>
      String(order.lastMessageText || '').includes('辛苦啦')
    ),
    (data.orders || [])
      .map(order => order.lastMessageText)
      .filter(Boolean)
      .join(' / ')
  )
  check(
    'mock 订单列表备注预览',
    (data.orders || []).some(order =>
      String(order.noteText || '').includes('明天的午饭')
    ),
    (data.orders || [])
      .map(order => order.noteText)
      .filter(Boolean)
      .join(' / ')
  )
  check(
    'mock 订单列表新留言标记',
    (data.orders || []).some(order => Number(order.messageBadge) >= 1),
    `${(data.orders || []).filter(order => order.messageBadge).length} 单有未读`
  )
  await invoke(mp, 'page.onPageScroll({ scrollTop: 800 })')
  await sleep(200)
  page = await current()
  data = await page.data()
  const backTopShown = data.showBackTop === true
  await invoke(mp, 'page.onPageScroll({ scrollTop: 100 })')
  await sleep(200)
  page = await current()
  data = await page.data()
  check(
    'mock 订单列表回到顶部按钮',
    backTopShown && data.showBackTop === false,
    backTopShown ? '滚动后显示、回滚后隐藏' : '未显示'
  )
  const visibleOrder = (data.displayOrders || []).find(
    order => !order.collapsed && order.no
  )
  const firstOrderCard = await page.$('.order.card')
  if (firstOrderCard && visibleOrder) {
    await firstOrderCard.longpress()
    await sleep(700)
    page = await current()
    if (String(page.path).indexOf('order-detail') > -1) {
      await mp.navigateBack()
      await sleep(800)
    }
  }
  const ordersCopyClip = await mp.evaluate(
    new Function(
      "return new Promise(resolve => wx.getClipboardData({ success: r => resolve(r.data || ''), fail: () => resolve('') }))"
    )
  )
  check(
    'mock 订单列表长按复制单号',
    Boolean(visibleOrder) &&
      String(ordersCopyClip || '') === String(visibleOrder.no),
    String(ordersCopyClip || '')
  )
  await invoke(
    mp,
    "page.onSelectMeal({ currentTarget: { dataset: { meal: 'lunch' } } })"
  )
  await sleep(400)
  page = await current()
  data = await page.data()
  check(
    'mock 订单餐次筛选',
    data.meal === 'lunch' &&
      (data.displayOrders || []).length > 0 &&
      data.displayOrders.every(order => order.meal === 'lunch'),
    `${(data.displayOrders || []).length} 单午餐`
  )
  await invoke(
    mp,
    "page.onSelectMeal({ currentTarget: { dataset: { meal: 'dinner' } } })"
  )
  await sleep(400)
  page = await current()
  data = await page.data()
  check(
    'mock 订单餐次空态',
    (data.displayOrders || []).length === 0 &&
      data.emptyTitle === '这个餐次还没有订单',
    data.emptyTitle
  )
  await invoke(
    mp,
    "page.onSelectMeal({ currentTarget: { dataset: { meal: 'all' } } })"
  )
  await sleep(300)
  check(
    'mock 订单本月汇总',
    String(data.monthText || '').indexOf('本月') === 0 &&
      String(data.monthText || '').indexOf('¥') > -1,
    data.monthText
  )
  const monthLine = await page.$('.month-line')
  if (monthLine) {
    await monthLine.tap()
    await sleep(1500)
    page = await current()
    check(
      'mock 订单本月汇总进足迹',
      page.path === 'pages/my-report/index',
      page.path
    )
    await mp.navigateBack()
    await sleep(900)
    page = await current()
    data = await page.data()
  } else {
    check('mock 订单本月汇总进足迹', false, '没有本月汇总')
  }
  check(
    'mock 订单分页初始态',
    data.hasMore === false && data.loadingMore === false,
    data.hasMore ? '还有更多' : '已全部加载'
  )
  const ordersBeforeMore = (data.orders || []).length
  await invoke(mp, 'page.setData({ hasMore: true })')
  await invoke(mp, 'page.onLoadMore()')
  await sleep(900)
  page = await current()
  data = await page.data()
  check(
    'mock 订单加载更多路径',
    data.hasMore === false &&
      data.loadingMore === false &&
      (data.orders || []).length === ordersBeforeMore,
    `${(data.orders || []).length} 单`
  )
  check(
    'mock 订单预订标记',
    (data.orders || []).some(order => order.isPreorder),
    `${(data.orders || []).filter(order => order.isPreorder).length} 单预订`
  )
  await invoke(
    mp,
    "page.onSelectFilter({ currentTarget: { dataset: { filter: 'rate' } } })"
  )
  await sleep(400)
  page = await current()
  data = await page.data()
  check(
    'mock 订单待评价筛选',
    data.filter === 'rate' &&
      (data.displayOrders || []).length === data.counts.rate &&
      data.displayOrders.every(
        order => order.status === 'completed' && !order.rating
      ),
    `${(data.displayOrders || []).length} 单`
  )
  await invoke(
    mp,
    "page.onSelectFilter({ currentTarget: { dataset: { filter: 'all' } } })"
  )
  await sleep(300)
  await invoke(
    mp,
    "page.onSelectFilter({ currentTarget: { dataset: { filter: 'preorder' } } })"
  )
  await sleep(400)
  page = await current()
  data = await page.data()
  check(
    'mock 订单预订筛选',
    data.filter === 'preorder' &&
      (data.displayOrders || []).length === data.counts.preorder &&
      data.displayOrders.every(
        order => order.isPreorder && order.status !== 'cancelled'
      ),
    `${(data.displayOrders || []).length} 单预订`
  )
  await invoke(
    mp,
    "page.onSelectFilter({ currentTarget: { dataset: { filter: 'all' } } })"
  )
  await sleep(300)

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

  await invoke(mp, "page.onSearch({ detail: { value: '多酱汁' } })")
  await sleep(400)
  page = await current()
  data = await page.data()
  check(
    'mock 订单备注搜索',
    data.displayOrders.length >= 1 &&
      data.displayOrders.every(order =>
        (order.items || []).some(item => String(item.note || '').indexOf('多酱汁') > -1)
      ),
    `关键词 多酱汁 → ${data.displayOrders.length} 单`
  )

  await invoke(mp, "page.onSearch({ detail: { value: 'zzz查无此单' } })")
  await sleep(400)
  page = await current()
  data = await page.data()
  check(
    'mock 订单搜索无结果',
    data.displayOrders.length === 0 &&
      data.keyword === 'zzz查无此单' &&
      data.emptyTitle === '没搜到相关订单',
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

  // 进行中订单显示排队提示
  await mp.navigateTo('/pages/order-detail/index?id=seed-1')
  await sleep(1600)
  page = await current()
  data = await page.data()
  check(
    'mock 订单排队提示',
    Boolean(data.order) &&
      data.order.status === 'pending' &&
      String(data.queueText || '').length > 0,
    data.queueText
  )
  await invoke(mp, 'page.onCopyOrderNo()')
  await sleep(500)
  const orderNoClip = await mp.evaluate(
    new Function(
      "return new Promise(resolve => wx.getClipboardData({ success: r => resolve(r.data || ''), fail: () => resolve('') }))"
    )
  )
  check(
    'mock 订单号复制',
    String(orderNoClip || '') === String(data.order.no),
    String(orderNoClip || '')
  )
  await invoke(
    mp,
    "page.onMessageInput({ detail: { value: '记得少放辣' } })"
  )
  await invoke(mp, 'page.onSendMessage()')
  await sleep(1200)
  page = await current()
  data = await page.data()
  const messageEls = await page.$$('.message-text')
  const messageText =
    messageEls.length > 0
      ? await messageEls[messageEls.length - 1].text()
      : ''
  check(
    'mock 订单留言',
    (data.messages || []).some(message => message.content === '记得少放辣') &&
      data.messageDraft === '' &&
      data.messageAnchor === `msg-${(data.messages || []).length - 1}` &&
      messageText.indexOf('记得少放辣') > -1,
    messageText || '没有留言'
  )
  await invoke(mp, 'page.load(true)')
  await sleep(900)
  page = await current()
  data = await page.data()
  check(
    'mock 留言已读回执',
    Boolean(data.order) &&
      data.order.viewerRole === 'customer' &&
      (data.messages || []).some(
        message => message.role === 'customer' && message.readText === '已读'
      ),
    (data.messages || [])
      .filter(message => message.readText)
      .map(message => message.readText)
      .join('/') || '没有回执'
  )
  await invoke(
    mp,
    "page.onCopyMessage({ currentTarget: { dataset: { content: '记得少放辣' } } })"
  )
  await sleep(500)
  const messageClip = await mp.evaluate(
    new Function(
      "return new Promise(resolve => wx.getClipboardData({ success: r => resolve(r.data || ''), fail: () => resolve('') }))"
    )
  )
  check(
    'mock 订单留言复制',
    String(messageClip || '') === '记得少放辣',
    String(messageClip || '')
  )
  await invoke(
    mp,
    "page.onMessagePreset({ currentTarget: { dataset: { text: '多放饭' } } })"
  )
  await sleep(300)
  page = await current()
  data = await page.data()
  check(
    'mock 订单留言快捷短语',
    data.messageDraft === '多放饭',
    data.messageDraft
  )
  await invoke(mp, "page.setData({ messageDraft: '' })")
  await sleep(200)
  await invoke(mp, 'page.onMakeOrderPoster()')
  await sleep(1400)
  page = await current()
  data = await page.data()
  check(
    'mock 订单小票图片',
    Boolean(data.posterPath) && data.posterMaking === false,
    data.posterPath ? '已生成' : '未生成'
  )
  await mp.mockWxMethod('showModal', {
    confirm: true,
    cancel: false,
    content: '少放辣'
  })
  await invoke(mp, 'page.onEditNote()')
  await sleep(700)
  page = await current()
  data = await page.data()
  check(
    'mock 改整单备注',
    Boolean(data.order) && data.order.note === '少放辣',
    data.order && data.order.note
  )
  await invoke(mp, 'page.onCopyOrderReceipt()')
  await sleep(600)
  const orderClip = await mp.evaluate(
    new Function(
      "return new Promise(resolve => wx.getClipboardData({ success: r => resolve(r.data || ''), fail: () => resolve('') }))"
    )
  )
  check(
    'mock 顾客复制小票',
    typeof orderClip === 'string' &&
      orderClip.indexOf('【张饱饭堂】') > -1 &&
      orderClip.indexOf(String(data.order.no)) > -1,
    `${String(orderClip || '').length} 字`
  )
  await invoke(
    mp,
    "page.setData({ order: Object.assign({}, page.data.order, { address: '测试地址 1 号' }) })"
  )
  await invoke(mp, 'page.onCopyAddress()')
  await sleep(500)
  const addressClip = await mp.evaluate(
    new Function(
      "return new Promise(resolve => wx.getClipboardData({ success: r => resolve(r.data || ''), fail: () => resolve('') }))"
    )
  )
  check(
    'mock 订单地址复制',
    String(addressClip || '') === '测试地址 1 号',
    String(addressClip || '')
  )
  const orderItemDishId = (data.order.items[0] || {}).dishId
  await invoke(
    mp,
    `page.onItemRecipe({ currentTarget: { dataset: { id: ${JSON.stringify(
      orderItemDishId
    )} } } })`
  )
  await sleep(1600)
  page = await current()
  const orderRecipeData = await page.data()
  check(
    'mock 订单菜品看做法',
    page.path === 'pages/recipe/index' &&
      Boolean(orderRecipeData.dish) &&
      orderRecipeData.dish.id === orderItemDishId,
    orderRecipeData.dish ? orderRecipeData.dish.name : page.path
  )
  await mp.navigateBack()
  await sleep(900)
  await invoke(
    mp,
    "page.onToggleItemFavorite({ currentTarget: { dataset: { id: 'd02', index: 0 } } })"
  )
  await sleep(1500)
  page = await current()
  data = await page.data()
  const itemFavOn = Boolean(
    data.order && data.order.items[0] && data.order.items[0].favorite
  )
  const itemFavStored = await mp.evaluate(() => {
    try {
      return JSON.parse(wx.getStorageSync('kfl_favorites_v1') || '[]')
    } catch (e) {
      return []
    }
  })
  const itemFavCloud = await mp.evaluate(() => {
    try {
      return JSON.parse(wx.getStorageSync('kfl_favorites_cloud_v1') || '{}')
    } catch (e) {
      return {}
    }
  })
  await invoke(
    mp,
    "page.onToggleItemFavorite({ currentTarget: { dataset: { id: 'd02', index: 0 } } })"
  )
  await sleep(1500)
  page = await current()
  data = await page.data()
  const itemFavStoredAfter = await mp.evaluate(() => {
    try {
      return JSON.parse(wx.getStorageSync('kfl_favorites_v1') || '[]')
    } catch (e) {
      return []
    }
  })
  const itemFavCloudAfter = await mp.evaluate(() => {
    try {
      return JSON.parse(wx.getStorageSync('kfl_favorites_cloud_v1') || '{}')
    } catch (e) {
      return {}
    }
  })
  check(
    'mock 订单菜品收藏',
    itemFavOn &&
      itemFavStored.indexOf('d02') > -1 &&
      Array.isArray(itemFavCloud.ids) &&
      itemFavCloud.ids.indexOf('d02') > -1 &&
      Boolean(data.order && data.order.items[0]) &&
      !data.order.items[0].favorite &&
      itemFavStoredAfter.indexOf('d02') === -1 &&
      Array.isArray(itemFavCloudAfter.ids) &&
      itemFavCloudAfter.ids.indexOf('d02') === -1,
    itemFavOn ? '可收藏/取消并同步云端' : '未收藏'
  )
  await mp.navigateBack()
  await sleep(900)
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
  check(
    'mock 订单详情过敏原',
    Boolean(data.order) &&
      (data.order.items || []).some(
        item =>
          Array.isArray(item.allergens) &&
          item.allergens.indexOf('花生') > -1
      ),
    data.order ? '含花生' : '没找到订单'
  )
  const orderFavIds = (data.order.items || [])
    .map(item => item.dishId)
    .filter(Boolean)
  await invoke(mp, 'page.onFavoriteAll()')
  await sleep(600)
  page = await current()
  const favAllData = await page.data()
  const favAllStored = await mp.evaluate(() => {
    try {
      return JSON.parse(wx.getStorageSync('kfl_favorites_v1') || '[]')
    } catch (e) {
      return []
    }
  })
  check(
    'mock 订单一键收藏整单',
    orderFavIds.length >= 1 &&
      orderFavIds.every(id => favAllStored.indexOf(id) > -1) &&
      (favAllData.order.items || []).every(
        item => !item.dishId || item.favorite === true
      ),
    `${orderFavIds.length} 道菜`
  )
  await invoke(
    mp,
    "wx.__favAllToast = ''; wx.__favAllToastOrig = wx.showToast; wx.showToast = (o) => { wx.__favAllToast = o && o.title; o && o.success && o.success() }; return true"
  )
  await invoke(mp, 'page.onFavoriteAll()')
  await sleep(400)
  const favAllAgainToast = await mp.evaluate(() => {
    const title = wx.__favAllToast || ''
    if (wx.__favAllToastOrig) {
      wx.showToast = wx.__favAllToastOrig
    }
    delete wx.__favAllToastOrig
    delete wx.__favAllToast
    return title
  })
  check(
    'mock 订单一键收藏跳过已收藏',
    favAllAgainToast === '都收藏过啦',
    favAllAgainToast || '无提示'
  )
  const originalOrderItems = await mp.evaluate(
    new Function(
      "const page = getCurrentPages()[getCurrentPages().length - 1]; return JSON.parse(JSON.stringify((page.data.order && page.data.order.items) || []))"
    )
  )
  await invoke(
    mp,
    "page.onToggleItemFavorite({ currentTarget: { dataset: { id: 'd01', index: 0 } } })"
  )
  await sleep(400)
  await invoke(
    mp,
    `page.setData({ 'order.items': [${JSON.stringify({
      dishId: 'd01',
      name: '番茄牛腩饭',
      qty: 1,
      lineTotal: 18
    })}, ${JSON.stringify({
      dishId: 'd01',
      name: '番茄牛腩饭',
      qty: 1,
      lineTotal: 18
    })}] })`
  )
  await sleep(300)
  await invoke(
    mp,
    "wx.__dedupeToast = ''; wx.__dedupeToastOrig = wx.showToast; wx.showToast = (o) => { wx.__dedupeToast = o && o.title; o && o.success && o.success() }; return true"
  )
  await invoke(mp, 'page.onFavoriteAll()')
  await sleep(400)
  const dedupeToast = await mp.evaluate(() => {
    const title = wx.__dedupeToast || ''
    if (wx.__dedupeToastOrig) {
      wx.showToast = wx.__dedupeToastOrig
    }
    delete wx.__dedupeToastOrig
    delete wx.__dedupeToast
    return title
  })
  const dedupeStored = await mp.evaluate(() => {
    try {
      return JSON.parse(wx.getStorageSync('kfl_favorites_v1') || '[]')
    } catch (e) {
      return []
    }
  })
  const dedupeItems = await mp.evaluate(
    new Function(
      "const page = getCurrentPages()[getCurrentPages().length - 1]; return ((page.data.order && page.data.order.items) || []).map(item => Boolean(item.favorite))"
    )
  )
  check(
    'mock 订单一键收藏去重',
    dedupeToast === '已收藏 1 道' &&
      dedupeStored.indexOf('d01') > -1 &&
      (dedupeItems || []).length === 2 &&
      dedupeItems.every(Boolean),
    `${dedupeToast || '无提示'} · ${
      Array.isArray(dedupeStored) ? dedupeStored.join('/') : ''
    }`
  )
  await invoke(
    mp,
    `page.setData({ 'order.items': ${JSON.stringify(originalOrderItems)} })`
  )
  await sleep(300)
  const stepDeltas = (data.steps || [])
    .map(step => step.deltaText)
    .filter(Boolean)
    .join(' / ')
  check(
    'mock 订单时间轴等待时长',
    stepDeltas === '5 分钟 / 10 分钟 / 15 分钟 / 10 分钟',
    stepDeltas
  )
  await invoke(mp, 'page.onCopyOrderReceipt()')
  await sleep(400)
  const allergyReceipt = await mp.evaluate(
    new Function(
      "return new Promise(resolve => wx.getClipboardData({ success: r => resolve(r.data || ''), fail: () => resolve('') }))"
    )
  )
  check(
    'mock 小票过敏原',
    String(allergyReceipt || '').indexOf('含：花生') > -1,
    `${String(allergyReceipt || '').length} 字`
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
    await invoke(
      mp,
      'page.setData({ ratingTagOptions: page.data.ratingTagOptions.map(item => ({ name: item.name, active: false })) })'
    )
    await invoke(
      mp,
      'page.onToggleRatingTag({ currentTarget: { dataset: { index: 0 } } })'
    )
    await invoke(
      mp,
      "page.setData({ ratingImages: ['http://tmp/review-test.png'] })"
    )
    await invoke(mp, 'page.onSubmitRating()')
    await sleep(900)
    page = await current()
    data = await page.data()
    check('mock 提交评价', data.rating === 3, `评分 ${data.rating}`)
    check(
      'mock 评价标签',
      Boolean(data.order) &&
        Array.isArray(data.order.ratingTags) &&
        data.order.ratingTags.indexOf('好吃') > -1,
      data.order ? (data.order.ratingTags || []).join('、') : '没有订单'
    )
    check(
      'mock 评价晒图',
      Boolean(data.order) &&
        Array.isArray(data.order.ratingImages) &&
        data.order.ratingImages.indexOf('http://tmp/review-test.png') > -1,
      data.order ? (data.order.ratingImages || []).join('、') : '没有订单'
    )
    await invoke(mp, 'page.onCopyOrderReceipt()')
    await sleep(600)
    const ratedReceipt = await mp.evaluate(
      new Function(
        "return new Promise(resolve => wx.getClipboardData({ success: r => resolve(r.data || ''), fail: () => resolve('') }))"
      )
    )
    check(
      'mock 小票含评价',
      String(ratedReceipt || '').indexOf('评价：😋 好吃') > -1,
      `${String(ratedReceipt || '').length} 字`
    )

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
    check(
      'mock 评价标签展示',
      (data.reviews || []).some(
        review => Array.isArray(review.tags) && review.tags.length > 0
      ),
      `${(data.reviews || []).filter(review => (review.tags || []).length).length} 条带标签`
    )
    check(
      'mock 评价菜品图标',
      (data.reviews || []).some(
        review => String(review.dishes || '').indexOf('🍛') > -1
      ),
      (data.reviews || [])[0] ? data.reviews[0].dishes : '没有评价'
    )
    const firstReview = (data.reviews || [])[0]
    if (firstReview) {
      await mp.evaluate(
        new Function(
          "return new Promise(resolve => wx.setClipboardData({ data: '__clip_sentinel__', success: () => resolve(true), fail: () => resolve(false) }))"
        )
      )
      const reviewCardEl = await page.$('.review.card')
      if (reviewCardEl) {
        await reviewCardEl.longpress()
        await sleep(700)
      }
      page = await current()
      data = await page.data()
      const reviewClip = await mp.evaluate(
        new Function(
          "return new Promise(resolve => wx.getClipboardData({ success: r => resolve(r.data || ''), fail: () => resolve('') }))"
        )
      )
      const expectedReviewHead = `${firstReview.dateText} · ${firstReview.mealText} · ${firstReview.emoji}${firstReview.label}`
      check(
        'mock 长按复制评价',
        page.path === 'pages/reviews/index' &&
          Boolean(reviewCardEl) &&
          String(reviewClip || '').indexOf(expectedReviewHead) > -1,
        `${String(reviewClip || '').length} 字`
      )
    }
    check(
      'mock 评价晒图展示',
      (data.reviews || []).some(
        review => Array.isArray(review.images) && review.images.length > 0
      ),
      `${(data.reviews || []).filter(review => (review.images || []).length).length} 条带图`
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
    await invoke(
      mp,
      "page.onSelectFilter({ currentTarget: { dataset: { filter: 'all' } } })"
    )
    await invoke(
      mp,
      "page.onSelectMeal({ currentTarget: { dataset: { meal: 'lunch' } } })"
    )
    await sleep(400)
    page = await current()
    data = await page.data()
    check(
      'mock 我的评价按餐次筛选',
      data.meal === 'lunch' &&
        (data.display || []).length > 0 &&
        data.display.every(review => review.meal === 'lunch'),
      `午餐 ${(data.display || []).length} 条`
    )
    await invoke(
      mp,
      "page.onSelectMeal({ currentTarget: { dataset: { meal: 'all' } } })"
    )
    await invoke(
      mp,
      "page.onSort({ currentTarget: { dataset: { sort: 'rating' } } })"
    )
    await sleep(400)
    page = await current()
    data = await page.data()
    check(
      'mock 我的评价评分排序',
      data.sort === 'rating' &&
        (data.display || []).every(
          (review, index, list) =>
            index === 0 || Number(list[index - 1].rating) >= Number(review.rating)
        ),
      `${(data.display || []).length} 条`
    )
    await invoke(mp, 'page.onToggleImages()')
    await sleep(400)
    page = await current()
    data = await page.data()
    check(
      'mock 我的评价只看有图',
      data.onlyImages === true &&
        Number(data.imageCount) >= 1 &&
        (data.display || []).length === Number(data.imageCount) &&
        data.display.every(review => (review.images || []).length > 0),
      `${(data.display || []).length} 条带图`
    )
    await invoke(mp, 'page.onToggleImages()')
    await sleep(300)
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
    const historyTagOption = (data.historyTags || []).find(
      item => item.name === '好吃'
    )
    if (historyTagOption) {
      await invoke(
        mp,
        "page.onHistoryTag({ currentTarget: { dataset: { tag: '好吃' } } })"
      )
      await sleep(400)
      page = await current()
      data = await page.data()
      check(
        'mock 厨房历史标签筛选',
        data.historyTag === '好吃' &&
          (data.historyView || []).length > 0 &&
          data.historyView.every(
            order => (order.ratingTags || []).indexOf('好吃') > -1
          ),
        `${(data.historyView || []).length} 单`
      )
      await invoke(
        mp,
        "page.onHistoryTag({ currentTarget: { dataset: { tag: 'all' } } })"
      )
      await sleep(300)
      page = await current()
      data = await page.data()
    }
    const pendingLowOrder = {
      id: 'pending-low-test',
      no: '901',
      status: 'completed',
      statusText: '已完成',
      scheduledDate: chinaDate(0),
      createdAt: Date.now(),
      meal: 'lunch',
      mealText: '午餐',
      rating: 1,
      canReply: true,
      ownerReply: '',
      items: [{ dishId: 'd01', name: '差评测试菜', price: 1, qty: 1 }],
      summary: '差评测试菜',
      dateText: '',
      timeText: ''
    }
    await invoke(
      mp,
      `page.setData({ history: page.data.history.concat([${JSON.stringify(
        pendingLowOrder
      )}]) }, () => page.applyHistoryFilter())`
    )
    await sleep(300)
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
        (data.historyView || []).length === repliesBefore + 1 &&
        data.historyView.every(
          order => order.canReply && !order.ownerReply
        ) &&
        Number(data.historyView[0].rating) === 1 &&
        data.historyView.every(
          (order, index, list) =>
            index === 0 ||
            Number(list[index - 1].rating || 0) <= Number(order.rating || 0)
        ),
      `${(data.historyView || []).length} 条`
    )
    await invoke(
      mp,
      "page.setData({ history: page.data.history.filter(order => order.id !== 'pending-low-test') }, () => page.applyHistoryFilter())"
    )
    await sleep(300)
    page = await current()
    data = await page.data()
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
    await mp.navigateTo('/pages/reviews/index')
    await sleep(1600)
    page = await current()
    data = await page.data()
    const repliedReviewCount = Number(data.replyCount || 0)
    check(
      'mock 我的评价有回复数',
      repliedReviewCount >= 1 && data.onlyReplied === false,
      `${repliedReviewCount} 条有回复`
    )
    await invoke(mp, 'page.onToggleReplied()')
    await sleep(400)
    page = await current()
    data = await page.data()
    check(
      'mock 我的评价只看有回复',
      data.onlyReplied === true &&
        repliedReviewCount >= 1 &&
        (data.display || []).length === repliedReviewCount &&
        (data.display || []).every(review => Boolean(review.reply)),
      `${(data.display || []).length} 条`
    )
    await invoke(mp, 'page.onToggleReplied()')
    await sleep(300)
    await mp.navigateBack()
    await sleep(900)
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
      (data.report.topDishes || []).length >= 1 &&
      Boolean(data.health) &&
      data.health.total >= 1 &&
      data.health.lowStock >= 1 &&
      data.health.noCost >= 1,
    data.report
      ? `${data.report.totalOrders} 单 / ¥${data.report.revenue}`
      : '没有数据'
  )
  await invoke(mp, 'page.onCopySummary()')
  await sleep(600)
  const reportClip = await mp.evaluate(
    new Function(
      "return new Promise(resolve => wx.getClipboardData({ success: r => resolve(r.data || ''), fail: () => resolve('') }))"
    )
  )
  check(
    'mock 月报复制小结',
    String(reportClip || '').indexOf('经营小结') > -1 &&
      String(reportClip || '').indexOf('营收 ¥') > -1 &&
      String(reportClip || '').indexOf(String(data.report.totalOrders)) > -1,
    `${String(reportClip || '').length} 字`
  )
  const categoryRevenue = (data.categoryStats || []).reduce(
    (sum, item) => sum + Number(item.revenue || 0),
    0
  )
  const reportRevenue = Number((data.report || {}).revenue || 0)
  const categoryCostShape = (data.categoryStats || []).every(
    item =>
      Object.prototype.hasOwnProperty.call(item, 'profit') &&
      (item.profit === null ||
        (Number.isFinite(Number(item.cost)) &&
          Number.isFinite(Number(item.margin))))
  )
  const categoryHasIncompleteCost = (data.categoryStats || []).some(
    item => item.profit === null
  )
  check(
    'mock 月报分类表现',
    (data.categoryStats || []).length >= 1 &&
      Math.abs(categoryRevenue - reportRevenue) < 0.1 &&
      categoryCostShape &&
      categoryHasIncompleteCost,
    `${(data.categoryStats || []).length} 个分类 / ¥${categoryRevenue}`
  )
  const rangeExportCount = await invoke(
    mp,
    'return page.ordersInRange([{ createdAt: Date.now() }, { createdAt: Date.now() - 40 * 24 * 60 * 60 * 1000 }]).length'
  )
  check(
    'mock 月报订单区间筛选',
    Number(rangeExportCount) === 1,
    `${rangeExportCount} 单在区间内`
  )
  await invoke(mp, 'page.onExportCategories()')
  await sleep(500)
  const categoryCsv = await mp.evaluate(
    new Function(
      "return new Promise(resolve => wx.getClipboardData({ success: r => resolve(r.data || ''), fail: () => resolve('') }))"
    )
  )
  check(
    'mock 月报分类 CSV',
    String(categoryCsv || '').indexOf('分类,份数,营收,成本,毛利,毛利率') >
      -1 &&
      String(categoryCsv || '').indexOf(
        String(((data.categoryStats || [])[0] || {}).name || '')
      ) > -1,
    `${String(categoryCsv || '').length} 字`
  )
  await invoke(mp, 'page.onExportCategoriesFile()')
  await sleep(1000)
  page = await current()
  data = await page.data()
  check(
    'mock 月报分类 CSV 文件',
    data.categoriesFileReady === true &&
      data.categoriesFileBusy === false,
    data.categoriesFileReady ? '已生成' : '未生成'
  )
  await invoke(mp, 'page.onMakeCategoryPoster()')
  await sleep(1500)
  page = await current()
  data = await page.data()
  check(
    'mock 月报分类表现图片',
    Boolean(data.categoryPosterPath) &&
      data.categoryPosterMaking === false,
    data.categoryPosterPath ? '已生成' : '未生成'
  )
  await invoke(
    mp,
    "wx.__saveOriginal = wx.saveImageToPhotosAlbum; wx.saveImageToPhotosAlbum = (o) => { wx.__savedPoster = o && o.filePath; o && o.success && o.success() }; true"
  )
  await invoke(mp, 'page.onSaveCategoryPoster()')
  await sleep(400)
  const savedCategoryPoster = await mp.evaluate(
    () => wx.__savedPoster || ''
  )
  await invoke(
    mp,
    "wx.saveImageToPhotosAlbum = wx.__saveOriginal; delete wx.__saveOriginal; true"
  )
  check(
    'mock 分类图保存相册',
    String(savedCategoryPoster || '') === String(data.categoryPosterPath || ''),
    String(savedCategoryPoster || '')
  )
  await invoke(
    mp,
    "page.onCategorySort({ currentTarget: { dataset: { sort: 'qty' } } })"
  )
  await sleep(400)
  page = await current()
  data = await page.data()
  const qtySorted = (data.categoryStats || []).every(
    (item, index, list) =>
      index === 0 || Number(list[index - 1].qty) >= Number(item.qty)
  )
  check(
    'mock 月报分类按份数排序',
    data.categorySort === 'qty' && qtySorted,
    (data.categoryStats || []).map(item => item.qty).join(' / ')
  )
  await invoke(
    mp,
    "page.onCategorySort({ currentTarget: { dataset: { sort: 'revenue' } } })"
  )
  await sleep(300)
  page = await current()
  data = await page.data()
  const firstCategoryStat = (data.categoryStats || [])[0]
  if (firstCategoryStat) {
    await invoke(
      mp,
      `page.onCategoryTap({ currentTarget: { dataset: { id: ${JSON.stringify(
        firstCategoryStat.id
      )} } } })`
    )
    await sleep(1900)
    page = await current()
    data = await page.data()
    check(
      'mock 月报分类查看菜品',
      page.path === 'pages/kitchen/index' &&
        data.dishCategory === firstCategoryStat.id &&
        (data.displayDishes || []).length > 0 &&
        data.displayDishes.every(
          dish => dish.categoryId === firstCategoryStat.id
        ),
      `${firstCategoryStat.name} → ${(data.displayDishes || []).length} 道`
    )
    await mp.navigateBack()
    await sleep(1000)
    page = await current()
    data = await page.data()
  }
  const topReportTag = ((data.report || {}).topTags || [])[0]
  if (topReportTag) {
    await invoke(
      mp,
      `page.onTagTap({ currentTarget: { dataset: { name: ${JSON.stringify(
        topReportTag.name
      )} } } })`
    )
    await sleep(1900)
    page = await current()
    data = await page.data()
    check(
      'mock 月报标签查看订单',
      page.path === 'pages/kitchen/index' &&
        data.showHistory === true &&
        data.historyKeyword === topReportTag.name &&
        (data.historyView || []).length > 0 &&
        data.historyView.every(
          order =>
            (order.ratingTags || []).indexOf(topReportTag.name) > -1 ||
            String(order.feedback || '').indexOf(topReportTag.name) > -1
        ),
      `${topReportTag.name} → ${(data.historyView || []).length} 单`
    )
    await mp.navigateBack()
    await sleep(1000)
    page = await current()
    data = await page.data()
  }
  const topDishId = ((data.report || {}).topDishes || [])[0]
    ? data.report.topDishes[0].id
    : ''
  check('mock 月报菜品带 ID', Boolean(topDishId), topDishId || '没有 ID')
  await invoke(
    mp,
    `page.onDishTap({ currentTarget: { dataset: { id: ${JSON.stringify(
      topDishId
    )} } } })`
  )
  await sleep(1800)
  page = await current()
  data = await page.data()
  check(
    'mock 月报菜品进菜谱',
    page.path === 'pages/recipe/index' &&
      Boolean(data.dish) &&
      data.dish.id === topDishId,
    page.path
  )
  await mp.navigateBack()
  await sleep(1200)
  await invoke(
    mp,
    "page.onRange({ currentTarget: { dataset: { range: 7 } } })"
  )
  await sleep(1600)
  page = await current()
  data = await page.data()
  check(
    'mock 月报切换近7天',
    Number(data.range) === 7 &&
      data.report.days === 7 &&
      (data.report.daily || []).length === 7 &&
      data.compare === null,
    `${data.report.days} 天 · ${(data.report.daily || []).length} 个数据点 · 周对比${data.compare ? '显示' : '隐藏'}`
  )
  await invoke(
    mp,
    "page.onRange({ currentTarget: { dataset: { range: 30 } } })"
  )
  await sleep(1600)
  page = await current()
  data = await page.data()
  const weekSum = list =>
    Number(
      list.reduce((sum, day) => sum + Number(day.amount || 0), 0).toFixed(2)
    )
  const weekCount = list =>
    list.reduce((sum, day) => sum + Number(day.count || 0), 0)
  const reportDaily = (data.report && data.report.daily) || []
  const lastWeek = reportDaily.slice(-7)
  const prevWeek = reportDaily.slice(-14, -7)
  check(
    'mock 月报周对比',
    Boolean(data.compare) &&
      data.compare.thisRevenue === weekSum(lastWeek) &&
      data.compare.prevRevenue === weekSum(prevWeek) &&
      data.compare.thisCount === weekCount(lastWeek) &&
      data.compare.prevCount === weekCount(prevWeek),
    data.compare
      ? `本周 ¥${data.compare.thisRevenue} / 上周 ¥${data.compare.prevRevenue}`
      : '没有对比'
  )
  check(
    'mock 月报评价标签',
    Array.isArray(data.report.topTags) &&
      data.report.topTags.length >= 1 &&
      data.report.topTags.some(tag => tag.name === '好吃'),
    (data.report.topTags || [])
      .map(tag => `${tag.name}×${tag.count}`)
      .join('、')
  )
  check(
    'mock 月报餐次分布',
    Array.isArray(data.report.mealStats) &&
      data.report.mealStats.length === 3 &&
      data.report.mealStats.reduce((sum, item) => sum + item.count, 0) ===
        data.report.totalOrders,
    (data.report.mealStats || [])
      .map(item => `${item.meal}:${item.count}`)
      .join(' ')
  )
  const lunchMealStat = (data.report.mealStats || []).find(
    item => item.meal === 'lunch'
  )
  if (lunchMealStat) {
    await invoke(
      mp,
      "page.onMealTap({ currentTarget: { dataset: { meal: 'lunch' } } })"
    )
    await sleep(1900)
    page = await current()
    data = await page.data()
    check(
      'mock 月报餐次查看订单',
      page.path === 'pages/kitchen/index' &&
        data.orderMeal === 'lunch' &&
        (data.ordersView || []).length >= 1 &&
        data.ordersView.every(order => order.meal === 'lunch'),
      `${(data.ordersView || []).length} 单午餐`
    )
    await mp.navigateBack()
    await sleep(1000)
    page = await current()
    data = await page.data()
  }
  check(
    'mock 月报好评菜品',
    Array.isArray(data.report.topRatedDishes) &&
      data.report.minRatedOrders === 2 &&
      data.report.topRatedDishes.some(
        item =>
          item.name === '番茄牛腩饭' &&
          item.avgRating === 2.5 &&
          item.ratedCount === 2
      ) &&
      data.report.topRatedDishes.every(
        item =>
          Object.keys(item).sort().join(',') ===
          'avgRating,name,ratedCount'
      ),
    (data.report.topRatedDishes || [])
      .map(item => `${item.name}:${item.avgRating}/${item.ratedCount}`)
      .join(' ')
  )
  const slowDishes = data.report.slowDishes || []
  check(
    'mock 月报回复率',
    Number(data.report.repliedRatings) === 2 &&
      Number(data.report.ratedCount) === 2 &&
      Number(data.report.replyRate) === 100,
    `${data.report.repliedRatings}/${data.report.ratedCount} · ${data.report.replyRate}%`
  )
  check(
    'mock 月报成本毛利',
    Number(data.report.costStats.qty) === 2 &&
      Number(data.report.costStats.revenue) === 36 &&
      Number(data.report.costStats.cost) === 12 &&
      Number(data.report.costStats.profit) === 24 &&
      Number(data.report.costStats.margin) === 67,
    `¥${data.report.costStats.revenue} - ¥${data.report.costStats.cost} = ¥${data.report.costStats.profit} · ${data.report.costStats.margin}%`
  )
  const monthRevenue = Number(data.report.monthRevenue)
  const expectedMonthPercent = Math.min(
    100,
    Math.round((monthRevenue / 5000) * 100)
  )
  const expectedMonthText =
    monthRevenue >= 5000
      ? '本月达标啦 🎉'
      : `还差 ¥${Number((5000 - monthRevenue).toFixed(2))}`
  check(
    'mock 月报月度目标',
    monthRevenue > 0 &&
      Number(data.monthlyGoal) === 5000 &&
      Number(data.monthGoalPercent) === expectedMonthPercent &&
      data.monthGoalText === expectedMonthText,
    `¥${monthRevenue} / ¥5000 · ${data.monthGoalPercent}% · ${data.monthGoalText}`
  )
  const reportForMonth = data.report || {}
  check(
    'mock 月报上月同期',
    Boolean(reportForMonth.previousMonth) &&
      Number(reportForMonth.previousMonth.orders) === 0 &&
      Number(reportForMonth.monthOrders) >= 1 &&
      Boolean(data.monthCompare) &&
      data.monthCompare.text === '上月同期还没有营收' &&
      data.monthCompare.rangeText.indexOf(' - ') > -1,
    data.monthCompare
      ? `${data.monthCompare.rangeText} · ${data.monthCompare.text}`
      : '没有上月同期数据'
  )
  const d01ReportRow = (data.report.dishRows || []).find(
    item => item.name === '番茄牛腩饭'
  )
  check(
    'mock 月报全部菜品数据',
    Boolean(d01ReportRow) &&
      Number(d01ReportRow.qty) === 2 &&
      Number(d01ReportRow.revenue) === 36 &&
      Number(d01ReportRow.cost) === 12 &&
      Number(d01ReportRow.profit) === 24 &&
      Number(d01ReportRow.margin) === 67,
    d01ReportRow
      ? `¥${d01ReportRow.revenue} - ¥${d01ReportRow.cost} = ¥${d01ReportRow.profit}`
      : '没找到番茄牛腩饭'
  )
  await invoke(mp, 'page.onExportDishes()')
  await sleep(500)
  const dishCsv = await mp.evaluate(
    new Function(
      "return new Promise(resolve => wx.getClipboardData({ success: r => resolve(r.data || ''), fail: () => resolve('') }))"
    )
  )
  check(
    'mock 菜品销量 CSV',
    dishCsv.indexOf('菜品,状态,销量,营收,成本,毛利,毛利率') > -1 &&
      dishCsv.indexOf('番茄牛腩饭') > -1,
    `${String(dishCsv || '').length} 字`
  )
  await invoke(mp, 'page.onExportDishesFile()')
  await sleep(900)
  page = await current()
  data = await page.data()
  check(
    'mock 菜品销量 CSV 文件',
    data.dishesFileReady === true && data.dishesFileBusy === false,
    data.dishesFileReady ? '已生成' : '未生成'
  )
  check(
    'mock 月报滞销菜品',
    slowDishes.length >= 1 &&
      Number(slowDishes[0].qty) === 0 &&
      slowDishes.every(
        (item, index) =>
          index === 0 || Number(slowDishes[index - 1].qty) <= Number(item.qty)
      ),
    slowDishes.map(item => `${item.name}:${item.qty}`).join('、')
  )
  const slowTarget = slowDishes[0]
  if (slowTarget && slowTarget.id) {
    const beforeStatus = slowTarget.status
    const healthBefore = Number(data.health && data.health.soldout)
    await invoke(
      mp,
      `page.onSlowToggle({ currentTarget: { dataset: { id: '${slowTarget.id}' } } })`
    )
    await sleep(700)
    page = await current()
    data = await page.data()
    const toggled = (data.report.slowDishes || []).find(
      item => item.id === slowTarget.id
    )
    check(
      'mock 月报滞销菜一键切换状态',
      Boolean(toggled) && toggled.status !== beforeStatus,
      toggled ? `${beforeStatus} → ${toggled.status}` : '没找到菜'
    )
    const beforeSoldout =
      beforeStatus === 'soldout' || slowTarget.stock === 0
    const afterSoldout =
      Boolean(toggled) &&
      (toggled.status === 'soldout' || slowTarget.stock === 0)
    check(
      'mock 月报切换同步体检数字',
      Boolean(data.health) &&
        Number(data.health.soldout) ===
          healthBefore + (afterSoldout ? 1 : 0) - (beforeSoldout ? 1 : 0),
      `${healthBefore} → ${data.health && data.health.soldout}`
    )
    await invoke(
      mp,
      `page.onSlowToggle({ currentTarget: { dataset: { id: '${slowTarget.id}' } } })`
    )
    await sleep(700)
  }
  await invoke(mp, 'page.onExport()')
  await sleep(900)
  page = await current()
  data = await page.data()
  check(
    'mock 订单 CSV 导出',
    Number(data.exportCount) >= 1,
    `导出 ${data.exportCount} 单`
  )
  await invoke(mp, 'page.onExportFile()')
  await sleep(1400)
  page = await current()
  data = await page.data()
  check(
    'mock 订单 CSV 文件',
    data.exportedFile === true,
    data.exportedFile ? '已生成' : '未生成'
  )
  await invoke(mp, 'page.onBackup()')
  await sleep(1800)
  page = await current()
  data = await page.data()
  check(
    'mock 数据备份 JSON',
    data.backupReady === true && Number(data.backupCount) >= 1,
    `${data.backupCount} 项`
  )
  await invoke(
    mp,
    "page.onHealthJump({ currentTarget: { dataset: { filter: 'missing' } } })"
  )
  await sleep(2200)
  page = await current()
  data = await page.data()
  check(
    'mock 体检查看缺做法',
    page.path === 'pages/kitchen/index' &&
      data.dishFilter === 'missing' &&
      (data.displayDishes || []).length > 0 &&
      data.displayDishes.every(dish => !dish.recipe),
    `${(data.displayDishes || []).length} 道`
  )
  await mp.navigateBack()
  await sleep(900)
  await invoke(
    mp,
    "page.onHealthJump({ currentTarget: { dataset: { filter: 'cost' } } })"
  )
  await sleep(2200)
  page = await current()
  data = await page.data()
  check(
    'mock 体检查看缺成本',
    page.path === 'pages/kitchen/index' &&
      data.dishFilter === 'cost' &&
      (data.displayDishes || []).length > 0 &&
      data.displayDishes.every(dish => !(Number(dish.cost) > 0)),
    `${(data.displayDishes || []).length} 道`
  )
  await mp.navigateBack()
  await sleep(900)

  // 干饭足迹
  await mp.navigateTo('/pages/my-report/index')
  await sleep(1800)
  page = await current()
  data = await page.data()
  check(
    'mock 干饭足迹加载',
    Number(data.monthOrders) >= 1 &&
      (data.topDishes || []).length >= 1 &&
      Boolean(data.monthText) &&
      Number(data.streakDays) === 1,
    `${data.monthText} · ${data.monthOrders} 单 · 连吃 ${data.streakDays} 天`
  )
  const footprintShare = await invoke(
    mp,
    'return page.onShareAppMessage()'
  )
  const footprintTimeline = await invoke(
    mp,
    'return page.onShareTimeline()'
  )
  check(
    'mock 干饭足迹分享设置',
    Boolean(footprintShare) &&
      String(footprintShare.title || '').indexOf('干饭足迹') > -1 &&
      footprintShare.path === '/pages/my-report/index' &&
      Boolean(footprintTimeline) &&
      String(footprintTimeline.title || '').indexOf('干饭足迹') > -1,
    footprintShare ? footprintShare.title : '没有分享信息'
  )
  const earnedAchievements = (data.achievements || []).filter(
    item => item.earned
  )
  const lockedAchievements = (data.achievements || []).filter(
    item => !item.earned
  )
  check(
    'mock 干饭成就',
    (data.achievements || []).length === 7 &&
      (data.achievements || []).every(item =>
        /^\d+\/\d+$/.test(String(item.progress || ''))
      ) &&
      Number(data.achievementDone) === earnedAchievements.length &&
      earnedAchievements.length >= 3 &&
      lockedAchievements.length >= 1 &&
      earnedAchievements.some(item => item.key === 'month'),
    `${data.achievementDone} / ${(data.achievements || []).length} 已解锁`
  )
  await invoke(mp, 'page.onSharePoster()')
  await sleep(2200)
  page = await current()
  data = await page.data()
  check(
    'mock 干饭足迹海报',
    Boolean(data.posterPath),
    data.posterPath ? '已生成' : '未生成'
  )
  await invoke(mp, 'page.load()')
  await sleep(1200)
  page = await current()
  data = await page.data()
  check(
    'mock 足迹海报刷新失效',
    data.posterPath === '',
    data.posterPath || '已清空'
  )
  await invoke(
    mp,
    "page.onSelectMonth({ currentTarget: { dataset: { offset: 1 } } })"
  )
  await sleep(1600)
  page = await current()
  data = await page.data()
  const prevMonthRef = new Date()
  const prevMonthLabel = (() => {
    const d = new Date(
      prevMonthRef.getFullYear(),
      prevMonthRef.getMonth() - 1,
      1
    )
    return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月`
  })()
  check(
    'mock 足迹查看上月',
    Number(data.monthOffset) === 1 &&
      data.monthText === prevMonthLabel &&
      Number(data.monthOrders) === 0,
    `${data.monthText} · ${data.monthOrders} 单`
  )
  await invoke(
    mp,
    "page.onSelectMonth({ currentTarget: { dataset: { offset: 0 } } })"
  )
  await sleep(1400)
  await mp.navigateBack()
  await sleep(600)

  await mp.switchTab('/pages/orders/index')
  await sleep(1500)
  page = await current()
  data = await page.data()
  const repliedOrder = (data.orders || []).find(
    order => order.id === 'seed-2'
  )
  check(
    'mock 订单已回复标记',
    Boolean(repliedOrder && repliedOrder.replied),
    repliedOrder ? repliedOrder.replied : '没找到订单'
  )

  // 购物车总览：跨餐次合并、改数量与结算入口
  await mp.switchTab('/pages/home/index')
  await sleep(1500)
  await invoke(
    mp,
    "page.onSelectMeal({ currentTarget: { dataset: { meal: 'lunch' } } })"
  )
  await sleep(1500)
  await invoke(
    mp,
    "page.onSkuAdd({ detail: { line: { key: '', dishId: 'd02', name: '照烧鸡腿饭', price: 16, qty: 1, specs: [], note: '', color: '#2D9CFF' } } })"
  )
  await sleep(400)
  await invoke(
    mp,
    "page.onSelectMeal({ currentTarget: { dataset: { meal: 'dinner' } } })"
  )
  await sleep(1500)
  await invoke(
    mp,
    "page.onSkuAdd({ detail: { line: { key: '', dishId: 'd01', name: '番茄牛腩饭', price: 18, qty: 1, specs: [], note: '', color: '#FFD23F' } } })"
  )
  await sleep(400)
  page = await current()
  data = await page.data()
  check(
    'mock 首页其他餐次提示',
    Number(data.otherCartCount) >= 1,
    `其他餐次 ${data.otherCartCount} 份`
  )
  await invoke(mp, 'page.onCartOverview()')
  await sleep(1600)
  page = await current()
  data = await page.data()
  const cartGroups = data.groups || []
  check(
    'mock 购物车总览',
    page.path === 'pages/cart/index' &&
      cartGroups.length >= 2 &&
      Number(data.count) >= 2 &&
      Number(data.total) ===
        cartGroups.reduce((sum, group) => sum + group.total, 0),
    `${cartGroups.length} 组 · ${data.count} 份 · ¥${data.total}`
  )
  const firstGroup = cartGroups[0]
  if (firstGroup) {
    const beforeTotal = Number(data.total)
    await invoke(
      mp,
      `page.onChangeQty({ currentTarget: { dataset: { key: ${JSON.stringify(
        firstGroup.items[0].key
      )}, delta: 1 } } })`
    )
    await sleep(400)
    page = await current()
    data = await page.data()
    check(
      'mock 购物车改数量',
      Number(data.total) === beforeTotal + Number(firstGroup.items[0].price),
      `¥${beforeTotal} → ¥${data.total}`
    )
    await invoke(
      mp,
      `page.onCheckout({ currentTarget: { dataset: { meal: ${JSON.stringify(
        firstGroup.meal
      )}, date: ${JSON.stringify(firstGroup.date)} } } })`
    )
    await sleep(1600)
    page = await current()
    check('mock 购物车去结算', page.path === 'pages/checkout/index')
    await mp.navigateBack()
    await sleep(900)
  }
  page = await current()
  data = await page.data()
  for (const group of data.groups || []) {
    await invoke(
      mp,
      `page.onClearGroup({ currentTarget: { dataset: { meal: ${JSON.stringify(
        group.meal
      )}, date: ${JSON.stringify(group.date)} } } })`
    )
    await sleep(400)
  }
  page = await current()
  data = await page.data()
  check('mock 购物车清空', (data.groups || []).length === 0)
  await mp.switchTab('/pages/home/index')
  await sleep(1500)
  await invoke(
    mp,
    "page.onSelectMeal({ currentTarget: { dataset: { meal: 'lunch' } } })"
  )
  await sleep(1200)
  await invoke(
    mp,
    "page.quickAdd(page._available.find(d => d.status === 'on' && d.stock !== 0 && !(d.spicyLevels || []).length && !(d.addons || []).length))"
  )
  await sleep(500)
  await invoke(
    mp,
    "page.onSelectMeal({ currentTarget: { dataset: { meal: 'dinner' } } })"
  )
  await sleep(1200)
  await invoke(
    mp,
    "page.quickAdd(page._available.find(d => d.status === 'on' && d.stock !== 0 && !(d.spicyLevels || []).length && !(d.addons || []).length))"
  )
  await sleep(500)
  await mp.navigateTo('/pages/cart/index')
  await sleep(1200)
  page = await current()
  data = await page.data()
  const beforeClearAll = Number(data.count || 0)
  const groupsBeforeClear = (data.groups || []).length
  await mp.mockWxMethod('showModal', {
    confirm: false,
    cancel: true,
    content: ''
  })
  await invoke(mp, 'page.onClearAll()')
  await sleep(600)
  page = await current()
  data = await page.data()
  const cartStoreAfterCancel = await mp.evaluate(() => {
    try {
      return JSON.parse(wx.getStorageSync('kfl_cart_v1') || '[]')
    } catch (e) {
      return []
    }
  })
  check(
    'mock 购物车清空取消',
    groupsBeforeClear >= 2 &&
      (data.groups || []).length === groupsBeforeClear &&
      cartStoreAfterCancel.length > 0,
    `${groupsBeforeClear} 组保持不变`
  )
  await mp.mockWxMethod('showModal', {
    confirm: true,
    cancel: false,
    content: ''
  })
  await invoke(mp, 'page.onClearAll()')
  await sleep(700)
  page = await current()
  data = await page.data()
  const cartStoreAfter = await mp.evaluate(() => {
    try {
      return JSON.parse(wx.getStorageSync('kfl_cart_v1') || '[]')
    } catch (e) {
      return []
    }
  })
  check(
    'mock 购物车一键清空',
    beforeClearAll >= 2 &&
      groupsBeforeClear >= 2 &&
      (data.groups || []).length === 0 &&
      cartStoreAfter.length === 0,
    `${beforeClearAll} 份 · ${groupsBeforeClear} 组 → 0`
  )

  // 真实提交一笔明天午餐：验证下单写入的「吃过」标记与结算记忆
  const submitDate = chinaDate(1)
  const todayMidnight = new Date()
  todayMidnight.setHours(0, 0, 0, 0)
  const todayStamp = todayMidnight.getTime()
  await mp.switchTab('/pages/home/index')
  await sleep(1600)
  await invoke(
    mp,
    "page.onSelectMeal({ currentTarget: { dataset: { meal: 'lunch' } } })"
  )
  await sleep(1200)
  await invoke(
    mp,
    `page.onSelectDate({ detail: { value: '${submitDate}' } })`
  )
  await sleep(1400)
  await invoke(
    mp,
    `wx.setStorageSync('kfl_eaten_v1', JSON.stringify({ d01: ${todayStamp} })); page.onSkuAdd({ detail: { line: { key: '', dishId: 'd02', name: '照烧鸡腿饭', price: 16, qty: 1, specs: [], note: '', color: '#2D9CFF' } } }); page.onSkuAdd({ detail: { line: { key: '', dishId: 'd01', name: '番茄牛腩饭', price: 18, qty: 1, specs: [], note: '', color: '#FFD23F' } } }); return true`
  )
  await sleep(500)
  await mp.navigateTo(
    `/pages/checkout/index?meal=lunch&date=${submitDate}`
  )
  await sleep(1800)
  await mp.mockWxMethod('requestSubscribeMessage', {})
  await invoke(mp, 'page.onSubmit()')
  await sleep(2600)
  page = await current()
  data = await page.data()
  const submittedOrderId =
    data.order && data.order.status !== undefined ? data.order.id : ''
  const eatenStore = await mp.evaluate(() => {
    try {
      return JSON.parse(wx.getStorageSync('kfl_eaten_v1') || '{}')
    } catch (e) {
      return {}
    }
  })
  const checkoutPrefsStore = await mp.evaluate(() => {
    try {
      return JSON.parse(wx.getStorageSync('kfl_checkout_prefs_v1') || '{}')
    } catch (e) {
      return {}
    }
  })
  const eatenStamp = Number((eatenStore || {}).d02 || 0)
  const eatenDay = eatenStamp
    ? (() => {
        const d = new Date(eatenStamp)
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
          2,
          '0'
        )}-${String(d.getDate()).padStart(2, '0')}`
      })()
    : ''
  check(
    'mock 下单写入吃过与结算记忆',
    page.path === 'pages/order-detail/index' &&
      Boolean(submittedOrderId) &&
      eatenDay === submitDate &&
      Number((eatenStore || {}).d01 || 0) === todayStamp &&
      (checkoutPrefsStore.times || {}).lunch === '尽快' &&
      checkoutPrefsStore.mode === '在家吃',
    `${page.path} · 新单 ${eatenDay} · 今天记录 ${
      Number((eatenStore || {}).d01 || 0) === todayStamp ? '保留' : '被覆盖'
    }`
  )
  await mp.switchTab('/pages/home/index')
  await sleep(1800)
  page = await current()
  const homeEaten = await invoke(
    mp,
    "const find = id => ((page._available || []).find(d => d.id === id) || {}); return { d01: find('d01').lastEatenText || '', d02: find('d02').lastEatenText || '' }"
  )
  check(
    'mock 预订单不提前算今天吃过',
    homeEaten && homeEaten.d01 === '今天吃过' && !homeEaten.d02,
    `今天菜「${(homeEaten && homeEaten.d01) || '无'}」· 明天菜「${
      (homeEaten && homeEaten.d02) || '无'
    }」`
  )
  let eatenAfterCancel = eatenStore
  if (submittedOrderId) {
    await mp.navigateTo(`/pages/order-detail/index?id=${submittedOrderId}`)
    await sleep(1600)
    await mp.mockWxMethod('showModal', { confirm: true, content: '回归清理' })
    await invoke(mp, 'page.onCancelOrder()')
    await sleep(1500)
    eatenAfterCancel = await mp.evaluate(() => {
      try {
        return JSON.parse(wx.getStorageSync('kfl_eaten_v1') || '{}')
      } catch (e) {
        return {}
      }
    })
  }
  check(
    'mock 取消订单清理吃过标记',
    !(eatenAfterCancel || {}).d02 &&
      Number((eatenAfterCancel || {}).d01 || 0) === todayStamp,
    `d01 ${
      Number((eatenAfterCancel || {}).d01 || 0) === todayStamp
        ? '保留'
        : '丢失'
    } · d02 ${(eatenAfterCancel || {}).d02 ? '残留' : '已清'}`
  )
  await sleep(400)
  const eatenCloudStore = await mp.evaluate(() => {
    try {
      return JSON.parse(wx.getStorageSync('kfl_eaten_cloud_v1') || '{}')
    } catch (e) {
      return {}
    }
  })
  check(
    'mock 吃过记录同步云端',
    Boolean(eatenCloudStore.map) &&
      Number(eatenCloudStore.map.d01) === todayStamp &&
      !eatenCloudStore.map.d02,
    `d01 ${
      Number((eatenCloudStore.map || {}).d01 || 0) === todayStamp
        ? '已同步'
        : '未同步'
    } · d02 ${(eatenCloudStore.map || {}).d02 ? '残留' : '已清'}`
  )

  // 首页「上次吃」快捷再来一份
  await mp.switchTab('/pages/home/index')
  await sleep(1800)
  page = await current()
  data = await page.data()
  const yesterdayMidnight = new Date()
  yesterdayMidnight.setDate(yesterdayMidnight.getDate() - 1)
  yesterdayMidnight.setHours(0, 0, 0, 0)
  await mp.evaluate(
    new Function(
      `wx.setStorageSync('kfl_eaten_cloud_v1', JSON.stringify({ map: { d10: ${yesterdayMidnight.getTime()} }, updatedAt: Date.now() + 60000 })); return true`
    )
  )
  await invoke(mp, 'page.syncEatenCloud(true)')
  await sleep(1600)
  page = await current()
  const pulledEaten = await invoke(
    mp,
    "const find = id => ((page._available || []).find(d => d.id === id) || {}); return { d10: find('d10').lastEatenText || '', d01: find('d01').lastEatenText || '' }"
  )
  check(
    'mock 吃过记录云端拉取',
    Boolean(pulledEaten) &&
      pulledEaten.d10 === '昨天吃过' &&
      pulledEaten.d01 === '今天吃过',
    pulledEaten
      ? `d10 ${pulledEaten.d10 || '无'} · d01 ${pulledEaten.d01 || '无'}`
      : '没有标记'
  )
  data = await page.data()
  check(
    'mock 上次吃入口',
    Boolean(data.lastOrder) &&
      String(data.lastOrder.summary || '').length > 0 &&
      String(data.lastOrder.dateText || '').length > 0,
    data.lastOrder
      ? `${data.lastOrder.dateText} · ${data.lastOrder.mealText} · ${data.lastOrder.summary}`
      : '没有记录'
  )
  await invoke(mp, 'page.onRepeatLast()')
  await sleep(1800)
  page = await current()
  data = await page.data()
  check(
    'mock 上次吃再来一份',
    Boolean(data.lastOrder) &&
      data.selectedMeal === data.lastOrder.meal &&
      Number(data.cartCount) >= 1,
    `${data.selectedMeal} · ${data.cartCount} 份`
  )

  // 待接单订单改餐次
  await mp.navigateTo('/pages/order-detail/index?id=seed-3')
  await sleep(1600)
  page = await current()
  data = await page.data()
  await invoke(mp, 'page.onToggleSlotEdit()')
  await invoke(
    mp,
    "page.onSelectSlotMeal({ currentTarget: { dataset: { meal: 'dinner' } } })"
  )
  await invoke(mp, 'page.onSaveSlot()')
  await sleep(1000)
  page = await current()
  data = await page.data()
  check(
    'mock 订单修改餐次',
    Boolean(data.order) &&
      data.order.meal === 'dinner' &&
      data.order.expectedTime === '尽快',
    data.order ? `${data.order.meal} · ${data.order.expectedTime}` : '没有订单'
  )
  await mp.navigateBack()
  await sleep(900)

  // 厨房一键接单（放在最后，下一轮 mock 种子会自动恢复待接单状态）
  await mp.switchTab('/pages/profile/index')
  await sleep(1800)
  page = await current()
  data = await page.data()
  check(
    'mock 我的本月花费',
    Number(data.stats && data.stats.monthSpend) >= 0 &&
      Number(data.stats && data.stats.month) >= 1,
    `¥${data.stats && data.stats.monthSpend} · ${data.stats && data.stats.month} 单`
  )
  await mp.evaluate(
    new Function(
      "wx.setStorageSync('kfl_favorites_cloud_v1', JSON.stringify({ ids: ['d03'], times: { d03: Date.now() }, removed: {}, updatedAt: Date.now() + 60000 })); return true"
    )
  )
  await invoke(
    mp,
    "wx.__syncToasts = []; wx.showToast = (o) => { wx.__syncToasts.push(o && o.title); o && o.success && o.success() }; return true"
  )
  await invoke(
    mp,
    "page.onEntryTap({ currentTarget: { dataset: { key: 'sync' } } })"
  )
  await sleep(1600)
  const syncToasts = await mp.evaluate(() => wx.__syncToasts || [])
  const syncFavs = await mp.evaluate(() => {
    try {
      return JSON.parse(wx.getStorageSync('kfl_favorites_v1') || '[]')
    } catch (e) {
      return []
    }
  })
  check(
    'mock 我的手动云同步',
    syncToasts[0] === '已同步云端更新' && syncFavs.indexOf('d03') > -1,
    `${syncToasts.join('/') || '无提示'} · ${syncFavs.join('/') || '无收藏'}`
  )
  page = await current()
  data = await page.data()
  const lastSyncStoreValue = await mp.evaluate(() =>
    wx.getStorageSync('kfl_last_sync_v1')
  )
  const syncTimeEl = await page.$('.entry-sync-time')
  const syncTimeText = syncTimeEl ? String(await syncTimeEl.text()) : ''
  check(
    'mock 我的上次同步时间',
    String(data.lastSyncText || '').indexOf('今天') === 0 &&
      Number(lastSyncStoreValue) > 0 &&
      syncTimeText.indexOf('上次同步：今天') > -1,
    data.lastSyncText || '未显示'
  )
  await mp.navigateTo('/pages/kitchen/index')
  await sleep(2200)
  page = await current()
  data = await page.data()
  check(
    'mock 厨房待接单数',
    Number(data.pendingCount) >= 1,
    `${data.pendingCount} 单`
  )
  check(
    'mock 备注更新标记',
    (data.orders || []).some(
      order => order.id === 'seed-1' && order.noteUpdated
    ),
    (data.orders || []).find(order => order.id === 'seed-1')
      ? '已标记'
      : '没找到订单'
  )
  await mp.mockWxMethod('showModal', {
    confirm: true,
    cancel: false,
    content: ''
  })
  await invoke(mp, 'page.onAcceptAll()')
  await sleep(1800)
  page = await current()
  data = await page.data()
  check(
    'mock 厨房全部接单',
    Number(data.pendingCount) === 0 &&
      (data.orders || []).every(order => order.status !== 'pending'),
    `剩余待接 ${data.pendingCount} 单`
  )
  await mp.mockWxMethod('showModal', { confirm: true })
  await invoke(
    mp,
    "page.onBatchAdvance({ currentTarget: { dataset: { status: 'cooking' } } })"
  )
  await sleep(1800)
  page = await current()
  data = await page.data()
  const cookingOrder = (data.orders || []).find(
    order => order.id === 'seed-1'
  )
  check(
    'mock 厨房批量开火',
    Boolean(cookingOrder) && cookingOrder.status === 'cooking',
    cookingOrder ? cookingOrder.status : '没找到订单'
  )
  await invoke(
    mp,
    "page.onBatchAdvance({ currentTarget: { dataset: { status: 'ready' } } })"
  )
  await sleep(1800)
  page = await current()
  data = await page.data()
  const readyOrder = (data.orders || []).find(order => order.id === 'seed-1')
  check(
    'mock 厨房批量出锅',
    Boolean(readyOrder) &&
      readyOrder.status === 'ready' &&
      Number(data.readyCount) >= 1,
    readyOrder ? readyOrder.status : '没找到订单'
  )
  await invoke(
    mp,
    "page.onBatchAdvance({ currentTarget: { dataset: { status: 'completed' } } })"
  )
  await sleep(1800)
  page = await current()
  data = await page.data()
  check(
    'mock 厨房批量完成',
    !(data.orders || []).some(order => order.id === 'seed-1') &&
      (data.history || []).some(
        order => order.id === 'seed-1' && order.status === 'completed'
      ),
    'seed-1 已完成'
  )
  check(
    'mock 全部接单不动预订单',
    (data.preorders || []).some(
      order => order.id === 'seed-3' && order.status === 'pending'
    ),
    `预订单 ${(data.preorders || []).length} 单`
  )
  check(
    'mock 厨房改时间标记',
    (data.preorders || []).some(
      order => order.id === 'seed-3' && order.slotUpdated
    ),
    'seed-3'
  )
  const goalRevenue = Number(data.stats && data.stats.revenue)
  const goalTarget = Number(data.dailyGoal)
  const expectedPercent = Math.min(
    100,
    Math.round((goalRevenue / goalTarget) * 100)
  )
  const expectedGoalText =
    goalRevenue >= goalTarget
      ? '今天达标啦 🎉'
      : `还差 ¥${Number((goalTarget - goalRevenue).toFixed(2))}`
  check(
    'mock 厨房营收目标',
    goalTarget === 200 &&
      Number(data.goalPercent) === expectedPercent &&
      data.goalText === expectedGoalText,
    `¥${goalRevenue} / ¥${goalTarget} · ${data.goalPercent}% · ${data.goalText}`
  )
  const specialRows = data.specialDays || []
  const birthdayRow = specialRows.find(day => day.kind === 'birthday')
  const anniversaryRow = specialRows.find(
    day => day.kind === 'anniversary'
  )
  check(
    'mock 厨房重要日子提醒',
    Boolean(birthdayRow) &&
      Number(birthdayRow.days) === 5 &&
      birthdayRow.daysText === '还有 5 天' &&
      birthdayRow.label === '生日' &&
      Boolean(anniversaryRow) &&
      Number(anniversaryRow.days) === 0 &&
      anniversaryRow.daysText === '今天' &&
      anniversaryRow.urgent === true &&
      specialRows.every(day => Boolean(day.key)) &&
      data.specialDaysError === '',
    specialRows.map(day => `${day.label}${day.daysText}`).join(' / ')
  )
  await invoke(mp, 'page.onCopySummary()')
  await sleep(600)
  const orderSummaryClip = await mp.evaluate(
    new Function(
      "return new Promise(resolve => wx.getClipboardData({ success: r => resolve(r.data || ''), fail: () => resolve('') }))"
    )
  )
  check(
    'mock 厨房订单汇总含目标与提醒',
    orderSummaryClip.indexOf('目标 ¥200') > -1 &&
      orderSummaryClip.indexOf('提醒：') > -1 &&
      orderSummaryClip.indexOf('生日') > -1,
    `${String(orderSummaryClip || '').length} 字`
  )
  await mp.navigateTo('/pages/favorites/index')
  await sleep(1200)
  page = await current()
  data = await page.data()
  const clearFavoriteBase = (data.allFavorites || [])[0] || {
    id: 'clear-test',
    name: '清空测试菜',
    price: 1,
    categoryId: 'staple'
  }
  await invoke(
    mp,
    `page.setData({ count: 1, allFavorites: [${JSON.stringify(
      clearFavoriteBase
    )}], display: [${JSON.stringify(clearFavoriteBase)}] })`
  )
  await invoke(mp, 'page.onClearAll()')
  await sleep(700)
  page = await current()
  data = await page.data()
  check(
    'mock 收藏一键清空',
    Number(data.count) === 0 && (data.allFavorites || []).length === 0,
    String(data.count)
  )

  // 清理本轮回测创建的订单与本地标记，避免污染下一次运行
  if (submittedOrderId) {
    await mp.evaluate(
      new Function(
        `const list = JSON.parse(wx.getStorageSync('kfl_orders_v1') || '[]'); wx.setStorageSync('kfl_orders_v1', JSON.stringify(list.filter(order => order.id !== ${JSON.stringify(
          submittedOrderId
        )}))); return true;`
      )
    )
  }
  await mp.evaluate(
    new Function(
      "wx.removeStorageSync('kfl_eaten_v1'); wx.removeStorageSync('kfl_eaten_ops_v1'); wx.removeStorageSync('kfl_eaten_cloud_v1'); wx.removeStorageSync('kfl_eaten_sync_v1'); wx.removeStorageSync('kfl_eaten_removed_v1'); return true;"
    )
  )

  const failed = results.filter(r => !r.ok)
  console.log(`\n结论：${results.length - failed.length}/${results.length} 通过`)
  await mp.disconnect()
  process.exit(failed.length ? 1 : 0)
})().catch(err => {
  console.error('mock 回归异常：', err)
  process.exit(2)
})
