import type { OrderStatus } from '../../services/types'
import {
  getAllOrders,
  getDishes,
  getMe,
  getStats,
  toggleDishStatus,
  updateOrderStatus
} from '../../services/api'
import {
  NEXT_ACTION,
  NEXT_STATUS,
  STATUS_TEXT,
  mealName
} from '../../utils/constants'
import { formatTime, itemSummary, dateLabel, dateInputString } from '../../utils/format'
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
    showHistory: false,
    showPrep: false,
    prepItems: [] as any[],
    prepTotal: 0,
    weekStats: null as any
  },

  _watchTimer: null as any,
  _knownPending: [] as string[],

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

  // 每 25 秒静默刷新一次，有新订单就震动提醒
  startWatch() {
    this.stopWatch()
    this._watchTimer = setInterval(() => {
      if (
        !this.data.forbidden &&
        !this.data.error &&
        !this.data.busyId
      ) {
        this.load(true)
      }
    }, 25000)
  },

  stopWatch() {
    if (this._watchTimer) {
      clearInterval(this._watchTimer)
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
      await this.load()
    } catch (e: any) {
      this.setData({
        forbidden: false,
        loading: false,
        error: String(
          (e && (e.message || e.errMsg)) || '加载失败，下拉重试'
        ).slice(0, 40)
      })
    }
  },

  onRetry() {
    this.setData({ error: '', loading: true })
    this.guard()
  },

  onPullDownRefresh() {
    this.guard().then(() => wx.stopPullDownRefresh())
  },

  async load(silent = false) {
    try {
      const [orders, dishes, stats] = await Promise.all([
        getAllOrders(),
        getDishes(),
        getStats().catch(() => null)
      ])
      const active = orders.filter(
        order => order.status !== 'completed' && order.status !== 'cancelled'
      )
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
          actionText: NEXT_ACTION[order.status] || ''
        }
      }
      const view = active.map(toView)
      const history = orders
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

      // 近 7 天经营概况（不含已取消订单）
      const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
      const valid = orders.filter(order => order.status !== 'cancelled')
      const weekOrders = valid.filter(order => order.createdAt >= weekAgo)
      const weekStats = {
        count: weekOrders.length,
        revenue: weekOrders.reduce(
          (sum, order) => sum + Number(order.amount || 0),
          0
        ),
        totalCount: valid.length
      }

      this.setData({
        orders: view,
        history,
        dishes,
        stats,
        prepItems,
        prepTotal,
        weekStats,
        loading: false,
        error: ''
      })
    } catch (e: any) {
      if (silent) {
        return
      }
      this.setData({
        loading: false,
        error: String(
          (e && (e.message || e.errMsg)) || '加载失败，下拉重试'
        ).slice(0, 40)
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

  async onToggleDish(e: any) {
    if (this.data.busyDishId) {
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

  onHistoryTap(e: any) {
    const id = e.currentTarget.dataset.id
    if (id) {
      wx.navigateTo({ url: '/pages/order-detail/index?id=' + id })
    }
  },

  onAddDish() {
    wx.navigateTo({ url: '/pages/dish-edit/index' })
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
