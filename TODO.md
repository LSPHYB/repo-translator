# TODO：repo-translator 实施清单

> 依据：`repo-translator-design.md`（v0.1）+ `SCRATCH.md`（10 项开放问题决议）。
> 项目目前是空仓库（仅 README/设计文档），按依赖顺序分 8 个阶段实施。每个阶段完成后建议运行对应测试并提交一次 commit。
> 各条目括号内的编号对应 `SCRATCH.md` 的决议编号，可回查"理由"与"影响模块"。

---

## 阶段 0：项目骨架与配置

- [ ] 创建 `pyproject.toml`：项目名 `repo-translator`，CLI entry point `repo-translator = repo_translator.cli:main`
  - 依赖：`click`、`pydantic`、`markdown-it-py`、`mdit-py-plugins`、`openai`、`anthropic`、`apscheduler`、`rich`
  - **不包含** `gitpython`、`mistune`（design.md §6.1 已废弃，见 SCRATCH §1、§2）
- [ ] 创建包结构：`repo_translator/{__init__.py, cli.py, config.py, git_manager.py, cache_manager.py, sync.py, scheduler.py}`、`repo_translator/parser/{__init__.py, block.py, markdown_parser.py}`、`repo_translator/translator/{__init__.py, base.py, openai_translator.py, deepseek_translator.py, claude_translator.py, factory.py}`
- [ ] `config.py`：用 Pydantic 定义配置模型
  - `RepoConfig`：`name`、`branch`、互斥的 `url` / `path`（SCRATCH §2.1），`added_at`
  - `GlossaryEntry`：术语 + 译法/保留说明（SCRATCH §5）
  - `OutputConfig`：`base_dir`、`suffix`、新增 `exclude: list[str]`（glob，SCRATCH §6）
  - `SyncConfig`：`interval_hours`、`concurrency`（语义改为"并发文件数"，SCRATCH §4）
  - `TranslatorConfig`：沿用 design.md §4.1 字段（engine/api_key/model/base_url/max_tokens/temperature）
  - `AppConfig`：聚合以上 + `repos: list[RepoConfig]` + `glossary: list[GlossaryEntry]`
  - 校验：`RepoConfig` 必须二选一设置 `url` 或 `path`，不可同时/都不设置
- [ ] 创建 `config.example.yaml`，覆盖所有新增字段（`glossary`、`output.exclude`、`repos[].url|path`）
- [ ] `cli.py`：用 click 搭建命令组骨架（`add`/`translate`/`watch`/`list`/`remove`/`config`），先用 `pass`/简单提示占位，第6阶段再填充逻辑
- [ ] 测试：`tests/test_config.py` —— 验证 `RepoConfig` 的 url/path 互斥校验（两者都给 / 都不给均报错）

---

## 阶段 1：GitManager（SCRATCH §2、§2.1）

**文件：** `repo_translator/git_manager.py`

- [ ] `clone(url: str, dest: Path) -> None`：`subprocess.run(["git", "clone", url, str(dest)])`
- [ ] `pull(repo_path: Path) -> None`：`subprocess.run(["git", "-C", str(repo_path), "pull"])`
- [ ] `get_file_blob_map(repo_path: Path) -> dict[str, str]`：执行 `git -C <repo_path> ls-tree -r HEAD`，解析输出为 `{file_path: blob_hash}`，一次调用拿到全仓库映射（替代逐文件 `get_blob_hash`）
- [ ] `list_md_files(file_blob_map: dict) -> list[str]`：从 blob map 中筛出 `.md` 文件路径（不再单独跑 git 命令）
- [ ] `clone_or_pull(repo_config: RepoConfig, repos_dir: Path) -> Path`：
  - `url` 类型（managed）：首次 `clone` 到 `repos_dir/<name>`，之后 `pull`
  - `path` 类型（external）：直接返回展开后的本地路径，**不 clone、不 pull**
  - 所有 `subprocess.run` 调用设置 `check=True`；`clone`/`pull` 失败时抛出 `GitOperationError`（自定义异常），供 `sync.py` 捕获后按 design.md §5.3"跳过本次同步，下次轮询重试"处理
- [ ] 测试：`tests/test_git_manager.py` —— 用临时目录 `git init` + commit 一个文件，验证 `get_file_blob_map` 返回正确的 `{path: hash}`；验证 external 路径下 `clone_or_pull` 不触发任何 git 写操作（可用 mock 断言未调用 clone/pull）

---

## 阶段 2：CacheManager（design.md §3.2/§4.2）

**文件：** `repo_translator/cache_manager.py`

- [ ] `load(cache_path: Path) -> dict`：读取 `cache.json`，不存在则返回 `{}`
- [ ] `save(cache_path: Path, data: dict) -> None`
- [ ] `get_changed_files(repo_name: str, file_blob_map: dict[str, str], cache: dict) -> list[str]`：
  - 对比 `cache[repo_name][file]["blob_hash"]` 与当前 `file_blob_map[file]`
  - 不一致或不存在记录 → 视为"有变动"
  - 首次翻译（`repo_name` 不在 cache 中）→ 全部 `.md` 文件视为有变动
- [ ] `update(cache: dict, repo_name: str, file_path: str, blob_hash: str, translated_at: str) -> dict`：写入/更新单条记录
- [ ] 测试：`tests/test_cache_manager.py` —— 覆盖"首次翻译全量""部分文件 hash 不变跳过""hash 变化触发重译"三种场景

---

## 阶段 3：MarkdownParser（SCRATCH §1、§1.1、§4.1）

**文件：** `repo_translator/parser/block.py`、`repo_translator/parser/markdown_parser.py`

- [ ] `block.py`：定义 `Block` dataclass —— `type: str`（`text` / `code` / `html` / `frontmatter` 等）、`start_line: int`、`end_line: int`、`translatable: bool`
- [ ] `markdown_parser.py` 用 `markdown-it-py`（启用 `mdit-py-plugins` 的 GFM 表格/任务列表/脚注扩展）解析文档，利用 token 的 `.map`（起止行号）划分 `Block` 列表，**不重新序列化 AST**
- [ ] `embed_markers(source: str, blocks: list[Block]) -> str`：对每个 `translatable=True` 的块，在原始源文本对应行范围两端插入 `⟦n⟧` / `⟦/n⟧`（n 为从 0 开始的序号），返回带标记的完整源文本（源码切片+字符串拼接，非重新渲染）
- [ ] `extract_translations(translated_source: str) -> dict[int, str]`：从 LLM 返回的带标记文本中按 `⟦n⟧...⟦/n⟧` 提取每个标记 id 对应的译文
- [ ] `splice(original_source: str, blocks: list[Block], translations: dict[int, str]) -> str`：将提取出的译文按行范围替换回原始源文本对应位置，未翻译/不可翻译块原样保留
- [ ] `protect_inline(text: str) -> tuple[str, dict[str, str]]` / `restore_inline(text: str, placeholders: dict) -> str`：行内代码 `` ` `` 与链接 URL 的占位符替换 `⟦CODE_n⟧`，供译后校验失败时的降级路径使用（SCRATCH §1.1）
- [ ] 测试：`tests/test_markdown_parser.py` —— 用包含标题/段落/表格/代码块/嵌套列表/frontmatter/HTML 块的样例 `.md`：
  - 验证 `embed_markers` 只包裹可翻译块，代码块/frontmatter 不被包裹
  - 验证 `extract_translations` + `splice` 往返后，未翻译部分与原文逐字节一致
  - 验证 `protect_inline`/`restore_inline` 对行内代码、行内链接的占位符往返正确

---

## 阶段 4：Translator（SCRATCH §4、§4.1、§5）

**文件：** `repo_translator/translator/base.py` 及各 provider 实现、`factory.py`

- [ ] `base.py`：
  - `SYSTEM_PROMPT`（沿用 design.md §5.2 内容）
  - `BaseTranslator(ABC)`：抽象方法 `translate_raw(prompt: str) -> str`（单次 LLM 调用，子类实现）
  - `_call_with_retry(fn: Callable[[], str]) -> str`：包装单次 `translate_raw` 调用——超时 30s；遇 429/限流错误指数退避重试最多 3 次（design.md §5.3）；重试耗尽后抛出 `TranslationError`
  - `translate_file(marked_source: str, glossary: list[GlossaryEntry]) -> str`：
    1. 扫描 `marked_source`，筛出 `glossary` 中实际出现的术语子集
    2. 拼装 prompt：`SYSTEM_PROMPT` + 命中术语表 + `marked_source`
    3. 通过 `_call_with_retry` 调用 `translate_raw`，得到带标记译文
    4. 校验：标记 id 集合是否与输入完整一致、每个标记内是否为合法译文（非空、未把标记符号本身翻译掉）；同时做 1.1 的行内元素保留校验
    5. 对校验失败的标记 id，逐个单独走"该段落 + 占位符保护"重译（fallback，仅针对失败 id，不重译整文件）
    6. 若某标记 id 的 fallback 重译仍校验失败或 `_call_with_retry` 抛出 `TranslationError`，该标记内容**保留原文**（design.md §5.3："翻译结果格式异常 → 失败则保留原文"），不阻塞整文件其余部分
    7. 返回拼装好的带标记译文（交给 `markdown_parser.splice` 处理）
- [ ] `openai_translator.py` / `deepseek_translator.py`：基于 `openai` SDK 实现 `translate_raw`（DeepSeek 走 OpenAI 兼容 endpoint，`base_url` 来自配置）
- [ ] `claude_translator.py`：基于 `anthropic` SDK 实现 `translate_raw`
- [ ] `factory.py`：`create_translator(config: TranslatorConfig) -> BaseTranslator`，按 `config.engine` 分支实例化
- [ ] 测试：`tests/test_translator_base.py` —— 用一个假的 `BaseTranslator` 子类（`translate_raw` 返回预设字符串）：
  - 正常路径：所有标记 id 完整且合法 → 直接返回
  - 缺失/格式错误路径：构造缺一个标记 id 的假响应 → 断言只对该 id 触发一次额外的 `translate_raw` 调用（fallback），其余 id 不重译
  - glossary：构造一个包含/不包含术语的 `marked_source`，断言 prompt 中术语表内容随之变化

---

## 阶段 5：同步流水线与输出写入（SCRATCH §6、§6.1）

**文件：** `repo_translator/sync.py`（新增模块，承载 design.md §3.1 的主流程，供 `translate` 命令与 `watch` 调度复用）

- [ ] `sync_repo(repo_config: RepoConfig, app_config: AppConfig, cache: dict) -> dict`：
  1. `git_manager.clone_or_pull` 得到本地仓库路径；捕获 `GitOperationError` → 记录日志后直接返回原 `cache`（本次同步跳过，design.md §5.3）
  2. `git_manager.get_file_blob_map` 获取全量 blob map，筛出 `.md` 文件
  3. `cache_manager.get_changed_files` 得到本次需处理的文件列表
  4. 用 `concurrent.futures.ThreadPoolExecutor(max_workers=app_config.sync.concurrency)` 并发处理变动文件列表（`concurrency` = 同时处理的文件数，SCRATCH §4），每个文件执行步骤 5-6
  5. 单文件处理：`markdown_parser` 切块→嵌标记→`translator.translate_file`→提取译文→拼回，写出 `output/<repo>/<path>_zh.md`；**同时**将该文件原始内容拷贝到 `output/<repo>/<path>`（不用 symlink，SCRATCH §6.1）
  6. 写文件时捕获 `OSError`（如磁盘空间不足）→ 记录错误日志、停止该文件的写入，且**不**更新该文件在 `cache` 中的记录（design.md §5.3："不破坏已有缓存"），但不影响其他文件继续处理
  7. 镜像目录结构：`output/<repo>/` 下目录树与源仓库一致，仅包含 `.md`/`_zh.md`；应用 `output.exclude` glob 列表跳过匹配文件（SCRATCH §6）
  8. 更新并返回新的 `cache` dict（不在此函数内落盘，由调用方统一 `cache_manager.save`）
- [ ] 测试：`tests/test_sync.py` —— 构造一个含 2-3 个 `.md` 文件（含一个匹配 `output.exclude` 的文件）的临时仓库，mock `Translator`：
  - 验证 `output/<repo>/` 目录结构与源仓库一致（exclude 的文件不出现）
  - 验证每个变动文件同时生成 `<name>.md`（原文拷贝）与 `<name>_zh.md`
  - 第二次运行（无文件变动）时不触发翻译（mock 的 `translate_file` 未被调用）

---

## 阶段 6：CLI 命令（design.md §2.1/§2.2，SCRATCH §2.1）

**文件：** `repo_translator/cli.py`

- [ ] `add <url-or-path>`：
  - 判断输入是 URL（`http(s)://` 或 `git@`）还是本地路径
  - URL → 写入 `RepoConfig(url=..., name=<从 URL 推断>)`，调用 `git_manager.clone` 到 `~/.repo-translator/repos/<name>/`
  - 本地路径 → 校验是 git 仓库（存在 `.git`），写入 `RepoConfig(path=..., name=<从路径推断或 --name 指定>)`，**不 clone**
  - 写入后立即触发一次 `sync.sync_repo`（首次全量翻译）
- [ ] `translate <name>`：从 config 取出对应 `RepoConfig`，执行一次 `sync.sync_repo` 并保存 cache
- [ ] `list`：遍历 `repos`，展示 `name`、来源类型（managed/external，依据 `url`/`path` 哪个非空）、`branch`（managed 才有）、上次同步时间（从 cache 推断）、文件数
- [ ] `remove <name>`：从 config 中移除该 `RepoConfig`；若为 managed，提示/可选删除 `repos/<name>/`（external 不删除任何用户文件）
- [ ] `config`：`--get <key>` 读取、`--set <key>=<value>` 写回 `config.yaml`（沿用 design.md §2.1 的 `--engine` 等用法）
- [ ] 测试：`tests/test_cli.py`（用 `click.testing.CliRunner`）——
  - `add <url>`（mock `git_manager.clone` 与 `sync.sync_repo`）后 `config.yaml` 中出现对应 `url` 条目
  - `add <本地路径>`（临时 git 仓库）后条目带 `path` 而非 `url`，且未调用 `clone`
  - `list` 输出区分 managed/external

---

## 阶段 7：Scheduler（SCRATCH §3）

**文件：** `repo_translator/scheduler.py`，模板：`contrib/systemd/repo-translator.service`、`contrib/launchd/com.repo-translator.plist`

- [ ] `run_watch(app_config: AppConfig, interval_override: int | None) -> None`：
  - 创建 `apscheduler.schedulers.blocking.BlockingScheduler`
  - 为每个 `repo_config` 注册一个独立 job，间隔取 `interval_override or app_config.sync.interval_hours`
  - job 函数内部 `try/except`：捕获异常记录日志，不影响其他仓库的 job（单仓库失败不退出进程）
  - 调用 `scheduler.start()`（前台阻塞运行，不自我守护进程化——常驻交给 `nohup`/`tmux`/系统服务）
- [ ] `cli.py` 的 `watch` 子命令：`--interval` 覆盖全局间隔，调用 `run_watch`
- [ ] `contrib/systemd/repo-translator.service`：`ExecStart=repo-translator watch`，`Restart=on-failure`
- [ ] `contrib/launchd/com.repo-translator.plist`：等效 launchd 配置（`ProgramArguments` 指向 `repo-translator watch`，`KeepAlive`）
- [ ] 测试：`tests/test_scheduler.py` —— mock `sync.sync_repo`，断言对 N 个仓库注册了 N 个 job，且其中一个 job 抛异常时其他 job 仍被正常调用（直接调用 job 函数而非真正等待 interval）

---

## 阶段 8：集成与文档收尾

- [ ] 端到端测试 `tests/test_e2e.py`：用一个本地临时 git 仓库（含若干 `.md` 文件）模拟真实流程：`add`（external 路径）→ `translate` → 校验 `output/` 下产物结构与内容（mock Translator 返回固定"译文"）
- [ ] 补全根目录 `README.md`：安装方式、`config.yaml` 配置示例、`add`/`translate`/`watch`/`list`/`remove` 使用说明（参考 design.md §2.2 的流程示例，结合 SCRATCH 的 managed/external 区分）
- [ ] （非阻塞）将 `SCRATCH.md` 的 10 项决议合并进 `repo-translator-design.md`，形成 v0.2；合并后 `SCRATCH.md` 可归档或删除

---

## 阶段间依赖关系

```text
阶段0(骨架/配置)
   ├─→ 阶段1(GitManager) ─┐
   ├─→ 阶段2(CacheManager) ┤
   ├─→ 阶段3(MarkdownParser)┤
   └─→ 阶段4(Translator) ───┴─→ 阶段5(同步流水线) ─→ 阶段6(CLI) ─→ 阶段7(Scheduler) ─→ 阶段8(集成/文档)
```

阶段 1-4 之间没有相互依赖，可并行实现；阶段 5 起开始串联整条流水线。
