import { getMyStats, getOrders } from '../../services/api'
import { dateInputString } from '../../utils/format'
import { saveImageToAlbum } from '../../utils/save-image'

interface FootprintDish {
  name: string
  qty: number
  amount: number
}

Page({
  data: {
    loading: true,
    error: '',
    monthOffset: 0,
    monthText: '',
    monthOrders: 0,
    monthSpend: 0,
    totalOrders: 0,
    favorite: '',
    topDishes: [] as FootprintDish[],
    ratedCount: 0,
    avgRating: 0,
    streakDays: 0,
    achievements: [] as Array<{
      key: string
      icon: string
      label: string
      desc: string
      earned: boolean
    }>,
    achievementDone: 0,
    posterMaking: false,
    posterPath: ''
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
    this.setData(
      this.data.monthText ? { error: '' } : { loading: true, error: '' }
    )
    try {
      const [orders, stats] = await Promise.all([getOrders(), getMyStats()])
      if (seq !== this._loadSeq) {
        return
      }
      const now = new Date()
      const todayKey = dateInputString()
      const offset = Number(this.data.monthOffset) === 1 ? 1 : 0
      const monthRef = new Date(
        now.getFullYear(),
        now.getMonth() - offset,
        1
      )
      const monthPrefix = `${monthRef.getFullYear()}-${String(
        monthRef.getMonth() + 1
      ).padStart(2, '0')}`
      const effectiveDate = (order: any) => {
        if (order.scheduledDate) {
          return order.scheduledDate
        }
        const date = new Date(order.createdAt)
        return `${date.getFullYear()}-${String(
          date.getMonth() + 1
        ).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
      }
      const monthly = orders.filter(order => {
        const date = effectiveDate(order)
        return (
          date.indexOf(monthPrefix + '-') === 0 &&
          (offset > 0 || date <= todayKey)
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
      const dayNumbers = Array.from(
        new Set(active.map(order => effectiveDate(order)))
      )
        .map(date => {
          const parts = date.split('-').map(Number)
          return Date.UTC(parts[0], parts[1] - 1, parts[2]) / 86400000
        })
        .sort((a, b) => a - b)
      let streakDays = 0
      let run = 0
      let previous = -2
      dayNumbers.forEach(day => {
        run = day === previous + 1 ? run + 1 : 1
        previous = day
        streakDays = Math.max(streakDays, run)
      })
      const totalOrders = Number(stats.total || 0)
      const achievements = [
        {
          key: 'first',
          icon: '🍚',
          label: '第一顿干饭',
          desc: '累计 1 单',
          earned: totalOrders >= 1
        },
        {
          key: 'regular',
          icon: '🥢',
          label: '干饭常客',
          desc: '累计 10 单',
          earned: totalOrders >= 10
        },
        {
          key: 'month',
          icon: '📅',
          label: '当月常客',
          desc: '当月 3 单',
          earned: active.length >= 3
        },
        {
          key: 'streak',
          icon: '🔥',
          label: '连吃三天',
          desc: '连吃 3 天',
          earned: streakDays >= 3
        },
        {
          key: 'rater',
          icon: '⭐',
          label: '爱夸厨子',
          desc: '评价 1 次',
          earned: rated.length >= 1
        },
        {
          key: 'king',
          icon: '👑',
          label: '当月干饭王',
          desc: '当月 10 单',
          earned: active.length >= 10
        },
        {
          key: 'favorite',
          icon: '💗',
          label: '有偏爱',
          desc: '点出最常吃',
          earned: Boolean(stats.favorite && stats.favorite !== '还没点过')
        }
      ]
      const achievementDone = achievements.filter(item => item.earned).length
      this.setData({
        loading: false,
        posterPath: '',
        monthOffset: offset,
        monthText: `${monthRef.getFullYear()} 年 ${
          monthRef.getMonth() + 1
        } 月`,
        monthOrders: active.length,
        monthSpend: Number(spend.toFixed(2)),
        totalOrders: Number(stats.total || 0),
        favorite: stats.favorite || '',
        topDishes,
        ratedCount: rated.length,
        avgRating,
        streakDays,
        achievements,
        achievementDone
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

  onSelectMonth(e: any) {
    const offset = Number(e.currentTarget.dataset.offset) === 1 ? 1 : 0
    if (offset === Number(this.data.monthOffset || 0)) {
      return
    }
    this.setData({ monthOffset: offset }, () => this.load())
  },

  async onSharePoster() {
    if (this.data.posterMaking) {
      return
    }
    this.setData({ posterMaking: true })
    try {
      const canvas: any = await new Promise((resolve, reject) => {
        wx.createSelectorQuery()
          .in(this)
          .select('#footprintPoster')
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
      const dpr = (wx.getWindowInfo && wx.getWindowInfo().pixelRatio) || 2
      const width = 600
      const height = 800
      canvas.width = width * dpr
      canvas.height = height * dpr
      const ctx = canvas.getContext('2d')
      ctx.scale(dpr, dpr)

      ctx.fillStyle = '#FFFDF6'
      ctx.fillRect(0, 0, width, height)
      ctx.strokeStyle = '#111111'
      ctx.lineWidth = 8
      ctx.strokeRect(24, 24, width - 48, height - 48)

      ctx.fillStyle = '#FF5C8A'
      ctx.fillRect(24, 24, width - 48, 130)
      ctx.fillStyle = '#FFFFFF'
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      ctx.font = 'bold 40px "PingFang SC", sans-serif'
      ctx.fillText('我的干饭足迹', 48, 80)
      ctx.font = '24px "PingFang SC", sans-serif'
      ctx.fillText(this.data.monthText || '', 48, 125)

      ctx.fillStyle = '#111111'
      ctx.font = '24px "PingFang SC", sans-serif'
      ctx.fillText('本月干饭', 48, 215)
      ctx.fillStyle = '#FF6B35'
      ctx.font = 'bold 78px "PingFang SC", sans-serif'
      ctx.fillText(`${this.data.monthOrders} 单`, 48, 285)

      ctx.fillStyle = '#111111'
      ctx.font = 'bold 30px "PingFang SC", sans-serif'
      ctx.fillText(`花费 ¥${this.data.monthSpend}`, 48, 370)
      ctx.font = '26px "PingFang SC", sans-serif'
      ctx.fillStyle = '#5C5C5C'
      ctx.fillText(`累计干饭 ${this.data.totalOrders} 单`, 48, 420)

      if (this.data.favorite) {
        ctx.fillStyle = '#FFD23F'
        ctx.fillRect(48, 470, width - 96, 70)
        ctx.fillStyle = '#111111'
        ctx.font = 'bold 26px "PingFang SC", sans-serif'
        ctx.fillText(`最常点：${this.data.favorite}`, 68, 505)
      }

      const top = (this.data.topDishes || []).slice(0, 3)
      ctx.fillStyle = '#5C5C5C'
      ctx.font = '24px "PingFang SC", sans-serif'
      ctx.fillText('本月 C 位菜', 48, 590)
      ctx.fillStyle = '#111111'
      ctx.font = 'bold 26px "PingFang SC", sans-serif'
      top.forEach((dish, index) => {
        ctx.fillText(
          `${index + 1}. ${dish.name} ×${dish.qty}`,
          48,
          635 + index * 40
        )
      })

      ctx.fillStyle = '#5C5C5C'
      ctx.font = '22px "PingFang SC", sans-serif'
      ctx.textAlign = 'left'
      ctx.fillText('她点单，你掌勺', 48, height - 70)
      ctx.textAlign = 'right'
      ctx.fillText('开饭咯', width - 48, height - 70)

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
      wx.showToast({ title: '足迹图已生成', icon: 'none' })
    } catch (e: any) {
      this.setData({ posterMaking: false })
      wx.showToast({
        title: String((e && e.message) || '生成失败').slice(0, 40),
        icon: 'none'
      })
    }
  },

  onPreviewPoster() {
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
    } else {
      wx.previewImage({ urls: [path] })
    }
  },

  onSavePoster() {
    const path = this.data.posterPath
    if (path) {
      saveImageToAlbum(path, '足迹图已保存')
    }
  },

  onGoOrders() {
    wx.switchTab({ url: '/pages/orders/index' })
  },

  onShareAppMessage() {
    return {
      title: `我的干饭足迹 · 本月 ${Number(this.data.monthOrders || 0)} 单`,
      path: '/pages/my-report/index'
    }
  },

  onShareTimeline() {
    return {
      title: `我的干饭足迹 · 本月 ${Number(this.data.monthOrders || 0)} 单`,
      query: ''
    }
  }
})
