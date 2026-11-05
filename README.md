# 开饭咯 · 点单小程序

> 线上小程序名称：**张饱饭堂**（项目代号：开饭咯）

一个只有一口锅的私厨点单小程序：**她点单，你掌勺。**

给女朋友点早餐 / 午餐 / 晚餐用的微信小程序，也可以作为对外开放点单产品的起点。
视觉走「多巴胺潮玩 / 新丑风」：米白底、高饱和色块、4rpx 黑描边、硬投影、贴纸元素。

![首页预览](docs/home-preview.png)

---

## 当前状态

- v0.1.0 · MVP
- **默认接入微信云开发**；把 `miniprogram/config.ts` 里的 `USE_CLOUD` 改成 `false` 即可切回本地 mock 数据
- 已实现：今日菜单、餐次切换、菜品详情 / 加料弹层、购物车、结算下单、订单列表、订单状态时间轴、厨房端（接单 / 状态流转 / 菜品 CRUD / 库存 / 营业设置 / 每日菜单编排）、管理员权限、云数据库初始化、订阅消息、未来 7 天预订、订单取消、许愿池、爱心券、口味与地址档案、今日看板、分享、隐私说明页
- 未实现：微信支付、每日菜单编排、小票打印（见路线图）

> **云函数部署提示**：如果「上传并部署」报
> `getCloudAPISignedHeader failed: {"base_resp":{"ret":1000,"errmsg":"system error."}}`，
> 这是微信侧签名服务异常，与代码和配额无关。可以稍后重试，或在云开发控制台重新上传
> `cloudfunctions/api`（云端安装依赖）。部署后用 `node scripts/cloud-call.js getBusiness` 验证。

## 快速开始

1. 下载并打开[微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
2. 选择「导入项目」，目录选本仓库根目录
3. 填入自己的小程序 AppID（修改 `project.config.json` 的 `appid`）。
   注意：云开发需要真实 AppID，测试号 / 游客模式不支持
4. 按「云开发接入」完成环境配置和云函数部署
5. 点击编译，进入「我的 → 云环境初始化」

只想先看界面、不接云开发：把 `miniprogram/config.ts` 的 `USE_CLOUD` 改为 `false`，直接编译即可。

## 云开发接入（默认开启）

所有业务都通过单个云函数 `cloudfunctions/api` 按 action 路由，客户端不直接读写数据库。

### 首次部署

1. **开通云开发**：在微信开发者工具顶部点击「云开发」，创建环境（新用户有免费期）
2. **填环境 ID**：把环境 ID 填到 `miniprogram/config.ts` 的 `CLOUD_ENV`；如果账号下只有一个环境，也可以留空
3. **部署云函数**：在开发者工具里右键 `cloudfunctions/api` → **上传并部署：云端安装依赖**
4. **初始化数据库**：编译小程序 → 「我的」→「云环境初始化」。
   第一次点击的账号会自动成为管理员，并写入 5 个分类、14 道默认菜品
5. **设置集合权限**：到云开发控制台 → 数据库，把 `categories`、`dishes`、`orders`、`config` 四个集合的权限设为「所有用户不可读写」。
   所有读写都走云函数，客户端无需直接访问

> 如果初始化提示集合不存在，在云开发控制台手动创建 `categories`、`dishes`、`orders`、`config` 四个集合，再点一次初始化即可。

### 自动化辅助（可选）

如果习惯用命令行，可以在开发者工具开启自动化端口后，直接用脚本完成数据库初始化：

```bash
cli auto --project "D:\Code\cook" --auto-port 9420
node scripts/init-cloud-db.js ws://127.0.0.1:9420
```

端口以 `cli auto` 的实际输出为准（被占用时会顺延，例如 9421）。

### 管理员

- 第一个执行初始化的账号自动成为管理员
- 「我的 → 我的 openid」可以一键复制当前账号的 openid
- 添加更多管理员：云开发控制台 → 数据库 → `config` 集合 → `app` 文档 → 在 `adminOpenids` 数组里追加 openid
- 非管理员看不到入口，云函数也会二次校验；厨房端和订单状态操作都会拒绝越权请求

### 数据集合

| 集合 | 内容 |
|---|---|
| `categories` | 分类（主食 / 小炒 / 汤羹 / 饮品 / 甜品） |
| `dishes` | 菜品、价格、规格、加料、售罄状态 |
| `orders` | 订单（含 `_openid`、状态、时间轴） |
| `config` | 初始化标记、管理员 openid、订单序号 |

订单金额和菜品单价由云函数按数据库中的菜价重新计算，不信任客户端传值；售罄菜品会被拒绝。

### 云函数动作

`getCategories` / `getDishes` / `getDish` / `getOrders` / `getAllOrders` / `getOrder` /
`createOrder` / `updateOrderStatus` / `toggleDishStatus` / `getMe` / `initDb`

### 订阅消息

当前已在「张饱饭堂」小程序中开通订阅消息，并配置好两个一次性订阅模板（类目：工具 > 预约/报名）：

| 用途 | 模板 | 字段 |
|---|---|---|
| 新订单提醒（发给管理员） | 顾客下单提醒 | `thing11` / `number2` / `amount3` / `thing4` / `time36` |
| 出锅提醒（发给顾客） | 订单状态提醒 | `thing1` / `phrase2` / `character_string6` / `time16` / `thing5` |

模板 ID 已填入 `miniprogram/config.ts` 和 `cloudfunctions/api/templates.js`。
模板 ID 留空或模板被删除时，通知会自动跳过，不影响下单。

交互位置：

- **新订单提醒**（发给管理员）：在厨房端点「订阅新订单提醒」
- **出锅提醒**（发给顾客）：下单时授权，或在订单详情点「出锅时提醒我」

重新配置或更换模板的步骤：

1. 微信公众平台 → 功能 → 订阅消息 → 我的模板 → 选用模板。
   建议选「新订单提醒」「订单状态通知」类模板；可用模板取决于小程序类目
2. 复制两个模板 ID，分别填到：
   - `miniprogram/config.ts` 的 `TEMPLATE_NEW_ORDER` / `TEMPLATE_ORDER_STATUS`
   - `cloudfunctions/api/templates.js` 的 `NEW_ORDER_TEMPLATE_ID` / `ORDER_STATUS_TEMPLATE_ID`
3. 按实际模板的字段名修改 `templates.js` 里 `data` 的键（如 `thing1`、`time2`、`amount3`）。
   字段必须与模板一一对应，否则发送会失败
4. 设置 `templates.js` 里的 `MINIPROGRAM_STATE`：体验版 `trial`、开发版 `developer`、正式版 `formal`
5. 重新「上传并部署」api 云函数（`config.json` 已声明 `subscribeMessage.send` 权限）

> 私用小程序只能使用**一次性订阅**：一次授权只能发一条消息。
> 所以顾客每次下单都会重新请求授权；管理员点一次提醒按钮，能收到下一单的通知。
>
> `templates.js` 里的 `MINIPROGRAM_STATE` 默认是 `trial`（体验版）。用开发版调试时改成 `developer`，正式发布后改成 `formal`。

## 目录结构

```
├── docs/                    产品与技术方案
├── cloudfunctions/
│   └── api/                 统一业务云函数
│       ├── index.js         路由 + 业务逻辑
│       ├── seed.js          默认分类与菜品
│       ├── templates.js     订阅消息模板与字段映射
│       ├── config.json      openapi 权限声明
│       └── package.json
├── miniprogram/
│   ├── app.ts/json/wxss     全局入口、路由、设计 tokens
│   ├── config.ts            云环境 ID / mock 开关
│   ├── custom-tab-bar/      自定义底部导航
│   ├── components/          菜品卡、规格弹层、购物车、空状态
│   ├── pages/               点餐、结算、订单、我的、厨房端
│   ├── services/            types / mock 数据 / API 封装
│   ├── store/               购物车状态
│   └── utils/               日期、文案、常量
├── scripts/check-project.js 项目自检脚本
├── project.config.json      微信开发者工具配置
└── tsconfig.json
```

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
node scripts/smoke-cloud.js
npx -p typescript tsc --noEmit
```

## 路线图

- [x] 设计系统与首页菜单
- [x] 规格弹层、购物车、结算
- [x] 订单状态机与厨房端
- [x] 云函数 + 云数据库接入
- [x] 管理员权限与数据库初始化
- [x] 订阅消息（下单 / 接单 / 出餐通知，模板 ID 需配置）
- [x] 菜品 CRUD、库存、营业设置、未来 7 天预订
- [x] 每日菜单编排
- [x] 许愿池、爱心券、口味与地址、今日看板、分享
- [x] 隐私说明页
- [ ] 每周菜单 / 定时触发器
- [ ] 内容安全与正式上架（个体户 + 食品经营许可证 + ICP 备案 + 微信支付）

## 说明

本项目当前定位于**私用 / 体验版**：个人主体小程序无法开通微信支付，也不能选择餐饮类目。
对外的完整合规路径见 [docs/点单小程序方案.md](docs/点单小程序方案.md) 第 7 节。

---

开饭咯 v0.1.0 · 用爱发电
