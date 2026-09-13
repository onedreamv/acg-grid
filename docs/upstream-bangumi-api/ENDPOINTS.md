# ENDPOINTS.md — Bangumi API 端点索引（自动生成）

> 本文件由 `node .github/scripts/generate-endpoints.js` 从 `open-api/api.yml` 与 `open-api/v0.yaml` 生成，请勿手改。上游同步后请重新生成。

## 给 coding agent 的用法

1. 先读本表选定端点，再按「定义位置」列的行号去对应 YAML 文件读取该端点的完整定义（参数、请求/响应 schema、示例），例如 `sed -n '335,404p' v0.yaml`，或 `grep -n "operationId: <id>" v0.yaml` 定位后向下读到下一个同级 operationId。
2. 「鉴权」为必需的接口需要 Access Token（生成方式见 `how-to-auth.md`），以 `Authorization: Bearer <token>` 头发送。
3. 所有非浏览器请求必须携带规范的 User-Agent，规则见 `user-agent.md`，默认 UA 可能被禁用。
4. 带（实验性）标记的接口，schema 和实际行为都可能随时改动。
5. 旧版搜索接口 `GET /search/subject/:keywords` 已废弃（未收入本包），搜索一律使用 `POST /v0/search/*`。

共 56 个接口：需鉴权 18 个，可选鉴权 14 个。


**条目**

| Method | Path | operationId | Summary | 鉴权 | 定义位置 |
|---|---|---|---|---|---|
| GET | /calendar | getCalendar | 每日放送 | 无 | api.yml:22 |
| POST | /v0/search/subjects | searchSubjects | 条目搜索（实验性） | 无 | v0.yaml:20 |
| GET | /v0/subjects | getSubjects | 浏览条目 | 可选 | v0.yaml:263 |
| GET | /v0/subjects/{subject_id} | getSubjectById | 获取条目 | 可选 | v0.yaml:337 |
| GET | /v0/subjects/{subject_id}/characters | getRelatedCharactersBySubjectId | Get Subject Characters 获取条目关联角色 | 可选 | v0.yaml:436 |
| GET | /v0/subjects/{subject_id}/image | getSubjectImageById | Get Subject Image 获取条目图片 | 可选 | v0.yaml:366 |
| GET | /v0/subjects/{subject_id}/persons | getRelatedPersonsBySubjectId | Get Subject Persons 获取条目关联人物 | 可选 | v0.yaml:405 |
| GET | /v0/subjects/{subject_id}/subjects | getRelatedSubjectsBySubjectId | Get Subject Relations 获取条目关联条目 | 可选 | v0.yaml:467 |

**章节**

| Method | Path | operationId | Summary | 鉴权 | 定义位置 |
|---|---|---|---|---|---|
| GET | /v0/episodes | getEpisodes | Get Episodes 获取条目章节列表 | 可选 | v0.yaml:498 |
| GET | /v0/episodes/{episode_id} | getEpisodeById | Get Episode 获取章节详情 | 可选 | v0.yaml:554 |

**角色**

| Method | Path | operationId | Summary | 鉴权 | 定义位置 |
|---|---|---|---|---|---|
| GET | /v0/characters/{character_id} | getCharacterById | Get Character Detail 获取角色详情 | 无 | v0.yaml:584 |
| POST | /v0/characters/{character_id}/collect | collectCharacterByCharacterIdAndUserId | Collect character for current user 为当前用户收藏角色 | 必需 | v0.yaml:708 |
| DELETE | /v0/characters/{character_id}/collect | uncollectCharacterByCharacterIdAndUserId | Uncollect character for current user 为当前用户取消收藏角色 | 必需 | v0.yaml:740 |
| GET | /v0/characters/{character_id}/image | getCharacterImageById | Get Character Image 获取角色图片 | 可选 | v0.yaml:611 |
| GET | /v0/characters/{character_id}/persons | getRelatedPersonsByCharacterId | get character related persons 获取角色关联人物 | 无 | v0.yaml:679 |
| GET | /v0/characters/{character_id}/subjects | getRelatedSubjectsByCharacterId | get character related subjects 获取角色关联条目 | 无 | v0.yaml:650 |
| POST | /v0/search/characters | searchCharacters | 角色搜索（实验性） | 无 | v0.yaml:152 |

**人物**

| Method | Path | operationId | Summary | 鉴权 | 定义位置 |
|---|---|---|---|---|---|
| GET | /v0/persons/{person_id} | getPersonById | Get Person 获取人物详情 | 无 | v0.yaml:775 |
| GET | /v0/persons/{person_id}/characters | getRelatedCharactersByPersonId | get person related characters 获取人物关联角色 | 无 | v0.yaml:870 |
| POST | /v0/persons/{person_id}/collect | collectPersonByPersonIdAndUserId | Collect person for current user 为当前用户收藏人物 | 必需 | v0.yaml:899 |
| DELETE | /v0/persons/{person_id}/collect | uncollectPersonByPersonIdAndUserId | Uncollect person for current user 为当前用户取消收藏人物 | 必需 | v0.yaml:931 |
| GET | /v0/persons/{person_id}/image | getPersonImageById | Get Person Image 获取人物图片 | 可选 | v0.yaml:802 |
| GET | /v0/persons/{person_id}/subjects | getRelatedSubjectsByPersonId | get person related subjects 获取人物关联条目 | 无 | v0.yaml:841 |
| POST | /v0/search/persons | searchPersons | 人物搜索（实验性） | 无 | v0.yaml:207 |

**用户**

| Method | Path | operationId | Summary | 鉴权 | 定义位置 |
|---|---|---|---|---|---|
| GET | /v0/me | getMyself | Get User 获取当前登录用户信息 | 必需 | v0.yaml:1031 |
| GET | /v0/users/{username} | getUserByName | Get User by name 按用户名获取用户 | 无 | v0.yaml:965 |
| GET | /v0/users/{username}/avatar | getUserAvatarByName | Get User Avatar by name 按用户名获取用户头像 | 无 | v0.yaml:993 |

**收藏**

| Method | Path | operationId | Summary | 鉴权 | 定义位置 |
|---|---|---|---|---|---|
| GET | /v0/users/-/collections/-/episodes/{episode_id} | getUserEpisodeCollection | 章节收藏信息 | 必需 | v0.yaml:1347 |
| PUT | /v0/users/-/collections/-/episodes/{episode_id} | putUserEpisodeCollection | 更新章节收藏信息 | 必需 | v0.yaml:1381 |
| POST | /v0/users/-/collections/{subject_id} | postUserCollection | 新增或修改用户单个条目收藏 | 必需 | v0.yaml:1157 |
| PATCH | /v0/users/-/collections/{subject_id} | patchUserCollection | 修改用户单个收藏 | 必需 | v0.yaml:1199 |
| GET | /v0/users/-/collections/{subject_id}/episodes | getUserSubjectEpisodeCollection | 章节收藏信息 | 必需 | v0.yaml:1236 |
| PATCH | /v0/users/-/collections/{subject_id}/episodes | patchUserSubjectEpisodeCollection | 章节收藏信息 | 必需 | v0.yaml:1296 |
| GET | /v0/users/{username}/collections | getUserCollectionsByUsername | 获取用户收藏 | 可选 | v0.yaml:1070 |
| GET | /v0/users/{username}/collections/-/characters | getUserCharacterCollections | 获取用户角色收藏列表 | 无 | v0.yaml:1423 |
| GET | /v0/users/{username}/collections/-/characters/{character_id} | getUserCharacterCollection | 获取用户单个角色收藏信息 | 无 | v0.yaml:1444 |
| GET | /v0/users/{username}/collections/-/persons | getUserPersonCollections | 获取用户人物收藏列表 | 无 | v0.yaml:1472 |
| GET | /v0/users/{username}/collections/-/persons/{person_id} | getUserPersonCollection | 获取用户单个人物收藏信息 | 无 | v0.yaml:1493 |
| GET | /v0/users/{username}/collections/{subject_id} | getUserCollection | 获取用户单个条目收藏 | 可选 | v0.yaml:1121 |

**编辑历史**

| Method | Path | operationId | Summary | 鉴权 | 定义位置 |
|---|---|---|---|---|---|
| GET | /v0/revisions/characters | getCharacterRevisions | Get Character Revisions 获取角色编辑历史列表 | 无 | v0.yaml:1585 |
| GET | /v0/revisions/characters/{revision_id} | getCharacterRevisionByRevisionId | Get Character Revision 获取角色单个编辑历史 | 无 | v0.yaml:1615 |
| GET | /v0/revisions/episodes | getEpisodeRevisions | Get Episode Revisions 获取章节编辑历史列表 | 无 | v0.yaml:1699 |
| GET | /v0/revisions/episodes/{revision_id} | getEpisodeRevisionByRevisionId | Get Episode Revision 获取章节单个编辑历史 | 无 | v0.yaml:1729 |
| GET | /v0/revisions/persons | getPersonRevisions | Get Person Revisions 获取人物编辑历史列表 | 无 | v0.yaml:1521 |
| GET | /v0/revisions/persons/{revision_id} | getPersonRevisionByRevisionId | Get Person Revision 获取人物单个编辑历史 | 无 | v0.yaml:1551 |
| GET | /v0/revisions/subjects | getSubjectRevisions | Get Subject Revisions 获取条目编辑历史列表 | 无 | v0.yaml:1642 |
| GET | /v0/revisions/subjects/{revision_id} | getSubjectRevisionByRevisionId | Get Subject Revision 获取条目单个编辑历史 | 无 | v0.yaml:1672 |

**目录**

| Method | Path | operationId | Summary | 鉴权 | 定义位置 |
|---|---|---|---|---|---|
| POST | /v0/indices | newIndex | Create a new index 创建目录 | 必需 | v0.yaml:1756 |
| GET | /v0/indices/{index_id} | getIndexById | Get Index By ID 按 ID 获取目录 | 可选 | v0.yaml:1778 |
| PUT | /v0/indices/{index_id} | editIndexById | Edit index's information 编辑目录信息 | 必需 | v0.yaml:1796 |
| POST | /v0/indices/{index_id}/collect | collectIndexByIndexIdAndUserId | Collect index for current user 为当前用户收藏目录 | 必需 | v0.yaml:1919 |
| DELETE | /v0/indices/{index_id}/collect | uncollectIndexByIndexIdAndUserId | Uncollect index for current user 为当前用户取消收藏目录 | 必需 | v0.yaml:1939 |
| GET | /v0/indices/{index_id}/subjects | getIndexSubjectsByIndexId | Get Index Subjects 获取目录内条目列表 | 可选 | v0.yaml:1825 |
| POST | /v0/indices/{index_id}/subjects | addSubjectToIndexByIndexId | Add a subject to Index 添加条目到目录 | 必需 | v0.yaml:1849 |
| PUT | /v0/indices/{index_id}/subjects/{subject_id} | editIndexSubjectsByIndexIdAndSubjectID | Edit subject information in a index 修改目录内条目信息 | 必需 | v0.yaml:1874 |
| DELETE | /v0/indices/{index_id}/subjects/{subject_id} | delelteSubjectFromIndexByIndexIdAndSubjectID | Delete a subject from a Index 从目录中移除条目 | 必需 | v0.yaml:1900 |
