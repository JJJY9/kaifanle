import { CLOUD_ENV, USE_CLOUD } from './config'

App({
  globalData: {
    statusBarHeight: 20
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
  }
})
