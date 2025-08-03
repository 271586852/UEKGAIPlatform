import os
from dotenv import load_dotenv

# 加载环境变量
load_dotenv('.env.local')

api_key = os.getenv("OPENAI_API_KEY_FOR_EMBEDDING")

print("=== OpenAI API 密钥调试 ===")
print(f"密钥是否存在: {'是' if api_key else '否'}")

if api_key:
    print(f"密钥长度: {len(api_key)}")
    print(f"密钥开头: {api_key[:10]}...")
    print(f"密钥结尾: ...{api_key[-4:]}")
    
    # 检查格式
    if api_key.startswith("sk-"):
        print("✅ 密钥格式正确（以 sk- 开头）")
    else:
        print("❌ 密钥格式错误（应该以 sk- 开头）")
        
    if len(api_key) >= 50:
        print("✅ 密钥长度合理")
    else:
        print("❌ 密钥长度可能太短")
        
else:
    print("❌ 未找到 OPENAI_API_KEY_FOR_EMBEDDING 环境变量")
    print("请检查 .env.local 文件中是否正确设置了此变量")

print("=== 调试完成 ===")