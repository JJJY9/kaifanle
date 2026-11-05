import { getDish, getMe } from '../../services/api'

Page({
  data: {
    dish: null as any,
    steps: [] as string[],
    isAdmin: false,
    loading: true,
    error: ''
  },

  dishId: '',

  onLoad(options: any) {
    this.dishId = options.id || ''
    this.load()
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

  onShareAppMessage() {
    const dish = this.data.dish
    return {
      title: dish ? `${dish.name} · 做法` : '张饱饭堂 · 菜谱',
      path: `/pages/recipe/index?id=${this.dishId}`
    }
  }
})
