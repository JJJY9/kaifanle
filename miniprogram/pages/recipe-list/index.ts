import { getCategories, getDishes } from '../../services/api'
import { favorites } from '../../store/favorites'

Page({
  data: {
    groups: [] as any[],
    displayGroups: [] as any[],
    keyword: '',
    favOnly: false,
    total: 0,
    loading: true,
    error: '',
    emptyTitle: '还没有菜谱',
    emptyDesc: '去菜品编辑里给菜写上做法吧'
  },

  _lastRandomId: '',

  onLoad() {
    this.load()
  },

  onShow() {
    if (!this.data.groups.length) {
      return
    }
    let changed = false
    const groups = this.data.groups.map(group => ({
      ...group,
      dishes: (group.dishes || []).map((dish: any) => {
        const favorite = favorites.has(dish.id)
        if (favorite !== dish.favorite) {
          changed = true
          return { ...dish, favorite }
        }
        return dish
      })
    }))
    if (changed) {
      this.setData({ groups }, () => this.applyFilter(this.data.keyword))
    }
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
    const favOnly = Boolean(this.data.favOnly)
    const displayGroups = this.data.groups
      .map(group => ({
        ...group,
        dishes: group.dishes
          .filter(dish => !favOnly || dish.favorite)
          .filter(dish => {
            if (!kw) {
              return true
            }
            const haystack = `${dish.name} ${dish.desc} ${dish.recipe} ${(
              dish.ingredients || []
            ).join(' ')}`.toLowerCase()
            return haystack.indexOf(kw) > -1
          })
      }))
      .filter(group => group.dishes.length > 0)
    let emptyTitle = '还没有菜谱'
    let emptyDesc = '去菜品编辑里给菜写上做法吧'
    if (kw) {
      emptyTitle = '没搜到菜谱'
      emptyDesc = '换个关键词试试'
    } else if (favOnly) {
      emptyTitle = '还没收藏菜谱'
      emptyDesc = '在菜谱里点 ♡ 收藏几道试试'
    }
    this.setData({ displayGroups, emptyTitle, emptyDesc })
  },

  onToggleFavOnly() {
    const favOnly = !this.data.favOnly
    this.setData({ favOnly }, () => this.applyFilter(this.data.keyword))
  },

  onRandomRecipe() {
    const pool = (this.data.displayGroups || []).reduce(
      (list: any[], group: any) => list.concat(group.dishes || []),
      []
    )
    if (!pool.length) {
      wx.showToast({
        title: this.data.favOnly ? '收藏里还没有菜谱' : '先调整筛选再试',
        icon: 'none'
      })
      return
    }
    let pick = pool[Math.floor(Math.random() * pool.length)]
    if (pool.length > 1 && pick.id === this._lastRandomId) {
      const others = pool.filter((dish: any) => dish.id !== pick.id)
      pick = others[Math.floor(Math.random() * others.length)] || pick
    }
    this._lastRandomId = pick.id
    wx.navigateTo({ url: `/pages/recipe/index?id=${pick.id}` })
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
    const groups = (this.data.groups || []).map(group => ({
      ...group,
      dishes: (group.dishes || []).map((dish: any) =>
        dish.id === id ? { ...dish, favorite } : dish
      )
    }))
    this.setData({ groups }, () => this.applyFilter(this.data.keyword))
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
