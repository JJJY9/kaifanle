import type { Category } from '../../services/types'
import { deleteCategory, getCategories, saveCategory } from '../../services/api'

const COLORS = [
  '#FFD23F',
  '#2D9CFF',
  '#FF6B35',
  '#FF5C8A',
  '#2FBF71',
  '#B8B8B8'
]

Page({
  data: {
    categories: [] as Category[],
    name: '',
    color: COLORS[0],
    colors: COLORS,
    editingId: '',
    loading: true,
    saving: false,
    deletingId: ''
  },

  onShow() {
    this.load()
  },

  async load() {
    try {
      const categories = await getCategories()
      this.setData({ categories, loading: false })
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

  onSelectColor(e: any) {
    this.setData({ color: e.currentTarget.dataset.color })
  },

  onEdit(e: any) {
    const id = e.currentTarget.dataset.id
    const category = this.data.categories.find(item => item.id === id)
    if (!category) {
      return
    }
    this.setData({
      editingId: id,
      name: category.name,
      color: category.color
    })
  },

  onCancelEdit() {
    this.setData({ editingId: '', name: '', color: COLORS[0] })
  },

  async onSave() {
    if (this.data.saving) {
      return
    }
    const name = this.data.name.trim()
    if (!name) {
      wx.showToast({ title: '给分类起个名字', icon: 'none' })
      return
    }
    this.setData({ saving: true })
    try {
      await saveCategory({
        id: this.data.editingId || undefined,
        name,
        color: this.data.color
      })
      wx.showToast({ title: '已保存', icon: 'none' })
      this.setData({ editingId: '', name: '', color: COLORS[0] })
      this.load()
    } catch (e: any) {
      wx.showToast({
        title: String((e && e.message) || '保存失败').slice(0, 40),
        icon: 'none'
      })
    } finally {
      this.setData({ saving: false })
    }
  },

  async onDelete(e: any) {
    if (this.data.deletingId) {
      return
    }
    const id = e.currentTarget.dataset.id
    const category = this.data.categories.find(item => item.id === id)
    const res: any = await wx.showModal({
      title: `删除「${category ? category.name : '分类'}」？`,
      content: '分类下还有菜品时不能删除。',
      confirmText: '删除',
      cancelText: '算了'
    })
    if (!res.confirm) {
      return
    }
    this.setData({ deletingId: id })
    try {
      await deleteCategory(id)
      wx.showToast({ title: '已删除', icon: 'none' })
      if (this.data.editingId === id) {
        this.setData({ editingId: '', name: '', color: COLORS[0] })
      }
      this.load()
    } catch (e: any) {
      wx.showToast({
        title: String((e && e.message) || '删除失败').slice(0, 40),
        icon: 'none'
      })
    } finally {
      this.setData({ deletingId: '' })
    }
  }
})
