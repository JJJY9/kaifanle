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
    loadFailed: false,
    saving: false
  },

  _loaded: false,

  onLoad() {
    this.load()
  },

  async load() {
    this.setData({ loading: true, loadFailed: false })
    try {
      const profile = await getMyProfile()
      this._loaded = true
      this.setData({
        dislikesText: profile.dislikes.join('，'),
        tastesText: profile.tastes.join('，'),
        address: profile.address,
        loading: false,
        loadFailed: false
      })
    } catch (e: any) {
      this._loaded = false
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
    if (!this._loaded) {
      wx.showToast({ title: '档案还没加载好，点重试', icon: 'none' })
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
