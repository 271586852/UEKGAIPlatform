import os
from dotenv import load_dotenv
from supabase import create_client, Client

# 加载环境变量
load_dotenv('.env.local')

SUPABASE_URL = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

print(f"Supabase URL: {SUPABASE_URL}")
print(f"Service Key 前10个字符: {SUPABASE_KEY[:10]}..." if SUPABASE_KEY else "Service Key 未找到")

if not all([SUPABASE_URL, SUPABASE_KEY]):
    raise ValueError("请确保 .env.local 文件中已设置 SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY")

# 初始化客户端
print("正在初始化 Supabase 客户端...")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
print("✅ Supabase 客户端初始化成功！")

# 测试1：检查表是否存在
print("\n--- 测试1：检查 ue_documents 表 ---")
try:
    response = supabase.table('ue_documents').select('count', count='exact').limit(1).execute()
    print(f"✅ 表存在，当前记录数: {response.count}")
except Exception as e:
    print(f"❌ 检查表时出错: {e}")
    exit(1)

# 测试2：尝试插入一条测试记录
print("\n--- 测试2：尝试插入测试记录 ---")
test_record = {
    'content': '这是一个测试记录，用于验证插入权限。',
    'embedding': [0.1] * 1536  # 创建一个1536维的测试向量
}

try:
    response = supabase.table('ue_documents').insert(test_record).execute()
    if response.data:
        print(f"✅ 测试插入成功！插入的记录ID: {response.data[0].get('id', '未知')}")
        
        # 测试3：立即删除测试记录
        print("\n--- 测试3：清理测试记录 ---")
        if 'id' in response.data[0]:
            delete_response = supabase.table('ue_documents').delete().eq('id', response.data[0]['id']).execute()
            print("✅ 测试记录已清理")
        else:
            print("⚠️ 无法获取记录ID，请手动清理测试记录")
            
    else:
        print("⚠️ 插入操作完成，但未返回数据")
        
except Exception as e:
    print(f"❌ 插入测试记录时出错: {e}")
    print("�� 可能的原因：")
    print("   - Service Key 权限不足")
    print("   - 表结构不匹配")
    print("   - 网络连接问题")

# 测试4：检查现有数据
print("\n--- 测试4：检查现有数据 ---")
try:
    response = supabase.table('ue_documents').select('*').limit(5).execute()
    if response.data:
        print(f"✅ 数据库中有 {len(response.data)} 条记录")
        print("前几条记录的内容预览：")
        for i, record in enumerate(response.data[:3]):
            content = record.get('content', '')[:50] + "..." if len(record.get('content', '')) > 50 else record.get('content', '')
            print(f"  {i+1}. {content}")
    else:
        print("ℹ️ 数据库中没有记录")
        
except Exception as e:
    print(f"❌ 检查现有数据时出错: {e}")

print("\n--- 测试完成 ---")