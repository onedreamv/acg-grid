# Bangumi API Guide for Agents

自包含的 Bangumi（bgm.tv）API 文档包，供 coding agent 学习和调用 API 使用。
由 bangumi/api 仓库（commit `da2b2e9`）于 2026-08-30 通过 `node .github/scripts/build-agent-guide.js` 组装生成，请勿手改。

## 文件结构与用途

| 文件 | 层 | 用途 |
|---|---|---|
| `ENDPOINTS.md` | 索引层 | 全部 56 个端点的一览表（方法/路径/operationId/摘要/鉴权/定义行号），**从这里开始** |
| `v0.yaml` | 事实层 | v0 现行接口的完整 OpenAPI 规范：参数、请求/响应 schema、示例 |
| `api.yml` | 事实层 | 旧版接口（仅 `/calendar` 每日放送） |
| `user-agent.md` | 行为层 | User-Agent 约定，**硬性要求** |
| `how-to-auth.md` | 行为层 | Access Token 申请与使用 |

## agent 工作流

1. 读 `ENDPOINTS.md` 选定端点；
2. 按「定义位置」列行号精读对应 YAML 段落（如 `sed -n '335,404p' v0.yaml`），获取参数与响应 schema；
3. 按规范构造请求：基址 `https://api.bgm.tv`。

## 硬性规则（违反会被服务端拒绝）

- **User-Agent**：必须携带「开发者ID/应用名」格式的 UA（如 `yourname/my-app`），请求库默认 UA 可能被禁用，详见 `user-agent.md`。
- **鉴权**：ENDPOINTS.md 中「鉴权=必需」的接口需在 `Authorization: Bearer <token>` 头中携带 token（`https://next.bgm.tv/demo/access-token` 生成），流程见 `how-to-auth.md`。
- **实验性接口**：标注（实验性）的搜索接口 schema 与行为可能随时变化。

## 注意

- 文档基址为 `https://api.bgm.tv`；`/v0` 前缀接口是现行标准，旧版无前缀接口仅 `/calendar` 有文档且勿在新项目中依赖。
- 本包不含已废弃的旧搜索接口文档；搜索一律使用 `POST /v0/search/*`。
- 接口总数、行号与 YAML 严格对应；若上游更新，请在 bangumi/api 仓库重新执行组装脚本。
