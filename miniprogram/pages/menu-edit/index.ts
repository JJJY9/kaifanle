import type { MealId } from '../../services/types'
import {
  deleteMenu,
  getCategories,
  getDishes,
  getMenuForDate,
  saveMenu
} from '../../services/api'
import { MEALS } from '../../utils/constants'
import {
  currentMeal,
  dateInputString
} from '../../utils/format'
import { backAfter } from '../../utils/nav'

interface DateOption {
  value: string
  label: string
}

interface MenuTemplate {
  id: string
  name: string
  meal: MealId
  dishIds: string[]
  updatedAt: number
}

const TEMPLATE_KEY = 'kfl_menu_templates_v1'
// 操作菜单最多 6 项，留一项给「清空模板」
const MAX_TEMPLATES = 5

function readTemplates(): MenuTemplate[] {
  try {
    const raw = wx.getStorageSync(TEMPLATE_KEY)
    const list = raw ? JSON.parse(raw) : []
    return Array.isArray(list) ? list : []
  } catch (e) {
    return []
  }
}

function writeTemplates(list: MenuTemplate[]) {
  try {
    wx.setStorageSync(TEMPLATE_KEY, JSON.stringify(list))
  } catch (e) {
    // 存储失败不影响当前排菜单
  }
}

function buildDates(): DateOption[] {
  const dates: DateOption[] = []
  for (let i = 0; i <= 7; i++) {
    const date = new Date()
    date.setDate(date.getDate() + i)
    let label = ''
    if (i === 0) {
      label = '今天'
    } else if (i === 1) {
      label = '明天'
    } else if (i === 2) {
      label = '后天'
    } else {
      label = `${date.getMonth() + 1}月${date.getDate()}日`
    }
    dates.push({ value: dateInputString(date), label })
  }
  return dates
}

Page({
  data: {
    dates: [] as DateOption[],
    selectedDate: '',
    meals: MEALS,
    meal: 'lunch' as MealId,
    dishes: [] as any[],
    selectedMap: {} as Record<string, boolean>,
    open: true,
    loading: true,
    loadFailed: false,
    saving: false,
    templates: [] as MenuTemplate[]
  },

  onLoad() {
    const dates = buildDates()
    this.setData({
      dates,
      selectedDate: dates[0].value,
      meal: currentMeal()
    })
    this.refreshTemplates()
    this.load()
  },

  _loadSeq: 0,
  _loadedKey: '',

  async load() {
    const seq = ++this._loadSeq
    const date = this.data.selectedDate
    const meal = this.data.meal
    this.setData({ loading: true, loadFailed: false })
    try {
      const [categories, dishes, menu] = await Promise.all([
        getCategories(),
        getDishes(),
        getMenuForDate(date, meal)
      ])
      if (seq !== this._loadSeq) {
        return
      }
      const categoryMap: Record<string, string> = {}
      categories.forEach(category => {
        categoryMap[category.id] = category.name
      })
      const eligible = dishes.filter(
        dish => dish.status !== 'off' && dish.meals.indexOf(meal) > -1
      )
      const selectedMap: Record<string, boolean> = {}
      if (menu.exists) {
        menu.dishIds.forEach(id => {
          selectedMap[id] = true
        })
      } else {
        eligible.forEach(dish => {
          selectedMap[dish.id] = true
        })
      }
      const views = eligible.map(dish => ({
        ...dish,
        categoryName: categoryMap[dish.categoryId] || '',
        checked: Boolean(selectedMap[dish.id])
      }))
      this._loadedKey = date + '_' + meal
      this.setData({
        dishes: views,
        selectedMap,
        open: menu.exists ? menu.open !== false : true,
        loading: false,
        loadFailed: false
      })
    } catch (e: any) {
      if (seq !== this._loadSeq) {
        return
      }
      // 加载失败时不能保留上一次日期/餐次的勾选，否则会把 A 的菜单存进 B
      this._loadedKey = ''
      this.setData({
        loading: false,
        loadFailed: true,
        dishes: [],
        selectedMap: {},
        open: true
      })
      wx.showToast({
        title: String((e && e.message) || '加载失败').slice(0, 40),
        icon: 'none'
      })
    }
  },

  ensureLoaded(): boolean {
    const key = this.data.selectedDate + '_' + this.data.meal
    if (this.data.loadFailed || this._loadedKey !== key) {
      wx.showToast({ title: '菜单还没加载好，点重试', icon: 'none' })
      return false
    }
    return true
  },

  onRetryLoad() {
    this.load()
  },

  onSelectDate(e: any) {
    const value = e.currentTarget.dataset.value
    if (value === this.data.selectedDate) {
      return
    }
    this.setData({ selectedDate: value })
    this.load()
  },

  onSelectMeal(e: any) {
    const meal = e.currentTarget.dataset.meal as MealId
    if (meal === this.data.meal) {
      return
    }
    this.setData({ meal }, () => this.refreshTemplates())
    this.load()
  },

  refreshTemplates() {
    const templates = readTemplates()
      .filter(template => template.meal === this.data.meal)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, MAX_TEMPLATES)
    this.setData({ templates })
  },

  mealLabel(): string {
    const meal = MEALS.find(item => item.id === this.data.meal)
    return meal ? meal.name : '这一餐'
  },

  selectedDishIds(): string[] {
    return this.data.dishes
      .filter(dish => this.data.selectedMap[dish.id])
      .map(dish => dish.id)
  },

  async onSaveTemplate() {
    if (!this.ensureLoaded()) {
      return
    }
    const dishIds = this.selectedDishIds()
    if (!dishIds.length) {
      wx.showToast({ title: '先选几道菜再存模板', icon: 'none' })
      return
    }
    const mealLabel = this.mealLabel()
    const res: any = await wx.showModal({
      title: '存为菜单模板',
      editable: true,
      placeholderText: '给模板起个名字',
      content: `${mealLabel}模板`,
      confirmText: '保存',
      cancelText: '算了'
    })
    if (!res.confirm) {
      return
    }
    const name =
      String(res.content || '')
        .trim()
        .slice(0, 12) || `${mealLabel}模板`
    const all = readTemplates()
    const same = all.find(
      template =>
        template.meal === this.data.meal && template.name === name
    )
    const next = same
      ? all.map(template =>
          template.id === same.id
            ? { ...template, name, dishIds, updatedAt: Date.now() }
            : template
        )
      : all.concat({
          id: `tpl-${Date.now()}`,
          name,
          meal: this.data.meal,
          dishIds,
          updatedAt: Date.now()
        })
    const mine = next
      .filter(template => template.meal === this.data.meal)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, MAX_TEMPLATES)
    const keep = mine.map(template => template.id)
    writeTemplates(
      next.filter(
        template =>
          template.meal !== this.data.meal ||
          keep.indexOf(template.id) > -1
      )
    )
    this.refreshTemplates()
    wx.showToast({
      title: same ? '模板已更新' : '模板已保存',
      icon: 'none'
    })
  },

  async onApplyTemplate() {
    if (!this.ensureLoaded()) {
      return
    }
    const templates = this.data.templates
    if (!templates.length) {
      wx.showToast({ title: '还没有模板，先存一个', icon: 'none' })
      return
    }
    const itemList = templates.map(
      template => `${template.name} · ${template.dishIds.length} 道`
    )
    itemList.push('清空本餐模板')
    const res: any = await wx.showActionSheet({ itemList })
    const index = Number(res.tapIndex)
    if (!(index >= 0)) {
      return
    }
    if (index === templates.length) {
      const confirm: any = await wx.showModal({
        title: '清空本餐模板？',
        content: `会删除${this.mealLabel()}的 ${templates.length} 个菜单模板，已排好的菜单不受影响。`,
        confirmText: '清空',
        cancelText: '算了'
      })
      if (!confirm.confirm) {
        return
      }
      writeTemplates(
        readTemplates().filter(
          template => template.meal !== this.data.meal
        )
      )
      this.refreshTemplates()
      wx.showToast({ title: '模板已清空', icon: 'none' })
      return
    }
    const template = templates[index]
    const available: Record<string, boolean> = {}
    this.data.dishes.forEach(dish => {
      available[dish.id] = true
    })
    const selectedMap: Record<string, boolean> = {}
    let missing = 0
    template.dishIds.forEach(id => {
      if (available[id]) {
        selectedMap[id] = true
      } else {
        missing++
      }
    })
    const dishes = this.data.dishes.map(dish => ({
      ...dish,
      checked: Boolean(selectedMap[dish.id])
    }))
    this.setData({ dishes, selectedMap })
    wx.showToast({
      title: missing
        ? `已套用，${missing} 道暂不可用`
        : '已套用，记得点保存',
      icon: 'none'
    })
  },

  onToggleDish(e: any) {
    const id = e.currentTarget.dataset.id
    const selectedMap = { ...this.data.selectedMap }
    selectedMap[id] = !selectedMap[id]
    const dishes = this.data.dishes.map(dish => ({
      ...dish,
      checked: Boolean(selectedMap[dish.id])
    }))
    this.setData({ selectedMap, dishes })
  },

  onToggleOpen(e: any) {
    this.setData({ open: Boolean(e.detail.value) })
  },

  async onSave() {
    if (this.data.saving || !this.ensureLoaded()) {
      return
    }
    const dishIds = this.data.dishes
      .filter(dish => this.data.selectedMap[dish.id])
      .map(dish => dish.id)
    this.setData({ saving: true })
    try {
      await saveMenu({
        date: this.data.selectedDate,
        meal: this.data.meal,
        dishIds,
        open: this.data.open
      })
      wx.showToast({ title: '菜单已保存', icon: 'none' })
      backAfter(500)
    } catch (e: any) {
      wx.showToast({
        title: String((e && e.message) || '保存失败').slice(0, 40),
        icon: 'none'
      })
    } finally {
      this.setData({ saving: false })
    }
  },

  async onCopyToComing() {
    if (this.data.saving || !this.ensureLoaded()) {
      return
    }
    const dishIds = this.data.dishes
      .filter(dish => this.data.selectedMap[dish.id])
      .map(dish => dish.id)
    if (!dishIds.length) {
      wx.showToast({ title: '先选几道菜再复制', icon: 'none' })
      return
    }
    // 弹窗和 7 次保存之间用户可能切换餐次，先把这次要复制的目标固定下来
    const meal = this.data.meal
    const open = this.data.open
    const mealName =
      meal === 'breakfast' ? '早餐' : meal === 'lunch' ? '午餐' : '晚餐'
    const targets = this.data.dates.slice(1, 8)
    const res: any = await wx.showModal({
      title: '复制到未来 7 天？',
      content: `把这 ${dishIds.length} 道菜复制到未来 7 天（明天起）的${mealName}，会覆盖那几天已有的安排。`,
      confirmText: '复制',
      cancelText: '算了'
    })
    if (!res.confirm) {
      return
    }
    this.setData({ saving: true })
    let done = 0
    try {
      for (const target of targets) {
        await saveMenu({
          date: target.value,
          meal,
          dishIds,
          open
        })
        done++
      }
      wx.showToast({ title: `已复制到 ${done} 天`, icon: 'none' })
      backAfter(600)
    } catch (e: any) {
      wx.showToast({
        title: `第 ${done + 1} 天复制失败：${String(
          (e && e.message) || '请重试'
        ).slice(0, 20)}`,
        icon: 'none'
      })
    } finally {
      this.setData({ saving: false })
    }
  },

  async onReset() {
    if (!this.ensureLoaded()) {
      return
    }
    const res: any = await wx.showModal({
      title: '恢复默认菜单？',
      content: '会删除这一天的菜单，首页恢复显示所有适合这一餐的菜品。',
      confirmText: '恢复',
      cancelText: '算了'
    })
    if (!res.confirm) {
      return
    }
    try {
      await deleteMenu(this.data.selectedDate, this.data.meal)
      wx.showToast({ title: '已恢复默认', icon: 'none' })
      backAfter(500)
    } catch (e: any) {
      wx.showToast({
        title: String((e && e.message) || '操作失败').slice(0, 40),
        icon: 'none'
      })
    }
  }
})
