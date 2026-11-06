Component({
  properties: {
    dish: { type: Object, value: null },
    showAdd: { type: Boolean, value: true }
  },

  data: {
    imageFailed: false
  },

  observers: {
    dish() {
      this.setData({ imageFailed: false })
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
