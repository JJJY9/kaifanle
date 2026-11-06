import type { WishStatus } from '../../services/types'
import {
  createWish,
  deleteWish,
  getMe,
  getWishes,
  updateWish
} from '../../services/api'
import { formatDate } from '../../utils/format'

const STATUS_TEXT: Record<WishStatus, string> = {
  pending: '待安排',
  planned: '已安排',
  done: '已吃上'
}

const REPLY_PHRASES = ['收到，安排上', '周末给你做', '再等等我']

Page({
  data: {
    wishes: [] as any[],
    content: '',
    presets: ['想吃火锅', '想喝奶茶', '想吃甜品'],
    isAdmin: false,
    loading: true,
    submitting: false,
    deletingId: ''
  },

  onShow() {
    this.load()
  },

  async load() {
    try {
      const [me, wishes] = await Promise.all([getMe(), getWishes()])
      const view = wishes.map(wish => ({
        ...wish,
        statusText: STATUS_TEXT[wish.status] || wish.status,
        dateText: formatDate(wish.createdAt)
      }))
      this.setData({
        wishes: view,
        isAdmin: me.isAdmin,
        loading: false
      })
    } catch (e: any) {
      this.setData({ loading: false })
      wx.showToast({
        title: String((e && e.message) || '加载失败').slice(0, 40),
        icon: 'none'
      })
    }
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
    const plannedDate = String(res.content || '').trim() || '最近'
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
