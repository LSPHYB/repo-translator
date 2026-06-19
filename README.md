# repo-translator

`repo-translator` 是一个面向开发者的命令行工具，用于将 GitHub（或本地）仓库中的 Markdown 文档自动翻译为中文。它面向希望降低英文技术文档阅读门槛的中文开发者，支持：

- 多翻译引擎（OpenAI、DeepSeek、Claude），可在 `config.yaml` 中自由切换
- 增量翻译：只重新翻译有变动的文件（基于 git blob hash 判断），节省 API 成本
- 双语并存输出：原文件保持不变，翻译结果以 `_zh` 后缀文件形式与原文一起写入独立的 `output/` 目录
- 自定义术语表（glossary），保证专有名词翻译/保留的一致性
- 自动同步：通过 `watch` 子命令定时轮询所有跟踪仓库，检测到更新后自动重新翻译

工具**不**翻译代码文件（只处理 `.md`），**不**向远程仓库推送任何内容，也不提供 Web UI。

---

## 安装

本项目使用 [`uv`](https://github.com/astral-sh/uv) 管理依赖与打包（见 `pyproject.toml`）。在项目根目录下执行：

```bash
uv pip install -e .
```

或者使用 `pip` 直接安装：

```bash
pip install -e .
```

安装完成后会得到 `repo-translator` 命令（入口点定义在 `pyproject.toml` 的 `[project.scripts]`：`repo-translator = repo_translator.cli:main`）：

```bash
repo-translator --help
```

工具运行时的所有状态（配置、缓存、克隆下来的仓库、翻译输出）默认存放在 `~/.repo-translator/` 下。

---

## 配置：`config.yaml`

配置文件默认路径为 `~/.repo-translator/config.yaml`，首次运行任意命令前可以手动创建（也可以先运行 `repo-translator config --set ...` 让工具自动创建一份默认配置再编辑）。完整字段定义见 `repo_translator/config.py`，模板见仓库根目录的 `config.example.yaml`。一个完整示例：

```yaml
# ~/.repo-translator/config.yaml

translator:
  engine: deepseek          # openai | deepseek | claude
  api_key: sk-xxx
  model: deepseek-chat      # 对应引擎下使用的具体模型；留空使用各引擎的默认模型
  base_url: ~               # 自定义 API endpoint（可选，如自建代理/私有部署）
  max_tokens: 4096
  temperature: 0.3          # 翻译场景建议低温度

sync:
  interval_hours: 6         # watch 模式下的默认轮询间隔（小时）
  concurrency: 3            # 单次同步中并发翻译的文件数

output:
  base_dir: ~/.repo-translator/output
  suffix: _zh                # 翻译文件后缀，例如 README_zh.md
  exclude:                   # glob 模式列表；命中的文件不翻译、不出现在 output 中
    - CHANGELOG.md
    - LICENSE.md
    - "**/node_modules/**"

# 术语表：保证专有名词翻译一致，或保留英文原文不译。
# translation 留空（~ / null）表示该术语保持原文不翻译。
glossary:
  - term: Agent
    translation: 智能体
  - term: LangChain
    translation: ~

repos:
  # managed：工具会 clone 到 ~/.repo-translator/repos/<name>/，并在每次同步前 pull。
  - name: langchain
    url: https://github.com/langchain-ai/langchain
    branch: main
    added_at: 2026-06-12T10:00:00Z

  # external：指向本机已有的本地克隆，工具不 clone、不 pull，只读取当前 HEAD。
  - name: my-project
    path: ~/code/my-project
```

`repos` 列表一般不需要手动编辑——通过 `add` 命令添加仓库时会自动写入。

---

## 使用说明

### `add` — 添加并跟踪一个仓库

```bash
repo-translator add <url-or-path> [--name NAME]
```

`add` 同时支持两种来源，工具会根据参数形态自动判断：

- **managed（托管）**：传入一个 URL（`http(s)://...` 或 `git@...`）。工具会 `git clone` 到 `<output.base_dir>/repos/<name>/`（默认即 `~/.repo-translator/output/repos/<name>/`），并标记为 managed；之后每次 `translate`/`watch` 都会先对这份专属副本执行 `git pull`。

  ```bash
  repo-translator add https://github.com/langchain-ai/langchain
  repo-translator add git@github.com:user/repo.git --name myrepo
  ```

- **external（外部）**：传入一个本地路径，该路径必须是一个已存在的 git 仓库（含 `.git` 目录）。工具**不会** clone 或 pull 它，只在每次同步时读取其当前 HEAD 的内容；不会修改这个本地仓库的任何文件（适合"已经在自己的开发目录里克隆过，不想再占一份磁盘空间"的场景，或者你自己维护的、希望随手 commit 文档改动后自动跟着重新翻译的仓库）。

  ```bash
  repo-translator add ~/code/my-project
  repo-translator add /home/user/repos/foo --name custom-name
  ```

`--name` 可显式指定仓库名（用于跟踪标识与 output 子目录名）；省略时从 URL 末段或本地目录名自动推断。

`add` 成功写入配置后会立即触发一次初始全量同步（首次翻译该仓库下所有 `.md` 文件），并打印翻译进度。

### `translate` — 手动触发一次翻译

```bash
repo-translator translate <name>
```

对指定仓库执行一次"获取最新内容 → 对比缓存 → 翻译有变动的文件 → 写入 output"的完整流程。判断"是否变动"依据的是 git blob hash（记录在 `~/.repo-translator/cache.json` 中），而非文件修改时间，因此 `git pull` 后文件 mtime 被重置也不会误判。若没有文件变动，会提示 `No changed files.` 并跳过翻译，不产生任何 API 调用。

### `watch` — 启动定时轮询守护进程

```bash
repo-translator watch [--interval 6h]
```

为每个已跟踪仓库各自注册一个独立的定时任务（基于 APScheduler），按配置的间隔（或 `--interval` 覆盖值，支持 `6` 或 `6h` 两种写法）重复执行与 `translate` 相同的同步流程。单个仓库同步失败不会影响其他仓库的调度。

**注意：`watch` 是一个前台阻塞进程**，本身不会自我守护进程化（不 fork、不脱离终端、不写 PID 文件）。如果需要它长期在后台运行，可以使用 `nohup`/`tmux`/`screen`，或者安装项目提供的系统服务模板长期驻留：

- systemd：`contrib/systemd/repo-translator.service`（`ExecStart=repo-translator watch`，`Restart=on-failure`）
- launchd（macOS）：`contrib/launchd/com.repo-translator.plist`（`ProgramArguments` 指向 `repo-translator watch`，`KeepAlive`）

将对应模板复制到系统服务目录（如 `/etc/systemd/system/` 或 `~/Library/LaunchAgents/`）并按需调整路径/环境变量后启用即可。

### `list` — 查看已跟踪仓库

```bash
repo-translator list
```

列出所有已跟踪仓库的名称、来源类型（`managed`/`external`）、分支（仅 managed 仓库展示）、最近一次同步时间，以及已翻译文件数。

### `remove` — 取消跟踪一个仓库

```bash
repo-translator remove <name>
```

将该仓库从配置中移除。对于 managed 仓库，会提示 `~/.repo-translator/repos/<name>/` 下的本地克隆可以手动删除（不会自动删除）；对于 external 仓库，不会触碰用户自己的任何文件。已生成的 `output/<name>/` 翻译产物不会被自动清理。

### `config` — 查看/修改配置

```bash
repo-translator config                              # 打印完整配置（YAML）
repo-translator config --get translator.engine       # 读取单个配置项（点号路径）
repo-translator config --set sync.interval_hours=12   # 写入单个配置项
repo-translator config --set translator.api_key=sk-xxx
```

`--get`/`--set` 使用点号路径定位嵌套字段（如 `output.suffix`、`translator.model`），`--set` 的值会先尝试按 YAML 语法解析（因此可以直接写数字、布尔值、`null`），解析失败则按原始字符串处理。`--get` 与 `--set` 不能同时使用。

---

## 输出目录结构

每个仓库的翻译产物位于 `output.base_dir`（默认 `~/.repo-translator/output/`）下以仓库名命名的子目录中，目录结构与源仓库镜像一致（命中 `output.exclude` 的文件除外）。managed 仓库的本地克隆也存放在 `output.base_dir` 之下（`repos/<name>/`），与该仓库的翻译产物（`<name>/`）是同级目录：

```
~/.repo-translator/
├── config.yaml
├── cache.json                # blob hash 缓存，增量翻译依据
└── output/                   # output.base_dir（默认值）
    ├── repos/                # managed 仓库的本地克隆
    │   └── langchain/
    └── langchain/             # 该仓库的翻译产物
        ├── README.md         # 原文（拷贝，只读）
        ├── README_zh.md      # 翻译后的中文版
        └── docs/
            ├── intro.md
            └── intro_zh.md
```

---

## 开发

```bash
uv sync --extra dev
uv run pytest tests/ -q
```
