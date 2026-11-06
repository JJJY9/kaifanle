import { CLOUD_ENV, USE_CLOUD } from './config'

App({
  globalData: {
    statusBarHeight: 20,
    pendingReorder: null as null | { meal: string; date: string }
  },

  onLaunch() {
    try {
      const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
      this.globalData.statusBarHeight = info.statusBarHeight || 20
    } catch (e) {
      // 保持默认值即可
    }

    if (USE_CLOUD) {
      try {
        if (!wx.cloud) {
          throw new Error('当前基础库不支持云开发')
        }
        const options: any = { traceUser: true }
        if (CLOUD_ENV) {
          options.env = CLOUD_ENV
        }
        wx.cloud.init(options)
      } catch (e) {
        console.error('云开发初始化失败：', e)
      }
    }

    // 得意黑用于标题。生产环境需要把 cdn.jsdelivr.net 加入
    // 小程序后台的 downloadFile 合法域名；加载失败会自动回退系统字体。
    wx.loadFontFace({
      family: 'SmileySans',
      source: 'url("https://cdn.jsdelivr.net/npm/@fontpkg/smiley-sans@2.0.4/SmileySans-Oblique.ttf.woff2")',
      global: true,
      scopes: ['webview'],
      success() {},
      fail() {}
    })

    // 发布新版本后提示重启
    try {
      const updateManager =
        wx.getUpdateManager && wx.getUpdateManager()
      if (updateManager) {
        updateManager.onUpdateReady(() => {
          wx.showModal({
            title: '新版本已就绪',
            content: '重启一下就能用上新功能',
            confirmText: '重启',
            showCancel: false,
            success(res: any) {
              if (res.confirm) {
                updateManager.applyUpdate()
              }
            }
          })
        })
      }
    } catch (e) {
      // 老基础库没有更新管理器时忽略
    }
  },

  // 出错时留一份本地记录，方便排查偶发问题
  onError(err: any) {
    this._logError(err)
  },

  onUnhandledRejection(res: any) {
    this._logError(res && res.reason)
  },

  _logError(err: any) {
    try {
      const logs = wx.getStorageSync('kfl_error_log') || []
      logs.unshift({
        time: Date.now(),
        msg: String((err && (err.message || err.errMsg)) || err).slice(0, 300)
      })
      wx.setStorageSync('kfl_error_log', logs.slice(0, 10))
    } catch (e) {
      // 记录失败不影响正常使用
    }
  }
})
