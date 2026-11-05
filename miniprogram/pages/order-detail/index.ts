import type { Dish, Order, OrderStatus } from '../../services/types'
import { getOrder, cancelOrder, getDishes } from '../../services/api'
import { cart } from '../../store/cart'
import { STATUS_STEP_TEXT, STATUS_TEXT, mealName } from '../../utils/constants'
import {
  formatDate,
  formatTime,
  dateLabel,
  dateInputString
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
    orderError: '',
    loading: true,
    reordering: false
  },

  orderId: '',

  onLoad(options: any) {
    this.orderId = options.id || ''
    this.load()
  },

  onShow() {
    if (this.orderId) {
      this.load()
    }
  },

  async load() {
    this.setData({ orderError: '' })
    try {
      const order = await getOrder(this.orderId)
      if (!order) {
        throw new Error('订单不存在')
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
          scheduledText: dateLabel(
            order.scheduledDate || dateInputString(new Date(order.createdAt))
          ),
          mealText: mealName(order.meal),
          createdText: `${formatDate(order.createdAt)} ${formatTime(
            order.createdAt
          )}`,
          items: order.items.map((item, index) => ({
            ...item,
            key: `${index}-${item.dishId}`,
            lineTotal: item.price * item.qty,
            specText: item.specs.join(' / ')
          }))
        },
        steps: this.buildSteps(order),
        statusText: STATUS_TEXT[order.status],
        loading: false
      })
    } catch (e: any) {
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
        if (dishes && (!dish || dish.status === 'off')) {
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
          dishId: item.dishId,
          name: dish ? dish.name : item.name,
          price: dish ? dish.price : item.price,
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

  async onSubscribeReady() {
    if (!TEMPLATE_ORDER_STATUS) {
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
      content: '还没接单，可以取消。取消后要重新点哦。',
      confirmText: '取消订单',
      cancelText: '再想想'
    })
    if (!res.confirm) {
      return
    }
    try {
      await cancelOrder(order.id)
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
  }
})
