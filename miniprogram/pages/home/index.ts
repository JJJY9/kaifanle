import type { CartLine, Category, Dish, MealId } from '../../services/types'
import {
  getCategories,
  getDishes,
  getBusiness,
  getKitchenStatus,
  getMenuForDate
} from '../../services/api'
import { cart } from '../../store/cart'
import { favorites } from '../../store/favorites'
import { MEALS } from '../../utils/constants'
import { USE_CLOUD } from '../../config'
import {
  currentMeal,
  dateLabel,
  formatDate,
  greeting,
  isOpenNow,
  dateInputString
} from '../../utils/format'

interface Section extends Category {
  dishes: Dish[]
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
    maxDate: '',
    menuDateLabel: '今天',
    deadlineText: '',
    busyText: '',
    hero: null as Dish | null,
    heroTag: '今日推荐',
    sections: [] as Section[],
    cartCount: 0,
    cartTotal: 0,
    skuVisible: false,
    activeDish: null as Dish | null,
    loading: true,
    mealNotice: '',
    notice: '',
    keyword: '',
    searchResults: [] as Dish[],
    emptyDesc: '换个餐次看看，或者去许愿池点个菜',
    emptyAction: '',
    emptyTitle: '这一餐还没开火',
    loadFailed: false,
    onlyFavorites: false,
    favoriteCount: 0,
    favoriteLabel: '♡ 我的收藏'
  },

  _unsub: null as null | (() => void),
  _favUnsub: null as null | (() => void),
  _available: [] as Dish[],
  _cartLines: [] as CartLine[],
  _pendingReorder: null as null | { meal: MealId; date: string },
  _categories: [] as Category[],
  _baseEmptyDesc: '',
  _loadSeq: 0,

  onLoad() {
    const app = getApp()
    const statusBarHeight =
      (app && app.globalData && app.globalData.statusBarHeight) || 20
    const today = dateInputString()
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
      maxDate: dateInputString(max),
      menuDateLabel: '今天'
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

  async loadMenu() {
    // 切换餐次很快时，只认最后一次请求的结果
    const seq = ++this._loadSeq
    // 已有菜单时静默刷新，避免切回 tab 时骨架屏闪一下
    if (!this.data.sections.length) {
      this.setData({ loading: true })
    }
    try {
      const meal = this.data.selectedMeal
      const today = this.data.todayDate || dateInputString()
      const date = this.data.selectedDate || today
      const isToday = date === today
      const [categories, dishes, business, menu, kitchenStatus] =
        await Promise.all([
          getCategories(),
          getDishes(),
          getBusiness().catch(() => null),
          getMenuForDate(date, meal).catch(() => null),
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
          notice: business && business.notice ? business.notice : '',
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

  updateCartBadge() {
    const lines = (this._cartLines || []).filter(
      line => line.meal === this.data.selectedMeal
    )
    const count = lines.reduce((sum, line) => sum + line.qty, 0)
    const total = lines.reduce((sum, line) => sum + line.qty * line.price, 0)
    this.setData({ cartCount: count, cartTotal: total })
  },

  renderSections() {
    const pool = this.data.onlyFavorites
      ? favorites.filter(this._available)
      : this._available
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
    const hero =
      favoriteHero ||
      pool.find(dish => dish.isRecommended) ||
      pool[0] ||
      null
    const empty = sections.length === 0
    this.setData({
      sections,
      hero,
      heroTag: favoriteHero ? '你收藏的' : '今日推荐',
      emptyDesc:
        empty && this.data.onlyFavorites
          ? '还没有收藏，点开菜品点右上角的 ♡ 收藏'
          : this._baseEmptyDesc,
      emptyAction: empty
        ? this.data.onlyFavorites
          ? '看看全部'
          : '去许愿'
        : ''
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
    return pool.filter(dish => {
      const haystack = [dish.name, dish.desc]
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
    cart.add({ ...e.detail.line, meal: this.data.selectedMeal })
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
