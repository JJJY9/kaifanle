Component({
  data: {
    selected: 0,
    list: [
      { pagePath: '/pages/home/index', text: '点餐' },
      { pagePath: '/pages/orders/index', text: '订单' },
      { pagePath: '/pages/profile/index', text: '我的' }
    ]
  },

  methods: {
    onSwitch(e: any) {
      const index = Number(e.currentTarget.dataset.index)
      const path = e.currentTarget.dataset.path
      if (index === this.data.selected) {
        return
      }
      wx.switchTab({ url: path })
    }
  }
})
