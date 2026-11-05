import { getMyProfile, saveMyProfile } from '../../services/api'

function splitList(text: string): string[] {
  return String(text || '')
    .split(/[,，、\s]+/)
    .map(item => item.trim())
    .filter(Boolean)
    .slice(0, 8)
}

Page({
  data: {
    dislikesText: '',
    tastesText: '',
    address: '',
    loading: true,
    saving: false
  },

  onLoad() {
    this.load()
  },

  async load() {
    try {
      const profile = await getMyProfile()
      this.setData({
        dislikesText: profile.dislikes.join('，'),
        tastesText: profile.tastes.join('，'),
        address: profile.address,
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

  onDislikes(e: any) {
    this.setData({ dislikesText: e.detail.value })
  },

  onTastes(e: any) {
    this.setData({ tastesText: e.detail.value })
  },

  onAddress(e: any) {
    this.setData({ address: e.detail.value })
  },

  async onSave() {
    if (this.data.saving) {
      return
    }
    this.setData({ saving: true })
    try {
      await saveMyProfile({
        dislikes: splitList(this.data.dislikesText),
        tastes: splitList(this.data.tastesText),
        address: this.data.address.trim().slice(0, 60)
      })
      wx.showToast({ title: '已保存', icon: 'none' })
      setTimeout(() => {
        wx.navigateBack({ delta: 1 })
      }, 500)
    } catch (e: any) {
      wx.showToast({
        title: String((e && e.message) || '保存失败').slice(0, 40),
        icon: 'none'
      })
    } finally {
      this.setData({ saving: false })
    }
  }
})
