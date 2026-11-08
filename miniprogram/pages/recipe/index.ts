import { getDish, getDishStats, getMe } from '../../services/api'
import { favorites } from '../../store/favorites'
import { cart } from '../../store/cart'
import { currentMeal, dateInputString, dateLabel } from '../../utils/format'
import { saveImageToAlbum } from '../../utils/save-image'

const STEP_PROGRESS_KEY = 'kfl_recipe_steps_v1'
const INGREDIENT_PROGRESS_KEY = 'kfl_recipe_ingredients_v1'
const MEAL_TEXT: Record<string, string> = {
  breakfast: '早餐',
  lunch: '午餐',
  dinner: '晚餐'
}

function readDishProgress(key: string): Record<string, number[]> {
  try {
    const raw = wx.getStorageSync(key)
    const data = raw ? JSON.parse(raw) : {}
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return {}
    }
    const result: Record<string, number[]> = {}
    Object.keys(data).forEach(id => {
      if (Array.isArray(data[id])) {
        result[id] = data[id]
          .map((value: any) => Number(value))
          .filter(value => Number.isInteger(value) && value >= 0)
      }
    })
    return result
  } catch (e) {
    return {}
  }
}

function writeDishProgress(key: string, dishId: string, indices: number[]) {
  if (!dishId) {
    return
  }
  try {
    const data = readDishProgress(key)
    if (indices.length) {
      data[dishId] = indices
    } else {
      delete data[dishId]
    }
    wx.setStorageSync(key, JSON.stringify(data))
  } catch (e) {
    // 忽略存储失败
  }
}

Page({
  data: {
    dish: null as any,
    steps: [] as string[],
    stepViews: [] as { text: string; done: boolean }[],
    doneCount: 0,
    ingredientViews: [] as { text: string; done: boolean }[],
    doneIngredients: 0,
    isAdmin: false,
    favorite: false,
    imageFailed: false,
    statsText: '',
    loading: true,
    error: '',
    posterMaking: false,
    posterPath: '',
    skuVisible: false,
    skuDish: null as any,
    orderMeal: 'lunch' as string,
    orderMealText: '午餐',
    orderTargetText: '午餐',
    canOrder: false,
    orderBlockedText: '',
    cookMode: false,
    cookIndex: 0,
    cookElapsedText: '00:00'
  },

  dishId: '',
  orderDate: '',
  requestedMeal: '',
  _cookTimer: null as any,
  _cookStepSeconds: 0,
  _cookTotalSeconds: 0,

  onLoad(options: any) {
    this.dishId = options.id || ''
    const today = dateInputString()
    const max = new Date()
    max.setDate(max.getDate() + 7)
    const maxDate = dateInputString(max)
    const requestedDate = String(options.date || '')
    this.orderDate =
      requestedDate && requestedDate >= today && requestedDate <= maxDate
        ? requestedDate
        : today
    const requestedMeal = String(options.meal || '')
    this.requestedMeal =
      ['breakfast', 'lunch', 'dinner'].indexOf(requestedMeal) > -1
        ? requestedMeal
        : ''
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
      const [me, stats] = await Promise.all([
        getMe().catch(() => null),
        getDishStats(dish.id).catch(() => null)
      ])
      let statsText = ''
      if (stats && stats.orders > 0) {
        statsText = `近 ${stats.days} 天被点 ${stats.orders} 次 · 共 ${stats.qty} 份`
        statsText +=
          stats.ratedCount > 0
            ? ` · 平均 ${stats.avgRating}/3 分 · 好评率 ${stats.goodRate}%`
            : ' · 暂无评分'
        const lastAt = Number(stats.lastAt || 0)
        if (lastAt) {
          const last = new Date(lastAt)
          last.setHours(0, 0, 0, 0)
          const todayStart = new Date()
          todayStart.setHours(0, 0, 0, 0)
          const diff = Math.round(
            (todayStart.getTime() - last.getTime()) / 86400000
          )
          const when =
            diff <= 0 ? '今天' : diff === 1 ? '昨天' : `${diff} 天前`
          statsText += ` · 最近 ${when}点过`
        }
      }
      const doneIndices = readDishProgress(STEP_PROGRESS_KEY)[dish.id] || []
      const stepViews = steps.map((text, index) => ({
        text,
        done: doneIndices.indexOf(index) > -1
      }))
      const ingredients = (dish.ingredients || [])
        .map((item: any) => String(item || '').trim())
        .filter(Boolean)
      const ingredientDone =
        readDishProgress(INGREDIENT_PROGRESS_KEY)[dish.id] || []
      const ingredientViews = ingredients.map((text: string, index: number) => ({
        text,
        done: ingredientDone.indexOf(index) > -1
      }))
      const dishMeals =
        Array.isArray((dish as any).meals) && (dish as any).meals.length
          ? ((dish as any).meals as string[])
          : ['breakfast', 'lunch', 'dinner']
      const preferredMeal = currentMeal()
      const orderMeal =
        this.requestedMeal && dishMeals.indexOf(this.requestedMeal) > -1
          ? this.requestedMeal
          : dishMeals.indexOf(preferredMeal) > -1
          ? preferredMeal
          : ['lunch', 'dinner', 'breakfast'].find(
              meal => dishMeals.indexOf(meal) > -1
            ) || 'lunch'
      const today = dateInputString()
      const orderDateLabel = dateLabel(
        this.orderDate || today,
        today
      )
      const orderTargetText = `${
        orderDateLabel === '今天' ? '' : orderDateLabel
      }${MEAL_TEXT[orderMeal] || '午餐'}`
      const soldOut = dish.status === 'soldout' || dish.stock === 0
      this.setData({
        dish,
        steps,
        stepViews,
        doneCount: stepViews.filter(step => step.done).length,
        ingredientViews,
        doneIngredients: ingredientViews.filter(step => step.done).length,
        isAdmin: Boolean(me && me.isAdmin),
        favorite: favorites.has(dish.id),
        imageFailed: false,
        statsText,
        orderMeal,
        orderMealText: MEAL_TEXT[orderMeal] || '午餐',
        orderTargetText,
        canOrder: !soldOut && dish.status !== 'off',
        orderBlockedText:
          dish.status === 'off' ? '已下架' : soldOut ? '今天卖完了' : '',
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

  onToggleStep(e: any) {
    const index = Number(e.currentTarget.dataset.index)
    const step = (this.data.stepViews || [])[index]
    if (!step) {
      return
    }
    const done = !step.done
    const nextViews = (this.data.stepViews || []).map((item, i) =>
      i === index ? { ...item, done } : item
    )
    const doneCount = nextViews.filter(item => item.done).length
    writeDishProgress(
      STEP_PROGRESS_KEY,
      this.dishId,
      nextViews
        .map((item, i) => (item.done ? i : -1))
        .filter(i => i > -1)
    )
    this.setData({
      [`stepViews[${index}].done`]: done,
      doneCount
    })
  },

  onCopyStep(e: any) {
    const index = Number(e.currentTarget.dataset.index)
    const step = (this.data.stepViews || [])[index]
    if (!step) {
      return
    }
    wx.setClipboardData({
      data: step.text,
      success: () => wx.showToast({ title: '步骤已复制', icon: 'none' })
    })
  },

  onResetSteps() {
    writeDishProgress(STEP_PROGRESS_KEY, this.dishId, [])
    this.setData({
      stepViews: (this.data.steps || []).map(text => ({
        text,
        done: false
      })),
      doneCount: 0
    })
  },

  onStartCook() {
    const steps = this.data.stepViews || []
    if (!steps.length) {
      wx.showToast({ title: '这道菜还没写做法', icon: 'none' })
      return
    }
    const firstUndone = steps.findIndex(step => !step.done)
    this._cookTotalSeconds = 0
    this.setData({
      cookMode: true,
      cookIndex: firstUndone > -1 ? firstUndone : 0
    })
    this.startCookTimer()
  },

  startCookTimer() {
    this.stopCookTimer()
    this._cookStepSeconds = 0
    this.setData({ cookElapsedText: '00:00' })
    this._cookTimer = setInterval(() => {
      this._cookStepSeconds += 1
      const seconds = this._cookStepSeconds
      const minutes = String(Math.floor(seconds / 60)).padStart(2, '0')
      const rest = String(seconds % 60).padStart(2, '0')
      this.setData({ cookElapsedText: `${minutes}:${rest}` })
    }, 1000)
  },

  accumulateCookStep() {
    if (this._cookStepSeconds > 0) {
      this._cookTotalSeconds += this._cookStepSeconds
      this._cookStepSeconds = 0
    }
  },

  stopCookTimer() {
    if (this._cookTimer) {
      clearInterval(this._cookTimer)
      this._cookTimer = null
    }
  },

  onCookPrev() {
    this.accumulateCookStep()
    this.setData({ cookIndex: Math.max(0, Number(this.data.cookIndex) - 1) })
    this.startCookTimer()
  },

  onCookNext() {
    const steps = this.data.stepViews || []
    const index = Number(this.data.cookIndex) || 0
    const step = steps[index]
    if (!step) {
      return
    }
    if (!step.done) {
      const nextViews = steps.map((item, i) =>
        i === index ? { ...item, done: true } : item
      )
      writeDishProgress(
        STEP_PROGRESS_KEY,
        this.dishId,
        nextViews.map((item, i) => (item.done ? i : -1)).filter(i => i > -1)
      )
      this.setData({
        [`stepViews[${index}].done`]: true,
        doneCount: nextViews.filter(item => item.done).length
      })
    }
    if (index >= steps.length - 1) {
      this.accumulateCookStep()
      this.stopCookTimer()
      this.setData({ cookMode: false })
      const total = this._cookTotalSeconds
      const minutes = Math.floor(total / 60)
      const rest = total % 60
      const timeText = minutes
        ? `${minutes} 分 ${rest} 秒`
        : `${rest} 秒`
      wx.showToast({
        title: `开饭啦 🍚 共用时 ${timeText}`,
        icon: 'none'
      })
      return
    }
    this.accumulateCookStep()
    this.setData({ cookIndex: index + 1 })
    this.startCookTimer()
  },

  onCookExit() {
    this.accumulateCookStep()
    this.stopCookTimer()
    this.setData({ cookMode: false })
  },

  onUnload() {
    this.stopCookTimer()
  },

  onToggleIngredient(e: any) {
    const index = Number(e.currentTarget.dataset.index)
    const item = (this.data.ingredientViews || [])[index]
    if (!item) {
      return
    }
    const done = !item.done
    const nextViews = (this.data.ingredientViews || []).map((view, i) =>
      i === index ? { ...view, done } : view
    )
    writeDishProgress(
      INGREDIENT_PROGRESS_KEY,
      this.dishId,
      nextViews.map((view, i) => (view.done ? i : -1)).filter(i => i > -1)
    )
    this.setData({
      [`ingredientViews[${index}].done`]: done,
      doneIngredients: nextViews.filter(view => view.done).length
    })
  },

  onCopyIngredients() {
    const dish = this.data.dish
    const views = this.data.ingredientViews || []
    if (!dish || !views.length) {
      return
    }
    const lines = views.map(view => `- ${view.text}`)
    const text = [`【${dish.name}】食材清单`].concat(lines).join('\n')
    wx.setClipboardData({
      data: text,
      success: () => {
        wx.showToast({ title: '食材清单已复制', icon: 'none' })
      }
    })
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

  onOrderDish() {
    const dish = this.data.dish
    if (!dish) {
      return
    }
    if (!this.data.canOrder) {
      wx.showToast({
        title: this.data.orderBlockedText || '暂时不能点',
        icon: 'none'
      })
      return
    }
    this.setData({ skuDish: dish, skuVisible: true })
  },

  onSkuClose() {
    this.setData({ skuVisible: false })
  },

  onSkuAdd(e: any) {
    if (!e || !e.detail || !e.detail.line) {
      return
    }
    cart.add({
      ...e.detail.line,
      meal: this.data.orderMeal,
      date: this.orderDate || dateInputString()
    })
    this.setData({ skuVisible: false })
    wx.showToast({ title: '已加购', icon: 'none' })
  },

  onShareAppMessage() {
    const dish = this.data.dish
    return {
      title: dish ? `${dish.name} · 做法` : '张饱饭堂 · 菜谱',
      path: `/pages/recipe/index?id=${this.dishId}`
    }
  },

  onShareTimeline() {
    const dish = this.data.dish
    return {
      title: dish ? `${dish.name} · 做法` : '张饱饭堂 · 菜谱',
      query: `id=${this.dishId}`
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
  },

  onSavePoster() {
    const path = this.data.posterPath
    if (path) {
      saveImageToAlbum(path, '海报已保存')
    }
  }
})
