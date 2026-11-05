import { getOrders } from '../../services/api'
import { STATUS_TEXT, mealName } from '../../utils/constants'
import { formatTime, itemSummary } from '../../utils/format'

Page({
  data: {
    orders: [] as any[],
    loading: true
  },

  onShow() {
    const tabBar: any = (this as any).getTabBar
      ? (this as any).getTabBar()
      : null
    if (tabBar) {
      tabBar.setData({ selected: 1 })
    }
    this.load()
  },

  async load() {
    try {
      const orders = await getOrders()
      const view = orders.map(order => ({
        ...order,
        statusText: STATUS_TEXT[order.status],
        mealText: mealName(order.meal),
        timeText: formatTime(order.createdAt),
        summary: itemSummary(order.items.map(item => item.name)),
        totalQty: order.items.reduce((sum, item) => sum + item.qty, 0)
      }))
      this.setData({ orders: view, loading: false })
    } catch (e) {
      this.setData({ loading: false })
      wx.showToast({ title: '订单加载失败', icon: 'none' })
    }
  },

  onTapOrder(e: any) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/order-detail/index?id=${id}` })
  },

  onGoHome() {
    wx.switchTab({ url: '/pages/home/index' })
  },

  onPullDownRefresh() {
    this.load().then(() => wx.stopPullDownRefresh())
  }
})
