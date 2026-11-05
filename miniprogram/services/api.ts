import * as mock from './mock'
import { USE_CLOUD } from '../config'
import type {
  Business,
  Category,
  CreateOrderPayload,
  Dish,
  DishInput,
  InitResult,
  MeInfo,
  Order,
  OrderStatus,
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
    throw new Error(result.error || '云函数调用失败')
  }
  return result.data as T
}

export async function getCategories(): Promise<Category[]> {
  if (USE_CLOUD) {
    return callApi<Category[]>('getCategories')
  }
  return mock.getCategories()
}

export async function getDishes(): Promise<Dish[]> {
  if (USE_CLOUD) {
    return callApi<Dish[]>('getDishes')
  }
  return mock.getDishes()
}

export async function getDish(id: string): Promise<Dish | null> {
  if (USE_CLOUD) {
    return callApi<Dish | null>('getDish', { id })
  }
  return mock.getDish(id)
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

export async function deleteDish(id: string): Promise<{ id: string }> {
  if (USE_CLOUD) {
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
