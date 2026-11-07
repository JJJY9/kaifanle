import type {
  BackupData,
  Business,
  Category,
  Coupon,
  CreateOrderPayload,
  DailyMenu,
  Dish,
  DishSales,
  DishStats,
  DishInput,
  InitResult,
  KitchenReport,
  KitchenStatus,
  MealId,
  MenuTemplate,
  MeInfo,
  MyStats,
  Order,
  OrderMessage,
  OrderStatus,
  SpecialDays,
  StockLog,
  StoreStats,
  UserProfile,
  WeekMenus,
  Wish,
  WishStatus
} from './types'
import { STATUS_STEP_TEXT } from '../utils/constants'
import { dateInputString } from '../utils/format'

const ORDERS_KEY = 'kfl_orders_v1'
const MIN_RATED_DISH_ORDERS = 2
const TOP_RATED_DISH_LIMIT = 5
const DISH_STATUS_KEY = 'kfl_dish_status_v1'
const WISHES_KEY = 'kfl_wishes_v1'
const BUSINESS_KEY = 'kfl_business_v1'
const PROFILE_KEY = 'kfl_profile_v1'
const COUPONS_KEY = 'kfl_coupons_v1'
const MENUS_KEY = 'kfl_menus_v1'

const DEFAULT_BUSINESS: Business = {
  breakfast: { open: true, deadline: '09:30' },
  lunch: { open: true, deadline: '12:00' },
  dinner: { open: true, deadline: '20:00' },
  closedNote: '今天休息，明天见',
  notice: '',
  noticeFrom: '',
  noticeUntil: '',
  recommendText: '今日推荐',
  lowStockThreshold: 3,
  dailyGoal: 0,
  monthlyGoal: 0,
  closedDates: [],
  weeklyClosed: []
}

const CATEGORIES: Category[] = [
  { id: 'staple', name: '主食', color: '#FFD23F' },
  { id: 'stirfry', name: '小炒', color: '#2D9CFF' },
  { id: 'soup', name: '汤羹', color: '#2FBF71' },
  { id: 'drink', name: '饮品', color: '#FF5C8A' },
  { id: 'dessert', name: '甜品', color: '#FF6B35' }
]

const DISHES: Dish[] = [
  {
    id: 'd01',
    name: '番茄牛腩饭',
    char: '番',
    desc: '牛腩炖足 3 小时，汤汁拌饭一绝',
    price: 18,
    cost: 6,
    categoryId: 'staple',
    tags: ['招牌', '热卖'],
    spicyLevels: ['不辣', '微辣', '中辣'],
    addons: [
      { id: 'a1', name: '溏心蛋', price: 2 },
      { id: 'a2', name: '加饭', price: 1 }
    ],
    status: 'on',
    color: '#FFD23F',
    meals: ['lunch', 'dinner'],
    isRecommended: true,
    recipe:
      '牛腩切块冷水下锅焯水\n番茄切块炒出汁，下牛腩翻炒\n小火炖 60 分钟，加盐收汁\n浇在热米饭上',
    ingredients: ['番茄 2个', '牛腩 300g', '米饭 1碗'],
    allergens: ['花生']
  },
  {
    id: 'd02',
    name: '照烧鸡腿饭',
    char: '照',
    desc: '去骨鸡腿煎到焦香，酱汁微甜',
    price: 16,
    categoryId: 'staple',
    tags: ['人气'],
    spicyLevels: [],
    addons: [{ id: 'a2', name: '加饭', price: 1 }],
    status: 'on',
    color: '#2D9CFF',
    meals: ['lunch', 'dinner'],
    ingredients: ['鸡腿 1只', '米饭 1碗', '照烧汁 2勺']
  },
  {
    id: 'd03',
    name: '妈妈牌红烧肉',
    char: '红',
    desc: '肥而不腻，配米饭能吃两碗',
    price: 22,
    categoryId: 'staple',
    tags: ['限量'],
    spicyLevels: [],
    addons: [{ id: 'a2', name: '加饭', price: 1 }],
    status: 'soldout',
    color: '#FF6B35',
    meals: ['lunch', 'dinner'],
    stock: 0
  },
  {
    id: 'd04',
    name: '葱油拌面',
    char: '葱',
    desc: '现熬葱油，拌开就很香',
    price: 10,
    categoryId: 'staple',
    tags: [],
    spicyLevels: [],
    addons: [{ id: 'a3', name: '加个蛋', price: 2 }],
    status: 'on',
    color: '#FF5C8A',
    meals: ['breakfast', 'lunch']
  },
  {
    id: 'd05',
    name: '皮蛋瘦肉粥',
    char: '粥',
    desc: '熬到米开花，配咸鸭蛋',
    price: 8,
    categoryId: 'staple',
    tags: [],
    spicyLevels: [],
    addons: [],
    status: 'on',
    color: '#2FBF71',
    meals: ['breakfast']
  },
  {
    id: 'd06',
    name: '煎蛋三明治',
    char: '三',
    desc: '吐司烤脆，煎蛋还是流心的',
    price: 9,
    categoryId: 'staple',
    tags: ['快手'],
    spicyLevels: [],
    addons: [],
    status: 'on',
    color: '#FFD23F',
    meals: ['breakfast']
  },
  {
    id: 'd07',
    name: '蒜蓉西兰花',
    char: '蒜',
    desc: '大火快炒，脆嫩不出水',
    price: 9,
    categoryId: 'stirfry',
    tags: [],
    spicyLevels: ['不辣', '微辣'],
    addons: [],
    status: 'on',
    color: '#2FBF71',
    meals: ['lunch', 'dinner']
  },
  {
    id: 'd08',
    name: '青椒土豆丝',
    char: '土',
    desc: '手切土豆丝，酸辣下饭',
    price: 8,
    categoryId: 'stirfry',
    tags: ['下饭'],
    spicyLevels: ['微辣', '中辣'],
    addons: [],
    status: 'on',
    color: '#2D9CFF',
    meals: ['lunch', 'dinner']
  },
  {
    id: 'd09',
    name: '可乐鸡翅',
    char: '翅',
    desc: '收汁到发亮，甜咸口',
    price: 15,
    categoryId: 'stirfry',
    tags: ['人气'],
    spicyLevels: [],
    addons: [],
    status: 'on',
    color: '#FF5C8A',
    meals: ['lunch', 'dinner']
  },
  {
    id: 'd10',
    name: '番茄蛋花汤',
    char: '汤',
    desc: '酸甜开胃，蛋花要嫩',
    price: 6,
    categoryId: 'soup',
    tags: [],
    spicyLevels: [],
    addons: [],
    status: 'on',
    color: '#FFD23F',
    meals: ['lunch', 'dinner']
  },
  {
    id: 'd11',
    name: '冬瓜排骨汤',
    char: '冬',
    desc: '小火慢炖，清甜不腻',
    price: 12,
    categoryId: 'soup',
    tags: ['慢炖'],
    spicyLevels: [],
    addons: [],
    status: 'on',
    color: '#FF6B35',
    meals: ['lunch', 'dinner']
  },
  {
    id: 'd12',
    name: '冰镇柠檬水',
    char: '柠',
    desc: '现切柠檬，少冰也好喝',
    price: 5,
    categoryId: 'drink',
    tags: [],
    spicyLevels: [],
    addons: [],
    status: 'on',
    color: '#2D9CFF',
    meals: ['lunch', 'dinner']
  },
  {
    id: 'd13',
    name: '热牛奶',
    char: '奶',
    desc: '睡前来一杯，暖胃',
    price: 4,
    categoryId: 'drink',
    tags: [],
    spicyLevels: [],
    addons: [],
    status: 'on',
    color: '#FF5C8A',
    meals: ['breakfast']
  },
  {
    id: 'd14',
    name: '焦糖布丁',
    char: '布',
    desc: '冰箱里冰过的，饭后刚好',
    price: 8,
    categoryId: 'dessert',
    tags: ['限量'],
    spicyLevels: [],
    addons: [],
    status: 'on',
    color: '#FF6B35',
    meals: ['lunch', 'dinner']
  }
]

let orderCache: Order[] | null = null
let wishCache: Wish[] | null = null
let businessCache: Business | null = null
let profileCache: UserProfile | null = null
let couponCache: Coupon[] | null = null
let menuCache: Record<string, DailyMenu> | null = null
const dishStatusOverrides: Record<string, Dish['status']> = loadOverrides()

let stockLogs: StockLog[] = []

function addStockLog(entry: Omit<StockLog, 'id' | 'createdAt'>) {
  stockLogs.unshift({
    ...entry,
    id: 'sl' + Date.now() + Math.random().toString(36).slice(2, 6),
    createdAt: Date.now()
  })
  stockLogs = stockLogs.slice(0, 200)
}

const dishes: Dish[] = DISHES.map(dish => ({
  ...dish,
  status: dishStatusOverrides[dish.id] || dish.status
}))

function delay(ms: number = 120): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function loadOverrides(): Record<string, Dish['status']> {
  try {
    const raw = wx.getStorageSync(DISH_STATUS_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch (e) {
    return {}
  }
}

function persistOverrides(): void {
  try {
    wx.setStorageSync(DISH_STATUS_KEY, JSON.stringify(dishStatusOverrides))
  } catch (e) {
    // 忽略存储失败
  }
}

function saveOrders(): void {
  try {
    wx.setStorageSync(ORDERS_KEY, JSON.stringify(orderCache || []))
  } catch (e) {
    // 忽略存储失败
  }
}

function loadWishes(): Wish[] {
  if (wishCache) {
    return wishCache
  }
  try {
    const raw = wx.getStorageSync(WISHES_KEY)
    if (raw) {
      wishCache = JSON.parse(raw)
      return wishCache as Wish[]
    }
  } catch (e) {
    // 读取失败则使用种子数据
  }
  wishCache = [
    {
      id: 'wish-seed-1',
      content: '想吃番茄牛腩饭',
      status: 'pending',
      plannedDate: '',
      reply: '',
      createdAt: Date.now() - 60 * 60 * 1000,
      updatedAt: Date.now() - 60 * 60 * 1000
    }
  ]
  saveWishes()
  return wishCache
}

function saveWishes(): void {
  try {
    wx.setStorageSync(WISHES_KEY, JSON.stringify(wishCache || []))
  } catch (e) {
    // 忽略存储失败
  }
}

function normalizeLowStockThreshold(value: any): number {
  if (value === undefined || value === null || String(value).trim() === '') {
    return 3
  }
  const number = Number(value)
  return isFinite(number) && number >= 0 && number <= 99
    ? Math.floor(number)
    : 3
}

function normalizeDailyGoal(value: any): number {
  if (value === undefined || value === null || String(value).trim() === '') {
    return 0
  }
  const number = Number(value)
  return isFinite(number) && number >= 0 && number <= 99999
    ? Math.floor(number)
    : 0
}

function normalizeMonthlyGoal(value: any): number {
  if (value === undefined || value === null || String(value).trim() === '') {
    return 0
  }
  const number = Number(value)
  return isFinite(number) && number >= 0 && number <= 999999
    ? Math.floor(number)
    : 0
}

function loadBusiness(): Business {
  if (businessCache) {
    return businessCache
  }
  try {
    const raw = wx.getStorageSync(BUSINESS_KEY)
    if (raw) {
      businessCache = JSON.parse(raw)
      businessCache.lowStockThreshold = normalizeLowStockThreshold(
        businessCache.lowStockThreshold
      )
      businessCache.dailyGoal = normalizeDailyGoal(businessCache.dailyGoal)
      businessCache.monthlyGoal = normalizeMonthlyGoal(
        businessCache.monthlyGoal
      )
      businessCache.noticeUntil = /^\d{4}-\d{2}-\d{2}$/.test(
        String(businessCache.noticeUntil || '')
      )
        ? String(businessCache.noticeUntil)
        : ''
      businessCache.noticeFrom = /^\d{4}-\d{2}-\d{2}$/.test(
        String(businessCache.noticeFrom || '')
      )
        ? String(businessCache.noticeFrom)
        : ''
      saveBusiness()
      return businessCache as Business
    }
  } catch (e) {
    // 读取失败则使用默认值
  }
  businessCache = JSON.parse(JSON.stringify(DEFAULT_BUSINESS))
  saveBusiness()
  return businessCache as Business
}

function saveBusiness(): void {
  try {
    wx.setStorageSync(BUSINESS_KEY, JSON.stringify(businessCache))
  } catch (e) {
    // 忽略存储失败
  }
}

function loadProfile(): UserProfile {
  if (profileCache) {
    return profileCache
  }
  try {
    const raw = wx.getStorageSync(PROFILE_KEY)
    if (raw) {
      const saved = JSON.parse(raw)
      profileCache = {
        dislikes: Array.isArray(saved.dislikes) ? saved.dislikes : [],
        tastes: Array.isArray(saved.tastes) ? saved.tastes : [],
        address: String(saved.address || ''),
        birthday: String(saved.birthday || ''),
        anniversary: String(saved.anniversary || '')
      }
      return profileCache as UserProfile
    }
  } catch (e) {
    // 读取失败则使用默认值
  }
  profileCache = {
    dislikes: [],
    tastes: [],
    address: '',
    birthday: '',
    anniversary: ''
  }
  saveProfile()
  return profileCache as UserProfile
}

function saveProfile(): void {
  try {
    wx.setStorageSync(PROFILE_KEY, JSON.stringify(profileCache))
  } catch (e) {
    // 忽略存储失败
  }
}

function loadCoupons(): Coupon[] {
  if (couponCache) {
    return couponCache
  }
  try {
    const raw = wx.getStorageSync(COUPONS_KEY)
    if (raw) {
      const stored = JSON.parse(raw)
      couponCache = Array.isArray(stored) ? stored : []
    }
  } catch (e) {
    // 读取失败则使用种子数据
  }
  if (!Array.isArray(couponCache)) {
    couponCache = []
  }
  const now = Date.now()
  if (!couponCache.some(item => item.id === 'coupon-seed-1')) {
    couponCache.unshift({
      id: 'coupon-seed-1',
      title: '洗碗券',
      note: '攒够 3 次可以换一次洗碗',
      status: 'unused',
      owner: '',
      createdAt: now - 2 * 60 * 60 * 1000,
      claimedAt: 0,
      usedAt: 0
    })
  }
  // 快过期示例券：过期或缺失时续上一张，方便演示提醒
  const seed2 = couponCache.find(item => item.id === 'coupon-seed-2')
  if (!seed2 || Number(seed2.expiresAt || 0) < now) {
    couponCache = couponCache.filter(item => item.id !== 'coupon-seed-2')
    couponCache.push({
      id: 'coupon-seed-2',
      title: '奶茶券',
      note: '三天内用掉，过期作废',
      status: 'unused',
      owner: 'mock-openid',
      createdAt: now - 20 * 60 * 60 * 1000,
      claimedAt: now - 20 * 60 * 60 * 1000,
      usedAt: 0,
      expiresAt: now + 2 * 24 * 60 * 60 * 1000
    })
  }
  saveCoupons()
  return couponCache as Coupon[]
}

function saveCoupons(): void {
  try {
    wx.setStorageSync(COUPONS_KEY, JSON.stringify(couponCache || []))
  } catch (e) {
    // 忽略存储失败
  }
}

function loadMenus(): Record<string, DailyMenu> {
  if (menuCache) {
    return menuCache
  }
  try {
    const raw = wx.getStorageSync(MENUS_KEY)
    if (raw) {
      menuCache = JSON.parse(raw)
      return menuCache as Record<string, DailyMenu>
    }
  } catch (e) {
    // 读取失败则使用空菜单
  }
  menuCache = {}
  saveMenus()
  return menuCache
}

function saveMenus(): void {
  try {
    wx.setStorageSync(MENUS_KEY, JSON.stringify(menuCache || {}))
  } catch (e) {
    // 忽略存储失败
  }
}

function seedOrders(): Order[] {
  const now = Date.now()
  const dayStart = new Date()
  dayStart.setHours(0, 0, 0, 0)
  // 凌晨打开时 20 分钟前可能还是昨天，示例进行中订单要落在今天
  const t1 = Math.max(now - 20 * 60 * 1000, dayStart.getTime() + 60 * 1000)
  const t2 = now - 3 * 60 * 60 * 1000
  const t4 = now - 4 * 60 * 60 * 1000
  return [
    {
      id: 'seed-1',
      no: '002',
      items: [
        {
          dishId: 'd02',
          name: '照烧鸡腿饭',
          price: 16,
          qty: 1,
          specs: [],
          note: '多酱汁',
          allergens: ['花生']
        }
      ],
      amount: 16,
      meal: 'lunch',
      expectedTime: '12:00',
      mode: '在家吃',
      note: '',
      status: 'pending',
      timeline: [{ status: 'pending', title: '已下单', time: t1 }],
      createdAt: t1
    },
    {
      id: 'seed-2',
      no: '001',
      items: [
        {
          dishId: 'd01',
          name: '番茄牛腩饭',
          price: 18,
          qty: 1,
          specs: ['微辣'],
          note: '',
          allergens: ['花生']
        }
      ],
      amount: 18,
      meal: 'breakfast',
      expectedTime: '08:30',
      mode: '在家吃',
      note: '',
      status: 'completed',
      timeline: [
        { status: 'pending', title: '已下单', time: t2 },
        { status: 'accepted', title: '已接单 · 锅已热', time: t2 + 5 * 60000 },
        { status: 'cooking', title: '制作中 · 正在炒', time: t2 + 15 * 60000 },
        { status: 'ready', title: '出锅啦', time: t2 + 30 * 60000 },
        { status: 'completed', title: '已完成', time: t2 + 40 * 60000 }
      ],
      createdAt: t2
    },
    {
      id: 'seed-3',
      no: '003',
      items: [
        {
          dishId: 'd02',
          name: '照烧鸡腿饭',
          price: 16,
          qty: 2,
          specs: [],
          note: '明天中午吃',
          allergens: ['花生']
        }
      ],
      amount: 32,
      meal: 'lunch',
      expectedTime: '12:00',
      mode: '在家吃',
      note: '明天的午饭',
      scheduledDate: dateInputString(new Date(now + 24 * 60 * 60 * 1000)),
      status: 'pending',
      timeline: [{ status: 'pending', title: '已下单', time: now - 10 * 60 * 1000 }],
      createdAt: now - 10 * 60 * 1000
    },
    {
      id: 'seed-4',
      no: '004',
      items: [
        {
          dishId: 'd01',
          name: '番茄牛腩饭',
          price: 18,
          qty: 1,
          specs: ['微辣'],
          note: ''
        }
      ],
      amount: 18,
      meal: 'lunch',
      expectedTime: '12:30',
      mode: '在家吃',
      note: '',
      status: 'completed',
      rating: 2,
      feedback: '还不错',
      ratedAt: t4 + 50 * 60000,
      ownerReply: '下次再改进',
      ownerReplyAt: t4 + 60 * 60000,
      timeline: [
        { status: 'pending', title: '已下单', time: t4 },
        { status: 'accepted', title: '已接单 · 锅已热', time: t4 + 5 * 60000 },
        { status: 'cooking', title: '制作中 · 正在炒', time: t4 + 15 * 60000 },
        { status: 'ready', title: '出锅啦', time: t4 + 30 * 60000 },
        { status: 'completed', title: '已完成', time: t4 + 40 * 60000 }
      ],
      createdAt: t4
    }
  ]
}

function loadOrders(): Order[] {
  if (orderCache) {
    return orderCache
  }
  try {
    const raw = wx.getStorageSync(ORDERS_KEY)
    if (raw) {
      const stored = JSON.parse(raw)
      if (Array.isArray(stored)) {
        // 种子订单是当天的演示数据；隔天打开时换一批新的，避免排队提示等
        // 依赖“今天”的界面在旧数据上表现异常
        const today = dateInputString()
        const seed1 = stored.find((order: Order) => order.id === 'seed-1')
        const seedBroken = Boolean(seed1 && seed1.status !== 'pending')
        const staleSeed =
          seedBroken ||
          !stored.some((order: Order) => order.id === 'seed-3') ||
          !stored.some((order: Order) => order.id === 'seed-4') ||
          stored.some(
            (order: Order) =>
              /^seed-/.test(order.id) &&
              dateInputString(new Date(order.createdAt)) !== today
          )
        orderCache = staleSeed
          ? stored
              .filter((order: Order) => !/^seed-/.test(order.id))
              .concat(seedOrders())
          : stored
        if (staleSeed) {
          saveOrders()
        }
        return orderCache
      }
    }
  } catch (e) {
    // 读取失败则使用种子数据
  }
  orderCache = seedOrders()
  saveOrders()
  return orderCache
}

export async function getCategories(): Promise<Category[]> {
  await delay()
  return CATEGORIES.map(item => ({ ...item }))
}

export async function saveCategory(payload: {
  id?: string
  name: string
  color: string
}): Promise<Category> {
  await delay(80)
  const name = String(payload.name || '').trim()
  if (!name) {
    throw new Error('分类名称不能为空')
  }
  if (payload.id) {
    const found = CATEGORIES.find(item => item.id === payload.id)
    if (!found) {
      throw new Error('分类不存在')
    }
    found.name = name
    found.color = payload.color || found.color
    return { ...found }
  }
  if (CATEGORIES.some(item => item.name === name)) {
    throw new Error('已经有同名分类了')
  }
  const category: Category = {
    id: `c${Date.now()}`,
    name,
    color: payload.color || '#FFD23F'
  }
  CATEGORIES.push(category)
  return { ...category }
}

export async function deleteCategory(id: string): Promise<{ id: string }> {
  await delay(80)
  if (dishes.some(dish => dish.categoryId === id)) {
    throw new Error('这个分类下还有菜品，先移走再删')
  }
  const index = CATEGORIES.findIndex(item => item.id === id)
  if (index === -1) {
    throw new Error('分类不存在')
  }
  CATEGORIES.splice(index, 1)
  return { id }
}

export async function moveCategory(
  id: string,
  direction: 'up' | 'down'
): Promise<{ moved: boolean }> {
  await delay(60)
  const index = CATEGORIES.findIndex(item => item.id === id)
  if (index === -1) {
    throw new Error('分类不存在')
  }
  const target = index + (direction === 'up' ? -1 : 1)
  if (target < 0 || target >= CATEGORIES.length) {
    return { moved: false }
  }
  const current = CATEGORIES[index]
  CATEGORIES[index] = CATEGORIES[target]
  CATEGORIES[target] = current
  return { moved: true }
}

export async function getDishes(): Promise<Dish[]> {
  await delay()
  return dishes.map(dish => ({ ...dish, addons: dish.addons.map(a => ({ ...a })) }))
}

export async function getDish(id: string): Promise<Dish | null> {
  await delay(60)
  const dish = dishes.find(item => item.id === id)
  return dish ? { ...dish } : null
}

export async function toggleDishStatus(id: string): Promise<Dish | null> {
  await delay(80)
  const dish = dishes.find(item => item.id === id)
  if (!dish) {
    return null
  }
  // 供应中 -> 售罄；售罄/已下架 -> 恢复供应
  dish.status = dish.status === 'on' ? 'soldout' : 'on'
  dishStatusOverrides[id] = dish.status
  persistOverrides()
  return { ...dish }
}

export async function batchUpdateDishCategory(
  ids: string[],
  categoryId: string
): Promise<{ categoryId: string; updated: number }> {
  await delay(80)
  if (!CATEGORIES.some(category => category.id === categoryId)) {
    throw new Error('分类不存在')
  }
  const unique = Array.from(
    new Set((ids || []).map(id => String(id || '')).filter(Boolean))
  ).slice(0, 50)
  let updated = 0
  unique.forEach(id => {
    const dish = dishes.find(item => item.id === id)
    if (dish && dish.categoryId !== categoryId) {
      dish.categoryId = categoryId
      updated++
    }
  })
  return { categoryId, updated }
}

export async function moveDish(
  id: string,
  direction: 'up' | 'down'
): Promise<{ moved: boolean }> {
  await delay(60)
  const index = dishes.findIndex(dish => dish.id === id)
  if (index === -1) {
    throw new Error('菜品不存在')
  }
  const target = index + (direction === 'up' ? -1 : 1)
  if (target < 0 || target >= dishes.length) {
    return { moved: false }
  }
  const temp = dishes[index]
  dishes[index] = dishes[target]
  dishes[target] = temp
  return { moved: true }
}

export async function saveDish(payload: DishInput): Promise<Dish> {
  await delay(100)
  if (payload.priceOnly === true) {
    const existing = dishes.find(item => item.id === payload.id)
    if (!existing) {
      throw new Error('菜品不存在')
    }
    const price = Number(payload.price)
    if (!isFinite(price) || price < 0 || price > 999) {
      throw new Error('价格需要是 0-999 之间的数字')
    }
    const priceBase = Number(payload.priceBase)
    if (!isFinite(priceBase) || priceBase < 0 || priceBase > 999) {
      throw new Error('价格基线不正确')
    }
    if (Number(existing.price) !== priceBase || Number(existing.price) === price) {
      return { ...existing }
    }
    existing.priceHistory = (existing.priceHistory || [])
      .concat([
        {
          from: Number(existing.price) || 0,
          to: price,
          at: Date.now()
        }
      ])
      .slice(-20)
    existing.price = price
    return { ...existing }
  }
  const name = String(payload.name || '').trim()
  if (!name) {
    throw new Error('菜品名称不能为空')
  }
  const hasCost =
    payload.cost !== undefined &&
    payload.cost !== null &&
    String(payload.cost).trim() !== ''
  const costValue = Number(payload.cost)
  if (hasCost && (!isFinite(costValue) || costValue < 0 || costValue > 999)) {
    throw new Error('成本需要是 0-999 之间的数字')
  }
  const fields: Dish = {
    id: payload.id || `m${Date.now()}`,
    name,
    char: name.slice(0, 1),
    desc: String(payload.desc || '').trim(),
    price: Number(payload.price) || 0,
    cost: hasCost ? Math.round(costValue * 100) / 100 : 0,
    categoryId: payload.categoryId,
    tags: payload.tags || [],
    spicyLevels: payload.spicyLevels || [],
    ingredients: (payload.ingredients || [])
      .map(line => String(line || '').trim().slice(0, 30))
      .filter(Boolean)
      .slice(0, 15),
    allergens: (payload.allergens || [])
      .map(line => String(line || '').trim().slice(0, 10))
      .filter(Boolean)
      .slice(0, 6),
    addons: (payload.addons || []).map(addon => ({ ...addon })),
    status: payload.status || 'on',
    color: payload.color || '#FFD23F',
    meals: payload.meals || ['lunch', 'dinner'],
    stock:
      typeof payload.stock === 'number' && payload.stock >= -1
        ? Math.floor(payload.stock)
        : -1,
    isRecommended: Boolean(payload.isRecommended),
    image: payload.image || '',
    recipe: payload.recipe || ''
  }
  if (payload.id) {
    const existing = dishes.find(item => item.id === payload.id)
    if (!existing) {
      throw new Error('菜品不存在')
    }
    const stockBase = Number(payload.stockBase)
    const currentStock =
      typeof existing.stock === 'number' && isFinite(existing.stock)
        ? Number(existing.stock)
        : -1
    if (isFinite(stockBase) && stockBase >= -1) {
      const target = Number(fields.stock)
      if (target === stockBase) {
        fields.stock = currentStock
      } else if (target === -1 || stockBase === -1) {
        fields.stock = target
      } else {
        fields.stock =
          currentStock >= 0
            ? currentStock === stockBase
              ? target
              : Math.max(0, currentStock + (target - stockBase))
            : target
      }
    } else {
      fields.stock = currentStock
    }
    const beforeStock =
      typeof existing.stock === 'number' ? Number(existing.stock) : null
    const priceBaseValue = Number(payload.priceBase)
    const priceBase =
      isFinite(priceBaseValue) && priceBaseValue >= 0 ? priceBaseValue : null
    const priceApplied =
      priceBase !== null && priceBase === Number(existing.price)
    if (!priceApplied) {
      fields.price = Number(existing.price)
    }
    if (!hasCost) {
      fields.cost = Number(existing.cost) || 0
    }
    if (priceApplied && Number(existing.price) !== Number(fields.price)) {
      fields.priceHistory = (existing.priceHistory || [])
        .concat([
          {
            from: Number(existing.price) || 0,
            to: Number(fields.price),
            at: Date.now()
          }
        ])
        .slice(-20)
    }
    Object.assign(existing, fields)
    if (
      beforeStock !== null &&
      typeof existing.stock === 'number' &&
      Number(existing.stock) !== beforeStock
    ) {
      const afterStock = Number(existing.stock)
      addStockLog({
        dishId: payload.id,
        dishName: name,
        before: beforeStock,
        after: afterStock,
        delta:
          beforeStock >= 0 && afterStock >= 0
            ? afterStock - beforeStock
            : null,
        source: 'edit'
      })
    }
    return { ...existing }
  }
  dishes.push(fields)
  return { ...fields }
}

export async function deleteDish(id: string): Promise<{ id: string }> {
  await delay(80)
  const index = dishes.findIndex(dish => dish.id === id)
  if (index === -1) {
    throw new Error('菜品不存在')
  }
  dishes.splice(index, 1)
  return { id }
}

export async function getOrders(): Promise<Order[]> {
  await delay(80)
  return loadOrders()
    .slice()
    .sort((a, b) => b.createdAt - a.createdAt)
    .map(order => ({ ...order }))
}

export async function getOrdersPage(
  before?: number,
  limit = 20
): Promise<{ orders: Order[]; hasMore: boolean; nextBefore: number }> {
  await delay(80)
  const size = Math.min(50, Math.max(1, Number(limit) || 20))
  const cursor = Number(before) || 0
  const list = loadOrders()
    .slice()
    .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))
    .filter(order => !cursor || Number(order.createdAt || 0) < cursor)
    .slice(0, size)
    .map(order => ({ ...order }))
  return {
    orders: list,
    hasMore: list.length === size,
    nextBefore: list.length ? Number(list[list.length - 1].createdAt || 0) : 0
  }
}

export async function getLastOrder(): Promise<Order | null> {
  await delay(60)
  const today = dateInputString()
  const order = loadOrders()
    .slice()
    .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))
    .find(
      item =>
        item.status !== 'cancelled' &&
        (item.scheduledDate ||
          dateInputString(new Date(item.createdAt))) <= today
    )
  return order ? { ...order } : null
}

export async function getMyActiveOrder(): Promise<Order | null> {
  await delay(60)
  const today = dateInputString()
  const order = loadOrders()
    .filter(
      item =>
        ['pending', 'accepted', 'cooking', 'ready'].indexOf(item.status) >
          -1 &&
        (item.scheduledDate ||
          dateInputString(new Date(item.createdAt))) === today
    )
    .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))[0]
  return order ? { ...order } : null
}

export async function getMyPendingReviewCount(): Promise<{ count: number }> {
  await delay(40)
  const count = loadOrders().filter(
    order =>
      order.status === 'completed' &&
      [1, 2, 3].indexOf(Number(order.rating)) === -1
  ).length
  return { count }
}

export async function getAllOrders(): Promise<Order[]> {
  return getOrders()
}

export async function getActiveOrders(): Promise<Order[]> {
  await delay(60)
  return loadOrders()
    .filter(
      order =>
        order.status === 'pending' ||
        order.status === 'accepted' ||
        order.status === 'cooking' ||
        order.status === 'ready'
    )
    .sort((a, b) => b.createdAt - a.createdAt)
    .map(order => ({ ...order }))
}

export async function acceptPendingOrders(): Promise<{
  done: number
  total: number
}> {
  await delay(100)
  const today = dateInputString()
  const targets = loadOrders().filter(
    order =>
      order.status === 'pending' &&
      (order.scheduledDate ||
        dateInputString(new Date(order.createdAt))) <= today
  )
  targets.forEach(order => {
    order.status = 'accepted'
    order.timeline.push({
      status: 'accepted',
      title: STATUS_STEP_TEXT.accepted,
      time: Date.now()
    })
  })
  saveOrders()
  return { done: targets.length, total: targets.length }
}

export async function getOrder(id: string): Promise<Order | null> {
  await delay(60)
  const order = loadOrders().find(item => item.id === id)
  return order ? { ...order } : null
}

export async function createOrder(payload: CreateOrderPayload): Promise<Order> {
  await delay(150)
  const business = loadBusiness()
  const setting = business[payload.meal]
  if (!setting.open) {
    throw new Error('这一餐还没开火，先歇歇')
  }
  const todayDate = dateInputString()
  let scheduledDate = String(payload.scheduledDate || todayDate)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(scheduledDate)) {
    scheduledDate = todayDate
  }
  const isToday = scheduledDate === todayDate
  const nowDate = new Date()
  const nowMinutes = nowDate.getHours() * 60 + nowDate.getMinutes()
  const [deadlineHour, deadlineMinute] = setting.deadline.split(':').map(Number)
  if (isToday && nowMinutes > deadlineHour * 60 + deadlineMinute) {
    throw new Error('这一餐已经截单啦，下次早点来')
  }
  if (
    Array.isArray(business.closedDates) &&
    business.closedDates.indexOf(scheduledDate) > -1
  ) {
    throw new Error('这一天休息，换个日子吧')
  }
  const weekday = new Date(scheduledDate + 'T00:00:00').getDay()
  if (
    Array.isArray(business.weeklyClosed) &&
    business.weeklyClosed.indexOf(weekday) > -1
  ) {
    throw new Error('这一天固定休息，换个日子吧')
  }

  const menu = loadMenus()[`${scheduledDate}_${payload.meal}`]
  if (menu && menu.open === false) {
    throw new Error('这一餐还没排菜单')
  }

  const stockChanges: Array<{ dish: Dish; qty: number }> = []
  const orderItems = payload.items.map(item => {
    const dish = dishes.find(entry => entry.id === item.dishId)
    if (!dish) {
      throw new Error('菜品不存在')
    }
    if (dish.status !== 'on') {
      throw new Error(`${dish.name} 已售罄`)
    }
    if (menu && menu.dishIds.indexOf(item.dishId) === -1) {
      throw new Error(`${dish.name} 这一餐不供应`)
    }
    const limited = typeof dish.stock === 'number' && dish.stock >= 0
    if (limited && dish.stock < item.qty) {
      throw new Error(`${dish.name} 卖完了`)
    }
    if (limited) {
      stockChanges.push({ dish, qty: item.qty })
    }
    return {
      ...item,
      cost: Math.max(0, Math.min(999, Number(dish.cost) || 0)),
      allergens: (dish.allergens || []).slice(0, 8),
      stockDeducted: limited
    }
  })
  stockChanges.forEach(({ dish, qty }) => {
    dish.stock = Number(dish.stock) - qty
  })

  const profile = loadProfile()
  const orders = loadOrders()
  const now = Date.now()
  const order: Order = {
    id: `o${now}`,
    no: String(orders.length + 1).padStart(3, '0'),
    items: orderItems,
    amount: payload.amount,
    meal: payload.meal,
    expectedTime: payload.expectedTime,
    mode: payload.mode,
    note: payload.note,
    address: String(payload.address || '').slice(0, 60),
    scheduledDate,
    profile: {
      dislikes: profile.dislikes.slice(),
      tastes: profile.tastes.slice()
    },
    status: 'pending',
    timeline: [{ status: 'pending', title: '已下单', time: now }],
    createdAt: now
  }
  orders.unshift(order)
  orderItems.forEach(item => {
    if (item.stockDeducted) {
      addStockLog({
        dishId: item.dishId,
        dishName: item.name,
        delta: -Number(item.qty || 0),
        source: 'order',
        orderId: order.id,
        orderNo: order.no
      })
    }
  })
  saveOrders()
  return { ...order }
}

export async function cancelOrder(
  id: string,
  reason?: string
): Promise<Order | null> {
  await delay(80)
  const orders = loadOrders()
  const order = orders.find(item => item.id === id)
  if (!order) {
    return null
  }
  if (order.status !== 'pending') {
    throw new Error('已经接单啦，不能取消')
  }
  order.status = 'cancelled'
  order.cancelReason = String(reason || '').trim().slice(0, 50)
  order.cancelledBy = 'customer'
  order.timeline.push({
    status: 'cancelled',
    title: STATUS_STEP_TEXT.cancelled,
    time: Date.now()
  })
  for (const item of order.items as any[]) {
    if (!item.stockDeducted) {
      continue
    }
    const dish = dishes.find(entry => entry.id === item.dishId)
    if (dish && typeof dish.stock === 'number') {
      dish.stock = Number(dish.stock) + item.qty
      addStockLog({
        dishId: item.dishId,
        dishName: item.name,
        delta: Number(item.qty || 0),
        source: 'cancel',
        orderId: order.id,
        orderNo: order.no
      })
    }
  }
  saveOrders()
  return { ...order }
}

export async function updateOrderNote(
  id: string,
  note: string
): Promise<Order | null> {
  await delay(60)
  const orders = loadOrders()
  const order = orders.find(item => item.id === id)
  if (!order) {
    return null
  }
  if (['pending', 'accepted'].indexOf(order.status) === -1) {
    throw new Error('开火后就不能改备注啦')
  }
  order.note = String(note || '').trim().slice(0, 100)
  order.noteUpdatedAt = Date.now()
  saveOrders()
  return { ...order }
}

export async function sendOrderMessage(
  id: string,
  content: string
): Promise<OrderMessage> {
  await delay(60)
  const order = loadOrders().find(item => item.id === id)
  if (!order) {
    throw new Error('订单不存在')
  }
  const text = Array.from(String(content || '').trim())
    .slice(0, 100)
    .join('')
  if (!text) {
    throw new Error('说点什么吧')
  }
  const message: OrderMessage = {
    id: `msg${Date.now()}${Math.floor(Math.random() * 1000)}`,
    role: 'customer',
    content: text,
    at: Date.now()
  }
  order.messages = (order.messages || []).slice(-49).concat([message])
  saveOrders()
  return { ...message }
}

export async function updateOrderSlot(
  id: string,
  meal: MealId,
  scheduledDate: string
): Promise<Order | null> {
  await delay(80)
  const order = loadOrders().find(item => item.id === id)
  if (!order) {
    return null
  }
  if (order.status !== 'pending') {
    throw new Error('接单后就不能改时间啦')
  }
  if (['breakfast', 'lunch', 'dinner'].indexOf(meal) === -1) {
    throw new Error('餐次不正确')
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(scheduledDate)) {
    throw new Error('日期不正确')
  }
  const today = dateInputString()
  const max = new Date()
  max.setDate(max.getDate() + 7)
  const maxDate = dateInputString(max)
  if (scheduledDate < today || scheduledDate > maxDate) {
    throw new Error('只能改到今天到 7 天内')
  }
  const business = loadBusiness()
  const setting = (business as any)[meal]
  if (!setting || setting.open === false) {
    throw new Error('这一餐还没开火，换一餐吧')
  }
  if (scheduledDate === today) {
    const now = new Date()
    const [hour, minute] = String(setting.deadline || '23:59')
      .split(':')
      .map(Number)
    if (now.getHours() * 60 + now.getMinutes() > hour * 60 + minute) {
      throw new Error('这一餐已经截单啦')
    }
  }
  const closedDates = Array.isArray(business.closedDates)
    ? business.closedDates
    : []
  const weekday = new Date(scheduledDate + 'T00:00:00').getDay()
  const weeklyClosed = Array.isArray(business.weeklyClosed)
    ? business.weeklyClosed
    : []
  if (
    closedDates.indexOf(scheduledDate) > -1 ||
    weeklyClosed.indexOf(weekday) > -1
  ) {
    throw new Error('这一天休息，换个日子吧')
  }
  const menu = loadMenus()[`${scheduledDate}_${meal}`]
  if (menu && menu.open === false) {
    throw new Error('这一餐还没排菜单')
  }
  for (const item of order.items) {
    const dish = dishes.find(entry => entry.id === item.dishId)
    if (!dish || dish.status === 'off') {
      throw new Error(`${item.name} 已经下架了`)
    }
    if (!Array.isArray(dish.meals) || dish.meals.indexOf(meal) === -1) {
      throw new Error(`${item.name} 这一餐不供应`)
    }
    if (menu && menu.dishIds && menu.dishIds.indexOf(item.dishId) === -1) {
      throw new Error(`${item.name} 不在这一餐的菜单里`)
    }
  }
  const changedMeal = meal !== order.meal
  order.meal = meal
  order.scheduledDate = scheduledDate
  if (changedMeal) {
    order.expectedTime = '尽快'
  }
  order.slotUpdatedAt = Date.now()
  saveOrders()
  return { ...order }
}

export async function urgeOrder(id: string): Promise<Order | null> {
  await delay(60)
  const orders = loadOrders()
  const order = orders.find(item => item.id === id)
  if (!order) {
    return null
  }
  if (['pending', 'accepted', 'cooking'].indexOf(order.status) === -1) {
    throw new Error('这一单不用催啦')
  }
  const now = Date.now()
  if (order.urgedAt && now - order.urgedAt < 5 * 60 * 1000) {
    throw new Error('刚催过啦，掌勺人正在忙')
  }
  order.urgedAt = now
  order.urgeCount = Number(order.urgeCount || 0) + 1
  saveOrders()
  return { ...order }
}

export async function rateOrder(
  id: string,
  rating: number,
  feedback: string,
  tags: string[] = [],
  images: string[] = []
): Promise<Order | null> {
  await delay(60)
  const orders = loadOrders()
  const order = orders.find(item => item.id === id)
  if (!order) {
    return null
  }
  if (order.status !== 'completed') {
    throw new Error('吃完才能评价哦')
  }
  if ([1, 2, 3].indexOf(Number(rating)) === -1) {
    throw new Error('评价不太对')
  }
  const feedbackText = String(feedback || '').trim().slice(0, 50)
  const allowed = ['好吃', '分量足', '准时', '有点辣', '下次还想吃']
  const ratingTags: string[] = []
  ;(Array.isArray(tags) ? tags : []).forEach(tag => {
    const name = String(tag || '').trim()
    if (
      allowed.indexOf(name) > -1 &&
      ratingTags.indexOf(name) === -1 &&
      ratingTags.length < 4
    ) {
      ratingTags.push(name)
    }
  })
  const oldTags = Array.isArray(order.ratingTags) ? order.ratingTags : []
  const ratingImages: string[] = []
  ;(Array.isArray(images) ? images : []).forEach(src => {
    const value = String(src || '').trim()
    if (
      (/^cloud:\/\//.test(value) ||
        /^https:\/\//.test(value) ||
        /^http:\/\/tmp\//.test(value) ||
        /^http:\/\/usr\//.test(value) ||
        /^wxfile:\/\//.test(value) ||
        value.indexOf('/') === 0) &&
      ratingImages.indexOf(value) === -1 &&
      ratingImages.length < 3
    ) {
      ratingImages.push(value.slice(0, 300))
    }
  })
  const oldImages = Array.isArray(order.ratingImages)
    ? order.ratingImages
    : []
  const tagsChanged =
    ratingTags.length !== oldTags.length ||
    ratingTags.some(tag => oldTags.indexOf(tag) === -1)
  const imagesChanged =
    ratingImages.length !== oldImages.length ||
    ratingImages.some(src => oldImages.indexOf(src) === -1)
  const changed =
    Number(order.rating) !== Number(rating) ||
    String(order.feedback || '') !== feedbackText ||
    tagsChanged ||
    imagesChanged
  order.rating = Number(rating)
  order.feedback = feedbackText
  order.ratingTags = ratingTags
  order.ratingImages = ratingImages
  order.ratedAt = Date.now()
  if (changed && order.ownerReply) {
    order.ownerReply = ''
    order.ownerReplyAt = 0
  }
  saveOrders()
  return { ...order }
}

export async function replyRating(
  id: string,
  reply: string,
  ratedAt?: number
): Promise<Order | null> {
  await delay(60)
  const orders = loadOrders()
  const order = orders.find(item => item.id === id)
  if (!order) {
    throw new Error('订单不存在')
  }
  if (order.status !== 'completed') {
    throw new Error('吃完才能回复哦')
  }
  if ([1, 2, 3].indexOf(Number(order.rating)) === -1) {
    throw new Error('她还没评价，先等等')
  }
  const seenRatedAt = Number(ratedAt || 0)
  if (seenRatedAt && Number(order.ratedAt || 0) !== seenRatedAt) {
    throw new Error('她的评价刚刚更新了，刷新看看')
  }
  const text = Array.from(String(reply || '').trim())
    .slice(0, 50)
    .join('')
  if (!text) {
    throw new Error('回复不能为空')
  }
  order.ownerReply = text
  order.ownerReplyAt = Date.now()
  saveOrders()
  return { ...order }
}

export async function updateOrderStatus(
  id: string,
  status: OrderStatus,
  reason?: string
): Promise<Order | null> {
  await delay(80)
  const orders = loadOrders()
  const order = orders.find(item => item.id === id)
  if (!order) {
    return null
  }
  const cancellableBefore =
    order.status === 'pending' || order.status === 'accepted'
  order.status = status
  if (status === 'cancelled') {
    order.cancelReason = String(reason || '').trim().slice(0, 50)
    order.cancelledBy = 'admin'
  }
  order.timeline.push({
    status,
    title: STATUS_STEP_TEXT[status],
    time: Date.now()
  })
  if (status === 'cancelled' && cancellableBefore) {
    for (const item of order.items as any[]) {
      if (!item.stockDeducted) {
        continue
      }
      const dish = dishes.find(entry => entry.id === item.dishId)
      if (dish && typeof dish.stock === 'number') {
        dish.stock = Number(dish.stock) + Number(item.qty || 0)
        addStockLog({
          dishId: item.dishId,
          dishName: item.name,
          delta: Number(item.qty || 0),
          source: 'cancel',
          orderId: order.id,
          orderNo: order.no
        })
      }
    }
  }
  saveOrders()
  return { ...order }
}

export async function getMe(): Promise<MeInfo> {
  await delay(40)
  return {
    openid: 'mock-openid',
    isAdmin: true,
    initialized: true
  }
}

export async function initDb(): Promise<InitResult> {
  await delay(60)
  return {
    initialized: true,
    already: true,
    isAdmin: true
  }
}

export async function createWish(content: string): Promise<Wish> {
  await delay(80)
  const text = String(content || '').trim()
  if (!text) {
    throw new Error('愿望不能为空')
  }
  const now = Date.now()
  const wish: Wish = {
    id: `w${now}`,
    content: text.slice(0, 50),
    status: 'pending',
    plannedDate: '',
    reply: '',
    createdAt: now,
    updatedAt: now
  }
  const wishes = loadWishes()
  wishes.unshift(wish)
  saveWishes()
  return { ...wish }
}

export async function getWishes(): Promise<Wish[]> {
  await delay(60)
  return loadWishes()
    .slice()
    .sort((a, b) => b.createdAt - a.createdAt)
    .map(wish => ({ ...wish }))
}

export async function deleteWish(id: string): Promise<{ id: string }> {
  await delay(60)
  const wishes = loadWishes()
  const index = wishes.findIndex(item => item.id === id)
  if (index === -1) {
    throw new Error('愿望不存在')
  }
  wishes.splice(index, 1)
  saveWishes()
  return { id }
}

export async function updateWish(payload: {
  id: string
  status?: WishStatus
  plannedDate?: string
  reply?: string
}): Promise<Wish> {
  await delay(80)
  const wish = loadWishes().find(item => item.id === payload.id)
  if (!wish) {
    throw new Error('愿望不存在')
  }
  if (payload.status) {
    wish.status = payload.status
  }
  if (payload.plannedDate !== undefined) {
    wish.plannedDate = payload.plannedDate.slice(0, 20)
  }
  if (payload.reply !== undefined) {
    wish.reply = payload.reply.slice(0, 50)
  }
  wish.updatedAt = Date.now()
  saveWishes()
  return { ...wish }
}

export async function getBusiness(): Promise<Business> {
  await delay(60)
  const data = JSON.parse(JSON.stringify(loadBusiness()))
  data.closedDates = Array.isArray(data.closedDates) ? data.closedDates : []
  data.weeklyClosed = Array.isArray(data.weeklyClosed)
    ? data.weeklyClosed
    : []
  data.lowStockThreshold = normalizeLowStockThreshold(
    data.lowStockThreshold
  )
  data.dailyGoal = normalizeDailyGoal(data.dailyGoal)
  data.monthlyGoal = normalizeMonthlyGoal(data.monthlyGoal)
  data.noticeUntil = /^\d{4}-\d{2}-\d{2}$/.test(
    String(data.noticeUntil || '')
  )
    ? String(data.noticeUntil)
    : ''
  data.noticeFrom = /^\d{4}-\d{2}-\d{2}$/.test(
    String(data.noticeFrom || '')
  )
    ? String(data.noticeFrom)
    : ''
  return data
}

export async function updateBusiness(payload: Business): Promise<Business> {
  await delay(80)
  const existing = loadBusiness()
  const next = JSON.parse(JSON.stringify(payload))
  if (next.lowStockThreshold === undefined) {
    next.lowStockThreshold = existing.lowStockThreshold
  }
  if (next.noticeUntil === undefined) {
    next.noticeUntil = existing.noticeUntil
  }
  if (next.noticeFrom === undefined) {
    next.noticeFrom = existing.noticeFrom
  }
  if (
    next.noticeFrom &&
    next.noticeUntil &&
    String(next.noticeFrom) > String(next.noticeUntil)
  ) {
    throw new Error('公告开始日期不能晚于截止日期')
  }
  if (next.dailyGoal === undefined) {
    next.dailyGoal = existing.dailyGoal
  }
  if (next.monthlyGoal === undefined) {
    next.monthlyGoal = existing.monthlyGoal
  }
  next.lowStockThreshold = normalizeLowStockThreshold(
    next.lowStockThreshold
  )
  next.dailyGoal = normalizeDailyGoal(next.dailyGoal)
  next.monthlyGoal = normalizeMonthlyGoal(next.monthlyGoal)
  next.noticeUntil = /^\d{4}-\d{2}-\d{2}$/.test(
    String(next.noticeUntil || '')
  )
    ? String(next.noticeUntil)
    : ''
  next.noticeFrom = /^\d{4}-\d{2}-\d{2}$/.test(
    String(next.noticeFrom || '')
  )
    ? String(next.noticeFrom)
    : ''
  businessCache = next
  saveBusiness()
  return JSON.parse(JSON.stringify(businessCache))
}

export async function getMyProfile(): Promise<UserProfile> {
  await delay(60)
  return JSON.parse(JSON.stringify(loadProfile()))
}

export async function saveMyProfile(
  payload: UserProfile
): Promise<UserProfile> {
  await delay(80)
  const existing = loadProfile()
  const input: any = payload || {}
  const nextDate = (key: 'birthday' | 'anniversary', label: string) => {
    if (
      !Object.prototype.hasOwnProperty.call(input, key) ||
      input[key] === undefined
    ) {
      return existing[key] || ''
    }
    const text = String(input[key] || '').trim()
    if (!text) {
      return ''
    }
    const normalized = normalizeSpecialDate(text)
    if (!normalized) {
      throw new Error(`${label}日期格式不正确`)
    }
    if (normalized > chinaDateKey(Date.now())) {
      throw new Error(`${label}不能晚于今天`)
    }
    return normalized
  }
  profileCache = {
    dislikes:
      input.dislikes !== undefined ? input.dislikes : existing.dislikes,
    tastes: input.tastes !== undefined ? input.tastes : existing.tastes,
    address:
      input.address !== undefined ? String(input.address) : existing.address,
    birthday: nextDate('birthday', '生日'),
    anniversary: nextDate('anniversary', '纪念日')
  } as UserProfile
  saveProfile()
  return JSON.parse(JSON.stringify(profileCache))
}

export async function getStats(): Promise<StoreStats> {
  await delay(60)
  const orders = loadOrders()
  const todayKey = new Date().toDateString()
  const today = orders.filter(
    order => new Date(order.createdAt).toDateString() === todayKey
  )
  const active = today.filter(order => order.status !== 'cancelled')
  const revenue = active.reduce(
    (sum, order) => sum + Number(order.amount || 0),
    0
  )
  const dishCount: Record<string, number> = {}
  active.forEach(order => {
    order.items.forEach(item => {
      dishCount[item.name] = (dishCount[item.name] || 0) + item.qty
    })
  })
  const top = Object.keys(dishCount)
    .map(name => ({ name, qty: dishCount[name] }))
    .sort((a, b) => b.qty - a.qty)[0]
  return {
    orderCount: active.length,
    completed: today.filter(order => order.status === 'completed').length,
    revenue: Number(revenue.toFixed(2)),
    topDish: top ? top.name : '',
    topQty: top ? top.qty : 0,
    totalOrders: orders.filter(order => order.status !== 'cancelled').length,
    ratedCount: active.filter(order => order.rating).length,
    avgRating: active.filter(order => order.rating).length
      ? Number(
          (
            active
              .filter(order => order.rating)
              .reduce((sum, order) => sum + Number(order.rating), 0) /
            active.filter(order => order.rating).length
          ).toFixed(1)
        )
      : 0,
    goodRatings: active.filter(order => order.rating === 3).length
  }
}

export async function getKitchenStatus(): Promise<KitchenStatus> {
  await delay(40)
  const today = dateInputString()
  const active = loadOrders().filter(
    order =>
      ['pending', 'accepted', 'cooking'].indexOf(order.status) > -1 &&
      (order.scheduledDate ||
        dateInputString(new Date(order.createdAt))) === today
  ).length
  return { active, busy: active > 0 }
}

export async function getDishSales(name: string): Promise<DishSales> {
  await delay(60)
  const target = String(name || '').trim()
  let qty = 0
  let orders = 0
  const start = Date.now() - 29 * 24 * 60 * 60 * 1000
  const dailyMap: Record<string, { date: string; qty: number }> = {}
  for (let i = 6; i >= 0; i--) {
    const date = chinaDateKey(Date.now() - i * 24 * 60 * 60 * 1000)
    dailyMap[date] = { date, qty: 0 }
  }
  loadOrders()
    .filter(order => Number(order.createdAt) >= start)
    .forEach(order => {
      if (order.status === 'cancelled') {
        return
      }
      let matched = 0
      order.items.forEach(item => {
        if (item.name === target) {
          const count = Number(item.qty || 0)
          qty += count
          matched += count
        }
      })
      if (matched > 0) {
        orders++
        const key = chinaDateKey(Number(order.createdAt))
        if (dailyMap[key]) {
          dailyMap[key].qty += matched
        }
      }
    })
  const daily = Object.keys(dailyMap)
    .sort()
    .map(key => ({
      date: key,
      label: `${Number(key.slice(5, 7))}/${Number(key.slice(8, 10))}`,
      qty: dailyMap[key].qty
    }))
  return { name: target, qty, orders, daily }
}

export async function getDishStats(dishId: string): Promise<DishStats> {
  await delay(60)
  const target = String(dishId || '').trim().slice(0, 64)
  if (!target) {
    throw new Error('缺少菜品 ID')
  }
  const days = 90
  const chinaNow = new Date(Date.now() + 8 * 60 * 60 * 1000)
  const todayStart =
    Date.UTC(
      chinaNow.getUTCFullYear(),
      chinaNow.getUTCMonth(),
      chinaNow.getUTCDate()
    ) - 8 * 60 * 60 * 1000
  const start = todayStart - (days - 1) * 24 * 60 * 60 * 1000
  let orders = 0
  let qty = 0
  let ratedCount = 0
  let ratingSum = 0
  let goodCount = 0
  loadOrders()
    .filter(order => Number(order.createdAt) >= start)
    .forEach(order => {
      if (order.status === 'cancelled') {
        return
      }
      let matched = false
      ;(order.items || []).forEach(item => {
        if (item.dishId === target) {
          matched = true
          qty += Number(item.qty || 0)
        }
      })
      if (!matched) {
        return
      }
      orders++
      const rating = Number(order.rating)
      if ([1, 2, 3].indexOf(rating) > -1) {
        ratedCount++
        ratingSum += rating
        if (rating === 3) {
          goodCount++
        }
      }
    })
  return {
    dishId: target,
    days,
    orders,
    qty,
    ratedCount,
    avgRating: ratedCount
      ? Number((ratingSum / ratedCount).toFixed(1))
      : 0,
    goodRate: ratedCount
      ? Math.round((goodCount / ratedCount) * 100)
      : 0
  }
}

export async function getStockLogs(
  dishId: string,
  limit = 10
): Promise<StockLog[]> {
  await delay(40)
  const size = Math.min(50, Math.max(1, Number(limit) || 10))
  return stockLogs
    .filter(log => !dishId || log.dishId === dishId)
    .slice(0, size)
    .map(log => ({ ...log }))
}

function buildTopRatedDishes(orders: Order[]) {
  const groups: Record<
    string,
    { name: string; sum: number; count: number }
  > = {}
  ;(orders || [])
    .slice()
    .sort((a, b) => Number(a.createdAt || 0) - Number(b.createdAt || 0))
    .forEach(order => {
      const rating = Number(order.rating)
      if (!Number.isInteger(rating) || rating < 1 || rating > 3) {
        return
      }
      const seenIds: Record<string, boolean> = {}
      const seenNames: Record<string, boolean> = {}
      ;(order.items || []).forEach(item => {
        const id = String(item.dishId || '').trim()
        const name = String(item.name || '').trim() || '未命名'
        if (id && seenIds[id]) {
          return
        }
        if (seenNames[name]) {
          return
        }
        if (id) {
          seenIds[id] = true
        }
        seenNames[name] = true
        const key = id ? `id:${id}` : `name:${name}`
        if (!groups[key]) {
          groups[key] = { name, sum: 0, count: 0 }
        }
        groups[key].name = name
        groups[key].sum += rating
        groups[key].count += 1
      })
    })
  const byName: Record<
    string,
    { name: string; sum: number; count: number }
  > = {}
  Object.keys(groups).forEach(key => {
    const group = groups[key]
    if (!byName[group.name]) {
      byName[group.name] = { name: group.name, sum: 0, count: 0 }
    }
    byName[group.name].sum += group.sum
    byName[group.name].count += group.count
  })
  return Object.keys(byName)
    .map(name => byName[name])
    .filter(group => group.count >= MIN_RATED_DISH_ORDERS)
    .sort(
      (a, b) =>
        b.sum / b.count - a.sum / a.count ||
        b.count - a.count ||
        (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)
    )
    .slice(0, TOP_RATED_DISH_LIMIT)
    .map(group => ({
      name: group.name,
      avgRating: Number((group.sum / group.count).toFixed(1)),
      ratedCount: group.count
    }))
}

export async function getKitchenReport(
  rangeDays = 30
): Promise<KitchenReport> {
  await delay(80)
  const days = Number(rangeDays) === 7 ? 7 : 30
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const start = today.getTime() - (days - 1) * 24 * 60 * 60 * 1000
  const orders = loadOrders().filter(
    order => Number(order.createdAt) >= start
  )
  const active = orders.filter(order => order.status !== 'cancelled')
  const revenue = active.reduce(
    (sum, order) => sum + Number(order.amount || 0),
    0
  )
  const monthStart = new Date(
    today.getFullYear(),
    today.getMonth(),
    1
  ).getTime()
  const monthRevenue = loadOrders()
    .filter(
      order =>
        Number(order.createdAt) >= monthStart &&
        order.status !== 'cancelled'
    )
    .reduce((sum, order) => sum + Number(order.amount || 0), 0)
  const previousMonthDays = new Date(
    today.getFullYear(),
    today.getMonth(),
    0
  ).getDate()
  const previousSameDay = Math.min(today.getDate(), previousMonthDays)
  const previousMonthStart = new Date(
    today.getFullYear(),
    today.getMonth() - 1,
    1
  ).getTime()
  const previousMonthEnd = new Date(
    today.getFullYear(),
    today.getMonth() - 1,
    previousSameDay + 1
  ).getTime()
  const previousActive = loadOrders().filter(
    order =>
      Number(order.createdAt) >= previousMonthStart &&
      Number(order.createdAt) < previousMonthEnd &&
      order.status !== 'cancelled'
  )
  const previousMonth = {
    revenue: Number(
      previousActive
        .reduce((sum, order) => sum + Number(order.amount || 0), 0)
        .toFixed(2)
    ),
    orders: previousActive.length,
    startDate: dateInputString(new Date(previousMonthStart)),
    endDate: dateInputString(
      new Date(previousMonthEnd - 24 * 60 * 60 * 1000)
    )
  }
  const dailyMap: Record<string, any> = {}
  for (let i = 0; i < days; i++) {
    const date = dateInputString(
      new Date(start + i * 24 * 60 * 60 * 1000)
    )
    dailyMap[date] = { date, amount: 0, count: 0 }
  }
  active.forEach(order => {
    const key = dateInputString(new Date(order.createdAt))
    if (dailyMap[key]) {
      dailyMap[key].amount += Number(order.amount || 0)
      dailyMap[key].count += 1
    }
  })
  const daily = Object.keys(dailyMap)
    .sort()
    .map(key => ({
      ...dailyMap[key],
      amount: Number(dailyMap[key].amount.toFixed(2)),
      label: `${Number(key.slice(5, 7))}/${Number(key.slice(8, 10))}`
    }))
  const dishMap: Record<string, any> = {}
  active.forEach(order => {
    order.items.forEach(item => {
      const name = item.name || '未命名'
      if (!dishMap[name]) {
        dishMap[name] = { name, qty: 0, revenue: 0 }
      }
      const qty = Number(item.qty || 0)
      dishMap[name].qty += qty
      dishMap[name].revenue += Number(item.price || 0) * qty
    })
  })
  const topDishes = Object.keys(dishMap)
    .map(name => ({
      ...dishMap[name],
      revenue: Number(dishMap[name].revenue.toFixed(2))
    }))
    .sort((a, b) => b.qty - a.qty || b.revenue - a.revenue)
    .slice(0, 8)
  const dishIdByName: Record<string, string> = {}
  dishes.forEach(dish => {
    dishIdByName[dish.name] = dish.id
  })
  topDishes.forEach(dish => {
    dish.id = dishIdByName[dish.name] || ''
  })
  const slowDishes = dishes
    .filter(dish => dish.status !== 'off')
    .map(dish => {
      const stat = dishMap[dish.name] || { qty: 0, revenue: 0 }
      return {
        id: dish.id,
        name: dish.name,
        status: dish.status || 'on',
        stock: typeof dish.stock === 'number' ? dish.stock : null,
        qty: Number(stat.qty || 0),
        revenue: Number(Number(stat.revenue || 0).toFixed(2))
      }
    })
    .sort((a, b) => a.qty - b.qty || a.name.localeCompare(b.name))
    .slice(0, 5)
  const costByName: Record<string, number> = {}
  dishes.forEach(dish => {
    const value = Number(dish.cost)
    if (isFinite(value) && value > 0) {
      costByName[dish.name] = value
    }
  })
  let costQty = 0
  let costRevenue = 0
  let costTotal = 0
  active.forEach(order => {
    order.items.forEach(item => {
      const rawCost =
        item.cost !== undefined ? Number(item.cost) : costByName[item.name]
      const unitCost = isFinite(rawCost) ? rawCost : 0
      if (unitCost <= 0) {
        return
      }
      const qty = Number(item.qty || 0)
      costQty += qty
      costRevenue += Number(item.price || 0) * qty
      costTotal += unitCost * qty
    })
  })
  const costStats = {
    qty: costQty,
    revenue: Number(costRevenue.toFixed(2)),
    cost: Number(costTotal.toFixed(2)),
    profit: Number((costRevenue - costTotal).toFixed(2)),
    margin:
      costRevenue > 0
        ? Math.round(((costRevenue - costTotal) / costRevenue) * 100)
        : 0
  }
  const rowQty: Record<string, number> = {}
  const rowCostQty: Record<string, number> = {}
  const rowCost: Record<string, number> = {}
  active.forEach(order => {
    order.items.forEach(item => {
      const name = item.name || '未命名'
      const qty = Number(item.qty || 0)
      rowQty[name] = (rowQty[name] || 0) + qty
      const rawCost =
        item.cost !== undefined ? Number(item.cost) : costByName[name]
      const unitCost = isFinite(rawCost) ? rawCost : 0
      if (unitCost > 0) {
        rowCostQty[name] = (rowCostQty[name] || 0) + qty
        rowCost[name] = (rowCost[name] || 0) + unitCost * qty
      }
    })
  })
  const dishRows = dishes
    .map(dish => {
      const stat = dishMap[dish.name] || { qty: 0, revenue: 0 }
      const qty = Number(stat.qty || 0)
      const revenue = Number(Number(stat.revenue || 0).toFixed(2))
      const hasCost =
        qty > 0 &&
        Number(rowCostQty[dish.name] || 0) === qty &&
        Number(rowCost[dish.name] || 0) > 0
      const cost = hasCost
        ? Number(Number(rowCost[dish.name]).toFixed(2))
        : null
      const profit = hasCost
        ? Number((revenue - cost).toFixed(2))
        : null
      return {
        id: dish.id,
        name: dish.name,
        status: dish.status || 'on',
        qty,
        revenue,
        cost,
        profit,
        margin:
          hasCost && revenue > 0
            ? Math.round((profit / revenue) * 100)
            : null
      }
    })
    .sort(
      (a, b) =>
        b.qty - a.qty ||
        b.revenue - a.revenue ||
        a.name.localeCompare(b.name)
    )
  const rated = active.filter(order => Number(order.rating) > 0)
  const avgRating = rated.length
    ? Number(
        (
          rated.reduce((sum, order) => sum + Number(order.rating), 0) /
          rated.length
        ).toFixed(1)
      )
    : 0
  const goodRate = rated.length
    ? Math.round(
        (rated.filter(order => Number(order.rating) === 3).length /
          rated.length) *
          100
      )
    : 0
  const repliedRatings = rated.filter(
    order => String(order.ownerReply || '').trim()
  ).length
  const replyRate = rated.length
    ? Math.round((repliedRatings / rated.length) * 100)
    : 0
  const tagMap: Record<string, number> = {}
  active.forEach(order => {
    ;(order.ratingTags || []).forEach(tag => {
      const name = String(tag || '')
      if (name) {
        tagMap[name] = (tagMap[name] || 0) + 1
      }
    })
  })
  const topTags = Object.keys(tagMap)
    .map(name => ({ name, count: tagMap[name] }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
  const mealStats = (['breakfast', 'lunch', 'dinner'] as MealId[]).map(
    meal => {
      const list = active.filter(order => order.meal === meal)
      return {
        meal,
        count: list.length,
        revenue: Number(
          list
            .reduce((sum, order) => sum + Number(order.amount || 0), 0)
            .toFixed(2)
        )
      }
    }
  )
  const topRatedDishes = buildTopRatedDishes(active)
  return {
    days,
    startDate: dateInputString(new Date(start)),
    endDate: dateInputString(today),
    totalOrders: active.length,
    cancelled: orders.length - active.length,
    completed: active.filter(order => order.status === 'completed').length,
    revenue: Number(revenue.toFixed(2)),
    monthRevenue: Number(monthRevenue.toFixed(2)),
    monthOrders: loadOrders().filter(
      order =>
        Number(order.createdAt) >= monthStart &&
        order.status !== 'cancelled'
    ).length,
    previousMonth,
    avgOrder: active.length
      ? Number((revenue / active.length).toFixed(2))
      : 0,
    daily,
    topDishes,
    slowDishes,
    costStats,
    dishRows,
    ratedCount: rated.length,
    avgRating,
    goodRate,
    repliedRatings,
    replyRate,
    topTags,
    mealStats,
    topRatedDishes,
    minRatedOrders: MIN_RATED_DISH_ORDERS
  }
}

export async function getMyStats(): Promise<MyStats> {
  await delay(60)
  const orders = loadOrders()
  const valid = orders.filter(order => order.status !== 'cancelled')
  const now = new Date()
  const monthly = valid.filter(order => {
    const date = new Date(order.createdAt)
    return (
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth()
    )
  })
  const dishCount: Record<string, number> = {}
  monthly.forEach(order => {
    order.items.forEach(item => {
      dishCount[item.name] = (dishCount[item.name] || 0) + item.qty
    })
  })
  const favorite =
    Object.keys(dishCount).sort((a, b) => dishCount[b] - dishCount[a])[0] ||
    '还没点过'
  return {
    total: valid.length,
    month: monthly.length,
    monthSpend: Number(
      monthly
        .reduce((sum, order) => sum + Number(order.amount || 0), 0)
        .toFixed(2)
    ),
    favorite
  }
}

export async function createCoupon(payload: {
  title: string
  note: string
  expiresInDays?: number
}): Promise<Coupon> {
  await delay(80)
  const title = String(payload.title || '').trim()
  if (!title) {
    throw new Error('券名不能为空')
  }
  const now = Date.now()
  const days = Number(payload.expiresInDays || 0)
  const coupon: Coupon = {
    id: `c${now}`,
    title: title.slice(0, 20),
    note: String(payload.note || '').trim().slice(0, 40),
    status: 'unused',
    owner: '',
    createdAt: now,
    claimedAt: 0,
    usedAt: 0,
    expiresAt: days > 0 ? now + Math.min(365, Math.floor(days)) * 24 * 60 * 60 * 1000 : 0
  }
  const coupons = loadCoupons()
  coupons.unshift(coupon)
  saveCoupons()
  return { ...coupon }
}

export async function getCoupons(): Promise<Coupon[]> {
  await delay(60)
  return loadCoupons()
    .slice()
    .sort((a, b) => b.createdAt - a.createdAt)
    .map(coupon => ({ ...coupon }))
}

export async function getMyExpiringCoupons(): Promise<{ count: number }> {
  await delay(40)
  const now = Date.now()
  const soon = now + 3 * 24 * 60 * 60 * 1000
  const count = loadCoupons().filter(
    coupon =>
      coupon.owner === 'mock-openid' &&
      coupon.status === 'unused' &&
      Number(coupon.expiresAt || 0) >= now &&
      Number(coupon.expiresAt || 0) <= soon
  ).length
  return { count }
}

export async function claimCoupon(id: string): Promise<Coupon> {
  await delay(80)
  const coupon = loadCoupons().find(item => item.id === id)
  if (!coupon) {
    throw new Error('券不存在')
  }
  if (coupon.status === 'used') {
    throw new Error('这张券已经用掉了')
  }
  if (coupon.expiresAt && coupon.expiresAt < Date.now()) {
    throw new Error('这张券过期了')
  }
  if (coupon.owner && coupon.owner !== 'mock-openid') {
    throw new Error('这张券已经被领走了')
  }
  coupon.owner = 'mock-openid'
  coupon.claimedAt = Date.now()
  saveCoupons()
  return { ...coupon }
}

export async function useCoupon(id: string): Promise<Coupon> {
  await delay(80)
  const coupon = loadCoupons().find(item => item.id === id)
  if (!coupon) {
    throw new Error('券不存在')
  }
  if (coupon.status === 'used') {
    throw new Error('这张券已经用掉了')
  }
  if (coupon.expiresAt && coupon.expiresAt < Date.now()) {
    throw new Error('这张券过期了')
  }
  coupon.status = 'used'
  coupon.usedAt = Date.now()
  saveCoupons()
  return { ...coupon }
}

export async function releaseCoupon(id: string): Promise<Coupon> {
  await delay(80)
  const coupon = loadCoupons().find(item => item.id === id)
  if (!coupon) {
    throw new Error('券不存在')
  }
  if (coupon.owner !== 'mock-openid') {
    throw new Error('这张券不是你的')
  }
  if (coupon.status === 'used') {
    throw new Error('这张券已经用掉了')
  }
  if (coupon.expiresAt && coupon.expiresAt < Date.now()) {
    throw new Error('这张券过期了')
  }
  coupon.owner = ''
  coupon.claimedAt = 0
  saveCoupons()
  return { ...coupon }
}

export async function deleteCoupon(id: string): Promise<{ id: string }> {
  await delay(80)
  const coupons = loadCoupons()
  const index = coupons.findIndex(coupon => coupon.id === id)
  if (index === -1) {
    throw new Error('券不存在')
  }
  coupons.splice(index, 1)
  saveCoupons()
  return { id }
}

export async function rollMenu(): Promise<any> {
  await delay(60)
  const menus = loadMenus()
  const tomorrowDate = new Date()
  tomorrowDate.setDate(tomorrowDate.getDate() + 1)
  const tomorrow = dateInputString(tomorrowDate)
  const today = dateInputString()
  const rolled: MealId[] = []
  const mealsList: MealId[] = ['breakfast', 'lunch', 'dinner']
  for (const meal of mealsList) {
    const key = `${tomorrow}_${meal}`
    if (menus[key]) {
      continue
    }
    const current = menus[`${today}_${meal}`]
    if (!current) {
      continue
    }
    menus[key] = {
      exists: true,
      date: tomorrow,
      meal,
      dishIds: current.dishIds.slice(),
      open: current.open !== false
    }
    rolled.push(meal)
  }
  saveMenus()
  let restored = 0
  dishes.forEach(dish => {
    if (dish.status === 'soldout') {
      dish.status = 'on'
      dishStatusOverrides[dish.id] = 'on'
      restored++
    }
  })
  if (restored) {
    persistOverrides()
  }
  return { date: tomorrow, menus: rolled, restored }
}

export async function deleteMenu(
  date: string,
  meal: MealId
): Promise<{ date: string; meal: MealId }> {
  await delay(60)
  const menus = loadMenus()
  delete menus[`${date}_${meal}`]
  saveMenus()
  return { date, meal }
}

const MENU_TEMPLATES_KEY = 'kfl_menu_templates_server_v1'

function loadServerTemplates(): MenuTemplate[] {
  try {
    const raw = wx.getStorageSync(MENU_TEMPLATES_KEY)
    const list = raw ? JSON.parse(raw) : []
    return Array.isArray(list) ? list : []
  } catch (e) {
    return []
  }
}

export async function getMenuTemplates(): Promise<MenuTemplate[]> {
  await delay(60)
  return loadServerTemplates().map(item => ({
    ...item,
    dishIds: [...item.dishIds]
  }))
}

export async function exportData(): Promise<BackupData> {
  await delay(80)
  const [categories, dishes, wishes, coupons, templates] = await Promise.all([
    getCategories(),
    getDishes(),
    getWishes(),
    getCoupons(),
    getMenuTemplates()
  ])
  const menuMap = loadMenus()
  const menus = Object.keys(menuMap).map(key => menuMap[key])
  const orders = loadOrders().slice(0, 200)
  return {
    exportedAt: Date.now(),
    version: '1.0',
    ordersLimit: 200,
    counts: {
      categories: categories.length,
      dishes: dishes.length,
      menus: menus.length,
      coupons: coupons.length,
      wishes: wishes.length,
      orders: orders.length
    },
    data: {
      categories,
      dishes,
      menus,
      coupons,
      wishes,
      orders,
      config: {
        initialized: true,
        business: loadBusiness(),
        menuTemplates: templates
      }
    }
  }
}

export async function saveMenuTemplates(
  templates: MenuTemplate[]
): Promise<MenuTemplate[]> {
  await delay(80)
  const list = (templates || [])
    .slice(0, 15)
    .map((item, index) => ({
      id: String(item.id || `tpl-${index}`).slice(0, 40),
      name: String(item.name || '').trim().slice(0, 12),
      meal: (['breakfast', 'lunch', 'dinner'] as MealId[]).indexOf(item.meal) > -1
        ? item.meal
        : ('lunch' as MealId),
      dishIds: Array.isArray(item.dishIds)
        ? item.dishIds.filter(id => typeof id === 'string').slice(0, 50)
        : [],
      updatedAt: Number(item.updatedAt || Date.now())
    }))
    .filter(item => item.name && item.dishIds.length)
  try {
    wx.setStorageSync(MENU_TEMPLATES_KEY, JSON.stringify(list))
  } catch (e) {
    // 忽略存储失败
  }
  return list
}

export async function getMenuForDate(
  date: string,
  meal: MealId
): Promise<DailyMenu> {
  await delay(60)
  const menu = loadMenus()[`${date}_${meal}`]
  if (!menu) {
    return { exists: false, date, meal, dishIds: [], open: true }
  }
  return JSON.parse(JSON.stringify(menu))
}

// mock 也按北京时间算日期，和云函数保持同一口径
function chinaDateKey(ts: number): string {
  const d = new Date(ts + 8 * 60 * 60 * 1000)
  const month = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${d.getUTCFullYear()}-${month}-${day}`
}

function normalizeSpecialDate(value: any): string {
  const text = String(value || '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return ''
  }
  const parts = text.split('-').map(Number)
  const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]))
  if (
    date.getUTCFullYear() !== parts[0] ||
    date.getUTCMonth() !== parts[1] - 1 ||
    date.getUTCDate() !== parts[2] ||
    parts[0] < 1900 ||
    parts[0] > 2100
  ) {
    return ''
  }
  return text
}

function annualOccurrence(
  dateKey: string,
  todayKey: string
): { days: number; date: string } {
  const todayParts = todayKey.split('-').map(Number)
  const dateParts = dateKey.split('-').map(Number)
  const todayUtc = Date.UTC(
    todayParts[0],
    todayParts[1] - 1,
    todayParts[2]
  )
  const occurrence = (year: number) => {
    const month = dateParts[1]
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
    return Date.UTC(year, month - 1, Math.min(dateParts[2], lastDay))
  }
  let year = todayParts[0]
  let next = occurrence(year)
  if (next < todayUtc) {
    year += 1
    next = occurrence(year)
  }
  const date = new Date(next)
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return {
    days: Math.round((next - todayUtc) / (24 * 60 * 60 * 1000)),
    date: `${month}-${day}`
  }
}

function collectMockSpecialDays(windowDays: number): SpecialDays {
  const profile = loadProfile()
  const today = chinaDateKey(Date.now())
  const days: SpecialDays['days'] = []
  ;[
    ['birthday', 'birthday'],
    ['anniversary', 'anniversary']
  ].forEach(([key, kind]) => {
    const dateKey = normalizeSpecialDate((profile as any)[key])
    if (!dateKey) {
      return
    }
    const remain = annualOccurrence(dateKey, today)
    if (remain.days >= 0 && remain.days < windowDays) {
      days.push({
        kind: kind as SpecialDays['days'][number]['kind'],
        date: remain.date,
        days: remain.days
      })
    }
  })
  days.sort(
    (a, b) =>
      a.days - b.days ||
      (a.kind === b.kind ? 0 : a.kind === 'birthday' ? -1 : 1)
  )
  return {
    today,
    windowDays,
    total: days.length,
    days: days.slice(0, 10)
  }
}

export async function getSpecialDays(): Promise<SpecialDays> {
  await delay(60)
  return collectMockSpecialDays(30)
}

export async function getMySpecialDays(): Promise<SpecialDays> {
  await delay(60)
  return collectMockSpecialDays(4)
}

export async function getWeekMenus(): Promise<WeekMenus> {
  await delay(60)
  const menus = loadMenus()
  const meals: MealId[] = ['breakfast', 'lunch', 'dinner']
  const now = Date.now()
  const dates: string[] = []
  for (let i = 0; i < 7; i++) {
    dates.push(chinaDateKey(now + i * 24 * 60 * 60 * 1000))
  }
  return JSON.parse(
    JSON.stringify({
      startDate: dates[0],
      endDate: dates[dates.length - 1],
      days: dates.map(date => ({
        date,
        weekday: new Date(
          Date.parse(date + 'T00:00:00+08:00') + 8 * 60 * 60 * 1000
        ).getUTCDay(),
        menus: meals.map(meal => {
          const menu = menus[`${date}_${meal}`]
          if (!menu) {
            return { exists: false, date, meal, dishIds: [], open: true }
          }
          return { ...menu }
        })
      }))
    })
  )
}

export async function saveMenu(payload: {
  date: string
  meal: MealId
  dishIds: string[]
  open: boolean
}): Promise<DailyMenu> {
  await delay(80)
  const menus = loadMenus()
  const data: DailyMenu = {
    exists: true,
    date: payload.date,
    meal: payload.meal,
    dishIds: (payload.dishIds || []).slice(),
    open: payload.open !== false
  }
  menus[`${payload.date}_${payload.meal}`] = data
  saveMenus()
  return JSON.parse(JSON.stringify(data))
}
