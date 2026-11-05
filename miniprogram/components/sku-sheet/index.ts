Component({
  properties: {
    visible: { type: Boolean, value: false },
    dish: { type: Object, value: null }
  },

  data: {
    spicyIndex: 0,
    addonChecked: {} as Record<string, boolean>,
    note: '',
    qty: 1,
    unitPrice: 0,
    totalPrice: 0
  },

  observers: {
    'visible, dish': function (visible: boolean, dish: any) {
      if (visible && dish) {
        this.reset(dish)
      }
    }
  },

  methods: {
    reset(dish: any) {
      this.setData({
        spicyIndex: 0,
        addonChecked: {},
        note: '',
        qty: 1,
        unitPrice: dish.price,
        totalPrice: dish.price
      })
    },

    recompute() {
      const dish = this.data.dish
      if (!dish) {
        return
      }
      const addonSum = (dish.addons || [])
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
      if (dish.spicyLevels && dish.spicyLevels.length) {
        specs.push(dish.spicyLevels[this.data.spicyIndex])
      }
      ;(dish.addons || []).forEach((addon: any) => {
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
