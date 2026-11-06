import type { OrderStatus } from '../../services/types'
import {
  acceptPendingOrders,
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
  MEALS,
  NEXT_ACTION,
  NEXT_STATUS,
  STATUS_TEXT,
  mealName
} from '../../utils/constants'
import { formatTime, itemSummary, dateLabel, dateInputString, formatDate } from '../../utils/format'
import { orderReceiptLines, receiptText } from '../../utils/receipt'
import { TEMPLATE_NEW_ORDER } from '../../config'

const REPLY_PHRASES = [
  '谢谢喜欢，下次多加点',
  '收到，下次注意',
  '抱歉翻车了，下次补偿'
]

Page({
  data: {
    orders: [] as any[],
    ordersView: [] as any[],
    orderKeyword: '',
    orderMeal: 'all' as 'all' | 'breakfast' | 'lunch' | 'dinner',
    mealOptions: MEALS,
    preorders: [] as any[],
    history: [] as any[],
    dishes: [] as any[],
    stats: null as any,
    loading: true,
    forbidden: false,
    error: '',
    busyId: '',
    busyDishId: '',
    acceptingAll: false,
    pendingCount: 0,
    replyingId: '',
    restockingId: '',
    restockingAll: false,
    batchBusy: false,
    historyOnlyPending: false,
    historyView: [] as any[],
    historyAll: false,
    receiptVisible: false,
    receipt: null as any,
    receiptLines: [] as any[],
    copyingReceipts: false,
    movingId: '',
    showHistory: false,
    showPrep: false,
    showPreorders: false,
    prepItems: [] as any[],
    prepGroups: [] as any[],
    prepTotal: 0,
    weekStats: null as any,
    weekBars: [] as any[],
    weekBarTotal: 0,
    todo: { pending: 0, replies: 0, lowStock: 0, preorders: 0 },
    dishKeyword: '',
    dishFilter: 'all' as 'all' | 'low' | 'soldout' | 'off' | 'missing',
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
      const activeAll = orders.filter(
        order =>
          order.status !== 'completed' && order.status !== 'cancelled'
      )
      const todayKey = dateInputString()
      const effectiveDate = (order: any) =>
        order.scheduledDate || dateInputString(new Date(order.createdAt))
      const sortActive = (a: any, b: any) => {
        const rankA =
          STATUS_RANK[a.status] === undefined ? 9 : STATUS_RANK[a.status]
        const rankB =
          STATUS_RANK[b.status] === undefined ? 9 : STATUS_RANK[b.status]
        if (rankA !== rankB) {
          return rankA - rankB
        }
        return Number(a.createdAt || 0) - Number(b.createdAt || 0)
      }
      // 待处理只放今天（含逾期），未来预订单独展示，避免占满今日待办
      const active = activeAll
        .filter(order => effectiveDate(order) <= todayKey)
        .sort(sortActive)
      const preorderOrders = activeAll
        .filter(order => effectiveDate(order) > todayKey)
        .sort(
          (a, b) =>
            effectiveDate(a).localeCompare(effectiveDate(b)) ||
            Number(a.createdAt || 0) - Number(b.createdAt || 0)
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
          ratingTags: Array.isArray(order.ratingTags)
            ? order.ratingTags.slice(0, 4)
            : [],
          ratingImages: Array.isArray(order.ratingImages)
            ? order.ratingImages.slice(0, 3)
            : [],
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
      const preorders = preorderOrders.map(toView)
      const history = silent
        ? this.data.history
        : orders
            .filter(
              order =>
                order.status === 'completed' || order.status === 'cancelled'
            )
            .map(toView)

      // 今日备菜：把今天所有未完成订单按餐次、菜名汇总
      const prepMap: Record<string, number> = {}
      const prepMealMap: Record<string, Record<string, number>> = {
        breakfast: {},
        lunch: {},
        dinner: {}
      }
      active
        .filter(
          order =>
            (order.scheduledDate ||
              dateInputString(new Date(order.createdAt))) === todayKey
        )
        .forEach(order => {
          const bucket =
            prepMealMap[order.meal] || prepMealMap.lunch
          order.items.forEach((item: any) => {
            const name = String(item.name || '')
            if (name) {
              prepMap[name] = (prepMap[name] || 0) + Number(item.qty || 0)
              bucket[name] = (bucket[name] || 0) + Number(item.qty || 0)
            }
          })
        })
      const prepItems = Object.keys(prepMap)
        .map(name => ({ name, qty: prepMap[name] }))
        .sort((a, b) => b.qty - a.qty)
      const prepGroups = MEALS.map(meal => {
        const items = Object.keys(prepMealMap[meal.id] || {})
          .map(name => ({
            name,
            qty: prepMealMap[meal.id][name]
          }))
          .sort((a, b) => b.qty - a.qty)
        return {
          meal: meal.id,
          mealText: mealName(meal.id),
          items,
          total: items.reduce((sum, item) => sum + item.qty, 0)
        }
      }).filter(group => group.items.length)
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
        ? {
            ...this.data.todo,
            pending: active.length,
            preorders: preorderOrders.length
          }
        : {
            pending: active.length,
            preorders: preorderOrders.length,
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
        ordersView: this.filterOrders(view),
        preorders,
        pendingCount: active.filter(order => order.status === 'pending').length,
        history,
        historyView: this.filterHistory(history),
        dishes,
        stats,
        prepItems,
        prepGroups,
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

  async onAcceptAll() {
    if (this.data.acceptingAll || !this.data.pendingCount) {
      return
    }
    const res: any = await wx.showModal({
      title: '全部接单？',
      content: `把今天 ${this.data.pendingCount} 单待接单标记为已接单`,
      confirmText: '接单',
      cancelText: '算了'
    })
    if (!res.confirm) {
      return
    }
    this.setData({ acceptingAll: true })
    try {
      const result = await acceptPendingOrders()
      wx.showToast({
        title: result.done ? `已接 ${result.done} 单` : '没有可接的单',
        icon: 'none'
      })
      await this.load()
    } catch (err: any) {
      wx.showToast({
        title: String((err && err.message) || '接单失败').slice(0, 40),
        icon: 'none'
      })
    } finally {
      this.setData({ acceptingAll: false })
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
      editable: true,
      content: '',
      placeholderText: '为什么拒单？她能看见（选填）',
      confirmText: '拒单',
      cancelText: '算了'
    })
    if (!res.confirm) {
      return
    }
    const reason = String(res.content || '')
      .trim()
      .slice(0, 50)
    this.setData({ busyId: id })
    try {
      await updateOrderStatus(id, 'cancelled', reason)
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
      const updated = await saveDish({
        ...dish,
        stock: nextStock,
        stockBase: dish.stock
      } as any)
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
          stock: Number(dish.stock) + 5,
          stockBase: dish.stock
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

  async onBatchStatus() {
    if (this.data.batchBusy) {
      return
    }
    const list = this.data.displayDishes || []
    if (!list.length) {
      wx.showToast({ title: '当前筛选没有菜品', icon: 'none' })
      return
    }
    let tapIndex = -1
    try {
      const sheet: any = await wx.showActionSheet({
        itemList: [
          `上架当前 ${list.length} 道`,
          `下架当前 ${list.length} 道`
        ]
      })
      tapIndex = Number(sheet.tapIndex)
    } catch (e) {
      return
    }
    const status: 'on' | 'off' = tapIndex === 0 ? 'on' : 'off'
    const action = status === 'on' ? '上架' : '下架'
    const confirm: any = await wx.showModal({
      title: `${action}当前 ${list.length} 道菜？`,
      content:
        status === 'off'
          ? '下架后顾客首页看不到这些菜，可以随时再上架。'
          : '上架后顾客首页会重新显示这些菜。',
      confirmText: action,
      cancelText: '算了'
    })
    if (!confirm.confirm) {
      return
    }
    this.setData({ batchBusy: true })
    const statusMap: Record<string, string> = {}
    let done = 0
    let failed = 0
    for (const dish of list) {
      if (dish.status === status) {
        continue
      }
      try {
        const saved = await saveDish({
          ...dish,
          status,
          stockBase: dish.stock
        } as any)
        statusMap[dish.id] =
          saved && saved.status ? saved.status : status
        done++
      } catch (e) {
        failed++
      }
    }
    const dishes = this.data.dishes.map(dish =>
      statusMap[dish.id]
        ? { ...dish, status: statusMap[dish.id] }
        : dish
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
        todo: { ...this.data.todo, lowStock },
        batchBusy: false
      },
      () => this.applyDishFilter()
    )
    wx.showToast({
      title: done
        ? `${action} ${done} 道${failed ? `，${failed} 道失败` : ''}`
        : '当前筛选已经是这个状态',
      icon: 'none'
    })
  },

  onLoad(options: any) {
    const filter = String((options && options.filter) || '')
    if (['low', 'soldout', 'off', 'missing'].indexOf(filter) > -1) {
      this.setData({ dishFilter: filter })
    }
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
      if (filter === 'missing') {
        return !dish.recipe
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
        },
        {
          key: 'missing',
          label: '缺做法',
          count: dishes.filter(dish => !dish.recipe).length
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

  filterOrders(list: any[]): any[] {
    const keyword = String(this.data.orderKeyword || '')
      .trim()
      .toLowerCase()
    const meal = this.data.orderMeal
    return list
      .filter(order => meal === 'all' || order.meal === meal)
      .filter(order => {
        if (!keyword) {
          return true
        }
        const text = [
          order.no,
          order.summary,
          order.note,
          order.address,
          order.mode,
          (order.items || []).map((item: any) => item.name).join(' ')
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        return text.indexOf(keyword) > -1
      })
  },

  onOrderSearch(e: any) {
    this.setData(
      { orderKeyword: String(e.detail.value || '').slice(0, 20) },
      () => {
        this.setData({ ordersView: this.filterOrders(this.data.orders) })
      }
    )
  },

  onOrderMeal(e: any) {
    const meal = e.currentTarget.dataset.meal || 'all'
    if (meal === this.data.orderMeal) {
      return
    }
    this.setData({ orderMeal: meal }, () => {
      this.setData({ ordersView: this.filterOrders(this.data.orders) })
    })
  },

  onClearOrderSearch() {
    this.setData(
      { orderKeyword: '' },
      () => {
        this.setData({ ordersView: this.filterOrders(this.data.orders) })
      }
    )
  },

  onToggleHistory() {
    this.setData({ showHistory: !this.data.showHistory }, () =>
      this.applyHistoryFilter()
    )
  },

  onToggleHistoryAll() {
    this.setData({ historyAll: !this.data.historyAll }, () =>
      this.applyHistoryFilter()
    )
  },

  filterHistory(list: any[]): any[] {
    const filtered = this.data.historyOnlyPending
      ? list.filter(order => order.canReply && !order.ownerReply)
      : list
    return filtered.slice(0, this.data.historyAll ? 100 : 10)
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
    if (target === 'preorders') {
      this.setData({ showPreorders: true }, () => {
        wx.pageScrollTo({ selector: '#preorder-section', duration: 300 })
      })
      return
    }
    const selector =
      target === 'stock' ? '#menu-section' : '#orders-section'
    wx.pageScrollTo({ selector, duration: 300 })
  },

  onTogglePrep() {
    this.setData({ showPrep: !this.data.showPrep })
  },

  onTogglePreorders() {
    this.setData({ showPreorders: !this.data.showPreorders })
  },

  onCopyTodaySummary() {
    const stats = this.data.stats || {}
    const lines = ['【张饱饭堂】今日小结']
    lines.push(
      `订单 ${Number(stats.orderCount || 0)} 单 · 营收 ¥${Number(
        stats.revenue || 0
      )}`
    )
    lines.push(
      `已完成 ${Number(stats.completed || 0)} 单 · 待处理 ${Number(
        this.data.pendingCount || 0
      )} 单`
    )
    if (stats.topDish) {
      lines.push(`最受欢迎：${stats.topDish} ×${Number(stats.topQty || 0)}`)
    }
    if (stats.ratedCount) {
      lines.push(
        `评价 ${Number(stats.ratedCount)} 条 · 平均 ${Number(
          stats.avgRating || 0
        )} 分`
      )
    }
    wx.setClipboardData({
      data: lines.join('\n'),
      success: () => {
        wx.showToast({ title: '今日小结已复制', icon: 'none' })
      }
    })
  },

  onCopyPrep() {    const items = this.data.prepItems || []
    if (!items.length) {
      wx.showToast({ title: '今天还没有要备的菜', icon: 'none' })
      return
    }
    const text = [
      '【张饱饭堂】今日采购清单',
      `共 ${this.data.prepTotal} 份`,
      ...items.map((item: any) => `${item.name} × ${item.qty}`)
    ].join('\n')
    wx.setClipboardData({ data: text })
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

  onOpenReceipt(e: any) {
    const id = e.currentTarget.dataset.id
    if (!id) {
      return
    }
    const order = (this.data.orders || [])
      .concat(this.data.history || [])
      .find((item: any) => item.id === id)
    if (!order) {
      return
    }
    const receiptLines = orderReceiptLines(order)
    this.setData({
      receiptVisible: true,
      receipt: order,
      receiptLines
    })
  },

  onCloseReceipt() {
    this.setData({ receiptVisible: false })
  },

  onNoopReceipt() {
    // 点小票内容不关闭，避免复制时误触
  },

  onCopyReceipt() {
    const order = this.data.receipt
    if (!order) {
      return
    }
    wx.setClipboardData({
      data: receiptText(order, this.data.receiptLines || []),
      success: () => {
        wx.showToast({ title: '小票已复制', icon: 'none' })
      }
    })
  },

  onCopyActiveReceipts() {
    if (this.data.copyingReceipts) {
      return
    }
    const orders = (this.data.ordersView || []).slice(0, 20)
    if (!orders.length) {
      wx.showToast({ title: '今天还没有待处理的单', icon: 'none' })
      return
    }
    this.setData({ copyingReceipts: true })
    const text = orders
      .map((order: any) => receiptText(order, orderReceiptLines(order)))
      .join('\n\n---\n\n')
    wx.setClipboardData({
      data: text,
      success: () => {
        wx.showToast({ title: `已复制 ${orders.length} 张小票`, icon: 'none' })
      },
      fail: () => {
        wx.showToast({ title: '复制失败，再试一次', icon: 'none' })
      },
      complete: () => {
        this.setData({ copyingReceipts: false })
      }
    })
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
    let draft = item.ownerReply || ''
    if (!draft) {
      try {
        const sheet: any = await wx.showActionSheet({
          itemList: REPLY_PHRASES.concat('自己写')
        })
        const index = Number(sheet.tapIndex)
        if (index >= 0 && index < REPLY_PHRASES.length) {
          draft = REPLY_PHRASES[index]
        }
      } catch (err) {
        this._replyModalOpen = false
        return
      }
    }
    let modal: any
    try {
      modal = await wx.showModal({
        title: '回复这条评价',
        editable: true,
        content: draft,
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
