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
    loadFailed: false,
    newTitle: '',
    newNote: '',
    presetTitles: ['洗碗券', '奶茶券', '夸夸卡'],
    expiryOptions: [
      { label: '永久有效', days: 0 },
      { label: '7 天', days: 7 },
      { label: '30 天', days: 30 }
    ],
    expiryDays: 0,
    creating: false,
    claimingId: '',
    usingId: '',
    deletingId: '',
    expiringCount: 0
  },

  onShow() {
    this.load()
  },

  async load() {
    this.setData({ loading: true, loadFailed: false })
    try {
      const [me, coupons] = await Promise.all([getMe(), getCoupons()])
      const now = Date.now()
      const soonMs = 3 * 24 * 60 * 60 * 1000
      const view = coupons.map(coupon => {
        const mine = Boolean(coupon.owner && coupon.owner === me.openid)
        const expired = Boolean(
          coupon.expiresAt && Number(coupon.expiresAt) < now
        )
        const expiringSoon = Boolean(
          !expired &&
            coupon.status === 'unused' &&
            coupon.expiresAt &&
            Number(coupon.expiresAt) - now <= soonMs
        )
        const leftHours = coupon.expiresAt
          ? (Number(coupon.expiresAt) - now) / (60 * 60 * 1000)
          : 0
        return {
          ...coupon,
          expired,
          expiringSoon,
          expiringText: expiringSoon
            ? leftHours <= 24
              ? '今天到期'
              : `还剩 ${Math.ceil(leftHours / 24)} 天`
            : '',
          statusText: expired
            ? '已过期'
            : coupon.status === 'used'
            ? '已用掉'
            : coupon.owner
            ? mine
              ? '我的'
              : '已领取'
            : '待领取',
          canClaim:
            !expired && !coupon.owner && coupon.status === 'unused',
          canUse: !expired && mine && coupon.status === 'unused',
          dateText: formatDate(coupon.createdAt),
          expiryText: coupon.expiresAt
            ? `${formatDate(coupon.expiresAt)} 到期`
            : ''
        }
      })
      const rank = (item: any) => {
        if (item.expiringSoon) {
          return 0
        }
        if (item.canClaim || item.canUse) {
          return 1
        }
        return item.expired ? 3 : 2
      }
      view.sort(
        (a, b) =>
          rank(a) - rank(b) ||
          Number(a.expiresAt || Number.MAX_SAFE_INTEGER) -
            Number(b.expiresAt || Number.MAX_SAFE_INTEGER)
      )
      this.setData({
        coupons: view,
        expiringCount: view.filter(item => item.expiringSoon).length,
        isAdmin: me.isAdmin,
        openid: me.openid,
        loading: false,
        loadFailed: false
      })
    } catch (e: any) {
      this.setData({ loading: false, loadFailed: true })
      wx.showToast({
        title: String((e && e.message) || '加载失败').slice(0, 40),
        icon: 'none'
      })
    }
  },

  onRetryLoad() {
    this.load()
  },

  onTitle(e: any) {
    this.setData({ newTitle: e.detail.value })
  },

  onPresetTitle(e: any) {
    this.setData({ newTitle: e.currentTarget.dataset.title })
  },

  onExpiry(e: any) {
    this.setData({ expiryDays: Number(e.currentTarget.dataset.days) || 0 })
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
      await createCoupon({
        title,
        note: this.data.newNote.trim(),
        expiresInDays: this.data.expiryDays
      })
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
