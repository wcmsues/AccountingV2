# 小账本

一个纯前端、零依赖的手机端记账应用：记录收支、管理每月固定的房租和工资、设定存钱目标。

原生 HTML + CSS + JavaScript，没有构建步骤，不联网、不上传数据。

## 功能

- **首页**：月度结余、收入/支出/存款概览、预算进度、到期固定收支提醒、近 6 个月收支柱状图、最近 5 笔支出
- **记账**：支出/收入分段、9 + 5 个分类、备注与日期、本月明细按日分组、编辑/删除（删除可撤销）
- **固定收支**：每月固定日期自动记入，支持补记、撤销、停用、删除，重复触发不会重复记账
- **存钱**：存入/取出流水、目标进度环、预计达成月份、近 6 个月存款曲线、目标达成后调高或重设
- **设置**：期初存款、月预算、自动入账策略、JSON 备份导出/导入、导入前快照、清空数据
- **移动端**：iPhone 安全区适配、输入框不小于 16px（避免聚焦缩放）、宽屏时居中显示

## 快速开始

直接双击 `index.html` 就能用。更推荐用本地静态服务打开（行为更接近线上）：

```bash
cd AccountingV2
python3 -m http.server 5173
```

然后访问 <http://127.0.0.1:5173>。

没有依赖，不需要 `npm install`，也不需要打包。

## 目录结构

```text
AccountingV2/
├── index.html           页面结构 + 内联 SVG 图标库
├── favicon.svg          浏览器标签图标
├── manifest.webmanifest Web App 清单（主屏名称、主题色、图标）
├── icons/
│   ├── icon.svg         图标源文件
│   ├── apple-touch-icon.png  iOS 主屏图标（180×180）
│   ├── icon-192.png
│   └── icon-512.png
├── README.md
├── css/
│   ├── base.css         设计令牌、重置、外壳、Tab 栏
│   ├── components.css   卡片、按钮、表单、列表、面板、toast
│   └── pages.css        首页 Hero、新手引导、存钱目标
└── js/
    ├── util.js          日期、金额（整数分）、分类表
    ├── store.js         localStorage 读写、校验、迁移、导入导出
    ├── calc.js          月度汇总、分类聚合、趋势、目标进度
    ├── actions.js       全部写操作 + 固定收支幂等补记 + 示例数据
    ├── chart.js         手绘 SVG 柱状图 / 面积折线 / 进度环
    ├── ui.js            toast、确认框、底部面板、月份条
    ├── views.home.js    首页
    ├── views.ledger.js  记账页
    ├── views.savings.js 存钱页
    └── app.js           启动、Tab 路由、设置面板、备份、心跳
```

## 数据说明

- 存储键：`acct_v2`；另有 `acct_v2_backup`（迁移/导入前快照）和 `acct_v2_preimport`（可手动恢复）
- 金额统一用整数「分」保存，只在显示时除以 100，避免浮点误差
- 日期用本地时间拼接 `YYYY-MM-DD`，不使用 `toISOString()`，避免半夜记账跑到前一天
- 数据只存在当前浏览器的 localStorage 里，不同设备、不同网址之间不共享，也不会同步
- 换手机、清缓存、换域名前，先在「设置」里导出备份；到新环境再导入

## 关键规则

- **固定收支幂等**：确定性 ID `fx_<fixedId>_<yyyymm>` + 业务键复查 + 墓碑表 `suppressedFixed`，启动、重新可见、每分钟心跳都会尝试补齐，但不会重复
- **历史不受模板影响**：生成固定账时把名称、金额、分类快照进流水，之后删除模板也不会影响已有账目
- **目标起算点**：`goal.baseline` 让「从当前存款起算」和「全部存款计入」共用一套数据结构
- **版本保护**：版本号高于当前的数据直接拒绝写入，避免向下覆盖
- **导入可回退**：导入前自动保存当前数据快照，可在设置里一键恢复

## 部署

### GitHub Pages

1. 把本目录作为仓库根目录推送到 GitHub
2. 仓库 **Settings → Pages**
3. **Source** 选择 `Deploy from a branch`，分支 `main`，目录 `/ (root)`，保存
4. 一两分钟后访问 `https://<用户名>.github.io/<仓库名>/`

所有资源都使用相对路径，放在子路径下也能正常工作。

### Netlify Drop

把本目录直接拖到 <https://app.netlify.com/drop>，几秒后即可得到 HTTPS 地址。

## 浏览器支持

面向移动端 Safari / Chrome，桌面端 Chrome、Edge、Safari 也可正常使用。

已在 390px / 320px 宽度下做过交互回归：记账、编辑、删除撤销、固定账自动记入、存钱目标达成、备份导入导出。

## 开发约定

- 无构建、无依赖，`index.html` 用 `<script defer>` 按顺序加载
- 每个 JS 文件用 IIFE 挂到 `window.App`，避免全局变量冲突
- 数据流单向：交互 → `actions` 改 state 并保存 → `refresh` → 视图重渲染，视图层只读
- 金额只通过 `util.parseAmount` / `util.money` 处理，不直接做浮点运算

## 许可

暂未指定 License。如果准备公开给其他人使用，建议补充 MIT 等许可证。
