import type { WishStatus } from '../../services/types'
import {
  createWish,
  deleteWish,
  getMe,
  getWishes,
  updateWish
} from '../../services/api'
import { formatDate, dateInputString } from '../../utils/format'

const STATUS_TEXT: Record<WishStatus, string> = {
  pending: '待安排',
  planned: '已安排',
  done: '已吃上'
}

const REPLY_PHRASES = ['收到，安排上', '周末给你做', '再等等我']

function normalizePlanDate(input: string): string {
  const text = String(input || '').trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text
  }
  const today = new Date()
  const shift = (days: number) => {
    const d = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() + days
    )
    return dateInputString(d)
  }
  if (text.indexOf('今天') === 0) {
    return shift(0)
  }
  if (text.indexOf('明天') === 0) {
    return shift(1)
  }
  if (text.indexOf('后天') === 0) {
    return shift(2)
  }
  const match = text.match(/^(\d{1,2})[月/-](\d{1,2})日?$/)
  if (match) {
    const month = Number(match[1])
    const day = Number(match[2])
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      let year = today.getFullYear()
      let value = dateInputString(new Date(year, month - 1, day))
      if (value < dateInputString(today)) {
        year += 1
        value = dateInputString(new Date(year, month - 1, day))
      }
      return value
    }
  }
  return ''
}

Page({
  data: {
    wishes: [] as any[],
    display: [] as any[],
    filter: 'all' as 'all' | WishStatus,
    filters: [] as any[],
    content: '',
    presets: ['想吃火锅', '想喝奶茶', '想吃甜品'],
    isAdmin: false,
    loading: true,
    submitting: false,
    deletingId: ''
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
    try {
      const [me, wishes] = await Promise.all([getMe(), getWishes()])
      if (seq !== this._loadSeq) {
        return
      }
      const today = new Date()
      const todayUtc = Date.UTC(
        today.getFullYear(),
        today.getMonth(),
        today.getDate()
      )
      const countdownText = (date: string) => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ''))) {
          return ''
        }
        const parts = String(date).split('-').map(Number)
        const target = Date.UTC(parts[0], parts[1] - 1, parts[2])
        const diff = Math.round((target - todayUtc) / 86400000)
        if (diff === 0) {
          return '今天安排'
        }
        if (diff === 1) {
          return '明天安排'
        }
        if (diff > 1) {
          return `还有 ${diff} 天`
        }
        return `已过 ${-diff} 天`
      }
      const view = wishes.map(wish => ({
        ...wish,
        statusText: STATUS_TEXT[wish.status] || wish.status,
        dateText: formatDate(wish.createdAt),
        planCountdown:
          wish.status === 'done' ? '' : countdownText(wish.plannedDate)
      }))
      const filters = [
        { key: 'all', label: '全部', count: view.length },
        {
          key: 'pending',
          label: '待安排',
          count: view.filter(wish => wish.status === 'pending').length
        },
        {
          key: 'planned',
          label: '已安排',
          count: view.filter(wish => wish.status === 'planned').length
        },
        {
          key: 'done',
          label: '已吃上',
          count: view.filter(wish => wish.status === 'done').length
        }
      ]
      this.setData(
        {
          wishes: view,
          filters,
          isAdmin: me.isAdmin,
          loading: false
        },
        () => this.applyFilter()
      )
    } catch (e: any) {
      if (seq !== this._loadSeq) {
        return
      }
      this.setData({ loading: false })
      wx.showToast({
        title: String((e && e.message) || '加载失败').slice(0, 40),
        icon: 'none'
      })
    }
  },

  applyFilter() {
    const filter = this.data.filter
    this.setData({
      display:
        filter === 'all'
          ? this.data.wishes.slice()
          : this.data.wishes.filter(wish => wish.status === filter)
    })
  },

  onFilter(e: any) {
    const raw = String(e.currentTarget.dataset.filter || '')
    const filter =
      raw === 'pending' || raw === 'planned' || raw === 'done'
        ? raw
        : 'all'
    if (filter === this.data.filter) {
      return
    }
    this.setData({ filter }, () => this.applyFilter())
  },

  onContent(e: any) {
    this.setData({ content: e.detail.value })
  },

  onPreset(e: any) {
    this.setData({ content: e.currentTarget.dataset.text })
  },

  async onSubmit() {
    if (this.data.submitting) {
      return
    }
    const content = this.data.content.trim()
    if (!content) {
      wx.showToast({ title: '先写点什么', icon: 'none' })
      return
    }
    this.setData({ submitting: true })
    try {
      await createWish(content)
      this.setData({ content: '' })
      wx.showToast({ title: '许愿成功', icon: 'none' })
      this.load()
    } catch (e: any) {
      wx.showToast({
        title: String((e && e.message) || '许愿失败').slice(0, 40),
        icon: 'none'
      })
    } finally {
      this.setData({ submitting: false })
    }
  },

  onWishActionsLongpress() {
    // 按钮区的长按不冒泡到卡片，避免误触发按卡复制
  },

  onCopyWish(e: any) {
    const id = String((e.currentTarget && e.currentTarget.dataset.id) || '')
    const wish = (this.data.display || []).find((item: any) => item.id === id)
    if (!wish) {
      return
    }
    const lines = [`【许愿】${wish.content}`]
    const statusLine = [`状态：${wish.statusText || ''}`]
    if (wish.plannedDate) {
      statusLine.push(`安排 ${wish.plannedDate}`)
    }
    lines.push(statusLine.join(' · '))
    if (wish.reply) {
      lines.push(`掌勺人回复：${wish.reply}`)
    }
    wx.setClipboardData({
      data: lines.join('\n'),
      success: () => wx.showToast({ title: '愿望已复制', icon: 'none' })
    })
  },

  async onPlan(e: any) {
    const id = e.currentTarget.dataset.id
    const res: any = await wx.showModal({
      title: '安排这个愿望',
      editable: true,
      placeholderText: '比如：明天晚餐',
      confirmText: '安排',
      cancelText: '再想想'
    })
    if (!res.confirm) {
      return
    }
    const plannedDate = normalizePlanDate(String(res.content || ''))
    if (!plannedDate) {
      wx.showToast({
        title: '请填日期，比如 2026-11-09 或「明天」',
        icon: 'none'
      })
      return
    }
    try {
      await updateWish({ id, status: 'planned', plannedDate })
      wx.showToast({ title: '已安排', icon: 'none' })
      this.load()
    } catch (err: any) {
      wx.showToast({
        title: String((err && err.message) || '操作失败').slice(0, 40),
        icon: 'none'
      })
    }
  },

  async onDone(e: any) {
    const id = e.currentTarget.dataset.id
    try {
      await updateWish({ id, status: 'done' })
      wx.showToast({ title: '记下了', icon: 'none' })
      this.load()
    } catch (err: any) {
      wx.showToast({
        title: String((err && err.message) || '操作失败').slice(0, 40),
        icon: 'none'
      })
    }
  },

  async onDeleteWish(e: any) {
    if (this.data.deletingId) {
      return
    }
    const id = e.currentTarget.dataset.id
    const res: any = await wx.showModal({
      title: '撤回这个愿望？',
      content: '撤回后就从许愿池里消失了。',
      confirmText: '撤回',
      cancelText: '留着'
    })
    if (!res.confirm) {
      return
    }
    this.setData({ deletingId: id })
    try {
      await deleteWish(id)
      wx.showToast({ title: '已撤回', icon: 'none' })
      this.load()
    } catch (err: any) {
      wx.showToast({
        title: String((err && err.message) || '撤回失败').slice(0, 40),
        icon: 'none'
      })
    } finally {
      this.setData({ deletingId: '' })
    }
  },

  onMakeDish(e: any) {
    const name = String(e.currentTarget.dataset.content || '')
      .trim()
      .slice(0, 12)
    if (!name) {
      return
    }
    wx.navigateTo({
      url: '/pages/dish-edit/index?name=' + encodeURIComponent(name)
    })
  },

  async onReply(e: any) {
    const id = e.currentTarget.dataset.id
    const wish = (this.data.wishes || []).find((item: any) => item.id === id)
    let draft = wish && wish.reply ? String(wish.reply) : ''
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
        return
      }
    }
    const res: any = await wx.showModal({
      title: '回一句',
      editable: true,
      content: draft,
      placeholderText: '比如：周末给你做！',
      confirmText: '回复',
      cancelText: '算了'
    })
    if (!res.confirm) {
      return
    }
    const reply = String(res.content || '').trim().slice(0, 50)
    if (!reply) {
      wx.showToast({ title: '没写内容', icon: 'none' })
      return
    }
    try {
      await updateWish({ id, reply })
      wx.showToast({ title: '已回复', icon: 'none' })
      this.load()
    } catch (err: any) {
      wx.showToast({
        title: String((err && err.message) || '回复失败').slice(0, 40),
        icon: 'none'
      })
    }
  }
})
