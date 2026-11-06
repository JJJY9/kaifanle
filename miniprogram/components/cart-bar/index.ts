Component({
  properties: {
    count: { type: Number, value: 0 },
    total: { type: Number, value: 0 },
    otherCount: { type: Number, value: 0 }
  },

  methods: {
    onCheckout() {
      this.triggerEvent('checkout')
    },

    onOverview() {
      this.triggerEvent('overview')
    }
  }
})
