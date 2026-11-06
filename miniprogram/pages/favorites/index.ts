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
    count: 0
  },

  _unsub: null as null | (() => void),

  onLoad() {
    this._unsub = favorites.subscribe(ids => {
      this.setData({ count: ids.length }, () => this.applyFilter())
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
      const allFavorites = favorites.filter(dishes)
      this.setData({ allFavorites, loading: false, error: '' }, () =>
        this.applyFilter()
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
    const display = keyword
      ? this.data.allFavorites.filter(dish =>
          `${dish.name} ${dish.desc || ''}`
            .toLowerCase()
            .indexOf(keyword) > -1
        )
      : this.data.allFavorites
    this.setData({ display })
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
