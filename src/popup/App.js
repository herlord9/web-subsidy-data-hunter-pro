import React, { useState, useEffect } from 'react';
import { ScraperList } from './components/ScraperList';
import { ScraperForm } from './components/ScraperForm';
import { DataTable } from './components/DataTable';
import { LoadingSpinner } from './components/LoadingSpinner';
import { ErrorMessage } from './components/ErrorMessage';
// ========== Login 组件导入已注释 - 登录验证已禁用 ==========
// import { Login } from './components/Login';
import { useScrapers } from './hooks/useScrapers';
import { useCurrentTab } from './hooks/useCurrentTab';
import { useAuth } from './hooks/useAuth';
import './styles.css';

function App() {
  const [currentView, setCurrentView] = useState('list'); // 'list', 'form', 'table', 'selectList'
  const [selectedScraper, setSelectedScraper] = useState(null);
  const [scrapedData, setScrapedData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [listOptions, setListOptions] = useState([]);
  const [selectedListSelector, setSelectedListSelector] = useState(null);
  
  const { scrapers, addScraper, updateScraper, deleteScraper } = useScrapers();
  const { currentTab, isValidTab } = useCurrentTab();
  const { isAuthenticated, userInfo, isLoading: authLoading, sessionExpired, logout, checkAuthStatus } = useAuth();

  // 检查当前标签页是否有效
  useEffect(() => {
    if (!isValidTab) {
      setError('此页面受限，请尝试其他网站。');
    } else {
      setError(null);
    }
  }, [isValidTab]);

  // 监听从 content script 返回的容器选择消息
  useEffect(() => {
    const messageListener = (message, sender, sendResponse) => {
      if (message.action === 'containerSelected') {
        handleContainerSelected(message.selector);
      }
    };

    chrome.runtime.onMessage.addListener(messageListener);
    
    // 同时监听 storage 变化（作为备用方案）
    const storageListener = (changes) => {
      if (changes.selectedContainer && currentView === 'selectList') {
        handleContainerSelected(changes.selectedContainer.newValue);
      }
    };
    chrome.storage.onChanged.addListener(storageListener);
    
    return () => {
      chrome.runtime.onMessage.removeListener(messageListener);
      chrome.storage.onChanged.removeListener(storageListener);
    };
  }, [currentTab, selectedScraper, currentView]);

  const handleContainerSelected = async (selector) => {
    setIsLoading(true);
    
    // 使用选中的 selector 开始抓取
    chrome.tabs.sendMessage(currentTab.id, {
      action: 'startScraping',
      scraper: selectedScraper,
      selector: selector
    }).then(response => {
      if (response && response.success) {
        setScrapedData(response.data);
        setCurrentView('table');
      } else {
        setError(response?.error || '抓取失败');
      }
    }).catch(err => {
      console.error('Scraping error:', err);
      setError('无法与页面通信，请刷新页面后重试。');
    }).finally(() => {
      setIsLoading(false);
    });
    
    // 清除 storage 中的 selector
    chrome.storage.local.remove('selectedContainer');
  };

  const handleNewScraper = () => {
    setSelectedScraper(null);
    setCurrentView('form');
  };

  const handleEditScraper = (scraper) => {
    setSelectedScraper(scraper);
    setCurrentView('form');
  };

  const handleScraperSaved = (scraper) => {
    if (selectedScraper) {
      updateScraper(scraper);
    } else {
      addScraper(scraper);
    }
    setCurrentView('list');
  };

  const handleStartScraping = async (scraper) => {
    setIsLoading(true);
    setError(null);
    
    try {
      // 方法1: 先通过 background 触发注入，再直接发送消息
      try {
        // 尝试先注入 script
        await chrome.scripting.executeScript({
          target: { tabId: currentTab.id },
          files: ['content-script.bundle.js']
        });
        console.log('Content script injected successfully');
      } catch (injectError) {
        console.log('Script may already be injected, continuing...');
      }
      
      // 等待一小段时间确保 script 加载
      await new Promise(resolve => setTimeout(resolve, 100));

      // 1. 先获取页面上所有可能的列表选项
      const optionsResponse = await chrome.tabs.sendMessage(currentTab.id, {
        action: 'getListOptions'
      });

      if (optionsResponse && optionsResponse.options && optionsResponse.options.length > 1) {
        // 如果找到多个列表，在弹窗中显示选择界面
        setListOptions(optionsResponse.options);
        setSelectedScraper(scraper);
        setCurrentView('selectList');
        setIsLoading(false);
        return;
      }

      // 2. 只有一个或没有选项，直接开始抓取（使用默认容器）
      const selector = optionsResponse?.options?.[0]?.selector || null;
      
      // 发送消息到 content script
      const response = await chrome.tabs.sendMessage(currentTab.id, {
        action: 'startScraping',
        scraper: scraper,
        selector: selector
      });

      if (response && response.success) {
        setScrapedData(response.data);
        setCurrentView('table');
      } else {
        setError(response?.error || '抓取失败');
      }
    } catch (err) {
      console.error('Scraping error:', err);
      setError('无法与页面通信，请刷新页面后重试。');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToList = () => {
    setCurrentView('list');
    setScrapedData([]);
    setError(null);
  };

  const handleSwitchContainer = async () => {
    try {
      // 获取页面上所有可能的列表选项
      const optionsResponse = await chrome.tabs.sendMessage(currentTab.id, {
        action: 'getListOptions'
      });

      if (optionsResponse && optionsResponse.options && optionsResponse.options.length > 1) {
        // 如果有多个容器，显示选择界面
        setListOptions(optionsResponse.options);
        setCurrentView('selectList');
      } else {
        // 如果只有一个容器，直接显示没有其他选择
        alert('页面上只有一个容器，无法切换。');
      }
    } catch (err) {
      console.error('Switch container error:', err);
      alert('无法获取容器列表，请刷新页面后重试。');
    }
  };

  const handleBackToForm = () => {
    setCurrentView('form');
  };

  const handleListSelected = async (selector) => {
    setIsLoading(true);
    setError(null);
    setSelectedListSelector(selector);

    try {
      // 发送消息到 content script，使用选中的选择器
      const response = await chrome.tabs.sendMessage(currentTab.id, {
        action: 'startScraping',
        scraper: selectedScraper,
        selector: selector
      });

      if (response && response.success) {
        setScrapedData(response.data);
        setCurrentView('table');
      } else {
        setError(response?.error || '抓取失败');
      }
    } catch (err) {
      console.error('Scraping error:', err);
      setError('无法与页面通信，请刷新页面后重试。');
    } finally {
      setIsLoading(false);
    }
  };

  // ========== 登录相关处理函数已注释 ==========
  // const handleLoginSuccess = (data) => {
  //   console.log('登录成功，用户信息:', data.user);
  //   checkAuthStatus();
  // };

  // const handleLogout = () => {
  //   logout();
  //   setCurrentView('list');
  //   setScrapedData([]);
  // };

  // 处理添加搜索关键词选择器
  const handleAddSearchKeywordHelper = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await chrome.tabs.sendMessage(currentTab.id, {
        action: 'addSearchKeywordHelper'
      });

      if (response && response.success) {
        alert(`✅ ${response.message}\n\n找到 ${response.count} 个搜索框`);
      } else {
        setError(response?.error || '添加关键词选择器失败');
      }
    } catch (err) {
      console.error('添加关键词选择器错误:', err);
      setError('无法与页面通信，请刷新页面后重试。');
    } finally {
      setIsLoading(false);
    }
  };

  // ========== 登录验证已禁用 - 以下代码已注释 ==========
  // // 如果正在检查登录状态
  // if (authLoading) {
  //   return (
  //     <div className="app">
  //       <div className="header">
  //         <h1>数据猎手专业版</h1>
  //       </div>
  //       <LoadingSpinner message="正在加载..." />
  //     </div>
  //   );
  // }

  // // 如果未登录，显示登录页面
  // if (!isAuthenticated) {
  //   return (
  //     <div className="app">
  //       <div className="header">
  //         <h1>数据猎手专业版</h1>
  //       </div>
  //       <Login 
  //         onLoginSuccess={handleLoginSuccess} 
  //         sessionExpired={sessionExpired}
  //       />
  //     </div>
  //   );
  // }

  if (isLoading) {
    return (
      <div className="app">
        <div className="header">
          <h1>数据猎手专业版</h1>
        </div>
        <LoadingSpinner message="正在抓取数据..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="app">
        <div className="header">
          <h1>数据猎手专业版</h1>
        </div>
        <ErrorMessage message={error} onRetry={() => setError(null)} />
      </div>
    );
  }

  const handleClose = () => {
    window.close();
  };

  return (
    <div className="app">
      <div className="header">
        <h1>数据猎手专业版</h1>
        <div className="header-buttons">
          {/* ========== 用户信息和退出按钮已注释 - 登录验证已禁用 ========== */}
          {/* {userInfo && (
            <span className="user-info" style={{ 
              marginRight: '12px', 
              fontSize: '12px', 
              color: '#6c757d',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              👤 {userInfo.username}
              <button 
                onClick={handleLogout}
                style={{
                  padding: '4px 8px',
                  fontSize: '11px',
                  background: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                退出
              </button>
            </span>
          )} */}
          {currentView !== 'list' && (
            <button 
              className="back-button"
              onClick={currentView === 'form' ? handleBackToList : handleBackToForm}
            >
              ← 返回
            </button>
          )}
          <button 
            className="close-button"
            onClick={handleClose}
            title="关闭"
          >
            ×
          </button>
        </div>
      </div>

      <div className="content">
        {currentView === 'list' && (
          <>
            <div style={{ marginBottom: '12px', padding: '12px', background: '#f8f9fa', borderRadius: '6px' }}>
              <button
                onClick={handleAddSearchKeywordHelper}
                style={{
                  width: '100%',
                  padding: '10px',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transition: 'all 0.3s'
                }}
                onMouseEnter={(e) => {
                  e.target.style.transform = 'scale(1.02)';
                  e.target.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.transform = 'scale(1)';
                  e.target.style.boxShadow = 'none';
                }}
              >
                <span style={{ fontSize: '16px' }}>🔍</span>
                识别搜索框并添加关键词快捷选择
              </button>
              <div style={{ marginTop: '8px', fontSize: '11px', color: '#6c757d', textAlign: 'center' }}>
                点击后会在页面的搜索框上方添加快捷关键词按钮，刷新页面后失效
              </div>
            </div>
            <ScraperList
              scrapers={scrapers}
              onNewScraper={handleNewScraper}
              onEditScraper={handleEditScraper}
              onDeleteScraper={deleteScraper}
              onStartScraping={handleStartScraping}
              currentTab={currentTab}
            />
          </>
        )}

        {currentView === 'form' && (
          <ScraperForm
            scraper={selectedScraper}
            onSave={handleScraperSaved}
            onCancel={handleBackToList}
            currentTab={currentTab}
          />
        )}

        {currentView === 'table' && (
          <DataTable
            data={scrapedData}
            scraper={selectedScraper}
            onBack={handleBackToList}
            onSwitchContainer={handleSwitchContainer}
          />
        )}

        {currentView === 'selectList' && (
          <div>
            <div className="card">
              <h3>请选择要抓取的列表</h3>
              <p style={{ fontSize: '12px', color: '#6c757d', marginBottom: '16px' }}>
                检测到页面上有 {listOptions.length} 个可能的列表，请选择要抓取的内容：
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {listOptions.map((option, index) => (
                  <div
                    key={index}
                    className="card"
                    style={{
                      textAlign: 'left',
                      padding: '12px',
                      border: option.iframeUrl ? '2px solid #ffc107' : '1px solid #e9ecef',
                      borderRadius: '6px',
                      background: 'white'
                    }}
                  >
                    <div style={{ fontWeight: '600', marginBottom: '4px', color: '#495057' }}>
                      {option.type} {option.itemCount >= 0 ? `- ${option.itemCount} 项` : ''}
                    </div>
                    <div style={{ fontSize: '12px', color: '#6c757d', marginBottom: '4px' }}>
                      {option.preview}
                    </div>
                    <div style={{ fontSize: '11px', color: '#adb5bd', fontFamily: 'monospace', marginBottom: '8px' }}>
                      {option.selector}
                    </div>
                    
                    {option.iframeUrl && (
                      <div style={{ 
                        background: '#fff3cd', 
                        border: '1px solid #ffc107', 
                        borderRadius: '4px', 
                        padding: '8px',
                        marginTop: '8px'
                      }}>
                        <div style={{ fontSize: '12px', color: '#856404', marginBottom: '4px' }}>
                          ⚠️ 此数据在框架内（跨域），无法直接抓取
                        </div>
                        <button
                          onClick={() => window.open(option.iframeUrl, '_blank')}
                          style={{
                            padding: '6px 12px',
                            background: '#667eea',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px'
                          }}
                        >
                          🔗 在新标签页打开（推荐）
                        </button>
                      </div>
                    )}
                    
                    {!option.iframeUrl && (
                      <button
                        onClick={() => handleListSelected(option.selector)}
                        style={{
                          width: '100%',
                          padding: '8px',
                          background: '#667eea',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '13px',
                          fontWeight: '600'
                        }}
                      >
                        抓取此列表
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div style={{ marginTop: '16px', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button className="btn btn-secondary" onClick={handleBackToList}>
                  取消
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
