import type { OrderStatus } from '../../services/types'
import {
  getAllOrders,
  getActiveOrders,
  getCategories,
  getDishes,
  getMe,
  getStats,
  moveDish,
  replyRating,
  rollMenu,
  saveDish,
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
    replyingId: '',
    restockingId: '',
    restockingAll: false,
    historyOnlyPending: false,
    historyView: [] as any[],
    movingId: '',
    showHistory: false,
    showPrep: false,
    prepItems: [] as any[],
    prepTotal: 0,
    weekStats: null as any,
    weekBars: [] as any[],
    weekBarTotal: 0,
    todo: { pending: 0, replies: 0, lowStock: 0 },
    dishKeyword: '',
    dishFilter: 'all' as 'all' | 'low' | 'soldout' | 'off',
    dishCategory: 'all',
    dishFilters: [] as any[],
    dishCategoryOptions: [] as any[],
    displayDishes: [] as any[]
  },

  _watchTimer: null as any,
  _watching: false,
  _watchGen: 0,
  _knownPending: [] as string[],
  _statsAt: 0,
  _rawOrders: [] as any[],
  _categories: [] as any[],
  _replyModalOpen: false as boolean,
  _lastPollErrorAt: 0,
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
      // 静默轮询只拉订单；菜品只在非静默加载时刷新；
      // 统计最多每 5 分钟刷新一次，节省云端读取
      let dishes = this.data.dishes
      let stats = this.data.stats
      if (!silent || !dishes.length) {
        const [dishList, categories] = await Promise.all([
          getDishes(),
          getCategories().catch(() => [] as any[])
        ])
        dishes = dishList
        if (categories.length) {
          this._categories = categories
        }
      }
      if (
        !silent ||
        !stats ||
        Date.now() - this._statsAt > 5 * 60 * 1000
      ) {
        stats = await getStats().catch(() => stats)
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
      const dishById: Record<string, any> = {}
      dishes.forEach((dish: any) => {
        dishById[dish.id] = dish
      })
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
          ratingText:
            order.rating === 3
              ? '😋 好吃'
              : order.rating === 2
              ? '🙂 一般'
              : order.rating === 1
              ? '😵 翻车'
              : '',
          feedback: order.feedback || '',
          canReply:
            order.status === 'completed' &&
            [1, 2, 3].indexOf(Number(order.rating)) > -1,
          waitText: (() => {
            const minutes = Math.floor(
              (Date.now() - Number(order.createdAt || 0)) / 60000
            )
            return minutes >= 10 ? `等了 ${minutes} 分钟` : ''
          })(),
          totalQty,
          itemLines: order.items.map((item: any, index: number) => ({
            key: `${order.id}-${index}`,
            dishId: item.dishId,
            hasRecipe: Boolean(
              dishById[item.dishId] && dishById[item.dishId].recipe
            ),
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

      const todo = silent
        ? { ...this.data.todo, pending: active.length }
        : {
            pending: active.length,
            replies: orders
              .filter(
                order =>
                  order.status === 'completed' ||
                  order.status === 'cancelled'
              )
              .slice(0, 10)
              .filter(
                order =>
                  order.status === 'completed' &&
                  [1, 2, 3].indexOf(Number(order.rating)) > -1 &&
                  !order.ownerReply
              ).length,
            lowStock: dishes.filter(
              dish =>
                dish.status === 'on' &&
                typeof dish.stock === 'number' &&
                dish.stock >= 0 &&
                dish.stock <= 3
            ).length
          }

      this.setData({
        orders: view,
        history,
        historyView: this.filterHistory(history),
        dishes,
        stats,
        prepItems,
        prepTotal,
        todo,
        weekStats,
        weekBars,
        weekBarTotal,
        loading: false,
        error: ''
      }, () => this.applyDishFilter())
    } catch (e: any) {
      if (seq !== this._loadSeq) {
        return
      }
      if (silent) {
        // 轮询失败不打断页面，但每 5 分钟最多提醒一次
        if (Date.now() - this._lastPollErrorAt > 5 * 60 * 1000) {
          this._lastPollErrorAt = Date.now()
          wx.showToast({ title: '刷新失败，稍后自动重试', icon: 'none' })
        }
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

  async onRestock(e: any) {
    if (this.data.restockingId) {
      return
    }
    const id = e.currentTarget.dataset.id
    const dish = (this.data.dishes || []).find(item => item.id === id)
    if (!dish || typeof dish.stock !== 'number') {
      return
    }
    const nextStock = Math.max(0, Number(dish.stock)) + 5
    this.setData({ restockingId: id })
    try {
      const updated = await saveDish({ ...dish, stock: nextStock } as any)
      const stock =
        updated && typeof updated.stock === 'number'
          ? updated.stock
          : nextStock
      const dishes = this.data.dishes.map(item =>
        item.id === id ? { ...item, stock } : item
      )
      const lowStock = dishes.filter(
        item =>
          item.status === 'on' &&
          typeof item.stock === 'number' &&
          item.stock >= 0 &&
          item.stock <= 3
      ).length
      this.setData(
        {
          dishes,
          todo: { ...this.data.todo, lowStock }
        },
        () => this.applyDishFilter()
      )
      wx.showToast({ title: `已补到 ${stock} 份`, icon: 'none' })
    } catch (err: any) {
      wx.showToast({
        title: String((err && err.message) || '补库存失败').slice(0, 40),
        icon: 'none'
      })
    } finally {
      this.setData({ restockingId: '' })
    }
  },

  async onRestockAll() {
    if (this.data.restockingAll) {
      return
    }
    const low = (this.data.dishes || []).filter(
      dish =>
        dish.status === 'on' &&
        typeof dish.stock === 'number' &&
        dish.stock >= 0 &&
        dish.stock <= 3
    )
    if (!low.length) {
      wx.showToast({ title: '没有低库存的菜', icon: 'none' })
      return
    }
    const res: any = await wx.showModal({
      title: '全部补 5 份？',
      content: `有 ${low.length} 道菜库存 ≤3 份，会给每道菜加 5 份。`,
      confirmText: '补货',
      cancelText: '算了'
    })
    if (!res.confirm) {
      return
    }
    this.setData({ restockingAll: true })
    let done = 0
    let failed = 0
    const stockMap: Record<string, number> = {}
    for (const dish of low) {
      try {
        const updated = await saveDish({
          ...dish,
          stock: Number(dish.stock) + 5
        } as any)
        stockMap[dish.id] =
          updated && typeof updated.stock === 'number'
            ? updated.stock
            : Number(dish.stock) + 5
        done++
      } catch (e) {
        failed++
      }
    }
    const dishes = this.data.dishes.map(dish =>
      stockMap[dish.id] !== undefined
        ? { ...dish, stock: stockMap[dish.id] }
        : dish
    )
    const lowStock = dishes.filter(
      dish =>
        dish.status === 'on' &&
        typeof dish.stock === 'number' &&
        dish.stock >= 0 &&
        dish.stock <= 3
    ).length
    this.setData(
      {
        dishes,
        todo: { ...this.data.todo, lowStock },
        restockingAll: false
      },
      () => this.applyDishFilter()
    )
    wx.showToast({
      title: failed ? `补好 ${done} 道，${failed} 道失败` : `补好 ${done} 道`,
      icon: 'none'
    })
  },

  applyDishFilter() {
    const dishes = this.data.dishes || []
    const keyword = String(this.data.dishKeyword || '')
      .trim()
      .toLowerCase()
    const filter = this.data.dishFilter
    const category = this.data.dishCategory
    const low = (dish: any) =>
      dish.status === 'on' &&
      typeof dish.stock === 'number' &&
      dish.stock >= 0 &&
      dish.stock <= 3
    const soldout = (dish: any) =>
      dish.status === 'soldout' || dish.stock === 0
    const displayDishes = dishes.filter(dish => {
      if (category !== 'all' && dish.categoryId !== category) {
        return false
      }
      if (
        keyword &&
        `${dish.name} ${dish.desc || ''}`
          .toLowerCase()
          .indexOf(keyword) === -1
      ) {
        return false
      }
      if (filter === 'low') {
        return low(dish)
      }
      if (filter === 'soldout') {
        return soldout(dish)
      }
      if (filter === 'off') {
        return dish.status === 'off'
      }
      return true
    })
    this.setData({
      displayDishes,
      dishCategoryOptions: [
        { id: 'all', name: '全部分类' }
      ].concat(
        (this._categories || []).map(category => ({
          id: category.id,
          name: category.name
        }))
      ),
      dishFilters: [
        { key: 'all', label: '全部', count: dishes.length },
        {
          key: 'low',
          label: '低库存',
          count: dishes.filter(low).length
        },
        {
          key: 'soldout',
          label: '售罄',
          count: dishes.filter(soldout).length
        },
        {
          key: 'off',
          label: '已下架',
          count: dishes.filter(dish => dish.status === 'off').length
        }
      ]
    })
  },

  onDishSearch(e: any) {
    this.setData({ dishKeyword: String(e.detail.value || '') }, () =>
      this.applyDishFilter()
    )
  },

  onClearDishSearch() {
    this.setData({ dishKeyword: '' }, () => this.applyDishFilter())
  },

  onDishFilter(e: any) {
    const filter = e.currentTarget.dataset.filter
    if (filter === this.data.dishFilter) {
      return
    }
    this.setData({ dishFilter: filter }, () => this.applyDishFilter())
  },

  onDishCategory(e: any) {
    const category = e.currentTarget.dataset.id
    if (category === this.data.dishCategory) {
      return
    }
    this.setData({ dishCategory: category }, () =>
      this.applyDishFilter()
    )
  },

  onToggleHistory() {
    this.setData({ showHistory: !this.data.showHistory })
  },

  filterHistory(list: any[]): any[] {
    if (!this.data.historyOnlyPending) {
      return list
    }
    return list.filter(
      order => order.canReply && !order.ownerReply
    )
  },

  applyHistoryFilter() {
    this.setData({
      historyView: this.filterHistory(this.data.history || [])
    })
  },

  onHistoryFilter(e: any) {
    const only = e.currentTarget.dataset.only === 'pending'
    if (only === this.data.historyOnlyPending) {
      return
    }
    this.setData({ historyOnlyPending: only }, () =>
      this.applyHistoryFilter()
    )
  },

  onTodoTap(e: any) {
    const target = e.currentTarget.dataset.target
    if (target === 'replies') {
      this.setData(
        { showHistory: true, historyOnlyPending: true },
        () => {
          this.applyHistoryFilter()
          wx.pageScrollTo({ selector: '#history-section', duration: 300 })
        }
      )
      return
    }
    const selector =
      target === 'stock' ? '#menu-section' : '#orders-section'
    wx.pageScrollTo({ selector, duration: 300 })
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

  async onReplyRating(e: any) {
    const id = e.currentTarget.dataset.id
    if (this._replyModalOpen) {
      return
    }
    if (this.data.replyingId) {
      if (this.data.replyingId !== id) {
        wx.showToast({ title: '正在回复另一条，稍等', icon: 'none' })
      }
      return
    }
    const item = (this.data.history || []).find((order: any) => order.id === id)
    if (!item) {
      return
    }
    this._replyModalOpen = true
    let modal: any
    try {
      modal = await wx.showModal({
        title: '回复这条评价',
        editable: true,
        content: item.ownerReply || '',
        placeholderText: '比如：谢谢你爱吃，下次给你多加个蛋',
        confirmText: item.ownerReply ? '更新' : '回复',
        cancelText: '算了'
      })
    } catch (err) {
      wx.showToast({ title: '打不开回复框，再试一次', icon: 'none' })
      return
    } finally {
      this._replyModalOpen = false
    }
    if (!modal || !modal.confirm) {
      return
    }
    const reply = Array.from(
      String(modal.content || '').trim()
    )
      .slice(0, 50)
      .join('')
    if (!reply) {
      wx.showToast({ title: '没写内容', icon: 'none' })
      return
    }
    this.setData({ replyingId: id })
    try {
      const updated = await replyRating(id, reply, item.ratedAt)
      if (!updated) {
        throw new Error('订单不存在')
      }
      const ownerReplyAt = updated.ownerReplyAt || Date.now()
      const index = (this.data.history || []).findIndex(
        (order: any) => order.id === id
      )
      const todo =
        !item.ownerReply && this.data.todo.replies > 0
          ? { ...this.data.todo, replies: this.data.todo.replies - 1 }
          : this.data.todo
      if (index > -1) {
        this.setData({
          [`history[${index}].ownerReply`]: reply,
          [`history[${index}].ownerReplyAt`]: ownerReplyAt,
          todo
        }, () => this.applyHistoryFilter())
      } else {
        await this.load()
      }
      ;(this._rawOrders || []).forEach((order: any) => {
        if (order.id === id) {
          order.ownerReply = reply
          order.ownerReplyAt = ownerReplyAt
        }
      })
      wx.showToast({ title: '回好啦，她看得到', icon: 'none' })
    } catch (err: any) {
      const message = String((err && err.message) || '回复失败')
      wx.showToast({ title: message.slice(0, 40), icon: 'none' })
      if (message.indexOf('评价刚刚更新') > -1) {
        await this.load()
      }
    } finally {
      this.setData({ replyingId: '' })
    }
  },

  onViewRecipe(e: any) {
    const id = e.currentTarget.dataset.id
    if (id) {
      wx.navigateTo({ url: '/pages/recipe/index?id=' + id })
    }
  },

  onAddDish() {
    wx.navigateTo({ url: '/pages/dish-edit/index' })
  },

  onCategories() {
    wx.navigateTo({ url: '/pages/category-manage/index' })
  },

  onTemplates() {
    wx.navigateTo({ url: '/pages/dish-templates/index' })
  },

  onBusiness() {
    wx.navigateTo({ url: '/pages/business/index' })
  },

  onMenu() {
    wx.navigateTo({ url: '/pages/menu-edit/index' })
  },

  onWeekMenus() {
    wx.navigateTo({ url: '/pages/week-menus/index' })
  },

  onReport() {
    wx.navigateTo({ url: '/pages/report/index' })
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
