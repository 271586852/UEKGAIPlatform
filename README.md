# GraphRAG - UE项目知识管理平台

## 项目简介

该平台旨在解决 Unreal Engine（UE）大型项目中模块依赖复杂、知识分布零散等问题，构建以「图数据库 + 向量索引 + 智能问答」为核心的一体化知识平台。

## 核心功能

- 🎯 **模块依赖可视化分析** - 支持力导图和径向布局切换
- 🤖 **智能问答系统** - 基于RAG的自然语言问答，支持流式响应
- 🔍 **语义搜索** - 基于向量数据库的语义检索
- 📊 **节点聚合** - 按标签类型自动分组显示
- 🎨 **交互式图谱** - 支持点击、拖拽、缩放等操作
- 💬 **聊天历史管理** - 完整的对话历史记录和会话管理
- 🔐 **用户认证** - 支持GitHub、Google等第三方登录

## 技术栈

### 前端 (Next.js)
- **Next.js 15** - React全栈框架，使用App Router
- **React 19** - 用户界面构建
- **TypeScript** - 类型安全开发
- **D3.js** - 图数据可视化
- **Ant Design** - UI组件库
- **Tailwind CSS** - 样式框架
- **Supabase Auth** - 用户认证系统

### 后端 (Supabase)
- **Supabase** - 后端即服务(BaaS)
- **PostgreSQL** - 关系型数据库
- **pgvector** - 向量数据库扩展
- **Deno Edge Functions** - 服务器端函数
- **OpenAI/Kimi API** - 大语言模型集成

## 项目结构

```
GraphRAGProject/
├── graphrag-nextjs/           # Next.js前端应用
│   ├── src/
│   │   ├── app/              # Next.js App Router
│   │   │   ├── page.tsx      # 主页面
│   │   │   ├── layout.tsx    # 布局组件
│   │   │   └── globals.css   # 全局样式
│   │   ├── components/       # React组件
│   │   │   ├── GraphVisualization.tsx  # 图可视化组件
│   │   │   ├── Chatbot.tsx             # 聊天机器人
│   │   │   ├── Sidebar.tsx             # 侧边栏
│   │   │   └── ...                     # 其他组件
│   │   └── types.ts          # TypeScript类型定义
│   └── package.json
├── supabase/                  # Supabase后端配置
│   ├── functions/            # Edge Functions
│   │   ├── rag-query/        # RAG查询处理
│   │   ├── get-graph-data/   # 图数据获取
│   │   ├── get-chat-history/ # 聊天历史
│   │   └── trace-graph/      # 图追踪
│   ├── migrations/           # 数据库迁移
│   ├── config.toml          # Supabase配置
│   └── migrate_neo4j_to_supabase_robust.py  # 数据迁移脚本
└── README.md
```

## 快速开始

### 环境要求
- Node.js >= 18
- Supabase项目 (已配置)
- OpenAI API Key 或 Moonshot API Key

### 安装依赖

```bash
# 前端依赖
cd graphrag-nextjs
npm install
```

### 配置环境变量

在 `graphrag-nextjs` 目录下创建 `.env.local` 文件：

```env
# Supabase配置
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# OpenAI配置 (可选，如果使用OpenAI)
OPENAI_API_KEY=your_openai_api_key

# Moonshot配置 (可选，如果使用Moonshot)
OPENAI_API_KEY_FOR_EMBEDDING=your_moonshot_api_key
```

### 启动项目

```bash
# 启动前端开发服务器
cd graphrag-nextjs
npm run dev
```

访问 [http://localhost:3000](http://localhost:3000) 查看应用。

### 部署Supabase后端

```bash
# 安装Supabase CLI
npm install -g supabase

# 登录Supabase
supabase login

# 链接到你的Supabase项目
cd supabase
supabase link --project-ref your_project_ref

# 部署数据库迁移
supabase db push

# 部署Edge Functions
supabase functions deploy
```

## 核心功能详解

### 1. 图数据可视化
- **力导向布局**: 使用D3.js实现节点自动分布
- **径向布局**: 层次化展示节点关系
- **交互功能**: 节点点击、拖拽、缩放、高亮
- **聚合显示**: 按标签类型自动分组节点

### 2. RAG智能问答
- **流式响应**: 实时打字机效果显示AI回答
- **上下文检索**: 基于向量相似度搜索相关文档
- **会话管理**: 完整的对话历史记录
- **多模型支持**: 支持OpenAI和Moonshot API

### 3. 数据管理
- **向量存储**: 使用pgvector进行语义搜索
- **图数据**: 存储节点和关系信息
- **聊天历史**: 持久化用户对话记录

## 开发指南

### 添加新的Edge Function

1. 在 `supabase/functions/` 下创建新目录
2. 编写Deno函数代码
3. 在 `supabase/config.toml` 中配置函数
4. 部署: `supabase functions deploy function-name`

### 修改图可视化

主要文件: `graphrag-nextjs/src/components/GraphVisualization.tsx`

- 修改布局算法
- 添加新的交互功能
- 自定义节点样式

### 扩展RAG功能

主要文件: `supabase/functions/rag-query/index.ts`

- 修改提示词模板
- 调整检索策略
- 集成新的LLM模型

## 部署

### Vercel部署 (推荐)

```bash
cd graphrag-nextjs
# 启动项目
npm run dev
# 构建项目
npm run build

# 部署到Vercel
vercel --prod
```

### 环境变量配置

在Vercel中设置以下环境变量：
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `OPENAI_API_KEY` (或 `OPENAI_API_KEY_FOR_EMBEDDING`)

## 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开 Pull Request

## 许可证

MIT License

## 联系方式

如有问题或建议，请提交 [Issue](https://github.com/271586852/UEKGAIPlatform/issues)。
