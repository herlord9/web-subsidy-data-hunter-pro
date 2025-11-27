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
  const [isInferringRegion, setIsInferringRegion] = React.useState(false);

  // 从scraper中获取数据库配置
  const dbConfig = scraper?.databaseConfig;

  // 处理导出前的 location 选择
  const handleBeforeExport = async (type) => {
    const selectedData = getSelectedData();
    const exportData = data.length > 0 && Object.keys(rowSelection).length > 0 
      ? selectedData 
      : data;

    // 保存待导出的数据和类型
    setPendingExportData(exportData);
    setExportType(type);
    
    // 初始化级联选择状态
    setSelectedProvince('山东省');
    setSelectedCity('');
    setSelectedDistrict('');
    setLocationInput('');
    
    // 尝试从第一条数据的 href 推断地区
    console.log('🔍 开始地区推断流程');
    console.log('📊 导出数据条数:', exportData.length);
    console.log('🔗 第一条数据:', exportData[0]);
    
    if (exportData.length > 0 && exportData[0].href) {
      console.log('✅ 检测到 href，开始推断地区');
      setIsInferringRegion(true);
      
      try {
        const storage = await chrome.storage.local.get(['accessToken', 'apiUrl']);
        const token = storage.accessToken;
        const apiUrl = storage.apiUrl;
        
        console.log('🔑 存储信息检查:');
        console.log('  - accessToken:', token ? `${token.substring(0, 20)}...` : '❌ 未找到');
        console.log('  - apiUrl:', apiUrl || '❌ 未找到');
        
        if (token && apiUrl) {
          // 优先使用完整 URL，如果后端无法识别，再尝试域名
          let urlToSend = exportData[0].href;
          let domain = '';
          
          try {
            const urlObj = new URL(exportData[0].href);
            domain = urlObj.hostname; // 提取域名，如 www.yichang.gov.cn 或 public.xinmi.gov.cn
            
            // 去掉 public. 前缀（如果存在）
            if (domain.startsWith('public.')) {
              domain = domain.replace(/^public\./, '');
              console.log('🌐 去掉 public. 前缀后的域名:', domain);
            } else {
              console.log('🌐 提取的域名:', domain);
            }
            console.log('🔗 完整 URL:', exportData[0].href);
            
            // 尝试先使用完整 URL，如果后端需要域名，可以修改这里
            // 有些后端可能能更好地从完整 URL 中提取信息
            urlToSend = exportData[0].href;
          } catch (e) {
            console.error('❌ URL 解析失败:', e, '原始 href:', exportData[0].href);
            urlToSend = exportData[0].href; // 降级使用原始 URL
            domain = exportData[0].href;
            // 也尝试去掉 public. 前缀
            if (domain.startsWith('public.')) {
              domain = domain.replace(/^public\./, '');
            }
          }
          
          // 先尝试完整 URL
          const requestUrl = `${apiUrl}/api/chrome-data/infer-region?url=${encodeURIComponent(urlToSend)}`;
          console.log('📡 发送地区推断请求:');
          console.log('  - 请求 URL:', requestUrl);
          console.log('  - 发送的参数:', urlToSend);
          console.log('  - Token:', token ? `${token.substring(0, 20)}...` : 'null');
          
          const response = await fetch(requestUrl, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          console.log('📥 API 响应状态:', response.status, response.statusText);
          
          if (response.ok) {
            const result = await response.json();
            console.log('✅ 自动推断地区成功:', result);
            
            // 如果推断成功（至少有省份），根据置信度决定是否弹框
            if (result.province) {
              // 置信度高，直接导出
              if (result.confidence === 'high') {
                console.log('✅ 自动识别成功（高置信度），直接导出:', result);
                setIsInferringRegion(false);
                
                // 构建 location 字符串
                const locationParts = [result.province];
                if (result.city) locationParts.push(result.city);
                if (result.county) locationParts.push(result.county);
                const location = locationParts.join(' > ');
                
                console.log('📍 构建的 location:', location);
                
                // 为每条数据添加 location
                const enrichedData = exportData.map(item => ({
                  ...item,
                  location: location
                }));
                
                // 直接执行导出
                await executeExport(enrichedData, type);
                return;
              } else {
                // 置信度中等，显示弹框让用户确认
                console.log('⚠️ 置信度中等，显示弹框确认:', result);
                if (result.province) setSelectedProvince(result.province);
                if (result.city) setSelectedCity(result.city);
                if (result.county) setSelectedDistrict(result.county);
                setShowLocationInput(true);
              }
            } else {
              // 推断不完整，尝试从域名中推断（降级策略）
              console.log('⚠️ 自动识别失败（无省份），尝试从域名推断:', result);
              
              // 尝试从域名中提取地区信息
              let inferredRegion = null;
              if (domain) {
                // 常见的地名映射（可以根据实际情况扩展）
                const regionMap = {
                  'xinmi': { province: '河南省', city: '郑州市', county: '新密市' },
                  'gongyishi': { province: '河南省', city: '焦作市', county: '巩义市' },
                  'yanshi': { province: '河南省', city: '洛阳市', county: '偃师区' },
                  // 可以添加更多映射
                };
                
                // 检查域名中是否包含已知的地名
                for (const [key, region] of Object.entries(regionMap)) {
                  if (domain.includes(key)) {
                    inferredRegion = region;
                    console.log(`🔍 从域名推断出地区: ${key} -> ${region.county}`);
                    break;
                  }
                }
              }
              
              if (inferredRegion) {
                // 如果从域名推断成功，显示弹框并预填
                console.log('✅ 从域名推断成功，预填地区信息');
                if (inferredRegion.province) setSelectedProvince(inferredRegion.province);
                if (inferredRegion.city) setSelectedCity(inferredRegion.city);
                if (inferredRegion.county) setSelectedDistrict(inferredRegion.county);
                setShowLocationInput(true);
              } else {
                // 无法推断，显示弹框让用户手动选择
                console.log('⚠️ 无法从域名推断，显示弹框让用户手动选择');
                setShowLocationInput(true);
              }
            }
          } else {
            // API 调用失败，显示弹框
            console.error('❌ API 调用失败:', response.status, response.statusText);
            try {
              const errorText = await response.text();
              console.error('❌ 错误详情:', errorText);
            } catch (e) {
              console.error('❌ 无法读取错误详情:', e);
            }
            setShowLocationInput(true);
          }
        } else {
          // 没有登录信息，显示弹框
          console.warn('⚠️ 缺少登录信息，无法调用推断接口');
          console.warn('  - token:', token ? '存在' : '❌ 缺失');
          console.warn('  - apiUrl:', apiUrl ? '存在' : '❌ 缺失');
          setShowLocationInput(true);
        }
      } catch (error) {
        console.error('❌ 推断地区失败（异常）:', error);
        console.error('❌ 错误堆栈:', error.stack);
        // 推断失败，显示弹框让用户手动选择
        setShowLocationInput(true);
      } finally {
        setIsInferringRegion(false);
      }
    } else {
      // 没有 href，显示弹框
      console.warn('⚠️ 没有 href 数据，无法推断地区');
      console.warn('  - exportData.length:', exportData.length);
      console.warn('  - exportData[0]:', exportData[0]);
      console.warn('  - exportData[0]?.href:', exportData[0]?.href);
      setShowLocationInput(true);
    }
  };

  // 执行导出操作（提取公共逻辑）
  const executeExport = async (enrichedData, type) => {
    if (type === 'db') {
      // 数据库导出 - 使用默认的 Chrome 数据导入接口
      const storage = await chrome.storage.local.get(['apiUrl']);
      const userApiUrl = storage.apiUrl;
      
      // 如果配置了自定义 API URL，使用配置的
      // 否则使用默认的 Chrome 数据导入接口
      let fullApiUrl;
      if (dbConfig && dbConfig.apiUrl && dbConfig.apiUrl.trim()) {
        fullApiUrl = dbConfig.apiUrl.startsWith('http') 
          ? dbConfig.apiUrl 
          : `${userApiUrl}${dbConfig.apiUrl}`;
      } else {
        // 使用默认接口
        fullApiUrl = `${userApiUrl}/api/chrome-data/import`;
      }
      
      setPostData({
        url: fullApiUrl,
        method: 'POST',
        payload: enrichedData
      });
      setShowPostPreview(true);
    } else if (type === 'csv') {
      exportToCSV(enrichedData);
    } else if (type === 'json') {
      exportToJSON(enrichedData);
    }
  };

  const handleExportToDB = async () => {
    // 直接调用导出前的处理，不检查配置
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

    // 使用统一的导出函数
    await executeExport(enrichedData, exportType);
  };

  // 导出 Playwright 配置
  const handleExportPlaywrightConfig = async () => {
    try {
      // 获取当前页面 URL
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const currentUrl = tabs[0]?.url || '';
      const domain = currentUrl ? new URL(currentUrl).hostname : '';
      
      // 分析数据结构，自动推断字段选择器
      const sampleData = data[0] || {};
      const fields = {};
      
      Object.keys(sampleData).forEach(key => {
        if (key === 'title') fields.title = 'a[href], h3, h4';
        else if (key === 'href') fields.link = 'a[href]';
        else if (key === 'date') fields.date = '.date, .time, [class*="date"]';
        else fields[key] = `.${key}`;
      });
      
      // 生成配置对象
      const playwrightConfig = {
        // 网站信息
        website: domain,
        websiteName: domain.split('.')[0] || 'unknown',
        url: currentUrl,
        urlPattern: currentUrl.replace(/[?&]page=\d+/, '').replace(/&/g, '\\&'),
        
        // 选择器配置
        selectors: {
          listContainer: scraper?.selectedContainer || 'auto-detected',
          listItem: 'li, tr, div[class*="item"]',
          fields: fields
        },
        
        // 分页配置
        pagination: {
          enabled: true,
          nextButton: 'a:contains("下一页"), a:contains("下一"), .next-page',
          totalPages: 'span:contains("共"), .total-pages',
          pageParam: 'page'
        },
        
        // 等待配置
        waitConfig: {
          listLoad: 2000,
          itemDelay: 100,
          pageDelay: 1000
        },
        
        // 元数据
        metadata: {
          testedAt: new Date().toISOString(),
          itemsFound: data.length,
          confidence: data.length >= 5 ? 'high' : 'medium',
          scrapedBy: 'Data Hunter Pro Chrome Extension',
          version: '1.3.6'
        },
        
        // 示例数据（前3条）
        sampleData: data.slice(0, 3),
        
        // Playwright 代码模板
        playwrightTemplate: {
          language: 'python',
          code: generatePlaywrightCode(domain, fields, data.length)
        }
      };
      
      // 导出为 JSON
      const json = JSON.stringify(playwrightConfig, null, 2);
      const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
      const fileName = `playwright-config-${domain}-${new Date().getTime()}.json`;
      saveAs(blob, fileName);
      
      alert(`✅ Playwright 配置已导出！\n\n文件名: ${fileName}\n\n可直接用于后端 Playwright 脚本开发`);
      
    } catch (err) {
      console.error('导出配置失败:', err);
      alert('导出配置失败：' + err.message);
    }
  };
  
  // 生成 Playwright Python 代码模板
  const generatePlaywrightCode = (domain, fields, itemCount) => {
    return `"""
${domain} 网站数据抓取脚本
由 Data Hunter Pro 自动生成
测试时间: ${new Date().toISOString()}
测试结果: ${itemCount} 条数据
"""

from playwright.sync_api import sync_playwright
import json
from datetime import datetime

def scrape_${domain.replace(/\./g, '_')}(url, max_pages=10):
    """
    抓取 ${domain} 网站数据
    
    Args:
        url: 搜索页面 URL
        max_pages: 最大抓取页数
    
    Returns:
        list: 抓取到的数据列表
    """
    results = []
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        
        for page_num in range(1, max_pages + 1):
            print(f"正在抓取第 {page_num} 页...")
            
            # 访问页面
            page_url = url if page_num == 1 else f"{url}&page={page_num}"
            page.goto(page_url, wait_until='networkidle')
            
            # 等待列表加载
            page.wait_for_selector('${scraper?.selectedContainer || 'ul, .result-list'}', timeout=5000)
            
            # 提取数据
            items = page.query_selector_all('${scraper?.selectedContainer || 'ul'} li')
            
            for item in items:
                try:
                    data = {
${Object.keys(fields).map(key => `                        '${key}': item.query_selector('${fields[key]}').inner_text().strip() if item.query_selector('${fields[key]}') else '',`).join('\n')}
                    }
                    results.append(data)
                except Exception as e:
                    print(f"提取数据失败: {e}")
                    continue
            
            print(f"第 {page_num} 页完成，共 {len(items)} 条")
            
            # 检查是否有下一页
            next_button = page.query_selector('a:has-text("下一页")')
            if not next_button or page_num >= max_pages:
                break
            
            # 等待一下避免请求过快
            page.wait_for_timeout(1000)
        
        browser.close()
    
    return results

if __name__ == '__main__':
    # 测试 URL
    test_url = '${currentUrl}'
    
    # 开始抓取
    data = scrape_${domain.replace(/\./g, '_')}(test_url, max_pages=5)
    
    # 保存结果
    with open('${domain}_data.json', 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    print(f"抓取完成！共 {len(data)} 条数据")
`;
  };
  
  // 确认发送POST请求
  const handleConfirmPost = async () => {
    setShowPostPreview(false);
    setShowExportLogs(true);
    setExportLogs(['开始导出...']);

    try {
      // 获取存储的 token
      const storage = await chrome.storage.local.get(['accessToken', 'apiUrl']);
      const token = storage.accessToken;

      if (!token) {
        setImportResult(null);
        setExportLogs(['✗ 未登录，请先登录后再导出']);
        return;
      }

      const response = await fetch(postData.url, {
        method: postData.method,
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
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
        setExportLogs([`✗ 导出失败: ${result.error || result.detail || '未知错误'}`]);
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
          
          // 特殊处理 title 字段 - 始终显示 tooltip 并添加视觉提示
          if (field === 'title' && typeof value === 'string') {
            return (
              <div 
                title={value}
                style={{
                  cursor: 'help',
                  borderBottom: '1px dashed #adb5bd',
                  paddingBottom: '2px'
                }}
              >
                {value.length > 50 ? value.substring(0, 50) + '...' : value}
              </div>
            );
          }
          
          // 处理其他长文本
          if (typeof value === 'string' && value.length > 50) {
            return (
              <div title={value} style={{ cursor: 'help' }}>
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
      <div style={{ marginTop: '12px', display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
        <button 
          className="btn btn-success"
          onClick={handleExportToDB}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          📊 导出到数据库
        </button>
        
        <button 
          className="btn"
          onClick={handleExportPlaywrightConfig}
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '6px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            border: 'none'
          }}
        >
          🎭 导出 Playwright 配置
        </button>
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
                {isInferringRegion && (
                  <span style={{ fontSize: '12px', color: '#6c757d', fontWeight: '400', marginLeft: '8px' }}>
                    正在自动识别...
                  </span>
                )}
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
            
            {/* 验证提示 */}
            {(!selectedProvince || (selectedProvince !== '山东省' && !selectedCity)) && (
              <div style={{
                background: '#fff3cd',
                border: '1px solid #ffc107',
                borderRadius: '6px',
                padding: '10px 12px',
                marginBottom: '12px',
                fontSize: '13px',
                color: '#856404',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span>⚠️</span>
                <span>地区数据不完整，请至少选择省份和市</span>
              </div>
            )}
            
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
                disabled={!selectedProvince || (selectedProvince !== '山东省' && !selectedCity)}
                style={{
                  padding: '10px 20px',
                  background: (!selectedProvince || (selectedProvince !== '山东省' && !selectedCity)) ? '#ccc' : '#667eea',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: (!selectedProvince || (selectedProvince !== '山东省' && !selectedCity)) ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: '600'
                }}
                onMouseOver={(e) => {
                  if (!e.target.disabled) e.target.style.background = '#5568d3';
                }}
                onMouseOut={(e) => {
                  if (!e.target.disabled) e.target.style.background = '#667eea';
                }}
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
            {/* 标题栏 - 固定 */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '20px 24px',
              borderBottom: '2px solid #667eea',
              flexShrink: 0
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

            {/* 内容区域 - 可滚动 */}
            <div style={{
              padding: '20px 24px',
              overflowY: 'auto',
              flexGrow: 1
            }}>
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

              <div>
                <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '8px', color: '#495057' }}>
                  📊 待导入数据 (共 {Array.isArray(postData.payload) ? postData.payload.length : postData.payload.data?.length || 0} 条)
                </div>
                <div style={{
                  background: '#f8f9fa',
                  padding: '12px',
                  borderRadius: '6px',
                  border: '1px solid #e9ecef',
                  maxHeight: '400px',
                  overflowY: 'auto'
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
            </div>

            {/* 按钮区域 - 固定在底部 */}
            <div style={{
              display: 'flex',
              gap: '12px',
              justifyContent: 'flex-end',
              padding: '16px 24px',
              borderTop: '2px solid #e9ecef',
              background: 'white',
              borderRadius: '0 0 12px 12px',
              flexShrink: 0
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
