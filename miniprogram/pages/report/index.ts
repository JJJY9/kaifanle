import type { KitchenReport } from '../../services/types'
import { getAllOrders, getDishes, getKitchenReport } from '../../services/api'
import { ordersToCsv } from '../../utils/orders-csv'

interface BarView {
  date: string
  label: string
  amount: number
  height: number
  showLabel: boolean
}

Page({
  data: {
    loading: true,
    error: '',
    report: null as KitchenReport | null,
    bars: [] as BarView[],
    maxAmount: 0,
    health: null as any,
    exporting: false,
    exportCount: 0,
    exportingFile: false,
    exportedFile: false
  },

  _loadSeq: 0,

  onLoad() {
    this.load()
  },

  onPullDownRefresh() {
    this.load().then(() => wx.stopPullDownRefresh())
  },

  async load() {
    const seq = ++this._loadSeq
    this.setData({ loading: true, error: '' })
    try {
      const [report, dishes] = await Promise.all([
        getKitchenReport(),
        getDishes()
      ])
      if (seq !== this._loadSeq) {
        return
      }
      const health = {
        total: dishes.length,
        noRecipe: dishes.filter(dish => !dish.recipe).length,
        soldout: dishes.filter(
          dish => dish.status === 'soldout' || dish.stock === 0
        ).length,
        off: dishes.filter(dish => dish.status === 'off').length,
        lowStock: dishes.filter(
          dish =>
            dish.status === 'on' &&
            typeof dish.stock === 'number' &&
            dish.stock >= 0 &&
            dish.stock <= 3
        ).length
      }
      const maxAmount = Math.max(
        1,
        ...(report.daily || []).map(day => day.amount)
      )
      const bars = (report.daily || []).map((day, index) => ({
        date: day.date,
        label: day.label,
        amount: day.amount,
        height: day.amount
          ? Math.max(6, Math.round((day.amount / maxAmount) * 100))
          : 3,
        showLabel: index % 5 === 0 || index === report.daily.length - 1
      }))
      this.setData({ report, bars, maxAmount, health, loading: false })
    } catch (e: any) {
      if (seq !== this._loadSeq) {
        return
      }
      this.setData({
        loading: false,
        error: String((e && e.message) || '月报加载失败').slice(0, 60)
      })
    }
  },

  onRetry() {
    this.load()
  },

  async onExportFile() {
    if (this.data.exportingFile) {
      return
    }
    this.setData({ exportingFile: true })
    try {
      const orders = await getAllOrders()
      const csv = ordersToCsv(orders)
      const filePath = `${wx.env.USER_DATA_PATH}/orders-${Date.now()}.csv`
      await new Promise((resolve, reject) => {
        wx.getFileSystemManager().writeFile({
          filePath,
          data: csv,
          encoding: 'utf8',
          success: resolve,
          fail: reject
        })
      })
      this.setData({ exportingFile: false, exportedFile: true })
      if (typeof (wx as any).shareFileMessage === 'function') {
        ;(wx as any).shareFileMessage({
          filePath,
          fileName: '订单.csv',
          fail: () => {
            wx.showToast({
              title: '文件已生成，可先用复制 CSV',
              icon: 'none'
            })
          }
        })
      } else {
        wx.showToast({ title: '文件已生成', icon: 'none' })
      }
    } catch (e: any) {
      this.setData({ exportingFile: false })
      wx.showToast({
        title: String((e && e.message) || '导出失败').slice(0, 40),
        icon: 'none'
      })
    }
  },

  async onExport() {
    if (this.data.exporting) {
      return
    }
    this.setData({ exporting: true })
    try {
      const orders = await getAllOrders()
      const csv = ordersToCsv(orders)
      this.setData({ exporting: false, exportCount: orders.length })
      wx.setClipboardData({
        data: csv,
        fail: () => {
          this.setData({ exportCount: 0 })
          wx.showToast({ title: '复制失败，再试一次', icon: 'none' })
        }
      })
    } catch (e: any) {
      this.setData({ exporting: false })
      wx.showToast({
        title: String((e && e.message) || '导出失败').slice(0, 40),
        icon: 'none'
      })
    }
  }
})
