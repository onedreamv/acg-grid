# AGENTS.md

ACG Grid：汇总 ACG 生涯喜好的卡片墙，使用来自bangumi API或用户上传的图片，可导出高清 PNG。部署在 Cloudflare。

## 技术栈

- 前端：React 19 + TypeScript + Vite + Dexie/IndexedDB
- 后端 severless：Cloudflare Workers（静态资产托管 + 同 Worker 反代）

## 命令

- 包管理器用 pnpm（存在 pnpm-workspace.yaml）。
- `pnpm dev` 开发；`pnpm build`（= `tsc -b && vite build`）；`pnpm typecheck` 仅类型检查。
- 没有测试框架、没有 linter——改完用 `pnpm typecheck` 验证。
- 部署：`pnpm build && npx wrangler deploy`（上传 dist + Worker + 自动创建 grid.1dream.online DNS）。

## 架构边界

- 前端访问 bangumi 一律用相对路径 `/api/*`、`/img/*`，绝不从浏览器代码直连 api.bgm.tv / lain.bgm.tv。开发期由 `vite.config.ts` 代理（剥前缀 + 注入 UA），生产由 `worker/index.ts` 白名单反代（`/api/* → api.bgm.tv`、`/img/* → lain.bgm.tv`，其余一律 403）。canvas 导出无污染依赖这条同源约定。
- bangumi 规范 UA（`dream/acg-grid/0.1.0 (https://grid.1dream.online)`）在 `vite.config.ts` 和 `worker/index.ts` 各有一份，改版本号时两处同步。
- `src/lib/metrics.ts` 是元数据层/徽章设计参数的唯一来源：屏幕端（CSS / 内联 SVG）与 canvas 导出（原生重绘）共用同一份规格。改视觉规格只改这里，避免屏幕与导出不一致。
- 目录分层：`src/lib/` 纯逻辑（布局、bangumi 客户端、存储、图片库、导出渲染器、文件名清洗），`src/components/` React 组件，`src/constants.ts` 类型预设与上限常量，`worker/` Cloudflare Worker。
- tsconfig 是 project references（app + node），strict 模式、noEmit、bundler 解析。

## 约束

- 卡片上限 **32 张**，所有产生卡片的路径（搜索添加、导入、初始化）均受此约束。
- 绝不裁剪图片：卡片宽高比始终等于封面原始宽高比。首次访问初始化 10 张占位卡（随机 2:3 / 3:4 / 4:3），其中有且仅有 1 张 16:9。
- 屏幕渲染一律用缩略图；原图 Blob 仅在导出时逐卡解码、绘制后立即释放，不得常驻内存。
- 元数据层按卡片宽高比自适应：ratio < 1.5 通栏贴底，ratio ≥ 1.5 居中胶囊；亚克力只模糊封面底部一小条（渐隐带 ≤ 16px）。
- 持久化永不主动清空，唯一清除入口是 reset（二次确认）；启动时申请 `navigator.storage.persist()`。Dexie 不可用时回退内存模式。
- 数据 schema 兼容策略：开发阶段不做字段迁移、不为旧字段积累兼容代码——卡片加载经 `App.tsx` 的 `isCurrentSchemaCard` 校验（schema 变更时原地更新该函数），失败即封锁落库并弹窗引导 reset；settings 走默认值合并自愈。
- Safari 无 `ctx.filter`：`src/lib/exportCanvas.ts` 里有「无模糊 + 高不透明」回退分支，不要当死代码删。
- `worker/index.ts` 响应头显式构造最小头集，不整体复制回源头——Workers fetch 已自动解压 body，回源头的 Content-Encoding / Content-Length 与实际内容不再匹配。
- `pnpm-workspace.yaml` 的 allowBuilds 放行了 esbuild / workerd 构建脚本；新增依赖若带构建脚本需要在此加白。

## 参考文档

- `docs/upstream-bangumi-api/`：vendored 的 bangumi API 文档（改 `src/lib/bangumi.ts` 前先读，含 User-Agent 规范与端点）。
