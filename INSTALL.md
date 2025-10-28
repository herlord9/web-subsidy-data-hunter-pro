# Easy Scraper Clone - 安装和使用指南

## 🚀 快速开始

### 1. 安装依赖
```bash
cd easy-scraper-clone
npm install
```

### 2. 构建扩展
```bash
npm run build
```

### 3. 安装到浏览器
1. 打开 Chrome 浏览器
2. 访问 `chrome://extensions/`
3. 开启"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择 `easy-scraper-clone/dist` 文件夹

## 📋 功能特性

### ✅ 已实现的功能
- **一键抓取** - 无需编程，点击即可抓取网页数据
- **智能识别** - 自动识别文本、链接、图片、价格等数据
- **多格式导出** - 支持 CSV、JSON 格式导出
- **Checkbox 筛选** - 可选择特定行进行导出（比原版更强！）
- **抓取器管理** - 创建、编辑、删除抓取器配置
- **高级选项** - 自动滚动、分页处理、等待时间控制
- **多语言支持** - 支持英文和中文界面

### 🎯 核心改进
相比原始插件，我们的版本增加了：
- **行选择功能** - 使用 TanStack Table 的内置行选择
- **批量操作** - 全选/取消全选按钮
- **搜索过滤** - 实时搜索表格数据
- **排序功能** - 点击列标题进行排序
- **更好的 UI** - 现代化的界面设计

## 🛠 技术栈

- **前端框架**: React 18
- **表格组件**: TanStack Table v8
- **样式**: CSS3 + 现代特性
- **数据处理**: PapaParse (CSV处理)
- **构建工具**: Webpack 5
- **浏览器 API**: Chrome Extension APIs

## 📖 使用说明

### 创建抓取器
1. 访问任何包含列表的网页
2. 点击 Easy Scraper 扩展图标
3. 点击"New Scraper"创建新抓取器
4. 填写抓取器信息：
   - 名称和描述
   - 域名
   - 抓取类型（列表/详情）
   - 高级选项（自动滚动、等待时间等）

### 开始抓取
1. 在抓取器列表中点击"Start Scraping"
2. 等待抓取完成
3. 查看抓取结果表格

### 导出数据
1. 使用表格上方的复选框选择要导出的行
2. 点击"Select All"全选或"Clear All"清空选择
3. 点击导出按钮：
   - **Export Selected CSV** - 导出选中的行为 CSV
   - **Export Selected JSON** - 导出选中的行为 JSON
   - **Copy to Clipboard** - 复制到剪贴板

## 🔧 开发模式

### 开发环境
```bash
npm run dev
```
这会启动 Webpack 的 watch 模式，文件变化时自动重新构建。

### 生产构建
```bash
npm run build
```
这会创建优化后的生产版本。

### 清理构建
```bash
npm run clean
```
删除 dist 目录。

## 📁 项目结构

```
easy-scraper-clone/
├── src/
│   ├── popup/                 # 弹窗界面
│   │   ├── App.js            # 主应用组件
│   │   ├── components/       # React 组件
│   │   ├── hooks/           # 自定义 Hooks
│   │   ├── styles.css       # 样式文件
│   │   └── index.js         # 入口文件
│   ├── background/          # 后台脚本
│   │   └── background.js
│   ├── content/             # 内容脚本
│   │   └── content.js
│   ├── _locales/            # 多语言文件
│   │   ├── en/messages.json
│   │   └── zh_cn/messages.json
│   └── manifest.json        # 扩展配置
├── dist/                    # 构建输出
├── scripts/                 # 构建脚本
└── webpack.config.js        # Webpack 配置
```

## 🎨 界面预览

### 主界面
- 抓取器列表
- 创建/编辑抓取器按钮
- 开始抓取按钮

### 数据表格
- Checkbox 选择列
- 索引列
- 数据列（自动检测）
- 工具栏（全选、搜索、排序）
- 导出按钮组

### 抓取器配置
- 基本信息（名称、描述、域名）
- 抓取选项（自动滚动、等待时间等）
- 高级设置（分页处理、项目限制等）

## 🐛 故障排除

### 常见问题

1. **扩展无法加载**
   - 确保开启了开发者模式
   - 检查 manifest.json 语法是否正确
   - 查看浏览器控制台错误信息

2. **抓取失败**
   - 确保页面不是受限页面（chrome://, file:// 等）
   - 检查页面是否有列表结构
   - 尝试调整等待时间设置

3. **数据导出问题**
   - 确保选择了要导出的行
   - 检查浏览器是否允许文件下载
   - 尝试使用复制到剪贴板功能

### 调试技巧

1. **查看控制台日志**
   - 右键扩展图标 → 检查弹出内容
   - 查看页面控制台（F12）

2. **检查存储数据**
   - 在扩展管理页面点击"检查视图"
   - 查看 Application → Storage → Local Storage

## 📝 更新日志

### v1.3.6 (当前版本)
- ✅ 完整的 React 界面实现
- ✅ TanStack Table 集成
- ✅ Checkbox 行选择功能
- ✅ CSV/JSON 导出功能
- ✅ 多语言支持
- ✅ 现代化 UI 设计

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License - 可自由使用和修改。
