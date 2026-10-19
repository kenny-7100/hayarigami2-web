# 开发文档索引

新接手任务先读前三项，不必先打开大型生成文件。

| 文档 | 用途 |
| --- | --- |
| [PROJECT_STATUS](PROJECT_STATUS.md) | 当前完成范围、已知边界、下一章审计与待办 |
| [CHAPTER_WORKFLOW](CHAPTER_WORKFLOW.md) | 从原始审计到章节验收的步骤与完成条件 |
| [TOOLING](TOOLING.md) | 可复制命令、输入输出、失败诊断与通用浏览器入口 |
| [TRANSLATION_WORKFLOW](TRANSLATION_WORKFLOW.md) | agent 翻译入口、第一话复盘、工作台、连续上下文、审校和交接 |
| [I18N](I18N.md) | 多语言架构、翻译进度、验收缺口（进行中） |
| [UI_DESIGN](UI_DESIGN.md) | 游戏界面设计约束、响应式布局和交互验收清单 |
| [ARCHITECTURE](ARCHITECTURE.md) | 离线管线、运行时、数据与修改位置 |
| [DEBUGGING](DEBUGGING.md) | 前几章踩坑、排错顺序和证据定位 |
| [CHAPTER_TEMPLATE](CHAPTER_TEMPLATE.md) | 后续章节实现/验收记录模板与 AI 任务交接 |
| [CHAPTER_ZERO](CHAPTER_ZERO.md) | 第零话具体证据、路线与例外 |
| [CHAPTER_ONE](CHAPTER_ONE.md) | 第一话具体证据、语言、路线与例外 |
| [REMAINING_CHAPTERS](REMAINING_CHAPTERS.md) | 第二话至全部人物篇、双路线片尾、随机事件、覆盖与原版例外 |
| [TEXT_PRESENTATION](TEXT_PRESENTATION.md) | 对白样式栈、关键词/辞典收录、Web 动画与存档兼容 |
| [SCENE_RENDERING](SCENE_RENDERING.md) | 背景运镜、带符号尺寸、动画包和渲染证据 |
| [REVERSE_ENGINEERING](REVERSE_ENGINEERING.md) | 原始 ELF、指令调度、文本与序章逆向证据 |
| [ACCEPTANCE](ACCEPTANCE.md) | 按时间追加的实际测试记录；早期数字仅代表当时 |
| [PORTING](PORTING.md) | 最初资源勘察历史，不作为当前缺口列表 |

稳定依据是原始资源与经验证的行为，其次是当前代码/测试；文档用于解释这些证据。若历史文字与现有实现矛盾，复查后修正文档，不回退已验证功能。

- [100 项玩家视角评审与决策](reviews/PLAYER_REVIEW_2026-10-19.md)：多章节抽样、采纳原因、实现边界与验收依据。

- [第二话简中译文验收](reviews/CHAPTER_TWO_ZH_HANS.md)：完整性门禁、科学/灵异路线身份、术语与原作疑点、媒体和四视口抽查。

- [最终话简中翻译与验收](reviews/CHAPTER_THREE_ZH_HANS.md)：源覆盖、各分支、片尾、术语及媒体释文。

- [全部剩余章节简中译稿与验收](reviews/REMAINING_ZH_HANS.md)：全库覆盖、各入口基线、孤立源块、编辑取舍、媒体释文与浏览器验收范围。
