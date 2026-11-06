import type {
  Business,
  Category,
  Coupon,
  CreateOrderPayload,
  DailyMenu,
  Dish,
  DishInput,
  InitResult,
  MealId,
  MeInfo,
  MyStats,
  Order,
  OrderStatus,
  StoreStats,
  UserProfile,
  WeekMenus,
  Wish,
  WishStatus
} from './types'
import { STATUS_STEP_TEXT } from '../utils/constants'
import { dateInputString } from '../utils/format'

const ORDERS_KEY = 'kfl_orders_v1'
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
      '牛腩切块冷水下锅焯水\n番茄切块炒出汁，下牛腩翻炒\n小火炖 60 分钟，加盐收汁\n浇在热米饭上'
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
    meals: ['lunch', 'dinner']
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
    meals: ['lunch', 'dinner']
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

function loadBusiness(): Business {
  if (businessCache) {
    return businessCache
  }
  try {
    const raw = wx.getStorageSync(BUSINESS_KEY)
    if (raw) {
      businessCache = JSON.parse(raw)
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
      profileCache = JSON.parse(raw)
      return profileCache as UserProfile
    }
  } catch (e) {
    // 读取失败则使用默认值
  }
  profileCache = { dislikes: [], tastes: [], address: '' }
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
      couponCache = JSON.parse(raw)
      return couponCache as Coupon[]
    }
  } catch (e) {
    // 读取失败则使用种子数据
  }
  couponCache = [
    {
      id: 'coupon-seed-1',
      title: '洗碗券',
      note: '攒够 3 次可以换一次洗碗',
      status: 'unused',
      owner: '',
      createdAt: Date.now() - 2 * 60 * 60 * 1000,
      claimedAt: 0,
      usedAt: 0
    }
  ]
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
  const t1 = now - 20 * 60 * 1000
  const t2 = now - 3 * 60 * 60 * 1000
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
          note: '多酱汁'
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
          note: ''
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
      orderCache = JSON.parse(raw)
      return orderCache as Order[]
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
  const name = String(payload.name || '').trim()
  if (!name) {
    throw new Error('菜品名称不能为空')
  }
  const fields: Dish = {
    id: payload.id || `m${Date.now()}`,
    name,
    char: name.slice(0, 1),
    desc: String(payload.desc || '').trim(),
    price: Number(payload.price) || 0,
    categoryId: payload.categoryId,
    tags: payload.tags || [],
    spicyLevels: payload.spicyLevels || [],
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
    Object.assign(existing, fields)
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
    return { ...item, stockDeducted: limited }
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
  saveOrders()
  return { ...order }
}

export async function cancelOrder(id: string): Promise<Order | null> {
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
    }
  }
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
  feedback: string
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
  const changed =
    Number(order.rating) !== Number(rating) ||
    String(order.feedback || '') !== feedbackText
  order.rating = Number(rating)
  order.feedback = feedbackText
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
  status: OrderStatus
): Promise<Order | null> {
  await delay(80)
  const orders = loadOrders()
  const order = orders.find(item => item.id === id)
  if (!order) {
    return null
  }
  order.status = status
  order.timeline.push({
    status,
    title: STATUS_STEP_TEXT[status],
    time: Date.now()
  })
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
  return data
}

export async function updateBusiness(payload: Business): Promise<Business> {
  await delay(80)
  businessCache = JSON.parse(JSON.stringify(payload))
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
  profileCache = JSON.parse(JSON.stringify(payload))
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
    favorite
  }
}

export async function createCoupon(payload: {
  title: string
  note: string
}): Promise<Coupon> {
  await delay(80)
  const title = String(payload.title || '').trim()
  if (!title) {
    throw new Error('券名不能为空')
  }
  const now = Date.now()
  const coupon: Coupon = {
    id: `c${now}`,
    title: title.slice(0, 20),
    note: String(payload.note || '').trim().slice(0, 40),
    status: 'unused',
    owner: '',
    createdAt: now,
    claimedAt: 0,
    usedAt: 0
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

export async function claimCoupon(id: string): Promise<Coupon> {
  await delay(80)
  const coupon = loadCoupons().find(item => item.id === id)
  if (!coupon) {
    throw new Error('券不存在')
  }
  if (coupon.status === 'used') {
    throw new Error('这张券已经用掉了')
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
  coupon.status = 'used'
  coupon.usedAt = Date.now()
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
