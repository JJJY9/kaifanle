import { getDish, getMe } from '../../services/api'
import { favorites } from '../../store/favorites'

Page({
  data: {
    dish: null as any,
    steps: [] as string[],
    isAdmin: false,
    favorite: false,
    loading: true,
    error: ''
  },

  dishId: '',

  onLoad(options: any) {
    this.dishId = options.id || ''
    this.setData({
      favorite: this.dishId ? favorites.has(this.dishId) : false
    })
    this.load()
  },

  onShow() {
    if (this.dishId) {
      this.setData({ favorite: favorites.has(this.dishId) })
    }
  },

  async load() {
    this.setData({ error: '' })
    try {
      const dish = await getDish(this.dishId)
      if (!dish) {
        throw new Error('菜品不存在')
      }
      const steps = String(dish.recipe || '')
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean)
      const me = await getMe().catch(() => null)
      this.setData({
        dish,
        steps,
        isAdmin: Boolean(me && me.isAdmin),
        favorite: favorites.has(dish.id),
        loading: false
      })
    } catch (e: any) {
      this.setData({
        loading: false,
        error: String((e && e.message) || '加载失败').slice(0, 40)
      })
    }
  },

  onRetry() {
    this.setData({ loading: true })
    this.load()
  },

  onEdit() {
    if (this.data.isAdmin && this.dishId) {
      wx.navigateTo({ url: `/pages/dish-edit/index?id=${this.dishId}` })
    }
  },

  onToggleFavorite() {
    if (!this.dishId) {
      return
    }
    const favorite = favorites.toggle(this.dishId)
    this.setData({ favorite })
    wx.showToast({
      title: favorite ? '已收藏' : '已取消收藏',
      icon: 'none'
    })
  },

  onShareAppMessage() {
    const dish = this.data.dish
    return {
      title: dish ? `${dish.name} · 做法` : '张饱饭堂 · 菜谱',
      path: `/pages/recipe/index?id=${this.dishId}`
    }
  }
})
