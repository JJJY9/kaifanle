import { getOrdersPage } from '../../services/api'
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
    loadingMore: false,
    hasMore: false,
    error: '',
    keyword: '',
    filter: 'all' as 'all' | 'active' | 'done' | 'rate',
    counts: { all: 0, active: 0, done: 0, rate: 0 }
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

  _loadSeq: 0,

  async load() {
    const seq = ++this._loadSeq
    this.setData({ error: '' })
    try {
      const page = await getOrdersPage(undefined, 50)
      if (seq !== this._loadSeq) {
        return
      }
      this.applyOrders(page.orders, page.hasMore)
    } catch (e: any) {
      if (seq !== this._loadSeq) {
        return
      }
      this.setData({
        loading: false,
        error: String(
          (e && e.message) || '订单加载失败'
        ).slice(0, 40)
      })
    }
  },

  applyOrders(orders: any[], hasMore: boolean) {
    const today = dateInputString()
    const view = orders.map(order => ({
      ...order,
      statusText: STATUS_TEXT[order.status],
      mealText: mealName(order.meal),
      timeText: formatTime(order.createdAt),
      groupKey:
        order.scheduledDate ||
        dateInputString(new Date(order.createdAt)),
      dateText: dateLabel(
        order.scheduledDate || dateInputString(new Date(order.createdAt))
      ),
      isPreorder:
        (order.scheduledDate ||
          dateInputString(new Date(order.createdAt))) > today,
      summary: itemSummary(order.items.map(item => item.name)),
      totalQty: order.items.reduce((sum, item) => sum + item.qty, 0),
      rated: Boolean(order.rating),
      replied: Boolean(order.ownerReply)
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
      ).length,
      rate: view.filter(
        order => order.status === 'completed' && !order.rating
      ).length
    }
    this.setData(
      { orders: view, loading: false, loadingMore: false, hasMore, counts },
      () => this.applyFilter()
    )
  },

  async onLoadMore() {
    if (!this.data.hasMore || this.data.loadingMore) {
      return
    }
    const list = this.data.orders || []
    const last = list[list.length - 1]
    if (!last) {
      return
    }
    this.setData({ loadingMore: true })
    try {
      const page = await getOrdersPage(Number(last.createdAt) || 0, 20)
      const seen: Record<string, boolean> = {}
      const merged = list
        .concat(page.orders)
        .filter(order => {
          if (seen[order.id]) {
            return false
          }
          seen[order.id] = true
          return true
        })
      this.applyOrders(merged, page.hasMore)
    } catch (e: any) {
      this.setData({ loadingMore: false })
      wx.showToast({
        title: String((e && e.message) || '加载失败').slice(0, 40),
        icon: 'none'
      })
    }
  },

  onRetry() {
    this.setData({ loading: true, error: '' })
    this.load()
  },

  onSelectFilter(e: any) {
    const filter = e.currentTarget.dataset.filter
    if (filter === this.data.filter) {
      return
    }
    this.setData({ filter }, () => this.applyFilter())
  },

  onSearch(e: any) {
    this.setData({ keyword: String(e.detail.value || '') }, () =>
      this.applyFilter()
    )
  },

  onClearSearch() {
    this.setData({ keyword: '' }, () => this.applyFilter())
  },

  applyFilter() {
    const filter = this.data.filter
    const keyword = this.data.keyword.trim().toLowerCase()
    const list = this.data.orders.filter(order => {
      const finished =
        order.status === 'completed' || order.status === 'cancelled'
      if (filter === 'active' && finished) {
        return false
      }
      if (filter === 'done' && !finished) {
        return false
      }
      if (
        filter === 'rate' &&
        !(order.status === 'completed' && !order.rating)
      ) {
        return false
      }
      if (keyword) {
        const haystack = `${order.no} ${order.summary} ${order.dateText}`
          .toLowerCase()
        if (haystack.indexOf(keyword) === -1) {
          return false
        }
      }
      return true
    })
    let lastLabel = ''
    const displayOrders = list
      .slice()
      .sort((a, b) => {
        if (a.groupKey !== b.groupKey) {
          return a.groupKey < b.groupKey ? 1 : -1
        }
        return Number(b.createdAt || 0) - Number(a.createdAt || 0)
      })
      .map(order => {
        const label = order.groupKey
        const showHeader = label !== lastLabel
        lastLabel = label
        return { ...order, showHeader }
      })
    this.setData({ displayOrders })
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
