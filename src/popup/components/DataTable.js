import React from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  getSortedRowModel,
  getFilteredRowModel,
  createColumnHelper
} from '@tanstack/react-table';
import { ExportButtons } from './ExportButtons';
import { TableToolbar } from './TableToolbar';
import shandongRegions from '../../data/shandong_regions.json';
import Papa from 'papaparse';
import { saveAs } from 'file-saver';

const columnHelper = createColumnHelper();

export function DataTable({ data, scraper, onBack, onSwitchContainer }) {
  const [rowSelection, setRowSelection] = React.useState({});
  const [sorting, setSorting] = React.useState([]);
  const [globalFilter, setGlobalFilter] = React.useState('');
  const [showExportLogs, setShowExportLogs] = React.useState(false);
  const [exportLogs, setExportLogs] = React.useState([]);
  const [showPostPreview, setShowPostPreview] = React.useState(false);
  const [postData, setPostData] = React.useState(null);
  const [showLocationInput, setShowLocationInput] = React.useState(false);
  const [locationInput, setLocationInput] = React.useState('');
  const [pendingExportData, setPendingExportData] = React.useState(null);
  const [importResult, setImportResult] = React.useState(null);
  const [selectedProvince, setSelectedProvince] = React.useState('山东省');
  const [selectedCity, setSelectedCity] = React.useState('');
  const [selectedDistrict, setSelectedDistrict] = React.useState('');
  const [exportType, setExportType] = React.useState(null); // 'csv', 'json', 'db'

  // 从scraper中获取数据库配置
  const dbConfig = scraper?.databaseConfig;

  // 处理导出前的 location 选择
  const handleBeforeExport = (type) => {
    const selectedData = getSelectedData();
    const exportData = data.length > 0 && Object.keys(rowSelection).length > 0 
      ? selectedData 
      : data;

    // 保存待导出的数据和类型
    setPendingExportData(exportData);
    setExportType(type);
    
    // 初始化级联选择状态（不填充默认值，让用户自己选择）
    setSelectedProvince('山东省');
    setSelectedCity('');
    setSelectedDistrict('');
    setLocationInput('');
    
    setShowLocationInput(true);
  };

  const handleExportToDB = async () => {
    if (!dbConfig || dbConfig.dbType === 'none' || !dbConfig.dbType) {
      alert('请先在抓取器配置中设置数据库连接');
      return;
    }

    handleBeforeExport('db');
  };

  // 确认填写 location 并继续导出
  const handleConfirmLocation = async () => {
    setShowLocationInput(false);
    
    // 根据级联选择构建 location 字符串
    const location = selectedProvince && selectedCity && selectedDistrict
      ? `${selectedProvince} > ${selectedCity} > ${selectedDistrict}`
      : locationInput.trim();
    
    // 为每条数据添加 location
    const enrichedData = pendingExportData.map(item => ({
      ...item,
      location: location || item.location || ''
    }));

    // 根据导出类型继续导出流程
    if (exportType === 'db') {
      // 数据库导出
      if (dbConfig.apiUrl && dbConfig.apiUrl.trim()) {
        setPostData({
          url: dbConfig.apiUrl,
          method: 'POST',
          payload: enrichedData
        });
        setShowPostPreview(true);
        return;
      }

      // 没有配置API，走原来的逻辑
      setShowExportLogs(true);
      setExportLogs(['开始导出...']);

      try {
        // 发送到background处理
        const result = await chrome.runtime.sendMessage({
          action: 'exportToDatabase',
          data: enrichedData,
          config: dbConfig
        });

        if (result.success) {
          // 显示详细日志
          if (result.details && result.details.logs) {
            setExportLogs(result.details.logs);
          } else {
            setExportLogs([
              '✓ 导出成功',
              `✓ 导出 ${result.details?.recordCount || enrichedData.length} 条记录`,
              `✓ 数据库: ${result.details?.dbType || dbConfig.dbType}`,
              `✓ 表名: ${result.details?.tableName || dbConfig.tableName}`
            ]);
          }
        } else {
          setExportLogs([`✗ 导出失败: ${result.error}`]);
        }
      } catch (error) {
        setExportLogs([`✗ 导出出错: ${error.message}`]);
      }
    } else if (exportType === 'csv') {
      // CSV 导出
      exportToCSV(enrichedData);
    } else if (exportType === 'json') {
      // JSON 导出
      exportToJSON(enrichedData);
    }
  };

  // 确认发送POST请求
  const handleConfirmPost = async () => {
    setShowPostPreview(false);
    setShowExportLogs(true);
    setExportLogs(['开始导出...']);

    try {
      const response = await fetch(postData.url, {
        method: postData.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(postData.payload)
      });

      const result = await response.json();
      
      if (result.success || response.ok) {
        // 保存详细结果
        setImportResult(result);
        
        const dataCount = Array.isArray(postData.payload) ? postData.payload.length : postData.payload.data?.length || 0;
        setExportLogs([
          '✓ POST请求发送成功',
          `✓ 接口: ${postData.url}`,
          `✓ 数据量: ${dataCount} 条`,
          `✓ 响应: ${result.message || '成功'}`
        ]);
        
        // 关闭导出日志窗口，显示详细结果
        setTimeout(() => {
          setShowExportLogs(false);
        }, 1500);
      } else {
        setImportResult(null);
        setExportLogs([`✗ 导出失败: ${result.error || '未知错误'}`]);
      }
    } catch (error) {
      setImportResult(null);
      setExportLogs([`✗ 请求失败: ${error.message}`]);
    }
  };

  // 获取选中的数据
  const getSelectedData = () => {
    const selectedRowIds = Object.keys(rowSelection);
    return data.filter((_, index) => selectedRowIds.includes(index.toString()));
  };

  // CSV 导出函数（受控版）
  const exportToCSV = (exportData) => {
    if (!exportData || exportData.length === 0) return;
    
    try {
      
      // 添加序号列
      const dataWithIndex = exportData.map((item, index) => ({
        序号: index + 1,
        ...item
      }));
      
      // 重新排序字段
      const fieldOrder = ['序号', 'title', 'href', 'location'];
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
      const fileName = scraper?.name || 'scraped-data';
      saveAs(blob, `${fileName}.csv`);
    } catch (err) {
      console.error('Failed to export CSV:', err);
      alert('导出CSV失败：' + err.message);
    }
  };

  // JSON 导出函数（受控版）
  const exportToJSON = (exportData) => {
    if (!exportData || exportData.length === 0) return;
    
    try {
      
      // 添加序号列
      const dataWithIndex = exportData.map((item, index) => ({
        序号: index + 1,
        ...item
      }));
      
      const json = JSON.stringify(dataWithIndex, null, 2);
      const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
      const fileName = scraper?.name || 'scraped-data';
      saveAs(blob, `${fileName}.json`);
    } catch (err) {
      console.error('Failed to export JSON:', err);
      alert('导出JSON失败：' + err.message);
    }
  };

  // 创建列定义
  const columns = React.useMemo(() => {
    if (!data || data.length === 0) return [];

    const baseColumns = [
      // Checkbox 选择列
      columnHelper.display({
        id: 'select',
        header: ({ table }) => (
          <input
            type="checkbox"
            className="checkbox"
            checked={table.getIsAllRowsSelected()}
            indeterminate={table.getIsSomeRowsSelected()}
            onChange={table.getToggleAllRowsSelectedHandler()}
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            className="checkbox"
            checked={row.getIsSelected()}
            onChange={row.getToggleSelectedHandler()}
          />
        ),
        size: 40,
        enableResizing: false
      }),
      // 索引列
      columnHelper.display({
        id: 'index',
        header: '#',
        cell: ({ row }) => row.index + 1,
        size: 60,
        enableResizing: false
      })
    ];

    // 添加数据列
    const fieldNames = Object.keys(data[0] || {});
    const dataColumns = fieldNames.map(field => 
      columnHelper.accessor(field, {
        header: field,
        cell: info => {
          const value = info.getValue();
          
          // 处理URL字段
          if (field.toLowerCase().includes('url') && value) {
            return (
              <a 
                href={value} 
                target="_blank" 
                rel="noopener noreferrer"
                onClick={(e) => {
                  try {
                    new URL(value);
                  } catch {
                    e.preventDefault();
                    console.error('Invalid URL:', value);
                  }
                }}
              >
                {typeof value === 'string' && value.length > 50 
                  ? value.substring(0, 50) + '...' 
                  : value}
              </a>
            );
          }
          
          // 处理数组（如urls, images等）
          if (Array.isArray(value)) {
            return (
              <div>
                {value.length > 0 
                  ? `[${value.length}项]`
                  : '[]'}
              </div>
            );
          }
          
          // 处理长文本
          if (typeof value === 'string' && value.length > 50) {
            return (
              <div title={value}>
                {value.substring(0, 50)}...
              </div>
            );
          }
          
          return value || '-';
        },
        minSize: 100
      })
    );

    return [...baseColumns, ...dataColumns];
  }, [data]);

  // 创建表格实例
  const table = useReactTable({
    data: data || [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    state: {
      rowSelection,
      sorting,
      globalFilter
    }
  });

  // 获取选中的数据
  const selectedRows = table.getSelectedRowModel().flatRows;
  const selectedData = selectedRows.map(row => row.original);
  const selectedCount = selectedRows.length;

  if (!data || data.length === 0) {
    return (
      <div>
        <div className="toolbar">
          <button className="btn btn-secondary" onClick={onBack}>
            ← 返回抓取器
          </button>
        </div>
        <div className="empty-state">
          <div className="empty-icon">📊</div>
          <div className="empty-message">没有数据可显示</div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* 工具栏 */}
      <TableToolbar
        table={table}
        selectedCount={selectedCount}
        totalCount={data.length}
        globalFilter={globalFilter}
        onGlobalFilterChange={setGlobalFilter}
        onBack={onBack}
        onSwitchContainer={onSwitchContainer}
      />

      {/* 表格 */}
      <div className="table-container">
        <table className="table">
          <thead>
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <th
                    key={header.id}
                    style={{ width: header.getSize() }}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    {header.isPlaceholder ? null : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getCanSort() && (
                          <span style={{ fontSize: '10px' }}>
                            {{
                              asc: '↑',
                              desc: '↓'
                            }[header.column.getIsSorted()] ?? '↕'}
                          </span>
                        )}
                      </div>
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map(row => (
              <tr
                key={row.id}
                className={row.getIsSelected() ? 'selected' : ''}
              >
                {row.getVisibleCells().map(cell => (
                  <td key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 导出按钮 */}
      <ExportButtons
        data={selectedCount > 0 ? selectedData : data}
        selectedCount={selectedCount}
        totalCount={data.length}
        scraper={scraper}
        onBeforeExport={handleBeforeExport}
      />

      {/* 数据库导出按钮 */}
      <div style={{ marginTop: '12px', display: 'flex', gap: '8px', justifyContent: 'center' }}>
        <button 
          className="btn btn-success"
          onClick={handleExportToDB}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          disabled={!dbConfig || dbConfig.dbType === 'none' || !dbConfig.dbType}
        >
          📊 导出到数据库
        </button>
        {(!dbConfig || dbConfig.dbType === 'none' || !dbConfig.dbType) && (
          <span style={{ fontSize: '12px', color: '#6c757d', alignSelf: 'center' }}>
            （请在抓取器中配置数据库连接）
          </span>
        )}
      </div>

      {/* Location输入框模态框 */}
      {showLocationInput && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '500px',
            width: '100%',
            boxShadow: '0 10px 40px rgba(0,0,0,0.2)'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px',
              borderBottom: '2px solid #e9ecef',
              paddingBottom: '12px'
            }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: '#667eea' }}>
                📍 填写地理位置信息
              </h3>
              <button 
                onClick={() => setShowLocationInput(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#6c757d',
                  padding: '0',
                  width: '30px',
                  height: '30px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                onMouseOver={(e) => e.target.style.color = '#495057'}
                onMouseOut={(e) => e.target.style.color = '#6c757d'}
              >
                ×
              </button>
            </div>
            
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '12px', color: '#495057' }}>
                请选择省市县信息
              </div>
              {/* 省份选择 */}
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: '#6c757d' }}>省份</label>
                <select
                  value={selectedProvince}
                  onChange={(e) => {
                    setSelectedProvince(e.target.value);
                    setSelectedCity('');
                    setSelectedDistrict('');
                  }}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '2px solid #e9ecef',
                    borderRadius: '6px',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                    cursor: 'pointer'
                  }}
                >
                  <option value="山东省">山东省</option>
                </select>
              </div>

              {/* 城市选择 */}
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: '#6c757d' }}>城市</label>
                <select
                  value={selectedCity}
                  onChange={(e) => {
                    setSelectedCity(e.target.value);
                    setSelectedDistrict('');
                  }}
                  disabled={!selectedProvince}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '2px solid #e9ecef',
                    borderRadius: '6px',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                    cursor: selectedProvince ? 'pointer' : 'not-allowed'
                  }}
                >
                  <option value="">请选择城市</option>
                  {shandongRegions.cities.map(city => (
                    <option key={city.name} value={city.name}>{city.name}</option>
                  ))}
                </select>
              </div>

              {/* 县区选择 */}
              <div style={{ marginBottom: '8px' }}>
                <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: '#6c757d' }}>县区</label>
                <select
                  value={selectedDistrict}
                  onChange={(e) => setSelectedDistrict(e.target.value)}
                  disabled={!selectedCity}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '2px solid #e9ecef',
                    borderRadius: '6px',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                    cursor: selectedCity ? 'pointer' : 'not-allowed'
                  }}
                >
                  <option value="">请选择县区</option>
                  {selectedCity && shandongRegions.cities.find(c => c.name === selectedCity)?.districts.map(district => (
                    <option key={district} value={district}>{district}</option>
                  ))}
                </select>
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowLocationInput(false)}
                style={{
                  padding: '10px 20px',
                  background: '#f8f9fa',
                  color: '#495057',
                  border: '1px solid #e9ecef',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
                onMouseOver={(e) => e.target.style.background = '#e9ecef'}
                onMouseOut={(e) => e.target.style.background = '#f8f9fa'}
              >
                取消
              </button>
              <button
                onClick={handleConfirmLocation}
                style={{
                  padding: '10px 20px',
                  background: '#667eea',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600'
                }}
                onMouseOver={(e) => e.target.style.background = '#5568d3'}
                onMouseOut={(e) => e.target.style.background = '#667eea'}
              >
                ✅ 确认并导出
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POST预览模态框 */}
      {showPostPreview && postData && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '0',
            maxWidth: '900px',
            width: '100%',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '16px',
              borderBottom: '2px solid #667eea',
              paddingBottom: '8px'
            }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: '#667eea' }}>
                📤 POST请求预览
              </h3>
              <button
                onClick={() => setShowPostPreview(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#6c757d',
                  padding: '0',
                  lineHeight: 1
                }}
              >
                ×
              </button>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '8px', color: '#495057' }}>
                🔗 请求URL
              </div>
              <div style={{
                background: '#f8f9fa',
                padding: '12px',
                borderRadius: '6px',
                fontSize: '13px',
                fontFamily: 'monospace',
                wordBreak: 'break-all'
              }}>
                {postData.method} {postData.url}
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '8px', color: '#495057' }}>
                📊 待导入数据 (共 {Array.isArray(postData.payload) ? postData.payload.length : postData.payload.data?.length || 0} 条)
              </div>
              <div style={{
                background: '#f8f9fa',
                padding: '12px',
                borderRadius: '6px',
                border: '1px solid #e9ecef'
              }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ background: '#e9ecef', borderBottom: '2px solid #dee2e6' }}>
                      <th style={{ padding: '8px', textAlign: 'left', fontWeight: '600', position: 'sticky', top: 0, background: '#e9ecef' }}>标题</th>
                      <th style={{ padding: '8px', textAlign: 'left', fontWeight: '600', position: 'sticky', top: 0, background: '#e9ecef' }}>链接</th>
                      <th style={{ padding: '8px', textAlign: 'left', fontWeight: '600', position: 'sticky', top: 0, background: '#e9ecef' }}>地理位置</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.isArray(postData.payload) && postData.payload.map((item, index) => (
                      <tr key={index} style={{ borderBottom: '1px solid #dee2e6' }}>
                        <td style={{ padding: '8px', verticalAlign: 'top' }}>
                          <div style={{ maxWidth: '200px', wordBreak: 'break-word' }}>
                            {item.title || '-'}
                          </div>
                        </td>
                        <td style={{ padding: '8px', verticalAlign: 'top' }}>
                          <div style={{ maxWidth: '250px', wordBreak: 'break-all', fontFamily: 'monospace', fontSize: '11px' }}>
                            {item.href || '-'}
                          </div>
                        </td>
                        <td style={{ padding: '8px', verticalAlign: 'top' }}>
                          <div style={{ maxWidth: '150px', wordBreak: 'break-word' }}>
                            {item.location || '-'}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{
              display: 'flex',
              gap: '12px',
              justifyContent: 'flex-end',
              marginTop: '20px',
              paddingTop: '16px',
              borderTop: '1px solid #e9ecef'
            }}>
              <button
                onClick={() => setShowPostPreview(false)}
                style={{
                  padding: '10px 20px',
                  background: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600'
                }}
              >
                取消
              </button>
              <button
                onClick={handleConfirmPost}
                style={{
                  padding: '10px 20px',
                  background: '#667eea',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600'
                }}
              >
                ✅ 确认发送
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 导入结果详情模态框 */}
      {importResult && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1001,
          padding: '20px'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '900px',
            width: '100%',
            maxHeight: '80vh',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '16px',
              borderBottom: '2px solid #667eea',
              paddingBottom: '8px'
            }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: '#667eea' }}>
                📊 导入结果详情
              </h3>
              <button
                onClick={() => setImportResult(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#6c757d',
                  padding: '0',
                  lineHeight: 1
                }}
              >
                ×
              </button>
            </div>

            {/* 统计信息 */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '12px',
              marginBottom: '16px'
            }}>
              <div style={{
                background: '#f8f9fa',
                padding: '16px',
                borderRadius: '8px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '24px', fontWeight: '600', color: '#495057' }}>
                  {importResult.total || 0}
                </div>
                <div style={{ fontSize: '12px', color: '#6c757d' }}>总数</div>
              </div>
              <div style={{
                background: '#d4edda',
                padding: '16px',
                borderRadius: '8px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '24px', fontWeight: '600', color: '#155724' }}>
                  {importResult.imported || 0}
                </div>
                <div style={{ fontSize: '12px', color: '#155724' }}>成功</div>
              </div>
              <div style={{
                background: '#fff3cd',
                padding: '16px',
                borderRadius: '8px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '24px', fontWeight: '600', color: '#856404' }}>
                  {importResult.skipped || 0}
                </div>
                <div style={{ fontSize: '12px', color: '#856404' }}>跳过</div>
              </div>
              <div style={{
                background: '#f8d7da',
                padding: '16px',
                borderRadius: '8px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '24px', fontWeight: '600', color: '#721c24' }}>
                  {importResult.failed || 0}
                </div>
                <div style={{ fontSize: '12px', color: '#721c24' }}>失败</div>
              </div>
            </div>

            {/* 消息 */}
            {importResult.message && (
              <div style={{
                background: '#e7f3ff',
                padding: '12px',
                borderRadius: '6px',
                marginBottom: '16px',
                fontSize: '13px',
                color: '#004085',
                borderLeft: '4px solid #667eea'
              }}>
                {importResult.message}
              </div>
            )}

            {/* 详情列表 */}
            {importResult.details && importResult.details.length > 0 && (
              <div style={{
                background: '#f8f9fa',
                padding: '12px',
                borderRadius: '6px',
                maxHeight: '300px',
                overflow: 'auto',
                border: '1px solid #e9ecef'
              }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ background: '#e9ecef', borderBottom: '2px solid #dee2e6' }}>
                      <th style={{ padding: '8px', textAlign: 'left', fontWeight: '600' }}>状态</th>
                      <th style={{ padding: '8px', textAlign: 'left', fontWeight: '600' }}>标题</th>
                      <th style={{ padding: '8px', textAlign: 'left', fontWeight: '600' }}>URL</th>
                      <th style={{ padding: '8px', textAlign: 'left', fontWeight: '600' }}>消息</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importResult.details.map((detail, index) => (
                      <tr key={index} style={{ borderBottom: '1px solid #dee2e6' }}>
                        <td style={{ padding: '8px', verticalAlign: 'top' }}>
                          <span style={{
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: '600',
                            background: detail.status === 'success' ? '#d4edda' : 
                                       detail.status === 'skipped' ? '#fff3cd' : '#f8d7da',
                            color: detail.status === 'success' ? '#155724' : 
                                   detail.status === 'skipped' ? '#856404' : '#721c24'
                          }}>
                            {detail.status === 'success' ? '✓ 成功' : 
                             detail.status === 'skipped' ? '⊘ 跳过' : '✗ 失败'}
                          </span>
                        </td>
                        <td style={{ padding: '8px', verticalAlign: 'top', maxWidth: '200px', wordBreak: 'break-word' }}>
                          {detail.title || '-'}
                        </td>
                        <td style={{ padding: '8px', verticalAlign: 'top', maxWidth: '250px', wordBreak: 'break-all', fontFamily: 'monospace', fontSize: '11px' }}>
                          {detail.url || '-'}
                        </td>
                        <td style={{ padding: '8px', verticalAlign: 'top', maxWidth: '150px', wordBreak: 'break-word', fontSize: '11px' }}>
                          {detail.message || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div style={{
              display: 'flex',
              gap: '12px',
              justifyContent: 'flex-end',
              marginTop: '20px',
              paddingTop: '16px',
              borderTop: '1px solid #e9ecef'
            }}>
              <button
                onClick={() => setImportResult(null)}
                style={{
                  padding: '10px 20px',
                  background: '#667eea',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600'
                }}
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 导出日志模态框 */}
      {showExportLogs && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '8px',
            padding: '20px',
            maxWidth: '600px',
            maxHeight: '80vh',
            overflow: 'auto',
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '16px',
              paddingBottom: '12px',
              borderBottom: '1px solid #e9ecef'
            }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>
                📊 导出日志
              </h3>
              <button
                onClick={() => setShowExportLogs(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#6c757d'
                }}
              >
                ×
              </button>
            </div>
            <div style={{
              fontFamily: 'monospace',
              fontSize: '12px',
              lineHeight: '1.8',
              background: '#f8f9fa',
              padding: '12px',
              borderRadius: '4px',
              maxHeight: '400px',
              overflow: 'auto'
            }}>
              {exportLogs.map((log, index) => (
                <div key={index} style={{ marginBottom: '4px' }}>
                  {log}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
