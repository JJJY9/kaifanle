import type { Order } from '../../services/types'
import { getOrders } from '../../services/api'
import { mealName } from '../../utils/constants'
import { dishEmoji } from '../../utils/dish-emoji'
import {
  dateInputString,
  dateLabel,
  formatTime,
  itemSummary
} from '../../utils/format'

const RATINGS = [
  { value: 3, emoji: '😋', label: '好吃', tone: 'good' },
  { value: 2, emoji: '🙂', label: '一般', tone: 'normal' },
  { value: 1, emoji: '😵', label: '翻车', tone: 'bad' }
]

interface ReviewView {
  id: string
  no: string
  dateText: string
  mealText: string
  meal: string
  timeText: string
  rating: number
  emoji: string
  label: string
  tone: string
  feedback: string
  tags: string[]
  images: string[]
  reply: string
  replyTime: string
  dishes: string
  amount: number
}

Page({
  data: {
    loading: true,
    error: '',
    reviews: [] as ReviewView[],
    display: [] as ReviewView[],
    filter: 'all' as 'all' | '3' | '2' | '1',
    meal: 'all' as 'all' | 'breakfast' | 'lunch' | 'dinner',
    filters: [] as any[],
    sort: 'new' as 'new' | 'rating',
    onlyImages: false,
    onlyReplied: false,
    imageCount: 0,
    replyCount: 0,
    stats: { count: 0, goodRate: 0, replies: 0 },
    emptyText: ''
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
    if (!this.data.reviews.length) {
      this.setData({ loading: true })
    }
    this.setData({ error: '' })
    try {
      const orders = await getOrders()
      if (seq !== this._loadSeq) {
        return
      }
      const reviews: ReviewView[] = orders
        .filter(
          order =>
            order.status === 'completed' &&
            [1, 2, 3].indexOf(Number(order.rating)) > -1
        )
        .sort(
          (a, b) =>
            Number(b.ratedAt || b.createdAt || 0) -
            Number(a.ratedAt || a.createdAt || 0)
        )
        .map(order => {
          const rating = RATINGS.find(
            item => item.value === Number(order.rating)
          )!
          const date =
            order.scheduledDate || dateInputString(new Date(order.createdAt))
          return {
            id: order.id,
            no: order.no,
            dateText: dateLabel(date),
            mealText: mealName(order.meal),
            meal: order.meal,
            timeText: formatTime(order.ratedAt || order.createdAt),
            rating: rating.value,
            emoji: rating.emoji,
            label: rating.label,
            tone: rating.tone,
            feedback: String(order.feedback || '').trim(),
            tags: Array.isArray(order.ratingTags)
              ? order.ratingTags.slice(0, 4)
              : [],
            images: Array.isArray(order.ratingImages)
              ? order.ratingImages.slice(0, 3)
              : [],
            reply: String(order.ownerReply || '').trim(),
            replyTime: order.ownerReplyAt
              ? formatTime(order.ownerReplyAt)
              : '',
            dishes: (() => {
              const items = order.items || []
              const shown = items
                .slice(0, 3)
                .map(item => `${dishEmoji(item.name)}${item.name}`)
                .join('、')
              if (!items.length) {
                return itemSummary([])
              }
              return items.length > 3
                ? `${shown} 等 ${items.length} 样`
                : shown
            })(),
            amount: Number(order.amount || 0)
          }
        })
      const good = reviews.filter(review => review.rating === 3).length
      const replies = reviews.filter(review => review.reply).length
      const stats = {
        count: reviews.length,
        goodRate: reviews.length
          ? Math.round((good / reviews.length) * 100)
          : 0,
        replies
      }
      const filters = [
        { key: 'all', label: '全部', count: reviews.length },
        {
          key: '3',
          label: '好吃',
          count: reviews.filter(review => review.rating === 3).length
        },
        {
          key: '2',
          label: '一般',
          count: reviews.filter(review => review.rating === 2).length
        },
        {
          key: '1',
          label: '翻车',
          count: reviews.filter(review => review.rating === 1).length
        }
      ]
      this.setData(
        {
          reviews,
          stats,
          filters,
          imageCount: reviews.filter(review => review.images.length).length,
          replyCount: reviews.filter(review => review.reply).length,
          loading: false
        },
        () => this.applyFilter()
      )
    } catch (e: any) {
      if (seq !== this._loadSeq) {
        return
      }
      this.setData({
        loading: false,
        error: String((e && e.message) || '评价加载失败').slice(0, 60)
      })
    }
  },

  onSelectFilter(e: any) {
    const filter = e.currentTarget.dataset.filter
    if (filter === this.data.filter) {
      return
    }
    this.setData({ filter }, () => this.applyFilter())
  },

  onSelectMeal(e: any) {
    const meal = e.currentTarget.dataset.meal
    if (meal === this.data.meal) {
      return
    }
    this.setData({ meal }, () => this.applyFilter())
  },

  onSort(e: any) {
    const sort = e.currentTarget.dataset.sort === 'rating' ? 'rating' : 'new'
    if (sort === this.data.sort) {
      return
    }
    this.setData({ sort }, () => this.applyFilter())
  },

  applyFilter() {
    const filter = this.data.filter
    const base = this.data.reviews
      .filter(review => !this.data.onlyImages || review.images.length > 0)
      .filter(review => !this.data.onlyReplied || Boolean(review.reply))
    const withMeal =
      this.data.meal === 'all'
        ? base
        : base.filter(review => review.meal === this.data.meal)
    const matched =
      filter === 'all'
        ? withMeal.slice()
        : withMeal.filter(review => String(review.rating) === filter)
    const display =
      this.data.sort === 'rating'
        ? matched.sort((a, b) => b.rating - a.rating)
        : matched
    const label =
      filter === 'all'
        ? ''
        : (RATINGS.find(item => String(item.value) === filter) || {}).label
    const imageSuffix = this.data.onlyImages ? '带图的' : ''
    const replySuffix = this.data.onlyReplied ? '有回复的' : ''
    const mealPrefix =
      this.data.meal === 'all' ? '' : mealName(this.data.meal)
    const scoped =
      this.data.meal !== 'all' ||
      this.data.onlyImages ||
      this.data.onlyReplied
    this.setData({
      display,
      emptyText:
        filter === 'all'
          ? scoped
            ? `还没有${mealPrefix}${replySuffix}${imageSuffix}评价`
            : '还没有评价'
          : `还没有${mealPrefix}${replySuffix}${imageSuffix}「${label}」的评价`
    })
  },

  onToggleReplied() {
    this.setData({ onlyReplied: !this.data.onlyReplied }, () =>
      this.applyFilter()
    )
  },

  onCopyStats() {
    const stats = this.data.stats || {}
    const lines = [
      '【我的评价】',
      `已评价 ${Number(stats.count || 0)} 单 · 好评率 ${Number(
        stats.goodRate || 0
      )}%`,
      `掌勺人回复 ${Number(stats.replies || 0)} 条 · 带图 ${Number(
        this.data.imageCount || 0
      )} 条`
    ]
    wx.setClipboardData({
      data: lines.join('\n'),
      success: () => wx.showToast({ title: '评价统计已复制', icon: 'none' })
    })
  },

  onToggleImages() {
    this.setData({ onlyImages: !this.data.onlyImages }, () =>
      this.applyFilter()
    )
  },

  onPreviewImage(e: any) {
    const index = Number(e.currentTarget.dataset.index)
    const src = String(e.currentTarget.dataset.src || '')
    const review = (this.data.display || [])[index]
    if (!review || !src || !(review.images || []).length) {
      return
    }
    wx.previewImage({ current: src, urls: review.images })
  },

  onTapReview(e: any) {
    const id = e.currentTarget.dataset.id
    if (id) {
      wx.navigateTo({ url: `/pages/order-detail/index?id=${id}` })
    }
  },

  onCopyReview(e: any) {
    const id = String((e.currentTarget && e.currentTarget.dataset.id) || '')
    const review =
      (this.data.display || []).find((item: any) => item.id === id) ||
      (this.data.reviews || []).find((item: any) => item.id === id)
    if (!review) {
      return
    }
    const lines = [
      `${review.dateText} · ${review.mealText} · ${review.emoji}${review.label}`,
      review.feedback || ''
    ]
    if ((review.tags || []).length) {
      lines.push(`标签：${review.tags.join('、')}`)
    }
    if (review.reply) {
      lines.push(`掌勺人：${review.reply}`)
    }
    wx.setClipboardData({
      data: lines.filter(Boolean).join('\n'),
      success: () => wx.showToast({ title: '评价已复制', icon: 'none' })
    })
  },

  onGoHome() {
    wx.switchTab({ url: '/pages/home/index' })
  },

  onRetry() {
    this.setData({ loading: true, error: '' })
    this.load()
  },

  onShareAppMessage() {
    const stats = this.data.stats || {}
    const count = Number(stats.count || 0)
    return {
      title: count
        ? `我的评价 · ${count} 单 · 好评率 ${Number(stats.goodRate || 0)}%`
        : '我的评价 · 每一顿都值得被记住',
      path: '/pages/reviews/index'
    }
  },

  onShareTimeline() {
    const stats = this.data.stats || {}
    const count = Number(stats.count || 0)
    return {
      title: count
        ? `我的评价 · ${count} 单 · 好评率 ${Number(stats.goodRate || 0)}%`
        : '我的评价 · 每一顿都值得被记住'
    }
  }
})
