import * as mock from './mock'
import { USE_CLOUD } from '../config'
import type {
  Category,
  CreateOrderPayload,
  Dish,
  InitResult,
  MeInfo,
  Order,
  OrderStatus
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
