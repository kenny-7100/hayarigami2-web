# 翻译工作入口与交付流程

适用于后续 agent 的离线翻译、修订与审校。先读 PROJECT_STATUS 确认本次语言/章节范围，再读本页及对应语言规则。无需全文打开大型 JSON，也不需要重新逆向已确认的文本编码。当前用户要求会话内翻译，不调用外部 API。

## 第一话复盘：为什么需要这些工具

| 已遇到的问题 | 原因 | 现在的防线 |
| --- | --- | --- |
| 整章未进入语料 | 旧路线夹具没有 entry，被采集器遗漏 | 严格适配仅两份已知旧夹具，其余缺参报错；按真实 entry 查询章节 |
| 主线译完但条件文本仍漏 | 两条主路线不代表所有文本指令 | 固定种子分支采集、明确隔离源块、章内源覆盖门禁；通用报告不冒称穷举 |
| 拼接上下文属于不同分支 | 去重语料只保留首次遇见位置，trial 的 step 会重号 | 任务包隔离 route+trial；重放上下文工具还原实际连续停顿 |
| 词条改了，正文高亮还是旧词 | 富文本 ref 可以携带单独的 text | 任务包列出必需 ref；术语规则跨正文、关键词、辞典和关系说明复查 |
| 静态文本依靠临时 Python 写入 | 原批次工具只支持 rich | 工作台统一 strings/rich 导出、校验、修订、原子合并 |
| 确认提示和普通场景标签漏盘点 | 全局清单只采片尾 label，prompt 被归入原始片段 | 使用真实运行时 key 收集 prompt 和所有 1401 label；新增回归 |
| 大 JSON / 大批次耗尽上下文 | 没有源字数预算和任务交接 | 默认 20 条、6,000 源字符；单条长辞典完整保留并标 oversize；任务包与交接模板 |
| 旧任务覆盖新修订 | 只验证源文，不验证当前译文 | 每条 baseHash、目录写锁、原子替换、冲突失败；不同条目可顺序合并 |
| 结构检查被当成文学审校 | 缺少分开的证据和状态 | 结构错误/编辑提示/人工审校分开；合并始终 draft，不自动签核 |
| 位图残留日文、字幕不对齐 | 只检查 JSON，不实际游玩 | 媒体清单、可展开线索释文；独立浏览器检查四种视口及交互 |

## 1. 先盘点，再确定工作包

```sh
git status --short
npm run check:game
# 首次、源游戏改变、语料 manifest 缺失或过期时运行；不必每批重跑。
npm run i18n:extract
npm run i18n:work -- status --locale zh-Hans --entry 30001
```

`--entry` 是生产章节入口：第一话 20001、第二话 30001；不是 audit:chapter 的章节序号。原始主范围取 game.chapters，依赖按编译器相同的 32 位 101/1301 目标闭包收集。关键词范围与初始辞典的已验证例外在 `localization/chapter-scopes.json`。推理图取实际 2008 调用，不推算 ID。

status 分 rich/strings 的 missing、stale、draft、reviewed，列出该范围的路线。静态清单包含章节名、关键词、术语全文、人物/关系说明、确认提示、场景/片尾 label。静态依赖闭包可能含不可达代码，不代表全部已执行；反过来，已采集 rich 全译也不证明漏采为零。第一话和第二话目前各有专用源覆盖门禁，其他章不能冒用它们的证明。

## 2. 准备有限大小的离线任务包

```sh
npm run i18n:work -- prepare --locale zh-Hans --entry 30001 --kind rich --limit 20 --chars 6000 --file output/localization/tasks/ch2-001.json
npm run i18n:work -- prepare --locale zh-Hans --entry 30001 --kind strings --limit 10 --chars 6000 --file output/localization/tasks/ch2-static-001.json
```

可加 `--route` 限定 status 返回的路线名称。文件已存在时拒绝覆盖，继续编辑原文件或换新编号。prepare 不锁定任务、不把待译条目标为完成；同一任务未合并时重复准备可能挑到同一批，应先查看在办任务。

只编辑每条的 `translation` 与 `notes`，保持 key/source/baseHash。rich 填 `{"parts":[{"text":"译文"},{"ref":1}]}`；strings 填 `{"text":"译文"}`。ref 索引指向 source 片段，不是关键词 ID；姓名 ref 不能覆写，关键词/强调可写 `{"ref":1,"text":"对应中文"}`，所有必需 ref 恰好出现一次。definitions 的 `{surname}` / `{givenName}` 必须保留。

包内有位置、当前译文、邻近已译内容、必需引用、相关术语规则。characters 预算针对选中源文本，不是整个 JSON 文件或模型 token 数；一篇超长辞典不拆碎，单条超限会显式报告。邻近语料只是去重后的观察窗口，不能用来猜省略主语。不要将后续身份说明直接灌入早期角色发言。

## 3. 有歧义时获取真实连续上下文

从任务 location 取 key 和 route，保存小窗口，不打印全章：

```sh
npm run i18n:context -- --locale zh-Hans --route tests/fixtures/chapter-one-science.json --key '从任务复制完整key' --radius 3 --file output/localization/context-scene.json
# coverage-2-0 对应 remaining 的章 2、第 0 条路线：
npm run i18n:context -- --locale zh-Hans --route tests/fixtures/remaining/chapter-2.json --index 0 --key '完整key' --file output/localization/context-branch.json
# chapter-one-branches 中数值 trial 可精确重放：
npm run i18n:context -- --locale zh-Hans --route output/localization/chapter-one-trials.json --index 7 --key '该trial中的完整key' --file output/localization/context-trial.json
```

真实重放导出相邻停顿、页面和选项、被选索引、已有译文，完整路线必须到达预期结尾。循环中同一 key 多次出现用 `--occurrence N`，默认第一次。radius 0–10。空关系图提示是在采集时额外触发的检查状态，不属于 trial 的正常选择轨迹；应使用空图浏览器夹具复验。隔离文本块不是完整路线，不为它伪造路线；按源偏移与已记录证据调查。

若 route 为 `chapter-zero-...`，它来自旧 walk 而非独立 JSON，应先用 `tests/chapter-walk.mjs` 建立有证据的具体轨迹，不能硬套其他夹具。工具查不到指定 key 会报错，不能把另一个分支的上下文当答案。

## 4. 撰写、检查、修订、合并

```sh
npm run i18n:work -- check --locale zh-Hans --file output/localization/tasks/ch2-001.json
npm run i18n:work -- apply --locale zh-Hans --file output/localization/tasks/ch2-001.json
npm run i18n:work -- status --locale zh-Hans --entry 30001
```

结构错误禁止合并：缺引用、擦除姓名、占位符变化、控制符、重复 key、过期源、任务游戏指纹变化、已有译稿冲突。编辑提示包括假名残留、与源相同、阿拉伯数字变化、术语禁用写法。提示须在该条 notes 写具体上下文解释后才能合并；notes 不是豁免文学审查，更不能把“已检查”批量填入。工具不会自动把数字改回去或替换亲属称谓。

修订已有译文需显式给 key，保留旧稿基线，填写修订原因：

```sh
npm run i18n:work -- prepare --locale zh-Hans --entry 20001 --key '完整key' --file output/localization/tasks/revision-001.json
```

合并会重新读取目录、比对每条 baseHash、获取 `.lock`、写临时文件并原子替换；逐条未改动的其他译文保留。任务和校验报告按内容哈希存入 `localization/task-archive/<locale>/`，属于应保留的源证据。output/ 仅为可再生工作区。归档存在只证明提交的输入/检查，不替代目录内实际译文。进程中断留下锁时先核实无写入进程，再清理该锁，不盲目删除所有锁。

旧 v1 `localization_batch.mjs` 和 story-batches 保留历史兼容；新任务统一用工作台。不要同时用旧导入器/手工脚本改目录；锁不能约束忽略它的编辑器。即使以后用户授权多个 agent 分工，也只分发不同任务文件，由单个集成者顺序 check/apply；本文件不授予自动创建子代理权限。

## 5. 人工复核与章节交付

使用 `localization/templates/TRANSLATION_HANDOFF.md` 交接；逐场景核对否定、主语、称谓、时间、推测程度、选项意图、真名/假名与两路线差异。术语来源优先查语言规则和 glossary.evidence。新增规则应先证明适用范围，机器 preferred 仅提示，不做全局替换。

每批运行工作台 check；合并后跑 `npm run i18n:test`。静态提取器改动跑 `npm run test:python`。章节阶段完成再运行完整 `npm run verify` 和浏览器验收，不必每 20 句重复全部耗时路线回归。第一话额外 `npm run i18n:check:chapter-one`，第二话 `npm run i18n:check:chapter-two`；其他章需建立自己的源指令/条件变体证据后才能称完整。

浏览器：独立测试存储，桌面、360×740、440×956、844×390；最大字号、长词、长辞典、姓名、高亮、收录、历史、选项、推理、保存读取、刷新语言；需要 RTL 的语言另验布局。修改显示必须实际操作，不用截图数量替代交互成功。媒体按模板逐项盘点，区分原画已有中文、中文释文、装饰性未转写与真正漏项。原文错字的编辑修正要记录源偏移/版本和理由。

结构通过、译稿覆盖、人工审校、源覆盖、媒体、浏览器是六项独立结论。不要自动把 draft 升级为 reviewed；不要以“有语言切换器”“没有假名”“段落数够了”替代整章验收。`i18n:release-check` 全游戏门禁保持严格，未译其他章节不能被本章状态掩盖。
