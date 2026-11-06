import type { MealId } from '../../services/types'
import {
  createOrder,
  getBusiness,
  getDishes,
  getKitchenStatus,
  getMenuForDate,
  getMyProfile
} from '../../services/api'
import { cart } from '../../store/cart'
import { MEALS } from '../../utils/constants'
import { currentMeal, dateInputString, dateLabel } from '../../utils/format'
import { dishEmoji } from '../../utils/dish-emoji'
import { TEMPLATE_ORDER_STATUS } from '../../config'

const TIME_OPTIONS: Record<MealId, string[]> = {
  breakfast: ['尽快', '07:30', '08:00', '08:30'],
  lunch: ['尽快', '11:30', '12:00', '12:30'],
  dinner: ['尽快', '17:30', '18:00', '18:30']
}

const MODES = ['在家吃', '送过来', '自取']
const NOTE_PRESETS = ['少放辣', '多加点饭', '不要香菜', '早点送']

function buildLines(meal?: MealId, date?: string): any[] {
  return cart
    .getLines()
    .filter(
      line =>
        (!meal || line.meal === meal) && (!date || line.date === date)
    )
    .map(line => ({
      ...line,
      char: dishEmoji(line.name),
      specText: line.specs.join(' / '),
      lineTotal: line.price * line.qty
    }))
}

function totalOf(lines: any[]): number {
  return lines.reduce((sum, line) => sum + line.lineTotal, 0)
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
    notePresets: NOTE_PRESETS,
    address: '',
    scheduledDate: '',
    todayDate: '',
    maxDate: '',
    dateDisplay: '今天',
    closed: false,
    closedText: '',
    slotChecking: false,
    slotInvalidCount: 0,
    slotError: '',
    kitchenHint: '',
    submitting: false
  },

  _closedSeq: 0,
  _slotSeq: 0,
  _slotInvalid: {} as Record<string, string>,
  _requestId: '',

  newRequestId() {
    this._requestId =
      'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
  },

  onLoad(options: any) {
    if (!cart.getLines().length) {
      wx.navigateBack({ delta: 1 })
      return
    }
    const meal = (options.meal || currentMeal()) as MealId
    const todayDate = dateInputString()
    const max = new Date()
    max.setDate(max.getDate() + 7)
    const maxDate = dateInputString(max)
    const requestedDate = String(options.date || '')
    const scheduledDate =
      requestedDate && requestedDate >= todayDate && requestedDate <= maxDate
        ? requestedDate
        : todayDate
    const lines = buildLines(meal, scheduledDate)
    this.setData({
      lines,
      total: totalOf(lines),
      meal,
      timeOptions: TIME_OPTIONS[meal] || TIME_OPTIONS.lunch,
      scheduledDate,
      todayDate,
      maxDate,
      dateDisplay: dateLabel(scheduledDate, todayDate)
    })
    this.checkClosed(meal)
    this.checkSlot(meal, scheduledDate)
    this.loadKitchenHint()
    this.loadProfile()
    this.newRequestId()
  },

  async loadKitchenHint() {
    if (this.data.scheduledDate !== this.data.todayDate) {
      this.setData({ kitchenHint: '' })
      return
    }
    try {
      const status = await getKitchenStatus()
      if (this.data.scheduledDate !== this.data.todayDate) {
        return
      }
      const ahead = Math.max(0, Number(status.active || 0))
      const items = (this.data.lines || []).reduce(
        (sum, line) => sum + Number(line.qty || 0),
        0
      )
      this.setData({
        kitchenHint:
          ahead > 0
            ? `厨房前面还有 ${ahead} 单，预计 ${Math.max(
                10,
                10 + ahead * 8 + items * 2
              )} 分钟左右出锅`
            : '厨房现在空闲，下单后马上开火'
      })
    } catch (e) {
      this.setData({ kitchenHint: '' })
    }
  },

  applySlot(meal: MealId, date: string): any[] {
    return buildLines(meal, date).map(line => ({
      ...line,
      invalid: Boolean(this._slotInvalid[line.key]),
      invalidText: this._slotInvalid[line.key] || ''
    }))
  },

  async checkSlot(meal: MealId, date: string) {
    const seq = ++this._slotSeq
    let lines = buildLines(meal, date)
    if (!lines.length) {
      this._slotInvalid = {}
      this.setData({
        lines: [],
        total: 0,
        slotChecking: false,
        slotInvalidCount: 0,
        slotError: ''
      })
      return
    }
    this.setData({ slotChecking: true })
    try {
      const [dishes, menu] = await Promise.all([
        getDishes(),
        getMenuForDate(date, meal)
      ])
      if (
        seq !== this._slotSeq ||
        meal !== this.data.meal ||
        date !== this.data.scheduledDate
      ) {
        return
      }
      const dishMap: Record<string, any> = {}
      dishes.forEach(dish => {
        dishMap[dish.id] = dish
      })
      // 菜品改价后同步购物车单价，避免结算显示价和服务端实收不一致
      lines.forEach(line => {
        const dish = dishMap[line.dishId]
        if (!dish) {
          return
        }
        const addonSum = (dish.addons || [])
          .filter((addon: any) => line.specs.indexOf(addon.name) > -1)
          .reduce((sum: number, addon: any) => sum + Number(addon.price || 0), 0)
        cart.updatePrice(line.key, dish.price + addonSum)
      })
      lines = buildLines(meal, date)
      const paused = Boolean(menu.exists && menu.open === false)
      const invalid: Record<string, string> = {}
      lines.forEach(line => {
        const dish = dishMap[line.dishId]
        let reason = ''
        if (paused) {
          reason = '这一餐暂停接单'
        } else if (!dish || dish.status === 'off') {
          reason = '这道菜已经下架'
        } else if (dish.status === 'soldout' || dish.stock === 0) {
          reason = '这一餐卖完了'
        } else if (
          !Array.isArray(dish.meals) ||
          dish.meals.indexOf(meal) === -1
        ) {
          reason = '这一餐不供应'
        } else if (menu.exists && menu.dishIds.indexOf(line.dishId) === -1) {
          reason = '不在这一餐的菜单里'
        }
        if (reason) {
          invalid[line.key] = reason
        }
      })
      this._slotInvalid = invalid
      const decorated = this.applySlot(meal, date)
      this.setData({
        lines: decorated,
        total: totalOf(decorated),
        slotChecking: false,
        slotInvalidCount: decorated.filter(line => line.invalid).length,
        slotError: paused ? '这一餐还没开火，换一餐试试' : ''
      })
    } catch (e) {
      if (
        seq !== this._slotSeq ||
        meal !== this.data.meal ||
        date !== this.data.scheduledDate
      ) {
        return
      }
      // 校验失败不拦下单，服务端会做最终校验
      this._slotInvalid = {}
      const decorated = this.applySlot(meal, date)
      this.setData({
        lines: decorated,
        total: totalOf(decorated),
        slotChecking: false,
        slotInvalidCount: 0,
        slotError: ''
      })
    }
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
      const isClosedDate =
        Array.isArray(business.closedDates) &&
        business.closedDates.indexOf(this.data.scheduledDate) > -1
      const weekday = new Date(
        this.data.scheduledDate + 'T00:00:00'
      ).getDay()
      const isWeeklyClosed =
        Array.isArray(business.weeklyClosed) &&
        business.weeklyClosed.indexOf(weekday) > -1
      const closed =
        !setting.open || pastDeadline || isClosedDate || isWeeklyClosed
      this.setData({
        closed,
        closedText: closed
          ? isClosedDate
            ? '这一天休息，换个日子吧'
            : isWeeklyClosed
            ? '这一天固定休息，换个日子吧'
            : !setting.open
            ? business.closedNote || '今天休息，明天见'
            : '这一餐已经截单啦，下次早点来'
          : ''
      })
    } catch (e) {
      // 营业信息获取失败时由服务端兜底校验
    }
  },

  onMealChange(e: any) {
    if (this.data.submitting) {
      return
    }
    const meal = e.currentTarget.dataset.meal as MealId
    if (meal === this.data.meal) {
      return
    }
    this._slotInvalid = {}
    const lines = buildLines(meal, this.data.scheduledDate)
    this.newRequestId()
    this.setData(
      {
        meal,
        timeOptions: TIME_OPTIONS[meal],
        timeIndex: 0,
        lines,
        total: totalOf(lines),
        slotInvalidCount: 0,
        slotError: ''
      },
      () => {
        this.checkClosed(meal)
        this.checkSlot(meal, this.data.scheduledDate)
        this.loadKitchenHint()
      }
    )
  },

  onTimeSelect(e: any) {
    this.setData({ timeIndex: Number(e.currentTarget.dataset.index) })
  },

  onModeSelect(e: any) {
    this.setData({ modeIndex: Number(e.currentTarget.dataset.index) })
  },

  onDateChange(e: any) {
    if (this.data.submitting) {
      return
    }
    const date = e.detail.value
    this.newRequestId()
    this._slotInvalid = {}
    const lines = buildLines(this.data.meal, date)
    this.setData(
      {
        scheduledDate: date,
        dateDisplay: dateLabel(date, this.data.todayDate),
        lines,
        total: totalOf(lines),
        slotInvalidCount: 0,
        slotError: ''
      },
      () => {
        this.checkClosed(this.data.meal)
        this.checkSlot(this.data.meal, date)
      }
    )
  },

  onNote(e: any) {
    this.setData({ note: e.detail.value })
  },

  onNotePreset(e: any) {
    const phrase = String(e.currentTarget.dataset.phrase || '')
    const note = this.data.note.trim()
    if (!phrase || note.indexOf(phrase) > -1) {
      return
    }
    const next = (note ? note + '，' + phrase : phrase).slice(0, 100)
    this.setData({ note: next })
  },

  onAddress(e: any) {
    this.setData({ address: e.detail.value })
  },

  onRemove(e: any) {
    if (this.data.submitting) {
      return
    }
    this.newRequestId()
    const key = e.currentTarget.dataset.key
    cart.remove(key)
    if (!cart.getLines().length) {
      wx.navigateBack({ delta: 1 })
      return
    }
    const lines = this.applySlot(this.data.meal, this.data.scheduledDate)
    this.setData({
      lines,
      total: totalOf(lines),
      slotInvalidCount: lines.filter(line => line.invalid).length
    })
  },

  onChangeQty(e: any) {
    if (this.data.submitting) {
      return
    }
    this.newRequestId()
    const key = e.currentTarget.dataset.key
    const delta = Number(e.currentTarget.dataset.delta)
    cart.changeQty(key, delta)
    if (!cart.getLines().length) {
      wx.navigateBack({ delta: 1 })
      return
    }
    const lines = this.applySlot(this.data.meal, this.data.scheduledDate)
    this.setData({
      lines,
      total: totalOf(lines),
      slotInvalidCount: lines.filter(line => line.invalid).length
    })
  },

  async onClearCart() {
    if (this.data.submitting) {
      return
    }
    const res: any = await wx.showModal({
      title: '清空这一餐？',
      content: '这一餐已选的菜品都会被移除，其他餐次不受影响。',
      confirmText: '清空',
      cancelText: '算了'
    })
    if (!res.confirm) {
      return
    }
    cart.clearSlot(this.data.meal, this.data.scheduledDate)
    wx.navigateBack({ delta: 1 })
  },

  async onSubmit() {
    if (this.data.submitting || !this.data.lines.length) {
      return
    }
    if (this.data.slotChecking) {
      wx.showToast({ title: '正在确认这一餐的供应', icon: 'none' })
      return
    }
    if (this.data.slotInvalidCount) {
      wx.showToast({ title: '先把不供应的菜移掉', icon: 'none' })
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
    // 提交期间用户仍可能点餐次/日期，先把这次要下的单固定下来
    const meal = this.data.meal
    const lines = this.data.lines
    const total = this.data.total
    const scheduledDate = this.data.scheduledDate
    const expectedTime = this.data.timeOptions[this.data.timeIndex]
    const note = this.data.note.trim()
    const address = this.data.address.trim()
    const requestId = this._requestId
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
        items: lines.map((line: any) => ({
          dishId: line.dishId,
          name: line.name,
          price: line.price,
          qty: line.qty,
          specs: line.specs,
          note: line.note
        })),
        amount: total,
        meal,
        expectedTime,
        mode,
        note,
        address,
        scheduledDate,
        requestId
      })
      cart.clearSlot(meal, scheduledDate)
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
