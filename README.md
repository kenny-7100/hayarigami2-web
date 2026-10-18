# 流行之神 2 · 原生 Web 移植

当前提供**序章、本篇四话及全部五篇人物故事**。从原始 `story.dat` 编译剧情，用 TypeScript 执行原版控制流；React、HTML/CSS/SVG、浏览器音频与 IndexedDB 提供原生 Web 交互。

包含黒闇、予知夢、心霊写真、流行り神，以及小暮、贺茂泉、由香、道明寺、人见篇。生产包包含 2108 条剧情与依赖记录、334 背景、378 精灵、40 BGM、200 条术语释义和 432 个关键词。支持选择、勇气、自我质问、各章推理图、评分、不同结局、最终话双路线后日谈、两套片尾及跨章进度保存。

文字全部离线转换为 Unicode，浏览器没有 PSP 文本解码器或模拟器。正文位于场景下方；保留镜像已有中文，未译部分保持日文。片尾采用可继续/跳过的 Web 卡片，不声称 PSP 逐帧/像素一致。原版系统/鉴赏菜单不属于章节移植范围。具体证据与覆盖见 [剩余章节实现记录](docs/REMAINING_CHAPTERS.md)，前章资料与场景渲染记录仍保留。

## 开发与验收入口

新接手任务先读 [AGENTS.md](AGENTS.md) → [当前状态与工作总结](docs/PROJECT_STATUS.md) → [章节实施流程](docs/CHAPTER_WORKFLOW.md)。完整索引见 [开发文档](docs/README.md)，排错经验见 [DEBUGGING](docs/DEBUGGING.md)。

```sh
npm run check:game
npm run audit:chapter -- --chapter 2
npm run qa:replay -- --route tests/fixtures/chapter-one-science.json --entry 20001 --bundle one-science
npm run verify
```

通用浏览器验收入口为 `/tests/qa.html?bundle=one-science`（需先生成检查包并启动 dev）。全章节检查包可用 `node --experimental-strip-types tests/generate-remaining-browser-fixtures.mjs` 生成，再打开 `/tests/qa.html?bundle=all-chapters`。检查包支持桌面和手机视口，并校验完整游戏包指纹。审计只读取原始章节，不修改生产包。命令与工具边界见 [TOOLING](docs/TOOLING.md)。

## 启动

需要 Node.js 22.18+（22.12–22.17 可运行，但测试中的类型剥离仍标为实验功能）、npm、Python 3、`bsdtar` 和 `ffmpeg`。macOS 自带 bsdtar，可用 `brew install ffmpeg` 安装音频转换工具。

```sh
npm install
npm run prepare:game
npm run dev
```

打开终端显示的地址（默认 http://localhost:5173）。当前工作目录已生成资源，可以直接 `npm run dev`。

`prepare:game` 默认读取根目录的 `hg2.iso`，先解包再转换剧情、背景和音乐。其他路径：

```sh
python3 scripts/extract_game.py /path/to/hg2.iso
python3 scripts/compile_prologue.py
python3 scripts/compile_assets.py
```

转换工具针对当前 ULJS00149 v1.02 汉化镜像布局；其他镜像版本需要重新核对地址及字形映射。ISO、解包文件及 `public/game/` 全部生成资源被 Git 忽略，新检出必须先准备资源。原始镜像不会被修改。

## 操作

- 点击“开始序章”或点击“选择章节”，用“继续”按钮或空格 / 回车 / 右方向键翻页。
- 在剧情要求时填写姓氏与名字，使用原生 Unicode 输入。
- 点击“声音”启用音乐和音效，菜单内可调音量与文字大小。默认静音。
- 正文、选择、推理、确认、片尾、结局和姓名输入位置均自动保存；存档面板可保存、读取 3 个手动存档。
- 最终话的后日谈需要两条路线推理达标；“重新调查本篇”保留已完成标记，读取旧存档则恢复该存档的进度。
- 刷新后点击“继续上次阅读”恢复。存档仅存在当前浏览器，清除网站数据会删除存档。
- “回看记录”只查看已读正文；“术语辞典”展示已发现条目的名称与释义。

## 验证与生产构建

```sh
npm test
python3 -m unittest discover -s scripts -p 'test_*.py'
npm run lint
npm run build
npm run preview
```

测试覆盖全部章节的完整路线、成功/错误推理、逐停顿完整历史存档恢复、随机数表、片尾、跨路线后日谈，以及资源引用和动画几何。前两章保留原有全部回归；剩余七篇使用 38 条缩减真实轨迹覆盖正常入口可达记录及 356 个选择位置、774 个可用选项。静态不可达记录有单独证据与断言。验收详情见 [ACCEPTANCE.md](docs/ACCEPTANCE.md)。

构建前必须准备资源。产物 `dist/` 可由静态 HTTP 服务器提供，无需后端。资源采用 Vite 的 BASE_URL，便于部署到子路径。

## 结构

- `scripts/audit_chapter.py`、`check_game.mjs`、`replay_route.mjs`：通用源审计、生成包检查、严格路线与浏览器检查点。
- `scripts/extract_game.py`：ISO、NISPACK 和剧情索引提取。
- `scripts/reverse_eboot.py`：从原始 MIPS ELF 导出反汇编和 181 个指令处理入口。
- `scripts/compile_prologue.py`、`compile_chapter.py`：所有章节字节码与 Unicode 转换。
- `scripts/compile_assets.py`、`compile_audio.py`：纹理、音乐和音效离线转换。
- `scripts/data/prologue-glyph-map.json`：484 个经过原版字形核对的 Unicode 映射。
- `src/game/engine.ts`：纯 TypeScript 剧情状态机；保存原始指令与偏移，遇到未支持指令明确报错。
- `src/game/LogicBoard.tsx`、`AudioScene.tsx`：原生关系图与多轨音频。
- `src/game/storage.ts`：IndexedDB 存档及版本检查。
- `src/App.tsx`：原生 Web 界面、文本、输入、音频、设置与记录。

PSP 编码与字库只在离线研究/转换工具出现，浏览器仅接收 Unicode JSON、PNG 和 M4A。详细证据、地址与适配范围见 [逆向记录](docs/REVERSE_ENGINEERING.md)。早期资源勘察见 [初始移植记录](docs/PORTING.md)。
