import { getOrders } from '../../services/api'
import { STATUS_TEXT, mealName } from '../../utils/constants'
import {
  formatTime,
  itemSummary,
  dateLabel,
  dateInputString
} from '../../utils/format'

Page({
  data: {
    orders: [] as any[],
    displayOrders: [] as any[],
    loading: true,
    filter: 'all' as 'all' | 'active' | 'done',
    counts: { all: 0, active: 0, done: 0 }
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
        dateText: dateLabel(
          order.scheduledDate || dateInputString(new Date(order.createdAt))
        ),
        summary: itemSummary(order.items.map(item => item.name)),
        totalQty: order.items.reduce((sum, item) => sum + item.qty, 0)
      }))
      const counts = {
        all: view.length,
        active: view.filter(
          order =>
            order.status !== 'completed' && order.status !== 'cancelled'
        ).length,
        done: view.filter(
          order =>
            order.status === 'completed' || order.status === 'cancelled'
        ).length
      }
      this.setData({ orders: view, loading: false, counts }, () =>
        this.applyFilter()
      )
    } catch (e) {
      this.setData({ loading: false })
      wx.showToast({ title: '订单加载失败', icon: 'none' })
    }
  },

  onSelectFilter(e: any) {
    const filter = e.currentTarget.dataset.filter
    if (filter === this.data.filter) {
      return
    }
    this.setData({ filter }, () => this.applyFilter())
  },

  applyFilter() {
    const filter = this.data.filter
    const list = this.data.orders.filter(order => {
      const finished =
        order.status === 'completed' || order.status === 'cancelled'
      if (filter === 'active') {
        return !finished
      }
      if (filter === 'done') {
        return finished
      }
      return true
    })
    this.setData({ displayOrders: list })
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
