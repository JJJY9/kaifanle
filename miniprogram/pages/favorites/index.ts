import type { Dish } from '../../services/types'
import { getCategories, getDishes } from '../../services/api'
import { favorites } from '../../store/favorites'
import { getLastEatenMap } from '../../store/eaten'
import { formatDate } from '../../utils/format'
import { saveImageToAlbum } from '../../utils/save-image'

const POSTER_THEMES = [
  { header: '#FF5C8A', row: '#FFF7DA', accent: '#FF6B35' },
  { header: '#2D9CFF', row: '#EAF4FF', accent: '#FF6B35' },
  { header: '#2FBF71', row: '#E8F8EE', accent: '#FF6B35' }
]

Page({
  data: {
    loading: true,
    error: '',
    allFavorites: [] as Dish[],
    display: [] as Dish[],
    keyword: '',
    count: 0,
    sort: 'recent' as 'recent' | 'price' | 'eaten',
    categories: [] as any[],
    category: 'all',
    emptyTitle: '没搜到',
    emptyDesc: '换个菜名试试',
    posterMaking: false,
    posterPath: '',
    posterThemeIndex: 0
  },

  _unsub: null as null | (() => void),
  _lastRandomId: '',

  onLoad() {
    this._unsub = favorites.subscribe(() => {
      this.setData({ posterPath: '' }, () => this.applyFilter())
    })
  },

  onShow() {
    this.loadDishes()
    favorites.syncFromCloud(true).then(changed => {
      if (changed) {
        this.loadDishes()
      }
    })
  },

  onUnload() {
    if (this._unsub) {
      this._unsub()
      this._unsub = null
    }
  },

  async loadDishes() {
    try {
      const [dishes, categories] = await Promise.all([
        getDishes(),
        getCategories().catch(() => [])
      ])
      const dishMap: Record<string, any> = {}
      dishes.forEach(dish => {
        dishMap[dish.id] = dish
      })
      // 收藏 id 按收藏先后追加，倒序即最近收藏在前
      const allFavorites = favorites
        .getIds()
        .slice()
        .reverse()
        .map(id => {
          const dish = dishMap[id]
          if (!dish) {
            return null
          }
          const at = favorites.getTime(id)
          return {
            ...dish,
            favoritedAt: at,
            favoritedText: at ? formatDate(at) : '较早'
          }
        })
        .filter(Boolean)
      this.setData(
        {
          allFavorites,
          count: allFavorites.length,
          categories: categories || [],
          category: (categories || []).some(
            category => category.id === this.data.category
          )
            ? this.data.category
            : 'all',
          loading: false,
          error: '',
          posterPath: ''
        },
        () => this.applyFilter()
      )
    } catch (e: any) {
      this.setData({
        loading: false,
        error: String((e && e.message) || '收藏加载失败').slice(0, 60)
      })
    }
  },

  onSearch(e: any) {
    this.setData({ keyword: String(e.detail.value || '') }, () =>
      this.applyFilter()
    )
  },

  onClearSearch() {
    this.setData({ keyword: '' }, () => this.applyFilter())
  },

  applyFilter() {
    const keyword = String(this.data.keyword || '')
      .trim()
      .toLowerCase()
    const categoryNames: Record<string, string> = {}
    ;(this.data.categories || []).forEach((category: any) => {
      categoryNames[category.id] = String(category.name || '')
    })
    const source =
      this.data.category === 'all'
        ? this.data.allFavorites
        : this.data.allFavorites.filter(
            dish => dish.categoryId === this.data.category
          )
    const matched = keyword
      ? source.filter(dish =>
          `${dish.name} ${dish.desc || ''} ${
            categoryNames[dish.categoryId] || ''
          } ${(dish.tags || []).join(' ')}`
            .toLowerCase()
            .indexOf(keyword) > -1
        )
      : source.slice()
    const eatenMap = getLastEatenMap()
    const display =
      this.data.sort === 'price'
        ? matched.sort((a, b) => Number(a.price) - Number(b.price))
        : this.data.sort === 'eaten'
        ? matched.sort(
            (a: any, b: any) =>
              Number(eatenMap[b.id] || 0) - Number(eatenMap[a.id] || 0) ||
              Number(b.favoritedAt || 0) - Number(a.favoritedAt || 0)
          )
        : matched.sort(
            (a: any, b: any) =>
              Number(b.favoritedAt || 0) - Number(a.favoritedAt || 0)
          )
    const hasKeyword = Boolean(keyword)
    this.setData({
      display,
      emptyTitle: hasKeyword ? '没搜到' : '这个分类还没有收藏',
      emptyDesc: hasKeyword ? '换个菜名试试' : '换个分类看看'
    })
  },

  onCategory(e: any) {
    const category = String(e.currentTarget.dataset.id || 'all')
    if (category === this.data.category) {
      return
    }
    this.setData({ category }, () => this.applyFilter())
  },

  onSort(e: any) {
    const value = e.currentTarget.dataset.sort
    const sort =
      value === 'price' ? 'price' : value === 'eaten' ? 'eaten' : 'recent'
    if (sort === this.data.sort) {
      return
    }
    this.setData({ sort }, () => this.applyFilter())
  },

  onTapDish(e: any) {
    const id = e.currentTarget.dataset.id
    if (id) {
      wx.navigateTo({ url: '/pages/recipe/index?id=' + id })
    }
  },

  onRandomFavorite() {
    const pool =
      (this.data.display && this.data.display.length
        ? this.data.display
        : this.data.allFavorites) || []
    if (!pool.length) {
      wx.showToast({ title: '还没有收藏的菜', icon: 'none' })
      return
    }
    let pick = pool[Math.floor(Math.random() * pool.length)]
    if (pool.length > 1 && pick.id === this._lastRandomId) {
      const others = pool.filter((dish: Dish) => dish.id !== pick.id)
      pick = others[Math.floor(Math.random() * others.length)] || pick
    }
    this._lastRandomId = pick.id
    wx.navigateTo({ url: '/pages/recipe/index?id=' + pick.id })
  },

  onGoHome() {
    wx.switchTab({ url: '/pages/home/index' })
  },

  async onClearAll() {
    if (!this.data.count) {
      return
    }
    const res: any = await wx.showModal({
      title: '清空全部收藏？',
      content: '清空后可以重新收藏喜欢的菜。',
      confirmText: '清空',
      cancelText: '算了'
    })
    if (!res.confirm) {
      return
    }
    favorites.clear()
    this.setData({
      allFavorites: [],
      display: [],
      count: 0,
      posterPath: ''
    })
    wx.showToast({ title: '已清空收藏', icon: 'none' })
  },

  onRetry() {
    this.setData({ loading: true, error: '' })
    this.loadDishes()
  },

  onCyclePosterTheme() {
    this.setData(
      {
        posterThemeIndex:
          (Number(this.data.posterThemeIndex || 0) + 1) %
          POSTER_THEMES.length,
        posterPath: ''
      },
      () => {
        wx.showToast({ title: '配色已切换', icon: 'none' })
      }
    )
  },

  async onMakePoster() {
    if (this.data.posterMaking || !this.data.allFavorites.length) {
      return
    }
    this.setData({ posterMaking: true })
    try {
      const canvas: any = await new Promise((resolve, reject) => {
        wx.createSelectorQuery()
          .in(this)
          .select('#favoritesPoster')
          .fields({ node: true, size: true })
          .exec(res => {
            const node = res && res[0] && res[0].node
            if (node) {
              resolve(node)
            } else {
              reject(new Error('画布还没准备好'))
            }
          })
      })
      const dpr = (wx.getWindowInfo && wx.getWindowInfo().pixelRatio) || 2
      const width = 600
      const height = 1080
      canvas.width = width * dpr
      canvas.height = height * dpr
      const ctx = canvas.getContext('2d')
      ctx.scale(dpr, dpr)
      const theme =
        POSTER_THEMES[this.data.posterThemeIndex % POSTER_THEMES.length] ||
        POSTER_THEMES[0]

      ctx.fillStyle = '#FFFDF6'
      ctx.fillRect(0, 0, width, height)
      ctx.strokeStyle = '#111111'
      ctx.lineWidth = 8
      ctx.strokeRect(24, 24, width - 48, height - 48)

      ctx.fillStyle = theme.header
      ctx.fillRect(24, 24, width - 48, 132)
      ctx.fillStyle = '#FFFFFF'
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      ctx.font = 'bold 38px "PingFang SC", sans-serif'
      ctx.fillText('张饱饭堂 · 我的收藏', 48, 76)
      ctx.font = '23px "PingFang SC", sans-serif'
      ctx.fillText('想再吃一次的，都收在这里', 48, 120)
      ctx.textAlign = 'right'
      ctx.font = 'bold 30px "PingFang SC", sans-serif'
      ctx.fillText(`♡ ${this.data.allFavorites.length}`, width - 48, 76)

      const fit = (text: string, max: number) => {
        const value = String(text || '')
        return value.length > max ? value.slice(0, max) + '…' : value
      }
      const items = this.data.allFavorites.slice(0, 8)
      items.forEach((dish, index) => {
        const y = 188 + index * 92
        if (index % 2 === 0) {
          ctx.fillStyle = theme.row
          ctx.fillRect(40, y, width - 80, 84)
        }
        ctx.fillStyle = dish.color || '#FFD23F'
        ctx.fillRect(48, y + 10, 64, 64)
        ctx.strokeStyle = '#111111'
        ctx.lineWidth = 3
        ctx.strokeRect(48, y + 10, 64, 64)
        ctx.fillStyle = '#111111'
        ctx.textAlign = 'center'
        ctx.font = '32px "PingFang SC", sans-serif'
        ctx.fillText(dish.emoji || dish.char || '🍽', 80, y + 43)

        ctx.textAlign = 'left'
        ctx.fillStyle = '#111111'
        ctx.font = 'bold 26px "PingFang SC", sans-serif'
        ctx.fillText(fit(dish.name, 12), 130, y + 32)
        ctx.fillStyle = '#5C5C5C'
        ctx.font = '20px "PingFang SC", sans-serif'
        const subText = (dish.tags || []).length
          ? (dish.tags || []).join(' · ')
          : dish.desc || ''
        ctx.fillText(fit(subText, 18), 130, y + 64)

        ctx.textAlign = 'right'
        ctx.fillStyle = theme.accent
        ctx.font = 'bold 28px "PingFang SC", sans-serif'
        ctx.fillText(`¥${dish.price}`, width - 48, y + 42)
      })

      ctx.textAlign = 'left'
      if (this.data.allFavorites.length > 8) {
        ctx.fillStyle = '#5C5C5C'
        ctx.font = '21px "PingFang SC", sans-serif'
        ctx.fillText(
          `还有 ${this.data.allFavorites.length - 8} 道收藏没放进图里`,
          48,
          966
        )
      }
      ctx.fillStyle = '#5C5C5C'
      ctx.font = '22px "PingFang SC", sans-serif'
      ctx.fillText('她点单，你掌勺', 48, height - 52)
      ctx.textAlign = 'right'
      ctx.fillText('开饭咯', width - 48, height - 52)

      const path: string = await new Promise((resolve, reject) => {
        wx.canvasToTempFilePath({
          canvas,
          destWidth: canvas.width,
          destHeight: canvas.height,
          success: res => resolve(res.tempFilePath),
          fail: reject
        } as any)
      })
      this.setData({ posterMaking: false, posterPath: path })
      wx.showToast({ title: '收藏海报已生成', icon: 'none' })
    } catch (e: any) {
      this.setData({ posterMaking: false })
      wx.showToast({
        title: String((e && e.message) || '生成失败').slice(0, 40),
        icon: 'none'
      })
    }
  },

  onPreviewPoster() {
    const path = this.data.posterPath
    if (!path) {
      return
    }
    if (typeof (wx as any).showShareImageMenu === 'function') {
      ;(wx as any).showShareImageMenu({
        path,
        fail: () => {
          wx.previewImage({ urls: [path] })
        }
      })
      return
    }
    wx.previewImage({ urls: [path] })
  },

  onSavePoster() {
    const path = this.data.posterPath
    if (path) {
      saveImageToAlbum(path, '海报已保存')
    }
  },

  onShareAppMessage() {
    return {
      title: `我的收藏 · ${this.data.count} 道想再吃的菜`,
      path: '/pages/favorites/index'
    }
  },

  onShareTimeline() {
    return {
      title: `我的收藏 · ${this.data.count} 道想再吃的菜`,
      query: ''
    }
  }
})
