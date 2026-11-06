import { getDish, getMe } from '../../services/api'
import { favorites } from '../../store/favorites'

Page({
  data: {
    dish: null as any,
    steps: [] as string[],
    isAdmin: false,
    favorite: false,
    imageFailed: false,
    loading: true,
    error: '',
    posterMaking: false,
    posterPath: ''
  },

  dishId: '',

  onLoad(options: any) {
    this.dishId = options.id || ''
    this.setData({
      favorite: this.dishId ? favorites.has(this.dishId) : false
    })
    this.load()
  },

  onShow() {
    if (this.dishId) {
      this.setData({ favorite: favorites.has(this.dishId) })
    }
  },

  async load() {
    this.setData({ error: '' })
    try {
      const dish = await getDish(this.dishId)
      if (!dish) {
        throw new Error('菜品不存在')
      }
      const steps = String(dish.recipe || '')
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean)
      const me = await getMe().catch(() => null)
      this.setData({
        dish,
        steps,
        isAdmin: Boolean(me && me.isAdmin),
        favorite: favorites.has(dish.id),
        imageFailed: false,
        loading: false
      })
    } catch (e: any) {
      this.setData({
        loading: false,
        error: String((e && e.message) || '加载失败').slice(0, 40)
      })
    }
  },

  onRetry() {
    this.setData({ loading: true })
    this.load()
  },

  onImageError() {
    this.setData({ imageFailed: true })
  },

  onEdit() {
    if (this.data.isAdmin && this.dishId) {
      wx.navigateTo({ url: `/pages/dish-edit/index?id=${this.dishId}` })
    }
  },

  onToggleFavorite() {
    if (!this.dishId) {
      return
    }
    const favorite = favorites.toggle(this.dishId)
    this.setData({ favorite })
    wx.showToast({
      title: favorite ? '已收藏' : '已取消收藏',
      icon: 'none'
    })
  },

  onShareAppMessage() {
    const dish = this.data.dish
    return {
      title: dish ? `${dish.name} · 做法` : '张饱饭堂 · 菜谱',
      path: `/pages/recipe/index?id=${this.dishId}`
    }
  },

  async onSharePoster() {
    if (this.data.posterMaking || !this.data.dish) {
      return
    }
    const dish = this.data.dish
    this.setData({ posterMaking: true })
    try {
      const canvas: any = await new Promise((resolve, reject) => {
        wx.createSelectorQuery()
          .in(this)
          .select('#poster')
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
      const height = 900
      canvas.width = width * dpr
      canvas.height = height * dpr
      const ctx = canvas.getContext('2d')
      ctx.scale(dpr, dpr)

      ctx.fillStyle = '#FFFDF6'
      ctx.fillRect(0, 0, width, height)
      ctx.fillStyle = dish.color || '#FFD23F'
      ctx.fillRect(28, 28, width - 56, 330)
      ctx.strokeStyle = '#111111'
      ctx.lineWidth = 8
      ctx.strokeRect(28, 28, width - 56, height - 56)

      ctx.fillStyle = '#111111'
      ctx.font = '150px "PingFang SC", sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(dish.emoji || dish.char || '饭', width / 2, 190)

      ctx.textAlign = 'left'
      ctx.textBaseline = 'top'
      ctx.font = 'bold 46px "PingFang SC", sans-serif'
      const name = String(dish.name || '')
      let nameLine = name
      if (ctx.measureText(name).width > width - 96) {
        nameLine = name.slice(0, 11) + '…'
      }
      ctx.fillText(nameLine, 48, 400)

      ctx.fillStyle = '#5C5C5C'
      ctx.font = '26px "PingFang SC", sans-serif'
      const desc = String(dish.desc || '')
      const maxDesc = 22
      ctx.fillText(
        desc.length > maxDesc ? desc.slice(0, maxDesc) + '…' : desc,
        48,
        470
      )

      ctx.fillStyle = '#111111'
      ctx.font = 'bold 44px "PingFang SC", sans-serif'
      ctx.fillText(`¥${dish.price}`, 48, 540)

      if (dish.recipe) {
        const steps = String(dish.recipe)
          .split('\n')
          .map((line: string) => line.trim())
          .filter(Boolean)
          .slice(0, 3)
        ctx.fillStyle = '#5C5C5C'
        ctx.font = '24px "PingFang SC", sans-serif'
        steps.forEach((step: string, index: number) => {
          const text = step.length > 24 ? step.slice(0, 24) + '…' : step
          ctx.fillText(`${index + 1}. ${text}`, 48, 620 + index * 40)
        })
      }

      ctx.fillStyle = '#FF6B35'
      ctx.fillRect(48, 780, 150, 56)
      ctx.fillStyle = '#FFFFFF'
      ctx.font = 'bold 26px "PingFang SC", sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('开饭咯', 123, 812)
      ctx.fillStyle = '#5C5C5C'
      ctx.font = '22px "PingFang SC", sans-serif'
      ctx.textAlign = 'right'
      ctx.fillText('她点单，你掌勺', width - 48, 812)

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
      wx.showToast({ title: '海报已生成', icon: 'none' })
    } catch (e: any) {
      this.setData({ posterMaking: false })
      wx.showToast({
        title: String((e && e.message) || '海报生成失败').slice(0, 40),
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
    } else {
      wx.previewImage({ urls: [path] })
    }
  }
})
