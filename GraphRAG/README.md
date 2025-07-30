# GraphRAG - UE项目知识管理平台

## 项目简介

该平台旨在解决 Unreal Engine（UE）大型项目中模块依赖复杂、知识分布零散等问题，构建以「图数据库 + 向量索引 + 智能问答」为核心的一体化知识平台。

## 核心功能

- 🎯 **模块依赖可视化分析** - 支持力导图和层次结构图切换
- 🤖 **智能问答系统** - 基于RAG的自然语言问答
- 🔍 **语义搜索** - 快速定位相关模块和知识
- 📊 **节点聚合** - 按功能域/目录结构/层级深度自动分组
- 🎨 **交互式图谱** - 支持点击、拖拽、缩放等操作

## 技术栈

### 前端
- React + TypeScript
- D3.js (图可视化)
- Ant Design (UI组件)
- Zustand (状态管理)
- React Query (数据获取)

### 后端
- Node.js + Express
- Neo4j (图数据库)
- OpenAI API (RAG问答)
- 向量数据库 (语义搜索)

## 快速开始

### 环境要求
- Node.js >= 16
- Neo4j Database (已配置)
- OpenAI API Key

### 安装依赖

```bash
# 前端依赖
npm install

# 后端依赖
cd backend
npm install
```

### 配置环境变量

创建 `.env` 文件：

```env
# Neo4j配置
NEO4J_URI=neo4j://127.0.0.1:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=your_password

# OpenAI配置
OPENAI_API_KEY=your_openai_api_key

# 服务器配置
PORT=3001
```

### 启动项目

```bash
# 启动后端服务
cd backend
npm run dev

# 启动前端服务
npm start
```

## 项目结构

```
GraphRAG/
├── src/                    # 前端源码
│   ├── components/        # React组件
│   ├── pages/            # 页面组件
│   ├── services/         # API服务
│   ├── stores/           # 状态管理
│   └── utils/            # 工具函数
├── backend/              # 后端源码
│   ├── src/
│   │   ├── routes/       # API路由
│   │   ├── services/     # 业务逻辑
│   │   └── utils/        # 工具函数
│   └── package.json
└── package.json
```

## 开发计划

- [x] 项目架构设计
- [ ] 基础UI框架搭建
- [ ] Neo4j连接和查询
- [ ] 图可视化组件
- [ ] RAG问答系统
- [ ] 交互功能优化
- [ ] 性能优化

## 贡献指南

欢迎提交Issue和Pull Request！

## 许可证

MIT License 