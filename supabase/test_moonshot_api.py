import os
from dotenv import load_dotenv
from openai import OpenAI

# 加载环境变量
load_dotenv('.env.local')
api_key = os.getenv("OPENAI_API_KEY")

print(f"API Key 前10个字符: {api_key[:10]}..." if api_key else "API Key 未找到")

# 初始化客户端
client = OpenAI(
    api_key=api_key,
    base_url="https://api.moonshot.cn/v1",
)

try:
    print("正在测试 Moonshot API 连接...")
    
    # 测试一个简单的 embedding 请求
    response = client.embeddings.create(
        input="这是一个测试文本",
        model="moonshot-v1-embedding"
    )
    
    print("✅ API 连接成功！")
    print(f"生成的向量维度: {len(response.data[0].embedding)}")
    
except Exception as e:
    print(f"❌ API 连接失败: {e}")
    print(f"错误类型: {type(e).__name__}")