// 极简全局声明：不安装 npm typings 也能通过编译。
// 想要完整类型提示，可安装 miniprogram-api-typings 并删除本文件。

declare const wx: any
declare const console: any
declare const setTimeout: any
declare const clearTimeout: any
declare const setInterval: any
declare const clearInterval: any

declare function App(options: any): void
declare function Page(options: any): void
declare function Component(options: any): void
declare function getApp(): any
declare function getCurrentPages(): any[]
