import type { MealId } from '../../services/types'
import { createOrder, getBusiness, getMyProfile } from '../../services/api'
import { cart } from '../../store/cart'
import { MEALS } from '../../utils/constants'
import { currentMeal, dateInputString, dateLabel } from '../../utils/format'
import { TEMPLATE_ORDER_STATUS } from '../../config'

const TIME_OPTIONS: Record<MealId, string[]> = {
  breakfast: ['尽快', '07:30', '08:00', '08:30'],
  lunch: ['尽快', '11:30', '12:00', '12:30'],
  dinner: ['尽快', '17:30', '18:00', '18:30']
}

const MODES = ['在家吃', '送过来', '自取']

function buildLines(): any[] {
  return cart.getLines().map(line => ({
    ...line,
    char: line.name.slice(0, 1),
    specText: line.specs.join(' / '),
    lineTotal: line.price * line.qty
  }))
}

Page({
  data: {
    lines: [] as any[],
    total: 0,
    meal: 'lunch' as MealId,
    meals: MEALS,
    timeOptions: TIME_OPTIONS.lunch,
    timeIndex: 0,
    modes: MODES,
    modeIndex: 0,
    note: '',
    address: '',
    scheduledDate: '',
    todayDate: '',
    maxDate: '',
    dateDisplay: '今天',
    closed: false,
    closedText: '',
    submitting: false
  },

  _closedSeq: 0,

  onLoad(options: any) {
    const lines = buildLines()
    if (!lines.length) {
      wx.navigateBack({ delta: 1 })
      return
    }
    const meal = (options.meal || currentMeal()) as MealId
    const todayDate = dateInputString()
    const max = new Date()
    max.setDate(max.getDate() + 7)
    this.setData({
      lines,
      total: cart.getTotal(),
      meal,
      timeOptions: TIME_OPTIONS[meal] || TIME_OPTIONS.lunch,
      scheduledDate: todayDate,
      todayDate,
      maxDate: dateInputString(max),
      dateDisplay: '今天'
    })
    this.checkClosed(meal)
    this.loadProfile()
  },

  async loadProfile() {
    try {
      const profile = await getMyProfile()
      if (profile.address) {
        this.setData({ address: profile.address })
      }
    } catch (e) {
      // 没有档案时手填即可
    }
  },

  async checkClosed(meal: MealId) {
    const seq = ++this._closedSeq
    try {
      const business = await getBusiness()
      if (seq !== this._closedSeq || meal !== this.data.meal) {
        return
      }
      const setting = business[meal]
      if (!setting) {
        this.setData({ closed: false, closedText: '' })
        return
      }
      const now = new Date()
      const nowMinutes = now.getHours() * 60 + now.getMinutes()
      const [deadlineHour, deadlineMinute] = setting.deadline
        .split(':')
        .map(Number)
      const isToday = this.data.scheduledDate === this.data.todayDate
      const pastDeadline =
        isToday && nowMinutes > deadlineHour * 60 + deadlineMinute
      const closed = !setting.open || pastDeadline
      this.setData({
        closed,
        closedText: closed
          ? !setting.open
            ? business.closedNote || '今天休息，明天见'
            : '这一餐已经截单啦，下次早点来'
          : ''
      })
    } catch (e) {
      // 营业信息获取失败时由服务端兜底校验
    }
  },

  onMealChange(e: any) {
    const meal = e.currentTarget.dataset.meal as MealId
    this.setData({
      meal,
      timeOptions: TIME_OPTIONS[meal],
      timeIndex: 0
    })
    this.checkClosed(meal)
  },

  onTimeSelect(e: any) {
    this.setData({ timeIndex: Number(e.currentTarget.dataset.index) })
  },

  onModeSelect(e: any) {
    this.setData({ modeIndex: Number(e.currentTarget.dataset.index) })
  },

  onDateChange(e: any) {
    const date = e.detail.value
    this.setData({
      scheduledDate: date,
      dateDisplay: dateLabel(date, this.data.todayDate)
    })
    this.checkClosed(this.data.meal)
  },

  onNote(e: any) {
    this.setData({ note: e.detail.value })
  },

  onAddress(e: any) {
    this.setData({ address: e.detail.value })
  },

  onRemove(e: any) {
    const key = e.currentTarget.dataset.key
    cart.remove(key)
    const lines = buildLines()
    if (!lines.length) {
      wx.navigateBack({ delta: 1 })
      return
    }
    this.setData({ lines, total: cart.getTotal() })
  },

  onChangeQty(e: any) {
    const key = e.currentTarget.dataset.key
    const delta = Number(e.currentTarget.dataset.delta)
    cart.changeQty(key, delta)
    const lines = buildLines()
    if (!lines.length) {
      wx.navigateBack({ delta: 1 })
      return
    }
    this.setData({ lines, total: cart.getTotal() })
  },

  async onClearCart() {
    const res: any = await wx.showModal({
      title: '清空购物车？',
      content: '所有已选菜品都会被移除。',
      confirmText: '清空',
      cancelText: '算了'
    })
    if (!res.confirm) {
      return
    }
    cart.clear()
    wx.navigateBack({ delta: 1 })
  },

  async onSubmit() {
    if (this.data.submitting || !this.data.lines.length) {
      return
    }
    if (this.data.closed) {
      wx.showToast({
        title: this.data.closedText || '这一餐休息中',
        icon: 'none'
      })
      return
    }
    const mode = MODES[this.data.modeIndex]
    if (mode === '送过来' && !this.data.address.trim()) {
      wx.showToast({ title: '写一下送到哪里', icon: 'none' })
      return
    }
    this.setData({ submitting: true })

    // 一次性订阅：授权后，出锅时会给顾客发一条提醒。
    // 必须紧贴用户点击调用；拒绝授权也继续下单。
    if (TEMPLATE_ORDER_STATUS) {
      try {
        await wx.requestSubscribeMessage({
          tmplIds: [TEMPLATE_ORDER_STATUS]
        })
      } catch (e) {
        // 用户拒绝或当前环境不支持订阅，忽略即可
      }
    }

    try {
      const order = await createOrder({
        items: this.data.lines.map((line: any) => ({
          dishId: line.dishId,
          name: line.name,
          price: line.price,
          qty: line.qty,
          specs: line.specs,
          note: line.note
        })),
        amount: this.data.total,
        meal: this.data.meal,
        expectedTime: this.data.timeOptions[this.data.timeIndex],
        mode,
        note: this.data.note.trim(),
        address: this.data.address.trim(),
        scheduledDate: this.data.scheduledDate
      })
      cart.clear()
      wx.redirectTo({ url: `/pages/order-detail/index?id=${order.id}` })
    } catch (e: any) {
      const message =
        (e && (e.message || e.errMsg)) || '下单失败，再试一次'
      wx.showToast({
        title: String(message).slice(0, 40),
        icon: 'none'
      })
      this.setData({ submitting: false })
    }
  }
})
