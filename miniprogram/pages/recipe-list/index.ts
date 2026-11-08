import { getCategories, getDishes } from '../../services/api'
import { favorites } from '../../store/favorites'

Page({
  data: {
    groups: [] as any[],
    displayGroups: [] as any[],
    keyword: '',
    total: 0,
    loading: true,
    error: ''
  },

  onLoad() {
    this.load()
  },

  async load() {
    this.setData({ error: '' })
    try {
      const [categories, dishes] = await Promise.all([
        getCategories(),
        getDishes()
      ])
      const byCategory: Record<string, any[]> = {}
      ;(dishes || []).forEach(dish => {
        const recipe = String(dish.recipe || '').trim()
        if (!recipe) {
          return
        }
        const steps = recipe
          .split('\n')
          .map(line => line.trim())
          .filter(Boolean)
        const item = {
          ...dish,
          stepsCount: steps.length,
          firstStep: steps[0] || '',
          favorite: favorites.has(dish.id)
        }
        if (!byCategory[dish.categoryId]) {
          byCategory[dish.categoryId] = []
        }
        byCategory[dish.categoryId].push(item)
      })
      const groups = categories
        .map(category => ({
          id: category.id,
          name: category.name,
          color: category.color,
          dishes: byCategory[category.id] || []
        }))
        .filter(group => group.dishes.length > 0)
      const total = groups.reduce(
        (sum, group) => sum + group.dishes.length,
        0
      )
      this.setData({ groups, total, loading: false })
      this.applyFilter(this.data.keyword)
    } catch (e: any) {
      this.setData({
        loading: false,
        error: String((e && e.message) || '加载失败').slice(0, 40)
      })
    }
  },

  onSearch(e: any) {
    const keyword = String(e.detail.value || '')
    this.setData({ keyword })
    this.applyFilter(keyword)
  },

  applyFilter(keyword: string) {
    const kw = String(keyword || '')
      .trim()
      .toLowerCase()
    const displayGroups = this.data.groups
      .map(group => ({
        ...group,
        dishes: kw
          ? group.dishes.filter(dish => {
              const haystack = `${dish.name} ${dish.desc} ${dish.recipe} ${(
                dish.ingredients || []
              ).join(' ')}`.toLowerCase()
              return haystack.indexOf(kw) > -1
            })
          : group.dishes
      }))
      .filter(group => group.dishes.length > 0)
    this.setData({ displayGroups })
  },

  onRetry() {
    this.setData({ loading: true })
    this.load()
  },

  onTapDish(e: any) {
    const id = e.currentTarget.dataset.id
    if (id) {
      wx.navigateTo({ url: `/pages/recipe/index?id=${id}` })
    }
  },

  onToggleFavorite(e: any) {
    const id = String((e.currentTarget && e.currentTarget.dataset.id) || '')
    if (!id) {
      return
    }
    const favorite = favorites.toggle(id)
    const update = (groups: any[]) =>
      (groups || []).map(group => ({
        ...group,
        dishes: (group.dishes || []).map((dish: any) =>
          dish.id === id ? { ...dish, favorite } : dish
        )
      }))
    this.setData({
      groups: update(this.data.groups),
      displayGroups: update(this.data.displayGroups)
    })
    wx.showToast({
      title: favorite ? '已收藏' : '已取消收藏',
      icon: 'none'
    })
  },

  onShareAppMessage() {
    return {
      title: '张饱饭堂 · 菜谱大全',
      path: '/pages/recipe-list/index'
    }
  },

  onShareTimeline() {
    return {
      title: '张饱饭堂 · 菜谱大全'
    }
  }
})
