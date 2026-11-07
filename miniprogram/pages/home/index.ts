import type { CartLine, Category, Dish, MealId } from '../../services/types'
import {
  getCategories,
  getDishes,
  getBusiness,
  getKitchenStatus,
  getLastOrder,
  getMenuForDate,
  getMyActiveOrder,
  getMyExpiringCoupons,
  getMyPendingReviewCount
} from '../../services/api'
import { cart } from '../../store/cart'
import { favorites } from '../../store/favorites'
import { MEALS, STATUS_TEXT, mealName } from '../../utils/constants'
import { USE_CLOUD } from '../../config'
import {
  currentMeal,
  dateLabel,
  formatDate,
  greeting,
  isOpenNow,
  dateInputString,
  itemSummary
} from '../../utils/format'
import { addOrderToCart } from '../../utils/reorder'

interface Section extends Category {
  dishes: Dish[]
}

const SEARCH_HISTORY_KEY = 'kfl_search_history_v1'
const SEARCH_HISTORY_MAX = 6

function readSearchHistory(): string[] {
  try {
    const raw = wx.getStorageSync(SEARCH_HISTORY_KEY)
    const list = raw ? JSON.parse(raw) : []
    return Array.isArray(list)
      ? list.filter(item => typeof item === 'string').slice(0, SEARCH_HISTORY_MAX)
      : []
  } catch (e) {
    return []
  }
}

function writeSearchHistory(list: string[]) {
  try {
    wx.setStorageSync(SEARCH_HISTORY_KEY, JSON.stringify(list))
  } catch (e) {
    // 忽略存储失败
  }
}

Page({
  data: {
    navPad: 44,
    dateText: '',
    greetText: '',
    isOpen: true,
    meals: MEALS,
    selectedMeal: 'lunch' as MealId,
    selectedDate: '',
    todayDate: '',
    tomorrowDate: '',
    maxDate: '',
    menuDateLabel: '今天',
    deadlineText: '',
    busyText: '',
    hero: null as Dish | null,
    heroTag: '今日推荐',
    heroImageFailed: false,
    sections: [] as Section[],
    cartCount: 0,
    cartTotal: 0,
    otherCartCount: 0,
    skuVisible: false,
    activeDish: null as Dish | null,
    loading: true,
    mealNotice: '',
    notice: '',
    recommendText: '今日推荐',
    keyword: '',
    searchResults: [] as Dish[],
    searchHistory: [] as string[],
    emptyDesc: '换个餐次看看，或者去许愿池点个菜',
    emptyAction: '',
    emptyTitle: '这一餐还没开火',
    loadFailed: false,
    onlyFavorites: false,
    favoriteCount: 0,
    favoriteLabel: '♡ 我的收藏',
    onlyAvailable: false,
    lastOrder: null as any,
    activeOrder: null as any,
    couponExpiring: 0,
    pendingReviews: 0,
    showCatBar: false,
    spiceFilter: 'all',
    spiceFilters: [] as { key: string; label: string }[],
    tagFilter: 'all',
    tagFilters: [] as { key: string; label: string; count: number }[]
  },

  _unsub: null as null | (() => void),
  _favUnsub: null as null | (() => void),
  _available: [] as Dish[],
  _cartLines: [] as CartLine[],
  _pendingReorder: null as null | { meal: MealId; date: string },
  _categories: [] as Category[],
  _baseEmptyDesc: '',
  _loadSeq: 0,
  _lastOrderRaw: null as any,
  _repeating: false,

  onLoad() {
    const app = getApp()
    const statusBarHeight =
      (app && app.globalData && app.globalData.statusBarHeight) || 20
    const today = dateInputString()
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const max = new Date()
    max.setDate(max.getDate() + 7)

    this.setData({
      navPad: statusBarHeight + 14,
      dateText: formatDate(),
      greetText: greeting(),
      isOpen: isOpenNow(),
      selectedMeal: currentMeal(),
      selectedDate: today,
      todayDate: today,
      tomorrowDate: dateInputString(tomorrow),
      maxDate: dateInputString(max),
      menuDateLabel: '今天',
      searchHistory: readSearchHistory()
    })

    this._unsub = cart.subscribe(lines => {
      this._cartLines = lines
      this.updateCartBadge()
    })

    this._favUnsub = favorites.subscribe(ids => {
      this.setData({
        favoriteCount: ids.length,
        favoriteLabel: `♡ 我的收藏${ids.length ? ' ' + ids.length : ''}`
      })
      if (this.data.onlyFavorites) {
        this.renderSections()
        this.setData({
          searchResults: this.filterDishes(this.data.keyword)
        })
      }
    })
  },

  onShow() {
    const tabBar: any = (this as any).getTabBar
      ? (this as any).getTabBar()
      : null
    if (tabBar) {
      tabBar.setData({ selected: 0 })
    }
    // 跨天后修正「今天」和可选日期范围，热启动也能正确显示
    this.syncToday()
    const app: any = getApp()
    const pending =
      app && app.globalData ? app.globalData.pendingReorder : null
    if (app && app.globalData) {
      app.globalData.pendingReorder = null
    }
    if (pending && MEALS.some(item => item.id === pending.meal)) {
      const today = this.data.todayDate || dateInputString()
      const date =
        pending.date && pending.date >= today && pending.date <= this.data.maxDate
          ? pending.date
          : today
      this._pendingReorder = {
        meal: pending.meal,
        date
      }
      if (
        pending.meal !== this.data.selectedMeal ||
        date !== this.data.selectedDate
      ) {
        this.setData(
          {
            selectedMeal: pending.meal,
            selectedDate: date,
            menuDateLabel: dateLabel(date, today)
          },
          () => {
            this.updateCartBadge()
            this.loadMenu()
          }
        )
        return
      }
    }
    // 每次回到首页都刷新菜单，保证厨房端的售罄/上架能同步过来
    this.loadMenu()
    this.loadLastOrder()
    this.loadActiveOrder()
    this.loadCouponReminder()
    this.loadPendingReviews()
  },

  onUnload() {
    if (this._unsub) {
      this._unsub()
      this._unsub = null
    }
    if (this._favUnsub) {
      this._favUnsub()
      this._favUnsub = null
    }
  },

  onPageScroll(e: any) {
    const show = Number(e.scrollTop || 0) > 260
    if (show !== this.data.showCatBar) {
      this.setData({ showCatBar: show })
    }
  },

  syncToday() {
    const today = dateInputString()
    if (today === this.data.todayDate) {
      return
    }
    const max = new Date()
    max.setDate(max.getDate() + 7)
    const maxDate = dateInputString(max)
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const selected = this.data.selectedDate
    const selectedDate =
      selected && selected >= today
        ? selected <= maxDate
          ? selected
          : maxDate
        : today
    this.setData({
      todayDate: today,
      tomorrowDate: dateInputString(tomorrow),
      maxDate,
      selectedDate,
      dateText: formatDate(),
      menuDateLabel: dateLabel(selectedDate, today)
    })
  },

  async loadMenu() {
    // 切换餐次很快时，只认最后一次请求的结果
    const seq = ++this._loadSeq
    // 已有菜单时静默刷新，避免切回 tab 时骨架屏闪一下
    if (!this.data.sections.length) {
      this.setData({ loading: true })
    }
    try {
      const meal = this.data.selectedMeal
      const today = dateInputString()
      const date =
        this.data.selectedDate && this.data.selectedDate >= today
          ? this.data.selectedDate
          : today
      const isToday = date === today
      const [categories, dishes, business, menu, kitchenStatus] =
        await Promise.all([
          getCategories(),
          getDishes(),
          getBusiness().catch(() => null),
          getMenuForDate(date, meal),
          getKitchenStatus().catch(() => null)
        ])
      if (seq !== this._loadSeq) {
        return
      }
      const menuActive = Boolean(menu && menu.exists)
      const available = dishes.filter(
        dish =>
          dish.status !== 'off' &&
          dish.meals.indexOf(meal) > -1 &&
          (!menuActive || menu!.dishIds.indexOf(dish.id) > -1)
      )
      this._available = available
      this._categories = categories
      this._baseEmptyDesc =
        USE_CLOUD && available.length === 0
          ? menuActive
            ? '这一餐还没排菜单，晚点再来看看'
            : '云数据库可能还没初始化，去「我的」看一眼'
          : '换个餐次看看，或者去许愿池点个菜'

      let isOpen = isToday ? isOpenNow() : true
      let mealNotice = ''
      let deadlineText = ''
      let busyText = ''
      const now = new Date()
      const nowMinutes = now.getHours() * 60 + now.getMinutes()
      const closedDate = Boolean(
        business &&
          ((Array.isArray(business.closedDates) &&
            business.closedDates.indexOf(date) > -1) ||
            (Array.isArray(business.weeklyClosed) &&
              business.weeklyClosed.indexOf(
                new Date(date + 'T00:00:00').getDay()
              ) > -1))
      )
      const mealSetting = business ? business[meal] : null
      if (closedDate) {
        isOpen = false
        mealNotice = (business && business.closedNote) || '今天休息，明天见'
      } else if (menuActive && menu!.open === false) {
        isOpen = false
        mealNotice = '这一餐还没排菜单'
      } else if (mealSetting) {
        const [deadlineHour, deadlineMinute] = mealSetting.deadline
          .split(':')
          .map(Number)
        const deadlineMinutes = deadlineHour * 60 + deadlineMinute
        const pastDeadline = isToday && nowMinutes > deadlineMinutes
        isOpen = mealSetting.open && !pastDeadline
        mealNotice = !mealSetting.open
          ? business!.closedNote || '今天休息，明天见'
          : pastDeadline
          ? '这一餐已经截单啦，下次早点来'
          : ''
        if (mealSetting.open && !pastDeadline) {
          const left = deadlineMinutes - nowMinutes
          deadlineText = isToday
            ? left <= 120
              ? `还有 ${left} 分钟截单`
              : `${mealSetting.deadline} 截单`
            : `${mealSetting.deadline} 截单`
        }
      }
      if (isToday && isOpen && kitchenStatus) {
        busyText = kitchenStatus.busy
          ? `厨房正在做 ${kitchenStatus.active} 单`
          : '厨房现在空闲'
      }

      this.setData(
        {
          loading: false,
          loadFailed: false,
          emptyTitle: '这一餐还没开火',
          deadlineText,
          busyText,
          isOpen,
          mealNotice,
          notice:
            business &&
            business.notice &&
            (!business.noticeFrom || business.noticeFrom <= today) &&
            (!business.noticeUntil ||
              business.noticeUntil >= today)
              ? business.notice
              : '',
          recommendText:
            (business && business.recommendText) || '今日推荐',
          searchResults: this.filterDishes(this.data.keyword)
        },
        () => this.renderSections()
      )
    } catch (e: any) {
      if (seq !== this._loadSeq) {
        return
      }
      const message = String((e && (e.message || e.errMsg)) || '')
      const quotaExceeded =
        message.indexOf('额度') > -1 ||
        message.indexOf('0 点后恢复') > -1 ||
        message.indexOf('EXCEED_REQUEST_LIMIT') > -1 ||
        message.indexOf('quota') > -1 ||
        message.indexOf('exceed request limit') > -1
      // 失败时清掉上一餐次/上一次成功加载的菜，避免旧菜单挂在新餐次下面
      this._available = []
      this._baseEmptyDesc = ''
      this.setData({
        loading: false,
        loadFailed: true,
        emptyTitle: '菜单加载失败',
        deadlineText: '',
        busyText: '',
        sections: [],
        hero: null,
        searchResults: [],
        emptyAction: '再试一次',
        emptyDesc: quotaExceeded
          ? '今天的云端读取额度用完了，0 点后自动恢复'
          : USE_CLOUD
          ? '云环境还没连上，检查一下云函数是否已部署'
          : '菜单加载失败，下拉试试'
      })
      wx.showToast({ title: '菜单加载失败', icon: 'none' })
    }
  },

  onSelectMeal(e: any) {
    const meal = e.currentTarget.dataset.meal as MealId
    if (meal === this.data.selectedMeal) {
      return
    }
    if (this._pendingReorder && this._pendingReorder.meal !== meal) {
      this._pendingReorder = null
    }
    this.setData({ selectedMeal: meal }, () => {
      this.updateCartBadge()
      this.loadMenu()
    })
  },

  onSelectDate(e: any) {
    const date = e.detail.value
    if (!date || date === this.data.selectedDate) {
      return
    }
    if (this._pendingReorder && this._pendingReorder.date !== date) {
      this._pendingReorder = null
    }
    this.setData(
      {
        selectedDate: date,
        menuDateLabel: dateLabel(date, this.data.todayDate)
      },
      () => this.loadMenu()
    )
  },

  onQuickDate(e: any) {
    const date = String(e.currentTarget.dataset.date || '')
    if (!date || date === this.data.selectedDate) {
      return
    }
    this.onSelectDate({ detail: { value: date } })
  },

  updateCartBadge() {
    const lines = (this._cartLines || []).filter(
      line =>
        line.meal === this.data.selectedMeal &&
        line.date === this.data.selectedDate
    )
    const count = lines.reduce((sum, line) => sum + line.qty, 0)
    const total = lines.reduce((sum, line) => sum + line.qty * line.price, 0)
    const allCount = (this._cartLines || []).reduce(
      (sum, line) => sum + line.qty,
      0
    )
    this.setData({
      cartCount: count,
      cartTotal: total,
      otherCartCount: Math.max(0, allCount - count)
    })
  },

  onCartOverview() {
    wx.navigateTo({ url: '/pages/cart/index' })
  },

  renderSections() {
    const favoritePool = this.data.onlyFavorites
      ? favorites.filter(this._available)
      : this._available
    const basePool = this.data.onlyAvailable
      ? favoritePool.filter(
          dish => dish.status !== 'soldout' && dish.stock !== 0
        )
      : favoritePool
    // 辣度筛选项按当前可点菜品生成；没有辣度选项的菜按不辣算
    const levelOrder = ['不辣', '微辣', '中辣', '特辣']
    const levels: string[] = []
    basePool.forEach(dish => {
      const list =
        dish.spicyLevels && dish.spicyLevels.length
          ? dish.spicyLevels
          : ['不辣']
      list.forEach(level => {
        if (levels.indexOf(level) === -1) {
          levels.push(level)
        }
      })
    })
    levels.sort((a, b) => {
      const ai = levelOrder.indexOf(a)
      const bi = levelOrder.indexOf(b)
      return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi)
    })
    const spiceFilters = [{ key: 'all', label: '全部口味' }].concat(
      levels.map(level => ({ key: level, label: level }))
    )
    const activeSpice =
      this.data.spiceFilter === 'all' ||
      levels.indexOf(this.data.spiceFilter) > -1
        ? this.data.spiceFilter
        : 'all'
    if (activeSpice !== this.data.spiceFilter) {
      this.setData({ spiceFilter: activeSpice })
    }
    const spicePool = basePool.filter(dish => {
      if (activeSpice === 'all') {
        return true
      }
      const list =
        dish.spicyLevels && dish.spicyLevels.length
          ? dish.spicyLevels
          : ['不辣']
      return list.indexOf(activeSpice) > -1
    })
    // 标签筛选项按当前菜品池生成，取出现次数最多的前 5 个
    const tagCount: Record<string, number> = {}
    spicePool.forEach(dish => {
      ;(dish.tags || []).forEach(tag => {
        const name = String(tag || '').trim()
        if (name) {
          tagCount[name] = (tagCount[name] || 0) + 1
        }
      })
    })
    const tagNames = Object.keys(tagCount)
      .sort((a, b) => tagCount[b] - tagCount[a])
      .slice(0, 5)
    const tagFilters = [{ key: 'all', label: '全部标签', count: 0 }].concat(
      tagNames.map(name => ({
        key: name,
        label: name,
        count: tagCount[name]
      }))
    )
    const activeTag =
      this.data.tagFilter === 'all' ||
      tagNames.indexOf(this.data.tagFilter) > -1
        ? this.data.tagFilter
        : 'all'
    if (activeTag !== this.data.tagFilter) {
      this.setData({ tagFilter: activeTag })
    }
    const pool = spicePool.filter(
      dish =>
        activeTag === 'all' || (dish.tags || []).indexOf(activeTag) > -1
    )
    const sections = this._categories
      .map(category => ({
        ...category,
        dishes: pool
          .filter(dish => dish.categoryId === category.id)
          .sort((a, b) => {
            // 卖完的菜排到分类末尾，别挡着能点的
            const rank = (dish: Dish) =>
              dish.status === 'soldout' || dish.stock === 0 ? 1 : 0
            return rank(a) - rank(b)
          })
      }))
      .filter(section => section.dishes.length > 0)
    const favoriteHero = pool.find(dish => favorites.has(dish.id))
    const recommended = pool.filter(
      dish =>
        dish.isRecommended &&
        dish.status !== 'soldout' &&
        dish.stock !== 0
    )
    const heroCandidates = recommended.length
      ? recommended
      : pool.filter(dish => dish.status !== 'soldout' && dish.stock !== 0)
    const rotatingHero =
      heroCandidates.length > 0
        ? heroCandidates[
            Math.floor(Date.now() / (24 * 60 * 60 * 1000)) %
              heroCandidates.length
          ]
        : null
    const hero =
      favoriteHero ||
      (recommended.length === 1 ? recommended[0] : rotatingHero) ||
      pool[0] ||
      null
    const empty = sections.length === 0
    const spiceEmpty = empty && activeSpice !== 'all'
    const tagEmpty = empty && activeTag !== 'all'
    this.setData({
      sections,
      hero,
      heroImageFailed: false,
      spiceFilters,
      tagFilters,
      heroTag: favoriteHero ? '你收藏的' : this.data.recommendText || '今日推荐',
      emptyDesc:
        empty && this.data.onlyFavorites
          ? '还没有收藏，点开菜品点右上角的 ♡ 收藏'
          : empty && spiceEmpty
          ? '这个口味暂时没有菜，换一个试试'
          : empty && tagEmpty
          ? '这个标签暂时没有菜，换一个试试'
          : empty && this.data.onlyAvailable
          ? '能点的都卖完啦，看看全部菜吧'
          : this._baseEmptyDesc,
      emptyAction: empty
        ? this.data.onlyFavorites
          ? '看看全部'
          : spiceEmpty
          ? '全部口味'
          : tagEmpty
          ? '全部标签'
          : this.data.onlyAvailable
          ? '看全部菜'
          : '去许愿'
        : ''
    })
  },

  onToggleAvailable() {
    this.setData({ onlyAvailable: !this.data.onlyAvailable }, () => {
      this.renderSections()
      this.setData({ searchResults: this.filterDishes(this.data.keyword) })
    })
  },

  async loadPendingReviews() {
    try {
      const result = await getMyPendingReviewCount()
      this.setData({ pendingReviews: Number(result.count || 0) })
    } catch (e) {
      // 提醒失败不影响首页
    }
  },

  onPendingReviews() {
    wx.switchTab({ url: '/pages/orders/index' })
  },

  async loadCouponReminder() {
    try {
      const result = await getMyExpiringCoupons()
      this.setData({ couponExpiring: Number(result.count || 0) })
    } catch (e) {
      // 券提醒失败不影响首页
    }
  },

  onCouponReminder() {
    wx.navigateTo({ url: '/pages/coupons/index' })
  },

  async loadActiveOrder() {
    try {
      const order = await getMyActiveOrder()
      if (!order) {
        this.setData({ activeOrder: null })
        return
      }
      const totalQty = (order.items || []).reduce(
        (sum, item) => sum + Number(item.qty || 0),
        0
      )
      this.setData({
        activeOrder: {
          id: order.id,
          status: order.status,
          statusText: STATUS_TEXT[order.status],
          mealText: mealName(order.meal),
          summary:
            itemSummary((order.items || []).map(item => item.name)) +
            ` · 共 ${totalQty} 份`
        }
      })
    } catch (e) {
      // 没有进行中订单时保持隐藏
    }
  },

  onActiveOrderTap() {
    const order = this.data.activeOrder
    if (!order) {
      return
    }
    wx.navigateTo({ url: `/pages/order-detail/index?id=${order.id}` })
  },

  async loadLastOrder() {
    try {
      const order = await getLastOrder()
      if (!order) {
        this._lastOrderRaw = null
        this.setData({ lastOrder: null })
        return
      }
      this._lastOrderRaw = order
      const totalQty = (order.items || []).reduce(
        (sum, item) => sum + Number(item.qty || 0),
        0
      )
      this.setData({
        lastOrder: {
          id: order.id,
          meal: order.meal,
          mealText: mealName(order.meal),
          summary:
            itemSummary((order.items || []).map(item => item.name)) +
            ` · 共 ${totalQty} 份`,
          dateText: dateLabel(
            order.scheduledDate ||
              dateInputString(new Date(order.createdAt))
          )
        }
      })
    } catch (e) {
      // 没有历史订单时保持隐藏
    }
  },

  async onRepeatLast() {
    if (this._repeating) {
      return
    }
    const order = this._lastOrderRaw
    if (!order) {
      return
    }
    this._repeating = true
    wx.showLoading({ title: '加回购物车', mask: true })
    try {
      let dishes: Dish[] | null = null
      try {
        dishes = await getDishes()
      } catch (e) {
        dishes = null
      }
      const today = dateInputString()
      const maxDate = this.data.maxDate || today
      const targetDate =
        order.scheduledDate &&
        order.scheduledDate >= today &&
        order.scheduledDate <= maxDate
          ? order.scheduledDate
          : today
      const result = addOrderToCart(order, targetDate, dishes)
      if (!result.added) {
        wx.showToast({ title: '这些菜暂时都不供应了', icon: 'none' })
        return
      }
      this.setData(
        {
          selectedMeal: order.meal,
          selectedDate: targetDate,
          menuDateLabel: dateLabel(targetDate, this.data.todayDate || today)
        },
        () => {
          this.updateCartBadge()
          this.loadMenu()
        }
      )
      wx.showToast({
        title: result.skipped
          ? `已加购，${result.skipped} 道暂时没供应`
          : '已放回购物车',
        icon: 'none'
      })
    } finally {
      wx.hideLoading()
      this._repeating = false
    }
  },

  onSpiceFilter(e: any) {
    const key = String(e.currentTarget.dataset.key || 'all')
    if (key === this.data.spiceFilter) {
      return
    }
    this.setData({ spiceFilter: key }, () => {
      this.renderSections()
      this.setData({ searchResults: this.filterDishes(this.data.keyword) })
    })
  },

  onTagFilter(e: any) {
    const key = String(e.currentTarget.dataset.key || 'all')
    if (key === this.data.tagFilter) {
      return
    }
    this.setData({ tagFilter: key }, () => {
      this.renderSections()
      this.setData({ searchResults: this.filterDishes(this.data.keyword) })
    })
  },

  onToggleFavorites() {
    this.setData({ onlyFavorites: !this.data.onlyFavorites }, () => {
      this.renderSections()
      this.setData({ searchResults: this.filterDishes(this.data.keyword) })
    })
  },

  onCategoryJump(e: any) {
    const id = e.currentTarget.dataset.id
    if (!id) {
      return
    }
    wx.pageScrollTo({ selector: '#cat-' + id, duration: 300 })
  },

  onEmptyAction() {
    if (this.data.loadFailed) {
      this.loadMenu()
      return
    }
    if (this.data.onlyFavorites) {
      this.setData({ onlyFavorites: false }, () => this.renderSections())
      return
    }
    if (this.data.spiceFilter !== 'all') {
      this.setData({ spiceFilter: 'all' }, () => {
        this.renderSections()
        this.setData({ searchResults: this.filterDishes(this.data.keyword) })
      })
      return
    }
    if (this.data.tagFilter !== 'all') {
      this.setData({ tagFilter: 'all' }, () => {
        this.renderSections()
        this.setData({ searchResults: this.filterDishes(this.data.keyword) })
      })
      return
    }
    if (this.data.onlyAvailable) {
      this.setData({ onlyAvailable: false }, () => {
        this.renderSections()
        this.setData({ searchResults: this.filterDishes(this.data.keyword) })
      })
      return
    }
    wx.navigateTo({ url: '/pages/wishes/index' })
  },

  filterDishes(keyword: string): Dish[] {
    const kw = String(keyword || '')
      .trim()
      .toLowerCase()
    if (!kw) {
      return []
    }
    const pool = this.data.onlyFavorites
      ? favorites.filter(this._available)
      : this._available
    const availablePool = this.data.onlyAvailable
      ? pool.filter(dish => dish.status !== 'soldout' && dish.stock !== 0)
      : pool
    const spice = this.data.spiceFilter
    const tag = this.data.tagFilter
    return availablePool.filter(dish => {
      if (spice !== 'all') {
        const levels =
          dish.spicyLevels && dish.spicyLevels.length
            ? dish.spicyLevels
            : ['不辣']
        if (levels.indexOf(spice) === -1) {
          return false
        }
      }
      if (tag !== 'all' && (dish.tags || []).indexOf(tag) === -1) {
        return false
      }
      const category = (this._categories || []).find(
        item => item.id === dish.categoryId
      )
      const haystack = [
        dish.name,
        dish.desc,
        category ? category.name : ''
      ]
        .concat(dish.tags || [])
        .join(' ')
        .toLowerCase()
      return haystack.indexOf(kw) > -1
    })
  },

  onSearchInput(e: any) {
    const keyword = String(e.detail.value || '').slice(0, 20)
    this.setData({ keyword, searchResults: this.filterDishes(keyword) })
  },

  onClearSearch() {
    this.setData({ keyword: '', searchResults: [] })
  },

  onSearchConfirm(e: any) {
    const value = String(
      (e && e.detail && e.detail.value) || this.data.keyword || ''
    )
      .trim()
      .slice(0, 20)
    if (!value) {
      return
    }
    const history = [value]
      .concat((this.data.searchHistory || []).filter(item => item !== value))
      .slice(0, SEARCH_HISTORY_MAX)
    writeSearchHistory(history)
    this.setData({
      keyword: value,
      searchResults: this.filterDishes(value),
      searchHistory: history
    })
  },

  onHistoryTap(e: any) {
    const keyword = String(e.currentTarget.dataset.keyword || '')
    if (!keyword) {
      return
    }
    this.setData({
      keyword,
      searchResults: this.filterDishes(keyword)
    })
  },

  onClearHistory() {
    writeSearchHistory([])
    this.setData({ searchHistory: [] })
  },

  onWeekMenus() {
    wx.navigateTo({ url: '/pages/week-menus/index' })
  },

  onSurprise() {    const pool = this._available.filter(
      dish => dish.status !== 'soldout' && dish.stock !== 0
    )
    if (!pool.length) {
      wx.showToast({ title: '先等厨房上菜', icon: 'none' })
      return
    }
    const dish = pool[Math.floor(Math.random() * pool.length)]
    wx.showToast({ title: `不如吃${dish.name}？`, icon: 'none' })
    this.openSku(dish)
  },

  onDishTap(e: any) {
    this.openSku(e.detail.dish)
  },

  onQuickAdd(e: any) {
    this.quickAdd(e.detail.dish)
  },

  onHeroTap() {
    this.openSku(this.data.hero)
  },

  onHeroAdd() {
    this.quickAdd(this.data.hero)
  },

  onHeroImageError() {
    this.setData({ heroImageFailed: true })
  },

  quickAdd(dish: Dish | null) {
    if (!dish) {
      return
    }
    if (dish.status === 'soldout' || dish.stock === 0) {
      wx.showToast({ title: '这一道卖完啦', icon: 'none' })
      return
    }
    if (
      (dish.spicyLevels && dish.spicyLevels.length) ||
      (dish.addons && dish.addons.length)
    ) {
      this.openSku(dish)
      return
    }
    cart.add({
      key: '',
      meal: this.data.selectedMeal,
      date: this.data.selectedDate,
      dishId: dish.id,
      name: dish.name,
      price: dish.price,
      qty: 1,
      specs: [],
      note: '',
      color: dish.color
    })
    wx.showToast({ title: '已加购', icon: 'none' })
  },

  onRecipeTap(e: any) {
    const dish = e.detail && e.detail.dish
    if (dish && dish.id) {
      wx.navigateTo({ url: `/pages/recipe/index?id=${dish.id}` })
    }
  },

  openSku(dish: Dish | null) {
    if (!dish) {
      return
    }
    if (dish.status === 'soldout' || dish.stock === 0) {
      wx.showToast({ title: '今天卖完啦', icon: 'none' })
      return
    }
    this.setData({ activeDish: dish, skuVisible: true })
  },

  onSkuClose() {
    this.setData({ skuVisible: false })
  },

  onSkuAdd(e: any) {
    cart.add({
      ...e.detail.line,
      meal: this.data.selectedMeal,
      date: this.data.selectedDate
    })
    this.setData({ skuVisible: false })
    wx.showToast({ title: '已加购', icon: 'none' })
  },

  onCheckout() {
    if (this.data.cartCount <= 0) {
      wx.showToast({ title: '这一餐还没选菜', icon: 'none' })
      return
    }
    let url = `/pages/checkout/index?meal=${this.data.selectedMeal}&date=${this.data.selectedDate}`
    wx.navigateTo({ url })
  },

  onPullDownRefresh() {
    this.syncToday()
    this.setData({
      dateText: formatDate(),
      greetText: greeting()
    })
    this.loadMenu().then(() => wx.stopPullDownRefresh())
  },

  onShareAppMessage() {
    return {
      title: '张饱饭堂 · 她点单，你掌勺',
      path: '/pages/home/index'
    }
  },

  onShareTimeline() {
    return {
      title: '张饱饭堂 · 今天想吃啥？'
    }
  }
})
