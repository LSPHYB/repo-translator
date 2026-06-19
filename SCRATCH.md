# SCRATCH：第7节开放问题决议

> 本文档是 `repo-translator-design.md` (v0.1) 第7节"开放问题（待后续决策）"的决议附录。
> 通过逐条讨论，针对原文档6个开放问题 + 4个讨论中浮现的紧密关联子问题，给出了具体决策、理由及受影响模块。
> `repo-translator-design.md` 本身暂未修改，本文档作为未来 v0.2 更新的输入。

---

## 决议总览

| # | 开放问题 | 决策 |
| --- | --- | --- |
| 1 | Markdown 解析库的选择 | markdown-it-py + 源码切片（不重新序列化） |
| 1.1（新增） | 段内行内代码/链接如何保护 | Prompt 约束 + 译后校验回退 |
| 2 | git 操作是否依赖系统 git | subprocess + 系统 git |
| 2.1（新增） | 是否支持指向本机已有的本地克隆 | `add` 接受本地路径；external 仓库不 clone/不 pull，输出仍走独立 output 目录 |
| 3 | watch 模式的进程管理 | APScheduler 前台运行 + systemd/launchd 模板 |
| 4 | 翻译批量大小（batch size） | 整文件一次请求 + 失败降级按段落重试 |
| 4.1（新增） | 整文件请求的载荷格式 | 标记内嵌完整源码（`⟦n⟧...⟦/n⟧`），按标记 id 细粒度降级 |
| 5 | 是否支持自定义 glossary（术语表） | 支持，Prompt 注入实现（按文件命中子集） |
| 6 | 输出目录是否镜像原仓库目录树 | 完整镜像 + 可选 exclude 列表 |
| 6.1（新增） | 原文件在 output 中如何呈现 | 拷贝到 output，复用 blob_hash 增量判断 |

---

## 详细决议

### 1. Markdown 解析库的选择

**决策**：使用 `markdown-it-py` 解析 Markdown，利用 token 的 `.map`（源码行范围）识别块类型：

- `fence`（围栏代码块）、`html_block`、frontmatter → 不翻译，标记为 skip
- 其余块（paragraph、heading、list_item 等）→ 可翻译文本块

**拼合方式**：**不**将 AST 重新渲染回 Markdown。而是对原始源文件字符串按行范围切片：可翻译块对应的行替换为译文，其余行原样保留拼接。重新拼合 = 字符串拼接，不经过任何"渲染"步骤。

**理由**：

- 几乎所有 Markdown 库在"渲染回文本"时都会做一定程度的规范化（比如把 `*emphasis*` 统一成 `_emphasis_`，调整列表符号、空行数量、缩进等），导致译文文件和原文在格式上产生大量"无意义 diff"
- 某些库对 GFM 表格、脚注等扩展语法的往返支持并不完美
- markdown-it-py 对 GFM（表格、任务列表、脚注等，借助 `mdit-py-plugins`）兼容性较好，且 token 携带源码行范围信息，天然适合"定位边界 + 源码切片"的做法
- 自写正则方案对嵌套结构（缩进代码块、列表中的代码块等）边界情况覆盖成本高，不予采用；AST 重新序列化方案因 diff 噪音问题不予采用

**影响模块**：

- `parser/markdown_parser.py`、`parser/block.py`
- 依赖列表：`mistune` → `markdown-it-py` + `mdit-py-plugins`

---

### 1.1 段内行内代码/链接保护（新增子问题）

**背景**：1 中的切片是按"块"（段落/标题/列表等 vs 代码块/HTML块/frontmatter）进行的，一个段落内部的行内代码（`` `code` ``）、链接（`[text](url)`）、图片（`![alt](url)`）仍会作为段落整体的一部分被发给 LLM 翻译，需要额外的保护机制。

**决策**：

- 默认：整段原始 Markdown（含行内代码、链接、图片语法）作为一个整体交给 LLM 翻译，依赖 system prompt（design.md 5.2）约束"保留行内代码/URL/格式符号不变"
- 译后校验：检查原文中出现的行内代码片段、URL 是否在译文中原样保留
- 校验失败 → 对该段落降级为"占位符替换"方式重译一次：用 markdown-it-py 的 inline token 把 `inline_code` / `link` / `image` 替换为占位符（如 `⟦CODE_n⟧`），翻译后再替换回原文内容

**理由**：

- 现代 LLM 在明确指令下对行内元素的保留已经相当可靠，纯 Prompt 方案在绝大多数情况下足够简单且有效
- 占位符替换方案能 100% 保证不被改动，但需要额外的 inline 解析、占位符生成/还原逻辑，增加了常规场景的复杂度
- "Prompt 约束 + 译后校验回退"兼顾了大多数情况下的简洁性，又能兜底极少数 LLM 出错的情况，与 design.md 5.3 "翻译结果格式异常 → 校验输出，失败则保留原文"的错误处理思路一致

**影响模块**：

- `translator/base.py`（增加译后校验逻辑）
- `parser/markdown_parser.py`（占位符替换作为 fallback 路径，需要 inline token 解析能力）
- 建议在 design.md 5.3 错误处理策略表中补充"行内元素被改动 → 校验失败，降级为占位符替换重译"一行

---

### 2. git 操作是否依赖系统 git

**决策**：用 `subprocess` 调用系统 `git` 二进制，不引入 gitpython / pygit2。

- `clone`: `git clone <url> <dest>`
- `pull`: 在 `repo_path` 下执行 `git pull`
- 获取全仓库 file→blob_hash 映射: `git ls-tree -r HEAD`（一条命令，输出 `<mode> <type> <hash>\t<path>`）
- 列出 .md 文件: 从上述 `ls-tree` 输出按路径后缀过滤即可，无需单独命令

**理由**：

- gitpython 底层同样依赖系统 git CLI（并非真正"纯 Python"实现），"无需额外系统依赖"这一优势并不存在
- `git ls-tree -r HEAD` 一次性拿到全仓库所有文件的 blob hash，比逐文件查询 hash 效率高得多，恰好匹配 CacheManager 的增量对比需求
- subprocess 方案简单、透明，可在终端直接复现调试；避免了 gitpython 自身的资源管理问题（进程/文件句柄未及时释放）
- pygit2（libgit2）是唯一真正不依赖系统 git 二进制的方案，但引入 C 扩展依赖，对本工具这种轻量 CLI 场景是过度设计

**影响模块**：

- `git_manager.py`（实现改为 subprocess 封装：`clone` / `pull` / `get_blob_hashes`（批量） / `list_md_files`）
- 依赖列表移除 `gitpython`

---

### 2.1 是否支持指向本机已有的本地克隆（新增子问题）

**背景**：原设计假设"源仓库"永远是工具自己 `clone` 到 `~/.repo-translator/repos/<name>/` 的专属副本。但用户本机可能已经在别处（如自己的开发目录）克隆了同一个仓库，不希望工具再额外 clone 一份占用磁盘空间。

**决策**：

- `add <url-or-path>` 同时接受 URL 和本地路径：
  - URL → `git clone` 到 `~/.repo-translator/repos/<name>/`，标记为 **managed**（工具管理的专属副本）；后续 `watch`/`translate` 时按决议2正常执行 `pull`
  - 本地路径 → 直接使用该路径作为 `repo_path`，**不 clone**，标记为 **external**（外部仓库）；后续 `watch`/`translate` 时**不执行 `pull`**，直接对当前 HEAD 执行 `git ls-tree -r HEAD` 读取 blob hash
- 译文输出**始终**写入独立的 `~/.repo-translator/output/<name>/`（与决议6/6.1一致），不论源是 managed clone 还是 external 本地路径，都不在源仓库目录树中写入任何文件
- `config.yaml` 的 `repos` 条目用 `url` 或 `path` 二选一区分来源（互斥）：

  ```yaml
  repos:
    - name: langchain
      url: https://github.com/langchain-ai/langchain   # managed：工具 clone 并 pull
      branch: main
    - name: my-project
      path: ~/code/my-project   # external：只读当前 HEAD，不 pull
  ```

- `list` 命令展示时区分这两类来源（如显示 managed/external 及对应的 URL/本地路径）

**理由**：

- 避免对已有本地克隆的（可能很大的）仓库做重复 clone，节省磁盘空间
- external 仓库不 pull —— 不接触/修改用户自己的工作区状态（可能有未提交修改、当前 checkout 在某 feature branch 上），与"不推送到远程仓库"(1.2)体现的"不打扰用户仓库"原则一致；用户若想跟踪上游更新，自行 `git pull` 即可
- watch 对 external 仓库依然有意义：用户自己 commit 文档变更后，HEAD 的 blob hash 变化会被检测到并触发重新翻译 —— 天然支持"维护者编辑文档时自动更新 `_zh.md`（在独立 output 目录）"的工作流
- 输出始终走独立目录，避免在用户工作区产生未跟踪文件，也避免和决议6.1形成两套不同的输出逻辑

**影响模块**：

- `git_manager.py`（区分 managed/external 两种来源；`clone_or_pull` 仅对 managed 生效，external 直接读取）
- `config.py`（`repos` 条目 schema 增加 `url`/`path` 互斥字段及来源标记）
- `cli.py`（`add` 命令检测输入是 URL 还是本地路径；`list` 命令展示来源类型）

---

### 3. watch 模式的进程管理

**决策**：

- `watch` 子命令内部使用 APScheduler `BlockingScheduler`，**前台运行**
- 每个跟踪仓库注册一个独立 job（独立 `IntervalTrigger`），job 内部 try/except 包裹"pull→diff→translate"流程，单仓库失败不影响其他仓库的调度
- 工具本身**不做自我守护进程化**（不 fork、不脱离终端、不写 PID 文件、不做日志轮转）
- 随附 systemd unit file 和 launchd plist **模板**（放在项目仓库 `contrib/systemd/`、`contrib/launchd/` 下），用户可选择性安装以让 `repo-translator watch` 作为系统服务常驻；工具不内置对这些服务管理器的集成逻辑

**理由**：

- 把"调度逻辑"和"进程保活"彻底解耦：前者用 APScheduler 几行代码搞定（每仓库独立 interval，互不阻塞），后者交给操作系统级的服务管理器（用户自愿选择 `nohup`/`tmux` 或安装服务模板）
- 避免在工具内实现复杂的守护进程管理代码（fork、信号处理、PID 文件管理等现代工具设计中通常不鼓励自行实现的部分）
- 与 design.md 2.2 已经设计好的 `watch --interval 6h` 交互完全兼容，复杂度最低
- "每仓库独立子进程"方案的故障隔离收益对于本工具的任务量级（跟踪数个仓库）不明显，但需要额外实现进程间通信（供 `list` 命令查询各子进程状态）和崩溃重启逻辑，复杂度显著上升，不采用
- "取消 watch，改为一次性 sync 命令 + 外部 cron"方案最简单，但会改变已确定的 `watch --interval` UX，属于更大范围的调整，不采用

**影响模块**：

- `scheduler.py`（APScheduler `BlockingScheduler` + 每仓库独立 job 注册 + try/except 包裹）
- 新增 `contrib/systemd/repo-translator.service`、`contrib/launchd/com.repo-translator.watch.plist` 模板文件（具体内容留给实施阶段）

---

### 4. 翻译批量大小（batch size）

**决策**：

- 默认粒度改为**整文件**：一个 .md 文件的全部"可翻译文本块"在一次请求中一起翻译，LLM 可见全文上下文。具体的请求载荷格式（如何把多个文本块和上下文一起交给 LLM、如何切回译文）见 4.1
- **降级路径**：若文件过大预估超出模型 context window，或译后校验发现部分片段缺失/异常，则**该部分片段**改为**逐段落单独请求**重试（细粒度判定规则见 4.1）
- `config.sync.concurrency` 的含义由"同时处理多少个段落"调整为"**并发处理的文件数**"

**理由**：

- LLM API 按 token 计费，合并请求本身不会减少 token 总量；它真正节省的是每次请求重复发送的 system prompt 开销、降低请求总数与触发限流的概率
- 整文件翻译时 LLM 能看到全文上下文，术语一致性显著优于逐段落独立翻译（避免"前面译成 A，后面译成 B"的不一致）
- design.md 2.2 中 `[23/23] Done` 的进度展示天然对应"文件"粒度，与整文件批量天然契合
- 降级路径保留了原文档"失败时可单独重试某段落"的诉求，兼顾了平时的简洁高效和出错时的兜底
- "跨文件按 token 数凑固定批次"方案能更精细控制请求大小，但会打破"文件"这个自然单位，CacheManager（按文件记 blob_hash）和进度展示都需要额外映射，复杂度增加但收益不明显，不采用

**影响模块**：

- `translator/base.py`（`translate` 接口改为整文件粒度，具体载荷格式见 4.1）
- `config.py`（`sync.concurrency` 字段含义与文档描述同步更新）
- design.md 3.2 "翻译粒度选择"段落描述需要在 v0.2 中更新

---

### 4.1 整文件请求的载荷格式（新增子问题）

**背景**：决议4确定了"整文件一次请求"的批量粒度，但还需要确定**载荷的具体格式**——怎么把一个文件里的多个可翻译文本块交给 LLM，同时让它理解每个片段在文档中的上下文（标题层级、表格列含义、列表项的前后顺序等），这正是"翻译块切分时如何不丢失原来语意"的关键。

**决策**：采用"**标记内嵌完整源码**"的载荷格式：

- 对每个可翻译文本块（段落/标题/列表项/表格单元格的 inline 内容），在**原始源码字符串**中就地用标记符包裹其内容：`⟦1⟧...⟦/1⟧`、`⟦2⟧...⟦/2⟧` ...（标记符沿用决议1.1行内占位符的同一套 Unicode 括号符号体系，避免与正常 Markdown/HTML 语法冲突）
- 把这份**标记后的完整源文件**（表格、列表、标题层级、代码块等结构全部原样保留）作为一个请求发给 LLM，要求：只翻译每对 `⟦n⟧...⟦/n⟧` 标记之间的文字；标记符本身和标记外的所有内容（包括代码块、表格语法、列表符号）必须原样保留输出
- 解析响应：定位每个 `⟦n⟧...⟦/n⟧` 标记对，提取其中的译文文本，按 id 映射回原始源文件中对应区间的位置（沿用决议1的源码切片拼合）

**降级判定**（细化决议4的降级路径）：校验响应中出现的标记 id 集合是否与请求一致、每对标记是否闭合良好。若某些 id 缺失或不闭合，**仅对这些 id 对应的片段**降级为逐段落单独请求重试，其余已成功的片段译文直接采用——降级粒度精确到具体片段，而非整文件重试。

**理由**：

- LLM 翻译第 n 个片段时，**看到的是该片段在文档中的真实上下文**——前后的标题、表格表头、相邻列表项、代码块内容等全部可见，而不是被打散重排成一份"无结构的句子列表"。这是直接保留语意的核心机制
- 与决议1的"源码切片"思路统一：标记本质上是在原始源码上做的非破坏性标注，翻译后按标记 id 切回原始位置，复用决议1的 reassembly 逻辑，不需要为"整文件批量"再发明一套"片段顺序 → 文件位置"的映射规则
- 与决议1.1组合：每个 `⟦n⟧...⟦/n⟧` 片段内部仍是原始 Markdown（含行内代码、链接等），决议1.1的"Prompt 约束 + 译后校验回退（占位符）"机制原样适用于每个片段
- 相比"抽取后的扁平分段列表"（如 `===PARA_n===` 编号拼接），扁平列表里 LLM 只能从"片段出现顺序"隐含猜测结构关系，对复杂表格、嵌套列表等场景的语境保留明显更弱；而"附带局部上下文"的折中方案需要额外设计"该附带多少上下文"的规则，复杂度与收益不成比例

**影响模块**：

- `parser/markdown_parser.py`：新增"标记插入"（基于决议1的块级 token range + 决议1.1的 inline range，在源码字符串中插入 `⟦n⟧`/`⟦/n⟧`）与"标记提取"（解析 LLM 响应中的标记对）逻辑
- `translator/base.py`：prompt 模板调整为"标记后的完整源码 + 标记说明指令"；译后校验逻辑改为"检查标记 id 集合完整性"，按缺失 id 细粒度降级

---

### 5. 是否支持自定义 glossary（术语表）

**决策**：v0.1 即支持，采用 **Prompt 注入**实现。

- 用户在 config 中维护术语表：`术语 -> 译法` 或 `术语 -> 保留不译`
- 翻译某文件前，先扫描该文件的可翻译文本内容，找出术语表中**实际出现**的词条（简单字符串包含检查）
- 仅将命中的子集拼接进该文件请求的 prompt（system prompt 之后），格式类似：

  ```text
  以下术语在本文翻译时必须遵循对照表：
  - Agent -> 智能体
  - LangChain -> 保留英文原文不译
  ```

**理由**：

- 实现成本低（纯过滤 + 字符串拼接），不需要处理大小写、词形变化、子串误匹配（如 "Agent" 误匹配到 "Agentic" 中间）等问题
- 与 4 的"整文件请求"天然契合（按文件扫描而非按段落扫描，扫描开销可忽略）
- 与 1.1 的"译后校验回退"机制互补：glossary 中"保留不译"类型的术语，可以纳入译后校验的检查范围
- "占位符替换"方案能 100% 保证一致性，但需要处理词形变化、大小写、子串边界匹配等问题，复杂度和踩坑面明显更大，不采用
- "v0.1 暂不做"方案虽符合 YAGNI，但考虑到用户可能从一开始就需要翻译特定生态（如某框架自身的概念体系），且 Prompt 注入实现成本很低，故选择直接支持

**影响模块**：

- `config.py`（新增 `glossary` 配置项及 schema）
- `translator/base.py`（翻译前的术语扫描与 prompt 拼接逻辑）
- `config.example.yaml`（增加 glossary 示例）

---

### 6. 输出目录是否镜像原仓库目录树

**决策**：

- 默认**完整镜像** `repos/<repo>/` 的目录结构到 `output/<repo>/`（仅包含 .md 及对应 `_zh.md`）
- config 新增可选 `output.exclude` 字段：glob 模式列表（如 `CHANGELOG.md`、`**/node_modules/**`），命中的文件不参与翻译、不出现在 output 中

**理由**：

- 完整镜像最直观、路径可预测
- 多数仓库的 .md 文件大多值得翻译，少数例外（CHANGELOG、LICENSE 模板等）用黑名单排除比白名单更省心，门槛更低
- "完整镜像 + include 白名单"方案适合"只关心文档站"的大仓库，但要求用户提前了解仓库结构来配置，门槛比黑名单高，不作为默认方案（用户仍可通过 `exclude` 间接实现类似效果）
- "纯完整镜像不提供过滤"会导致 CHANGELOG/LICENSE 等文件被无意义翻译，浪费 API 成本

**影响模块**：

- `config.py`（新增 `output.exclude` 字段及 schema）
- 主流程中文件枚举步骤需先按 `exclude` 过滤
- `config.example.yaml`（增加 exclude 示例）

---

### 6.1 原文件在 output 中如何呈现（新增子问题）

**背景**：design.md 2.3 的输出目录结构示例显示 `output/<repo>/` 下同时有 `README.md`（原文）和 `README_zh.md`（译文）。这意味着原始文件需要以某种方式出现在 output 目录中，这一点原文档未明确说明实现方式。

**决策**：维持"拷贝原文件到 output"设计（与 design.md 2.3 示例一致），不使用 symlink。

复用 CacheManager 现有的 blob_hash 增量判断：当某文件被判定为"自上次翻译后有变动"时，在生成新 `_zh.md` 的同时，把该文件的最新内容也拷贝到 output 对应路径——不需要额外的同步机制或状态记录。

**理由**：

- 双语对照浏览体验最好：用户在 output 目录就能看到原文 + 译文，不需要再跳去 `repos/` 目录
- symlink 方案不冗余且自动保持同步，但在 Windows 非管理员权限下 `os.symlink` 会抛出权限错误，需要额外 fallback 逻辑，跨平台不可靠
- `.md` 文件体积通常很小，拷贝产生的存储冗余可忽略
- CacheManager 已经要遍历"有变动文件"列表来触发翻译，顺手在该流程中拷贝原文件到 output，几乎零额外实现成本，且天然保证"原文件副本"与"译文"的更新时机一致

**影响模块**：

- 主流程（翻译完成后顺带执行原文件拷贝到 output 对应路径）
- CacheManager 接口不变

---

## 对原设计文档 (v0.1) 的连带影响（供后续 v0.2 更新参考）

- **design.md 2.1 `add` 命令交互**：支持本地路径参数（managed/external 两种来源），`list` 输出需展示来源类型
- **design.md 3.2 GitManager**：实现方式由 gitpython 改为 subprocess + 系统 git；接口可调整为批量获取 blob hash（`git ls-tree -r HEAD`）而非逐文件查询；新增 managed/external 来源区分，`clone_or_pull` 仅对 managed 生效
- **design.md 3.2 MarkdownParser**：解析库由 mistune 改为 markdown-it-py；明确"源码切片"拼合方式（不重新序列化）；新增 `⟦n⟧...⟦/n⟧` 标记插入/提取逻辑（本文档4.1）与 inline 占位符替换能力（作为本文档1.1 的 fallback）
- **design.md 3.2 Translator**：`translate` 接口改为整文件粒度，载荷格式为"标记内嵌完整源码"（本文档4.1），按标记 id 细粒度降级；新增译后校验（行内元素保留检查）与 glossary 注入逻辑
- **design.md 3.2 Scheduler**：明确"不自我守护进程化"，新增 systemd/launchd 模板交付物
- **design.md 4.1 config.yaml**：`sync.concurrency` 含义调整为"并发文件数"；新增 `glossary`、`output.exclude` 字段；`repos` 条目增加 `url`/`path` 互斥字段
- **design.md 5.3 错误处理策略表**：建议新增"行内元素被改动 → 译后校验失败，降级为占位符替换重译"一行
- **design.md 6.1 核心依赖**：移除 `gitpython`；`mistune` → `markdown-it-py` + `mdit-py-plugins`；`apscheduler` 保留
