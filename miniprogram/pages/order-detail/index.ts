import type { Dish, Order, OrderStatus } from '../../services/types'
import { getOrder, cancelOrder, getDishes, getKitchenStatus, urgeOrder, rateOrder } from '../../services/api'
import { cart } from '../../store/cart'
import { STATUS_STEP_TEXT, STATUS_TEXT, mealName } from '../../utils/constants'
import {
  formatDate,
  formatTime,
  dateLabel,
  dateInputString,
  itemSummary
} from '../../utils/format'
import { TEMPLATE_ORDER_STATUS } from '../../config'

const FLOW: OrderStatus[] = [
  'pending',
  'accepted',
  'cooking',
  'ready',
  'completed'
]

Page({
  data: {
    order: null as any,
    steps: [] as any[],
    statusText: '',
    queueText: '',
    orderError: '',
    loading: true,
    reordering: false,
    rating: 0,
    feedbackDraft: '',
    submittingRating: false,
    ratingOptions: [
      { value: 3, emoji: '😋', label: '好吃' },
      { value: 2, emoji: '🙂', label: '一般' },
      { value: 1, emoji: '😵', label: '翻车' }
    ]
  },

  orderId: '',

  _pollTimer: null as any,
  _loadSeq: 0,

  onLoad(options: any) {
    this.orderId = options.id || ''
    this.load()
  },

  onShow() {
    if (this.orderId) {
      this.load()
      this.startPoll()
    }
  },

  onHide() {
    this.stopPoll()
  },

  onUnload() {
    this.stopPoll()
  },

  // 订单还在进行中时每 20 秒刷新一次，出锅/完成能及时看到
  startPoll() {
    this.stopPoll()
    this._pollTimer = setInterval(() => {
      const order = this.data.order
      if (
        order &&
        order.status !== 'completed' &&
        order.status !== 'cancelled'
      ) {
        this.load(true)
      } else {
        this.stopPoll()
      }
    }, 20000)
  },

  stopPoll() {
    if (this._pollTimer) {
      clearInterval(this._pollTimer)
      this._pollTimer = null
    }
  },

  async load(silent = false) {
    const seq = ++this._loadSeq
    if (!silent) {
      this.setData({ orderError: '' })
    }
    try {
      const order = await getOrder(this.orderId)
      if (seq !== this._loadSeq) {
        return
      }
      if (!order) {
        throw new Error('订单不存在')
      }
      let queueText = ''
      if (
        !silent &&
        ['pending', 'accepted', 'cooking'].indexOf(order.status) > -1
      ) {
        const kitchenStatus = await getKitchenStatus().catch(() => null)
        if (seq !== this._loadSeq) {
          return
        }
        if (kitchenStatus) {
          const ahead = Math.max(0, Number(kitchenStatus.active || 0) - 1)
          queueText = ahead > 0 ? `厨房前面还有 ${ahead} 单` : '马上轮到你'
        }
      }
      const profile = order.profile
      const profileText =
        profile && (profile.dislikes.length || profile.tastes.length)
          ? [
              profile.dislikes.length
                ? `忌口：${profile.dislikes.join('、')}`
                : '',
              profile.tastes.length
                ? `口味：${profile.tastes.join('、')}`
                : ''
            ]
              .filter(Boolean)
              .join(' · ')
          : ''

      this.setData({
        order: {
          ...order,
          profileText,
          urgeCooling: Boolean(
            order.urgedAt && Date.now() - order.urgedAt < 5 * 60 * 1000
          ),
          scheduledText: dateLabel(
            order.scheduledDate || dateInputString(new Date(order.createdAt))
          ),
          mealText: mealName(order.meal),
          createdText: `${formatDate(order.createdAt)} ${formatTime(
            order.createdAt
          )}`,
          ownerReplyText: order.ownerReplyAt
            ? `${formatDate(order.ownerReplyAt)} ${formatTime(
                order.ownerReplyAt
              )}`
            : '',
          items: order.items.map((item, index) => ({
            ...item,
            key: `${index}-${item.dishId}`,
            lineTotal: item.price * item.qty,
            specText: item.specs.join(' / ')
          }))
        },
        steps: this.buildSteps(order),
        statusText: STATUS_TEXT[order.status],
        queueText,
        rating: Number(order.rating || 0),
        feedbackDraft: order.feedback || '',
        loading: false
      })
    } catch (e: any) {
      if (silent || seq !== this._loadSeq) {
        return
      }
      this.setData({
        loading: false,
        orderError: String(
          (e && (e.message || e.errMsg)) || '订单加载失败'
        ).slice(0, 40)
      })
    }
  },

  onRetry() {
    this.setData({ loading: true })
    this.load()
  },

  onPullDownRefresh() {
    this.load().then(() => wx.stopPullDownRefresh())
  },

  buildSteps(order: Order) {
    if (order.status === 'cancelled') {
      const last = order.timeline[order.timeline.length - 1]
      return [
        {
          status: 'pending',
          title: '已下单',
          time: formatTime(order.createdAt),
          done: true
        },
        {
          status: 'cancelled',
          title: '已取消',
          time: last ? formatTime(last.time) : '',
          done: true
        }
      ]
    }

    const currentIndex = FLOW.indexOf(order.status)
    return FLOW.map((status, index) => {
      const entry = order.timeline.find(item => item.status === status)
      return {
        status,
        title: STATUS_STEP_TEXT[status],
        time: entry ? formatTime(entry.time) : '',
        done: index <= currentIndex
      }
    })
  },

  async onReorder() {
    const order = this.data.order
    if (!order || this.data.reordering) {
      return
    }
    const app: any = getApp()
    if (app && app.globalData) {
      app.globalData.pendingReorder = null
    }
    this.setData({ reordering: true })
    try {
      // 用当前菜价和供应状态重新加购，下架/售罄的菜跳过
      let dishes: Dish[] | null = null
      try {
        dishes = await getDishes()
      } catch (e) {
        dishes = null
      }
      const dishMap: Record<string, Dish> = {}
      if (dishes) {
        dishes.forEach(dish => {
          dishMap[dish.id] = dish
        })
      }
      let added = 0
      let skipped = 0
      order.items.forEach((item: any) => {
        const dish = dishes ? dishMap[item.dishId] : null
        if (
          dishes &&
          (!dish ||
            dish.status !== 'on' ||
            (dish.meals || []).indexOf(order.meal) === -1)
        ) {
          skipped++
          return
        }
        let qty = item.qty
        if (dish && typeof dish.stock === 'number' && dish.stock >= 0) {
          qty = Math.min(qty, dish.stock)
        }
        if (qty <= 0) {
          skipped++
          return
        }
        cart.add({
          key: '',
          meal: order.meal,
          dishId: item.dishId,
          name: dish ? dish.name : item.name,
          price: dish
            ? dish.price +
              (dish.addons || [])
                .filter(addon => item.specs.indexOf(addon.name) > -1)
                .reduce((sum, addon) => sum + addon.price, 0)
            : item.price,
          qty,
          specs: item.specs,
          note: item.note,
          color: dish ? dish.color : '#FFD23F'
        })
        added++
      })
      if (!added) {
        wx.showToast({
          title: skipped ? '这些菜暂时都不供应了' : '加购失败，稍后再试',
          icon: 'none'
        })
        return
      }
      const app: any = getApp()
      if (app && app.globalData) {
        const today = dateInputString()
        const max = new Date()
        max.setDate(max.getDate() + 7)
        const maxDate = dateInputString(max)
        const date = order.scheduledDate || ''
        app.globalData.pendingReorder = {
          meal: order.meal,
          date: date && date >= today && date <= maxDate ? date : ''
        }
      }
      wx.switchTab({ url: '/pages/home/index' })
      setTimeout(() => {
        wx.showToast({
          title: skipped
            ? `已加购，${skipped} 道暂时没供应`
            : '已放回购物车',
          icon: 'none'
        })
      }, 300)
    } finally {
      this.setData({ reordering: false })
    }
  },

  onRate(e: any) {
    this.setData({ rating: Number(e.currentTarget.dataset.value) })
  },

  onFeedback(e: any) {
    this.setData({ feedbackDraft: e.detail.value })
  },

  async onSubmitRating() {
    const order = this.data.order
    if (!order || this.data.submittingRating) {
      return
    }
    if (!this.data.rating) {
      wx.showToast({ title: '先选一个评价吧', icon: 'none' })
      return
    }
    this.setData({ submittingRating: true })
    try {
      await rateOrder(order.id, this.data.rating, this.data.feedbackDraft)
      wx.showToast({ title: '评价收到啦', icon: 'none' })
      this.load()
    } catch (e: any) {
      wx.showToast({
        title: String((e && e.message) || '评价失败').slice(0, 40),
        icon: 'none'
      })
    } finally {
      this.setData({ submittingRating: false })
    }
  },

  async onUrge() {
    const order = this.data.order
    if (!order || order.urgeCooling) {
      return
    }
    try {
      await urgeOrder(order.id)
      wx.showToast({ title: '帮你催啦，掌勺人马上看', icon: 'none' })
      this.load()
    } catch (e: any) {
      wx.showToast({
        title: String((e && e.message) || '催单失败').slice(0, 40),
        icon: 'none'
      })
    }
  },

  async onSubscribeReady() {    if (!TEMPLATE_ORDER_STATUS) {
      wx.showToast({ title: '还没配置提醒模板', icon: 'none' })
      return
    }
    try {
      const res: any = await wx.requestSubscribeMessage({
        tmplIds: [TEMPLATE_ORDER_STATUS]
      })
      const accepted = res[TEMPLATE_ORDER_STATUS] === 'accept'
      wx.showToast({
        title: accepted ? '出锅时提醒你' : '好的，不打扰',
        icon: 'none'
      })
    } catch (e) {
      wx.showToast({ title: '订阅失败，稍后再试', icon: 'none' })
    }
  },

  async onCancelOrder() {
    const order = this.data.order
    if (!order || order.status !== 'pending') {
      return
    }
    const res: any = await wx.showModal({
      title: '取消这一单？',
      editable: true,
      content: '',
      placeholderText: '为什么取消？选填，掌勺人能看到',
      confirmText: '取消订单',
      cancelText: '再想想'
    })
    if (!res.confirm) {
      return
    }
    try {
      const reason = String(res.content || '')
        .trim()
        .slice(0, 50)
      await cancelOrder(order.id, reason)
      wx.showToast({ title: '已取消', icon: 'none' })
      this.load()
    } catch (e: any) {
      wx.showToast({
        title: String((e && e.message) || '取消失败').slice(0, 40),
        icon: 'none'
      })
    }
  },

  onBackHome() {
    wx.switchTab({ url: '/pages/home/index' })
  },

  onShareAppMessage() {
    const order = this.data.order
    return {
      title: order
        ? `我在张饱饭堂点了「${itemSummary(
            order.items.map((item: any) => item.name)
          )}」`
        : '张饱饭堂 · 她点单，你掌勺',
      path: '/pages/home/index'
    }
  }
})
