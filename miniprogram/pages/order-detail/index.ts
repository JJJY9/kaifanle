import type { Dish, Order, OrderStatus } from '../../services/types'
import { getOrder, cancelOrder, getDishes, getKitchenStatus, urgeOrder, rateOrder, sendOrderMessage, updateOrderNote, updateOrderSlot } from '../../services/api'
import { addOrderToCart } from '../../utils/reorder'
import { orderReceiptLines, receiptText } from '../../utils/receipt'
import { prepareImageForUpload } from '../../utils/image'
import { saveImageToAlbum } from '../../utils/save-image'
import { USE_CLOUD } from '../../config'
import { MEALS, STATUS_STEP_TEXT, STATUS_TEXT, mealName } from '../../utils/constants'
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

const RATING_TAGS = ['好吃', '分量足', '准时', '有点辣', '下次还想吃']

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
    ratingTagOptions: RATING_TAGS.map(name => ({ name, active: false })),
    ratingImages: [] as string[],
    uploadingRatingImage: false,
    meals: MEALS,
    slotEditVisible: false,
    slotMeal: 'lunch',
    slotDate: '',
    slotDateText: '',
    todayDate: '',
    maxDate: '',
    slotSaving: false,
    messageDraft: '',
    messages: [] as any[],
    messageAnchor: '',
    posterMaking: false,
    posterPath: '',
    messagePresets: ['少放辣', '多放饭', '快好了吗', '谢谢啦'],
    sendingMessage: false,
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
    const today = dateInputString()
    const max = new Date()
    max.setDate(max.getDate() + 7)
    this.setData({
      todayDate: today,
      maxDate: dateInputString(max),
      slotDate: today,
      slotDateText: '今天'
    })
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
      let queueText = silent ? this.data.queueText : ''
      if (
        ['pending', 'accepted', 'cooking'].indexOf(order.status) === -1
      ) {
        queueText = ''
      } else if (!silent) {
        const today = dateInputString()
        const orderDate =
          order.scheduledDate || dateInputString(new Date(order.createdAt))
        if (orderDate !== today) {
          queueText = ''
        } else {
          const kitchenStatus = await getKitchenStatus().catch(() => null)
          if (seq !== this._loadSeq) {
            return
          }
          if (kitchenStatus) {
            const ahead = Math.max(0, Number(kitchenStatus.active || 0) - 1)
            const minutes = Math.floor(
              (Date.now() - Number(order.createdAt || 0)) / 60000
            )
            const wait = minutes >= 5 ? ` · 已等 ${minutes} 分钟` : ''
            queueText =
              (ahead > 0 ? `厨房前面还有 ${ahead} 单` : '马上轮到你') + wait
          }
        }
      }
      const messages = (order.messages || [])
        .slice()
        .sort((a, b) => Number(a.at || 0) - Number(b.at || 0))
        .map((message, index) => ({
          ...message,
          key: message.id || `${index}-${message.at}`,
          roleText: message.role === 'admin' ? '掌勺人' : '她',
          timeText: `${formatDate(message.at)} ${formatTime(message.at)}`
        }))
      const messageAnchor = messages.length
        ? `msg-${messages.length - 1}`
        : ''
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
        messages,
        messageAnchor,
        statusText: STATUS_TEXT[order.status],
        queueText,
        rating: Number(order.rating || 0),
        feedbackDraft: order.feedback || '',
        ratingTagOptions: RATING_TAGS.map(name => ({
          name,
          active: (order.ratingTags || []).indexOf(name) > -1
        })),
        ratingImages: Array.isArray(order.ratingImages)
          ? order.ratingImages.slice(0, 3)
          : [],
        ...(this.data.slotEditVisible
          ? {}
          : {
              slotMeal: order.meal,
              slotDate:
                order.scheduledDate ||
                dateInputString(new Date(order.createdAt)),
              slotDateText: dateLabel(
                order.scheduledDate ||
                  dateInputString(new Date(order.createdAt))
              )
            }),
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

  onMessageInput(e: any) {
    this.setData({ messageDraft: String(e.detail.value || '') })
  },

  onMessagePreset(e: any) {
    const text = String((e.currentTarget && e.currentTarget.dataset.text) || '')
    if (text) {
      this.setData({ messageDraft: text })
    }
  },

  onCopyMessage(e: any) {
    const content = String(
      (e.currentTarget && e.currentTarget.dataset.content) || ''
    )
    if (!content) {
      return
    }
    wx.setClipboardData({
      data: content,
      success: () => {
        wx.showToast({ title: '留言已复制', icon: 'none' })
      }
    })
  },

  async onSendMessage() {
    if (this.data.sendingMessage) {
      return
    }
    const content = String(this.data.messageDraft || '').trim()
    if (!content) {
      wx.showToast({ title: '说点什么吧', icon: 'none' })
      return
    }
    this.setData({ sendingMessage: true })
    try {
      const message = await sendOrderMessage(this.orderId, content)
      const view = {
        ...message,
        key: message.id,
        roleText: message.role === 'admin' ? '掌勺人' : '她',
        timeText: `${formatDate(message.at)} ${formatTime(message.at)}`
      }
      const nextMessages = (this.data.messages || []).concat([view])
      this.setData({
        messageDraft: '',
        messages: nextMessages,
        messageAnchor: `msg-${nextMessages.length - 1}`
      })
    } catch (e: any) {
      wx.showToast({
        title: String((e && e.message) || '发送失败').slice(0, 40),
        icon: 'none'
      })
    } finally {
      this.setData({ sendingMessage: false })
    }
  },

  onPullDownRefresh() {
    this.load().then(() => wx.stopPullDownRefresh())
  },

  buildSteps(order: Order) {
    const spanText = (from: number, to: number) => {
      if (!from || !to || to < from) {
        return ''
      }
      const minutes = Math.max(0, Math.round((to - from) / 60000))
      if (minutes < 1) {
        return '不到 1 分钟'
      }
      if (minutes >= 60) {
        const hours = Math.floor(minutes / 60)
        const rest = minutes % 60
        return rest ? `${hours} 小时 ${rest} 分钟` : `${hours} 小时`
      }
      return `${minutes} 分钟`
    }
    if (order.status === 'cancelled') {
      const last = order.timeline[order.timeline.length - 1]
      return [
        {
          status: 'pending',
          title: '已下单',
          time: formatTime(order.createdAt),
          deltaText: '',
          done: true
        },
        {
          status: 'cancelled',
          title: '已取消',
          time: last ? formatTime(last.time) : '',
          deltaText: last
            ? spanText(Number(order.createdAt), Number(last.time))
            : '',
          done: true
        }
      ]
    }

    const currentIndex = FLOW.indexOf(order.status)
    let previousAt = Number(order.createdAt) || 0
    return FLOW.map((status, index) => {
      const entry = order.timeline.find(item => item.status === status)
      const entryAt = entry ? Number(entry.time) || 0 : 0
      const deltaText =
        entry && index > 0 ? spanText(previousAt, entryAt) : ''
      if (entryAt) {
        previousAt = entryAt
      }
      return {
        status,
        title: STATUS_STEP_TEXT[status],
        time: entry ? formatTime(entry.time) : '',
        deltaText,
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
    const today = dateInputString()
    const targetDate =
      order.scheduledDate && order.scheduledDate >= today
        ? order.scheduledDate
        : today
    try {
      // 用当前菜价和供应状态重新加购，下架/售罄的菜跳过
      let dishes: Dish[] | null = null
      try {
        dishes = await getDishes()
      } catch (e) {
        dishes = null
      }
      const { added, skipped } = addOrderToCart(order, targetDate, dishes)
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

  onToggleRatingTag(e: any) {
    const index = Number(e.currentTarget.dataset.index)
    const options = this.data.ratingTagOptions.map((item, i) =>
      i === index ? { ...item, active: !item.active } : item
    )
    const activeCount = options.filter(item => item.active).length
    if (activeCount > 4) {
      wx.showToast({ title: '最多选 4 个标签', icon: 'none' })
      return
    }
    this.setData({ ratingTagOptions: options })
  },

  async onAddRatingImage() {
    if (
      this.data.uploadingRatingImage ||
      (this.data.ratingImages || []).length >= 3
    ) {
      return
    }
    let tempFilePath = ''
    try {
      const res: any = await wx.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sizeType: ['compressed'],
        sourceType: ['album', 'camera']
      })
      tempFilePath =
        res.tempFiles && res.tempFiles[0] ? res.tempFiles[0].tempFilePath : ''
    } catch (e) {
      return
    }
    if (!tempFilePath) {
      return
    }
    this.setData({ uploadingRatingImage: true })
    try {
      tempFilePath = await prepareImageForUpload(tempFilePath)
      let src = tempFilePath
      if (USE_CLOUD && wx.cloud) {
        const match = tempFilePath.match(/\.(\w+)$/)
        const ext = match ? match[1] : 'jpg'
        const upload: any = await wx.cloud.uploadFile({
          cloudPath: `reviews/${this.orderId}-${Date.now()}.${ext}`,
          filePath: tempFilePath
        })
        src = upload.fileID
      }
      this.setData({
        ratingImages: (this.data.ratingImages || [])
          .concat(src)
          .slice(0, 3)
      })
    } catch (e) {
      wx.showToast({ title: '图片上传失败', icon: 'none' })
    } finally {
      this.setData({ uploadingRatingImage: false })
    }
  },

  onRemoveRatingImage(e: any) {
    const index = Number(e.currentTarget.dataset.index)
    const images = (this.data.ratingImages || []).slice()
    images.splice(index, 1)
    this.setData({ ratingImages: images })
  },

  onPreviewRatingImage(e: any) {
    const src = String(e.currentTarget.dataset.src || '')
    const urls = this.data.ratingImages || []
    if (!src || !urls.length) {
      return
    }
    wx.previewImage({ current: src, urls })
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
      const tags = (this.data.ratingTagOptions || [])
        .filter((item: any) => item.active)
        .map((item: any) => item.name)
      await rateOrder(
        order.id,
        this.data.rating,
        this.data.feedbackDraft,
        tags,
        this.data.ratingImages || []
      )
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

  onToggleSlotEdit() {
    const order = this.data.order
    if (!order || order.status !== 'pending') {
      return
    }
    if (this.data.slotEditVisible) {
      this.setData({ slotEditVisible: false })
      return
    }
    const date =
      order.scheduledDate || dateInputString(new Date(order.createdAt))
    this.setData({
      slotEditVisible: true,
      slotMeal: order.meal,
      slotDate: date,
      slotDateText: dateLabel(date)
    })
  },

  onSelectSlotMeal(e: any) {
    this.setData({ slotMeal: e.currentTarget.dataset.meal })
  },

  onSlotDateChange(e: any) {
    const date = e.detail.value
    this.setData({
      slotDate: date,
      slotDateText: dateLabel(date)
    })
  },

  async onSaveSlot() {
    const order = this.data.order
    if (!order || this.data.slotSaving) {
      return
    }
    if (
      this.data.slotMeal === order.meal &&
      this.data.slotDate ===
        (order.scheduledDate || dateInputString(new Date(order.createdAt)))
    ) {
      this.setData({ slotEditVisible: false })
      return
    }
    this.setData({ slotSaving: true })
    try {
      const updated = await updateOrderSlot(
        order.id,
        this.data.slotMeal,
        this.data.slotDate
      )
      if (!updated) {
        throw new Error('订单不存在')
      }
      this.setData({
        'order.meal': updated.meal,
        'order.mealText': mealName(updated.meal),
        'order.scheduledDate': updated.scheduledDate,
        'order.scheduledText': dateLabel(updated.scheduledDate || ''),
        'order.expectedTime': updated.expectedTime || this.data.order.expectedTime,
        slotEditVisible: false,
        slotMeal: updated.meal,
        slotDate: updated.scheduledDate || this.data.slotDate,
        slotDateText: dateLabel(updated.scheduledDate || '')
      })
      wx.showToast({ title: '时间改好啦', icon: 'none' })
    } catch (e: any) {
      wx.showToast({
        title: String((e && e.message) || '改时间失败').slice(0, 40),
        icon: 'none'
      })
    } finally {
      this.setData({ slotSaving: false })
    }
  },

  async onEditNote() {
    const order = this.data.order
    if (
      !order ||
      ['pending', 'accepted'].indexOf(order.status) === -1
    ) {
      return
    }
    const res: any = await wx.showModal({
      title: '整单备注',
      editable: true,
      content: order.note || '',
      placeholderText: '比如：少放辣、晚点送',
      confirmText: '保存',
      cancelText: '算了'
    })
    if (!res.confirm) {
      return
    }
    const note = String(res.content || '').trim().slice(0, 100)
    try {
      const updated = await updateOrderNote(order.id, note)
      if (!updated) {
        throw new Error('订单不存在')
      }
      this.setData({ 'order.note': updated.note || '' })
      wx.showToast({ title: '备注已更新', icon: 'none' })
    } catch (e: any) {
      wx.showToast({
        title: String((e && e.message) || '改备注失败').slice(0, 40),
        icon: 'none'
      })
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

  onCopyOrderNo() {
    const order = this.data.order
    if (!order || !order.no) {
      return
    }
    wx.setClipboardData({
      data: String(order.no),
      success: () => {
        wx.showToast({ title: '订单号已复制', icon: 'none' })
      }
    })
  },

  onCopyOrderReceipt() {
    const order = this.data.order
    if (!order) {
      return
    }
    const totalQty = (order.items || []).reduce(
      (sum: number, item: any) => sum + Number(item.qty || 0),
      0
    )
    const view = Object.assign({}, order, {
      dateText: order.scheduledText || '',
      mealText: order.mealText,
      totalQty
    })
    wx.setClipboardData({
      data: receiptText(view, orderReceiptLines(order)),
      success: () => {
        wx.showToast({ title: '小票已复制', icon: 'none' })
      }
    })
  },

  async onMakeOrderPoster() {
    if (this.data.posterMaking || !this.data.order) {
      return
    }
    this.setData({ posterMaking: true })
    try {
      const canvas: any = await new Promise((resolve, reject) => {
        wx.createSelectorQuery()
          .in(this)
          .select('#orderPoster')
          .fields({ node: true, size: true })
          .exec(res => {
            const node = res && res[0] && res[0].node
            if (node) {
              resolve(node)
            } else {
              reject(new Error('画布还没准备好'))
            }
          })
      })
      const order = this.data.order
      const items = (order.items || []).slice(0, 10)
      const moreCount = Math.max(0, (order.items || []).length - items.length)
      const rows = items.length + (moreCount ? 1 : 0)
      const dpr = (wx.getWindowInfo && wx.getWindowInfo().pixelRatio) || 2
      const width = 600
      const height = Math.max(780, 220 + rows * 64 + 280)
      canvas.width = width * dpr
      canvas.height = height * dpr
      const ctx = canvas.getContext('2d')
      ctx.scale(dpr, dpr)

      ctx.fillStyle = '#FFFDF6'
      ctx.fillRect(0, 0, width, height)
      ctx.strokeStyle = '#111111'
      ctx.lineWidth = 8
      ctx.strokeRect(24, 24, width - 48, height - 48)

      ctx.fillStyle = '#FF6B35'
      ctx.fillRect(24, 24, width - 48, 132)
      ctx.fillStyle = '#FFFFFF'
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      ctx.font = 'bold 38px "PingFang SC", sans-serif'
      ctx.fillText('张饱饭堂 · 小票', 48, 76)
      ctx.font = '23px "PingFang SC", sans-serif'
      ctx.fillText(
        `#${order.no || ''} · ${order.scheduledText || ''} · ${
          order.mealText || ''
        }`,
        48,
        118
      )

      ctx.fillStyle = '#5C5C5C'
      ctx.font = '20px "PingFang SC", sans-serif'
      ctx.fillText(
        `${order.mode || ''} · ${order.expectedTime || ''}`,
        48,
        188
      )
      ctx.strokeStyle = 'rgba(17,17,17,0.25)'
      ctx.lineWidth = 2
      ctx.setLineDash([6, 6])
      ctx.beginPath()
      ctx.moveTo(48, 212)
      ctx.lineTo(width - 48, 212)
      ctx.stroke()
      ctx.setLineDash([])

      const fit = (text: string, max: number) =>
        text.length > max ? text.slice(0, max) + '…' : text
      items.forEach((item: any, index: number) => {
        const y = 244 + index * 64
        ctx.textAlign = 'left'
        ctx.fillStyle = '#111111'
        ctx.font = 'bold 24px "PingFang SC", sans-serif'
        ctx.fillText(fit(String(item.name || ''), 16), 48, y)
        ctx.textAlign = 'right'
        ctx.font = 'bold 24px "PingFang SC", sans-serif'
        ctx.fillText(`¥${item.lineTotal}`, width - 48, y)
        ctx.textAlign = 'left'
        ctx.fillStyle = '#5C5C5C'
        ctx.font = '18px "PingFang SC", sans-serif'
        ctx.fillText(
          [`×${item.qty}`, item.specText || ''].filter(Boolean).join(' · '),
          48,
          y + 24
        )
      })
      if (moreCount) {
        const y = 244 + items.length * 64
        ctx.fillStyle = '#5C5C5C'
        ctx.font = '20px "PingFang SC", sans-serif'
        ctx.fillText(`还有 ${moreCount} 道菜…`, 48, y)
      }

      const totalY = 244 + rows * 64 + 22
      ctx.strokeStyle = 'rgba(17,17,17,0.25)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(48, totalY)
      ctx.lineTo(width - 48, totalY)
      ctx.stroke()
      ctx.fillStyle = '#111111'
      ctx.font = 'bold 28px "PingFang SC", sans-serif'
      ctx.fillText('合计', 48, totalY + 40)
      ctx.textAlign = 'right'
      ctx.fillStyle = '#FF6B35'
      ctx.font = 'bold 34px "PingFang SC", sans-serif'
      ctx.fillText(`¥${order.amount}`, width - 48, totalY + 40)

      let infoY = totalY + 90
      ctx.textAlign = 'left'
      ctx.fillStyle = '#5C5C5C'
      ctx.font = '20px "PingFang SC", sans-serif'
      if (order.address) {
        ctx.fillText(fit(`送到：${order.address}`, 28), 48, infoY)
        infoY += 32
      }
      if (order.note) {
        ctx.fillText(fit(`备注：${order.note}`, 28), 48, infoY)
        infoY += 32
      }

      ctx.fillStyle = '#8C8C8C'
      ctx.font = '20px "PingFang SC", sans-serif'
      ctx.fillText('她点单，你掌勺', 48, height - 52)
      ctx.textAlign = 'right'
      ctx.fillText('开饭咯', width - 48, height - 52)

      const path: string = await new Promise((resolve, reject) => {
        wx.canvasToTempFilePath({
          canvas,
          destWidth: canvas.width,
          destHeight: canvas.height,
          success: res => resolve(res.tempFilePath),
          fail: reject
        } as any)
      })
      this.setData({ posterMaking: false, posterPath: path })
      wx.showToast({ title: '小票图片已生成', icon: 'none' })
    } catch (e: any) {
      this.setData({ posterMaking: false })
      wx.showToast({
        title: String((e && e.message) || '生成失败').slice(0, 40),
        icon: 'none'
      })
    }
  },

  onPreviewOrderPoster() {
    const path = this.data.posterPath
    if (!path) {
      return
    }
    if (typeof (wx as any).showShareImageMenu === 'function') {
      ;(wx as any).showShareImageMenu({
        path,
        fail: () => {
          wx.previewImage({ urls: [path] })
        }
      })
      return
    }
    wx.previewImage({ urls: [path] })
  },

  onSaveOrderPoster() {
    const path = this.data.posterPath
    if (path) {
      saveImageToAlbum(path, '小票图片已保存')
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
