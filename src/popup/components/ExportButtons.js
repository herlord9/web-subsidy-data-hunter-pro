import React from 'react';
import Papa from 'papaparse';
import { saveAs } from 'file-saver';

export function ExportButtons({ data, selectedCount, totalCount, scraper, onBeforeExport }) {
  const fileName = scraper?.name || 'scraped-data';

  // 清理和验证数据中的URL
  const sanitizeData = (data) => {
    return data.map(item => {
      const sanitized = { ...item };
      
      Object.keys(sanitized).forEach(key => {
        const value = sanitized[key];
        
        // 处理数组
        if (Array.isArray(value)) {
          sanitized[key] = value.filter(v => {
            try {
              if (typeof v === 'string' && (key.toLowerCase().includes('url') || key.toLowerCase().includes('image'))) {
                // 验证是否为有效URL
                return !v.includes('...') && v.trim().length > 0;
              }
              return true;
            } catch {
              return false;
            }
          });
        }
        
        // 处理字符串URL
        if (typeof value === 'string' && (key.toLowerCase().includes('url') || key.toLowerCase().includes('image'))) {
          // 过滤掉无效URL
          if (value.includes('...') || value.trim().length === 0) {
            delete sanitized[key];
          }
        }
      });
      
      return sanitized;
    });
  };

  const exportToCSV = () => {
    if (!data || data.length === 0) return;
    
    // 如果有回调，先触发 location 选择
    if (onBeforeExport) {
      onBeforeExport('csv');
      return;
    }
    
    try {
      const sanitized = sanitizeData(data);
      
      // 添加序号列，如果没有的话
      const dataWithIndex = sanitized.map((item, index) => {
        const newItem = { ...item };
        // 检查数据中是否已有"序号"字段且是有效数字
        if (newItem.hasOwnProperty('序号')) {
          const 序号值 = newItem.序号;
          // 如果是数字或数字字符串，保留；否则替换为自动序号
          if (typeof 序号值 === 'number' || /^\d+$/.test(String(序号值))) {
            newItem.序号 = typeof 序号值 === 'number' ? 序号值 : parseInt(序号值);
          } else {
            newItem.序号 = index + 1;
          }
        } else {
          newItem.序号 = index + 1;
        }
        return newItem;
      });
      
      // 重新排序字段，确保序号在最前面
      const firstItem = dataWithIndex[0];
      const fieldOrder = ['序号', ...Object.keys(firstItem).filter(k => k !== '序号')];
      
      const orderedData = dataWithIndex.map(item => {
        const ordered = {};
        fieldOrder.forEach(key => {
          if (item.hasOwnProperty(key)) {
            ordered[key] = item[key];
          }
        });
        return ordered;
      });
      
      const csv = Papa.unparse(orderedData);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const filename = `${fileName}.csv`;
      saveAs(blob, filename);
    } catch (err) {
      console.error('Failed to export CSV:', err);
      alert('导出CSV失败：' + err.message);
    }
  };

  const exportToJSON = () => {
    if (!data || data.length === 0) return;
    
    // 如果有回调，先触发 location 选择
    if (onBeforeExport) {
      onBeforeExport('json');
      return;
    }
    
    try {
      const sanitized = sanitizeData(data);
      const json = JSON.stringify(sanitized, null, 2);
      const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
      const filename = `${fileName}.json`;
      saveAs(blob, filename);
    } catch (err) {
      console.error('Failed to export JSON:', err);
      alert('导出JSON失败：' + err.message);
    }
  };

  const copyToClipboard = async () => {
    if (!data || data.length === 0) return;
    
    try {
      const sanitized = sanitizeData(data);
      
      // 添加序号列
      const dataWithIndex = sanitized.map((item, index) => {
        const newItem = { ...item };
        // 检查数据中是否已有"序号"字段且是有效数字
        if (newItem.hasOwnProperty('序号')) {
          const 序号值 = newItem.序号;
          // 如果是数字或数字字符串，保留；否则替换为自动序号
          if (typeof 序号值 === 'number' || /^\d+$/.test(String(序号值))) {
            newItem.序号 = typeof 序号值 === 'number' ? 序号值 : parseInt(序号值);
          } else {
            newItem.序号 = index + 1;
          }
        } else {
          newItem.序号 = index + 1;
        }
        return newItem;
      });
      
      // 重新排序字段
      const firstItem = dataWithIndex[0];
      const fieldOrder = ['序号', ...Object.keys(firstItem).filter(k => k !== '序号')];
      const orderedData = dataWithIndex.map(item => {
        const ordered = {};
        fieldOrder.forEach(key => {
          if (item.hasOwnProperty(key)) {
            ordered[key] = item[key];
          }
        });
        return ordered;
      });
      
      const csv = Papa.unparse(orderedData);
      await navigator.clipboard.writeText(csv);
      alert('数据已复制到剪贴板！');
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
      alert('复制失败：' + err.message);
    }
  };

  const getButtonText = (format) => {
    if (selectedCount > 0) {
      return `导出选中 ${format} (${selectedCount})`;
    }
    return `导出全部 ${format} (${totalCount})`;
  };

  return (
    <div style={{ 
      padding: '16px 0', 
      borderTop: '1px solid #e9ecef',
      display: 'flex',
      gap: '8px',
      flexWrap: 'wrap'
    }}>
      <button
        className="btn btn-success"
        onClick={exportToCSV}
        disabled={data.length === 0}
      >
        📊 {getButtonText('CSV')}
      </button>
      
      <button
        className="btn btn-success"
        onClick={exportToJSON}
        disabled={data.length === 0}
      >
        📄 {getButtonText('JSON')}
      </button>
      
      <button
        className="btn btn-secondary"
        onClick={copyToClipboard}
        disabled={data.length === 0}
      >
        📋 复制到剪贴板
      </button>
    </div>
  );
}
