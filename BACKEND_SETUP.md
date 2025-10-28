# 数据库后端实现方案

## 当前状态

⚠️ **当前数据库连接是模拟的，不会真正连接数据库。**

## 为什么需要后端？

Chrome扩展运行在浏览器沙箱中，由于安全限制：
- ❌ 无法直接连接外部数据库
- ❌ 无法使用Node.js的数据库驱动（mysql、pg、mongodb等）
- ✅ 需要通过HTTP API与后端服务通信

## 实现方案

### 方案1：Node.js后端服务（推荐）

#### 1. 创建后端服务
```bash
mkdir easy-scraper-backend
cd easy-scraper-backend
npm init -y
npm install express mysql2 pg mongodb cors
```

#### 2. 后端服务代码（server.js）
```javascript
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const app = express();

app.use(cors());
app.use(express.json());

// 连接MySQL
async function connectMySQL(config) {
  return mysql.createConnection({
    host: config.host,
    port: config.port || 3306,
    user: config.username,
    password: config.password,
    database: config.database
  });
}

// 测试连接
app.post('/api/test-connection', async (req, res) => {
  try {
    const { dbType, config } = req.body;
    // 根据 dbType 连接相应数据库
    // 返回连接结果
    res.json({ success: true });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

// 导出数据
app.post('/api/export-data', async (req, res) => {
  try {
    const { config, data } = req.body;
    // 执行数据插入
    // 返回插入结果
    res.json({ success: true, count: data.length });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

app.listen(3000, () => {
  console.log('Backend service running on http://localhost:3000');
});
```

#### 3. 修改扩展的 background.js

```javascript
// 在 handleTestDatabaseConnection 中
async function handleTestDatabaseConnection(config, sendResponse) {
  try {
    // 调用后端API
    const response = await fetch('http://localhost:3000/api/test-connection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dbType: config.dbType, config })
    });
    
    const result = await response.json();
    sendResponse(result);
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}
```

#### 4. 启动后端服务
```bash
node server.js
```

#### 5. 配置扩展
在扩展的数据库配置中添加：
```
后端API地址: http://localhost:3000
```

### 方案2：使用云服务API

可以使用现成的云数据库服务：
- Firebase
- Supabase
- AWS RDS
- 阿里云RDS

这些服务提供REST API，可以直接从扩展调用。

## 需要我帮您实现吗？

请告诉我：
1. 您是否有后端开发经验？
2. 您希望使用哪种数据库？
3. 数据是存储在哪里（本地/云端）？

我可以帮您：
- ✅ 创建完整的后端服务代码
- ✅ 实现真实的数据插入逻辑
- ✅ 修改扩展与后端通信
- ✅ 添加错误处理和重试机制
