import { getDishes, getMyStats, getOrdersPage } from '../../services/api'
import { STATUS_TEXT, mealName } from '../../utils/constants'
import { sameDayWaitText } from '../../utils/wait'
import {
  formatTime,
  itemSummary,
  dateLabel,
  dateInputString
} from '../../utils/format'

const COLLAPSED_DATES_KEY = 'kfl_order_collapsed_dates_v1'

function readCollapsedDates(): Record<string, boolean> {
  try {
    const raw = wx.getStorageSync(COLLAPSED_DATES_KEY)
    const data = raw ? JSON.parse(raw) : {}
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return {}
    }
    const result: Record<string, boolean> = {}
    Object.keys(data).forEach(key => {
      if (data[key]) {
        result[key] = true
      }
    })
    return result
  } catch (e) {
    return {}
  }
}

function writeCollapsedDates(data: Record<string, boolean>) {
  try {
    wx.setStorageSync(COLLAPSED_DATES_KEY, JSON.stringify(data))
  } catch (e) {
    // 忽略存储失败
  }
}

Page({
  data: {
    orders: [] as any[],
    displayOrders: [] as any[],
    loading: true,
    loadingMore: false,
    hasMore: false,
    showBackTop: false,
    monthText: '',
    error: '',
    keyword: '',
    filter: 'all' as 'all' | 'active' | 'done' | 'rate' | 'preorder',
    meal: 'all' as 'all' | 'breakfast' | 'lunch' | 'dinner',
    emptyTitle: '这里还没有订单',
    emptyDesc: '去点一单吧',
    emptyAction: '',
    collapsedDates: readCollapsedDates(),
    counts: { all: 0, active: 0, done: 0, rate: 0, preorder: 0 }
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
  _dishMap: {} as Record<string, any>,

  async load() {
    const seq = ++this._loadSeq
    this.setData({ error: '' })
    try {
      const [page, stats, dishes] = await Promise.all([
        getOrdersPage(undefined, 50),
        getMyStats().catch(() => null),
        getDishes().catch(() => [])
      ])
      if (seq !== this._loadSeq) {
        return
      }
      const dishMap: Record<string, any> = {}
      ;(dishes || []).forEach((dish: any) => {
        dishMap[dish.id] = dish
      })
      this._dishMap = dishMap
      this.setData({
        monthText: stats
          ? `本月 ${Number(stats.month || 0)} 单 · ¥${Number(
              stats.monthSpend || 0
            )}`
          : ''
      })
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
      waitedText: (() => {
        if (
          ['pending', 'accepted', 'cooking', 'ready'].indexOf(order.status) ===
          -1
        ) {
          return ''
        }
        const effective =
          order.scheduledDate ||
          dateInputString(new Date(Number(order.createdAt || 0)))
        if (effective !== today) {
          return ''
        }
        return sameDayWaitText(Number(order.createdAt || 0))
      })(),
      mealText: mealName(order.meal),
      timeText: formatTime(order.createdAt),
      thumb: (() => {
        const first = (order.items || [])[0]
        const dish = first ? this._dishMap[first.dishId] : null
        return dish ? dish.image || dish.cartoon || '' : ''
      })(),
      lastMessageText: (() => {
        const messages = order.messages || []
        const last = messages[messages.length - 1]
        if (!last) {
          return ''
        }
        const prefix = last.role === 'admin' ? '掌勺人' : '她'
        const content = String(last.content || '')
        return `${prefix}：${
          content.length > 24 ? content.slice(0, 24) + '…' : content
        }`
      })(),
      messageBadge: Math.max(0, Number(order.customerUnread) || 0),
      noteText: (() => {
        const note = String(order.note || '').trim()
        return note.length > 40 ? note.slice(0, 40) + '…' : note
      })(),
      groupKey:
        order.scheduledDate ||
        dateInputString(new Date(order.createdAt)),
      groupDateText: (
        order.scheduledDate ||
        dateInputString(new Date(order.createdAt))
      ).slice(5),
      dateText: dateLabel(
        order.scheduledDate || dateInputString(new Date(order.createdAt))
      ),
      isPreorder:
        (order.scheduledDate ||
          dateInputString(new Date(order.createdAt))) > today,
      summary: itemSummary(order.items.map(item => item.name)),
      totalQty: order.items.reduce((sum, item) => sum + item.qty, 0),
      rated: Boolean(order.rating),
      ratingEmoji:
        Number(order.rating) === 3
          ? '😋'
          : Number(order.rating) === 2
          ? '🙂'
          : Number(order.rating) === 1
          ? '😵'
          : '',
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
      ).length,
      preorder: view.filter(
        order => order.isPreorder && order.status !== 'cancelled'
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

  onSelectMeal(e: any) {
    const raw = String(e.currentTarget.dataset.meal || '')
    const meal =
      raw === 'breakfast' || raw === 'lunch' || raw === 'dinner'
        ? raw
        : 'all'
    if (meal === this.data.meal) {
      return
    }
    this.setData({ meal }, () => this.applyFilter())
  },

  onToggleDate(e: any) {
    const date = String((e.currentTarget && e.currentTarget.dataset.date) || '')
    if (!date) {
      return
    }
    const collapsedDates = Object.assign({}, this.data.collapsedDates)
    collapsedDates[date] = !collapsedDates[date]
    writeCollapsedDates(collapsedDates)
    this.setData({ collapsedDates }, () => this.applyFilter())
  },

  onSearch(e: any) {
    this.setData({ keyword: String(e.detail.value || '') }, () =>
      this.applyFilter()
    )
  },

  onClearSearch() {
    this.setData({ keyword: '' }, () => this.applyFilter())
  },

  onGoFootprint() {
    wx.navigateTo({ url: '/pages/my-report/index' })
  },

  onPageScroll(e: any) {
    const showBackTop = Number((e && e.scrollTop) || 0) > 600
    if (showBackTop !== this.data.showBackTop) {
      this.setData({ showBackTop })
    }
  },

  onCopyDayOrders(e: any) {
    const date = String((e.currentTarget && e.currentTarget.dataset.date) || '')
    if (!date) {
      return
    }
    const orders = this.filteredOrders().filter(
      order => order.groupKey === date
    )
    const nos = orders.map(order => String(order.no || '')).filter(Boolean)
    if (!nos.length) {
      return
    }
    wx.setClipboardData({
      data: [
        `【订单清单】${date} · ${nos.length} 单`,
        nos.map(no => `#${no}`).join('、')
      ].join('\n'),
      success: () => wx.showToast({ title: '当日订单号已复制', icon: 'none' })
    })
  },

  onCopyOrderNo(e: any) {
    const no = String((e && e.currentTarget && e.currentTarget.dataset.no) || '')
    if (!no) {
      return
    }
    wx.setClipboardData({
      data: no,
      success: () => {
        wx.showToast({ title: '订单号已复制', icon: 'none' })
      }
    })
  },

  onBackTop() {
    wx.pageScrollTo({ scrollTop: 0, duration: 300 })
  },

  filteredOrders() {
    const filter = this.data.filter
    const keyword = this.data.keyword.trim().toLowerCase()
    const meal = this.data.meal
    return (this.data.orders || []).filter(order => {
      if (meal !== 'all' && order.meal !== meal) {
        return false
      }
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
      if (
        filter === 'preorder' &&
        !(order.isPreorder && order.status !== 'cancelled')
      ) {
        return false
      }
      if (keyword) {
        const haystack = `${order.no} ${order.summary} ${
          order.dateText
        } ${order.note || ''} ${order.address || ''} ${
          order.feedback || ''
        } ${(order.ratingTags || []).join(' ')} ${(order.items || [])
          .map(item => item.note || '')
          .join(' ')}`.toLowerCase()
        if (haystack.indexOf(keyword) === -1) {
          return false
        }
      }
      return true
    })
  },

  applyFilter() {
    const filter = this.data.filter
    const keyword = this.data.keyword.trim()
    const meal = this.data.meal
    const list = this.filteredOrders()
    let lastLabel = ''
    const groupCounts: Record<string, number> = {}
    list.forEach(order => {
      groupCounts[order.groupKey] = (groupCounts[order.groupKey] || 0) + 1
    })
    const seenGroups: Record<string, boolean> = {}
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
        const firstInGroup = !seenGroups[label]
        seenGroups[label] = true
        const collapsed = Boolean(this.data.collapsedDates[label])
        if (collapsed && !firstInGroup) {
          return null
        }
        return {
          ...order,
          showHeader,
          collapsed: collapsed && firstInGroup,
          groupCount: groupCounts[label] || 1
        }
      })
      .filter(Boolean)
    this.setData({
      displayOrders,
      emptyTitle: keyword
        ? '没搜到相关订单'
        : meal !== 'all'
        ? '这个餐次还没有订单'
        : filter === 'preorder'
        ? '还没有预订'
        : filter !== 'all'
        ? '这一档还没有订单'
        : '这里还没有订单',
      emptyDesc: keyword
        ? '换个菜名、订单号或日期试试'
        : meal !== 'all'
        ? '换个餐次看看'
        : filter === 'preorder'
        ? '提前点一单，到日子再做'
        : filter !== 'all'
        ? '换个筛选看看'
        : '去点一单吧',
      emptyAction: keyword ? '清空搜索' : ''
    })
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
