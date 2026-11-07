import type { KitchenReport } from '../../services/types'
import {
  exportData,
  getAllOrders,
  getBusiness,
  getDishes,
  getKitchenReport,
  toggleDishStatus
} from '../../services/api'
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
    compare: null as any,
    exporting: false,
    exportCount: 0,
    exportingFile: false,
    exportedFile: false,
    dishesFileBusy: false,
    dishesFileReady: false,
    backupBusy: false,
    backupCount: 0,
    backupReady: false,
    slowBusyId: '',
    range: 30,
    monthlyGoal: 0,
    monthGoalPercent: 0,
    monthGoalText: '',
    monthCompare: null as any
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
      const [report, dishes, business] = await Promise.all([
        getKitchenReport(this.data.range),
        getDishes(),
        getBusiness().catch(() => null)
      ])
      if (seq !== this._loadSeq) {
        return
      }
      const thresholdValue = business
        ? Number(business.lowStockThreshold)
        : 3
      const lowStockThreshold =
        isFinite(thresholdValue) &&
        thresholdValue >= 0 &&
        thresholdValue <= 99
          ? Math.floor(thresholdValue)
          : 3
      const health = {
        total: dishes.length,
        lowStockThreshold,
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
            dish.stock <= lowStockThreshold
        ).length,
        noCost: dishes.filter(dish => !(Number(dish.cost) > 0)).length
      }
      const maxAmount = Math.max(
        0,
        ...(report.daily || []).map(day => day.amount)
      )
      const scale = Math.max(1, maxAmount)
      const bars = (report.daily || []).map((day, index) => ({
        date: day.date,
        label: day.label,
        amount: day.amount,
        height: day.amount
          ? Math.max(6, Math.round((day.amount / scale) * 100))
          : 3,
        showLabel: index % 5 === 0 || index === report.daily.length - 1
      }))
      const daily = report.daily || []
      const lastWeek = daily.slice(-7)
      const prevWeek = daily.slice(-14, -7)
      const sumAmount = (list: any[]) =>
        Number(
          list.reduce((sum, day) => sum + Number(day.amount || 0), 0).toFixed(2)
        )
      const sumCount = (list: any[]) =>
        list.reduce((sum, day) => sum + Number(day.count || 0), 0)
      const thisRevenue = sumAmount(lastWeek)
      const prevRevenue = sumAmount(prevWeek)
      const thisCount = sumCount(lastWeek)
      const prevCount = sumCount(prevWeek)
      const percent = (now: number, before: number) =>
        before > 0 ? Math.round(((now - before) / before) * 100) : null
      const revenueDelta = percent(thisRevenue, prevRevenue)
      const countDelta = percent(thisCount, prevCount)
      let compare: any = {
        thisRevenue,
        prevRevenue,
        thisCount,
        prevCount,
        revenueDelta,
        countDelta,
        revenueText:
          revenueDelta === null
            ? prevRevenue > 0 || thisRevenue === 0
              ? '持平'
              : '上周还没有营收'
            : `比上周 ${revenueDelta > 0 ? '+' : ''}${revenueDelta}%`,
        countText:
          countDelta === null
            ? prevCount > 0 || thisCount === 0
              ? '持平'
              : '上周还没有订单'
            : `比上周 ${countDelta > 0 ? '+' : ''}${countDelta}%`,
        trend:
          revenueDelta === null
            ? 'flat'
            : revenueDelta > 0
            ? 'up'
            : revenueDelta < 0
            ? 'down'
            : 'flat'
      }
      if (report.days === 7) {
        compare = null
      }
      const safeReport = Object.assign({}, report, {
        topRatedDishes: Array.isArray(report.topRatedDishes)
          ? report.topRatedDishes
          : [],
        minRatedOrders:
          Number.isInteger(Number(report.minRatedOrders)) &&
          Number(report.minRatedOrders) > 0
            ? Number(report.minRatedOrders)
            : 2
      })
      const monthlyGoalValue = Number(business && business.monthlyGoal)
      const monthlyGoal =
        isFinite(monthlyGoalValue) &&
        monthlyGoalValue >= 0 &&
        monthlyGoalValue <= 999999
          ? Math.floor(monthlyGoalValue)
          : 0
      const monthRevenue = Number(safeReport.monthRevenue || 0)
      const monthGoalPercent =
        monthlyGoal > 0
          ? Math.min(100, Math.round((monthRevenue / monthlyGoal) * 100))
          : 0
      const monthGoalText =
        monthlyGoal > 0
          ? monthRevenue >= monthlyGoal
            ? '本月达标啦 🎉'
            : `还差 ¥${Number((monthlyGoal - monthRevenue).toFixed(2))}`
          : ''
      const previousMonth = safeReport.previousMonth
      let monthCompare: any = null
      if (previousMonth) {
        const prevRevenue = Number(previousMonth.revenue || 0)
        const delta = percent(monthRevenue, prevRevenue)
        const rangeText = `${String(previousMonth.startDate || '').slice(
          5
        )} - ${String(previousMonth.endDate || '').slice(5)}`
        monthCompare = {
          revenue: prevRevenue,
          orders: Number(previousMonth.orders || 0),
          rangeText,
          text:
            delta === null
              ? prevRevenue === 0 && monthRevenue === 0
                ? '持平'
                : '上月同期还没有营收'
              : `较上月同期 ${delta > 0 ? '+' : ''}${delta}%`,
          trend:
            delta === null
              ? 'flat'
              : delta > 0
              ? 'up'
              : delta < 0
              ? 'down'
              : 'flat'
        }
      }
      this.setData({
        report: safeReport,
        bars,
        maxAmount,
        health,
        compare,
        monthlyGoal,
        monthGoalPercent,
        monthGoalText,
        monthCompare,
        loading: false
      })
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

  onRange(e: any) {
    const range = Number(e.currentTarget.dataset.range) === 7 ? 7 : 30
    if (range === this.data.range) {
      return
    }
    this.setData({ range }, () => this.load())
  },

  onDishTap(e: any) {
    const id = String((e.currentTarget && e.currentTarget.dataset.id) || '')
    if (!id) {
      return
    }
    wx.navigateTo({ url: '/pages/recipe/index?id=' + id })
  },

  onTagTap(e: any) {
    const tag = String((e.currentTarget && e.currentTarget.dataset.name) || '')
      .trim()
      .slice(0, 8)
    if (!tag) {
      return
    }
    wx.navigateTo({
      url: `/pages/kitchen/index?tag=${encodeURIComponent(tag)}`
    })
  },

  onHealthJump(e: any) {
    const filter = String(e.currentTarget.dataset.filter || '')
    if (!filter) {
      return
    }
    wx.navigateTo({
      url: `/pages/kitchen/index?filter=${filter}`
    })
  },

  async onSlowToggle(e: any) {
    const dishId = String(
      (e.currentTarget && e.currentTarget.dataset.id) || ''
    )
    if (!dishId || this.data.slowBusyId) {
      return
    }
    this.setData({ slowBusyId: dishId })
    try {
      const updated = await toggleDishStatus(dishId)
      if (updated) {
        const report = this.data.report
        if (report) {
          const previous = report.slowDishes.find(item => item.id === dishId)
          const health = this.data.health
          let nextHealth = health
          if (previous && health) {
            const threshold = Number(health.lowStockThreshold) || 0
            const stock = previous.stock
            const wasSoldout =
              previous.status === 'soldout' || stock === 0
            const isSoldout = updated.status === 'soldout' || stock === 0
            const wasLow =
              previous.status === 'on' &&
              typeof stock === 'number' &&
              stock >= 0 &&
              stock <= threshold
            const isLow =
              updated.status === 'on' &&
              typeof stock === 'number' &&
              stock >= 0 &&
              stock <= threshold
            nextHealth = {
              ...health,
              soldout: Math.max(
                0,
                health.soldout + (isSoldout ? 1 : 0) - (wasSoldout ? 1 : 0)
              ),
              lowStock: Math.max(
                0,
                health.lowStock + (isLow ? 1 : 0) - (wasLow ? 1 : 0)
              )
            }
          }
          this.setData({
            report: {
              ...report,
              slowDishes: report.slowDishes.map(item =>
                item.id === dishId
                  ? { ...item, status: updated.status }
                  : item
              )
            },
            health: nextHealth
          })
        }
        wx.showToast({
          title: updated.status === 'soldout' ? '已设为售罄' : '已恢复供应',
          icon: 'none'
        })
      }
    } catch (err: any) {
      wx.showToast({
        title: String((err && err.message) || '操作失败').slice(0, 40),
        icon: 'none'
      })
    } finally {
      this.setData({ slowBusyId: '' })
    }
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

  async onBackup() {
    if (this.data.backupBusy) {
      return
    }
    this.setData({ backupBusy: true })
    try {
      const backup = await exportData()
      const json = JSON.stringify(backup, null, 2)
      const filePath = `${wx.env.USER_DATA_PATH}/kaifanle-backup-${Date.now()}.json`
      await new Promise((resolve, reject) => {
        wx.getFileSystemManager().writeFile({
          filePath,
          data: json,
          encoding: 'utf8',
          success: resolve,
          fail: reject
        })
      })
      const total = Object.keys(backup.counts || {}).reduce(
        (sum, key) => sum + Number(backup.counts[key] || 0),
        0
      )
      this.setData({
        backupBusy: false,
        backupCount: total,
        backupReady: true
      })
      if (typeof (wx as any).shareFileMessage === 'function') {
        ;(wx as any).shareFileMessage({
          filePath,
          fileName: '张饱饭堂备份.json',
          fail: () => {
            wx.showToast({ title: '备份文件已生成', icon: 'none' })
          }
        })
      } else {
        wx.showToast({ title: '备份文件已生成', icon: 'none' })
      }
    } catch (e: any) {
      this.setData({ backupBusy: false })
      wx.showToast({
        title: String((e && e.message) || '备份失败').slice(0, 40),
        icon: 'none'
      })
    }
  },

  onExportDishes() {
    const csv = this.buildDishCsv()
    if (!csv) {
      return
    }
    wx.setClipboardData({
      data: csv,
      fail: () => {
        wx.showToast({ title: '复制失败，再试一次', icon: 'none' })
      }
    })
  },

  buildDishCsv(): string {
    const rows = (this.data.report && this.data.report.dishRows) || []
    if (!rows.length) {
      wx.showToast({ title: '还没有菜品数据', icon: 'none' })
      return ''
    }
    const statusText = (status: string) =>
      status === 'off' ? '已下架' : status === 'soldout' ? '售罄' : '供应中'
    const quote = (value: any) =>
      `"${String(value === null || value === undefined ? '' : value).replace(
        /"/g,
        '""'
      )}"`
    const header = ['菜品', '状态', '销量', '营收', '成本', '毛利', '毛利率']
    const lines = rows.map(row =>
      [
        row.name,
        statusText(row.status),
        row.qty,
        row.revenue,
        row.cost === null ? '' : row.cost,
        row.profit === null ? '' : row.profit,
        row.margin === null ? '' : `${row.margin}%`
      ]
        .map(quote)
        .join(',')
    )
    return '﻿' + [header.join(','), ...lines].join('\n')
  },

  async onExportDishesFile() {
    if (this.data.dishesFileBusy) {
      return
    }
    const csv = this.buildDishCsv()
    if (!csv) {
      return
    }
    this.setData({ dishesFileBusy: true })
    try {
      const filePath = `${wx.env.USER_DATA_PATH}/dishes-${Date.now()}.csv`
      await new Promise((resolve, reject) => {
        wx.getFileSystemManager().writeFile({
          filePath,
          data: csv,
          encoding: 'utf8',
          success: resolve,
          fail: reject
        })
      })
      this.setData({ dishesFileBusy: false, dishesFileReady: true })
      if (typeof (wx as any).shareFileMessage === 'function') {
        ;(wx as any).shareFileMessage({
          filePath,
          fileName: '菜品销量.csv',
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
      this.setData({ dishesFileBusy: false })
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
