import type { KitchenReport } from '../../services/types'
import { getAllOrders, getKitchenReport } from '../../services/api'
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
    exporting: false,
    exportCount: 0
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
      const report = await getKitchenReport()
      if (seq !== this._loadSeq) {
        return
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
      this.setData({ report, bars, maxAmount, loading: false })
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
