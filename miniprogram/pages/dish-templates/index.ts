import type { DishInput } from '../../services/types'
import { getCategories, getDishes, saveDish } from '../../services/api'
import { DISH_TEMPLATES } from '../../utils/dish-templates'
import { DISH_BANK } from '../../utils/dish-bank'

const ALL_TEMPLATES = DISH_TEMPLATES.concat(DISH_BANK)
const CATEGORY_KEY = 'templateCategoryFilter'
const SEARCH_HISTORY_KEY = 'kfl_template_search_history_v1'
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

const MEAL_NAMES: Record<string, string> = {
  breakfast: '早',
  lunch: '午',
  dinner: '晚'
}

Page({
  data: {
    templates: [] as any[],
    displayTemplates: [] as any[],
    filterCategories: [] as any[],
    activeCategory: 'all',
    onlyMissing: false,
    keyword: '',
    searchHistory: readSearchHistory(),
    missingCount: 0,
    summaryText: '',
    addingText: '',
    loading: true,
    adding: false,
    addingName: '',
    lastErrorText: ''
  },

  onShow() {
    this.load()
  },

  async load() {
    try {
      const [categories, dishes] = await Promise.all([
        getCategories(),
        getDishes()
      ])
      const categoryMap: Record<string, string> = {}
      const usedCategories: any[] = []
      categories.forEach(category => {
        categoryMap[category.id] = category.name
      })
      const templateCategoryIds: Record<string, boolean> = {}
      ALL_TEMPLATES.forEach(template => {
        templateCategoryIds[template.categoryId] = true
      })
      categories.forEach(category => {
        if (templateCategoryIds[category.id]) {
          usedCategories.push({ id: category.id, name: category.name })
        }
      })
      const existing: Record<string, boolean> = {}
      ;(dishes || []).forEach(dish => {
        existing[String(dish.name || '').trim()] = true
      })
      const templates = ALL_TEMPLATES.map((template, index) => ({
        ...template,
        index,
        categoryName: categoryMap[template.categoryId] || '',
        mealsText: template.meals
          .map(meal => MEAL_NAMES[meal] || meal)
          .join('/'),
        exists: Boolean(existing[template.name.trim()])
      }))
      const missingCount = templates.filter(item => !item.exists).length
      const filterCategories = [{ id: 'all', name: '全部' }].concat(
        usedCategories
      )
      let savedCategory = 'all'
      try {
        savedCategory = String(wx.getStorageSync(CATEGORY_KEY) || 'all')
      } catch (e) {
        savedCategory = 'all'
      }
      const activeCategory = filterCategories.some(
        category => category.id === savedCategory
      )
        ? savedCategory
        : 'all'
      this.setData(
        {
          templates,
          filterCategories,
          activeCategory,
          missingCount,
          summaryText: missingCount
            ? `还有 ${missingCount} 道可以添加`
            : '模板里的菜都已添加',
          loading: false
        },
        () => this.applyFilter()
      )
    } catch (e: any) {
      this.setData({ loading: false })
      wx.showToast({
        title: String((e && e.message) || '加载失败').slice(0, 40),
        icon: 'none'
      })
    }
  },

  onSearch(e: any) {
    const keyword = String(e.detail.value || '')
    this.setData({ keyword })
    this.applyFilter()
  },

  onClearSearch() {
    this.setData({ keyword: '' })
    this.applyFilter()
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
    const searchHistory = [value]
      .concat((this.data.searchHistory || []).filter(item => item !== value))
      .slice(0, SEARCH_HISTORY_MAX)
    writeSearchHistory(searchHistory)
    this.setData({ keyword: value, searchHistory })
    this.applyFilter()
  },

  onHistoryTap(e: any) {
    const keyword = String(e.currentTarget.dataset.keyword || '')
    if (!keyword) {
      return
    }
    this.setData({ keyword })
    this.applyFilter()
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
  },

  onSelectCategory(e: any) {
    const id = e.currentTarget.dataset.id
    if (id === this.data.activeCategory) {
      return
    }
    this.setData({ activeCategory: id })
    try {
      wx.setStorageSync(CATEGORY_KEY, id)
    } catch (e) {
      // 存储失败时只影响下次记忆，不影响本次筛选
    }
    this.applyFilter()
  },

  applyFilter() {
    const keyword = this.data.keyword.trim().toLowerCase()
    const category = this.data.activeCategory
    const onlyMissing = this.data.onlyMissing
    const displayTemplates = this.data.templates.filter(template => {
      if (onlyMissing && template.exists) {
        return false
      }
      if (category !== 'all' && template.categoryId !== category) {
        return false
      }
      if (!keyword) {
        return true
      }
      const haystack = `${template.name} ${template.desc} ${
        template.recipe || ''
      }`.toLowerCase()
      return haystack.indexOf(keyword) > -1
    })
    this.setData({ displayTemplates })
  },

  onToggleMissing() {
    this.setData({ onlyMissing: !this.data.onlyMissing }, () =>
      this.applyFilter()
    )
  },

  onImport() {
    wx.navigateTo({ url: '/pages/dish-import/index' })
  },

  onCustomAdd() {    wx.navigateTo({ url: '/pages/dish-edit/index' })
  },

  toInput(template: any): DishInput {
    return {
      name: template.name,
      desc: template.desc,
      price: template.price,
      categoryId: template.categoryId,
      tags: template.tags,
      spicyLevels: template.spicyLevels,
      addons: template.addons,
      color: template.color,
      meals: template.meals,
      status: template.status,
      stock: template.stock,
      isRecommended: template.isRecommended,
      recipe: template.recipe
    }
  },

  async onAddOne(e: any) {
    if (this.data.adding) {
      return
    }
    const index = Number(e.currentTarget.dataset.index)
    const template = this.data.templates[index]
    if (!template || template.exists) {
      return
    }
    this.setData({
      adding: true,
      addingName: template.name,
      addingText: `正在添加：${template.name}`,
      lastErrorText: ''
    })
    try {
      await saveDish(this.toInput(template))
      wx.showToast({ title: '已添加', icon: 'none' })
      this.load()
    } catch (err: any) {
      this.setData({
        lastErrorText: String((err && err.message) || err || '添加失败')
      })
      wx.showToast({
        title: String((err && err.message) || '添加失败').slice(0, 40),
        icon: 'none'
      })
    } finally {
      this.setData({ adding: false, addingName: '', addingText: '' })
    }
  },

  async onAddAll() {
    if (this.data.adding) {
      return
    }
    const missing = this.data.templates.filter(item => !item.exists)
    if (!missing.length) {
      wx.showToast({ title: '模板里的菜都加过了', icon: 'none' })
      return
    }
    const res: any = await wx.showModal({
      title: `添加 ${missing.length} 道菜？`,
      content: '会按模板的价格和分类创建，添加后可以再修改。',
      confirmText: '添加',
      cancelText: '算了'
    })
    if (!res.confirm) {
      return
    }
    this.setData({ adding: true, addingName: '', addingText: '正在添加…' })
    let done = 0
    let lastError = ''
    const failed: string[] = []
    for (const template of missing) {
      this.setData({ addingText: `正在添加：${template.name}` })
      try {
        await saveDish(this.toInput(template))
        done++
      } catch (err: any) {
        failed.push(template.name)
        lastError = String((err && err.message) || err || '添加失败')
      }
    }
    if (failed.length) {
      wx.showModal({
        title: `已添加 ${done} 道`,
        content: `有 ${failed.length} 道没加上：${failed
          .slice(0, 6)
          .join('、')}${failed.length > 6 ? '…' : ''}。可以再点一次全部添加重试。`,
        showCancel: false,
        confirmText: '知道了'
      })
    } else {
      wx.showToast({ title: `已添加 ${done} 道菜`, icon: 'none' })
    }
    this.setData({
      adding: false,
      addingName: '',
      addingText: '',
      lastErrorText: lastError
    })
    this.load()
  }
})
