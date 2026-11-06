import * as mock from './mock'
import { USE_CLOUD } from '../config'
import { dishEmoji } from '../utils/dish-emoji'
import { DISH_ART } from '../utils/dish-art-map'
import type {
  BackupData,
  Business,
  Category,
  Coupon,
  CreateOrderPayload,
  DailyMenu,
  Dish,
  DishSales,
  DishInput,
  InitResult,
  KitchenReport,
  KitchenStatus,
  MealId,
  MenuTemplate,
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

// 所有云调用统一走 cloudfunctions/api，按 action 路由。
async function callApi<T>(action: string, payload?: any): Promise<T> {
  if (!wx.cloud) {
    throw new Error('当前基础库不支持云开发')
  }
  const res: any = await wx.cloud.callFunction({
    name: 'api',
    data: { action, payload: payload || {} }
  })
  const result = (res && res.result) || {}
  if (result.ok === false) {
    const message = String(result.error || '云函数调用失败')
    // 把云端额度错误翻译成人话
    if (
      /EXCEED_REQUEST_LIMIT|OutOfReadRequestQuota|exceed request limit/i.test(
        message
      )
    ) {
      throw new Error('今天的云端读取额度用完了，0 点后恢复')
    }
    throw new Error(message)
  }
  return result.data as T
}

// 分类几乎不变，缓存 5 分钟，减少首页每次进入的数据库读取
let categoriesCache: { at: number; data: Category[] } | null = null
let businessCache: { at: number; data: Business } | null = null
let menuCache: Record<string, { at: number; data: DailyMenu }> = {}
let kitchenStatusCache: { at: number; data: KitchenStatus } | null = null
let lastOrderCache: { at: number; data: Order | null } | null = null
const BUSINESS_CACHE_TTL = 60 * 1000
const MENU_CACHE_TTL = 60 * 1000
const KITCHEN_STATUS_TTL = 30 * 1000
const LAST_ORDER_CACHE_TTL = 2 * 60 * 1000

function cloneData<T>(value: T): T {
  return JSON.parse(JSON.stringify(value))
}

function invalidateMenuCache() {
  menuCache = {}
}

export async function getCategories(): Promise<Category[]> {
  if (USE_CLOUD) {
    if (
      categoriesCache &&
      Date.now() - categoriesCache.at < 5 * 60 * 1000
    ) {
      return categoriesCache.data.map(item => ({ ...item }))
    }
    const data = await callApi<Category[]>('getCategories')
    categoriesCache = { at: Date.now(), data }
    return data.map(item => ({ ...item }))
  }
  return mock.getCategories()
}

export async function saveCategory(payload: {
  id?: string
  name: string
  color: string
}): Promise<Category> {
  if (USE_CLOUD) {
    const result = await callApi<Category>('saveCategory', payload)
    categoriesCache = null
    return result
  }
  return mock.saveCategory(payload)
}

export async function deleteCategory(id: string): Promise<{ id: string }> {
  if (USE_CLOUD) {
    const result = await callApi<{ id: string }>('deleteCategory', { id })
    categoriesCache = null
    return result
  }
  return mock.deleteCategory(id)
}

export async function moveCategory(
  id: string,
  direction: 'up' | 'down'
): Promise<{ moved: boolean }> {
  if (USE_CLOUD) {
    const result = await callApi<{ moved: boolean }>('moveCategory', {
      id,
      direction
    })
    categoriesCache = null
    return result
  }
  return mock.moveCategory(id, direction)
}

// 给菜品补一个卡通插画和 emoji，用作没有上传图片时的占位
function decorateDish(dish: Dish): Dish {
  if (dish) {
    return Object.assign({}, dish, {
      emoji: dishEmoji(dish.name, dish.categoryId),
      cartoon: DISH_ART[dish.name] || ''
    })
  }
  return dish
}

const DISH_CACHE_KEY = 'kfl_dishes_cache_v1'
const DISH_CACHE_TTL = 60 * 1000

function readDishCache(): { data: Dish[]; at: number } {
  try {
    const raw = wx.getStorageSync(DISH_CACHE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed && Array.isArray(parsed.data) && parsed.data.length) {
        return { data: parsed.data, at: Number(parsed.at || 0) }
      }
    }
  } catch (e) {
    // 缓存损坏时忽略
  }
  return { data: [], at: 0 }
}

function writeDishCache(dishes: Dish[]) {
  try {
    wx.setStorageSync(
      DISH_CACHE_KEY,
      JSON.stringify({ at: Date.now(), data: dishes })
    )
  } catch (e) {
    // 存储失败不影响使用
  }
}

function invalidateDishCache() {
  try {
    wx.removeStorageSync(DISH_CACHE_KEY)
  } catch (e) {
    // 忽略
  }
}

export async function getDishes(): Promise<Dish[]> {
  if (USE_CLOUD) {
    const cached = readDishCache()
    if (cached.data.length && Date.now() - cached.at < DISH_CACHE_TTL) {
      return cached.data
    }
    try {
      const data = await callApi<Dish[]>('getDishes')
      const decorated = (data || []).map(decorateDish)
      writeDishCache(decorated)
      return decorated
    } catch (e) {
      // 云端读取失败（例如额度用尽）时，退回上次成功的菜单缓存
      if (cached.data.length) {
        return cached.data
      }
      throw e
    }
  }
  const data = await mock.getDishes()
  return data.map(decorateDish)
}

export async function getDish(id: string): Promise<Dish | null> {
  if (USE_CLOUD) {
    try {
      const data = await callApi<Dish | null>('getDish', { id })
      return data ? decorateDish(data) : null
    } catch (e) {
      const cached = readDishCache().data.find(item => item.id === id)
      if (cached) {
        return cached
      }
      throw e
    }
  }
  const dish = await mock.getDish(id)
  return dish ? decorateDish(dish) : null
}

export async function toggleDishStatus(id: string): Promise<Dish | null> {
  if (USE_CLOUD) {
    const result = await callApi<Dish | null>('toggleDishStatus', { id })
    invalidateDishCache()
    return result
  }
  return mock.toggleDishStatus(id)
}

export async function saveDish(payload: DishInput): Promise<Dish> {
  if (USE_CLOUD) {
    const result = await callApi<Dish>('saveDish', payload)
    invalidateDishCache()
    return result
  }
  return mock.saveDish(payload)
}

export async function moveDish(
  id: string,
  direction: 'up' | 'down'
): Promise<{ moved: boolean }> {
  if (USE_CLOUD) {
    const result = await callApi<{ moved: boolean }>('moveDish', {
      id,
      direction
    })
    invalidateDishCache()
    return result
  }
  return mock.moveDish(id, direction)
}

export async function deleteDish(id: string): Promise<{ id: string }> {
  if (USE_CLOUD) {
    const result = await callApi<{ id: string }>('deleteDish', { id })
    invalidateDishCache()
    return result
  }
  return mock.deleteDish(id)
}

export async function getOrders(): Promise<Order[]> {
  if (USE_CLOUD) {
    return callApi<Order[]>('getOrders')
  }
  return mock.getOrders()
}

export async function getLastOrder(): Promise<Order | null> {
  if (USE_CLOUD) {
    if (
      lastOrderCache &&
      Date.now() - lastOrderCache.at < LAST_ORDER_CACHE_TTL
    ) {
      return cloneData(lastOrderCache.data)
    }
    const data = await callApi<Order | null>('getLastOrder')
    lastOrderCache = { at: Date.now(), data }
    return cloneData(data)
  }
  return mock.getLastOrder()
}

export async function getActiveOrders(): Promise<Order[]> {
  if (USE_CLOUD) {
    return callApi<Order[]>('getActiveOrders')
  }
  return mock.getActiveOrders()
}

export async function acceptPendingOrders(): Promise<{
  done: number
  total: number
}> {
  if (USE_CLOUD) {
    return callApi<{ done: number; total: number }>('acceptPendingOrders')
  }
  return mock.acceptPendingOrders()
}

export async function getAllOrders(): Promise<Order[]> {
  if (USE_CLOUD) {
    return callApi<Order[]>('getAllOrders')
  }
  return mock.getAllOrders()
}

export async function exportData(): Promise<BackupData> {
  if (USE_CLOUD) {
    return callApi<BackupData>('exportData')
  }
  return mock.exportData()
}

export async function getOrder(id: string): Promise<Order | null> {
  if (USE_CLOUD) {
    return callApi<Order | null>('getOrder', { id })
  }
  return mock.getOrder(id)
}

export async function createOrder(payload: CreateOrderPayload): Promise<Order> {
  const order = USE_CLOUD
    ? await callApi<Order>('createOrder', payload)
    : await mock.createOrder(payload)
  lastOrderCache = null
  return order
}

export async function cancelOrder(
  id: string,
  reason?: string
): Promise<Order | null> {
  if (USE_CLOUD) {
    return callApi<Order | null>('cancelOrder', { id, reason })
  }
  return mock.cancelOrder(id, reason)
}

export async function updateOrderNote(
  id: string,
  note: string
): Promise<Order | null> {
  if (USE_CLOUD) {
    return callApi<Order | null>('updateOrderNote', { id, note })
  }
  return mock.updateOrderNote(id, note)
}

export async function urgeOrder(id: string): Promise<Order | null> {
  if (USE_CLOUD) {
    return callApi<Order | null>('urgeOrder', { id })
  }
  return mock.urgeOrder(id)
}

export async function rateOrder(
  id: string,
  rating: number,
  feedback: string,
  tags: string[] = []
): Promise<Order | null> {
  if (USE_CLOUD) {
    return callApi<Order | null>('rateOrder', { id, rating, feedback, tags })
  }
  return mock.rateOrder(id, rating, feedback, tags)
}

export async function replyRating(
  id: string,
  reply: string,
  ratedAt?: number
): Promise<Order | null> {
  if (USE_CLOUD) {
    return callApi<Order | null>('replyRating', { id, reply, ratedAt })
  }
  return mock.replyRating(id, reply, ratedAt)
}

export async function updateOrderStatus(
  id: string,
  status: OrderStatus,
  reason?: string
): Promise<Order | null> {
  if (USE_CLOUD) {
    return callApi<Order | null>('updateOrderStatus', {
      id,
      status,
      reason
    })
  }
  return mock.updateOrderStatus(id, status, reason)
}

export async function getMe(): Promise<MeInfo> {
  if (USE_CLOUD) {
    return callApi<MeInfo>('getMe')
  }
  return mock.getMe()
}

export async function initDb(): Promise<InitResult> {
  if (USE_CLOUD) {
    return callApi<InitResult>('initDb')
  }
  return mock.initDb()
}

export async function createWish(content: string): Promise<Wish> {
  if (USE_CLOUD) {
    return callApi<Wish>('createWish', { content })
  }
  return mock.createWish(content)
}

export async function getWishes(): Promise<Wish[]> {
  if (USE_CLOUD) {
    return callApi<Wish[]>('getWishes')
  }
  return mock.getWishes()
}

export async function updateWish(payload: {
  id: string
  status?: WishStatus
  plannedDate?: string
  reply?: string
}): Promise<Wish> {
  if (USE_CLOUD) {
    return callApi<Wish>('updateWish', payload)
  }
  return mock.updateWish(payload)
}

export async function deleteWish(id: string): Promise<{ id: string }> {
  if (USE_CLOUD) {
    return callApi<{ id: string }>('deleteWish', { id })
  }
  return mock.deleteWish(id)
}

export async function getBusiness(): Promise<Business> {
  if (USE_CLOUD) {
    if (
      businessCache &&
      Date.now() - businessCache.at < BUSINESS_CACHE_TTL
    ) {
      return cloneData(businessCache.data)
    }
    const data = await callApi<Business>('getBusiness')
    businessCache = { at: Date.now(), data }
    return cloneData(data)
  }
  return mock.getBusiness()
}

export async function updateBusiness(payload: Business): Promise<Business> {
  if (USE_CLOUD) {
    const result = await callApi<Business>('updateBusiness', payload)
    businessCache = null
    invalidateMenuCache()
    return result
  }
  return mock.updateBusiness(payload)
}

export async function getMyProfile(): Promise<UserProfile> {
  if (USE_CLOUD) {
    return callApi<UserProfile>('getMyProfile')
  }
  return mock.getMyProfile()
}

export async function saveMyProfile(
  payload: UserProfile
): Promise<UserProfile> {
  if (USE_CLOUD) {
    return callApi<UserProfile>('saveMyProfile', payload)
  }
  return mock.saveMyProfile(payload)
}

export async function getStats(): Promise<StoreStats> {
  if (USE_CLOUD) {
    return callApi<StoreStats>('getStats')
  }
  return mock.getStats()
}

export async function getKitchenReport(): Promise<KitchenReport> {
  if (USE_CLOUD) {
    return callApi<KitchenReport>('getKitchenReport')
  }
  return mock.getKitchenReport()
}

export async function getKitchenStatus(): Promise<KitchenStatus> {
  if (USE_CLOUD) {
    if (
      kitchenStatusCache &&
      Date.now() - kitchenStatusCache.at < KITCHEN_STATUS_TTL
    ) {
      return cloneData(kitchenStatusCache.data)
    }
    const data = await callApi<KitchenStatus>('getKitchenStatus')
    kitchenStatusCache = { at: Date.now(), data }
    return cloneData(data)
  }
  return mock.getKitchenStatus()
}

export async function getDishSales(name: string): Promise<DishSales> {
  if (USE_CLOUD) {
    return callApi<DishSales>('getDishSales', { name })
  }
  return mock.getDishSales(name)
}

export async function getMyStats(): Promise<MyStats> {
  if (USE_CLOUD) {
    return callApi<MyStats>('getMyStats')
  }
  return mock.getMyStats()
}

export async function rollMenu(): Promise<any> {
  if (USE_CLOUD) {
    const result = await callApi<any>('rollMenu')
    invalidateMenuCache()
    return result
  }
  return mock.rollMenu()
}

export async function createCoupon(payload: {
  title: string
  note: string
  expiresInDays?: number
}): Promise<Coupon> {
  if (USE_CLOUD) {
    return callApi<Coupon>('createCoupon', payload)
  }
  return mock.createCoupon(payload)
}

export async function getCoupons(): Promise<Coupon[]> {
  if (USE_CLOUD) {
    return callApi<Coupon[]>('getCoupons')
  }
  return mock.getCoupons()
}

export async function claimCoupon(id: string): Promise<Coupon> {
  if (USE_CLOUD) {
    return callApi<Coupon>('claimCoupon', { id })
  }
  return mock.claimCoupon(id)
}

export async function useCoupon(id: string): Promise<Coupon> {
  if (USE_CLOUD) {
    return callApi<Coupon>('useCoupon', { id })
  }
  return mock.useCoupon(id)
}

export async function deleteCoupon(id: string): Promise<{ id: string }> {
  if (USE_CLOUD) {
    return callApi<{ id: string }>('deleteCoupon', { id })
  }
  return mock.deleteCoupon(id)
}

export async function getMenuForDate(
  date: string,
  meal: MealId
): Promise<DailyMenu> {
  if (USE_CLOUD) {
    const key = date + '_' + meal
    const cached = menuCache[key]
    if (cached && Date.now() - cached.at < MENU_CACHE_TTL) {
      return cloneData(cached.data)
    }
    const data = await callApi<DailyMenu>('getMenuForDate', { date, meal })
    menuCache[key] = { at: Date.now(), data }
    return cloneData(data)
  }
  return mock.getMenuForDate(date, meal)
}

export async function getWeekMenus(): Promise<WeekMenus> {
  if (USE_CLOUD) {
    return callApi<WeekMenus>('getWeekMenus')
  }
  return mock.getWeekMenus()
}

export async function getMenuTemplates(): Promise<MenuTemplate[]> {
  if (USE_CLOUD) {
    return callApi<MenuTemplate[]>('getMenuTemplates')
  }
  return mock.getMenuTemplates()
}

export async function saveMenuTemplates(
  templates: MenuTemplate[]
): Promise<MenuTemplate[]> {
  if (USE_CLOUD) {
    return callApi<MenuTemplate[]>('saveMenuTemplates', { templates })
  }
  return mock.saveMenuTemplates(templates)
}

export async function saveMenu(payload: {
  date: string
  meal: MealId
  dishIds: string[]
  open: boolean
}): Promise<DailyMenu> {
  if (USE_CLOUD) {
    const result = await callApi<DailyMenu>('saveMenu', payload)
    invalidateMenuCache()
    return result
  }
  return mock.saveMenu(payload)
}

export async function deleteMenu(
  date: string,
  meal: MealId
): Promise<{ date: string; meal: MealId }> {
  if (USE_CLOUD) {
    const result = await callApi<{ date: string; meal: MealId }>(
      'deleteMenu',
      {
        date,
        meal
      }
    )
    invalidateMenuCache()
    return result
  }
  return mock.deleteMenu(date, meal)
}
