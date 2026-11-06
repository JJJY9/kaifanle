import type { Business, MealId } from '../../services/types'
import { getBusiness, updateBusiness } from '../../services/api'
import { MEALS } from '../../utils/constants'
import { dateInputString } from '../../utils/format'

interface MealView {
  id: MealId
  name: string
  open: boolean
  deadline: string
}

interface DateView {
  value: string
  label: string
  closed: boolean
}

function buildDateOptions(): DateView[] {
  const options: DateView[] = []
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
      label = `${date.getMonth() + 1}/${date.getDate()}`
    }
    options.push({ value: dateInputString(date), label, closed: false })
  }
  return options
}

Page({
  data: {
    loading: true,
    saving: false,
    mealViews: [] as MealView[],
    closedNote: '',
    notice: '',
    dateOptions: [] as DateView[]
  },

  onLoad() {
    this.load()
  },

  async load() {
    try {
      const business = await getBusiness()
      const mealViews: MealView[] = MEALS.map(meal => ({
        id: meal.id,
        name: meal.name,
        open: business[meal.id].open,
        deadline: business[meal.id].deadline
      }))
      const closedDates = Array.isArray(business.closedDates)
        ? business.closedDates
        : []
      const dateOptions = buildDateOptions().map(option => ({
        ...option,
        closed: closedDates.indexOf(option.value) > -1
      }))
      this.setData({
        mealViews,
        closedNote: business.closedNote,
        notice: business.notice || '',
        dateOptions,
        loading: false
      })
    } catch (e: any) {
      this.setData({ loading: false })
      wx.showToast({
        title: String((e && e.message) || '加载失败').slice(0, 40),
        icon: 'none'
      })
    }
  },

  onToggle(e: any) {
    const index = Number(e.currentTarget.dataset.index)
    const mealViews = this.data.mealViews.slice()
    mealViews[index].open = Boolean(e.detail.value)
    this.setData({ mealViews })
  },

  onToggleAll(e: any) {
    const open = String(e.currentTarget.dataset.open) === 'true'
    const mealViews = this.data.mealViews.map(view => ({ ...view, open }))
    this.setData({ mealViews })
  },

  onDeadline(e: any) {
    const index = Number(e.currentTarget.dataset.index)
    const mealViews = this.data.mealViews.slice()
    mealViews[index].deadline = e.detail.value
    this.setData({ mealViews })
  },

  onNote(e: any) {
    this.setData({ closedNote: e.detail.value })
  },

  onNotice(e: any) {
    this.setData({ notice: e.detail.value })
  },

  onToggleClosedDate(e: any) {
    const value = e.currentTarget.dataset.value
    const dateOptions = this.data.dateOptions.map(option =>
      option.value === value ? { ...option, closed: !option.closed } : option
    )
    this.setData({ dateOptions })
  },

  async onSave() {
    if (this.data.saving) {
      return
    }
    const business: any = {
      closedNote:
        this.data.closedNote.trim().slice(0, 40) || '今天休息，明天见',
      notice: this.data.notice.trim().slice(0, 60),
      closedDates: this.data.dateOptions
        .filter(option => option.closed)
        .map(option => option.value)
    }
    this.data.mealViews.forEach(view => {
      business[view.id] = {
        open: view.open,
        deadline: view.deadline
      }
    })
    this.setData({ saving: true })
    try {
      await updateBusiness(business as Business)
      wx.showToast({ title: '已保存', icon: 'none' })
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
  }
})
