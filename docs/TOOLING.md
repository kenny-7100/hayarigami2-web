# 工具与复现命令

全部从仓库根目录运行。Node 22.18+ 推荐；现有 22.17 可执行命令但会输出 Type Stripping 实验提示。Python 3、bsdtar、ffmpeg 用于资源准备；逆向研究额外依赖见 REVERSE_ENGINEERING。工具不自动安装依赖、不执行原始 PSP 程序。

## 日常验证

```sh
npm run check:game       # 快速资源/引用检查，不推进剧情
npm run verify          # 包检查 → Python → Node → lint → QA页类型检查 → TypeScript/生产构建
npm run dev
```

首次检出：`npm install`，`npm run prepare:game`。缺 ISO 时不能伪造资源测试通过。现有生成资源可直接使用；只改 UI 不必反复解包 ISO。

`check:game`：读取 public/game/game.json，使用真实 parseGameData；检查声明文件存在/非空、PNG 标记与尺寸、背景原尺寸、脚本媒体引用、动画变体与纹理、关系图资产、章节入口、跳转、正文/标签替代字符；源 story.dat 存在时比对 SHA。失败退出 1。它不做像素级验证，不证明缓存内容最新，也不判定全部 opcode 语义支持。

```sh
npm run check:game -- public/game/chapter-one.json
```

## 任意原始章节与单记录审计

```sh
npm run audit:chapter -- --catalog
npm run audit:chapter -- --chapter 2
npm run audit:chapter -- --script 30001
npm run audit:chapter -- --chapter 2 --out output/next-audit
```

chapter N 对应 `(N+1)*10000 <= id < (N+2)*10000`，默认 0。`--catalog` 只输出全源万位桶；不生成游戏包。

输出：`output/chapter-2/audit.json` 与 `scripts.json`；单记录为 `output/script-30001/`。已有第零话/第一话默认目录继续使用 chapter-zero / chapter-one。

- resourceReferences / newResourceReferences：按已知资源指令收集ID及相对生产包的缺项，包含动画ID:变体、关系图、关键词和媒体。这是后续转换待办，不保证已解码或可播放。
- opcodeSites：每种指令的 script、pc、原始 offset；从这里缩小逆向范围。
- newComparedToBaseline：相对默认 public/game/game.json 中出现过的指令集之差，**不是“不支持指令清单”**。
- unregisteredOpcodes：相对原版注册表，**不是 Web 支持状态**。没有处理器文件时为 null。
- externalJumps：完整 32 位 101 目标，不能把高位丢掉。
- glyphCodes：原始字符清单；仅传入 `--glyph-map scripts/data/xxx.json` 时计算 missingGlyphs。日文严格 CP932 校验仍由编译器完成。
- 参数 `--source`、`--baseline`、`--handlers` 可指定文件。报告打印绝对路径；不要提交 output/。

## 严格路线重放与浏览器检查点

```sh
npm run qa:replay -- --route tests/fixtures/chapter-one-science.json --entry 20001 --bundle one-science
npm run qa:replay -- --route tests/fixtures/chapter-one-occult.json --entry 20001 --bundle one-occult --check-saves
# npm run dev 后打开：
# http://localhost:5173/tests/qa.html?bundle=one-science
```

默认输入是生产 game.json；`--data` 可指定其他已编译包进行 CLI 重放，但通用浏览器当前只加载生产 game.json，哈希不同会拒绝载入，因此浏览器验收前需合并生产包。

输出 `output/qa/<bundle>/fixtures.json` 和 `report.json`，bundle 仅允许小写字母、数字和连字符。报告包含源与完整包 SHA、入口、结尾、分数、选择数、停顿数和检查点位置。只有命令退出 0 才代表本次重放通过；失败不会用新结果替换旧检查包。

检查点自动覆盖首次 page/choice/input/logic/confirm/ended、每个在阅读停顿处出现的脚本，以及可见动画的 ID/变体。保留最多最近 100 段历史，减少 UI 检查包体积；原重放状态仍保留全部历史。`--check-saves` 逐停顿执行完整历史序列化、validateSave 和等值比较。重放 stop 包含结尾，stoppedScripts 只统计停顿记录，不能拿来报告总执行覆盖。

QA 页会校验完整 game.json SHA，检查包过时则阻止载入。选择检查点、桌面/手机视口后，内部仍使用真实 Reader，可点选、推理、存读档。请在独立测试存储中使用。iframe 使用真实 CSS 视口，但不模拟移动设备触控、GPU、Safari 或浏览器工具栏行为。

新路线 JSON 最小格式：

```json
{
  "entry": 30001,
  "trace": [[30501, 123, 0]],
  "answersByLogic": {"4": {"0": 4801}},
  "names": ["风海", "纯也"],
  "confirmations": [true],
  "end": 39000,
  "score": 80,
  "penalty": 0
}
```

**上例所有 ID/答案/结尾仅示范格式，未经源数据确认，禁止作为下一章正确答案。** trace 中 pc 是出现选择时的下一条指令索引。answers 可用于单图，answersByLogic 用于多图；每个活动字段必须显式有值。confirmations 可省略（默认全部提交），姓名只有实际输入时必需。end 必须指定；score/penalty 有依据时明确填写。现有第零话 fixture 的 answers 是历史记录且不等同于 chapter-walk.mjs 的全部策略，不可直接送入通用重放宣称成功；继续用原章完整测试，迁移时先校准轨迹/答案。

## 专项复现与旧工具

```sh
npm run qa:fixtures
# /tests/chapter-one-browser.html，保留 office / shelves / dark 等手选回归场景
node --experimental-strip-types tests/generate-browser-fixtures.mjs
# /tests/browser.html，旧第零话验收入口
```

通用 QA 工具负责后续扩章；原有专项回归不删除。只需查一类错误时用 node --test 指定测试文件，最终交付再执行完整 verify。正确答案和路线仅放 tests/fixtures，不导入 src/。

## 常见失败

| 现象 | 处理 |
| --- | --- |
| 缺 story.dat / game.json | 检查镜像后 prepare:game；审计不要求已经编译新章 |
| Route trace drift | 检查原脚本/编译修改，核对 script:pc，不自动选第一个选项 |
| Missing explicit answer | 核实活动关系图/字段及真实候选词，不能自动填“看起来正确”的词 |
| 检查点与 game.json 不匹配 | 重新成功运行 qa:replay，勿跳过哈希校验 |
| 资源路径存在但画面旧 | 检查转换缓存和浏览器缓存；备份后仅重建相关生成文件 |
| 32-bit target requires review | 高 ID 章超出现有 VM 跳转读数范围，先修运行时并补回归 |

## 对白与收录专项

`node --experimental-strip-types tests/generate-text-fixtures.mjs` 生成 `output/qa/text/`；访问 `/tests/qa.html?bundle=text`。包含真实关键词、辞典多条收录、普通强调以及前一段检查点；点击继续观察演出。背景为显式布局夹具，不表示原段落背景。依据和边界见 TEXT_PRESENTATION。

## 全章节回归与片尾

新增章节参数已支持 0–8；完整对应表见 [REMAINING_CHAPTERS](REMAINING_CHAPTERS.md)。旧的“高位 ID 尚未支持”错误已修复，现按 u32 处理 101/1301。

```sh
node --experimental-strip-types tests/generate-remaining-browser-fixtures.mjs
# 独立测试窗口 /tests/qa.html?bundle=all-chapters
npm run qa:replay -- --route tests/fixtures/chapter-3-finale.json --bundle all-finale --check-saves
node --experimental-strip-types --test tests/remaining-chapters.test.mjs
```

路线可携带 `randomIndex`（0–999）和一个 `previousRoute` 对象。后者必须是一条完整、明确结局的先前真实路线，重放完成后调用 enterChapter 进入当前章，不直接设置通关旗标。片尾 `credits` 是可保存停顿。旧字段 `penalty` 仅断言原变量 1；在后几章该变量常存放评分比较基准，不能一概称为“错误次数”。

`tests/fixtures/remaining/` 中 38 条缩减轨迹覆盖每章全部静态可达记录与选择位置。探索脚本用于发现路线，验收以固化夹具重放为准。完整历史往返测试需要数分钟；不要把浏览器夹具的 100 页截断带入回归以追求更快通过。

## 第一话简中全译校验

```sh
npm run i18n:extract              # 原严格路线 + 第一话固定种子分支采集
npm run i18n:check:chapter-one    # 本章富文本/静态文本/源覆盖指纹门禁
node --experimental-strip-types tests/generate-zh-hans-fixtures.mjs
# 独立测试存储 /tests/qa.html?bundle=zh-hans&lang=zh-Hans
```

输出 `output/localization/chapter-one-source-coverage.json` 和 `chapter-one-zh-Hans.json`。固定种子 300 次完整路线、科学/灵异夹具、空推理提示，另以 isolated 标记源中未在路线运行的文本块。不将 isolated 当作可达剧情。`i18n:extract` 重建后自动运行采集器，避免覆盖回两条主线的小语料。删除译文、源文漂移、旧 game.json 指纹都会使门禁失败。此门禁是已撰写完整性门禁，不会把 draft 自动改为 reviewed，也不取代全游戏发布门禁。修改游戏源后，必须重新提取并调查基准变化。

## 翻译工作台与连续上下文

后续翻译先读 [TRANSLATION_WORKFLOW](TRANSLATION_WORKFLOW.md)。`npm run i18n:work -- status|prepare|check|apply` 统一正文、静态文本、显式修订和安全合并；按真实 `--entry` 选择章。`npm run i18n:context -- ...` 从指定夹具重放连续停顿。`npm run i18n:test` 是每批翻译的定向检查；章节完成仍运行完整 verify 和实际浏览器验收。

`routes.jsonl.manifest.json` 绑定游戏包和语料文件 SHA，过期时必须重新 i18n:extract；不能只修改指纹让旧语料通过。固定种子第一话的可重放轨迹保存到 `output/localization/chapter-one-trials.json`，数值 trial 对应 routes 数组下标。新的 prompt 和所有场景 label 纳入源清单；章节索引及原始片段不是可直接翻译的完整句子。

新增目录：`localization/glossaries/` 保存有出处的语言术语规则；`localization/task-archive/` 保存已应用任务输入与检查证据；`localization/templates/TRANSLATION_HANDOFF.md` 用于上下文交接、审校范围及媒体清单。工作中的任务放 output/localization/tasks/，避免将尚未填写的任务误当已应用源稿。

## 第二话简中全译校验

```sh
npm run i18n:extract
npm run i18n:check:chapter-two
node --experimental-strip-types tests/generate-chapter-two-zh-hans-fixtures.mjs
# 独立存储 /tests/qa.html?bundle=ch2-zh-hans&lang=zh-Hans
# 扩展 UI 文案加 &stress=1
```

i18n:extract 会重建第一话、第二话的分支语料，不要在提取尚未结束时并发运行依赖语料的门禁。源覆盖报告为 output/localization/chapter-two-source-coverage.json，译稿报告为 chapter-two-zh-Hans.json。科学成功路线用 chapter-2-science.json；39992 是失败路线。完整基准与原文疑点见 [第二话译文验收](reviews/CHAPTER_TWO_ZH_HANS.md)。

## 最终话简中全译校验

```sh
npm run i18n:extract
npm run i18n:check:chapter-three
node --experimental-strip-types tests/generate-chapter-three-zh-hans-fixtures.mjs
# 独立测试存储 /tests/qa.html?bundle=ch3-zh-hans&lang=zh-Hans
# 扩展 UI 文案加 &stress=1
```

最终话入口 40001，编译依赖闭包 448 条记录。采集器读取 16,085 条源文本指令；另 63 条均为名单主脚本 6001 的空格槽，门禁逐个核对源偏移和内容，不能删掉报告来掩盖缺口。全库语料重建后为 27,483 条。chapter-three-trials.json 保存固定种子 300 条可重放轨迹。

专用检查验证 6,316 条富文本、509 条静态译文、源签名、内联关键词一致性。浏览器包含科学、灵异、失败、特殊回忆、双路线真实后日谈和片尾，以及每条路线最长的实际中文段落。完整历史测试仍由 remaining-chapters.test.mjs 执行，不由这些最多 100 页的 UI 检查点替代。详见 reviews/CHAPTER_THREE_ZH_HANS.md。
