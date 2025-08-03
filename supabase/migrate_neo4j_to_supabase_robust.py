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

def find_node_by_id(node_id, all_nodes):
    """根据ID查找节点"""
    for node in all_nodes:
        if node.get("id") == node_id:
            return node
    return None

def generate_base_node_text(node):
    """生成节点的基础文本描述"""
    props = node.get("properties", {})
    name = props.get("name")
    description = props.get("description")
    labels = node.get("labels", ["Thing"])
    label = labels[0] if labels else "Thing"
    
    # 根据标签类型生成更精确的描述
    if label == "Module":
        if name and description:
            return f"虚幻引擎模块'{name}': {description}"
        elif name:
            return f"虚幻引擎模块'{name}'，这是一个功能模块。"
    elif label == "System":
        if name and description:
            return f"虚幻引擎系统'{name}': {description}"
        elif name:
            return f"虚幻引擎系统'{name}'，这是一个系统级组件。"
    elif label == "Class":
        if name and description:
            return f"虚幻引擎类'{name}': {description}"
        elif name:
            return f"虚幻引擎类'{name}'，这是一个类定义。"
    elif label == "Interface":
        if name and description:
            return f"虚幻引擎接口'{name}': {description}"
        elif name:
            return f"虚幻引擎接口'{name}'，这是一个接口定义。"
    elif label == "Subsystem":
        if name and description:
            return f"虚幻引擎子系统'{name}': {description}"
        elif name:
            return f"虚幻引擎子系统'{name}'，这是一个子系统组件。"
    else:
        if name and description:
            return f"关于虚幻引擎的'{name}' ({label}): {description}"
        elif name:
            return f"虚幻引擎中有一个概念或功能叫做'{name}' ({label})。"
        else:
            return None

def truncate_text_for_embedding(text, max_tokens=4000):
    """截断文本以适应embedding模型的token限制"""
    # 更保守的估算：1个token约等于2.5个字符（中文更密集）
    max_chars = max_tokens * 2.5
    
    if len(text) <= max_chars:
        return text
    
    # 如果文本太长，尝试智能截断
    print(f"    -> 文本过长 ({len(text)} 字符)，开始智能截断...")
    
    # 首先尝试在句号处截断
    truncated_text = text[:max_chars]
    last_period = truncated_text.rfind('。')
    
    if last_period > max_chars * 0.8:  # 如果句号位置合理
        truncated_text = truncated_text[:last_period + 1]
        print(f"    -> 在句号处截断，保留 {len(truncated_text)} 字符")
    else:
        # 如果没有合适的句号，尝试在逗号处截断
        last_comma = truncated_text.rfind('，')
        if last_comma > max_chars * 0.8:
            truncated_text = truncated_text[:last_comma + 1] + "等。"
            print(f"    -> 在逗号处截断并添加'等'，保留 {len(truncated_text)} 字符")
        else:
            # 最后选择在字符限制处截断
            truncated_text = text[:max_chars - 3] + "..."
            print(f"    -> 强制截断并添加省略号，保留 {len(truncated_text)} 字符")
    
    return truncated_text

def enhance_node_with_relationships(node, all_relationships, all_nodes):
    """为节点添加关系信息，生成增强的文本描述"""
    base_text = generate_base_node_text(node)
    if not base_text:
        return None
    
    node_id = node.get("id")
    dependencies = []
    dependents = []
    hierarchy_info = []
    
    # 查找与此节点相关的关系
    for rel in all_relationships:
        if rel.get("start", {}).get("id") == node_id:
            # 当前节点是关系的起始点（依赖其他模块）
            target_id = rel.get("end", {}).get("id")
            rel_type = rel.get("label")
            rel_props = rel.get("properties", {})
            dependency_type = rel_props.get("type", "")
            target_node = find_node_by_id(target_id, all_nodes)
            if target_node:
                target_name = target_node.get("properties", {}).get("name")
                target_labels = target_node.get("labels", [])
                if target_name:
                    # 根据依赖类型生成更精确的描述
                    if dependency_type == "PublicDependencyModuleNames":
                        dependencies.append(f"公开依赖'{target_name}'")
                    elif dependency_type == "PrivateDependencyModuleNames":
                        dependencies.append(f"私有依赖'{target_name}'")
                    elif dependency_type == "PublicIncludePathModuleNames":
                        dependencies.append(f"公开包含路径依赖'{target_name}'")
                    elif dependency_type == "PrivateIncludePathModuleNames":
                        dependencies.append(f"私有包含路径依赖'{target_name}'")
                    else:
                        dependencies.append(f"依赖'{target_name}'")
                    
        elif rel.get("end", {}).get("id") == node_id:
            # 当前节点是关系的终止点（被其他模块依赖）
            source_id = rel.get("start", {}).get("id")
            rel_type = rel.get("label")
            rel_props = rel.get("properties", {})
            dependency_type = rel_props.get("type", "")
            source_node = find_node_by_id(source_id, all_nodes)
            if source_node:
                source_name = source_node.get("properties", {}).get("name")
                source_labels = source_node.get("labels", [])
                if source_name:
                    # 根据依赖类型生成更精确的描述
                    if dependency_type == "PublicDependencyModuleNames":
                        dependents.append(f"被'{source_name}'公开依赖")
                    elif dependency_type == "PrivateDependencyModuleNames":
                        dependents.append(f"被'{source_name}'私有依赖")
                    elif dependency_type == "PublicIncludePathModuleNames":
                        dependents.append(f"被'{source_name}'公开包含路径依赖")
                    elif dependency_type == "PrivateIncludePathModuleNames":
                        dependents.append(f"被'{source_name}'私有包含路径依赖")
                    else:
                        dependents.append(f"被'{source_name}'依赖")
    
    # 限制依赖关系数量，避免文本过长
    max_dependencies = 50
    max_dependents = 30
    
    if len(dependencies) > max_dependencies:
        dependencies = dependencies[:max_dependencies]
        dependencies.append(f"等{len(dependencies)}个依赖")
    
    if len(dependents) > max_dependents:
        dependents = dependents[:max_dependents]
        dependents.append(f"等{len(dependents)}个被依赖")
    
    # 添加层次结构信息
    node_labels = node.get("labels", [])
    if "System" in node_labels:
        hierarchy_info.append("这是一个系统级组件")
    elif "Subsystem" in node_labels:
        hierarchy_info.append("这是一个子系统组件")
    elif "Module" in node_labels:
        hierarchy_info.append("这是一个功能模块")
    elif "Class" in node_labels:
        hierarchy_info.append("这是一个类定义")
    elif "Interface" in node_labels:
        hierarchy_info.append("这是一个接口定义")
    
    # 组合最终文本
    relationship_text = []
    if dependencies:
        relationship_text.append("它" + "，".join(dependencies))
    if dependents:
        relationship_text.append("，".join(dependents))
    if hierarchy_info:
        relationship_text.append("，".join(hierarchy_info))
    
    if relationship_text:
        base_text += " " + "，".join(relationship_text) + "。"
    
    # 截断文本以适应token限制
    final_text = truncate_text_for_embedding(base_text)
    
    return final_text

def generate_relationship_text(relationship, all_nodes):
    """为关系生成独立的描述文本"""
    rel_type = relationship.get("label")
    rel_props = relationship.get("properties", {})
    dependency_type = rel_props.get("type", "")
    start_node = relationship.get("start", {})
    end_node = relationship.get("end", {})
    
    start_name = start_node.get("properties", {}).get("name")
    end_name = end_node.get("properties", {}).get("name")
    
    if start_name and end_name:
        # 根据依赖类型生成更精确的描述
        if dependency_type == "PublicDependencyModuleNames":
            return f"在虚幻引擎中，'{start_name}' 公开依赖 '{end_name}'，这意味着'{start_name}'可以访问'{end_name}'的公共接口。"
        elif dependency_type == "PrivateDependencyModuleNames":
            return f"在虚幻引擎中，'{start_name}' 私有依赖 '{end_name}'，这意味着'{start_name}'可以访问'{end_name}'的内部实现。"
        elif dependency_type == "PublicIncludePathModuleNames":
            return f"在虚幻引擎中，'{start_name}' 公开包含路径依赖 '{end_name}'，这意味着'{start_name}'可以包含'{end_name}'的公共头文件。"
        elif dependency_type == "PrivateIncludePathModuleNames":
            return f"在虚幻引擎中，'{start_name}' 私有包含路径依赖 '{end_name}'，这意味着'{start_name}'可以包含'{end_name}'的内部头文件。"
        else:
            return f"在虚幻引擎中，'{start_name}' {rel_type} '{end_name}'。"
    
    return None

def generate_hierarchy_and_type_documents(all_nodes, all_relationships):
    """生成层次结构和类型关系的额外文档"""
    documents = []
    
    # 按标签分组节点
    nodes_by_label = {}
    for node in all_nodes:
        labels = node.get("labels", [])
        for label in labels:
            if label not in nodes_by_label:
                nodes_by_label[label] = []
            nodes_by_label[label].append(node)
    
    # 生成层次结构文档
    if "System" in nodes_by_label:
        system_nodes = nodes_by_label["System"]
        if len(system_nodes) > 0:
            system_names = [node.get("properties", {}).get("name", "未知") for node in system_nodes if node.get("properties", {}).get("name")]
            if system_names:
                hierarchy_text = f"虚幻引擎包含以下系统级组件: {', '.join(system_names)}。这些系统是引擎的核心架构组件，负责管理不同的功能领域。"
                documents.append(hierarchy_text)
    
    if "Subsystem" in nodes_by_label:
        subsystem_nodes = nodes_by_label["Subsystem"]
        if len(subsystem_nodes) > 0:
            subsystem_names = [node.get("properties", {}).get("name", "未知") for node in subsystem_nodes if node.get("properties", {}).get("name")]
            if subsystem_names:
                hierarchy_text = f"虚幻引擎包含以下子系统组件: {', '.join(subsystem_names)}。这些子系统是系统级组件的子组件，提供更细粒度的功能。"
                documents.append(hierarchy_text)
    
    if "Module" in nodes_by_label:
        module_nodes = nodes_by_label["Module"]
        if len(module_nodes) > 0:
            module_names = [node.get("properties", {}).get("name", "未知") for node in module_nodes if node.get("properties", {}).get("name")]
            if module_names:
                hierarchy_text = f"虚幻引擎包含以下功能模块: {', '.join(module_names[:20])}{'...' if len(module_names) > 20 else ''}。这些模块是引擎的功能单元，每个模块负责特定的功能领域。"
                documents.append(hierarchy_text)
    
    # 生成类型关系文档
    if "Class" in nodes_by_label:
        class_nodes = nodes_by_label["Class"]
        if len(class_nodes) > 0:
            class_names = [node.get("properties", {}).get("name", "未知") for node in class_nodes if node.get("properties", {}).get("name")]
            if class_names:
                type_text = f"虚幻引擎包含以下类定义: {', '.join(class_names[:20])}{'...' if len(class_names) > 20 else ''}。这些类提供了引擎的面向对象编程接口。"
                documents.append(type_text)
    
    if "Interface" in nodes_by_label:
        interface_nodes = nodes_by_label["Interface"]
        if len(interface_nodes) > 0:
            interface_names = [node.get("properties", {}).get("name", "未知") for node in interface_nodes if node.get("properties", {}).get("name")]
            if interface_names:
                type_text = f"虚幻引擎包含以下接口定义: {', '.join(interface_names)}。这些接口定义了类之间的契约和抽象。"
                documents.append(type_text)
    
    return documents

def create_embedding_with_retry(text, max_retries=3, base_delay=2):
    """带重试机制的向量生成"""
    # 确保文本长度在合理范围内
    text = truncate_text_for_embedding(text)
    
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
    return {"processed_nodes": [], "processed_relationships": [], "documents": [], "current_phase": "nodes"}

def migrate_data(json_file_path):
    print(f"开始处理JSON Lines文件: {json_file_path}")
    
    # 进度文件
    progress_file = "migration_progress.json"
    
    # 加载之前的进度
    progress = load_progress(progress_file)
    processed_nodes = set(progress.get("processed_nodes", []))
    processed_relationships = set(progress.get("processed_relationships", []))
    documents_to_insert = progress.get("documents", [])
    current_phase = progress.get("current_phase", "nodes")
    
    print(f"📊 已处理节点: {len(processed_nodes)}")
    print(f"📊 已处理关系: {len(processed_relationships)}")
    print(f"📊 已生成文档: {len(documents_to_insert)}")
    print(f"📊 当前阶段: {current_phase}")
    
    # 存储所有数据
    all_nodes = []
    all_relationships = []
    
    # 第一步：读取所有数据
    print("正在读取节点和关系数据...")
    with open(json_file_path, 'r', encoding='utf-8') as f:
        for line in f:
            try:
                item = json.loads(line)
                if item.get("type") == "node":
                    all_nodes.append(item)
                elif item.get("type") == "relationship":
                    all_relationships.append(item)
            except json.JSONDecodeError:
                continue
    
    print(f"读取到 {len(all_nodes)} 个节点和 {len(all_relationships)} 个关系")
    
    # 第二步：处理节点（增强版，包含关系信息）
    if current_phase in ["nodes", "start"]:
        print("\n正在处理节点（包含关系信息）...")
        node_count = 0
        for node in all_nodes:
            node_count += 1
            name = node.get("properties", {}).get("name")
            node_id = node.get("id")
            
            if not name or node_id in processed_nodes:
                continue
                
            # 生成增强的节点文本
            enhanced_text = enhance_node_with_relationships(node, all_relationships, all_nodes)
            if not enhanced_text:
                continue
            
            print(f"[{node_count}/{len(all_nodes)}] 正在处理节点 '{name}'...")
            
            # 生成向量并准备插入
            try:
                embedding = create_embedding_with_retry(enhanced_text)
                documents_to_insert.append({'content': enhanced_text, 'embedding': embedding})
                processed_nodes.add(node_id)
                
                # 每处理5个节点保存一次进度
                if len(processed_nodes) % 5 == 0:
                    save_progress(progress_file, {
                        "processed_nodes": list(processed_nodes),
                        "processed_relationships": list(processed_relationships),
                        "documents": documents_to_insert,
                        "current_phase": "nodes"
                    })
                    print(f"💾 已保存进度，已处理 {len(processed_nodes)} 个节点")
                
                # 随机延迟，避免API限制
                time.sleep(random.uniform(0.5, 1.5))
                
            except Exception as e:
                print(f"    -> ERROR: 处理节点 '{name}' 时发生错误: {e}")
                # 保存当前进度
                save_progress(progress_file, {
                    "processed_nodes": list(processed_nodes),
                    "processed_relationships": list(processed_relationships),
                    "documents": documents_to_insert,
                    "current_phase": "nodes"
                })
                print("🔄 进度已保存，您可以重新运行脚本继续处理")
                return
        
        print(f"✅ 节点处理完成！总共处理了 {len(processed_nodes)} 个节点")
        current_phase = "relationships"
    
    # 第三步：处理重要关系（生成独立的关系描述文本）
    if current_phase in ["relationships", "nodes"]:
        print("\n正在处理重要关系...")
        rel_count = 0
        processed_rel_types = set()
        
        for rel in all_relationships:
            rel_type = rel.get("label")
            rel_id = rel.get("id")
            
            if rel_type == "DEPENDS_ON" and rel_id not in processed_relationships:
                rel_count += 1
                rel_text = generate_relationship_text(rel, all_nodes)
                
                if rel_text:
                    start_name = rel.get("start", {}).get("properties", {}).get("name", "未知")
                    end_name = rel.get("end", {}).get("properties", {}).get("name", "未知")
                    rel_props = rel.get("properties", {})
                    dependency_type = rel_props.get("type", "")
                    processed_rel_types.add(dependency_type)
                    
                    print(f"[关系 {rel_count}] 正在处理关系 '{start_name}' {rel_type} '{end_name}' (类型: {dependency_type})...")
                    
                    try:
                        embedding = create_embedding_with_retry(rel_text)
                        documents_to_insert.append({'content': rel_text, 'embedding': embedding})
                        processed_relationships.add(rel_id)
                        
                        # 每处理20个关系保存一次进度
                        if len(processed_relationships) % 20 == 0:
                            save_progress(progress_file, {
                                "processed_nodes": list(processed_nodes),
                                "processed_relationships": list(processed_relationships),
                                "documents": documents_to_insert,
                                "current_phase": "relationships"
                            })
                            print(f"💾 已保存进度，已处理 {len(processed_relationships)} 个关系")
                        
                        # 随机延迟，避免API限制
                        time.sleep(random.uniform(0.3, 0.8))
                        
                    except Exception as e:
                        print(f"    -> ERROR: 处理关系时发生错误: {e}")
                        # 保存当前进度
                        save_progress(progress_file, {
                            "processed_nodes": list(processed_nodes),
                            "processed_relationships": list(processed_relationships),
                            "documents": documents_to_insert,
                            "current_phase": "relationships"
                        })
                        print("🔄 进度已保存，您可以重新运行脚本继续处理")
                        return
        
        print(f"✅ 关系处理完成！总共处理了 {len(processed_relationships)} 个DEPENDS_ON关系")
        print(f"📊 发现的关系类型: {', '.join(processed_rel_types)}")
        current_phase = "hierarchy"
    
    # 第四步：生成层次结构和类型关系文档
    if current_phase in ["hierarchy", "relationships"]:
        print("\n正在生成层次结构和类型关系文档...")
        hierarchy_docs = generate_hierarchy_and_type_documents(all_nodes, all_relationships)
        
        for i, doc in enumerate(hierarchy_docs):
            try:
                embedding = create_embedding_with_retry(doc)
                documents_to_insert.append({'content': doc, 'embedding': embedding})
                print(f"  生成层次结构文档 {i+1}/{len(hierarchy_docs)}: {doc[:100]}...")
                time.sleep(random.uniform(0.5, 1.0))
            except Exception as e:
                print(f"    -> ERROR: 生成层次结构文档时发生错误: {e}")
        
        print(f"✅ 生成了 {len(hierarchy_docs)} 个层次结构和类型关系文档")
        current_phase = "insert"
    
    # 第五步：分批插入所有数据
    if current_phase in ["insert", "hierarchy"] and documents_to_insert:
        print(f"\n任务完成! 准备将 {len(documents_to_insert)} 个文档分批插入到Supabase...")
        
        # 分批大小
        batch_size = 20  # 进一步减小批次大小
        total_inserted = 0
        
        try:
            # 分批处理
            for i in range(0, len(documents_to_insert), batch_size):
                batch = documents_to_insert[i:i + batch_size]
                batch_num = (i // batch_size) + 1
                total_batches = (len(documents_to_insert) + batch_size - 1) // batch_size
                
                print(f"正在插入第 {batch_num}/{total_batches} 批 ({len(batch)} 条记录)...")
                
                response = supabase.table('ue_documents').insert(batch).execute()
                
                if response.data:
                    total_inserted += len(response.data)
                    print(f"✅ 第 {batch_num} 批插入成功！已累计插入 {total_inserted} 条记录")
                else:
                    print(f"⚠️ 第 {batch_num} 批插入完成，但未返回数据")
                    if hasattr(response, 'error') and response.error:
                        print(f"错误信息: {response.error}")
                
                # 在批次之间稍作停顿
                if i + batch_size < len(documents_to_insert):
                    time.sleep(3)  # 增加延迟
            
            print(f"🎉 所有批次插入完成！总共成功插入 {total_inserted} 条记录。")
            
            # 清理进度文件
            if os.path.exists(progress_file):
                os.remove(progress_file)
                print("🧹 已清理进度文件")
            
        except Exception as e:
            print(f"❌ 批量插入数据库时发生严重错误: {e}")
            print("💡 建议：如果还是超时，可以尝试减小 batch_size 的值")
            # 保存当前进度，以便下次继续
            save_progress(progress_file, {
                "processed_nodes": list(processed_nodes),
                "processed_relationships": list(processed_relationships),
                "documents": documents_to_insert,
                "current_phase": "insert"
            })
    else:
        print("没有找到可以处理的节点数据。")

# 执行主函数
if __name__ == '__main__':
    script_dir = os.path.dirname(os.path.abspath(__file__))
    json_path = os.path.join(script_dir, "unreal_engine_graph.json")
    
    if os.path.exists(json_path):
        migrate_data(json_path)
    else:
        print(f"错误：在指定路径找不到文件 '{json_path}'。") 