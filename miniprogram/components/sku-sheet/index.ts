import { favorites } from '../../store/favorites'

Component({
  properties: {
    visible: { type: Boolean, value: false },
    dish: { type: Object, value: null }
  },

  data: {
    spicyIndex: 0,
    spicyLevels: [] as string[],
    addons: [] as any[],
    addonChecked: {} as Record<string, boolean>,
    note: '',
    qty: 1,
    unitPrice: 0,
    totalPrice: 0,
    recipeLines: [] as string[],
    recipeOpen: false,
    favorite: false,
    imageFailed: false,
    // 滚动区高度上限（px）。部分机型内核不认 vh/flex 约束，
    // 内容一长（做法展开）会把底部「加购」顶出屏幕，这里用 px 兜底。
    bodyMaxHeight: 0,
    windowHeight: 0,
    // 键盘弹起时给 .sheet 的 max-height（px）：弹层被 mask 的 padding 顶到键盘上方后，
    // 高度必须同步缩到「视口 - 键盘」，否则顶部（含 × 关闭按钮）会被挤出屏幕
    sheetMaxHeight: 0,
    // 备注输入时的键盘高度（px），弹层整体上移避免盖住「加购」
    kbHeight: 0
  },

  attached() {
    this.measureBody()
  },

  observers: {
    'visible, dish': function (visible: boolean, dish: any) {
      if (visible && dish) {
        this.reset(dish)
      }
    }
  },

  methods: {
    measureBody() {
      let height = 0
      try {
        const info: any = wx.getWindowInfo
          ? wx.getWindowInfo()
          : wx.getSystemInfoSync()
        height = Number(info.windowHeight || info.screenHeight || 0)
      } catch (e) {
        height = 0
      }
      if (height > 0) {
        const bodyMaxHeight = Math.round(height * 0.46)
        if (
          bodyMaxHeight !== this.data.bodyMaxHeight ||
          height !== this.data.windowHeight
        ) {
          this.setData({ bodyMaxHeight, windowHeight: height })
        }
      }
    },

    reset(dish: any) {
      // 自定义组件属性里的空数组可能被序列化成对象，这里统一兜底
      const spicyLevels = Array.isArray(dish.spicyLevels)
        ? dish.spicyLevels
        : []
      const addons = Array.isArray(dish.addons) ? dish.addons : []
      const recipeLines = String(dish.recipe || '')
        .split('\n')
        .map((line: string) => line.trim())
        .filter(Boolean)
      this.setData({
        spicyIndex: 0,
        spicyLevels,
        addons,
        addonChecked: {},
        note: '',
        qty: 1,
        unitPrice: dish.price,
        totalPrice: dish.price,
        recipeLines,
        recipeOpen: false,
        favorite: favorites.has(dish.id),
        imageFailed: false,
        kbHeight: 0,
        sheetMaxHeight: 0
      })
      if (!this.data.bodyMaxHeight) {
        this.measureBody()
      }
    },

    onImageError() {
      this.setData({ imageFailed: true })
    },

    recompute() {
      const dish = this.data.dish
      if (!dish) {
        return
      }
      const addonSum = this.data.addons
        .filter((addon: any) => this.data.addonChecked[addon.id])
        .reduce((sum: number, addon: any) => sum + addon.price, 0)
      const unit = dish.price + addonSum
      this.setData({ unitPrice: unit, totalPrice: unit * this.data.qty })
    },

    onSpicy(e: any) {
      this.setData({ spicyIndex: Number(e.currentTarget.dataset.index) })
    },

    onToggleAddon(e: any) {
      const id = e.currentTarget.dataset.id
      const checked = { ...this.data.addonChecked }
      checked[id] = !checked[id]
      this.setData({ addonChecked: checked }, () => this.recompute())
    },

    onNote(e: any) {
      this.setData({ note: e.detail.value })
    },

    onNoteFocus(e: any) {
      this.applyKeyboard(Number((e.detail && e.detail.height) || 0))
    },

    onNoteBlur() {
      this.applyKeyboard(0)
    },

    onNoteKb(e: any) {
      this.applyKeyboard(Number((e.detail && e.detail.height) || 0))
    },

    applyKeyboard(rawHeight: number) {
      const kbHeight = rawHeight > 0 ? Math.round(rawHeight) : 0
      const windowHeight = this.data.windowHeight || 0
      const sheetMaxHeight =
        kbHeight > 0 && windowHeight > 0
          ? Math.max(160, Math.round(windowHeight - kbHeight - 16))
          : 0
      if (
        kbHeight === this.data.kbHeight &&
        sheetMaxHeight === this.data.sheetMaxHeight
      ) {
        return
      }
      this.setData({ kbHeight, sheetMaxHeight })
    },

    onToggleRecipe() {
      this.setData({ recipeOpen: !this.data.recipeOpen })
    },

    onToggleFavorite() {
      const dish = this.data.dish
      if (!dish) {
        return
      }
      const favorite = favorites.toggle(dish.id)
      this.setData({ favorite })
      wx.showToast({
        title: favorite ? '已收藏' : '已取消收藏',
        icon: 'none'
      })
    },

    onMinus() {
      if (this.data.qty <= 1) {
        return
      }
      this.setData({ qty: this.data.qty - 1 }, () => this.recompute())
    },

    onPlus() {
      if (this.data.qty >= 20) {
        return
      }
      this.setData({ qty: this.data.qty + 1 }, () => this.recompute())
    },

    onClose() {
      this.triggerEvent('close')
    },

    noop() {},

    onConfirm() {
      const dish = this.data.dish
      if (!dish) {
        return
      }
      const specs: string[] = []
      if (this.data.spicyLevels.length) {
        specs.push(this.data.spicyLevels[this.data.spicyIndex])
      }
      this.data.addons.forEach((addon: any) => {
        if (this.data.addonChecked[addon.id]) {
          specs.push(addon.name)
        }
      })
      this.triggerEvent('add', {
        line: {
          key: '',
          dishId: dish.id,
          name: dish.name,
          price: this.data.unitPrice,
          qty: this.data.qty,
          specs,
          note: this.data.note.trim(),
          color: dish.color
        }
      })
    }
  }
})
