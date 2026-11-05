import type {
  Category,
  CreateOrderPayload,
  Dish,
  InitResult,
  MeInfo,
  Order,
  OrderStatus
} from './types'
import { STATUS_STEP_TEXT } from '../utils/constants'

const ORDERS_KEY = 'kfl_orders_v1'
const DISH_STATUS_KEY = 'kfl_dish_status_v1'

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
    isRecommended: true
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
  dish.status = dish.status === 'soldout' ? 'on' : 'soldout'
  dishStatusOverrides[id] = dish.status
  persistOverrides()
  return { ...dish }
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

export async function getOrder(id: string): Promise<Order | null> {
  await delay(60)
  const order = loadOrders().find(item => item.id === id)
  return order ? { ...order } : null
}

export async function createOrder(payload: CreateOrderPayload): Promise<Order> {
  await delay(150)
  const orders = loadOrders()
  const now = Date.now()
  const order: Order = {
    id: `o${now}`,
    no: String(orders.length + 1).padStart(3, '0'),
    items: payload.items,
    amount: payload.amount,
    meal: payload.meal,
    expectedTime: payload.expectedTime,
    mode: payload.mode,
    note: payload.note,
    status: 'pending',
    timeline: [{ status: 'pending', title: '已下单', time: now }],
    createdAt: now
  }
  orders.unshift(order)
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
