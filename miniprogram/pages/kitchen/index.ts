import type { OrderStatus } from '../../services/types'
import {
  getDishes,
  getOrders,
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

Page({
  data: {
    orders: [] as any[],
    dishes: [] as any[],
    loading: true
  },

  onShow() {
    this.load()
  },

  async load() {
    try {
      const [orders, dishes] = await Promise.all([getOrders(), getDishes()])
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
    await updateOrderStatus(id, next)
    wx.showToast({ title: '状态已更新', icon: 'none' })
    this.load()
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
    await updateOrderStatus(id, 'cancelled')
    this.load()
  },

  async onToggleDish(e: any) {
    const id = e.currentTarget.dataset.id
    await toggleDishStatus(id)
    this.load()
  }
})
