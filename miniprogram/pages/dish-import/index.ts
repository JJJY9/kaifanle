import type { Category, MealId } from '../../services/types'
import { getCategories, getDishes, saveDish } from '../../services/api'

const COLORS = ['#FFD23F', '#2D9CFF', '#FF6B35', '#FF5C8A', '#2FBF71']
const EXAMPLE_TEXT =
  '番茄炒蛋,12,小炒,午晚,20,5\n紫菜蛋花汤,6,汤羹,午晚\n豆浆,3,饮品,早,50,1.5'

interface ParsedRow {
  name: string
  price: number
  categoryName: string
  categoryId: string
  meals: MealId[]
  mealsText: string
  stock: number
  stockText: string
  cost: number
  costText: string
  error: string
}

function parseMeals(text: string): MealId[] {
  const value = String(text || '')
  const meals: MealId[] = []
  if (value.indexOf('早') > -1) {
    meals.push('breakfast')
  }
  if (value.indexOf('午') > -1) {
    meals.push('lunch')
  }
  if (value.indexOf('晚') > -1) {
    meals.push('dinner')
  }
  return meals.length ? meals : ['lunch', 'dinner']
}

Page({
  data: {
    text: '',
    parsed: [] as ParsedRow[],
    categories: [] as Category[],
    importing: false,
    result: ''
  },

  onLoad() {
    this.loadCategories()
  },

  async loadCategories() {
    try {
      const categories = await getCategories()
      this.setData({ categories }, () => this.parse())
    } catch (e) {
      // 分类加载失败时保留空列表，预览会提示分类错误
    }
  },

  onText(e: any) {
    this.setData({ text: String(e.detail.value || '') }, () => this.parse())
  },

  onFillExample() {
    this.setData({ text: EXAMPLE_TEXT }, () => this.parse())
  },

  parse() {
    const categoryMap: Record<string, Category> = {}
    ;(this.data.categories || []).forEach(category => {
      categoryMap[category.name] = category
    })
    const rows = String(this.data.text || '')
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => {
        const parts = line.split(/[,，\t]/).map(part => part.trim())
        const name = String(parts[0] || '').slice(0, 20)
        const priceRaw = String(parts[1] || '').trim()
        const price = Number(priceRaw)
        const categoryName = String(parts[2] || '主食').slice(0, 8)
        const category = categoryMap[categoryName]
        const meals = parseMeals(parts[3] || '')
        const stockRaw = String(parts[4] || '').trim()
        const stockValue = Number(stockRaw)
        const stock = !stockRaw
          ? -1
          : isFinite(stockValue) &&
            stockValue >= 0 &&
            stockValue <= 9999
          ? Math.floor(stockValue)
          : -1
        const costRaw = String(parts[5] || '').trim()
        const costValue = Number(costRaw)
        const cost = costRaw ? Math.round(costValue * 100) / 100 : 0
        let error = ''
        if (!name) {
          error = '缺少菜名'
        } else if (!priceRaw) {
          error = '缺少价格'
        } else if (!isFinite(price) || price < 0 || price > 999) {
          error = '价格不对'
        } else if (!category) {
          error = `分类「${categoryName}」不存在`
        } else if (
          stockRaw &&
          (!isFinite(stockValue) || stockValue < 0 || stockValue > 9999)
        ) {
          error = '库存不对'
        } else if (
          costRaw &&
          (!isFinite(costValue) || costValue < 0 || costValue > 999)
        ) {
          error = '成本不对'
        }
        return {
          name,
          price: isFinite(price) ? price : 0,
          categoryName,
          categoryId: category ? category.id : '',
          meals,
          mealsText: meals
            .map(meal =>
              meal === 'breakfast' ? '早餐' : meal === 'lunch' ? '午餐' : '晚餐'
            )
            .join('/'),
          stock,
          stockText: stock < 0 ? '不限量' : `${stock} 份`,
          cost,
          costText: cost > 0 ? `¥${cost}` : '成本未填',
          error
        }
      })
    this.setData({ parsed: rows })
  },

  async onImport() {
    if (this.data.importing) {
      return
    }
    const rows = this.data.parsed || []
    if (!rows.length) {
      wx.showToast({ title: '先粘贴要导入的菜', icon: 'none' })
      return
    }
    this.setData({ importing: true, result: '' })
    let done = 0
    let failed = 0
    try {
      const existing = await getDishes()
      const names: Record<string, boolean> = {}
      existing.forEach(dish => {
        names[dish.name] = true
      })
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]
        if (row.error || names[row.name]) {
          failed++
          continue
        }
        try {
          await saveDish({
            name: row.name,
            desc: '',
            price: row.price,
            cost: row.cost,
            categoryId: row.categoryId,
            tags: [],
            spicyLevels: [],
            addons: [],
            color: COLORS[i % COLORS.length],
            meals: row.meals,
            status: 'on',
            stock: row.stock,
            isRecommended: false
          })
          names[row.name] = true
          done++
        } catch (e) {
          failed++
        }
      }
      this.setData({
        result: `成功导入 ${done} 道${
          failed ? `，跳过 ${failed} 道（重复或有误）` : ''
        }`
      })
      wx.showToast({
        title: done ? `已导入 ${done} 道` : '没有可导入的菜',
        icon: 'none'
      })
    } catch (e: any) {
      wx.showToast({
        title: String((e && e.message) || '导入失败').slice(0, 40),
        icon: 'none'
      })
    } finally {
      this.setData({ importing: false })
    }
  }
})
