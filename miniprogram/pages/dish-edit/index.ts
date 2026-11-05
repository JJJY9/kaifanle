import type {
  Category,
  DishInput,
  MealId
} from '../../services/types'
import { getCategories, getDish, saveDish, deleteDish } from '../../services/api'
import { MEALS } from '../../utils/constants'

const COLORS = ['#FFD23F', '#2D9CFF', '#FF6B35', '#FF5C8A', '#2FBF71']

function splitList(text: string): string[] {
  return String(text || '')
    .split(/[,，、\s]+/)
    .map(item => item.trim())
    .filter(Boolean)
    .slice(0, 5)
}

Page({
  data: {
    id: '',
    isEdit: false,
    loading: true,
    saving: false,
    deleting: false,
    categories: [] as Category[],
    name: '',
    desc: '',
    price: '',
    categoryId: '',
    meals: MEALS,
    selectedMeals: [] as MealId[],
    mealChecked: {} as Record<string, boolean>,
    tagsText: '',
    spicyText: '',
    addons: [] as Array<{
      key: string
      id: string
      name: string
      price: string
    }>,
    colors: COLORS,
    colorIndex: 0,
    statuses: [
      { id: 'on', name: '供应中' },
      { id: 'soldout', name: '售罄' },
      { id: 'off', name: '下架' }
    ],
    status: 'on',
    isRecommended: false
  },

  onLoad(options: any) {
    const id = options.id || ''
    this.setData({ id, isEdit: Boolean(id) })
    wx.setNavigationBarTitle({
      title: id ? '编辑菜品' : '新增菜品'
    })
    this.load(id)
  },

  async load(id: string) {
    try {
      const categories = await getCategories()
      this.setData({ categories })

      if (!id) {
        this.setData({
          loading: false,
          categoryId: categories[0] ? categories[0].id : '',
          selectedMeals: ['lunch', 'dinner'],
          mealChecked: { lunch: true, dinner: true }
        })
        return
      }

      const dish = await getDish(id)
      if (!dish) {
        throw new Error('菜品不存在')
      }
      const colorIndex = COLORS.indexOf(dish.color)
      const mealChecked: Record<string, boolean> = {}
      ;(dish.meals || []).forEach(meal => {
        mealChecked[meal] = true
      })
      this.setData({
        name: dish.name,
        desc: dish.desc,
        price: String(dish.price),
        categoryId: dish.categoryId,
        selectedMeals: dish.meals || [],
        mealChecked,
        tagsText: dish.tags.join('，'),
        spicyText: dish.spicyLevels.join('，'),
        addons: (dish.addons || []).map((addon, index) => ({
          key: addon.id || `k${index}`,
          id: addon.id,
          name: addon.name,
          price: String(addon.price)
        })),
        colorIndex: colorIndex > -1 ? colorIndex : 0,
        status: dish.status,
        isRecommended: Boolean(dish.isRecommended),
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

  onName(e: any) {
    this.setData({ name: e.detail.value })
  },

  onDesc(e: any) {
    this.setData({ desc: e.detail.value })
  },

  onPrice(e: any) {
    this.setData({ price: e.detail.value })
  },

  onSelectCategory(e: any) {
    this.setData({ categoryId: e.currentTarget.dataset.id })
  },

  onToggleMeal(e: any) {
    const id = e.currentTarget.dataset.id as MealId
    const selected = this.data.selectedMeals.slice()
    const checked = { ...this.data.mealChecked }
    const index = selected.indexOf(id)
    if (index > -1) {
      selected.splice(index, 1)
      checked[id] = false
    } else {
      selected.push(id)
      checked[id] = true
    }
    this.setData({ selectedMeals: selected, mealChecked: checked })
  },

  onTags(e: any) {
    this.setData({ tagsText: e.detail.value })
  },

  onSpicy(e: any) {
    this.setData({ spicyText: e.detail.value })
  },

  onAddAddon() {
    this.setData({
      addons: this.data.addons.concat({
        key: 'k' + Date.now(),
        id: '',
        name: '',
        price: ''
      })
    })
  },

  onAddonName(e: any) {
    const index = Number(e.currentTarget.dataset.index)
    this.setData({ [`addons[${index}].name`]: e.detail.value })
  },

  onAddonPrice(e: any) {
    const index = Number(e.currentTarget.dataset.index)
    this.setData({ [`addons[${index}].price`]: e.detail.value })
  },

  onRemoveAddon(e: any) {
    const index = Number(e.currentTarget.dataset.index)
    const addons = this.data.addons.slice()
    addons.splice(index, 1)
    this.setData({ addons })
  },

  onSelectColor(e: any) {
    this.setData({ colorIndex: Number(e.currentTarget.dataset.index) })
  },

  onSelectStatus(e: any) {
    this.setData({ status: e.currentTarget.dataset.id })
  },

  onRecommended(e: any) {
    this.setData({ isRecommended: Boolean(e.detail.value) })
  },

  async onSave() {
    if (this.data.saving) {
      return
    }

    const name = this.data.name.trim()
    const price = Number(this.data.price)
    if (!name) {
      wx.showToast({ title: '给菜起个名字吧', icon: 'none' })
      return
    }
    if (!isFinite(price) || price < 0 || price > 999) {
      wx.showToast({ title: '价格需要是 0-999 的数字', icon: 'none' })
      return
    }
    if (!this.data.categoryId) {
      wx.showToast({ title: '先选一个分类', icon: 'none' })
      return
    }
    if (!this.data.selectedMeals.length) {
      wx.showToast({ title: '至少选一个餐次', icon: 'none' })
      return
    }

    const addons = this.data.addons
      .filter(addon => addon.name.trim())
      .map((addon, index) => ({
        id: addon.id || `a${index + 1}`,
        name: addon.name.trim(),
        price: Math.max(0, Number(addon.price) || 0)
      }))

    const payload: DishInput = {
      id: this.data.id || undefined,
      name,
      desc: this.data.desc.trim(),
      price,
      categoryId: this.data.categoryId,
      tags: splitList(this.data.tagsText),
      spicyLevels: splitList(this.data.spicyText),
      addons,
      color: this.data.colors[this.data.colorIndex],
      meals: this.data.selectedMeals,
      status: this.data.status as DishInput['status'],
      isRecommended: this.data.isRecommended
    }

    this.setData({ saving: true })
    try {
      await saveDish(payload)
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
  },

  async onDelete() {
    if (!this.data.id || this.data.deleting) {
      return
    }
    const res: any = await wx.showModal({
      title: '删除这道菜？',
      content: '删除后菜单里不再显示，历史订单不受影响。',
      confirmText: '删除',
      cancelText: '再想想'
    })
    if (!res.confirm) {
      return
    }
    this.setData({ deleting: true })
    try {
      await deleteDish(this.data.id)
      wx.showToast({ title: '已删除', icon: 'none' })
      setTimeout(() => {
        wx.navigateBack({ delta: 1 })
      }, 500)
    } catch (e: any) {
      wx.showToast({
        title: String((e && e.message) || '删除失败').slice(0, 40),
        icon: 'none'
      })
      this.setData({ deleting: false })
    }
  }
})
