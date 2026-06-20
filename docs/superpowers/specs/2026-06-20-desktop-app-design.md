# 桌面应用集成方案设计

> 日期：2026-06-20
> 状态：已通过 brainstorming 讨论确认，待写实施计划

## 背景与目标

`repo-translator` 目前是纯 Python CLI（click 命令组：`add`/`translate`/`watch`/`list`/`remove`/`config`），核心逻辑见 `repo_translator/{config,git_manager,cache_manager,parser,translator,sync,scheduler}.py`，所有技术选型已在 `SCRATCH.md` 中逐条决议并落地。

目标：给非技术用户提供一个原生桌面应用 GUI，覆盖与 CLI 等价的核心操作（添加/同步/移除仓库、编辑术语表与排除规则、查看用量统计、实时调试日志），UI 对齐已导入的设计稿（`ui_kits/desktop-app/*`，5 个功能页 + 调试台抽屉）。

非目标：不重写现有 Python 业务逻辑；不取代现有 CLI（两者长期并存，共享同一个核心库）。

## 决策记录（讨论过程中确认的关键选择）

1. **架构范围**：Rust 只做壳（窗口/进程/打包），现有 Python 业务逻辑 100% 复用，不做 Rust 重写。
   - 理由：重写会让 `SCRATCH.md` 里 10 项决议（markdown-it-py 切片、subprocess git、APScheduler、整文件标记翻译、glossary 注入）全部需要在 Rust 生态重新论证，工作量与"给现有工具加 GUI"这一目标完全不对等；现有 `tests/` 套件也会失效。
2. **性能**：不是顾虑点。repo-translator 的耗时主要在 `git`/LLM API 的网络 I/O 上，Python 解释器开销可忽略，换 Rust 不会让单次翻译变快。
3. **包体积**：预期 50-100MB（Tauri 壳 3-10MB + PyInstaller 打包的 Python sidecar 30-80MB），介于纯 Rust（10-20MB）与 Electron+Python（150-250MB）之间，用户判断可接受。
4. **Sidecar 通信方式**：常驻进程 + 本地 HTTP/WebSocket API，而非每次操作 spawn 一次性 CLI 进程。
   - 理由：设计稿的"实时调试台"需要持续推日志，`watch` 模式需要常驻调度循环；一次性 subprocess 方案下每次操作都要重启 APScheduler，无法常驻后台。
5. **前端构建**：Vite + React 预构建产物嵌入 Tauri，**不**沿用设计稿原始的 CDN React + Babel 浏览器实时编译方案（离线启动要求 + 启动速度）。
6. **Tauri 版本**：Tauri 2（v1 已进入维护模式，v2 的 sidecar/`externalBin` 与 capabilities 权限模型更适合本场景）。

## 架构总览

```
现有：CLI 用户 → repo-translator (click)         → repo_translator/{config,git_manager,cache_manager,parser,translator,sync,scheduler}.py
新增：GUI 用户 → Tauri 2 壳(Rust) → api_server.py →  同一套 repo_translator/{...}.py（不重写）
```

`api_server.py` 是新增模块，不改动任何现有模块的对外接口——只是把已有函数包成本地 HTTP/WebSocket 接口供桌面前端调用。

## 仓库布局

```
repo-translator/                  # 现有 Python 包不变
  repo_translator/
    api_server.py                 # 新增：FastAPI app，desktop 专用入口
  desktop/                        # 新增目录：Tauri 2 项目，独立可构建子项目
    src-tauri/                    # Rust 壳：进程生命周期管理、sidecar 注册、打包配置
    src/                          # Vite + React 前端（移植 ui_kits/desktop-app/*.jsx）
    package.json / vite.config.ts
```

`desktop/` 有自己的 `package.json`，不影响 `uv run pytest` 等现有 Python 工作流。

## `api_server.py` 接口设计

包一层现有函数，不重写业务逻辑：

- `GET  /repos` — 包装 `config.load_config()`，返回 `repos` 列表 + 各自最近一次 `sync_repo` 结果状态
- `POST /repos` — 包装现有 `cli.add` 里的判断逻辑（复用 `_infer_repo_name`、`_is_url` 区分 managed/external），写回 `config.save_config`
- `DELETE /repos/{name}` — 包装 `cli.remove`
- `POST /repos/{name}/sync` — 调用 `sync.sync_repo(repo_config, app_config, cache)`，对应设计稿"立即同步"按钮；返回后 `cache_manager.save`
- `GET/PUT /config` — 包装现有 `cli._config_show`/`_nested_get`/`_nested_set`（术语表、`output.exclude`、引擎设置走这里）
- `WS /logs` — 推送结构化日志。最小改动：给 `sync.py`/`scheduler.py` 用的 `logger`（`logging.getLogger(__name__)`）加一个自定义 `logging.Handler`，把日志记录序列化为 NDJSON 推给所有已连接的 WebSocket 客户端；CLI 端的日志输出格式不受影响
- App 启动时常驻运行调度循环：给 `scheduler.py` 新增一个非阻塞的 `start_background()` 变体（用 asyncio task 跑 APScheduler，区别于 CLI 用的 `BlockingScheduler`），`run_watch` 本身不改动

## 前端

把 `ui_kits/desktop-app/` 下 9 个 `.jsx` 文件移到 `desktop/src/`：

- 加 `import React from 'react'` 等头部，把 `window.XXX` 全局挂载改成模块 `export`/`import`
- 设计系统组件库（`_ds_bundle.js`）拆开为可 import 的模块，或保留单文件整体 import
- Google Fonts 改为本地打包，不依赖 CDN（离线启动要求）
- 新增 `src/api.ts`：封装对 `api_server.py` 的 fetch/WebSocket 调用，替换各页面目前的 mock 数据（如 `ConsoleScreen.jsx` 里的 `RT_LOGS`、`UsageScreen.jsx` 里的 `daily` 数组）

## 打包

- `repo_translator`（含 `api_server.py` 入口）→ PyInstaller 打成单文件可执行程序
- `desktop/src-tauri/tauri.conf.json` 把该可执行程序注册为 `externalBin`（sidecar），随安装包分发
- Tauri 进程启动时 spawn 该 sidecar，应用退出时一并终止
- 预期体积 50-100MB

## 测试

- Python 侧：新增 `tests/test_api_server.py`，用 FastAPI `TestClient` 跑通 `/repos`、`/config` 等路由，复用现有 `_setup_temp_paths` 模式（patch `repo_translator.config.DEFAULT_CONFIG_PATH`/`repo_translator.cache_manager.DEFAULT_CACHE_PATH`）
- 前端侧：不引入额外测试框架，沿用 Tauri dev 模式手动走查点击流程（与现有项目测试基建现状一致，不过度设计）

## 风险与待办

- `scheduler.py` 的 `start_background()` 变体与 CLI 的 `BlockingScheduler` 共享 `_make_job` 等内部函数，实施时需确认两种调度模式不会在同一进程内冲突（GUI 进程不会同时跑两套调度器）
- PyInstaller 打包 `openai`/`anthropic` 这类大型 SDK 可能命中隐藏 import 问题，需要在实施阶段验证打包产物能正常启动
- 设计稿里"全量同步/停止全部"按钮的语义（一次性触发 vs 切换后台 watch 开关）尚未细化，实施计划阶段需要明确：当前假设是"watch 调度循环随 sidecar 启动后一直运行，两个按钮只是手动触发/取消一次性 sync，不影响后台调度开关"
