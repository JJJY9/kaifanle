import { getMyProfile, saveMyProfile } from '../../services/api'
import { dateInputString } from '../../utils/format'
import { backAfter } from '../../utils/nav'

function splitList(text: string): string[] {
  return String(text || '')
    .split(/[,，、\s]+/)
    .map(item => item.trim())
    .filter(Boolean)
    .slice(0, 8)
}

function occurrencesUntil(dateKey: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    return null
  }
  const today = new Date(Date.now() + 8 * 60 * 60 * 1000)
  const todayUtc = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate()
  )
  const parts = dateKey.split('-').map(Number)
  const occurrence = (year: number) => {
    const lastDay = new Date(Date.UTC(year, parts[1], 0)).getUTCDate()
    return Date.UTC(year, parts[1] - 1, Math.min(parts[2], lastDay))
  }
  let next = occurrence(today.getUTCFullYear())
  if (next < todayUtc) {
    next = occurrence(today.getUTCFullYear() + 1)
  }
  return Math.round((next - todayUtc) / (24 * 60 * 60 * 1000))
}

function relativeText(dateKey: string): string {
  const days = occurrencesUntil(dateKey)
  if (days === null) {
    return ''
  }
  return days === 0 ? '今天' : days === 1 ? '明天' : `还有 ${days} 天`
}

function buildSpecialHint(birthday: string, anniversary: string): string {
  const parts: string[] = []
  if (birthday) {
    const text = relativeText(birthday)
    if (text) {
      parts.push(`生日${text}`)
    }
  }
  if (anniversary) {
    const text = relativeText(anniversary)
    if (text) {
      parts.push(`纪念日${text}`)
    }
  }
  return parts.join('，')
}

Page({
  data: {
    dislikesText: '',
    tastesText: '',
    address: '',
    birthday: '',
    anniversary: '',
    today: dateInputString(),
    specialHint: '',
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
        birthday: profile.birthday || '',
        anniversary: profile.anniversary || '',
        specialHint: buildSpecialHint(
          profile.birthday || '',
          profile.anniversary || ''
        ),
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

  onBirthday(e: any) {
    const birthday = String(e.detail.value || '')
    this.setData({
      birthday,
      specialHint: buildSpecialHint(birthday, this.data.anniversary)
    })
  },

  onAnniversary(e: any) {
    const anniversary = String(e.detail.value || '')
    this.setData({
      anniversary,
      specialHint: buildSpecialHint(this.data.birthday, anniversary)
    })
  },

  onClearBirthday() {
    this.setData({
      birthday: '',
      specialHint: buildSpecialHint('', this.data.anniversary)
    })
  },

  onClearAnniversary() {
    this.setData({
      anniversary: '',
      specialHint: buildSpecialHint(this.data.birthday, '')
    })
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
        address: this.data.address.trim().slice(0, 60),
        birthday: this.data.birthday,
        anniversary: this.data.anniversary
      })
      wx.showToast({ title: '已保存', icon: 'none' })
      backAfter(500)
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
