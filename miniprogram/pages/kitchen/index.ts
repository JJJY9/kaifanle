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
    dishes: [] as any[],
    stats: null as any,
    loading: true,
    forbidden: false,
    error: ''
  },

  onShow() {
    this.guard()
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

  async load() {
    try {
      const [orders, dishes, stats] = await Promise.all([
        getAllOrders(),
        getDishes(),
        getStats().catch(() => null)
      ])
      const active = orders.filter(
        order => order.status !== 'completed' && order.status !== 'cancelled'
      )
      const view = active.map(order => {
        const totalQty = order.items.reduce(
          (sum, item) => sum + Number(item.qty || 0),
          0
        )
        return {
          ...order,
          statusText: STATUS_TEXT[order.status],
          mealText: mealName(order.meal),
          timeText: formatTime(order.createdAt),
          dateText: dateLabel(
            order.scheduledDate || dateInputString(new Date(order.createdAt))
          ),
          summary:
            itemSummary(order.items.map(item => item.name)) +
            ` · 共 ${totalQty} 份`,
          totalQty,
          itemLines: order.items.map((item, index) => ({
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
      })
      this.setData({ orders: view, dishes, stats, loading: false, error: '' })
    } catch (e: any) {
      this.setData({
        loading: false,
        error: String(
          (e && (e.message || e.errMsg)) || '加载失败，下拉重试'
        ).slice(0, 40)
      })
    }
  },

  async onAdvance(e: any) {
    const id = e.currentTarget.dataset.id
    const status = e.currentTarget.dataset.status as OrderStatus
    const next = NEXT_STATUS[status]
    if (!next) {
      return
    }
    try {
      await updateOrderStatus(id, next)
      wx.showToast({ title: '状态已更新', icon: 'none' })
      this.load()
    } catch (err: any) {
      wx.showToast({
        title: String((err && err.message) || '操作失败').slice(0, 40),
        icon: 'none'
      })
    }
  },

  async onReject(e: any) {
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
    try {
      await updateOrderStatus(id, 'cancelled')
      this.load()
    } catch (err: any) {
      wx.showToast({
        title: String((err && err.message) || '操作失败').slice(0, 40),
        icon: 'none'
      })
    }
  },

  async onToggleDish(e: any) {
    const id = e.currentTarget.dataset.id
    try {
      await toggleDishStatus(id)
      this.load()
    } catch (err: any) {
      wx.showToast({
        title: String((err && err.message) || '操作失败').slice(0, 40),
        icon: 'none'
      })
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
