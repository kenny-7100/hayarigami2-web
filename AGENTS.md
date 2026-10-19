# 后续 AI 的项目入口

先读 [当前状态](docs/PROJECT_STATUS.md)、[章节实施流程](docs/CHAPTER_WORKFLOW.md) 和 [工具说明](docs/TOOLING.md)。按任务再读对应章节、渲染与逆向证据，避免全文扫描大型 JSON 或反汇编。文档索引在 [docs/README.md](docs/README.md)。历史验收记录的早期结论不能替代当前状态。

翻译任务另先读 [翻译工作流](docs/TRANSLATION_WORKFLOW.md) 和对应语言规则；新批次使用 `npm run i18n:work`，不要全文扫描大型语料或用临时脚本绕过合并检查。上下文不明时用 `npm run i18n:context` 重放具体路线。结构校验不等于文学审校。

## 产品约束

- 原生 Web 应用：React / TypeScript / HTML / CSS / SVG / Web 音频 / IndexedDB。允许保留原版剧情字节码并重写解释器；不实现 PSP 模拟器，不追求还原原作者源码。
- 文本在 Python 离线阶段严格转换成 Unicode。浏览器不得引入 PSP 字库、CP932 或汉化私有字码解码。保留镜像已有中文；未翻译部分维持日文，除非用户明确安排翻译。
- 保留深绿、金色、衬线风格。场景在上，正文在下；场景不加压暗遮罩。不能为掩盖缺失动画而随意补背景；不能把长运镜图强行缩成全图。
- 正式界面不显示 opcode、script、pc 或测试工具。开发验收页位于 tests/，不得加入生产入口。
- 未知指令、缺失资源、无法解释的控制流必须显式报错并调查，不能默认跳过。已知汉化补丁和无音效例外必须绑定原始证据与具体位置。

## 工作方式

1. 先看 `git status --short`，保护已有未提交工作。生成资源、ISO 和 output/ 不提交，不修改原始镜像。
2. 从仓库根目录运行命令。`npm run check:game` 快速检查现有包；缺资源时 `npm run prepare:game`。
3. 新章先 `npm run audit:chapter -- --chapter N`；这个 N 是候选万位范围，不能凭它认定章名、入口、关系图 ID 或解码器。
4. 修改指令语义时同时给出源偏移/原始处理器证据、最小回归以及真实路线验证。修改显示/交互时实际浏览器操作复验；单元测试不能代替目视验收。
5. 浏览器使用独立测试窗口/配置文件；Reader 会自动保存，测试夹具也会写 IndexedDB。不要用玩家正常窗口做覆盖、重新开始或测试存档。无痕窗口之间可能共享存储，不把“新无痕窗口”当作全新数据库。
6. 后续章完成后运行 `npm run verify`，再验收桌面、360×740、440×956、844×390。记录实际测试范围及未覆盖边界。
7. 更新 PROJECT_STATUS、该章实现文档和 ACCEPTANCE；新逆向证据附地址、偏移、源文件指纹。不能把生成报告数量当成剧情覆盖证明。

## 快速定位

- 脚本编译：scripts/compile_chapter.py；资源合并：scripts/compile_assets.py。
- 运行时/存档校验：src/game/engine.ts；IndexedDB：src/game/storage.ts。
- 背景几何：src/game/scene.ts；动画：scripts/compile_animations.py、src/game/animation.ts、AnimationScene.tsx。
- 界面：src/App.tsx、App.css、LogicBoard.tsx、AudioScene.tsx。
- 新章通用重放：scripts/replay_route.mjs；浏览器：tests/qa.html。
- 现有完整覆盖测试仍在 tests/chapter.test.mjs、chapter-one.test.mjs；不要用快速重放替换它们。

本文件不要求额外审批或子代理。按用户授权自主完成可逆开发工作，不添加无必要的确认步骤。
