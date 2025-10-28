import React from 'react';

export function TableToolbar({ 
  table, 
  selectedCount, 
  totalCount, 
  globalFilter, 
  onGlobalFilterChange, 
  onBack,
  onSwitchContainer 
}) {
  return (
    <div className="toolbar">
      <div className="toolbar-left">
        <button className="btn btn-secondary" onClick={onBack}>
          ← 返回抓取器
        </button>
        
        {onSwitchContainer && (
          <button className="btn btn-primary" onClick={onSwitchContainer}>
            🔄 切换容器
          </button>
        )}
        
        <button
          className="btn btn-sm"
          onClick={() => table.toggleAllRowsSelected(true)}
        >
          全选
        </button>
        
        <button
          className="btn btn-sm btn-secondary"
          onClick={() => table.toggleAllRowsSelected(false)}
        >
          清除全部
        </button>
        
        {selectedCount > 0 && (
          <span className="selection-info">
            {selectedCount} / {totalCount} 已选择
          </span>
        )}
      </div>
      
      <div className="toolbar-right">
        <input
          type="text"
          placeholder="搜索..."
          value={globalFilter}
          onChange={e => onGlobalFilterChange(e.target.value)}
          className="form-input"
          style={{ width: '150px', fontSize: '12px', padding: '6px 8px' }}
        />
      </div>
    </div>
  );
}
