import React, { useState, useEffect } from 'react';

export function ScraperForm({ scraper, onSave, onCancel, currentTab }) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'list',
    domain: '',
    fields: [],
    options: {
      autoScroll: true,
      scrollDelay: 1000,
      maxItems: '',
      waitTimeItems: { min: 1, max: 3 },
      waitTimePages: { min: 2, max: 5 },
      loadMoreAction: 'none'
    }
  });

  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState(null);

  // 初始化表单数据
  useEffect(() => {
    if (scraper) {
      setFormData({
        ...scraper,
        options: {
          autoScroll: true,
          scrollDelay: 1000,
          maxItems: '',
          waitTimeItems: { min: 1, max: 3 },
          waitTimePages: { min: 2, max: 5 },
          loadMoreAction: 'none',
          ...scraper.options
        }
      });
    } else {
      // 新抓取器，设置默认域名
      let domain = '';
      if (currentTab?.url) {
        try {
          domain = new URL(currentTab.url).hostname;
        } catch (e) {
          domain = '';
        }
      }
      setFormData(prev => ({
        ...prev,
        domain,
        name: domain ? `从 ${domain} 抓取` : '新猎手'
      }));
    }
  }, [scraper, currentTab]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleOptionsChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      options: {
        ...prev.options,
        [field]: value
      }
    }));
  };

  const handleNestedOptionsChange = (parentField, childField, value) => {
    setFormData(prev => ({
      ...prev,
      options: {
        ...prev.options,
        [parentField]: {
          ...prev.options[parentField],
          [childField]: value
        }
      }
    }));
  };

  const handleSave = async () => {
    setIsValidating(true);
    setValidationError(null);

    try {
      // 验证表单
      if (!formData.name.trim()) {
        throw new Error('猎手名称是必需的');
      }
      if (!formData.domain.trim()) {
        throw new Error('域名是必需的');
      }

      // 创建抓取器对象
      const scraperData = {
        id: scraper?.id || Date.now().toString(),
        ...formData,
        createdAt: scraper?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      onSave(scraperData);
    } catch (error) {
      setValidationError(error.message);
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <div>
      <div className="toolbar">
        <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>
          {scraper ? '编辑猎手' : '创建新猎手'}
        </h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-secondary" onClick={onCancel}>
            取消
          </button>
          <button 
            className="btn" 
            onClick={handleSave}
            disabled={isValidating}
          >
            {isValidating ? '保存中...' : '保存猎手'}
          </button>
        </div>
      </div>

      {validationError && (
        <div style={{
          background: '#f8d7da',
          color: '#721c24',
          padding: '12px',
          borderRadius: '6px',
          marginBottom: '16px',
          fontSize: '14px'
        }}>
          {validationError}
        </div>
      )}

      <div className="card">
        <h3 style={{ marginBottom: '16px', fontSize: '14px', fontWeight: '600' }}>
          猎手信息
        </h3>
        
        <div className="form-group">
          <label className="form-label">猎手名称</label>
          <input
            type="text"
            className="form-input"
            value={formData.name}
            onChange={(e) => handleInputChange('name', e.target.value)}
            placeholder="输入猎手名称"
          />
        </div>

        <div className="form-group">
          <label className="form-label">描述（可选）</label>
          <textarea
            className="form-input form-textarea"
            value={formData.description}
            onChange={(e) => handleInputChange('description', e.target.value)}
            placeholder="描述这个猎手的目标"
          />
        </div>

        <div className="form-group">
          <label className="form-label">域名</label>
          <input
            type="text"
            className="form-input"
            value={formData.domain}
            onChange={(e) => handleInputChange('domain', e.target.value)}
            placeholder="example.com"
          />
        </div>

        <div className="form-group">
          <label className="form-label">抓取器类型</label>
          <select
            className="form-input form-select"
            value={formData.type}
            onChange={(e) => handleInputChange('type', e.target.value)}
          >
            <option value="list">列表抓取器</option>
            <option value="details">详情抓取器</option>
          </select>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: '16px', fontSize: '14px', fontWeight: '600' }}>
          抓取选项
        </h3>

        <div className="form-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="checkbox"
              checked={formData.options.autoScroll}
              onChange={(e) => handleOptionsChange('autoScroll', e.target.checked)}
            />
            <span className="form-label" style={{ margin: 0 }}>自动滚动到项目</span>
          </label>
        </div>

        {formData.options.autoScroll && (
          <div className="form-group">
            <label className="form-label">滚动延迟（毫秒）</label>
            <input
              type="number"
              className="form-input"
              value={formData.options.scrollDelay}
              onChange={(e) => handleOptionsChange('scrollDelay', parseInt(e.target.value) || 1000)}
              min="100"
              max="5000"
              step="100"
            />
          </div>
        )}

        <div className="form-group">
          <label className="form-label">最大项目数（留空表示无限制）</label>
          <input
            type="number"
            className="form-input"
            value={formData.options.maxItems}
            onChange={(e) => handleOptionsChange('maxItems', e.target.value)}
            placeholder="例如：100"
            min="1"
          />
        </div>

        <div className="form-group">
          <label className="form-label">加载更多操作</label>
          <select
            className="form-input form-select"
            value={formData.options.loadMoreAction}
            onChange={(e) => handleOptionsChange('loadMoreAction', e.target.value)}
          >
            <option value="none">无</option>
            <option value="scrollDown">向下滚动加载更多项目</option>
            <option value="clickLoadMore">点击按钮在同一页面加载更多项目</option>
            <option value="clickNextPage">点击链接导航到下一页</option>
          </select>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div className="form-group">
            <label className="form-label">项目等待时间（秒）</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="number"
                className="form-input"
                value={formData.options.waitTimeItems.min}
                onChange={(e) => handleNestedOptionsChange('waitTimeItems', 'min', parseInt(e.target.value) || 1)}
                placeholder="最小"
                min="1"
              />
              <input
                type="number"
                className="form-input"
                value={formData.options.waitTimeItems.max}
                onChange={(e) => handleNestedOptionsChange('waitTimeItems', 'max', parseInt(e.target.value) || 3)}
                placeholder="最大"
                min="1"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">页面等待时间（秒）</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="number"
                className="form-input"
                value={formData.options.waitTimePages.min}
                onChange={(e) => handleNestedOptionsChange('waitTimePages', 'min', parseInt(e.target.value) || 2)}
                placeholder="最小"
                min="1"
              />
              <input
                type="number"
                className="form-input"
                value={formData.options.waitTimePages.max}
                onChange={(e) => handleNestedOptionsChange('waitTimePages', 'max', parseInt(e.target.value) || 5)}
                placeholder="最大"
                min="1"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 数据库配置 */}
      <div className="card">
        <h3 style={{ marginBottom: '16px', fontSize: '14px', fontWeight: '600' }}>
          📊 数据库导出配置（可选）
        </h3>

        <div className="form-group">
          <label className="form-label">数据库类型</label>
          <select
            className="form-input form-select"
            value={formData.databaseConfig?.dbType || 'none'}
            onChange={(e) => handleInputChange('databaseConfig', {
              ...formData.databaseConfig,
              dbType: e.target.value,
              apiUrl: formData.databaseConfig?.apiUrl || '',
              host: e.target.value === 'none' ? '' : (formData.databaseConfig?.host || 'localhost'),
              port: e.target.value === 'mysql' ? '3306' : e.target.value === 'postgresql' ? '5432' : '27017',
              database: formData.databaseConfig?.database || '',
              username: formData.databaseConfig?.username || '',
              password: formData.databaseConfig?.password || '',
              tableName: formData.databaseConfig?.tableName || 'scraped_data'
            })}
          >
            <option value="none">不配置</option>
            <option value="mysql">MySQL</option>
            <option value="postgresql">PostgreSQL</option>
            <option value="mongodb">MongoDB</option>
          </select>
        </div>

        {formData.databaseConfig?.dbType && formData.databaseConfig.dbType !== 'none' && (
          <>
            <div className="form-group">
              <label className="form-label">API接口地址（完整URL）</label>
              <input
                type="text"
                className="form-input"
                value={formData.databaseConfig.apiUrl || ''}
                onChange={(e) => handleInputChange('databaseConfig', {
                  ...formData.databaseConfig,
                  apiUrl: e.target.value
                })}
                placeholder="http://localhost:5000/api/export-data"
              />
              <small style={{ display: 'block', marginTop: '4px', color: '#6c757d', fontSize: '12px' }}>
                扩展将只发送抓取的数据数组到您的后端，数据库配置在后端管理
              </small>
            </div>
          </>
        )}
      </div>

      <div style={{ 
        padding: '16px 0', 
        display: 'flex', 
        gap: '8px', 
        justifyContent: 'flex-end' 
      }}>
        <button className="btn btn-secondary" onClick={onCancel}>
          取消
        </button>
        <button 
          className="btn" 
          onClick={handleSave}
          disabled={isValidating}
        >
          {isValidating ? '保存中...' : '保存抓取器'}
        </button>
      </div>
    </div>
  );
}
