import type { OrderStatus } from '../../services/types'
import {
  getAllOrders,
  getDishes,
  getMe,
  toggleDishStatus,
  updateOrderStatus
} from '../../services/api'
import {
  NEXT_ACTION,
  NEXT_STATUS,
  STATUS_TEXT,
  mealName
} from '../../utils/constants'
import { formatTime, itemSummary } from '../../utils/format'
import { TEMPLATE_NEW_ORDER } from '../../config'

Page({
  data: {
    orders: [] as any[],
    dishes: [] as any[],
    loading: true,
    forbidden: false
  },

  onShow() {
    this.guard()
  },

  async guard() {
    try {
      const me = await getMe()
      if (!me.isAdmin) {
        this.setData({ forbidden: true, loading: false, orders: [], dishes: [] })
        return
      }
      this.setData({ forbidden: false })
      this.load()
    } catch (e) {
      this.setData({ forbidden: true, loading: false })
    }
  },

  async load() {
    try {
      const [orders, dishes] = await Promise.all([getAllOrders(), getDishes()])
      const active = orders.filter(
        order => order.status !== 'completed' && order.status !== 'cancelled'
      )
      const view = active.map(order => ({
        ...order,
        statusText: STATUS_TEXT[order.status],
        mealText: mealName(order.meal),
        timeText: formatTime(order.createdAt),
        summary: itemSummary(order.items.map(item => item.name)),
        actionText: NEXT_ACTION[order.status] || ''
      }))
      this.setData({ orders: view, dishes, loading: false })
    } catch (e) {
      this.setData({ loading: false })
      wx.showToast({ title: '加载失败', icon: 'none' })
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
