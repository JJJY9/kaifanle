// 云开发环境 ID：在微信开发者工具「云开发」控制台复制。
// 如果账号下只有一个环境，可以留空，SDK 会使用默认环境。
export const CLOUD_ENV = 'cloud1-4g3807gje81e048a'

// true = 调用云函数（需要先部署 cloudfunctions/api）；
// false = 使用本地 mock 数据，方便没有云环境时预览界面。
export const USE_CLOUD = true

// 订阅消息模板 ID：与 cloudfunctions/api/templates.js 中保持一致。
// 留空时不会拉起订阅授权，也不会有推送，下单流程不受影响。
export const TEMPLATE_ORDER_STATUS = ''
export const TEMPLATE_NEW_ORDER = ''
