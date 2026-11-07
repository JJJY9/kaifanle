import type { Business, MealId } from '../../services/types'
import { getBusiness, updateBusiness } from '../../services/api'
import { MEALS } from '../../utils/constants'
import { dateInputString } from '../../utils/format'
import { backAfter } from '../../utils/nav'

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

interface WeekdayView {
  value: number
  name: string
  closed: boolean
}

const WEEKDAYS: WeekdayView[] = [
  { value: 1, name: '周一', closed: false },
  { value: 2, name: '周二', closed: false },
  { value: 3, name: '周三', closed: false },
  { value: 4, name: '周四', closed: false },
  { value: 5, name: '周五', closed: false },
  { value: 6, name: '周六', closed: false },
  { value: 0, name: '周日', closed: false }
]

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
    loadFailed: false,
    saving: false,
    mealViews: [] as MealView[],
    closedNote: '',
    notice: '',
    noticeFrom: '',
    noticeUntil: '',
    recommendText: '',
    lowStockThreshold: '3',
    dailyGoal: '0',
    dateOptions: [] as DateView[],
    weekdays: [] as WeekdayView[]
  },

  _loaded: false,

  onLoad() {
    this.load()
  },

  async load() {
    this.setData({ loading: true, loadFailed: false })
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
      const weeklyClosed = Array.isArray(business.weeklyClosed)
        ? business.weeklyClosed
        : []
      const weekdays = WEEKDAYS.map(day => ({
        ...day,
        closed: weeklyClosed.indexOf(day.value) > -1
      }))
      this._loaded = true
      this.setData({
        mealViews,
        closedNote: business.closedNote,
        notice: business.notice || '',
        noticeFrom: business.noticeFrom || '',
        noticeUntil: business.noticeUntil || '',
        recommendText: business.recommendText || '',
        lowStockThreshold: String(
          typeof business.lowStockThreshold === 'number'
            ? business.lowStockThreshold
            : 3
        ),
        dailyGoal: String(
          typeof business.dailyGoal === 'number' ? business.dailyGoal : 0
        ),
        dateOptions,
        weekdays,
        loading: false,
        loadFailed: false
      })
    } catch (e: any) {
      this._loaded = false
      this.setData({ loading: false, loadFailed: true })
      wx.showToast({
        title: String((e && e.message) || '加载失败').slice(0, 40),
        icon: 'none'
      })
    }
  },

  onRetryLoad() {
    this.load()
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

  onNoticeUntil(e: any) {
    this.setData({ noticeUntil: e.detail.value })
  },

  onClearNoticeUntil() {
    this.setData({ noticeUntil: '' })
  },

  onNoticeFrom(e: any) {
    this.setData({ noticeFrom: e.detail.value })
  },

  onClearNoticeFrom() {
    this.setData({ noticeFrom: '' })
  },

  onRecommendText(e: any) {
    this.setData({ recommendText: e.detail.value })
  },

  onLowStockThreshold(e: any) {
    this.setData({ lowStockThreshold: e.detail.value })
  },

  onDailyGoal(e: any) {
    this.setData({ dailyGoal: e.detail.value })
  },

  onToggleClosedDate(e: any) {
    const value = e.currentTarget.dataset.value
    const dateOptions = this.data.dateOptions.map(option =>
      option.value === value ? { ...option, closed: !option.closed } : option
    )
    this.setData({ dateOptions })
  },

  onToggleWeekday(e: any) {
    const value = Number(e.currentTarget.dataset.value)
    const weekdays = this.data.weekdays.map(day =>
      day.value === value ? { ...day, closed: !day.closed } : day
    )
    this.setData({ weekdays })
  },

  async onSave() {
    if (this.data.saving) {
      return
    }
    if (!this._loaded) {
      wx.showToast({ title: '设置还没加载好，点重试', icon: 'none' })
      return
    }
    const noticeFrom = /^\d{4}-\d{2}-\d{2}$/.test(this.data.noticeFrom)
      ? this.data.noticeFrom
      : ''
    const noticeUntil = /^\d{4}-\d{2}-\d{2}$/.test(this.data.noticeUntil)
      ? this.data.noticeUntil
      : ''
    if (noticeFrom && noticeUntil && noticeFrom > noticeUntil) {
      wx.showToast({ title: '公告开始日期不能晚于截止日期', icon: 'none' })
      return
    }
    const business: any = {
      closedNote:
        this.data.closedNote.trim().slice(0, 40) || '今天休息，明天见',
      notice: this.data.notice.trim().slice(0, 60),
      noticeFrom,
      noticeUntil,
      recommendText:
        this.data.recommendText.trim().slice(0, 12) || '今日推荐',
      lowStockThreshold: (() => {
        const raw = String(this.data.lowStockThreshold || '').trim()
        const value = Number(raw)
        return raw && isFinite(value) && value >= 0 && value <= 99
          ? Math.floor(value)
          : 3
      })(),
      dailyGoal: (() => {
        const raw = String(this.data.dailyGoal || '').trim()
        const value = Number(raw)
        return raw && isFinite(value) && value >= 0 && value <= 99999
          ? Math.floor(value)
          : 0
      })(),
      closedDates: this.data.dateOptions
        .filter(option => option.closed)
        .map(option => option.value),
      weeklyClosed: this.data.weekdays
        .filter(day => day.closed)
        .map(day => day.value)
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
      backAfter(500)
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
