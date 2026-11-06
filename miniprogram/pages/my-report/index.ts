import { getMyStats, getOrders } from '../../services/api'

interface FootprintDish {
  name: string
  qty: number
  amount: number
}

Page({
  data: {
    loading: true,
    error: '',
    monthText: '',
    monthOrders: 0,
    monthSpend: 0,
    totalOrders: 0,
    favorite: '',
    topDishes: [] as FootprintDish[],
    ratedCount: 0,
    avgRating: 0
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
    this.setData({ loading: true, error: '' })
    try {
      const [orders, stats] = await Promise.all([getOrders(), getMyStats()])
      if (seq !== this._loadSeq) {
        return
      }
      const now = new Date()
      const monthly = orders.filter(order => {
        const date = new Date(order.createdAt)
        return (
          date.getFullYear() === now.getFullYear() &&
          date.getMonth() === now.getMonth()
        )
      })
      const active = monthly.filter(order => order.status !== 'cancelled')
      const spend = active.reduce(
        (sum, order) => sum + Number(order.amount || 0),
        0
      )
      const dishMap: Record<string, FootprintDish> = {}
      active.forEach(order => {
        ;(order.items || []).forEach(item => {
          const name = item.name || '未命名'
          if (!dishMap[name]) {
            dishMap[name] = { name, qty: 0, amount: 0 }
          }
          const qty = Number(item.qty || 0)
          dishMap[name].qty += qty
          dishMap[name].amount += Number(item.price || 0) * qty
        })
      })
      const topDishes = Object.keys(dishMap)
        .map(name => ({
          ...dishMap[name],
          amount: Number(dishMap[name].amount.toFixed(2))
        }))
        .sort((a, b) => b.qty - a.qty || b.amount - a.amount)
        .slice(0, 5)
      const rated = active.filter(order => Number(order.rating) > 0)
      const avgRating = rated.length
        ? Number(
            (
              rated.reduce((sum, order) => sum + Number(order.rating), 0) /
              rated.length
            ).toFixed(1)
          )
        : 0
      this.setData({
        loading: false,
        monthText: `${now.getFullYear()} 年 ${now.getMonth() + 1} 月`,
        monthOrders: active.length,
        monthSpend: Number(spend.toFixed(2)),
        totalOrders: Number(stats.total || 0),
        favorite: stats.favorite || '',
        topDishes,
        ratedCount: rated.length,
        avgRating
      })
    } catch (e: any) {
      if (seq !== this._loadSeq) {
        return
      }
      this.setData({
        loading: false,
        error: String((e && e.message) || '足迹加载失败').slice(0, 60)
      })
    }
  },

  onRetry() {
    this.load()
  },

  onGoOrders() {
    wx.switchTab({ url: '/pages/orders/index' })
  }
})
