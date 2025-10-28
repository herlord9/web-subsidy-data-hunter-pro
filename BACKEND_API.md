# 后端API接口文档

## 概述

数据猎手专业版扩展会通过POST请求将抓取的数据发送到后端，您只需要实现一个POST接口接收数据数组并批量插入数据库即可。

## 核心接口

### 导出数据接口

**接口路径：** 由用户在扩展配置中指定完整URL

**示例：** `http://localhost:5000/api/export-data`

**请求方法：** POST

**请求头：**
```
Content-Type: application/json
```

**请求体格式（直接是数据数组）：**
```json
[
  {
    "title": "关于耕地地力保护补贴标准的公示",
    "href": "http://example.com/detail/123",
    "location": "吉林省 > 长春市 > 公主岭市"
  },
  {
    "title": "涉农补贴发放通知",
    "href": "http://example.com/detail/124",
    "location": "吉林省 > 长春市 > 公主岭市"
  },
  {
    "title": "政务公开信息",
    "href": "http://example.com/detail/125",
    "location": "吉林省 > 长春市 > 公主岭市"
  }
]
```

**数据结构说明：**
- 请求体是一个数组，包含多条数据记录
- 每条记录包含3个固定字段：
  - `title` (String): 标题文本
  - `href` (String): 完整的URL链接
  - `location` (String): 地理位置信息，格式为 `省 > 市 > 县`，由用户在导出时填写

**Location 字段说明：**
- 扩展会自动提取页面中的地理位置信息（可能不完整）
- 导出时会弹出输入框让用户填写或确认完整的省市县信息
- 同一批导出的所有数据共享相同的 location 值
- 如果不填写，location 可能为空或包含不完整的提取结果

**响应格式（成功）：**
```json
{
  "success": true,
  "count": 2,
  "message": "成功导出 2 条数据"
}
```

**响应格式（失败）：**
```json
{
  "success": false,
  "error": "错误原因描述"
}
```

---

## Python Flask 完整示例

```python
from flask import Flask, request, jsonify
from flask_cors import CORS
import pymysql

app = Flask(__name__)
CORS(app)  # 必须启用CORS，允许跨域

# 数据库配置（在后端固定配置）
DB_CONFIG = {
    'host': 'localhost',
    'port': 3306,
    'user': 'root',
    'password': '123456',
    'database': 'my_db',
    'charset': 'utf8mb4'
}

TABLE_NAME = 'scraped_data'

@app.route('/api/export-data', methods=['POST'])
def export_data():
    try:
        # 接收数据数组
        data = request.json
        
        if not isinstance(data, list):
            return jsonify({
                'success': False,
                'error': '数据格式错误，期望数组'
            })
        
        print(f"接收到 {len(data)} 条数据")
        
        # 连接数据库
        connection = pymysql.connect(**DB_CONFIG)
        cursor = connection.cursor()
        
        # 批量插入数据
        success_count = 0
        for record in data:
            # 动态构建INSERT语句
            columns = ', '.join([f'`{k}`' for k in record.keys()])
            placeholders = ', '.join(['%s'] * len(record))
            values = list(record.values())
            
            sql = f"INSERT INTO `{TABLE_NAME}` ({columns}) VALUES ({placeholders})"
            cursor.execute(sql, values)
            success_count += 1
        
        connection.commit()
        cursor.close()
        connection.close()
        
        print(f"成功插入 {success_count} 条记录")
        
        return jsonify({
            'success': True,
            'count': success_count,
            'message': f'成功导出 {success_count} 条数据'
        })
        
    except Exception as e:
        print(f"错误: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
```

**运行方式：**
```bash
pip install flask flask-cors pymysql
python api_server.py
```

---

## 扩展配置步骤

1. **启动您的后端服务**
   ```bash
   python api_server.py
   # 服务运行在 http://localhost:5000
   ```

2. **在扩展中配置**
   - 打开数据猎手专业版扩展
   - 创建或编辑抓取器配置
   - 在"数据库导出配置"中：
     - 选择数据库类型（MySQL/PostgreSQL/MongoDB）
     - 填写**API接口地址**：`http://localhost:5000/api/export-data`

3. **使用扩展导出数据**
   - 抓取完数据后，点击"导出到数据库"
   - **弹出预览窗口**，显示POST请求的完整内容（直接是数据数组）
   - **用户确认后**，扩展发送POST请求到您的后端
   - 后端接收数据并批量插入到数据库

---

## 请求示例

### 实际发送的HTTP请求

```http
POST http://localhost:5000/api/export-data HTTP/1.1
Content-Type: application/json

[
  {
    "title": "关于耕地地力保护补贴标准的公示",
    "href": "http://example.com/detail/123",
    "location": "吉林省 > 长春市 > 公主岭市"
  },
  {
    "title": "涉农补贴发放通知",
    "href": "http://example.com/detail/124",
    "location": "吉林省 > 长春市 > 公主岭市"
  }
]
```

---

## 注意事项

1. **跨域问题**：必须启用CORS，允许Chrome扩展的请求
2. **数据格式**：请求体直接是数组，不是嵌套对象
3. **错误处理**：确保返回标准的JSON格式响应，必须包含 `success` 字段
4. **性能优化**：
   - 建议使用批量插入而不是逐条插入
   - 使用数据库连接池管理连接
5. **字段动态性**：`data`数组中的字段是动态的，根据抓取的网站不同而不同

---

## 测试API

可以使用curl命令测试：

```bash
curl -X POST http://localhost:5000/api/export-data \
  -H "Content-Type: application/json" \
  -d '[
    {
      "title": "测试标题",
      "title href": "http://test.com",
      "date": "2025-01-15"
    }
  ]'
```

---

## 总结

您的后端：
- ✅ 只需实现一个POST接口
- ✅ 接收数据数组（直接是数组，不是嵌套对象）
- ✅ 批量插入到您的数据库
- ✅ 返回 `{ success: true/false, count: X, message: "..." }` 格式的响应