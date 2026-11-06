import type {
  Category,
  DishInput,
  MealId
} from '../../services/types'
import { getCategories, getDish, saveDish, deleteDish } from '../../services/api'
import { MEALS } from '../../utils/constants'
import { backAfter } from '../../utils/nav'
import { USE_CLOUD } from '../../config'

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
    stock: '-1',
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
    image: '',
    recipe: '',
    uploading: false,
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
        stock: String(typeof dish.stock === 'number' ? dish.stock : -1),
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
        image: dish.image || '',
        recipe: dish.recipe || '',
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

  onStock(e: any) {
    this.setData({ stock: e.detail.value })
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

  onRecipe(e: any) {
    this.setData({ recipe: e.detail.value })
  },

  async onChooseImage() {
    if (this.data.uploading) {
      return
    }
    let tempFilePath = ''
    try {
      const res: any = await wx.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sizeType: ['compressed'],
        sourceType: ['album', 'camera']
      })
      tempFilePath =
        res.tempFiles && res.tempFiles[0] ? res.tempFiles[0].tempFilePath : ''
    } catch (e: any) {
      if (e && e.errMsg && e.errMsg.indexOf('cancel') > -1) {
        return
      }
      try {
        const res: any = await wx.chooseImage({
          count: 1,
          sizeType: ['compressed'],
          sourceType: ['album', 'camera']
        })
        tempFilePath = (res.tempFilePaths && res.tempFilePaths[0]) || ''
      } catch (err) {
        return
      }
    }
    if (!tempFilePath) {
      return
    }
    this.setData({ uploading: true })
    try {
      if (USE_CLOUD && wx.cloud) {
        const match = tempFilePath.match(/\.(\w+)$/)
        const ext = match ? match[1] : 'jpg'
        const upload: any = await wx.cloud.uploadFile({
          cloudPath: `dishes/${Date.now()}-${Math.floor(
            Math.random() * 10000
          )}.${ext}`,
          filePath: tempFilePath
        })
        this.setData({ image: upload.fileID })
      } else {
        // mock 模式下临时预览，重进小程序后失效
        this.setData({ image: tempFilePath })
      }
      wx.showToast({ title: '图片已上传', icon: 'none' })
    } catch (e) {
      wx.showToast({ title: '上传失败，稍后再试', icon: 'none' })
    } finally {
      this.setData({ uploading: false })
    }
  },

  onRemoveImage() {
    this.setData({ image: '' })
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
    const stock = Number(this.data.stock)
    if (!isFinite(stock) || stock < -1 || stock > 9999) {
      wx.showToast({ title: '库存填 -1 或 0-9999', icon: 'none' })
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
      stock: Math.floor(stock),
      isRecommended: this.data.isRecommended,
      image: this.data.image,
      recipe: this.data.recipe.trim()
    }

    this.setData({ saving: true })
    try {
      await saveDish(payload)
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
      backAfter(500)
    } catch (e: any) {
      wx.showToast({
        title: String((e && e.message) || '删除失败').slice(0, 40),
        icon: 'none'
      })
      this.setData({ deleting: false })
    }
  }
})
