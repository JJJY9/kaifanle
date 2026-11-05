import {
  claimCoupon,
  createCoupon,
  deleteCoupon,
  getCoupons,
  getMe,
  useCoupon
} from '../../services/api'
import { formatDate } from '../../utils/format'

Page({
  data: {
    coupons: [] as any[],
    isAdmin: false,
    openid: '',
    loading: true,
    newTitle: '',
    newNote: '',
    presetTitles: ['洗碗券', '奶茶券', '夸夸卡'],
    creating: false,
    claimingId: '',
    usingId: '',
    deletingId: ''
  },

  onShow() {
    this.load()
  },

  async load() {
    try {
      const [me, coupons] = await Promise.all([getMe(), getCoupons()])
      const view = coupons.map(coupon => {
        const mine = Boolean(coupon.owner && coupon.owner === me.openid)
        return {
          ...coupon,
          statusText:
            coupon.status === 'used'
              ? '已用掉'
              : coupon.owner
              ? mine
                ? '我的'
                : '已领取'
              : '待领取',
          canClaim: !coupon.owner && coupon.status === 'unused',
          canUse: mine && coupon.status === 'unused',
          dateText: formatDate(coupon.createdAt)
        }
      })
      this.setData({
        coupons: view,
        isAdmin: me.isAdmin,
        openid: me.openid,
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

  onTitle(e: any) {
    this.setData({ newTitle: e.detail.value })
  },

  onPresetTitle(e: any) {
    this.setData({ newTitle: e.currentTarget.dataset.title })
  },

  onNote(e: any) {
    this.setData({ newNote: e.detail.value })
  },

  async onCreate() {
    if (this.data.creating) {
      return
    }
    const title = this.data.newTitle.trim()
    if (!title) {
      wx.showToast({ title: '给券起个名字', icon: 'none' })
      return
    }
    this.setData({ creating: true })
    try {
      await createCoupon({ title, note: this.data.newNote.trim() })
      this.setData({ newTitle: '', newNote: '' })
      wx.showToast({ title: '发好啦', icon: 'none' })
      this.load()
    } catch (e: any) {
      wx.showToast({
        title: String((e && e.message) || '发券失败').slice(0, 40),
        icon: 'none'
      })
    } finally {
      this.setData({ creating: false })
    }
  },

  async onClaim(e: any) {
    if (this.data.claimingId) {
      return
    }
    const id = e.currentTarget.dataset.id
    this.setData({ claimingId: id })
    try {
      await claimCoupon(id)
      wx.showToast({ title: '收下了', icon: 'none' })
      this.load()
    } catch (err: any) {
      wx.showToast({
        title: String((err && err.message) || '领取失败').slice(0, 40),
        icon: 'none'
      })
    } finally {
      this.setData({ claimingId: '' })
    }
  },

  async onUse(e: any) {
    if (this.data.usingId) {
      return
    }
    const id = e.currentTarget.dataset.id
    const res: any = await wx.showModal({
      title: '用掉这张券？',
      content: '用完就没有啦，确定现在用吗？',
      confirmText: '用掉',
      cancelText: '再留着'
    })
    if (!res.confirm) {
      return
    }
    this.setData({ usingId: id })
    try {
      await useCoupon(id)
      wx.showToast({ title: '已用掉', icon: 'none' })
      this.load()
    } catch (err: any) {
      wx.showToast({
        title: String((err && err.message) || '操作失败').slice(0, 40),
        icon: 'none'
      })
    } finally {
      this.setData({ usingId: '' })
    }
  },

  async onDelete(e: any) {
    if (this.data.deletingId) {
      return
    }
    const id = e.currentTarget.dataset.id
    const res: any = await wx.showModal({
      title: '删除这张券？',
      content: '删除后不可恢复。',
      confirmText: '删除',
      cancelText: '再想想'
    })
    if (!res.confirm) {
      return
    }
    this.setData({ deletingId: id })
    try {
      await deleteCoupon(id)
      wx.showToast({ title: '已删除', icon: 'none' })
      this.load()
    } catch (err: any) {
      wx.showToast({
        title: String((err && err.message) || '删除失败').slice(0, 40),
        icon: 'none'
      })
    } finally {
      this.setData({ deletingId: '' })
    }
  }
})
