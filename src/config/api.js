/**
 * API 配置文件
 * 根据环境自动选择对应的后端地址
 */

// 环境配置
const ENV = {
  // 开发环境（本地）
  DEVELOPMENT: 'development',
  // 测试环境
  TEST: 'test',
  // 生产环境
  PRODUCTION: 'production'
};

// 当前环境（可通过构建脚本或手动修改）
const CURRENT_ENV = ENV.TEST; // 默认使用测试环境

// API 基础地址配置
const API_BASE_URLS = {
  [ENV.DEVELOPMENT]: 'http://localhost:8101',
  [ENV.TEST]: 'https://test-api.example.com',  // 测试环境地址
  [ENV.PRODUCTION]: 'https://api.example.com'   // 生产环境地址
};

// 导出当前环境的 API 配置
export const API_CONFIG = {
  // 当前环境
  ENV: CURRENT_ENV,
  
  // API 基础地址
  BASE_URL: API_BASE_URLS[CURRENT_ENV],
  
  // API 端点
  ENDPOINTS: {
    // 认证相关
    LOGIN: '/auth/login/password',
    REFRESH: '/auth/refresh',
    LOGOUT: '/auth/logout',
    
    // Chrome 数据导入相关
    CHROME_IMPORT: '/api/chrome-data/import',
    CHECK_DUPLICATE: '/api/chrome-data/check-duplicate',
    INFER_REGION: '/api/chrome-data/infer-region',
    CHROME_STATS: '/api/chrome-data/stats/chrome-import',
  },
  
  // 完整 URL 生成函数
  getFullUrl: (endpoint) => {
    return `${API_BASE_URLS[CURRENT_ENV]}${endpoint}`;
  }
};

// 环境名称显示
export const ENV_NAMES = {
  [ENV.DEVELOPMENT]: '开发环境 (本地)',
  [ENV.TEST]: '测试环境',
  [ENV.PRODUCTION]: '生产环境'
};

// 获取当前环境名称
export const getCurrentEnvName = () => {
  return ENV_NAMES[CURRENT_ENV] || '未知环境';
};

