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
  getMyPendingReviewCount,
  getMyProfile,
  getMySpecialDays,
  getMyStats,
  urgeOrder
} from '../../services/api'
import { cart } from '../../store/cart'
import { eatenText, getLastEatenMap, syncEatenFromCloud } from '../../store/eaten'
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

const LAST_MEAL_KEY = 'kfl_last_meal_v1'

function readLastMeal(): MealId {
  try {
    const raw = wx.getStorageSync(LAST_MEAL_KEY)
    const data = raw ? JSON.parse(raw) : null
    const meal = data && data.meal
    const at = Number(data && data.at)
    if (
      ['breakfast', 'lunch', 'dinner'].indexOf(meal) > -1 &&
      isFinite(at) &&
      Date.now() - at < 12 * 60 * 60 * 1000
    ) {
      return meal as MealId
    }
  } catch (e) {
    // 忽略
  }
  return currentMeal()
}

const WEEKDAY_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

function menuDateText(date: string, today: string): string {
  const label = dateLabel(date, today)
  if (label === '今天' || label === '明天') {
    return label
  }
  const parts = String(date || '').split('-').map(Number)
  if (parts.length !== 3 || parts.some(value => !isFinite(value))) {
    return label
  }
  const day = new Date(parts[0], parts[1] - 1, parts[2])
  return `${label} · ${WEEKDAY_NAMES[day.getDay()]}`
}

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
    specialBanner: '',
    dislikes: [] as string[],
    avoidDislikes: false,
    notice: '',
    noticeLong: false,
    noticeExpanded: false,
    recommendText: '今日推荐',
    keyword: '',
    searchResults: [] as Dish[],
    searchSuggestions: [] as Dish[],
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
    weekText: '',
    showCatBar: false,
    spiceFilter: 'all',
    spiceFilters: [] as { key: string; label: string }[],
    tagFilter: 'all',
    tagFilters: [] as { key: string; label: string; count: number }[]
  },

  _unsub: null as null | (() => void),
  _favUnsub: null as null | (() => void),
  _available: [] as Dish[],
  _heroCandidates: [] as Dish[],
  _cartLines: [] as CartLine[],
  _pendingReorder: null as null | { meal: MealId; date: string },
  _categories: [] as Category[],
  _baseEmptyDesc: '',
  _loadSeq: 0,
  _lastOrderRaw: null as any,
  _repeating: false,
  _urging: false,
  _urgeTimer: null as any,

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
      selectedMeal: readLastMeal(),
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
      this.renderSections()
      this.setData({
        searchResults: this.filterDishes(this.data.keyword)
      })
    })
  },

  async syncEatenCloud(force = false) {
    const changed = await syncEatenFromCloud(force).catch(() => false)
    if (changed) {
      this.loadMenu()
    }
  },

  onShow() {
    const tabBar: any = (this as any).getTabBar
      ? (this as any).getTabBar()
      : null
    if (tabBar) {
      tabBar.setData({ selected: 0 })
    }
    this.syncEatenCloud()
    favorites.syncFromCloud().catch(() => false)
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
            menuDateLabel: menuDateText(date, today)
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

  onHide() {
    if (this._urgeTimer) {
      clearTimeout(this._urgeTimer)
      this._urgeTimer = null
    }
  },

  onUnload() {
    this.onHide()
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
      menuDateLabel: menuDateText(selectedDate, today)
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
      const [
        categories,
        dishes,
        business,
        menu,
        kitchenStatus,
        specialDays,
        profile,
        stats
      ] = await Promise.all([
        getCategories(),
        getDishes(),
        getBusiness().catch(() => null),
        getMenuForDate(date, meal),
        getKitchenStatus().catch(() => null),
        getMySpecialDays().catch(() => null),
        getMyProfile().catch(() => null),
        getMyStats().catch(() => null)
      ])
      if (seq !== this._loadSeq) {
        return
      }
      const menuActive = Boolean(menu && menu.exists)
      const lastEaten = getLastEatenMap()
      const available = dishes
        .filter(
          dish =>
            dish.status !== 'off' &&
            dish.meals.indexOf(meal) > -1 &&
            (!menuActive || menu!.dishIds.indexOf(dish.id) > -1)
        )
        .map(dish => {
          const text = eatenText(Number(lastEaten[dish.id] || 0))
          return text ? { ...dish, lastEatenText: text } : dish
        })
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

      const nearestSpecial =
        specialDays && specialDays.days && specialDays.days[0]
      const dislikes =
        profile && Array.isArray(profile.dislikes)
          ? profile.dislikes.filter(Boolean)
          : []
      const avoidDislikes =
        Boolean(this.data.avoidDislikes) && dislikes.length > 0
      let specialBanner = ''
      if (nearestSpecial) {
        const label =
          nearestSpecial.kind === 'birthday' ? '生日' : '纪念日'
        const icon = nearestSpecial.kind === 'birthday' ? '🎂' : '💗'
        const when =
          nearestSpecial.days === 0
            ? '今天'
            : nearestSpecial.days === 1
            ? '明天'
            : `还有 ${nearestSpecial.days} 天`
        specialBanner =
          nearestSpecial.days === 0
            ? `${icon} 今天是你的${label}，掌勺人会提前准备`
            : `${icon} ${when}是你的${label}，掌勺人会提前准备`
      }

      const weekCount = stats ? Number(stats.week || 0) : 0
      const weekSpend = stats ? Number(stats.weekSpend || 0) : 0
      const weekFavorite = stats ? String(stats.weekFavorite || '') : ''
      const weekFavoriteQty = stats ? Number(stats.weekFavoriteQty || 0) : 0
      const weekText =
        weekCount > 0
          ? `本周已吃 ${weekCount} 顿 · ¥${weekSpend}${
              weekFavorite
                ? ` · 最常点 ${weekFavorite}${
                    weekFavoriteQty ? ` ×${weekFavoriteQty}` : ''
                  }`
                : ''
            }`
          : ''
      const noticeText =
        business &&
        business.notice &&
        (!business.noticeFrom || business.noticeFrom <= today) &&
        (!business.noticeUntil || business.noticeUntil >= today)
          ? business.notice
          : ''
      this.setData(
        {
          loading: false,
          loadFailed: false,
          emptyTitle: '这一餐还没开火',
          deadlineText,
          busyText,
          isOpen,
          mealNotice,
          specialBanner,
          dislikes,
          avoidDislikes,
          weekText,
          notice: noticeText,
          noticeLong: String(noticeText).length > 40,
          noticeExpanded: false,
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
        specialBanner: '',
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
    try {
      wx.setStorageSync(
        LAST_MEAL_KEY,
        JSON.stringify({ meal, at: Date.now() })
      )
    } catch (e) {
      // 忽略存储失败
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
        menuDateLabel: menuDateText(date, this.data.todayDate)
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

  matchesDislikes(dish: Dish): boolean {
    const dislikes = this.data.dislikes || []
    if (!dislikes.length) {
      return false
    }
    const text = [
      dish.name,
      (dish.ingredients || []).join(' '),
      (dish.allergens || []).join(' ')
    ]
      .join(' ')
      .toLowerCase()
    return dislikes.some(item =>
      text.indexOf(String(item || '').trim().toLowerCase()) > -1
    )
  },

  renderSections() {
    const source =
      this.data.avoidDislikes && this.data.dislikes.length
        ? this._available.filter(dish => !this.matchesDislikes(dish))
        : this._available
    const favoritePool = this.data.onlyFavorites
      ? favorites.filter(source)
      : source
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
          .map(dish => ({ ...dish, favorite: favorites.has(dish.id) }))
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
    this._heroCandidates = pool.filter(
      dish => dish.status !== 'soldout' && dish.stock !== 0
    )
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
    const avoidEmpty =
      empty && this.data.avoidDislikes && this.data.dislikes.length > 0
    this.setData({
      sections,
      hero,
      heroImageFailed: false,
      emptyTitle: avoidEmpty ? '避开忌口后没有菜' : '这一餐还没开火',
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
          : avoidEmpty
          ? '避开忌口后没有菜了，可以关掉筛选看看'
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
          : avoidEmpty
          ? '关掉避开忌口'
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

  onToggleAvoidDislikes() {
    if (!this.data.dislikes.length) {
      wx.showToast({ title: '先去口味与档案填忌口', icon: 'none' })
      return
    }
    this.setData({ avoidDislikes: !this.data.avoidDislikes }, () => {
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

  onWeekReport() {
    wx.navigateTo({ url: '/pages/my-report/index' })
  },

  onCopyWeek() {
    const text = String(this.data.weekText || '')
    if (!text) {
      return
    }
    wx.setClipboardData({
      data: text,
      success: () => {
        wx.showToast({ title: '本周小结已复制', icon: 'none' })
      }
    })
  },

  onToggleNotice() {
    if (!this.data.noticeLong) {
      return
    }
    this.setData({ noticeExpanded: !this.data.noticeExpanded })
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
      const messages = order.messages || []
      const lastMessage = messages[messages.length - 1]
      const lastMessageText = lastMessage
        ? `${
            lastMessage.role === 'admin' ? '掌勺人' : '她'
          }：${String(lastMessage.content || '').slice(0, 24)}${
            String(lastMessage.content || '').length > 24 ? '…' : ''
          }`
        : ''
      const expectedRaw = String(order.expectedTime || '').trim()
      const eta =
        order.status === 'ready'
          ? ''
          : expectedRaw === '尽快'
            ? '尽快出锅'
            : expectedRaw
              ? `预计 ${expectedRaw} 出锅`
              : ''
      const urgeUntil = order.urgedAt
        ? Number(order.urgedAt) + 5 * 60 * 1000
        : 0
      this.setData(
        {
          activeOrder: {
            id: order.id,
            no: order.no || '',
            status: order.status,
            statusText: STATUS_TEXT[order.status],
            waitedText: (() => {
              const createdAt = Number(order.createdAt || 0)
              if (!createdAt) {
                return ''
              }
              const created = new Date(createdAt)
              const now = new Date()
              if (created.toDateString() !== now.toDateString()) {
                return ''
              }
              const minutes = Math.floor((now.getTime() - createdAt) / 60000)
              return minutes >= 1 ? `已等 ${minutes} 分钟` : ''
            })(),
            mealText: mealName(order.meal),
            lastMessageText,
            expectedText: eta,
            messageBadge: Math.max(0, Number(order.customerUnread) || 0),
            urgeUntil,
            urgeCooling: urgeUntil > Date.now(),
            canUrge:
              ['pending', 'accepted', 'cooking'].indexOf(order.status) > -1,
            summary:
              itemSummary((order.items || []).map(item => item.name)) +
              ` · 共 ${totalQty} 份`
          }
        },
        () => this.scheduleUrgeRefresh()
      )
    } catch (e) {
      // 没有进行中订单时保持隐藏
    }
  },

  scheduleUrgeRefresh() {
    if (this._urgeTimer) {
      clearTimeout(this._urgeTimer)
      this._urgeTimer = null
    }
    const order = this.data.activeOrder
    if (!order || !order.urgeCooling) {
      return
    }
    const remain = Number(order.urgeUntil || 0) - Date.now()
    if (remain <= 0) {
      this.setData({ 'activeOrder.urgeCooling': false })
      return
    }
    this._urgeTimer = setTimeout(() => {
      this._urgeTimer = null
      const current = this.data.activeOrder
      if (current && Number(current.urgeUntil || 0) <= Date.now()) {
        this.setData({ 'activeOrder.urgeCooling': false })
      } else {
        this.scheduleUrgeRefresh()
      }
    }, Math.min(remain + 50, 5 * 60 * 1000))
  },

  onActiveOrderTap() {
    const order = this.data.activeOrder
    if (!order) {
      return
    }
    wx.navigateTo({ url: `/pages/order-detail/index?id=${order.id}` })
  },

  onCopyActiveOrder() {
    const order = this.data.activeOrder
    const no = String((order && order.no) || '')
    if (!no) {
      return
    }
    wx.setClipboardData({
      data: no,
      success: () => wx.showToast({ title: '订单号已复制', icon: 'none' })
    })
  },

  async onQuickUrge() {
    const order = this.data.activeOrder
    if (!order || this._urging) {
      return
    }
    if (!order.canUrge) {
      wx.showToast({ title: '这一单不用催啦', icon: 'none' })
      return
    }
    if (Number(order.urgeUntil || 0) > Date.now()) {
      this.setData({ 'activeOrder.urgeCooling': true })
      wx.showToast({ title: '刚催过啦，掌勺人正在忙', icon: 'none' })
      return
    }
    this._urging = true
    try {
      const updated = await urgeOrder(order.id)
      wx.showToast({ title: '帮你催啦，掌勺人马上看', icon: 'none' })
      const until =
        Number(updated && updated.urgedAt ? updated.urgedAt : 0) + 5 * 60 * 1000
      this.setData({
        'activeOrder.urgeCooling': true,
        'activeOrder.urgeUntil': until > Date.now() ? until : Date.now() + 5 * 60 * 1000
      })
      this.scheduleUrgeRefresh()
      this.loadActiveOrder()
    } catch (e: any) {
      wx.showToast({
        title: String((e && e.message) || '催单失败').slice(0, 40),
        icon: 'none'
      })
    } finally {
      this._urging = false
    }
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
          menuDateLabel: menuDateText(targetDate, this.data.todayDate || today)
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
    if (this.data.avoidDislikes) {
      this.setData({ avoidDislikes: false }, () => {
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
    const source =
      this.data.avoidDislikes && this.data.dislikes.length
        ? this._available.filter(dish => !this.matchesDislikes(dish))
        : this._available
    const pool = this.data.onlyFavorites
      ? favorites.filter(source)
      : source
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
        .concat(dish.ingredients || [])
        .join(' ')
        .toLowerCase()
      return haystack.indexOf(kw) > -1
    })
      .map(dish => ({ ...dish, favorite: favorites.has(dish.id) }))
  },

  suggestDishes(keyword: string): Dish[] {
    const kw = String(keyword || '')
      .trim()
      .toLowerCase()
    if (!kw) {
      return []
    }
    const chars = Array.from(new Set(kw.split(''))).filter(char =>
      char.trim()
    )
    if (!chars.length) {
      return []
    }
    const ranked = (this._available || [])
      .filter(dish => dish.status === 'on' && dish.stock !== 0)
      .map(dish => {
        const category = (this._categories || []).find(
          item => item.id === dish.categoryId
        )
        const haystack = [
          dish.name,
          dish.desc,
          category ? category.name : ''
        ]
          .concat(dish.tags || [])
          .concat(dish.ingredients || [])
          .join(' ')
          .toLowerCase()
        let score = dish.name.toLowerCase().indexOf(kw) > -1 ? 5 : 0
        chars.forEach(char => {
          if (haystack.indexOf(char) > -1) {
            score++
          }
        })
        return { dish, score }
      })
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
    return ranked.map(item => item.dish)
  },

  onSearchInput(e: any) {
    const keyword = String(e.detail.value || '').slice(0, 20)
    const searchResults = this.filterDishes(keyword)
    this.setData({
      keyword,
      searchResults,
      searchSuggestions: searchResults.length
        ? []
        : this.suggestDishes(keyword)
    })
  },

  onClearSearch() {
    this.setData({
      keyword: '',
      searchResults: [],
      searchSuggestions: []
    })
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
    const searchResults = this.filterDishes(value)
    this.setData({
      keyword: value,
      searchResults,
      searchSuggestions: searchResults.length
        ? []
        : this.suggestDishes(value),
      searchHistory: history
    })
  },

  onHistoryTap(e: any) {
    const keyword = String(e.currentTarget.dataset.keyword || '')
    if (!keyword) {
      return
    }
    const searchResults = this.filterDishes(keyword)
    this.setData({
      keyword,
      searchResults,
      searchSuggestions: searchResults.length
        ? []
        : this.suggestDishes(keyword)
    })
  },

  onSuggestionTap(e: any) {
    const id = String(e.currentTarget.dataset.id || '')
    const dish = (this._available || []).find(item => item.id === id)
    if (dish) {
      this.openSku(dish)
    }
  },

  onGoWish() {
    wx.navigateTo({ url: '/pages/wishes/index' })
  },

  onClearHistory() {
    writeSearchHistory([])
    this.setData({ searchHistory: [] })
  },

  onRemoveHistory(e: any) {
    const keyword = String(e.currentTarget.dataset.keyword || '')
    if (!keyword) {
      return
    }
    const searchHistory = (this.data.searchHistory || []).filter(
      item => item !== keyword
    )
    writeSearchHistory(searchHistory)
    this.setData({ searchHistory })
    wx.showToast({ title: '已从搜索历史移除', icon: 'none' })
  },

  onWeekMenus() {
    wx.navigateTo({ url: '/pages/week-menus/index' })
  },

  onSurprise() {
    const source =
      this.data.avoidDislikes && this.data.dislikes.length
        ? this._available.filter(dish => !this.matchesDislikes(dish))
        : this._available
    const pool = source.filter(
      dish => dish.status !== 'soldout' && dish.stock !== 0
    )
    if (!pool.length) {
      wx.showToast({ title: '先等厨房上菜', icon: 'none' })
      return
    }
    const eaten = getLastEatenMap()
    const fresh = pool.filter(
      dish => eatenText(Number(eaten[dish.id] || 0)) !== '今天吃过'
    )
    const base = fresh.length ? fresh : pool
    const favPool = base.filter(dish => favorites.has(dish.id))
    const fromFav = favPool.length > 0 && Math.random() < 0.5
    const pickPool = fromFav ? favPool : base
    const dish = pickPool[Math.floor(Math.random() * pickPool.length)]
    wx.showToast({
      title: `${fromFav ? '你收藏的' : '不如吃'}${dish.name}？`,
      icon: 'none'
    })
    this.openSku(dish)
  },

  onDishFavorite(e: any) {
    const dish = e.detail && e.detail.dish
    if (!dish || !dish.id) {
      return
    }
    const favorite = favorites.toggle(dish.id)
    wx.showToast({
      title: favorite ? '已收藏' : '已取消收藏',
      icon: 'none'
    })
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

  onNextHero() {
    const list = this._heroCandidates || []
    if (list.length < 2) {
      wx.showToast({ title: '今天就这一道推荐', icon: 'none' })
      return
    }
    const currentId = this.data.hero && this.data.hero.id
    let index = list.findIndex(dish => dish.id === currentId)
    index = (index + 1) % list.length
    this.setData({
      hero: list[index],
      heroImageFailed: false,
      heroTag: this.data.recommendText || '今日推荐'
    })
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
      wx.navigateTo({
        url: `/pages/recipe/index?id=${dish.id}&meal=${
          this.data.selectedMeal
        }&date=${this.data.selectedDate}`
      })
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
    this.loadActiveOrder()
    favorites.syncFromCloud(true).catch(() => false)
    this.loadMenu().then(() => wx.stopPullDownRefresh())
  },

  onShareAppMessage() {
    const dishCount = (this._available || []).length
    const label = String(this.data.menuDateLabel || '今天')
    const title = dishCount
      ? `张饱饭堂 · ${label} ${dishCount} 道菜等你点`
      : '张饱饭堂 · 她点单，你掌勺'
    return {
      title,
      path: '/pages/home/index'
    }
  },

  onShareTimeline() {
    const dishCount = (this._available || []).length
    const label = String(this.data.menuDateLabel || '今天')
    return {
      title: dishCount
        ? `张饱饭堂 · ${label} ${dishCount} 道菜等你点`
        : '张饱饭堂 · 今天想吃啥？'
    }
  }
})
