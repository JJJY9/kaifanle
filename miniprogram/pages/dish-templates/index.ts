import type { DishInput } from '../../services/types'
import { getCategories, getDishes, saveDish } from '../../services/api'
import { DISH_TEMPLATES } from '../../utils/dish-templates'
import { DISH_BANK } from '../../utils/dish-bank'

const ALL_TEMPLATES = DISH_TEMPLATES.concat(DISH_BANK)

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
    keyword: '',
    missingCount: 0,
    summaryText: '',
    addingText: '',
    loading: true,
    adding: false,
    addingName: ''
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
      this.setData(
        {
          templates,
          filterCategories: [{ id: 'all', name: '全部' }].concat(
            usedCategories
          ),
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

  onSelectCategory(e: any) {
    const id = e.currentTarget.dataset.id
    if (id === this.data.activeCategory) {
      return
    }
    this.setData({ activeCategory: id })
    this.applyFilter()
  },

  applyFilter() {
    const keyword = this.data.keyword.trim().toLowerCase()
    const category = this.data.activeCategory
    const displayTemplates = this.data.templates.filter(template => {
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

  onCustomAdd() {
    wx.navigateTo({ url: '/pages/dish-edit/index' })
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
      addingText: `正在添加：${template.name}`
    })
    try {
      await saveDish(this.toInput(template))
      wx.showToast({ title: '已添加', icon: 'none' })
      this.load()
    } catch (err: any) {
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
    const failed: string[] = []
    for (const template of missing) {
      this.setData({ addingText: `正在添加：${template.name}` })
      try {
        await saveDish(this.toInput(template))
        done++
      } catch (err) {
        failed.push(template.name)
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
    this.setData({ adding: false, addingName: '', addingText: '' })
    this.load()
  }
})
