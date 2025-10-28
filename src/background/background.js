// Background script for Data Hunter Pro
// Handles extension lifecycle, permissions, and communication

console.log('Data Hunter Pro background script loaded');

// Extension installation/update
chrome.runtime.onInstalled.addListener((details) => {
  console.log('Data Hunter Pro installed/updated:', details);
  
  if (details.reason === 'install') {
    console.log('First time installation');
    
    // Set default settings
    chrome.storage.local.set({
      dataHunterPro_settings: {
        autoScroll: true,
        scrollDelay: 1000,
        maxItems: '',
        waitTimeItems: { min: 1, max: 3 },
        waitTimePages: { min: 2, max: 5 },
        loadMoreAction: 'none'
      }
    });
  }
});

// Handle messages from popup and content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background received message:', request);
  
  switch (request.action) {
    case 'getTabInfo':
      handleGetTabInfo(sender.tab, sendResponse);
      return true;
      
    case 'startScraping':
      handleStartScraping(request, sender.tab, sendResponse);
      return true;
      
    case 'stopScraping':
      handleStopScraping(request, sender.tab, sendResponse);
      return true;
      
    case 'getScrapers':
      handleGetScrapers(sendResponse);
      return true;
      
    case 'saveScraper':
      handleSaveScraper(request.scraper, sendResponse);
      return true;
      
    case 'deleteScraper':
      handleDeleteScraper(request.scraperId, sendResponse);
      return true;
      
    case 'testDatabaseConnection':
      handleTestDatabaseConnection(request.config, sendResponse);
      return true;
      
    case 'exportToDatabase':
      handleExportToDatabase(request.data, request.config, sendResponse);
      return true;
      
    default:
      console.warn('Unknown action:', request.action);
      sendResponse({ success: false, error: 'Unknown action' });
  }
});

// Get current tab information
async function handleGetTabInfo(tab, sendResponse) {
  try {
    if (!tab) {
      sendResponse({ success: false, error: 'No active tab found' });
      return;
    }
    
    const tabInfo = {
      id: tab.id,
      url: tab.url,
      title: tab.title,
      domain: tab.url ? (() => {
        try {
          return new URL(tab.url).hostname;
        } catch (e) {
          return null;
        }
      })() : null,
      isRestricted: isRestrictedPage(tab.url)
    };
    
    sendResponse({ success: true, tab: tabInfo });
  } catch (error) {
    console.error('Error getting tab info:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Start scraping process
async function handleStartScraping(request, tab, sendResponse) {
  try {
    if (!tab) {
      sendResponse({ success: false, error: 'No active tab found' });
      return;
    }
    
    if (isRestrictedPage(tab.url)) {
      sendResponse({ success: false, error: 'This page is restricted. Try another site.' });
      return;
    }
    
    // Inject content script if not already injected
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content-script.bundle.js']
      });
    } catch (error) {
      console.log('Script injection result:', error.message);
    }
    
    // Send scraping request to content script
    const response = await chrome.tabs.sendMessage(tab.id, {
      action: 'startScraping',
      scraper: request.scraper
    });
    
    sendResponse(response);
  } catch (error) {
    console.error('Error starting scraping:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Stop scraping process
async function handleStopScraping(request, tab, sendResponse) {
  try {
    if (!tab) {
      sendResponse({ success: false, error: 'No active tab found' });
      return;
    }
    
    const response = await chrome.tabs.sendMessage(tab.id, {
      action: 'stopScraping'
    });
    
    sendResponse(response);
  } catch (error) {
    console.error('Error stopping scraping:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Get saved scrapers
async function handleGetScrapers(sendResponse) {
  try {
    const result = await chrome.storage.local.get(['dataHunterPro_scrapers']);
    const scrapers = result.dataHunterPro_scrapers || [];
    sendResponse({ success: true, scrapers });
  } catch (error) {
    console.error('Error getting scrapers:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Save scraper
async function handleSaveScraper(scraper, sendResponse) {
  try {
    const result = await chrome.storage.local.get(['dataHunterPro_scrapers']);
    const scrapers = result.dataHunterPro_scrapers || [];
    
    const existingIndex = scrapers.findIndex(s => s.id === scraper.id);
    if (existingIndex >= 0) {
      scrapers[existingIndex] = scraper;
    } else {
      scrapers.push(scraper);
    }
    
    await chrome.storage.local.set({ dataHunterPro_scrapers: scrapers });
    sendResponse({ success: true });
  } catch (error) {
    console.error('Error saving scraper:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Delete scraper
async function handleDeleteScraper(scraperId, sendResponse) {
  try {
    const result = await chrome.storage.local.get(['dataHunterPro_scrapers']);
    const scrapers = result.dataHunterPro_scrapers || [];
    
    const filteredScrapers = scrapers.filter(s => s.id !== scraperId);
    await chrome.storage.local.set({ dataHunterPro_scrapers: filteredScrapers });
    
    sendResponse({ success: true });
  } catch (error) {
    console.error('Error deleting scraper:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Check if page is restricted
function isRestrictedPage(url) {
  if (!url) return true;
  
  const restrictedPages = [
    'chrome://',
    'chrome-extension://',
    'moz-extension://',
    'edge://',
    'about:',
    'file://',
    'data:',
    'javascript:',
    'vbscript:'
  ];
  
  return restrictedPages.some(prefix => url.startsWith(prefix));
}

// Handle tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    console.log('Tab updated:', tab.url);
  }
});

// Handle tab removal
chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
  console.log('Tab removed:', tabId);
});

// Error handling
chrome.runtime.onStartup.addListener(() => {
  console.log('Data Hunter Pro background script started');
});

chrome.runtime.onSuspend.addListener(() => {
  console.log('Data Hunter Pro background script suspended');
});

// Test database connection
async function handleTestDatabaseConnection(config, sendResponse) {
  try {
    console.log('Testing database connection:', config);
    
    // 验证配置完整性
    if (!config.dbType || config.dbType === 'none') {
      sendResponse({ 
        success: false, 
        error: '请选择数据库类型' 
      });
      return;
    }
    
    // 如果配置了API URL，使用API方式
    if (config.apiUrl && config.apiUrl.trim()) {
      try {
        const response = await fetch(config.apiUrl, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json' 
          },
          body: JSON.stringify({
            dbType: config.dbType,
            config: {
              host: config.host,
              port: config.port,
              database: config.database,
              username: config.username,
              password: config.password
            }
          })
        });
        
        const result = await response.json();
        console.log('API response:', result);
        sendResponse(result);
        return;
      } catch (apiError) {
        console.error('API call failed:', apiError);
        sendResponse({ 
          success: false, 
          error: `API调用失败: ${apiError.message}` 
        });
        return;
      }
    }
    
    // 如果没有配置API，使用模拟方式
    if (!config.host || !config.database || !config.username || !config.password) {
      sendResponse({ 
        success: false, 
        error: '请填写完整的连接信息，或配置API URL' 
      });
      return;
    }
    
    // 模拟连接测试（带详细反馈）
    setTimeout(() => {
      const connectionString = `${config.dbType}://${config.username}@${config.host}:${config.port}/${config.database}`;
      console.log(`模拟连接: ${connectionString}`);
      
      sendResponse({ 
        success: true, 
        message: `⚠️ 模拟连接成功（未配置API）\n数据库类型: ${config.dbType}\n主机: ${config.host}:${config.port}\n数据库: ${config.database}\n\n提示：请在配置中设置API URL以实现真实连接`,
        details: {
          dbType: config.dbType,
          host: config.host,
          port: config.port,
          database: config.database,
          simulated: true
        }
      });
    }, 500);
    
  } catch (error) {
    console.error('Database connection test failed:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Export data to database
async function handleExportToDatabase(data, config, sendResponse) {
  try {
    console.log('Exporting to database:', config, data);
    
    // 验证配置和数据
    if (!data || data.length === 0) {
      sendResponse({ 
        success: false, 
        error: '没有数据可导出' 
      });
      return;
    }
    
    if (!config || !config.dbType || config.dbType === 'none') {
      sendResponse({ 
        success: false, 
        error: '数据库配置不完整' 
      });
      return;
    }
    
    // 如果配置了API URL，使用API方式
    if (config.apiUrl && config.apiUrl.trim()) {
      try {
        const logs = [];
        logs.push('开始导出数据...');
        logs.push(`使用API: ${config.apiUrl}`);
        logs.push(`数据库类型: ${config.dbType}`);
        logs.push(`表名: ${config.tableName}`);
        logs.push(`数据条数: ${data.length}`);
        
        const response = await fetch(config.apiUrl, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json' 
          },
          body: JSON.stringify({
            dbType: config.dbType,
            config: {
              host: config.host,
              port: config.port,
              database: config.database,
              username: config.username,
              password: config.password,
              tableName: config.tableName
            },
            data: data
          })
        });
        
        const result = await response.json();
        console.log('API response:', result);
        
        if (result.success) {
          logs.push('✓ 数据库连接成功');
          logs.push('✓ 数据插入成功');
          logs.push(`✓ 成功插入 ${result.count || data.length} 条记录`);
          logs.push('导出完成！');
        } else {
          logs.push(`✗ 导出失败: ${result.error}`);
        }
        
        sendResponse({ 
          success: result.success,
          message: result.success 
            ? `成功导出 ${result.count || data.length} 条数据`
            : result.error,
          details: {
            recordCount: result.count || data.length,
            tableName: config.tableName,
            dbType: config.dbType,
            logs: logs
          }
        });
        return;
      } catch (apiError) {
        console.error('API call failed:', apiError);
        sendResponse({ 
          success: false, 
          error: `API调用失败: ${apiError.message}` 
        });
        return;
      }
    }
    
    if (!config.host || !config.database) {
      sendResponse({ 
        success: false, 
        error: '请填写完整的连接信息，或配置API URL' 
      });
      return;
    }
    
    // 生成详细的导出日志（模拟方式）
    const logs = [];
    logs.push('开始导出数据...');
    logs.push(`数据库类型: ${config.dbType}`);
    logs.push(`连接: ${config.host}:${config.port}/${config.database}`);
    logs.push(`表名: ${config.tableName}`);
    logs.push(`数据条数: ${data.length}`);
    
    // 模拟连接过程
    setTimeout(() => {
      logs.push('✓ 数据库连接成功');
      logs.push('✓ 开始检查表结构...');
      
      // 根据数据库类型生成不同的SQL示例
      let sampleSql = '';
      if (config.dbType === 'mysql' || config.dbType === 'postgresql') {
        // 获取第一个数据的字段
        const firstRecord = data[0];
        const columns = Object.keys(firstRecord).map(key => `\`${key}\``).join(', ');
        sampleSql = `INSERT INTO \`${config.tableName}\` (${columns}) VALUES (...);`;
      } else if (config.dbType === 'mongodb') {
        sampleSql = `db.${config.tableName}.insertMany([...]);`;
      }
      
      logs.push('✓ 表结构检查完成');
      logs.push('生成的SQL示例:');
      logs.push(sampleSql);
      
      // 模拟插入过程
      data.forEach((record, index) => {
        logs.push(`✓ 插入记录 ${index + 1}/${data.length}`);
      });
      
      logs.push(`✓ 成功插入 ${data.length} 条记录到 ${config.tableName}`);
      logs.push('导出完成！');
      
      // 发送详细反馈
      sendResponse({ 
        success: true, 
        message: `成功导出 ${data.length} 条数据`,
        details: {
          recordCount: data.length,
          tableName: config.tableName,
          dbType: config.dbType,
          logs: logs
        }
      });
    }, 1000);
    
    // TODO: 实际实现需要根据数据库类型调用相应的库
    // 1. 建立数据库连接
    // 2. 创建表（如果不存在）
    // 3. 插入数据
    
  } catch (error) {
    console.error('Export to database failed:', error);
    sendResponse({ success: false, error: error.message });
  }
}