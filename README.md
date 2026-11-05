# 开饭咯 · 点单小程序

一个只有一口锅的私厨点单小程序：**她点单，你掌勺。**

给女朋友点早餐 / 午餐 / 晚餐用的微信小程序，也可以作为对外开放点单产品的起点。
视觉走「多巴胺潮玩 / 新丑风」：米白底、高饱和色块、4rpx 黑描边、硬投影、贴纸元素。

---

## 当前状态

- v0.1.0 · MVP 骨架
- **使用 mock 数据，无需云开发环境，导入微信开发者工具即可预览**
- 已实现：今日菜单、餐次切换、菜品详情 / 加料弹层、购物车、结算下单、订单列表、订单状态时间轴、厨房端（接单 / 状态流转 / 菜品上下架）
- 未实现：云函数与数据库、订阅消息、微信支付、许愿池、爱心券（见路线图）

## 快速开始

1. 下载并打开[微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
2. 选择「导入项目」，目录选本仓库根目录
3. AppID 可先用「测试号」，或填自己的小程序 AppID（修改 `project.config.json` 的 `appid`）
4. 点击编译即可预览（项目已配置 TypeScript 编译插件）

> 如果使用测试号 / 游客模式，部分能力受限；正式开发请注册小程序并替换 AppID。

## 目录结构

```
├── docs/                    产品与技术方案
├── miniprogram/
│   ├── app.ts/json/wxss     全局入口、路由、设计 tokens
│   ├── custom-tab-bar/      自定义底部导航
│   ├── components/
│   │   ├── dish-card/       菜品卡
│   │   ├── sku-sheet/       规格 / 加料弹层
│   │   ├── cart-bar/        悬浮购物车
│   │   └── empty-state/     空状态
│   ├── pages/
│   │   ├── home/            首页点餐
│   │   ├── checkout/        确认订单
│   │   ├── orders/          订单列表
│   │   ├── order-detail/    订单详情 + 状态时间轴
│   │   ├── profile/         我的
│   │   └── kitchen/         厨房端（管理员）
│   ├── services/            types / mock 数据 / API 封装
│   ├── store/               购物车状态
│   └── utils/               日期、文案、常量
├── scripts/check-project.js 项目自检脚本
├── project.config.json      微信开发者工具配置
└── tsconfig.json
```

## Mock 数据与云开发

当前所有数据请求都走 `miniprogram/services/api.ts`，其中：

```ts
const USE_CLOUD = false
```

- `false`：使用 `services/mock.ts` 的内存 + 本地缓存数据，方便先跑通界面与流程
- `true`：通过 `wx.cloud.callFunction` 调用云函数，需要先开通云开发并部署同名云函数
  - `getCategories` / `getDishes` / `getDish` / `toggleDishStatus`
  - `getOrders` / `getOrder` / `createOrder` / `updateOrderStatus`

订单与菜品状态会写入本地 Storage（`kfl_orders_v1`、`kfl_dish_status_v1`），清除缓存即可恢复示例数据。

## 设计系统

| Token | 色值 | 用途 |
|---|---|---|
| `--bg` | `#FFFDF6` | 米白背景 |
| `--ink` | `#111111` | 文字 / 描边 / 硬投影 |
| `--orange` | `#FF6B35` | 主按钮、加购、价格 |
| `--blue` | `#2D9CFF` | 餐次切换、信息 |
| `--yellow` | `#FFD23F` | 标签、角标、高亮 |
| `--pink` | `#FF5C8A` | 爱心、许愿 |
| `--green` | `#2FBF71` | 营业中、成功 |

- 卡片：白底 + 4rpx 黑描边 + `8rpx 8rpx 0 #111` 硬投影 + 40rpx 圆角
- 标题字体：得意黑 Smiley Sans，通过 `wx.loadFontFace` 从 jsDelivr 加载
- 生产环境需要把 `cdn.jsdelivr.net` 加入小程序后台的 **downloadFile 合法域名**；加载失败会自动回退系统字体
- 菜品图暂用「色块 + 首字」占位；接入真实图片后建议白底拍摄、统一抠图，色块背景用 CSS 实现

## 自检

```bash
node scripts/check-project.js
npx -p typescript tsc --noEmit
```

## 路线图

- [x] 设计系统与首页菜单
- [x] 规格弹层、购物车、结算
- [x] 订单状态机与厨房端
- [ ] 云函数 + 云数据库接入
- [ ] 订阅消息（下单 / 接单 / 出餐通知）
- [ ] 许愿池、爱心券、预约点单
- [ ] 每日菜单编排与定时触发器
- [ ] 订阅消息模板、隐私协议、内容安全
- [ ] 正式上架（个体户 + 食品经营许可证 + ICP 备案 + 微信支付）

## 说明

本项目当前定位于**私用 / 体验版**：个人主体小程序无法开通微信支付，也不能选择餐饮类目。
对外的完整合规路径见 [docs/点单小程序方案.md](docs/点单小程序方案.md) 第 7 节。

---

开饭咯 v0.1.0 · 用爱发电
