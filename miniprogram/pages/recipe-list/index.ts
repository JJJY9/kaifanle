import { getCategories, getDishes } from '../../services/api'
import { favorites } from '../../store/favorites'

const RECIPE_SEARCH_HISTORY_KEY = 'kfl_recipe_search_v1'
const RECIPE_SEARCH_HISTORY_MAX = 6
const RECIPE_FAV_ONLY_KEY = 'kfl_recipe_fav_only_v1'

function readFavOnly(): boolean {
  try {
    return wx.getStorageSync(RECIPE_FAV_ONLY_KEY) === '1'
  } catch (e) {
    return false
  }
}

function writeFavOnly(value: boolean) {
  try {
    wx.setStorageSync(RECIPE_FAV_ONLY_KEY, value ? '1' : '')
  } catch (e) {
    // 忽略存储失败
  }
}

function readRecipeSearchHistory(): string[] {
  try {
    const raw = wx.getStorageSync(RECIPE_SEARCH_HISTORY_KEY)
    const list = raw ? JSON.parse(raw) : []
    if (!Array.isArray(list)) {
      return []
    }
    return list
      .map((item: any) => String(item || '').trim())
      .filter(Boolean)
      .slice(0, RECIPE_SEARCH_HISTORY_MAX)
  } catch (e) {
    return []
  }
}

function writeRecipeSearchHistory(list: string[]) {
  try {
    wx.setStorageSync(
      RECIPE_SEARCH_HISTORY_KEY,
      JSON.stringify((list || []).slice(0, RECIPE_SEARCH_HISTORY_MAX))
    )
  } catch (e) {
    // 忽略存储失败
  }
}

Page({
  data: {
    groups: [] as any[],
    displayGroups: [] as any[],
    keyword: '',
    searching: false,
    favOnly: false,
    recipeSearchHistory: [] as string[],
    total: 0,
    loading: true,
    error: '',
    emptyTitle: '还没有菜谱',
    emptyDesc: '去菜品编辑里给菜写上做法吧'
  },

  _lastRandomId: '',

  onLoad() {
    this.setData({
      recipeSearchHistory: readRecipeSearchHistory(),
      favOnly: readFavOnly()
    })
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
    this.setData({ keyword, searching: keyword.trim().length > 0 })
    this.applyFilter(keyword)
  },

  onSearchConfirm(e: any) {
    const value = String(
      (e && e.detail && e.detail.value) || this.data.keyword || ''
    )
      .trim()
      .slice(0, 20)
    if (!value) {
      this.setData({ keyword: '', searching: false })
      this.applyFilter('')
      return
    }
    const recipeSearchHistory = [value]
      .concat(
        (this.data.recipeSearchHistory || []).filter(item => item !== value)
      )
      .slice(0, RECIPE_SEARCH_HISTORY_MAX)
    writeRecipeSearchHistory(recipeSearchHistory)
    this.setData({ keyword: value, searching: true, recipeSearchHistory })
    this.applyFilter(value)
  },

  onSearchClear() {
    this.setData({ keyword: '', searching: false })
    this.applyFilter('')
  },

  onRecipeHistoryTap(e: any) {
    const keyword = String(e.currentTarget.dataset.keyword || '')
    if (!keyword) {
      return
    }
    this.setData({ keyword, searching: true })
    this.applyFilter(keyword)
  },

  onRecipeHistoryRemove(e: any) {
    const keyword = String(e.currentTarget.dataset.keyword || '')
    if (!keyword) {
      return
    }
    const recipeSearchHistory = (this.data.recipeSearchHistory || []).filter(
      item => item !== keyword
    )
    writeRecipeSearchHistory(recipeSearchHistory)
    this.setData({ recipeSearchHistory })
    wx.showToast({ title: '已从搜索历史移除', icon: 'none' })
  },

  onRecipeHistoryClear() {
    writeRecipeSearchHistory([])
    this.setData({ recipeSearchHistory: [] })
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
    writeFavOnly(favOnly)
    this.setData({ favOnly }, () => this.applyFilter(this.data.keyword))
  },

  onRandomRecipe() {
    const pool = (this.data.displayGroups || []).reduce(
      (list: any[], group: any) => list.concat(group.dishes || []),
      []
    )
    if (!pool.length) {
      wx.showToast({
        title: String(this.data.keyword || '').trim()
          ? '换个关键词再试'
          : this.data.favOnly
          ? '收藏里还没有菜谱'
          : '先调整筛选再试',
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
    const title = this.data.total
      ? `张饱饭堂 · ${this.data.total} 道家常菜谱`
      : '张饱饭堂 · 菜谱大全'
    return {
      title,
      path: '/pages/recipe-list/index'
    }
  },

  onShareTimeline() {
    const title = this.data.total
      ? `张饱饭堂 · ${this.data.total} 道家常菜谱`
      : '张饱饭堂 · 菜谱大全'
    return {
      title
    }
  }
})
