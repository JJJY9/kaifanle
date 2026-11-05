Component({
  properties: {
    count: { type: Number, value: 0 },
    total: { type: Number, value: 0 }
  },

  methods: {
    onCheckout() {
      this.triggerEvent('checkout')
    }
  }
})
