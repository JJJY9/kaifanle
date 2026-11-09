import { cart } from '../store/cart'

Component({
  data: {
    selected: 0,
    cartCount: 0,
    // 弹层类浮层（规格弹层）打开时隐藏 tabBar：自定义 tabBar 渲染在页面 fixed 遮罩之上，
    // 不隐藏会盖住弹层底部操作栏
    hidden: false,
    list: [
      { pagePath: '/pages/home/index', text: '点餐' },
      { pagePath: '/pages/orders/index', text: '订单' },
      { pagePath: '/pages/profile/index', text: '我的' }
    ]
  },

  _unsub: null as null | (() => void),

  lifetimes: {
    attached() {
      this._unsub = cart.subscribe(lines => {
        const count = lines.reduce((sum, line) => sum + line.qty, 0)
        this.setData({ cartCount: count })
      })
    },
    detached() {
      if (this._unsub) {
        this._unsub()
        this._unsub = null
      }
    }
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
