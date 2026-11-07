import type {
  Business,
  DailyMenu,
  Dish,
  MealId,
  WeekMenus
} from '../../services/types'
import { getBusiness, getDishes, getMe, getOrders, getWeekMenus } from '../../services/api'
import { MEALS } from '../../utils/constants'
import { dateInputString, dateLabel } from '../../utils/format'

interface DishChip {
  id: string
  name: string
  icon: string
  soldout: boolean
}

type MealState =
  | 'ready'
  | 'empty'
  | 'zero'
  | 'unavailable'
  | 'unopened'
  | 'off'
  | 'cutoff'

interface MealRow {
  id: MealId
  name: string
  state: MealState
  stateText: string
  hint: string
  isNow: boolean
  bookable: boolean
  booked: boolean
  dishes: DishChip[]
  moreCount: number
}

interface DayRow {
  date: string
  weekText: string
  monthText: string
  dayNum: string
  relativeTag: string
  isToday: boolean
  closed: boolean
  closedNote: string
  meals: MealRow[]
}

const WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
const MAX_CHIPS = 4
const MEAL_NAME: Record<MealId, string> = {
  breakfast: '早餐',
  lunch: '午餐',
  dinner: '晚餐'
}

function beijingMinutes(): number {
  const d = new Date(Date.now() + 8 * 60 * 60 * 1000)
  return d.getUTCHours() * 60 + d.getUTCMinutes()
}

function pastDeadline(deadline: string): boolean {
  const parts = String(deadline || '').split(':')
  const hour = Number(parts[0])
  const minute = Number(parts[1])
  if (!isFinite(hour) || !isFinite(minute)) {
    return false
  }
  return beijingMinutes() > hour * 60 + minute
}

function beijingMeal(): MealId {
  const minutes = beijingMinutes()
  if (minutes < 10 * 60) {
    return 'breakfast'
  }
  if (minutes < 15 * 60) {
    return 'lunch'
  }
  return 'dinner'
}

function monthDayText(date: string): string {
  const parts = String(date || '').split('-')
  if (parts.length !== 3) {
    return date
  }
  return `${Number(parts[1])}月${Number(parts[2])}日`
}

function buildMeal(
  menu: DailyMenu | undefined,
  meal: MealId,
  dishMap: Record<string, Dish>,
  dishList: Dish[],
  setting: any,
  isToday: boolean,
  nowMeal: MealId,
  isAdmin: boolean,
  date: string,
  bookedKeys: Record<string, boolean>
): MealRow {
  const exists = Boolean(menu && menu.exists)
  const dishIds = exists && Array.isArray(menu!.dishIds) ? menu!.dishIds : []
  const picked = dishIds
    .map(id => dishMap[id])
    .filter(dish => Boolean(dish) && dish.status !== 'off') as Dish[]
  const missing = dishIds.length - picked.length
  const eligibleCount = dishList.filter(
    dish => dish.status !== 'off' && dish.meals.indexOf(meal) > -1
  ).length

  let state: MealState = 'ready'
  let stateText = `${picked.length} 道`
  let hint = missing ? `${missing} 道暂不可用` : ''

  if (setting && setting.open === false) {
    state = 'off'
    stateText = '休息'
    hint = '这一餐不开火'
  } else if (!exists) {
    state = 'empty'
    stateText = '未排菜单'
    hint = eligibleCount ? `默认 ${eligibleCount} 道可选` : '暂无菜品'
  } else if (menu!.open === false) {
    state = 'unopened'
    stateText = '暂停接单'
    hint = '这一餐还没开火'
  } else if (isToday && setting && pastDeadline(setting.deadline)) {
    state = 'cutoff'
    stateText = '已截单'
    hint = '下次早点来'
  } else if (!picked.length) {
    state = missing ? 'unavailable' : 'zero'
    stateText = missing ? '暂不可用' : '0 道菜'
    hint = missing
      ? `${missing} 道菜已下架`
      : isAdmin
      ? '去排菜单看看'
      : '这一餐还没安排'
  }

  const showDishes =
    state === 'ready' || state === 'unopened' || state === 'cutoff'
  const chips = showDishes
    ? picked.map(dish => ({
        id: dish.id,
        name: dish.name,
        icon: dish.emoji || dish.char || '🍽',
        soldout:
          isToday && (dish.status === 'soldout' || dish.stock === 0)
      }))
    : []

  return {
    id: meal,
    name: MEAL_NAME[meal],
    state,
    stateText,
    hint,
    isNow: isToday && state === 'ready' && meal === nowMeal,
    bookable: state === 'ready',
    booked: Boolean(bookedKeys[`${date}::${meal}`]),
    dishes: chips.slice(0, MAX_CHIPS),
    moreCount: Math.max(0, chips.length - MAX_CHIPS)
  }
}

function buildDays(
  week: WeekMenus,
  dishes: Dish[],
  business: Business | null,
  nowMeal: MealId,
  isAdmin: boolean,
  bookedKeys: Record<string, boolean>
): DayRow[] {
  const dishMap: Record<string, Dish> = {}
  dishes.forEach(dish => {
    dishMap[dish.id] = dish
  })
  const closedDates = (business && business.closedDates) || []
  const weeklyClosed = (business && business.weeklyClosed) || []
  return week.days.map(day => {
    const closed =
      closedDates.indexOf(day.date) > -1 ||
      (day.weekday >= 0 && day.weekday <= 6
        ? weeklyClosed.indexOf(day.weekday) > -1
        : false)
    const isToday = day.date === week.startDate
    const relative = dateLabel(day.date, week.startDate)
    const meals = closed
      ? []
      : MEALS.map(item =>
          buildMeal(
            day.menus.find(menu => menu.meal === item.id),
            item.id,
            dishMap,
            dishes,
            business ? (business as any)[item.id] : null,
            isToday,
            nowMeal,
            isAdmin,
            day.date,
            bookedKeys
          )
        )
    return {
      date: day.date,
      weekText:
        day.weekday >= 0 && day.weekday <= 6 ? WEEK[day.weekday] : '',
      monthText: `${Number(day.date.slice(5, 7))}月`,
      dayNum: String(Number(day.date.slice(8, 10))),
      relativeTag: relative === '明天' || relative === '后天' ? relative : '',
      isToday,
      closed,
      closedNote: (business && business.closedNote) || '今天休息，明天见',
      meals
    }
  })
}

Page({
  data: {
    loading: true,
    error: '',
    days: [] as DayRow[],
    rangeText: '',
    isAdmin: false,
    showEmpty: false,
    emptyTitle: '',
    emptyDesc: '',
    emptyAction: '',
    emptyKind: '' as '' | 'menu' | 'business' | 'home',
    posterMaking: false,
    posterPath: ''
  },

  _loadSeq: 0,

  onShow() {
    this.load()
  },

  onPullDownRefresh() {
    this.load().then(() => wx.stopPullDownRefresh())
  },

  async load() {
    const seq = ++this._loadSeq
    if (!this.data.days.length) {
      this.setData({ loading: true })
    }
    this.setData({ error: '' })
    try {
      const [week, dishes, business, me, orders] = await Promise.all([
        getWeekMenus(),
        getDishes(),
        getBusiness().catch(() => null),
        getMe().catch(() => null),
        getOrders().catch(() => [])
      ])
      if (seq !== this._loadSeq) {
        return
      }
      const isAdmin = Boolean(me && me.isAdmin)
      const bookedKeys: Record<string, boolean> = {}
      ;(orders || []).forEach(order => {
        if (order.status === 'cancelled') {
          return
        }
        const date =
          order.scheduledDate ||
          dateInputString(new Date(order.createdAt))
        bookedKeys[`${date}::${order.meal}`] = true
      })
      const days = buildDays(
        week,
        dishes,
        business,
        beijingMeal(),
        isAdmin,
        bookedKeys
      )
      const allClosed = days.length > 0 && days.every(day => day.closed)
      const allRest =
        days.length > 0 &&
        days.every(
          day => day.closed || day.meals.every(meal => meal.state === 'off')
        )
      const anyMenu = week.days.some(day =>
        day.menus.some(menu => menu.exists)
      )
      const showEmpty = !days.length || allClosed || allRest || !anyMenu
      let emptyTitle = ''
      let emptyDesc = ''
      let emptyAction = ''
      let emptyKind: '' | 'menu' | 'business' | 'home' = ''
      if (showEmpty) {
        if (allClosed || allRest) {
          emptyTitle = '这一周都在休息'
          emptyDesc =
            (business && business.closedNote) || '掌勺人给自己放个假'
          if (isAdmin) {
            emptyAction = '去营业设置'
            emptyKind = 'business'
          }
        } else if (!days.length) {
          emptyTitle = '饭表暂时是空的'
          emptyDesc = '下拉刷新看看'
        } else {
          emptyTitle = '这一周还没排菜单'
          emptyDesc = isAdmin
            ? '排好菜单，她就能提前看到这周吃什么'
            : '等掌勺人排好，就知道这周吃什么啦'
          emptyAction = isAdmin ? '去排菜单' : '去点餐'
          emptyKind = isAdmin ? 'menu' : 'home'
        }
      }
      const rangeText =
        week.startDate.slice(0, 4) === week.endDate.slice(0, 4)
          ? `${monthDayText(week.startDate)} - ${monthDayText(week.endDate)}`
          : `${week.startDate} - ${week.endDate}`
      this.setData({
        loading: false,
        days,
        rangeText,
        isAdmin,
        showEmpty,
        emptyTitle,
        emptyDesc,
        emptyAction,
        emptyKind,
        posterPath: ''
      })
    } catch (e: any) {
      if (seq !== this._loadSeq) {
        return
      }
      this.setData({ loading: false })
      if (this.data.days.length) {
        wx.showToast({ title: '刷新失败，稍后再试', icon: 'none' })
      } else {
        this.setData({
          error: String((e && e.message) || '饭表加载失败').slice(0, 60)
        })
      }
    }
  },

  onRetry() {
    this.setData({ loading: true, error: '' })
    this.load()
  },

  onEmptyAction() {
    const kind = this.data.emptyKind
    if (kind === 'menu') {
      wx.navigateTo({ url: '/pages/menu-edit/index' })
    } else if (kind === 'business') {
      wx.navigateTo({ url: '/pages/business/index' })
    } else if (kind === 'home') {
      wx.switchTab({ url: '/pages/home/index' })
    }
  },

  onGoHome() {
    wx.switchTab({ url: '/pages/home/index' })
  },

  onBook(e: any) {
    const meal = e.currentTarget.dataset.meal as MealId
    const date = e.currentTarget.dataset.date
    if (!meal || !date) {
      return
    }
    const app: any = getApp()
    if (app && app.globalData) {
      app.globalData.pendingReorder = { meal, date }
    }
    wx.switchTab({ url: '/pages/home/index' })
  },

  onGoMenu() {
    wx.navigateTo({ url: '/pages/menu-edit/index' })
  },

  async onMakeWeekPoster() {
    if (this.data.posterMaking) {
      return
    }
    this.setData({ posterMaking: true })
    try {
      const canvas: any = await new Promise((resolve, reject) => {
        wx.createSelectorQuery()
          .in(this)
          .select('#weekPoster')
          .fields({ node: true, size: true })
          .exec(res => {
            const node = res && res[0] && res[0].node
            if (node) {
              resolve(node)
            } else {
              reject(new Error('画布还没准备好'))
            }
          })
      })
      const dpr = (wx.getWindowInfo && wx.getWindowInfo().pixelRatio) || 2
      const width = 600
      const height = 1120
      canvas.width = width * dpr
      canvas.height = height * dpr
      const ctx = canvas.getContext('2d')
      ctx.scale(dpr, dpr)

      ctx.fillStyle = '#FFFDF6'
      ctx.fillRect(0, 0, width, height)
      ctx.strokeStyle = '#111111'
      ctx.lineWidth = 8
      ctx.strokeRect(24, 24, width - 48, height - 48)

      ctx.fillStyle = '#2D9CFF'
      ctx.fillRect(24, 24, width - 48, 130)
      ctx.fillStyle = '#FFFFFF'
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      ctx.font = 'bold 40px "PingFang SC", sans-serif'
      ctx.fillText('张饱饭堂 · 本周饭表', 48, 80)
      ctx.font = '24px "PingFang SC", sans-serif'
      ctx.fillText(this.data.rangeText || '', 48, 125)

      const mealText = (meal: MealRow) => {
        if (meal.state === 'ready' && meal.dishes.length) {
          const names = meal.dishes.map(dish => dish.name).join('、')
          return names.length > 18 ? names.slice(0, 18) + '…' : names
        }
        return meal.stateText || meal.hint || '—'
      }
      ;(this.data.days || []).slice(0, 7).forEach((day, index) => {
        const y = 184 + index * 126
        if (day.isToday) {
          ctx.fillStyle = '#FFF4C2'
          ctx.fillRect(40, y, width - 80, 118)
        } else if (index % 2 === 0) {
          ctx.fillStyle = '#F7F4EA'
          ctx.fillRect(40, y, width - 80, 118)
        }
        ctx.strokeStyle = 'rgba(17,17,17,0.15)'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(48, y + 118)
        ctx.lineTo(width - 48, y + 118)
        ctx.stroke()

        ctx.fillStyle = '#111111'
        ctx.font = 'bold 24px "PingFang SC", sans-serif'
        ctx.fillText(
          `${day.weekText} ${day.monthText}${day.dayNum}日${
            day.isToday ? ' · 今天' : ''
          }`,
          48,
          y + 28
        )
        if (day.closed) {
          ctx.fillStyle = '#5C5C5C'
          ctx.font = '22px "PingFang SC", sans-serif'
          ctx.fillText(`休息 · ${day.closedNote || '今天不做饭'}`, 48, y + 72)
          return
        }
        day.meals.forEach((meal, mealIndex) => {
          ctx.fillStyle = '#5C5C5C'
          ctx.font = 'bold 20px "PingFang SC", sans-serif'
          ctx.fillText(`${meal.name}：`, 48, y + 58 + mealIndex * 28)
          ctx.fillStyle = '#111111'
          ctx.font = '20px "PingFang SC", sans-serif'
          ctx.fillText(mealText(meal), 148, y + 58 + mealIndex * 28)
        })
      })

      ctx.fillStyle = '#5C5C5C'
      ctx.font = '22px "PingFang SC", sans-serif'
      ctx.textAlign = 'left'
      ctx.fillText('她点单，你掌勺', 48, height - 52)
      ctx.textAlign = 'right'
      ctx.fillText('开饭咯', width - 48, height - 52)

      const path: string = await new Promise((resolve, reject) => {
        wx.canvasToTempFilePath({
          canvas,
          destWidth: canvas.width,
          destHeight: canvas.height,
          success: res => resolve(res.tempFilePath),
          fail: reject
        } as any)
      })
      this.setData({ posterMaking: false, posterPath: path })
      wx.showToast({ title: '饭表图已生成', icon: 'none' })
    } catch (e: any) {
      this.setData({ posterMaking: false })
      wx.showToast({
        title: String((e && e.message) || '生成失败').slice(0, 40),
        icon: 'none'
      })
    }
  },

  onPreviewWeekPoster() {
    const path = this.data.posterPath
    if (!path) {
      return
    }
    if (typeof (wx as any).showShareImageMenu === 'function') {
      ;(wx as any).showShareImageMenu({
        path,
        fail: () => {
          wx.previewImage({ urls: [path] })
        }
      })
      return
    }
    wx.previewImage({ urls: [path] })
  },

  onShareAppMessage() {
    return {
      title: '这周吃什么？开饭咯',
      path: '/pages/week-menus/index'
    }
  },

  onShareTimeline() {
    return {
      title: '这周吃什么？开饭咯'
    }
  }
})
