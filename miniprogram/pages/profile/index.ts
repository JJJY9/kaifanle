Page({
  data: {
    user: {
      name: '小董',
      motto: '今天也要好好吃饭',
      char: '董'
    },
    stats: {
      month: 12,
      favorite: '番茄牛腩饭'
    },
    entries: [
      {
        key: 'wish',
        label: '许愿池',
        desc: '想吃什么，许个愿',
        icon: '愿',
        color: '#FF5C8A'
      },
      {
        key: 'coupon',
        label: '爱心券',
        desc: '洗碗券、奶茶券、夸夸卡',
        icon: '券',
        color: '#FFD23F'
      },
      {
        key: 'kitchen',
        label: '厨房端',
        desc: '接单、上下架（管理员）',
        icon: '厨',
        color: '#2D9CFF'
      },
      {
        key: 'about',
        label: '关于开饭咯',
        desc: 'v0.1.0 · 还在长大',
        icon: '关',
        color: '#2FBF71'
      }
    ]
  },

  onShow() {
    const tabBar: any = (this as any).getTabBar
      ? (this as any).getTabBar()
      : null
    if (tabBar) {
      tabBar.setData({ selected: 2 })
    }
  },

  onEntryTap(e: any) {
    const key = e.currentTarget.dataset.key
    if (key === 'kitchen') {
      wx.navigateTo({ url: '/pages/kitchen/index' })
      return
    }
    if (key === 'about') {
      wx.showModal({
        title: '开饭咯 v0.1.0',
        content: '一个只有一口锅的私厨点单小程序。她点单，你掌勺。',
        showCancel: false,
        confirmText: '好嘞'
      })
      return
    }
    wx.showToast({ title: 'V1.1 上线，先忍忍', icon: 'none' })
  }
})
