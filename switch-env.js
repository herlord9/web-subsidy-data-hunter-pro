#!/usr/bin/env node

/**
 * 环境切换脚本
 * 用法: node switch-env.js [test|dev|prod]
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const CONFIG_FILE = path.join(__dirname, 'src', 'config', 'api.js');

const ENVIRONMENTS = {
  test: 'TEST',
  dev: 'DEVELOPMENT',
  prod: 'PRODUCTION'
};

const ENV_NAMES = {
  test: '测试环境',
  dev: '开发环境',
  prod: '生产环境'
};

function switchEnvironment(env) {
  if (!ENVIRONMENTS[env]) {
    console.error(`❌ 无效的环境: ${env}`);
    console.log('可用环境: test, dev, prod');
    process.exit(1);
  }

  try {
    // 读取配置文件
    let content = fs.readFileSync(CONFIG_FILE, 'utf8');

    // 替换 CURRENT_ENV 的值
    const regex = /const CURRENT_ENV = ENV\.\w+;/;
    const newLine = `const CURRENT_ENV = ENV.${ENVIRONMENTS[env]};`;
    content = content.replace(regex, newLine);

    // 写回文件
    fs.writeFileSync(CONFIG_FILE, content, 'utf8');

    console.log(`✅ 已切换到 ${ENV_NAMES[env]}`);
    console.log(`📝 配置文件已更新: ${CONFIG_FILE}`);

    // 自动编译
    console.log('🔨 开始编译...');
    execSync('npm run build', { stdio: 'inherit' });

    console.log('✅ 编译完成！');
    console.log('💡 提示: 请在浏览器中重新加载扩展');
  } catch (error) {
    console.error('❌ 切换失败:', error.message);
    process.exit(1);
  }
}

// 主逻辑
const args = process.argv.slice(2);

if (args.length === 0) {
  console.log('🔧 环境切换工具');
  console.log('');
  console.log('用法: node switch-env.js [test|dev|prod]');
  console.log('');
  console.log('可用环境:');
  console.log('  test - 测试环境 (https://test-api.example.com)');
  console.log('  dev  - 开发环境 (http://localhost:8101)');
  console.log('  prod - 生产环境 (https://api.example.com)');
  process.exit(0);
}

const targetEnv = args[0].toLowerCase();
switchEnvironment(targetEnv);

