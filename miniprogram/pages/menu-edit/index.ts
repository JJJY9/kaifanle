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

interface DateOption {
  value: string
  label: string
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
    saving: false
  },

  onLoad() {
    const dates = buildDates()
    this.setData({
      dates,
      selectedDate: dates[0].value,
      meal: currentMeal()
    })
    this.load()
  },

  _loadSeq: 0,

  async load() {
    const seq = ++this._loadSeq
    this.setData({ loading: true })
    try {
      const [categories, dishes, menu] = await Promise.all([
        getCategories(),
        getDishes(),
        getMenuForDate(this.data.selectedDate, this.data.meal)
      ])
      if (seq !== this._loadSeq) {
        return
      }
      const categoryMap: Record<string, string> = {}
      categories.forEach(category => {
        categoryMap[category.id] = category.name
      })
      const eligible = dishes.filter(
        dish =>
          dish.status !== 'off' && dish.meals.indexOf(this.data.meal) > -1
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
      this.setData({
        dishes: views,
        selectedMap,
        open: menu.exists ? menu.open !== false : true,
        loading: false
      })
    } catch (e: any) {
      if (seq !== this._loadSeq) {
        return
      }
      this.setData({ loading: false })
      wx.showToast({
        title: String((e && e.message) || '加载失败').slice(0, 40),
        icon: 'none'
      })
    }
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
    this.setData({ meal })
    this.load()
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
    if (this.data.saving) {
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
      setTimeout(() => {
        wx.navigateBack({ delta: 1 })
      }, 500)
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
    if (this.data.saving) {
      return
    }
    const dishIds = this.data.dishes
      .filter(dish => this.data.selectedMap[dish.id])
      .map(dish => dish.id)
    if (!dishIds.length) {
      wx.showToast({ title: '先选几道菜再复制', icon: 'none' })
      return
    }
    const res: any = await wx.showModal({
      title: '复制到未来 7 天？',
      content: `把这 ${dishIds.length} 道菜复制到今天起 8 天的${this.data.meal === 'breakfast' ? '早餐' : this.data.meal === 'lunch' ? '午餐' : '晚餐'}，会覆盖那几天已有的安排。`,
      confirmText: '复制',
      cancelText: '算了'
    })
    if (!res.confirm) {
      return
    }
    const targets = this.data.dates.slice(0, 8)
    this.setData({ saving: true })
    let done = 0
    try {
      for (const target of targets) {
        await saveMenu({
          date: target.value,
          meal: this.data.meal,
          dishIds,
          open: this.data.open
        })
        done++
      }
      wx.showToast({ title: `已复制到 ${done} 天`, icon: 'none' })
      setTimeout(() => {
        wx.navigateBack({ delta: 1 })
      }, 600)
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
      setTimeout(() => {
        wx.navigateBack({ delta: 1 })
      }, 500)
    } catch (e: any) {
      wx.showToast({
        title: String((e && e.message) || '操作失败').slice(0, 40),
        icon: 'none'
      })
    }
  }
})
