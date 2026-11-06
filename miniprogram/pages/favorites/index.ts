import type { Dish } from '../../services/types'
import { getDishes } from '../../services/api'
import { favorites } from '../../store/favorites'

Page({
  data: {
    loading: true,
    error: '',
    allFavorites: [] as Dish[],
    display: [] as Dish[],
    keyword: '',
    count: 0,
    sort: 'recent' as 'recent' | 'price'
  },

  _unsub: null as null | (() => void),

  onLoad() {
    this._unsub = favorites.subscribe(() => {
      this.applyFilter()
    })
  },

  onShow() {
    this.loadDishes()
  },

  onUnload() {
    if (this._unsub) {
      this._unsub()
      this._unsub = null
    }
  },

  async loadDishes() {
    try {
      const dishes = await getDishes()
      const dishMap: Record<string, any> = {}
      dishes.forEach(dish => {
        dishMap[dish.id] = dish
      })
      // 收藏 id 按收藏先后追加，倒序即最近收藏在前
      const allFavorites = favorites
        .getIds()
        .slice()
        .reverse()
        .map(id => dishMap[id])
        .filter(Boolean)
      this.setData(
        { allFavorites, count: allFavorites.length, loading: false, error: '' },
        () => this.applyFilter()
      )
    } catch (e: any) {
      this.setData({
        loading: false,
        error: String((e && e.message) || '收藏加载失败').slice(0, 60)
      })
    }
  },

  onSearch(e: any) {
    this.setData({ keyword: String(e.detail.value || '') }, () =>
      this.applyFilter()
    )
  },

  onClearSearch() {
    this.setData({ keyword: '' }, () => this.applyFilter())
  },

  applyFilter() {
    const keyword = String(this.data.keyword || '')
      .trim()
      .toLowerCase()
    const matched = keyword
      ? this.data.allFavorites.filter(dish =>
          `${dish.name} ${dish.desc || ''}`
            .toLowerCase()
            .indexOf(keyword) > -1
        )
      : this.data.allFavorites.slice()
    const display =
      this.data.sort === 'price'
        ? matched.sort((a, b) => Number(a.price) - Number(b.price))
        : matched
    this.setData({ display })
  },

  onSort(e: any) {
    const sort = e.currentTarget.dataset.sort === 'price' ? 'price' : 'recent'
    if (sort === this.data.sort) {
      return
    }
    this.setData({ sort }, () => this.applyFilter())
  },

  onTapDish(e: any) {
    const id = e.currentTarget.dataset.id
    if (id) {
      wx.navigateTo({ url: '/pages/recipe/index?id=' + id })
    }
  },

  onGoHome() {
    wx.switchTab({ url: '/pages/home/index' })
  },

  onRetry() {
    this.setData({ loading: true, error: '' })
    this.loadDishes()
  }
})
