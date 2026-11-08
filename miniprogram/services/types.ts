export type MealId = 'breakfast' | 'lunch' | 'dinner'

export type OrderStatus =
  | 'pending'
  | 'accepted'
  | 'cooking'
  | 'ready'
  | 'completed'
  | 'cancelled'

export interface Addon {
  id: string
  name: string
  price: number
}

export interface Dish {
  id: string
  name: string
  char: string
  desc: string
  price: number
  cost?: number
  categoryId: string
  tags: string[]
  spicyLevels: string[]
  addons: Addon[]
  status: 'on' | 'soldout' | 'off'
  color: string
  meals: MealId[]
  stock?: number
  isRecommended?: boolean
  image?: string
  emoji?: string
  cartoon?: string
  recipe?: string
  ingredients?: string[]
  allergens?: string[]
  priceHistory?: { from: number; to: number; at: number }[]
}

export interface Category {
  id: string
  name: string
  color: string
}

export interface DishInput {
  id?: string
  name: string
  desc: string
  price: number
  cost?: number
  priceBase?: number
  priceOnly?: boolean
  categoryId: string
  tags: string[]
  spicyLevels: string[]
  addons: Addon[]
  color: string
  meals: MealId[]
  status: 'on' | 'soldout' | 'off'
  stock: number
  stockBase?: number
  isRecommended: boolean
  image?: string
  recipe?: string
  ingredients?: string[]
  allergens?: string[]
}

export interface CartLine {
  key: string
  meal: MealId
  date: string
  dishId: string
  name: string
  price: number
  qty: number
  specs: string[]
  note: string
  color: string
}

export interface OrderItem {
  dishId: string
  name: string
  price: number
  cost?: number
  qty: number
  specs: string[]
  note: string
  allergens?: string[]
}

export interface TimelineEntry {
  status: OrderStatus
  title: string
  time: number
}

export interface OrderMessage {
  id: string
  role: 'customer' | 'admin'
  content: string
  at: number
}

export interface Order {
  id: string
  no: string
  items: OrderItem[]
  amount: number
  meal: MealId
  expectedTime: string
  mode: string
  note: string
  noteUpdatedAt?: number
  slotUpdatedAt?: number
  address?: string
  scheduledDate?: string
  profile?: {
    dislikes: string[]
    tastes: string[]
  }
  status: OrderStatus
  timeline: TimelineEntry[]
  messages?: OrderMessage[]
  customerUnread?: number
  adminUnread?: number
  customerReadAt?: number
  adminReadAt?: number
  viewerRole?: 'customer' | 'admin'
  createdAt: number
  urgedAt?: number
  urgeCount?: number
  rating?: number
  ratingTags?: string[]
  ratingImages?: string[]
  feedback?: string
  ratedAt?: number
  ownerReply?: string
  ownerReplyAt?: number
  cancelReason?: string
  cancelledBy?: 'customer' | 'admin'
}

export interface CreateOrderPayload {
  items: OrderItem[]
  amount: number
  meal: MealId
  expectedTime: string
  mode: string
  note: string
  address?: string
  scheduledDate?: string
  requestId?: string
}

export interface MeInfo {
  openid: string
  isAdmin: boolean
  initialized: boolean
}

export interface InitResult {
  initialized: boolean
  already: boolean
  isAdmin: boolean
}

export type WishStatus = 'pending' | 'planned' | 'done'

export interface Wish {
  id: string
  content: string
  status: WishStatus
  plannedDate: string
  reply: string
  createdAt: number
  updatedAt: number
}

export interface MealBusiness {
  open: boolean
  deadline: string
}

export interface Business {
  breakfast: MealBusiness
  lunch: MealBusiness
  dinner: MealBusiness
  closedNote: string
  notice?: string
  noticeFrom?: string
  noticeUntil?: string
  recommendText?: string
  lowStockThreshold?: number
  dailyGoal?: number
  monthlyGoal?: number
  closedDates?: string[]
  weeklyClosed?: number[]
}

export interface UserProfile {
  dislikes: string[]
  tastes: string[]
  address: string
  birthday?: string
  anniversary?: string
}

export interface FavoritesCloudData {
  ids: string[]
  times: Record<string, number>
  updatedAt: number
}

export interface EatenCloudData {
  map: Record<string, number>
  updatedAt: number
}

export interface SpecialDay {
  kind: 'birthday' | 'anniversary'
  date: string
  days: number
}

export interface SpecialDays {
  today: string
  windowDays: number
  total?: number
  days: SpecialDay[]
}

export interface StoreStats {
  orderCount: number
  completed: number
  revenue: number
  topDish: string
  topQty: number
  totalOrders?: number
  ratedCount?: number
  avgRating?: number
  goodRatings?: number
}

export interface MyStats {
  total: number
  month: number
  monthSpend: number
  favorite: string
  week?: number
  weekSpend?: number
  weekFavorite?: string
  weekFavoriteQty?: number
}

export interface KitchenReportDay {
  date: string
  label: string
  amount: number
  count: number
}

export interface KitchenReportDish {
  id?: string
  name: string
  status?: string
  stock?: number | null
  qty: number
  revenue: number
}

export interface KitchenCostStats {
  qty: number
  revenue: number
  cost: number
  profit: number
  margin: number
}

export interface KitchenDishRow {
  id: string
  name: string
  categoryId?: string
  status: string
  qty: number
  revenue: number
  cost: number | null
  profit: number | null
  margin: number | null
}

export interface KitchenMonthCompare {
  revenue: number
  orders: number
  startDate: string
  endDate: string
}

export interface KitchenReport {
  days: number
  startDate: string
  endDate: string
  totalOrders: number
  cancelled: number
  completed: number
  revenue: number
  monthRevenue: number
  monthOrders?: number
  previousMonth?: KitchenMonthCompare | null
  avgOrder: number
  daily: KitchenReportDay[]
  topDishes: KitchenReportDish[]
  slowDishes: KitchenReportDish[]
  costStats: KitchenCostStats
  dishRows: KitchenDishRow[]
  ratedCount: number
  avgRating: number
  goodRate: number
  repliedRatings: number
  replyRate: number
  topTags: { name: string; count: number }[]
  mealStats: { meal: MealId; count: number; revenue: number }[]
  topRatedDishes: { name: string; avgRating: number; ratedCount: number }[]
  minRatedOrders: number
}

export interface KitchenStatus {
  active: number
  busy: boolean
}

export interface DishSales {
  name: string
  qty: number
  orders: number
  daily: { date: string; label: string; qty: number }[]
}

export interface DishStats {
  dishId: string
  days: number
  orders: number
  qty: number
  lastAt?: number
  ratedCount: number
  avgRating: number
  goodRate: number
}

export interface StockLog {
  id: string
  dishId: string
  dishName: string
  delta: number | null
  before?: number
  after?: number
  source: 'order' | 'cancel' | 'edit'
  orderId?: string
  orderNo?: string
  createdAt: number
}

export type CouponStatus = 'unused' | 'used'

export interface Coupon {
  id: string
  title: string
  note: string
  status: CouponStatus
  owner: string
  createdAt: number
  claimedAt: number
  usedAt: number
  expiresAt?: number
}

export interface DailyMenu {
  exists: boolean
  date: string
  meal: MealId
  dishIds: string[]
  open: boolean
}

export interface WeekMenusDay {
  date: string
  // 0=周日，由服务端按北京时间计算
  weekday: number
  menus: DailyMenu[]
}

export interface WeekMenus {
  startDate: string
  endDate: string
  days: WeekMenusDay[]
}

export interface MenuTemplate {
  id: string
  name: string
  meal: MealId
  dishIds: string[]
  updatedAt: number
}

export interface BackupData {
  exportedAt: number
  version: string
  ordersLimit: number
  counts: Record<string, number>
  data: {
    categories: Category[]
    dishes: Dish[]
    menus: DailyMenu[]
    coupons: Coupon[]
    wishes: Wish[]
    orders: Order[]
    config: any
  }
}
