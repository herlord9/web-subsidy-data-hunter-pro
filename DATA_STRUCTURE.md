# 后端接收的数据结构

## 完整数据结构

### HTTP 请求

**方法：** POST

**URL：** 由用户在扩展配置中指定（例如：`http://localhost:5000/api/export-data`）

**请求头：**
```
Content-Type: application/json
```

**请求体：**
```json
[
  {
    "title": "关于耕地地力保护补贴标准的公示",
    "href": "http://www.chaonan.gov.cn/stscnqnyncjgkml/stscnqnyncjgkml/zwgk/xczxxxgk/snbt/content/post_2421678.html",
    "location": "吉林省 > 长春市 > 公主岭市"
  },
  {
    "title": "涉农补贴发放通知",
    "href": "http://www.chaonan.gov.cn/cn/zdlyxxgk/fpgzxxgk/snbt/content/post_2421680.html",
    "location": "吉林省 > 长春市 > 公主岭市"
  },
  {
    "title": "政务公开信息",
    "href": "http://example.com/detail/125",
    "location": "吉林省 > 长春市 > 公主岭市"
  }
]
```

## 字段说明

### title (String, 必填)
- **说明：** 数据标题
- **示例：** "关于耕地地力保护补贴标准的公示"
- **来源：** 从网页抓取的标题文本

### href (String, 必填)
- **说明：** 完整的URL链接（绝对路径）
- **示例：** "http://www.chaonan.gov.cn/stscnqnyncjgkml/stscnqnyncjgkml/zwgk/xczxxxgk/snbt/content/post_2421678.html"
- **来源：** 从网页抓取的链接地址

### location (String, 可选)
- **说明：** 地理位置信息，格式为 `省 > 市 > 县`
- **示例：** "吉林省 > 长春市 > 公主岭市"
- **来源：** 
  - 扩展自动提取（可能不完整，如只有 "公主岭市"）
  - 用户手动填写（完整的三级路径）
- **特点：** 同一批导出的所有数据共享相同的 location 值

## Location 字段详解

### 提取策略

扩展会自动尝试从网页提取地理位置信息：

1. **完整格式**：`吉林省 > 长春市 > 公主岭市`
2. **部分格式**：`公主岭市` 或 `长春市 > 公主岭市`
3. **提取不到**：`null` 或空字符串

### 用户输入

导出时会弹出输入框：

```
┌─────────────────────────────────┐
│ 📍 填写地理位置信息              │
├─────────────────────────────────┤
│ 例如：吉林省 > 长春市 > 公主岭市 │
│ [________________________]       │
│                                  │
│ 提示：如果不填写，将使用网页提取│
│ 的内容（可能不完整）             │
│                                  │
│     [取消]  [确认并导出]         │
└─────────────────────────────────┘
```

- 自动填充：如果有提取到的内容，会自动填充到输入框
- 用户修改：可以编辑或完全重新输入
- 留空：如果不填写，会使用提取到的内容（可能不完整）

### 后端处理建议

后端可以根据 location 的情况进行处理：

```python
def process_location(location_str):
    if not location_str:
        # 如果没有 location，可以标记为未分类
        return None
    
    # 检查是否完整
    if location_str.count(' > ') == 2:
        # 完整的三级路径
        parts = location_str.split(' > ')
        return {
            'province': parts[0],  # 吉林省
            'city': parts[1],      # 长春市
            'district': parts[2]   # 公主岭市
        }
    
    # 不完整的路径，可以尝试补齐
    # 例如："公主岭市" -> 查询数据库 -> "吉林省 > 长春市 > 公主岭市"
    return enhance_location(location_str)
```

## 实际示例

### 示例 1：完整数据

```json
{
  "title": "关于印发《农安县2024年耕地地力保护补贴实施方案》的通知",
  "href": "http://www.nongan.gov.cn/zw/xxgkzdly/snbt/202405/t20240528_3311926.html",
  "location": "吉林省 > 长春市 > 农安县"
}
```

### 示例 2：Location 为空

```json
{
  "title": "农科总站全力做好备春耕技术指导",
  "href": "http://example.com/news/12345",
  "location": ""
}
```

### 示例 3：Location 不完整

```json
{
  "title": "政务动态",
  "href": "http://example.com/detail/999",
  "location": "公主岭市"
}
```

## Python 处理示例

```python
from flask import Flask, request, jsonify
import re

app = Flask(__name__)

def extract_location_parts(location_str):
    """提取 location 的各个部分"""
    if not location_str:
        return {'province': None, 'city': None, 'district': None}
    
    # 分割
    parts = location_str.split(' > ')
    
    if len(parts) == 3:
        return {
            'province': parts[0],
            'city': parts[1],
            'district': parts[2]
        }
    elif len(parts) == 2:
        # 可能是 市 > 县 或 省 > 市
        if '省' in parts[0]:
            return {
                'province': parts[0],
                'city': parts[1],
                'district': None
            }
        else:
            return {
                'province': None,
                'city': parts[0],
                'district': parts[1]
            }
    elif len(parts) == 1:
        # 只有一个，需要判断是省、市还是县
        if '省' in parts[0]:
            return {'province': parts[0], 'city': None, 'district': None}
        elif '市' in parts[0]:
            return {'province': None, 'city': parts[0], 'district': None}
        elif any(x in parts[0] for x in ['县', '区', '州']):
            return {'province': None, 'city': None, 'district': parts[0]}
    
    return {'province': None, 'city': None, 'district': None}

@app.route('/api/export-data', methods=['POST'])
def export_data():
    try:
        data = request.json
        
        if not isinstance(data, list):
            return jsonify({
                'success': False,
                'error': '数据格式错误，期望数组'
            })
        
        processed_data = []
        
        for record in data:
            # 提取 location 信息
            location_parts = extract_location_parts(record.get('location', ''))
            
            # 补充到数据中
            processed_record = {
                'title': record.get('title', ''),
                'href': record.get('href', ''),
                'province': location_parts['province'],
                'city': location_parts['city'],
                'district': location_parts['district'],
                'location_raw': record.get('location', '')
            }
            
            processed_data.append(processed_record)
        
        # 在这里可以进一步处理：
        # 1. 补齐缺失的省市信息
        # 2. 查询数据库验证地理信息
        # 3. 插入到数据库
        
        return jsonify({
            'success': True,
            'count': len(processed_data),
            'message': f'成功处理 {len(processed_data)} 条数据'
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        })
```

## 总结

- **请求体**：直接是数组，无需嵌套对象
- **数据量**：根据用户选择的记录数决定
- **location**：用户可选填，不完整时可留空由后端补齐
- **数据结构**：简单、清晰，只包含必要字段

