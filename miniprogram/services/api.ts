import * as mock from './mock'
import { USE_CLOUD } from '../config'
import { dishEmoji } from '../utils/dish-emoji'
import { DISH_ART } from '../utils/dish-art-map'
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

function readDishCache(): Dish[] {
  try {
    const raw = wx.getStorageSync(DISH_CACHE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed && Array.isArray(parsed.data) && parsed.data.length) {
        return parsed.data
      }
    }
  } catch (e) {
    // 缓存损坏时忽略
  }
  return []
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

export async function getDishes(): Promise<Dish[]> {
  if (USE_CLOUD) {
    try {
      const data = await callApi<Dish[]>('getDishes')
      const decorated = (data || []).map(decorateDish)
      writeDishCache(decorated)
      return decorated
    } catch (e) {
      // 云端读取失败（例如额度用尽）时，退回上次成功的菜单缓存
      const cached = readDishCache()
      if (cached.length) {
        return cached
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
      const cached = readDishCache().find(item => item.id === id)
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
    return callApi<Dish | null>('toggleDishStatus', { id })
  }
  return mock.toggleDishStatus(id)
}

export async function saveDish(payload: DishInput): Promise<Dish> {
  if (USE_CLOUD) {
    return callApi<Dish>('saveDish', payload)
  }
  return mock.saveDish(payload)
}

export async function moveDish(
  id: string,
  direction: 'up' | 'down'
): Promise<{ moved: boolean }> {
  if (USE_CLOUD) {
    return callApi<{ moved: boolean }>('moveDish', { id, direction })
  }
  return mock.moveDish(id, direction)
}

export async function deleteDish(id: string): Promise<{ id: string }> {  if (USE_CLOUD) {
    return callApi<{ id: string }>('deleteDish', { id })
  }
  return mock.deleteDish(id)
}

export async function getOrders(): Promise<Order[]> {
  if (USE_CLOUD) {
    return callApi<Order[]>('getOrders')
  }
  return mock.getOrders()
}

export async function getActiveOrders(): Promise<Order[]> {
  if (USE_CLOUD) {
    return callApi<Order[]>('getActiveOrders')
  }
  return mock.getActiveOrders()
}

export async function getAllOrders(): Promise<Order[]> {
  if (USE_CLOUD) {
    return callApi<Order[]>('getAllOrders')
  }
  return mock.getAllOrders()
}

export async function getOrder(id: string): Promise<Order | null> {
  if (USE_CLOUD) {
    return callApi<Order | null>('getOrder', { id })
  }
  return mock.getOrder(id)
}

export async function createOrder(payload: CreateOrderPayload): Promise<Order> {
  if (USE_CLOUD) {
    return callApi<Order>('createOrder', payload)
  }
  return mock.createOrder(payload)
}

export async function cancelOrder(id: string): Promise<Order | null> {
  if (USE_CLOUD) {
    return callApi<Order | null>('cancelOrder', { id })
  }
  return mock.cancelOrder(id)
}

export async function urgeOrder(id: string): Promise<Order | null> {
  if (USE_CLOUD) {
    return callApi<Order | null>('urgeOrder', { id })
  }
  return mock.urgeOrder(id)
}

export async function updateOrderStatus(
  id: string,
  status: OrderStatus
): Promise<Order | null> {
  if (USE_CLOUD) {
    return callApi<Order | null>('updateOrderStatus', { id, status })
  }
  return mock.updateOrderStatus(id, status)
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
    return callApi<Business>('getBusiness')
  }
  return mock.getBusiness()
}

export async function updateBusiness(payload: Business): Promise<Business> {
  if (USE_CLOUD) {
    return callApi<Business>('updateBusiness', payload)
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

export async function getMyStats(): Promise<MyStats> {
  if (USE_CLOUD) {
    return callApi<MyStats>('getMyStats')
  }
  return mock.getMyStats()
}

export async function rollMenu(): Promise<any> {
  if (USE_CLOUD) {
    return callApi<any>('rollMenu')
  }
  return mock.rollMenu()
}

export async function createCoupon(payload: {
  title: string
  note: string
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
    return callApi<DailyMenu>('getMenuForDate', { date, meal })
  }
  return mock.getMenuForDate(date, meal)
}

export async function saveMenu(payload: {
  date: string
  meal: MealId
  dishIds: string[]
  open: boolean
}): Promise<DailyMenu> {
  if (USE_CLOUD) {
    return callApi<DailyMenu>('saveMenu', payload)
  }
  return mock.saveMenu(payload)
}

export async function deleteMenu(
  date: string,
  meal: MealId
): Promise<{ date: string; meal: MealId }> {
  if (USE_CLOUD) {
    return callApi<{ date: string; meal: MealId }>('deleteMenu', {
      date,
      meal
    })
  }
  return mock.deleteMenu(date, meal)
}
