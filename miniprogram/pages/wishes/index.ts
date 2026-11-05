import type { WishStatus } from '../../services/types'
import { createWish, getMe, getWishes, updateWish } from '../../services/api'
import { formatDate } from '../../utils/format'

const STATUS_TEXT: Record<WishStatus, string> = {
  pending: '待安排',
  planned: '已安排',
  done: '已吃上'
}

Page({
  data: {
    wishes: [] as any[],
    content: '',
    isAdmin: false,
    loading: true,
    submitting: false
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
  }
})
