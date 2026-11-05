import type { OrderStatus } from '../../services/types'
import {
  getAllOrders,
  getActiveOrders,
  getDishes,
  getMe,
  getStats,
  moveDish,
  rollMenu,
  toggleDishStatus,
  updateOrderStatus
} from '../../services/api'
import {
  NEXT_ACTION,
  NEXT_STATUS,
  STATUS_TEXT,
  mealName
} from '../../utils/constants'
import { formatTime, itemSummary, dateLabel, dateInputString, formatDate } from '../../utils/format'
import { TEMPLATE_NEW_ORDER } from '../../config'

Page({
  data: {
    orders: [] as any[],
    history: [] as any[],
    dishes: [] as any[],
    stats: null as any,
    loading: true,
    forbidden: false,
    error: '',
    busyId: '',
    busyDishId: '',
    movingId: '',
    showHistory: false,
    showPrep: false,
    prepItems: [] as any[],
    prepTotal: 0,
    weekStats: null as any,
    weekBars: [] as any[],
    weekBarTotal: 0
  },

  _watchTimer: null as any,
  _watching: false,
  _watchGen: 0,
  _knownPending: [] as string[],
  _statsAt: 0,
  _rawOrders: [] as any[],
  _loadSeq: 0,

  onShow() {
    this.guard()
    this.startWatch()
  },

  onHide() {
    this.stopWatch()
  },

  onUnload() {
    this.stopWatch()
  },

  // 轮询新订单：有未完成订单时 20 秒一次，空闲时 45 秒一次，省云端读取。
  // 用 generation 标记防止快速切页时产生多条轮询链。
  startWatch() {
    this.stopWatch()
    this._watching = true
    const gen = this._watchGen
    const schedule = () => {
      if (!this._watching || gen !== this._watchGen) {
        return
      }
      const delay = this.data.orders.length ? 20000 : 45000
      this._watchTimer = setTimeout(async () => {
        if (
          this._watching &&
          gen === this._watchGen &&
          !this.data.forbidden &&
          !this.data.error &&
          !this.data.busyId
        ) {
          await this.load(true)
        }
        schedule()
      }, delay)
    }
    schedule()
  },

  stopWatch() {
    this._watching = false
    this._watchGen++
    if (this._watchTimer) {
      clearTimeout(this._watchTimer)
      this._watchTimer = null
    }
  },

  async guard() {
    try {
      const me = await getMe()
      if (!me.isAdmin) {
        this.setData({
          forbidden: true,
          error: '',
          loading: false,
          orders: [],
          dishes: []
        })
        return
      }
      this.setData({ forbidden: false, error: '' })
      await this.maybeRollMenu()
      await this.load()
    } catch (e: any) {
      this.setData({
        forbidden: false,
        loading: false,
        error: this.errorText(e)
      })
    }
  },

  errorText(e: any): string {
    const raw = String(
      (e && (e.message || e.errMsg)) || '加载失败，下拉重试'
    )
    if (
      raw.indexOf('额度') > -1 ||
      raw.indexOf('0 点后恢复') > -1 ||
      raw.indexOf('EXCEED_REQUEST_LIMIT') > -1 ||
      raw.indexOf('quota') > -1 ||
      raw.indexOf('exceed request limit') > -1
    ) {
      return '今天的云端读取额度用完了，0 点后恢复'
    }
    return raw.slice(0, 40)
  },

  onRetry() {
    this.setData({ error: '', loading: true })
    this.guard()
  },

  // 每天第一次打开厨房时补跑一次菜单滚动/售罄重置，
  // 即使定时触发器没生效也能生效；失败不阻塞页面。
  async maybeRollMenu() {
    const today = dateInputString()
    try {
      if (wx.getStorageSync('kfl_last_roll') === today) {
        return
      }
      await rollMenu()
      wx.setStorageSync('kfl_last_roll', today)
    } catch (e) {
      // 忽略：下次打开厨房再试
    }
  },

  onPullDownRefresh() {
    this.guard().then(() => wx.stopPullDownRefresh())
  },

  async load(silent = false) {
    const seq = ++this._loadSeq
    try {
      // 静默轮询只取未完成订单；首次/操作后加载全量（含历史）
      let orders: any[]
      if (silent) {
        try {
          orders = await getActiveOrders()
        } catch (e) {
          // 云端还没部署 getActiveOrders 时退回全量订单
          orders = await getAllOrders()
        }
      } else {
        orders = await getAllOrders()
      }
      if (seq !== this._loadSeq) {
        return
      }
      // 静默轮询只拉订单；菜品和统计沿用上次结果，省云端读取次数
      let dishes = this.data.dishes
      let stats = this.data.stats
      if (
        !silent ||
        !dishes.length ||
        Date.now() - this._statsAt > 5 * 60 * 1000
      ) {
        const [freshDishes, freshStats] = await Promise.all([
          getDishes(),
          getStats().catch(() => null)
        ])
        dishes = freshDishes
        stats = freshStats
        this._statsAt = Date.now()
      }
      const STATUS_RANK: Record<string, number> = {
        pending: 0,
        accepted: 1,
        cooking: 2,
        ready: 3
      }
      const active = orders
        .filter(
          order =>
            order.status !== 'completed' && order.status !== 'cancelled'
        )
        .sort((a, b) => {
          const rankA =
            STATUS_RANK[a.status] === undefined ? 9 : STATUS_RANK[a.status]
          const rankB =
            STATUS_RANK[b.status] === undefined ? 9 : STATUS_RANK[b.status]
          if (rankA !== rankB) {
            return rankA - rankB
          }
          return Number(a.createdAt || 0) - Number(b.createdAt || 0)
        })
      const pendingIds = active
        .filter(order => order.status === 'pending')
        .map(order => order.id)
      if (this._knownPending.length) {
        const fresh = pendingIds.filter(
          id => this._knownPending.indexOf(id) === -1
        )
        if (fresh.length) {
          wx.vibrateShort({ type: 'heavy', fail: () => {} } as any)
          wx.showToast({ title: '来新订单啦', icon: 'none' })
        }
      }
      this._knownPending = pendingIds
      const toView = (order: any) => {
        const totalQty = order.items.reduce(
          (sum: number, item: any) => sum + Number(item.qty || 0),
          0
        )
        return {
          ...order,
          statusText: STATUS_TEXT[order.status],
          mealText: mealName(order.meal),
          timeText: formatTime(order.createdAt),
          dateText: dateLabel(
            order.scheduledDate ||
              dateInputString(new Date(order.createdAt))
          ),
          summary:
            itemSummary(order.items.map((item: any) => item.name)) +
            ` · 共 ${totalQty} 份`,
          urged: Boolean(
            order.urgedAt && Date.now() - order.urgedAt < 30 * 60 * 1000
          ),
          urgeCount: Number(order.urgeCount || 0),
          urgeText:
            Number(order.urgeCount || 0) > 1
              ? ` · 催了 ${Number(order.urgeCount)} 次`
              : '',
          waitText: (() => {
            const minutes = Math.floor(
              (Date.now() - Number(order.createdAt || 0)) / 60000
            )
            return minutes >= 10 ? `等了 ${minutes} 分钟` : ''
          })(),
          totalQty,
          itemLines: order.items.map((item: any, index: number) => ({
            key: `${order.id}-${index}`,
            name: item.name,
            qty: item.qty,
            specText: (item.specs || []).join(' / '),
            note: item.note
          })),
          profileText:
            order.profile &&
            (order.profile.dislikes.length || order.profile.tastes.length)
              ? [
                  order.profile.dislikes.length
                    ? `忌口：${order.profile.dislikes.join('、')}`
                    : '',
                  order.profile.tastes.length
                    ? `口味：${order.profile.tastes.join('、')}`
                    : ''
                ]
                  .filter(Boolean)
                  .join(' · ')
              : '',
          actionText: NEXT_ACTION[order.status] || '',
          actionLabel:
            ((NEXT_ACTION[order.status] || '') as string) + ' →'
        }
      }
      const view = active.map(toView)
      const history = silent
        ? this.data.history
        : orders
            .filter(
              order =>
                order.status === 'completed' || order.status === 'cancelled'
            )
            .slice(0, 10)
            .map(toView)

      // 今日备菜：把今天所有未完成订单按菜名汇总
      const todayKey = dateInputString()
      const prepMap: Record<string, number> = {}
      active
        .filter(
          order =>
            (order.scheduledDate ||
              dateInputString(new Date(order.createdAt))) === todayKey
        )
        .forEach(order => {
          order.items.forEach((item: any) => {
            const name = String(item.name || '')
            if (name) {
              prepMap[name] = (prepMap[name] || 0) + Number(item.qty || 0)
            }
          })
        })
      const prepItems = Object.keys(prepMap)
        .map(name => ({ name, qty: prepMap[name] }))
        .sort((a, b) => b.qty - a.qty)
      const prepTotal = prepItems.reduce((sum, item) => sum + item.qty, 0)

      // 近 7 天经营概况（不含已取消订单）；静默轮询沿用上次结果
      let weekStats = this.data.weekStats
      let weekBars = this.data.weekBars
      let weekBarTotal = this.data.weekBarTotal
      if (!silent) {
        const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
        const valid = orders.filter(order => order.status !== 'cancelled')
        const weekOrders = valid.filter(order => order.createdAt >= weekAgo)
        const weekDishCount: Record<string, number> = {}
        weekOrders.forEach(order => {
          order.items.forEach((item: any) => {
            weekDishCount[item.name] =
              (weekDishCount[item.name] || 0) + Number(item.qty || 0)
          })
        })
        const weekTopDish =
          Object.keys(weekDishCount).sort(
            (a, b) => weekDishCount[b] - weekDishCount[a]
          )[0] || ''
        weekStats = {
          count: weekOrders.length,
          revenue: weekOrders.reduce(
            (sum, order) => sum + Number(order.amount || 0),
            0
          ),
          totalCount:
            stats && typeof stats.totalOrders === 'number'
              ? stats.totalOrders
              : valid.length,
          topDish: weekTopDish
        }

        // 近 7 天营收柱状图，按预约日期归组
        const WEEK_LABELS = ['日', '一', '二', '三', '四', '五', '六']
        const dayMap: Record<string, number> = {}
        valid.forEach(order => {
          const key =
            order.scheduledDate ||
            dateInputString(new Date(order.createdAt))
          dayMap[key] = (dayMap[key] || 0) + Number(order.amount || 0)
        })
        const bars: any[] = []
        for (let i = 6; i >= 0; i--) {
          const d = new Date()
          d.setDate(d.getDate() - i)
          const key = dateInputString(d)
          bars.push({
            key,
            label: WEEK_LABELS[d.getDay()],
            amount: dayMap[key] || 0
          })
        }
        const maxAmount = Math.max(
          1,
          ...bars.map(bar => bar.amount)
        )
        weekBars = bars.map(bar => ({
          ...bar,
          height: bar.amount
            ? Math.max(10, Math.round((bar.amount / maxAmount) * 100))
            : 4
        }))
        weekBarTotal = bars.reduce((sum, bar) => sum + bar.amount, 0)
      }

      // 统计请求期间可能又来了新的轮询/刷新，落盘前再确认一次
      if (seq !== this._loadSeq) {
        return
      }
      if (!silent) {
        this._rawOrders = orders
      }

      this.setData({
        orders: view,
        history,
        dishes,
        stats,
        prepItems,
        prepTotal,
        weekStats,
        weekBars,
        weekBarTotal,
        loading: false,
        error: ''
      })
    } catch (e: any) {
      if (silent || seq !== this._loadSeq) {
        return
      }
      this.setData({
        loading: false,
        error: this.errorText(e)
      })
    }
  },

  async onAdvance(e: any) {
    if (this.data.busyId) {
      return
    }
    const id = e.currentTarget.dataset.id
    const status = e.currentTarget.dataset.status as OrderStatus
    const next = NEXT_STATUS[status]
    if (!next) {
      return
    }
    this.setData({ busyId: id })
    try {
      await updateOrderStatus(id, next)
      wx.showToast({ title: '状态已更新', icon: 'none' })
      await this.load()
    } catch (err: any) {
      wx.showToast({
        title: String((err && err.message) || '操作失败').slice(0, 40),
        icon: 'none'
      })
    } finally {
      this.setData({ busyId: '' })
    }
  },

  async onReject(e: any) {
    if (this.data.busyId) {
      return
    }
    const id = e.currentTarget.dataset.id
    const res: any = await wx.showModal({
      title: '拒掉这一单？',
      content: '她可能会伤心一秒钟',
      confirmText: '拒单',
      cancelText: '算了'
    })
    if (!res.confirm) {
      return
    }
    this.setData({ busyId: id })
    try {
      await updateOrderStatus(id, 'cancelled')
      await this.load()
    } catch (err: any) {
      wx.showToast({
        title: String((err && err.message) || '操作失败').slice(0, 40),
        icon: 'none'
      })
    } finally {
      this.setData({ busyId: '' })
    }
  },

  async onMoveDish(e: any) {
    if (this.data.movingId) {
      return
    }
    const id = e.currentTarget.dataset.id
    const direction = e.currentTarget.dataset.direction
    this.setData({ movingId: id })
    try {
      const res = await moveDish(id, direction)
      if (res && res.moved) {
        await this.load()
      }
    } catch (err: any) {
      wx.showToast({
        title: String((err && err.message) || '调整失败').slice(0, 40),
        icon: 'none'
      })
    } finally {
      this.setData({ movingId: '' })
    }
  },

  async onToggleDish(e: any) {    if (this.data.busyDishId) {
      return
    }
    const id = e.currentTarget.dataset.id
    this.setData({ busyDishId: id })
    try {
      await toggleDishStatus(id)
      await this.load()
    } catch (err: any) {
      wx.showToast({
        title: String((err && err.message) || '操作失败').slice(0, 40),
        icon: 'none'
      })
    } finally {
      this.setData({ busyDishId: '' })
    }
  },

  onToggleHistory() {
    this.setData({ showHistory: !this.data.showHistory })
  },

  onTogglePrep() {
    this.setData({ showPrep: !this.data.showPrep })
  },

  // 把今天的订单整理成一段文字，方便记账或发给家人
  onCopySummary() {
    const todayKey = dateInputString()
    // 合并最近一次全量加载与轮询到的最新状态，避免漏掉静默刷新期间的新订单
    const map: Record<string, any> = {}
    ;(this._rawOrders || []).forEach(order => {
      map[order.id] = order
    })
    ;(this.data.orders || []).forEach(order => {
      map[order.id] = order
    })
    const todayOrders = Object.keys(map)
      .map(id => map[id])
      .filter(
        order =>
          (order.scheduledDate ||
            dateInputString(new Date(order.createdAt))) === todayKey
      )
    if (!todayOrders.length) {
      wx.showToast({ title: '今天还没有订单', icon: 'none' })
      return
    }
    const valid = todayOrders.filter(order => order.status !== 'cancelled')
    const revenue = valid.reduce(
      (sum, order) => sum + Number(order.amount || 0),
      0
    )
    const lines = todayOrders.map(order => {
      const items = order.items
        .map((item: any) => `${item.name}×${item.qty}`)
        .join('、')
      return `#${order.no} ${mealName(order.meal)} ${
        STATUS_TEXT[order.status]
      } ${items} ¥${order.amount}`
    })
    const dishMap: Record<string, number> = {}
    valid.forEach(order => {
      order.items.forEach((item: any) => {
        dishMap[item.name] = (dishMap[item.name] || 0) + Number(item.qty || 0)
      })
    })
    const prep = Object.keys(dishMap)
      .map(name => `${name}×${dishMap[name]}`)
      .join('，')
    const text = [
      `【张饱饭堂】${formatDate(Date.now())} 订单汇总`,
      `共 ${valid.length} 单 · 营收 ¥${revenue}`,
      ...lines,
      prep ? `备菜：${prep}` : ''
    ]
      .filter(Boolean)
      .join('\n')
    wx.setClipboardData({ data: text })
  },

  onHistoryTap(e: any) {
    const id = e.currentTarget.dataset.id
    if (id) {
      wx.navigateTo({ url: '/pages/order-detail/index?id=' + id })
    }
  },

  onAddDish() {
    wx.navigateTo({ url: '/pages/dish-edit/index' })
  },

  onCategories() {
    wx.navigateTo({ url: '/pages/category-manage/index' })
  },

  onBusiness() {
    wx.navigateTo({ url: '/pages/business/index' })
  },

  onMenu() {
    wx.navigateTo({ url: '/pages/menu-edit/index' })
  },

  onEditDish(e: any) {
    const id = e.currentTarget.dataset.id
    if (id) {
      wx.navigateTo({ url: '/pages/dish-edit/index?id=' + id })
    }
  },

  async onSubscribeNotice() {
    if (!TEMPLATE_NEW_ORDER) {
      wx.showToast({ title: '还没配置提醒模板', icon: 'none' })
      return
    }
    try {
      const res: any = await wx.requestSubscribeMessage({
        tmplIds: [TEMPLATE_NEW_ORDER]
      })
      const accepted = res[TEMPLATE_NEW_ORDER] === 'accept'
      wx.showToast({
        title: accepted ? '下一单会提醒你' : '好的，不打扰',
        icon: 'none'
      })
    } catch (e) {
      wx.showToast({ title: '订阅失败，稍后再试', icon: 'none' })
    }
  },

  onBack() {
    wx.navigateBack({ delta: 1 })
  }
})
