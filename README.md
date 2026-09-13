# ACG Grid

一张汇总 ACG 生涯喜好的卡片墙：在一张画布上收集作品（动漫、书籍、音乐、游戏、三次元）与角色卡片，最终可导出为一张包含优美卡片墙的高清 PNG。

计划文档见 `doc.local/ACG GRID PLAN.md`（部署与跨域方案见 `doc.local/跨域-CORS-修复计划.md`）。

## 技术栈

- Node.js 24 LTS / pnpm
- React 19 + TypeScript + Vite
- Dexie（IndexedDB 封装）
- Cloudflare Workers（静态资产托管 + 同 Worker 反代 `/api/*`、`/img/*`）

## 快速开始

```bash
pnpm install
pnpm dev        # 开发：/api、/img 由 Vite 代理直连 bangumi（剥前缀 + 注入规范 UA）
pnpm build      # 类型检查 + 产线构建到 dist/
pnpm preview    # 本地预览构建产物
```

## 部署（Cloudflare 全家桶）

```bash
pnpm build
npx wrangler deploy   # 单命令：上传 dist 静态资产 + 部署反代脚本 + 自动创建 grid.1dream.online DNS 与证书
```

- `wrangler.jsonc`：`main: worker/index.ts`，`assets.directory: ./dist`，自定义域名路由。
- `worker/index.ts`：白名单反代——`/api/* → api.bgm.tv`、`/img/* → lain.bgm.tv`（剥前缀、注入 UA、图片长缓存、其余 403）。
- 前端所有 API 与图片请求一律相对路径（`/api/...`、`/img/...`），生产同源无 CORS；canvas 导出无画布污染。

## 代码结构

```
src/
  constants.ts        # 类型预设、徽章配色、态度预设池、上限常量
  types.ts            # Card / CanvasSettings / StoredImage 等数据模型
  lib/
    layout.ts         # Flickr 式 justified 布局（±15% 行高容差、末行不放大）
    metrics.ts        # 元数据层与徽章设计参数（屏幕与 canvas 导出同一份规格）
    bangumi.ts        # 条目/角色搜索客户端（NSFW 过滤、类型映射、中文名三级回退、URL 归一化）
    storage.ts        # Dexie 持久化（卡片/设置/标题/图片 Blob），不可用时回退内存模式
    imageStore.ts     # 图片库：原图 + 缩略图（最长边 1000px）入库，缩略图 objectURL 缓存
    exportCanvas.ts   # 自定义 canvas 导出渲染器（亚克力模糊 ctx.filter、2x→1x→0.5x 降级、失败探针）
    filename.ts       # 导出文件名清洗（非法字符全角化、Windows 保留名回退）
  components/
    CardTile.tsx      # 卡片：封面/占位 + 通栏/胶囊自适应亚克力元数据层
    TypeBadge.tsx     # 内联 SVG 类型徽章（与导出渲染共用 badgeSpec）
    SearchDialog.tsx  # 会话窗口：bangumi/本地分段、类型分段、5 列候选触底分页、销毁卡片
    EditDialog.tsx    # 元数据编辑：先类型后态度、预设下拉按类型过滤
    ControlPanel.tsx  # 顶栏：行高/间距设置、add、clear、download、reset
    TitleBar.tsx      # 标题 + 白猫爪（点击编辑标题）
    ConfirmModal.tsx  # reset 二次确认（好喵/算了喵）
    Toast.tsx         # 轻量 toast（自动消失）
  App.tsx             # 装配：首次访问初始化（10 张占位卡、唯一 16:9）、32 张上限、导出流程
worker/index.ts       # Cloudflare Worker 反代
```

## 核心约定

- 卡片上限 **32 张**，所有产生卡片的路径均受此约束。
- 绝不裁剪图片：卡片宽高比始终等于封面原始宽高比（占位卡用随机 2:3 / 3:4 / 4:3，初始模板有且仅有 1 张 16:9）。
- 屏幕渲染一律用缩略图；原图 Blob 仅在导出时逐卡解码、绘制后立即释放。
- 元数据层形态按卡片宽高比自适应：ratio < 1.5 通栏贴底；ratio ≥ 1.5 居中胶囊；亚克力只模糊封面底部一小条（渐隐带 ≤ 16px）。
- 持久化永不主动清空；清除入口仅 reset（二次确认）。启动时申请 `navigator.storage.persist()`，设置面板展示占用/配额。
- Safari 无 `ctx.filter` 时导出走无模糊高不透明回退分支（rgba(255,255,255,0.78)），屏幕端不受影响。
