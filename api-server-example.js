// 简单的API后端服务示例
// 使用: npm install express mysql2 cors
// 启动: node api-server-example.js

const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// 存储数据库连接池
const connectionPools = {};

// 创建数据库连接池
async function createPool(dbType, config) {
  const poolKey = `${config.host}:${config.port}:${config.database}`;
  
  if (connectionPools[poolKey]) {
    return connectionPools[poolKey];
  }
  
  let pool;
  
  if (dbType === 'mysql') {
    pool = mysql.createPool({
      host: config.host,
      port: config.port || 3306,
      user: config.username,
      password: config.password,
      database: config.database,
      waitForConnections: true,
      connectionLimit: 10
    });
  } else {
    throw new Error(`不支持的数据库类型: ${dbType}`);
  }
  
  connectionPools[poolKey] = pool;
  return pool;
}

// 测试数据库连接
app.post('/api/test-connection', async (req, res) => {
  try {
    const { dbType, config } = req.body;
    
    console.log('测试连接:', dbType, config.host);
    
    // 创建连接池
    const pool = await createPool(dbType, config);
    
    // 测试连接
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    
    console.log('✓ 连接成功');
    
    res.json({
      success: true,
      message: `连接成功: ${dbType}://${config.host}:${config.port}/${config.database}`,
      details: {
        dbType,
        host: config.host,
        port: config.port,
        database: config.database
      }
    });
  } catch (error) {
    console.error('✗ 连接失败:', error.message);
    res.json({
      success: false,
      error: error.message
    });
  }
});

// 导出数据到数据库
app.post('/api/export-data', async (req, res) => {
  try {
    const { dbType, config, data } = req.body;
    
    console.log(`导出数据: ${dbType}, ${data.length}条记录`);
    
    // 创建连接池
    const pool = await createPool(dbType, config);
    
    // 获取表的字段（从第一条数据推断）
    const firstRecord = data[0];
    const columns = Object.keys(firstRecord);
    
    // 创建表（如果不存在）
    const columnDefs = columns.map(col => {
      const value = firstRecord[col];
      let sqlType = 'TEXT';
      
      if (typeof value === 'number') {
        sqlType = Number.isInteger(value) ? 'INT' : 'DOUBLE';
      } else if (typeof value === 'boolean') {
        sqlType = 'BOOLEAN';
      } else if (typeof value === 'object') {
        sqlType = 'JSON';
      }
      
      return `\`${col}\` ${sqlType}`;
    }).join(', ');
    
    const createTableSql = `
      CREATE TABLE IF NOT EXISTS \`${config.tableName}\` (
        id INT AUTO_INCREMENT PRIMARY KEY,
        ${columnDefs},
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `;
    
    await pool.query(createTableSql);
    console.log('✓ 表已创建/检查完成');
    
    // 插入数据
    let successCount = 0;
    
    for (const record of data) {
      const cols = Object.keys(record).map(k => `\`${k}\``).join(', ');
      const values = Object.keys(record).map(() => '?').join(', ');
      const vals = Object.values(record);
      
      await pool.query(
        `INSERT INTO \`${config.tableName}\` (${cols}) VALUES (${values})`,
        vals
      );
      successCount++;
    }
    
    console.log(`✓ 成功插入 ${successCount} 条记录`);
    
    res.json({
      success: true,
      count: successCount,
      message: `成功导出 ${successCount} 条数据到表 ${config.tableName}`
    });
    
  } catch (error) {
    console.error('✗ 导出失败:', error.message);
    res.json({
      success: false,
      error: error.message
    });
  }
});

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 API服务启动在 http://localhost:${PORT}`);
  console.log(`📝 健康检查: http://localhost:${PORT}/health`);
});

