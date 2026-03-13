# FTBQ Editor

纯前端的 FTB Quests 可视化编辑器

## 功能特性

- 📖 读取和解析 `.snbt` 格式的任务章节文件
- 🎨 可视化任务节点展示，显示图标、标题和副标题
- 🖱️ 拖拽移动任务节点 (自动吸附 0.5 单位网格)
- 🔗 可视化任务依赖关系 (连线)
- ✏️ 点击编辑任务属性
- 💾 导出保存为 SNBT 文件

## 快速开始

```bash
# 进入 ftbq-editor 目录
cd ftbq-editor

# 安装依赖
npm install

# 开发模式运行 (访问 http://localhost:5173)
npm run dev

# 构建生产版本
npm run build
```

## 项目结构

```
ftbq-editor/
├── src/
│   ├── components/
│   │   ├── QuestNode.tsx            # 任务节点组件
│   │   ├── QuestEditor.tsx          # 任务编辑面板
│   │   └── QuestEditorCanvas.tsx    # 编辑器画布
│   ├── types/
│   │   └── index.ts                 # TypeScript 类型定义
│   ├── utils/
│   │   └── snbt.ts                  # SNBT 解析工具
│   ├── App.tsx                      # 主应用组件
│   ├── main.tsx                     # 入口文件
│   └── index.css                    # 全局样式
├── public/                          # 静态资源
│   └── shapes/                      # 静态ftbq节点的形状贴图 (来源官方ftbq项目)
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
└── postcss.config.js
```

## 使用说明

1. 点击 "打开文件" 按钮选择 `.snbt` 文件
2. 在画布上查看任务节点
3. 拖拽节点调整位置 (自动吸附网格)
4. 点击节点选中，右侧弹出编辑面板
5. 修改属性后点击 "保存"
6. 点击 "保存文件" 导出修改后的 SNBT

## 网格系统

- 网格间距：16px (对应游戏内 0.5 单位)
- 自动吸附：启用
- 节点拖动时会自动对齐到最近的网格点

## SNBT 格式说明

FTB Quests 的 SNBT 格式与标准 SNBT 有一些区别：

- **字段分隔**: 使用换行分隔，不使用逗号
- **换行符**: 使用 CRLF (`\r\n`)
- **键名**: 通常不使用引号
- **数值类型**: 支持 `1.5d` (double), `1b` (byte), `1s` (short) 等后缀

本编辑器使用 `ftbq-nbt` 库的 `skipComma: true` 选项来兼容这种格式。

## 注意事项

- 本编辑器仅支持 FTB Quests 的章节文件 (`quests/chapters/*.snbt`)
- 图片图标需要是有效的 URL 或 Base64 编码
- 依赖关系通过连线可视化，删除连线暂不支持
- 本项目使用Claude Code协助编码

## Other

- **框架**: React 19 + TypeScript
- **构建工具**: Vite 5
- **样式**: TailwindCSS 3
- **可视化编辑器**: React Flow (@xyflow/react)
- **SNBT 解析**: ftbq-nbt (使用 `skipComma: true` 选项兼容 FTBQ 格式)