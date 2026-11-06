import type { Category, Dish, MealId } from '../../services/types'
import {
  getCategories,
  getDishes,
  getBusiness,
  getMenuForDate
} from '../../services/api'
import { cart } from '../../store/cart'
import { favorites } from '../../store/favorites'
import { MEALS } from '../../utils/constants'
import { USE_CLOUD } from '../../config'
import {
  currentMeal,
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
    hero: null as Dish | null,
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
    onlyFavorites: false,
    favoriteCount: 0,
    favoriteLabel: '♡ 我的收藏'
  },

  _unsub: null as null | (() => void),
  _favUnsub: null as null | (() => void),
  _available: [] as Dish[],
  _categories: [] as Category[],
  _baseEmptyDesc: '',
  _loadSeq: 0,

  onLoad() {
    const app = getApp()
    const statusBarHeight =
      (app && app.globalData && app.globalData.statusBarHeight) || 20

    this.setData({
      navPad: statusBarHeight + 14,
      dateText: formatDate(),
      greetText: greeting(),
      isOpen: isOpenNow(),
      selectedMeal: currentMeal()
    })

    this._unsub = cart.subscribe(lines => {
      const count = lines.reduce((sum, line) => sum + line.qty, 0)
      const total = lines.reduce((sum, line) => sum + line.qty * line.price, 0)
      this.setData({ cartCount: count, cartTotal: total })
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
      const today = dateInputString()
      const [categories, dishes, business, menu] = await Promise.all([
        getCategories(),
        getDishes(),
        getBusiness().catch(() => null),
        getMenuForDate(today, meal).catch(() => null)
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

      let isOpen = isOpenNow()
      let mealNotice = ''
      const closedToday = Boolean(
        business &&
          Array.isArray(business.closedDates) &&
          business.closedDates.indexOf(today) > -1
      )
      const mealSetting = business ? business[meal] : null
      if (closedToday) {
        isOpen = false
        mealNotice = (business && business.closedNote) || '今天休息，明天见'
      } else if (menuActive && menu!.open === false) {
        isOpen = false
        mealNotice = '这一餐还没排菜单'
      } else if (mealSetting) {
        const now = new Date()
        const nowMinutes = now.getHours() * 60 + now.getMinutes()
        const [deadlineHour, deadlineMinute] = mealSetting.deadline
          .split(':')
          .map(Number)
        const pastDeadline =
          nowMinutes > deadlineHour * 60 + deadlineMinute
        isOpen = mealSetting.open && !pastDeadline
        mealNotice = !mealSetting.open
          ? business!.closedNote || '今天休息，明天见'
          : pastDeadline
          ? '这一餐已经截单啦，下次早点来'
          : ''
      }

      this.setData(
        {
          loading: false,
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
      this.setData({
        loading: false,
        emptyAction: '',
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
    this.setData({ selectedMeal: meal }, () => this.loadMenu())
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
    const hero =
      pool.find(dish => dish.isRecommended) || pool[0] || null
    const empty = sections.length === 0
    this.setData({
      sections,
      hero,
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

  onEmptyAction() {
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

  onSurprise() {
    const pool = this._available.filter(
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
    if (dish.stock === 0) {
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
    cart.add(e.detail.line)
    this.setData({ skuVisible: false })
    wx.showToast({ title: '已加购', icon: 'none' })
  },

  onCheckout() {
    if (this.data.cartCount <= 0) {
      return
    }
    if (!this.data.isOpen) {
      wx.showToast({
        title: this.data.mealNotice || '这一餐休息中',
        icon: 'none'
      })
      return
    }
    wx.navigateTo({
      url: `/pages/checkout/index?meal=${this.data.selectedMeal}`
    })
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
