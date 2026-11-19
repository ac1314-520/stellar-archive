# 星屿藏馆 · STELLAR ARCHIVE

一个可以直接在浏览器里打开的私人泡泡玛特电子藏品馆。
200 件示例藏品分成八幕，围着新绘制的层叠圣诞树逐幕流转；点开照片可以拖拽旋转 360° 欣赏，另设独立藏品馆与支持 AI 的识藏室。

**在线浏览（GitHub Pages）：** <https://ac1314-520.github.io/stellar-archive/>

![星屿藏馆：圣诞星树与环绕的藏品照片](assets/preview/final-tree.jpg)

> 非官方粉丝作品。示例照片是程序生成的原创潮玩概念样张，不是 Pop Mart 官方图片。
> AI 识藏是可选能力：不接入时照片只留在本机；接入后照片会直接发送给你选择的模型服务商用于识别。

---

## 这次重做了什么

- **换掉旧星树**：不再使用旧的 Three.js 线框树与 200 张实时贴图。新树是项目内绘制的层叠常青树 SVG，带星芒、暖灯、玻璃挂饰与地面光晕。
- **照片更大更清楚**：轨道一次只承载一幕（最多 25 件）的大照片；首屏加载 500×625 的卡片图，点击后再读取高清全图。
- **照片真正环绕**：25 张卡片沿椭圆轨道缓慢移动，按景深缩放、淡入淡出；转到树后会被树自然遮住。
- **手机不再被遮挡**：馆内导航移回顶部，移除了固定在底部的导航条与底部大控制台；页面底部现在留给内容本身。
- **更顺的开场**：去掉 WebGL 初始化与 200 张纹理；只预载当前一幕，轨道用 `transform` + `opacity` 合成层运动。
- **接入 AI 识藏**：在识藏室可选择豆包 Seed Vision、硅基流动、OpenRouter 或任意 OpenAI 兼容视觉接口，用你自己的 API Key 直接看图识别。

| 手机端 | 360° 查看 |
| --- | --- |
| ![手机端](assets/preview/final-mobile.jpg) | ![查看器](assets/preview/final-viewer.jpg) |

| 藏品馆 | 识藏室 |
| --- | --- |
| ![藏品馆](assets/preview/final-collection.jpg) | ![识藏室](assets/preview/final-atelier.jpg) |

---

## 本地打开

**直接访问（若本机预览服务正在运行）**

<http://127.0.0.1:4173>

**以后自己打开**

双击项目里的 `start.bat`。它会启动一个本地静态服务并打开浏览器。

也可以手动运行：

```bash
node server.mjs
# 然后访问 http://127.0.0.1:4173
```

页面使用 IndexedDB 保存你导入的照片，**需要通过 HTTP 打开**，不要直接双击 `index.html`。只需 Node.js 18+，没有安装依赖、没有构建步骤。

- 首页：圣诞星树与照片轨道
- 藏馆：200 件示例藏品，搜索 / 系列筛选 / 版本筛选 / 珍藏
- 识藏：导入照片，本地轻量识别或接入 AI，确认系列后入藏
- 点开任意照片：居中欣赏，拖拽 360°、上下倾斜、滚轮缩放、自动旋赏

---

## 示例照片

`assets/photos/` 下有 200 张 4:5 的原创潮玩概念样张：

- `full/`：720×900，点击查看时读取
- `card/`：500×625，星树轨道与藏品馆首屏使用
- `thumb/`：300×375，旧版缩略图与导入流程备用

由 `scripts/generate_placeholders.py` 使用 Pillow + NumPy 离线绘制；
`scripts/generate_cards.py` 从全图生成 500 px 卡片图；
`scripts/build_tree_svg.py` 生成新版圣诞树 `assets/tree-noel.svg`。

覆盖范围：MOLLY、DIMOO、SKULLPANDA、LABUBU、HIRONO、CRYBABY、SWEET BEAN、PUCKY、NYOTA、ZIMOMO，共 10 个系列，每个系列 20 件。

想重新生成样张：

```bash
python scripts/generate_placeholders.py
python scripts/generate_cards.py
python scripts/build_tree_svg.py
```

> 需要 Python 3.10+、Pillow、NumPy。第一条命令会重写 `js/collection-data.js`。

---

## 换成你的真实照片

1. 打开「识藏」页面。
2. 拖入或选择照片（一次最多 30 张，JPG / PNG / WebP 等常用格式）。
3. 本地识别会给出系列建议；也可以在识藏室右上角接入 AI。
4. 可在结果卡片里下拉手动修正系列。
5. 点「确认入藏」。照片会压缩后保存到浏览器 IndexedDB，并加入藏品馆与星树。
6. 超过 200 件后，轨道会在八幕之外增加新的展幕；所有照片仍可在藏品馆查看。

导入的照片默认完全在浏览器本地处理，不会上传服务器。清理可点「识藏记录」下方的「清空我导入的照片」。

---

## 接入 AI 识藏（BYOK）

在「识藏」页点右上角 **本地识别 / 接入 AI**，选择引擎并填入 API Key、Base URL 与模型 ID，保存即可。Key 只保存在当前浏览器的 `localStorage`（勾选“记住”）或 `sessionStorage`（不勾选），不会出现在网页源码里。

### 豆包 Seed Vision（默认预设）

- 引擎：`豆包 Seed Vision · 火山方舟`
- Base URL：`https://ark.cn-beijing.volces.com/api/v3`
- 默认模型：`doubao-seed-2-0-lite-260215`（可在字段中改成你的模型或推理接入点 ID）
- 获取 Key：<https://console.volcengine.com/ark>

在火山方舟控制台开通视觉模型后，把 Key 与模型/接入点 ID 填进来。免费额度、模型可用性和计费以方舟控制台为准；项目本身不内置任何 Key。

### 其他兼容引擎

- 硅基流动：`https://api.siliconflow.cn/v1`，默认模型 `Qwen/Qwen2.5-VL-32B-Instruct`
- OpenRouter：`https://openrouter.ai/api/v1`，默认模型 `qwen/qwen2.5-vl-32b-instruct:free`
- 任意 OpenAI 兼容视觉接口：填入自己的 Base URL 和模型 ID

请求由浏览器直接发往你选择的服务商。项目不会把 Key 写到 GitHub，也没有自己的后端；因此在公开网页里内置一把公共 Key 是不安全的，这里采用每人填自己 Key 的方式。

### 隐私说明

- 仅使用本地识别时，照片不会离开你的浏览器。
- 启用 AI 后，**你选择提交的照片会直接发送给对应的模型服务商**用于识别。
- 识别失败、超时或 CORS 被拒绝时，识藏室会回退到本地识别，并提示原因。
- 在公共电脑上不建议勾选“记住这段配置”。

![AI 接入设置](assets/preview/final-ai.jpg)

---

## 目录结构

```text
starlit-archive/
├── index.html                      页面结构
├── server.mjs                      零依赖本地静态服务
├── start.bat                       Windows 一键启动
├── css/styles.css                  视觉、轨道布局与移动端样式
├── js/
│   ├── series.js                   10 个系列索引与常用工具
│   ├── collection-data.js          200 件示例藏品数据（自动生成）
│   └── app.js                      路由、八幕轨道、藏品馆、360° 查看器、识藏、IndexedDB、AI
├── assets/
│   ├── tree-noel.svg               新版圣诞树
│   ├── fonts/                      Cormorant Garamond + Manrope
│   ├── photos/full/                200 张 720×900 示例全图
│   ├── photos/card/                200 张 500×625 轨道卡片图
│   ├── photos/thumb/               200 张 300×375 缩略图
│   └── preview/                    预览与分享封面
└── scripts/
    ├── generate_placeholders.py    生成原创示例藏品图
    ├── generate_cards.py           生成轨道卡片图
    └── build_tree_svg.py           生成圣诞树 SVG
```

---

## 设计与实现要点

- **八幕轨道**：`ACT_SIZE = 25`，当前 200 件正好分为八幕。每幕是一次小规模预载；下一幕加载完成后再淡入，避免所有照片同时占内存。
- **景深与遮挡**：卡片按轨道角度缩放、改变透明度；进入树体范围的卡片会被淡出，并由透明遮罩挡住点击，避免树后堆出一片“幽灵照片”。
- **清晰度**：卡片使用 500 px 源图，显示宽度约 150–215 CSS px，在高分屏上仍有余量；查看器才加载 720×900 全图。
- **手机布局**：顶部导航保持 44 px 触控高度；星树控制条在标题下方；没有固定底部导航遮挡内容。
- **360° 查看**：照片被放在双面卡片中，拖拽可连续旋转；支持自动旋赏、缩放、左右切换、收藏；移动端可上下滚动阅读完整档案。
- **隐私**：没有后端数据库；导入照片、收藏、AI 配置都存在浏览器本机。

---

## 兼容性

- 推荐最新版 Chrome / Edge / Safari。
- **不再需要 WebGL**；首屏是 DOM、CSS 与一个 SVG。
- 通过本地 HTTP 服务或 GitHub Pages 打开；`file://` 下 IndexedDB 与部分字体/接口会受限。
- AI 接口使用浏览器直连，是否可用取决于服务商 CORS 策略。若线上豆包可用而本地调试被 CORS 拒绝，属于浏览器端接口限制，不是项目代码报错。

---

## 常见问题

**页面停在“正在点亮星树”**
首屏在预载 25 张卡片图与树 SVG。正常网络下很快完成；若超过十几秒，刷新页面或检查本地服务是否运行。

**双击 index.html 打开是空白 / 照片不显示**
请用 `start.bat` 或 `node server.mjs` 通过 HTTP 访问。

**导入照片后星树怎么没有全部出现？**
轨道一次展示一幕。换到下一幕即可看到下一组；全部 200 件在「藏馆」里始终可以搜索、筛选和查看。

**AI 识别失败怎么办？**
先确认 Key、Base URL、模型 ID 三项；看识藏页的提示。接口超时、CORS 或额度不足都会自动回退到本地识别。可先用「示例样张」测试接口。

**识藏室会把我的照片上传吗？**
你选择本地识别时不会。你启用 AI 并提交照片后，所选照片会直接发给你配置的模型服务商；本站没有中转服务器。

**识别不准**
本地识别只按文件名、主色与画面特征做轻量建议；AI 识别受模型与照片清晰度影响。识别结果都可以在入藏前手动修改系列。
