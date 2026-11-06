import { getMe, getMyStats, initDb, getCoupons } from '../../services/api'
import { USE_CLOUD } from '../../config'
import { formatTime } from '../../utils/format'

Page({
  data: {
    user: {
      name: '干饭人',
      motto: '今天也要好好吃饭',
      char: '饭'
    },
    stats: {
      month: 0,
      total: 0,
      favorite: '还没点过'
    },
    cloudMode: USE_CLOUD,
    isAdmin: !USE_CLOUD,
    initialized: !USE_CLOUD,
    openid: '',
    entries: [] as any[]
  },

  onLoad() {
    this.setData({
      entries: this.buildEntries(!USE_CLOUD, !USE_CLOUD)
    })
  },

  onShow() {
    const tabBar: any = (this as any).getTabBar
      ? (this as any).getTabBar()
      : null
    if (tabBar) {
      tabBar.setData({ selected: 2 })
    }
    this.loadMe()
  },

  buildEntries(
    isAdmin: boolean,
    initialized: boolean,
    couponCount = 0
  ): any[] {
    const entries: any[] = [
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
        desc: couponCount
          ? `有 ${couponCount} 张还没用`
          : '洗碗券、奶茶券、夸夸卡',
        icon: '券',
        color: '#FFD23F'
      },
      {
        key: 'reviews',
        label: '我的评价',
        desc: '吃过的每一顿和掌勺人的回复',
        icon: '评',
        color: '#2FBF71'
      },
      {
        key: 'footprint',
        label: '干饭足迹',
        desc: '本月吃了多少、最爱哪道菜',
        icon: '饭',
        color: '#FF6B35'
      },
      {
        key: 'prefs',
        label: '口味与地址',
        desc: '忌口、口味、常用地址',
        icon: '味',
        color: '#FF6B35'
      }
    ]

    if (isAdmin) {
      entries.push({
        key: 'kitchen',
        label: '厨房端',
        desc: '接单、上下架（管理员）',
        icon: '厨',
        color: '#2D9CFF'
      })
    }

    if (USE_CLOUD && !initialized) {
      entries.push({
        key: 'init',
        label: '云环境初始化',
        desc: '首次使用，写入默认菜单',
        icon: '云',
        color: '#FF6B35'
      })
    }

    if (USE_CLOUD && isAdmin) {
      entries.push({
        key: 'openid',
        label: '我的 openid',
        desc: '点一下复制，用于添加管理员',
        icon: 'ID',
        color: '#FFD23F'
      })
      entries.push({
        key: 'logs',
        label: '运行日志',
        desc: '最近的小程序报错，方便排查',
        icon: '记',
        color: '#FF5C8A'
      })
    }

    entries.push({
      key: 'recipes',
      label: '菜谱大全',
      desc: '每道菜怎么做，都在这里',
      icon: '谱',
      color: '#2D9CFF'
    })

    entries.push({
      key: 'privacy',
      label: '隐私与数据',
      desc: '我们怎么使用你的信息',
      icon: '隐',
      color: '#B8B8B8'
    })

    entries.push({
      key: 'about',
      label: '关于开饭咯',
      desc: 'v0.2.0 · 还在长大',
      icon: '关',
      color: '#2FBF71'
    })

    return entries
  },

  async loadMe() {
    try {
      const [me, myStats, coupons] = await Promise.all([
        getMe(),
        getMyStats().catch(() => null),
        getCoupons().catch(() => [])
      ])
      const couponCount = (coupons || []).filter(
        coupon => coupon.owner === me.openid && coupon.status === 'unused'
      ).length

      this.setData({
        isAdmin: me.isAdmin,
        initialized: me.initialized,
        openid: me.openid,
        stats: {
          month: myStats ? myStats.month : 0,
          total: myStats ? myStats.total : 0,
          favorite: myStats ? myStats.favorite : '还没点过'
        },
        entries: this.buildEntries(me.isAdmin, me.initialized, couponCount)
      })
    } catch (e) {
      // 云环境还没连上时，云模式下按「未初始化」处理；mock 模式保持可用
      this.setData({
        isAdmin: !USE_CLOUD,
        initialized: !USE_CLOUD,
        openid: '',
        stats: { month: 0, total: 0, favorite: '还没点过' },
        entries: this.buildEntries(!USE_CLOUD, !USE_CLOUD)
      })
    }
  },

  async onEntryTap(e: any) {
    const key = e.currentTarget.dataset.key

    if (key === 'wish') {
      wx.navigateTo({ url: '/pages/wishes/index' })
      return
    }

    if (key === 'prefs') {
      wx.navigateTo({ url: '/pages/preferences/index' })
      return
    }

    if (key === 'coupon') {
      wx.navigateTo({ url: '/pages/coupons/index' })
      return
    }

    if (key === 'reviews') {
      wx.navigateTo({ url: '/pages/reviews/index' })
      return
    }

    if (key === 'footprint') {
      wx.navigateTo({ url: '/pages/my-report/index' })
      return
    }

    if (key === 'kitchen') {
      wx.navigateTo({ url: '/pages/kitchen/index' })
      return
    }

    if (key === 'init') {
      const res: any = await wx.showModal({
        title: '初始化云数据库？',
        content: '会写入默认菜单，并把当前账号设为管理员。只需执行一次。',
        confirmText: '初始化',
        cancelText: '再等等'
      })
      if (!res.confirm) {
        return
      }
      wx.showLoading({ title: '初始化中…' })
      try {
        await initDb()
        wx.hideLoading()
        wx.showToast({ title: '初始化完成', icon: 'none' })
        this.loadMe()
      } catch (err: any) {
        wx.hideLoading()
        wx.showToast({
          title: String((err && err.message) || '初始化失败').slice(0, 40),
          icon: 'none'
        })
      }
      return
    }

    if (key === 'openid') {
      if (this.data.openid) {
        wx.setClipboardData({ data: this.data.openid })
      }
      return
    }

    if (key === 'logs') {
      let logs: any[] = []
      try {
        logs = wx.getStorageSync('kfl_error_log') || []
      } catch (e) {
        logs = []
      }
      if (!logs.length) {
        wx.showToast({ title: '没有报错记录，一切正常', icon: 'none' })
        return
      }
      const text = logs
        .map(
          log =>
            `${formatTime(Number(log.time) || Date.now())} ${String(
              log.msg || ''
            )}`
        )
        .join('\n')
      wx.setClipboardData({ data: text })
      return
    }

    if (key === 'privacy') {
      wx.navigateTo({ url: '/pages/privacy/index' })
      return
    }

    if (key === 'recipes') {
      wx.navigateTo({ url: '/pages/recipe-list/index' })
      return
    }

    if (key === 'about') {
      wx.showModal({
        title: '开饭咯 v0.2.0',
        content: '一个只有一口锅的私厨点单小程序。她点单，你掌勺。',
        showCancel: false,
        confirmText: '好嘞'
      })
      return
    }

    wx.showToast({ title: 'V1.1 上线，先忍忍', icon: 'none' })
  }
})
