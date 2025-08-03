import json
import os
from dotenv import load_dotenv
from openai import OpenAI
from supabase import create_client, Client

# 加载环境变量
load_dotenv('.env.local')

SUPABASE_URL = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY_FOR_EMBEDDING")  # 使用 OpenAI 密钥

print("=== 单条记录插入测试（使用 OpenAI）===")

# 初始化客户端
print("1. 初始化客户端...")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
openai_client = OpenAI(
    api_key=OPENAI_API_KEY,
    base_url="https://api.openai.com/v1",
)
print("✅ 客户端初始化成功！")

# 模拟一个节点数据
print("\n2. 模拟节点数据处理...")
mock_node = {
    "type": "node",
    "id": "test_001",
    "labels": ["Feature"],
    "properties": {
        "name": "Lumen",
        "description": "动态全局光照系统，提供实时间接光照计算"
    }
}

# 生成文本块
name = mock_node["properties"]["name"]
description = mock_node["properties"]["description"]
label = mock_node["labels"][0]

text_chunk = f"关于虚幻引擎的'{name}' ({label}): {description}"
print(f"生成的文本块: {text_chunk}")

# 生成向量
print("\n3. 调用 OpenAI API 生成向量...")
try:
    response = openai_client.embeddings.create(
        input=text_chunk,
        model="text-embedding-3-small"
    )
    embedding = response.data[0].embedding
    print(f"✅ 向量生成成功！向量维度: {len(embedding)}")
    print(f"向量前5个值: {embedding[:5]}")
except Exception as e:
    print(f"❌ 向量生成失败: {e}")
    exit(1)

# 准备插入数据
record_to_insert = {
    'content': text_chunk,
    'embedding': embedding
}

# 插入数据库
print("\n4. 插入数据库...")
try:
    response = supabase.table('ue_documents').insert(record_to_insert).execute()
    
    if response.data:
        inserted_record = response.data[0]
        print(f"✅ 插入成功！")
        print(f"   记录ID: {inserted_record.get('id')}")
        print(f"   内容: {inserted_record.get('content')[:50]}...")
        print(f"   向量维度: {len(inserted_record.get('embedding', []))}")
        
        # 验证插入的数据
        print("\n5. 验证插入的数据...")
        verify_response = supabase.table('ue_documents').select('*').eq('id', inserted_record['id']).execute()
        if verify_response.data:
            print("✅ 数据验证成功！记录已正确存储在数据库中")
        else:
            print("⚠️ 数据验证失败，无法找到刚插入的记录")
            
    else:
        print("⚠️ 插入操作完成，但未返回数据")
        if hasattr(response, 'error') and response.error:
            print(f"错误信息: {response.error}")
            
except Exception as e:
    print(f"❌ 插入数据库失败: {e}")

print("\n=== 测试完成 ===")