# repo-translator 架构设计文档

> 版本：v0.1（草稿）｜日期：2026-06-12｜状态：架构设计阶段

---

## 1. 项目概述

repo-translator 是一个面向开发者的命令行工具（CLI），用于将 GitHub 仓库中的 Markdown 文档自动翻译为中文。它支持多翻译引擎、增量翻译、本地双语并存输出，并可通过定时轮询实现对目标仓库更新的自动跟踪与重新翻译。

### 1.1 核心目标

- 降低英文技术文档的阅读门槛，服务于中文开发者的学习场景
- 支持多翻译引擎（OpenAI、DeepSeek、Claude 等），用户可自由切换
- 增量翻译：仅处理有变动的文件，节省 API 成本
- 双语并存：原文件保持不变，翻译结果以 `_zh` 后缀文件形式输出
- 自动同步：定时轮询上游仓库，检测到更新后自动触发重新翻译

### 1.2 明确不做的事

- 不翻译代码文件（`.py`、`.ts` 等），只处理 `.md` 文件
- 不推送翻译结果到远程仓库
- 不提供 Web UI 或 GUI
- 不处理图片、视频等非文本资源

---

## 2. 用户交互设计（CLI）

工具以 `repo-translator` 作为命令入口，提供以下子命令：

### 2.1 子命令概览

| 子命令 | 说明 | 示例 |
|---|---|---|
| `add <url>` | 添加并跟踪一个仓库 | `repo-translator add https://github.com/org/repo` |
| `translate <name>` | 手动触发指定仓库翻译 | `repo-translator translate repo` |
| `watch` | 启动守护进程，定时轮询所有仓库 | `repo-translator watch` |
| `list` | 查看已跟踪的仓库列表及状态 | `repo-translator list` |
| `remove <name>` | 取消跟踪一个仓库 | `repo-translator remove repo` |
| `config` | 查看/修改当前配置 | `repo-translator config --engine deepseek` |

### 2.2 典型使用流程

```bash
# 1. 初始化配置（首次使用）
$ repo-translator config --engine openai --api-key sk-xxx

# 2. 添加目标仓库
$ repo-translator add https://github.com/langchain-ai/langchain
> Cloning into ~/.repo-translator/repos/langchain ...
> Found 23 markdown files. Starting initial translation...
> [23/23] Done. Output: ~/.repo-translator/output/langchain/

# 3. 查看跟踪列表
$ repo-translator list
> NAME         URL                                    LAST_SYNC   FILES
> langchain    github.com/langchain-ai/langchain      2m ago      23

# 4. 启动自动同步守护进程
$ repo-translator watch --interval 6h
> Watching 1 repo(s). Next check in 6h.
```

### 2.3 输出目录结构

```
~/.repo-translator/
├── config.yaml              # 全局配置
├── cache.json               # blob hash 缓存（增量翻译依据）
├── repos/                   # clone 下来的原始仓库
│   └── langchain/           # git 仓库，保持可 pull 状态
└── output/                  # 翻译输出（双语并存）
    └── langchain/
        ├── README.md        # 原文（只读，不修改）
        ├── README_zh.md     # 翻译后的中文版
        └── docs/
            ├── intro.md
            └── intro_zh.md
```

---

## 3. 系统架构

### 3.1 整体流程

```
GitHub Repo URL
      │
      ▼
  GitManager.clone_or_pull()
      │  拉取最新代码
      ▼
  CacheManager.get_changed_files()
      │  对比 blob hash，返回有变动的 .md 文件列表
      ▼
  MarkdownParser.split_blocks(file)
      │  将 md 文件切割为「文本块」和「代码块」
      │  代码块标记为 skip=True，不参与翻译
      ▼
  Translator.translate(text_blocks)
      │  调用 LLM API，只翻译文本块
      ▼
  MarkdownParser.reassemble(blocks)
      │  将翻译后的文本块与原始代码块重新拼合
      ▼
  写入 <filename>_zh.md
      │
      ▼
  CacheManager.update(file, blob_hash)
      完成，更新缓存
```

### 3.2 模块划分

#### GitManager

负责所有 git 操作，封装对 GitPython 的调用。

- `clone(url, dest)` — 首次克隆仓库
- `pull(repo_path)` — 拉取最新变更
- `get_blob_hash(repo_path, file_path)` — 获取指定文件当前的 git blob hash
- `list_md_files(repo_path)` — 枚举仓库内所有 `.md` 文件路径

#### CacheManager

维护一个 JSON 文件，记录每个已翻译文件的 blob hash，用于判断文件是否有变动。

- `get_changed_files(repo, md_files)` — 返回自上次翻译后有变动的文件列表
- `update(repo, file_path, blob_hash)` — 翻译完成后更新缓存
- 对于首次翻译，所有文件视为「有变动」

#### MarkdownParser

Markdown 翻译的核心难点在于需要保护不应被翻译的内容。解析器将文件切割为块序列：

| 块类型 | 内容 | 是否翻译 |
|---|---|---|
| `text_block` | 普通段落、标题文本、列表项文字 | 是 |
| `code_block` | ` ``` ` 围栏代码块 | 否 |
| `inline_code` | 反引号包裹的行内代码 | 否（保留原文） |
| `html_block` | 原始 HTML 标签 | 否 |
| `frontmatter` | YAML/TOML front matter | 否 |
| `image_link` | 图片和超链接的 URL 部分 | 否（只翻译 alt text） |

翻译粒度选择：以「段落」为单位进行翻译，而非整个文件。原因：

- 避免超出 LLM context window
- 失败时可单独重试某个段落，不影响整体
- 便于 diff 对比原文与译文

#### Translator（抽象接口 + 多实现）

定义统一的翻译接口，底层对接不同 Provider：

```python
class BaseTranslator(ABC):
    @abstractmethod
    def translate(self, text: str, context: str = '') -> str:
        """
        text    : 待翻译的纯文本内容
        context : 前后文（可选），帮助 LLM 保持术语一致性
        返回    : 翻译后的中文文本
        """
        ...

class OpenAITranslator(BaseTranslator): ...
class DeepSeekTranslator(BaseTranslator): ...
class ClaudeTranslator(BaseTranslator): ...
```

切换翻译引擎只需修改 `config.yaml`，无需改动其他代码。Translator 内部使用批量请求（batch），减少 API 调用次数。

#### Scheduler

守护进程模式（`watch` 子命令），定时对所有跟踪仓库执行「pull → diff → translate」流程。

- 基于 APScheduler 实现定时任务
- 每个仓库独立调度，互不阻塞
- 默认轮询间隔 6 小时，可通过 `--interval` 参数覆盖
- 进程可以 systemd service 或 launchd plist 方式常驻（可选）

---

## 4. 数据设计

### 4.1 config.yaml

```yaml
# ~/.repo-translator/config.yaml

translator:
  engine: deepseek          # openai | deepseek | claude | custom
  api_key: sk-xxx           # 也可通过环境变量 RT_API_KEY 传入
  model: deepseek-chat      # 使用的具体模型
  base_url: ~               # 自定义 API endpoint（可选）
  max_tokens: 4096
  temperature: 0.3          # 翻译场景建议低温度

sync:
  interval_hours: 6         # 轮询间隔
  concurrency: 3            # 同时处理多少个段落

output:
  base_dir: ~/.repo-translator/output
  suffix: _zh               # 翻译文件后缀，e.g. README_zh.md

repos:
  - name: langchain
    url: https://github.com/langchain-ai/langchain
    branch: main
    added_at: 2026-06-12T10:00:00Z
```

### 4.2 cache.json

```json
{
  "langchain": {
    "README.md": {
      "blob_hash": "a3f2c1d8e4b7f6a2",
      "translated_at": "2026-06-12T10:30:00Z"
    },
    "docs/intro.md": {
      "blob_hash": "b8e4a2f1c3d9e5b7",
      "translated_at": "2026-06-12T10:31:00Z"
    }
  }
}
```

> **为什么用 blob hash 而不是文件修改时间？**
> git 的 blob hash 是文件内容的 SHA-1，只有内容真正变化时才会改变。修改时间在 `git pull` 后会被重置，不可靠。blob hash 是唯一可信的变更判断依据。

---

## 5. 关键设计决策

### 5.1 Markdown 代码块保护

翻译 Markdown 的最大风险是破坏代码块。示例：

```markdown
To install, run the following command:

​```bash
pip install langchain
​```

This will install all dependencies.
```

解析后的块序列：

| 块序号 | 类型 | 内容 | 处理 |
|---|---|---|---|
| 0 | `text_block` | To install, run the following command: | 翻译 |
| 1 | `code_block` | ` ```bash\npip install langchain\n``` ` | 原样保留 |
| 2 | `text_block` | This will install all dependencies. | 翻译 |

翻译后重新拼合，代码块位置和内容不变，只有文本块被替换为中文。

### 5.2 术语一致性

技术文档中存在大量专有名词（如 LangChain、Vector Store、Embedding），不应被翻译。通过 System Prompt 约束 LLM：

```python
SYSTEM_PROMPT = """
你是一个专业的技术文档翻译助手。
翻译规则：
1. 将以下 Markdown 内容翻译为简体中文
2. 保留所有代码、命令、变量名、函数名不翻译
3. 保留技术术语的英文原文，括号内附中文说明，例如：Embedding（嵌入）
4. 保留所有 Markdown 格式符号（**、`、#、- 等）不变
5. 保留所有 URL、文件路径不翻译
6. 只输出翻译结果，不添加任何解释或前缀
"""
```

### 5.3 错误处理策略

| 错误类型 | 处理方式 |
|---|---|
| API 限流（429） | 指数退避重试，最多 3 次 |
| API 超时 | 单段落超时 30s，超时后跳过该段落并记录日志 |
| 翻译结果格式异常 | 校验输出是否仍为合法 Markdown，失败则保留原文 |
| git pull 失败 | 跳过本次同步，下次轮询时重试 |
| 磁盘空间不足 | 停止写入并报警，不破坏已有缓存 |

---

## 6. 项目结构

```
repo-translator/
├── pyproject.toml           # 项目元信息与依赖声明
├── README.md
├── config.example.yaml      # 配置文件模板
│
└── repo_translator/         # 主包
    ├── __init__.py
    ├── cli.py               # CLI 入口，使用 Click 实现子命令
    ├── config.py            # 配置加载与校验（Pydantic）
    │
    ├── git_manager.py       # clone / pull / blob hash 操作
    ├── cache_manager.py     # 增量翻译缓存（读写 cache.json）
    ├── scheduler.py         # 定时轮询守护进程（APScheduler）
    │
    ├── parser/
    │   ├── __init__.py
    │   ├── markdown_parser.py   # 块切割与重新拼合
    │   └── block.py             # Block 数据类定义
    │
    └── translator/
        ├── __init__.py
        ├── base.py              # BaseTranslator 抽象类
        ├── openai_translator.py
        ├── deepseek_translator.py
        ├── claude_translator.py
        └── factory.py           # 根据 config 实例化对应 Translator
```

### 6.1 核心依赖

| 依赖 | 用途 | 选型理由 |
|---|---|---|
| `click` | CLI 框架 | 轻量、生态成熟，子命令支持友好 |
| `pydantic` | 配置校验 | 类型安全，错误提示清晰 |
| `gitpython` | Git 操作 | 纯 Python，无需额外系统依赖 |
| `mistune` | Markdown 解析 | 轻量 AST，便于块级操作 |
| `openai` | OpenAI / DeepSeek SDK | DeepSeek 兼容 OpenAI 接口 |
| `anthropic` | Claude SDK | 官方 SDK |
| `apscheduler` | 定时任务 | 支持 interval、cron 等多种模式 |
| `rich` | 终端输出美化 | 进度条、彩色日志 |

---

## 7. 开放问题（待后续决策）

| # | 问题 | 备选方案 |
|---|---|---|
| 1 | Markdown 解析库的选择：mistune vs markdown-it-py vs 自写正则 | mistune AST 最干净，但需评估对复杂 md 的兼容性 |
| 2 | git 操作是否依赖系统 git | gitpython 可纯 Python 操作；subprocess 调用系统 git 更稳定 |
| 3 | watch 模式的进程管理 | APScheduler 后台线程 vs 独立进程 vs systemd 集成 |
| 4 | 翻译批量大小（batch size） | 段落级 vs 多段落合并，需在 API 成本和质量之间权衡 |
| 5 | 是否支持自定义 glossary（术语表） | 用户可维护一个不翻译词表，解析前做预处理 |
| 6 | 输出目录是否镜像原仓库目录树 | 目前设计为完整镜像；是否需要可配置的过滤规则 |
