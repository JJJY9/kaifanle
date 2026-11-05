import type { Order, OrderStatus } from '../../services/types'
import { getOrder } from '../../services/api'
import { cart } from '../../store/cart'
import { STATUS_STEP_TEXT, STATUS_TEXT, mealName } from '../../utils/constants'
import { formatDate, formatTime } from '../../utils/format'

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
    loading: true
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
    const order = await getOrder(this.orderId)
    if (!order) {
      this.setData({ loading: false })
      wx.showToast({ title: '订单不存在', icon: 'none' })
      return
    }

    this.setData({
      order: {
        ...order,
        mealText: mealName(order.meal),
        createdText: `${formatDate(order.createdAt)} ${formatTime(
          order.createdAt
        )}`,
        items: order.items.map(item => ({
          ...item,
          lineTotal: item.price * item.qty,
          specText: item.specs.join(' / ')
        }))
      },
      steps: this.buildSteps(order),
      statusText: STATUS_TEXT[order.status],
      loading: false
    })
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

  onReorder() {
    const order = this.data.order
    if (!order) {
      return
    }
    order.items.forEach((item: any) => {
      cart.add({
        key: '',
        dishId: item.dishId,
        name: item.name,
        price: item.price,
        qty: item.qty,
        specs: item.specs,
        note: item.note,
        color: '#FFD23F'
      })
    })
    wx.switchTab({ url: '/pages/home/index' })
    wx.showToast({ title: '已放回购物车', icon: 'none' })
  },

  onBackHome() {
    wx.switchTab({ url: '/pages/home/index' })
  }
})
