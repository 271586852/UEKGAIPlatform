import json
import os
import time
import random
from dotenv import load_dotenv
from openai import OpenAI
from supabase import create_client, Client

# 加载环境变量
load_dotenv('.env.local')

SUPABASE_URL = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY_FOR_EMBEDDING") or os.getenv("OPENAI_API_KEY")

if not all([SUPABASE_URL, SUPABASE_KEY, OPENAI_API_KEY]):
    raise ValueError("请确保 .env.local 文件中已设置所有必需的环境变量。")

# 初始化客户端
print("正在初始化 Supabase 和 OpenAI 客户端...")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
openai_client = OpenAI(
    api_key=OPENAI_API_KEY,
    base_url="https://api.openai.com/v1",
)
print("客户端初始化成功！")

def create_embedding_with_retry(text, max_retries=3, base_delay=2):
    """带重试机制的向量生成"""
    for attempt in range(max_retries):
        try:
            response = openai_client.embeddings.create(
                input=text,
                model="text-embedding-3-small"
            )
            return response.data[0].embedding
        except Exception as e:
            if attempt < max_retries - 1:
                delay = base_delay * (2 ** attempt) + random.uniform(0, 1)
                print(f"    -> 重试 {attempt + 1}/{max_retries}，等待 {delay:.1f} 秒...")
                time.sleep(delay)
            else:
                raise e

def save_progress(progress_file, data):
    """保存进度"""
    try:
        with open(progress_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"💾 进度已保存到 {progress_file}")
    except Exception as e:
        print(f"⚠️ 保存进度时发生错误: {e}")

def load_progress(progress_file):
    """加载进度"""
    if os.path.exists(progress_file):
        try:
            with open(progress_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            print(f"📂 从 {progress_file} 加载了之前的进度")
            return data
        except Exception as e:
            print(f"⚠️ 加载进度时发生错误: {e}，将重新开始")
    return {"processed_items": [], "documents": [], "current_phase": "start"}

def test_interrupt_recovery():
    """测试中断恢复功能"""
    print("=== 测试中断恢复功能 ===")
    
    # 进度文件
    progress_file = "test_progress.json"
    
    # 加载之前的进度
    progress = load_progress(progress_file)
    processed_items = set(progress.get("processed_items", []))
    documents = progress.get("documents", [])
    current_phase = progress.get("current_phase", "start")
    
    print(f"📊 已处理项目: {len(processed_items)}")
    print(f"📊 已生成文档: {len(documents)}")
    print(f"📊 当前阶段: {current_phase}")
    
    # 模拟数据
    test_items = [
        {"id": "item_1", "name": "Core", "description": "核心系统模块"},
        {"id": "item_2", "name": "Engine", "description": "引擎主模块"},
        {"id": "item_3", "name": "Slate", "description": "UI框架模块"},
        {"id": "item_4", "name": "UMG", "description": "用户界面模块"},
        {"id": "item_5", "name": "Networking", "description": "网络模块"},
    ]
    
    print(f"\n开始处理 {len(test_items)} 个测试项目...")
    
    for i, item in enumerate(test_items):
        item_id = item["id"]
        
        if item_id in processed_items:
            print(f"⏭️  跳过已处理的项目: {item['name']}")
            continue
        
        print(f"[{i+1}/{len(test_items)}] 正在处理项目 '{item['name']}'...")
        
        # 生成文本
        text = f"虚幻引擎模块'{item['name']}': {item['description']}"
        
        try:
            # 生成向量
            embedding = create_embedding_with_retry(text)
            documents.append({'content': text, 'embedding': embedding})
            processed_items.add(item_id)
            
            # 每处理2个项目保存一次进度
            if len(processed_items) % 2 == 0:
                save_progress(progress_file, {
                    "processed_items": list(processed_items),
                    "documents": documents,
                    "current_phase": "processing"
                })
                print(f"💾 已保存进度，已处理 {len(processed_items)} 个项目")
            
            # 模拟处理时间
            time.sleep(random.uniform(0.5, 1.0))
            
        except Exception as e:
            print(f"    -> ERROR: 处理项目 '{item['name']}' 时发生错误: {e}")
            # 保存当前进度
            save_progress(progress_file, {
                "processed_items": list(processed_items),
                "documents": documents,
                "current_phase": "processing"
            })
            print("🔄 进度已保存，您可以重新运行脚本继续处理")
            return
    
    print(f"✅ 所有项目处理完成！总共处理了 {len(processed_items)} 个项目")
    
    # 清理进度文件
    if os.path.exists(progress_file):
        os.remove(progress_file)
        print("🧹 已清理测试进度文件")
    
    print("🎉 测试完成！")

if __name__ == '__main__':
    test_interrupt_recovery() 