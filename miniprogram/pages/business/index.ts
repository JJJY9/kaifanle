import type { Business, MealId } from '../../services/types'
import { getBusiness, updateBusiness } from '../../services/api'
import { MEALS } from '../../utils/constants'

interface MealView {
  id: MealId
  name: string
  open: boolean
  deadline: string
}

Page({
  data: {
    loading: true,
    saving: false,
    mealViews: [] as MealView[],
    closedNote: ''
  },

  onLoad() {
    this.load()
  },

  async load() {
    try {
      const business = await getBusiness()
      const mealViews: MealView[] = MEALS.map(meal => ({
        id: meal.id,
        name: meal.name,
        open: business[meal.id].open,
        deadline: business[meal.id].deadline
      }))
      this.setData({
        mealViews,
        closedNote: business.closedNote,
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

  onToggle(e: any) {
    const index = Number(e.currentTarget.dataset.index)
    const mealViews = this.data.mealViews.slice()
    mealViews[index].open = Boolean(e.detail.value)
    this.setData({ mealViews })
  },

  onToggleAll(e: any) {
    const open = String(e.currentTarget.dataset.open) === 'true'
    const mealViews = this.data.mealViews.map(view => ({ ...view, open }))
    this.setData({ mealViews })
  },

  onDeadline(e: any) {
    const index = Number(e.currentTarget.dataset.index)
    const mealViews = this.data.mealViews.slice()
    mealViews[index].deadline = e.detail.value
    this.setData({ mealViews })
  },

  onNote(e: any) {
    this.setData({ closedNote: e.detail.value })
  },

  async onSave() {
    if (this.data.saving) {
      return
    }
    const business: any = {
      closedNote:
        this.data.closedNote.trim().slice(0, 40) || '今天休息，明天见'
    }
    this.data.mealViews.forEach(view => {
      business[view.id] = {
        open: view.open,
        deadline: view.deadline
      }
    })
    this.setData({ saving: true })
    try {
      await updateBusiness(business as Business)
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
