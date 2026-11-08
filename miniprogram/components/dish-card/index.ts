Component({
  properties: {
    dish: { type: Object, value: null },
    showAdd: { type: Boolean, value: true }
  },

  data: {
    imageFailed: false,
    spicyText: ''
  },

  observers: {
    dish(dish: any) {
      const levels =
        dish && Array.isArray(dish.spicyLevels) ? dish.spicyLevels : []
      let spicyText = ''
      if (levels.indexOf('特辣') > -1) {
        spicyText = '🌶🌶'
      } else if (levels.indexOf('中辣') > -1) {
        spicyText = '🌶'
      }
      this.setData({ imageFailed: false, spicyText })
    }
  },

  methods: {
    onImageError() {
      this.setData({ imageFailed: true })
    },

    onTap() {
      const dish = this.data.dish
      if (!dish || dish.status === 'off') {
        return
      }
      this.triggerEvent('select', { dish })
    },

    onAdd() {
      this.triggerEvent('add', { dish: this.data.dish })
    },

    onRecipe() {
      if (this.data.dish && this.data.dish.recipe) {
        this.triggerEvent('recipe', { dish: this.data.dish })
      }
    }
  }
})
