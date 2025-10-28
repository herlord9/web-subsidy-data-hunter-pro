import React from 'react';

export function ScraperList({ 
  scrapers, 
  onNewScraper, 
  onEditScraper, 
  onDeleteScraper, 
  onStartScraping,
  currentTab 
}) {
  const handleDeleteScraper = (scraperId, e) => {
    e.stopPropagation();
    if (window.confirm('确定要删除这个猎手吗？')) {
      onDeleteScraper(scraperId);
    }
  };

  const handleStartScraping = (scraper, e) => {
    e.stopPropagation();
    onStartScraping(scraper);
  };

  if (scrapers.length === 0) {
    return (
      <div>
          <div className="empty-state">
            <div className="empty-icon">🕵️‍♂️</div>
            <div className="empty-message">
              还没有创建猎手。<br />
              创建你的第一个数据猎手开始猎取数据。
            </div>
            <button className="btn" onClick={onNewScraper}>
              创建新猎手
            </button>
          </div>
      </div>
    );
  }

  return (
    <div>
      <div className="toolbar">
        <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>
          我的猎手
        </h2>
        <button className="btn" onClick={onNewScraper}>
          + 新猎手
        </button>
      </div>

      <div>
        {scrapers.map(scraper => (
          <div key={scraper.id} className="card">
            <div className="card-header">
              <div>
                <h3 className="card-title">{scraper.name}</h3>
                <p className="card-subtitle">
                  {scraper.type === 'list' ? '列表抓取器' : '详情抓取器'} • 
                  {scraper.domain || currentTab?.url ? 
                    (() => {
                      try {
                        const url = scraper.domain || currentTab.url;
                        return url ? new URL(url).hostname : '未知域名';
                      } catch (e) {
                        return '无效URL';
                      }
                    })() : 
                    '未知域名'
                  }
                </p>
              </div>
              <div className="card-actions">
                <button
                  className="btn btn-sm btn-success"
                  onClick={(e) => handleStartScraping(scraper, e)}
                >
                  ▶ 开始抓取
                </button>
                <button
                  className="btn btn-sm"
                  onClick={() => onEditScraper(scraper)}
                >
                  ✏️ 编辑
                </button>
                <button
                  className="btn btn-sm btn-danger"
                  onClick={(e) => handleDeleteScraper(scraper.id, e)}
                >
                  🗑️ 删除
                </button>
              </div>
            </div>
            
            {scraper.description && (
              <p style={{ 
                fontSize: '13px', 
                color: '#6c757d', 
                margin: '8px 0 0 0',
                lineHeight: '1.4'
              }}>
                {scraper.description}
              </p>
            )}
            
            {scraper.fields && scraper.fields.length > 0 && (
              <div style={{ marginTop: '12px' }}>
                <div style={{ 
                  fontSize: '12px', 
                  color: '#6c757d', 
                  marginBottom: '4px',
                  fontWeight: '500'
                }}>
                  要提取的字段：
                </div>
                <div style={{ 
                  display: 'flex', 
                  flexWrap: 'wrap', 
                  gap: '4px' 
                }}>
                  {scraper.fields.map((field, index) => (
                    <span
                      key={index}
                      style={{
                        fontSize: '11px',
                        padding: '2px 6px',
                        background: '#e9ecef',
                        borderRadius: '3px',
                        color: '#495057'
                      }}
                    >
                      {field.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
