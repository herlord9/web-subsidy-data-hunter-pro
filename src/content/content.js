// Content script for Easy Scraper
// Handles DOM interaction and data extraction

class EasyScraperContentScript {
  constructor() {
    this.isScraping = false;
    this.scraper = null;
    this.scrapedData = [];
    this.currentIndex = 0;
    this.maxItems = null;
    this.locationInfo = null; // 存储省市区信息
    this.setupMessageListener();
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      console.log('Content script received message:', request);
      
      switch (request.action) {
        case 'startScraping':
          this.startScraping(request.scraper, sendResponse, request.selector);
          return true; // Keep message channel open for async response
          
        case 'stopScraping':
          this.stopScraping(sendResponse);
          return true;
          
        case 'highlightElement':
          this.highlightElement(request.selector, sendResponse);
          return true;
          
        case 'getPageInfo':
          this.getPageInfo(sendResponse);
          return true;
          
        case 'getListOptions':
          const result = this.getListOptions();
          sendResponse(result);
          return true;
          
        case 'enterSelectionMode':
          this.enterSelectionMode(request.scraper, sendResponse);
          return true;
          
        default:
          console.warn('Unknown action:', request.action);
          sendResponse({ success: false, error: 'Unknown action' });
      }
    });
  }

  async startScraping(scraper, sendResponse, selector = null) {
    try {
      if (this.isScraping) {
        sendResponse({ success: false, error: 'Scraping already in progress' });
        return;
      }

      this.scraper = scraper;
      this.isScraping = true;
      this.scrapedData = [];
      this.currentIndex = 0;
      this.maxItems = scraper.options?.maxItems ? parseInt(scraper.options.maxItems) : null;
      this.customSelector = selector; // 保存自定义选择器

      console.log('Starting scraping with scraper:', scraper, 'selector:', selector);

      // 根据抓取器类型执行不同的抓取逻辑
      if (scraper.type === 'list') {
        await this.scrapeList();
      } else if (scraper.type === 'details') {
        await this.scrapeDetails();
      } else {
        throw new Error('Unknown scraper type');
      }

      sendResponse({ 
        success: true, 
        data: this.scrapedData,
        count: this.scrapedData.length
      });

    } catch (error) {
      console.error('Scraping error:', error);
      sendResponse({ success: false, error: error.message });
    } finally {
      this.isScraping = false;
    }
  }

  async scrapeList() {
    console.log('Starting list scraping');
    
    // 不使用页面自动提取省市区信息，让用户手动选择
    this.locationInfo = null;
    
    // 查找列表容器（使用自定义选择器）
    const listContainer = this.findListContainer(this.customSelector);
    if (!listContainer) {
      throw new Error('Unable to find list on page');
    }

    // 获取列表项
    const listItems = this.getListItems(listContainer);
    if (listItems.length === 0) {
      throw new Error('No list items found');
    }

    console.log(`Found ${listItems.length} list items`);

    // 快速抓取：一次性提取所有数据，不做延迟
    for (let i = 0; i < listItems.length; i++) {
      // 限制数量
      if (this.maxItems && this.currentIndex >= this.maxItems) {
        console.log(`Reached max items limit: ${this.maxItems}`);
        break;
      }

      const item = listItems[i];
      
      // 提取数据（立即提取，不做任何等待）
      const itemData = this.extractItemData(item);
      if (itemData && Object.keys(itemData).length > 0) {
        this.scrapedData.push(itemData);
        this.currentIndex++;
      }
    }

    console.log(`Scraped ${this.scrapedData.length} items`);
  }

  async scrapeDetails() {
    console.log('Starting details scraping');
    
    // 详情抓取需要从URL列表开始
    // 这里简化实现，实际应该从CSV文件或之前的列表抓取结果开始
    throw new Error('Details scraping not implemented yet');
  }

  getListOptions() {
    const options = [];
    const seenElements = new Set(); // 用于跟踪已经处理过的元素
    
    // 首先检查是否有 iframe
    const iframes = document.querySelectorAll('iframe');
    iframes.forEach((iframe, index) => {
      try {
        if (iframe.contentDocument && iframe.contentDocument.querySelector) {
          // 尝试访问 iframe 内容（同源或允许访问）
          const iframeDoc = iframe.contentDocument;
          const iframeLists = iframeDoc.querySelectorAll('ul, ol, table');
          
          let totalCount = 0;
          let preview = '';
          
          iframeLists.forEach(list => {
            const items = list.querySelectorAll('li, tr');
            totalCount += items.length;
            if (!preview && items.length > 0) {
              preview = items[0].textContent?.trim().substring(0, 100) || '';
            }
          });
          
          if (totalCount >= 2) {
            let selector = 'iframe';
            if (iframe.id) selector += `#${iframe.id}`;
            else if (iframe.className) {
              const firstClass = iframe.className.split(' ')[0];
              if (firstClass) selector += `.${firstClass}`;
            } else {
              selector += `:nth-of-type(${index + 1})`;
            }
            
            options.push({
              selector,
              type: '框架内列表',
              itemCount: totalCount,
              preview: preview.substring(0, 100),
              description: `iframe内 - ${totalCount} 项 - ${preview.substring(0, 50)}...`,
              isIframe: true
            });
          }
        } else if (iframe.src) {
          // 无法访问 iframe 内容，但提供 URL
          options.push({
            selector: `iframe:nth-of-type(${index + 1})`,
            type: '外部框架',
            itemCount: -1,
            preview: iframe.src.substring(0, 100),
            description: `iframe (无法访问内容) - ${iframe.src}`,
            isIframe: true,
            iframeUrl: iframe.src
          });
        }
      } catch (error) {
        console.warn('Cannot access iframe content:', error);
      }
    });
    
    // 策略0: 首先检查是否有 a[name="docpuburl"] 的搜索结果
    const docpuburlLinks = document.querySelectorAll('a[name="docpuburl"]');
    if (docpuburlLinks.length >= 2) {
      // 找到共同的父容器
      let commonParent = docpuburlLinks[0].parentElement;
      
      for (let depth = 0; depth < 10; depth++) {
        if (!commonParent) break;
        
        const count = commonParent.querySelectorAll('a[name="docpuburl"]').length;
        if (count === docpuburlLinks.length || count >= 2) {
          const preview = docpuburlLinks[0].textContent?.trim().replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s【】（）]/g, '').substring(0, 100) || '';
          options.push({
            selector: 'docpuburl-container', // 特殊标识
            type: '搜索结果',
            itemCount: count,
            preview: preview,
            description: `搜索结果 - ${count} 项 - ${preview.substring(0, 50)}...`,
            isDocpuburl: true
          });
          break;
        }
        commonParent = commonParent.parentElement;
      }
      
      // 如果找到了搜索结果，直接返回
      if (options.length > 0) {
        console.log('Found list options:', options);
        return { options };
      }
    }
    
    // 策略1：获取所有可能的列表，返回元数据
    const allElements = document.querySelectorAll('table, ul, [class*="list-item"], [class*="result-item"], [class*="search-result"]');
    
    console.log('=== getListOptions 调试 ===');
    console.log('找到', allElements.length, '个可能的列表元素');
    
    // 统计每个选择器的出现次数
    const selectorCount = new Map();
    
    allElements.forEach((element, index) => {
      // 跳过导航元素
      if (element.closest('header, nav, [class*="nav"], [class*="menu"]')) return;
      
      const tagName = element.tagName.toLowerCase();
      const className = element.className || '';
      const id = element.id || '';
      
      // 忽略明显不是内容容器的元素
      if (['script', 'style', 'meta', 'link', 'noscript'].includes(tagName)) return;
      if (className.includes('ad') || className.includes('banner') || className.includes('footer')) return;
      
      const itemCount = this.estimateItemCount(element);
      
      // 提取预览文本（从第一个子元素，避免递归所有子元素）
      let preview = '';
      const firstItem = element.firstElementChild;
      if (firstItem) {
        preview = firstItem.textContent?.trim().substring(0, 100) || '';
      } else {
        preview = element.textContent?.trim().substring(0, 100) || '';
      }
      
      if (itemCount >= 2) {
        // 检查这个元素是否已经被处理过（防止重复）
        if (seenElements.has(element)) {
          console.log('跳过重复元素:', element);
          return;
        }
        
        console.log(`处理第${index + 1}个元素:`, {
          tagName,
          className,
          id,
          itemCount,
          preview: preview.substring(0, 30)
        });
        
        // 生成唯一标识
        let selector = tagName;
        if (id) {
          selector += `#${id}`;
        } else if (className) {
          const firstClass = className.split(' ')[0];
          if (firstClass) {
            selector += `.${firstClass}`;
            // 检查这个选择器是否唯一
            const count = document.querySelectorAll(selector).length;
            selectorCount.set(selector, (selectorCount.get(selector) || 0) + 1);
            
            // 如果选择器不唯一，添加父元素信息
            if (count > 1) {
              const parent = element.parentElement;
              if (parent) {
                const parentTag = parent.tagName.toLowerCase();
                const parentClass = parent.className?.split(' ')[0] || '';
                if (parentClass) {
                  selector = `${parentTag}.${parentClass} > ${selector}`;
                } else {
                  selector = `${parentTag}:nth-of-type(${index + 1}) > ${selector}`;
                }
              }
            }
          }
        }
        
        // 如果没有 class 或 id，尝试使用父容器构建选择器
        if (!id && !className && (tagName === 'ul' || tagName === 'table')) {
          const parent = element.parentElement;
          if (parent) {
            if (parent.id) {
              selector = `#${parent.id} > ${tagName}`;
            } else if (parent.className) {
              const parentClass = parent.className.split(' ')[0];
              if (parentClass) {
                selector = `.${parentClass} > ${tagName}`;
              }
            }
          }
        }
        
        // 如果还是没有找到更精确的选择器，使用序号
        if (!selector.includes('>') && !selector.includes('#') && !selector.includes('.')) {
          if (tagName === 'div' || tagName === 'ul') {
            selector += `:nth-of-type(${Array.from(document.querySelectorAll(tagName)).indexOf(element) + 1})`;
          }
        }
        
        // 记录这个元素已被处理
        seenElements.add(element);
        
        const option = {
          selector,
          type: tagName === 'table' ? '表格' : tagName === 'ul' ? '列表' : '容器',
          itemCount,
          preview: preview.substring(0, 100),
          description: `${tagName} - ${itemCount} 项 - ${preview.substring(0, 50)}...`,
          element: element // 添加元素引用以便调试
        };
        
        console.log('添加选项:', {
          selector: option.selector,
          type: option.type,
          itemCount: option.itemCount,
          preview: option.preview.substring(0, 50)
        });
        
        options.push(option);
      }
    });
    
    console.log('=== 最终找到', options.length, '个选项 ===');
    options.forEach((opt, idx) => {
      console.log(`选项${idx + 1}:`, opt.selector, '-', opt.itemCount, '项 -', opt.preview.substring(0, 40));
    });
    
    return { options };
  }
  
  estimateItemCount(element) {
    const tagName = element.tagName.toLowerCase();
    
    if (tagName === 'table') {
      const rows = element.querySelectorAll('tbody tr, tr');
      return Array.from(rows).filter(row => {
        const cells = row.querySelectorAll('td');
        return cells.length >= 2;
      }).length;
    }
    
    if (tagName === 'ul') {
      const items = element.querySelectorAll('li');
      return Array.from(items).filter(item => {
        const text = item.textContent?.trim();
        return text && text.length > 10;
      }).length;
    }
    
    // 对于div，检查直接子元素或包含list-item类的元素
        const children = element.children;
    let count = 0;
    
    Array.from(children).forEach(child => {
      const text = child.textContent?.trim();
      if (text && text.length > 20) count++;
      
      // 检查是否包含有意义的子元素
      const subItems = child.querySelectorAll('a, [class*="item"]');
      if (subItems.length > 0) count++;
    });
    
    return count;
  }

  findListContainer(selector = null) {
    console.log('Finding list container...', selector);
    
    // 如果提供了选择器，直接使用它
    if (selector) {
      try {
        // 特殊处理：如果是 docpuburl-container 标识
        if (selector === 'docpuburl-container') {
          const docpuburlLinks = document.querySelectorAll('a[name="docpuburl"]');
          if (docpuburlLinks.length >= 2) {
            let commonParent = docpuburlLinks[0].parentElement;
            for (let depth = 0; depth < 10; depth++) {
              if (!commonParent) break;
              const count = commonParent.querySelectorAll('a[name="docpuburl"]').length;
              if (count === docpuburlLinks.length || count >= 2) {
                console.log('Using docpuburl container');
                return commonParent;
              }
              commonParent = commonParent.parentElement;
            }
          }
        }
        
        const element = document.querySelector(selector);
        
        // 如果是 iframe，尝试在其内部查找列表
        if (element && element.tagName && element.tagName.toLowerCase() === 'iframe') {
          try {
            if (element.contentDocument && element.contentDocument.querySelector) {
              const iframeDoc = element.contentDocument;
              // 在 iframe 内查找列表
              const ul = iframeDoc.querySelector('ul');
              if (ul && ul.querySelectorAll('li').length >= 2) {
                console.log('Using iframe content (ul):', selector);
                return ul;
              }
              
              const table = iframeDoc.querySelector('table');
              if (table && table.querySelectorAll('tr').length >= 2) {
                console.log('Using iframe content (table):', selector);
                return table;
              }
            }
          } catch (error) {
            console.warn('Cannot access iframe content:', error);
            throw new Error('无法访问 iframe 内容（跨域限制）。请直接在 iframe 的 URL 上使用此插件。');
          }
        }
        
        if (element) {
          console.log('Using provided selector:', selector);
          return element;
        }
      } catch (error) {
        console.warn('Invalid selector:', selector, error);
        throw error;
      }
    }
    
    // 策略0: 特殊处理 - 查找包含 a[name="docpuburl"] 的结果（最高优先级）
    // 只在没有指定 selector 或者 selector 是特殊标识时才执行
    if (!selector || selector === 'docpuburl-container') {
      const docpuburlLinks = document.querySelectorAll('a[name="docpuburl"]');
      if (docpuburlLinks.length >= 2) {
        // 找到一个共同的父容器，优先返回包含所有结果的容器
        let commonParent = docpuburlLinks[0].parentElement;
        
        // 向上查找包含所有结果的容器
        for (let depth = 0; depth < 10; depth++) {
          if (!commonParent) break;
          
          const count = commonParent.querySelectorAll('a[name="docpuburl"]').length;
          if (count === docpuburlLinks.length || count >= 2) {
            console.log(`Found docpuburl results container with ${count} items`);
            return commonParent;
          }
          commonParent = commonParent.parentElement;
        }
      }
    }
    
    // 策略1: 优先查找真正的表格
    const tables = document.querySelectorAll('table');
    for (const table of tables) {
      if (table.closest('header, nav, [class*="nav"], [class*="menu"]')) {
        continue;
      }
      
      const rows = table.querySelectorAll('tbody tr, tr');
      if (rows.length >= 2) {
        const dataRows = Array.from(rows).filter(row => {
          const cells = row.querySelectorAll('td');
          return cells.length >= 2;
        });
        
        if (dataRows.length >= 2) {
          const firstRow = dataRows[0];
          const cellCount = firstRow.querySelectorAll('td').length;
          if (cellCount >= 2 && cellCount <= 10) {
            console.log(`Found table with ${dataRows.length} rows`);
            return table;
          }
        }
      }
    }
    
    // 策略2: 查找ul/li结构的列表（某些网站用li模拟表格）
    const allLists = document.querySelectorAll('ul');
    for (const list of allLists) {
      if (list.closest('header, nav, [class*="nav"], [class*="menu"]')) {
        continue;
      }
      
      const items = list.querySelectorAll('li');
      if (items.length >= 2) {
        const validItems = Array.from(items).filter(item => {
          const link = item.querySelector('a[href]');
          const text = item.textContent?.trim();
          return text && text.length > 10 && link;
        });
        
        if (validItems.length >= 3) {
          console.log(`Found data list (ul/li) with ${validItems.length} items`);
          return list;
        }
      }
    }
    
    // 策略3: 优先查找常见的列表类class
    const listContainers = document.querySelectorAll('[class*="list-item"], [class*="result-item"], [class*="search-result"]');
    if (listContainers.length >= 2) {
      // 找到包含这些项的父容器
      const parentMap = new Map();
      listContainers.forEach(item => {
        const parent = item.parentElement;
        if (parent && !parent.closest('header, nav')) {
          const count = parentMap.get(parent) || 0;
          parentMap.set(parent, count + 1);
        }
      });
      
      // 找到包含最多列表项的父容器
      let maxCount = 0;
      let bestParent = null;
      parentMap.forEach((count, parent) => {
        if (count > maxCount) {
          maxCount = count;
          bestParent = parent;
        }
      });
      
      if (bestParent && maxCount >= 2) {
        console.log(`Found list container with ${maxCount} items`);
        return bestParent;
      }
    }
    
    // 策略4: 通用的div结构查找
    const allDivs = Array.from(document.querySelectorAll('div'));
    for (const div of allDivs) {
      // 跳过明显不是内容的区域
      if (div.closest('header, nav, [class*="nav"], [class*="menu"], [class*="breadcrumb"]')) {
        continue;
      }
      
      // 检查是否有多个包含标题链接的div子元素
      const children = div.querySelectorAll(':scope > div');
      if (children.length >= 2) {
        const validItems = Array.from(children).filter(child => {
          const link = child.querySelector('a[href]');
          const text = child.textContent?.trim();
          
          // 确保有链接、有文本、有合理的结构
          return link && 
                 text && 
                 text.length > 30 &&
                 !text.match(/^在线办理|查看更多|更多|下一|上一/);
        });
        
        if (validItems.length >= 2) {
          console.log(`Found data container (div) with ${validItems.length} items`);
          return div;
        }
      }
    }
    
    console.log('No suitable container found');
    return null;
  }

  getListItems(container) {
    const items = [];
    
    // 策略0: 特殊处理 - 查找包含 a[name="docpuburl"] 的项
    const docpuburlLinks = container.querySelectorAll('a[name="docpuburl"]');
    if (docpuburlLinks.length >= 2) {
      // 找到每个链接的父容器（通常是 tr 或 div）
      const parentItems = new Set();
      docpuburlLinks.forEach(link => {
        let current = link.parentElement;
        for (let i = 0; i < 10; i++) {
          if (current && current.tagName) {
            if (current.tagName.toLowerCase() === 'tr') {
              parentItems.add(current);
              break;
            } else if (current.tagName.toLowerCase() === 'td') {
              // td 可能包含整个结果，继续向上找 tr
              current = current.parentElement;
            } else {
              parentItems.add(current);
              break;
            }
          } else {
            break;
          }
        }
      });
      if (parentItems.size >= 2) {
        console.log(`Found ${parentItems.size} items via docpuburl links`);
        return Array.from(parentItems);
      }
    }
    
    // 策略1: 优先查找常见的列表项class
    const listItems = container.querySelectorAll('[class*="list-item"], [class*="result-item"], [class*="search-result"]');
    if (listItems.length > 0) {
      return Array.from(listItems);
    }
    
    // 如果是表格，直接获取行
    if (container.tagName.toLowerCase() === 'table') {
      const rows = container.querySelectorAll('tbody tr');
      if (rows.length > 0) {
        items.push(...Array.from(rows));
      } else {
        // 如果没有tbody，直接获取tr
        const rowsNoTbody = container.querySelectorAll('tr');
        items.push(...Array.from(rowsNoTbody));
      }
      
      // 过滤掉表头行
      return items.filter(row => {
        // 跳过表头（只有th没有td的行）
        const hasTd = row.querySelector('td');
        return !!hasTd;
      });
    }
    
    // 如果不是表格，尝试找到表格内的行
    const tablesInside = container.querySelectorAll('table');
    if (tablesInside.length > 0) {
      const bestTable = Array.from(tablesInside).find(table => {
        const rows = table.querySelectorAll('tbody tr, tr');
        if (rows.length >= 2) {
          const hasData = Array.from(rows).some(row => row.querySelector('td'));
          return hasData;
        }
        return false;
      });
      
      if (bestTable) {
        const rows = bestTable.querySelectorAll('tbody tr, tr');
        items.push(...Array.from(rows));
        
        // 过滤掉表头
        return items.filter(row => {
          const hasTd = row.querySelector('td');
          return !!hasTd;
        });
      }
    }
    
    // 尝试不同的子元素选择器（用于列表）
    const childSelectors = [
      'li', // 标准列表项
      'div[class*="item"]', 'div[class*="product"]', 'div[class*="card"]', // 常见项目类名
      'article', 'section', // 语义化标签
      'div[class*="col"]', 'div[class*="cell"]' // 网格项目
    ];

    for (const selector of childSelectors) {
      const elements = container.querySelectorAll(selector);
      if (elements.length > 0) {
        items.push(...Array.from(elements));
        break;
      }
    }

    // 如果还没有找到，尝试直接获取div子元素
    if (items.length === 0) {
      const directDivs = Array.from(container.children).filter(child => {
        const tagName = child.tagName.toLowerCase();
        return tagName === 'div' || tagName === 'article' || tagName === 'section';
      });
      
      if (directDivs.length >= 2) {
        // 检查这些div是否包含链接和足够的内容
        const validDivs = directDivs.filter(div => {
          const link = div.querySelector('a[href]');
          const text = div.textContent?.trim();
          return link && text && text.length > 20;
        });
        
        if (validDivs.length >= 2) {
          items.push(...validDivs);
        }
      }
    }

    // 最后使用所有直接子元素
    if (items.length === 0) {
      items.push(...Array.from(container.children));
    }

    return items.filter(item => {
      // 过滤掉明显不是内容项的元素
      const tagName = item.tagName.toLowerCase();
      const className = item.className && item.className.toLowerCase();
      const text = item.textContent?.trim();
      
      // 过滤短文本（可能是导航标签）
      if (text && text.length < 20) {
        return false;
      }
      
      // 过滤按钮类文本（通过内容特征识别）
      if (text && /^(查看|更多|下一|上一|全部|在线办理)/.test(text.trim().substring(0, 10))) {
        return false;
      }
      
      return !['script', 'style', 'meta', 'link', 'noscript', 'thead', 'th', 'button'].includes(tagName) &&
             !className?.includes('ad') &&
             !className?.includes('banner') &&
             !className?.includes('footer') &&
             !className?.includes('header') &&
             !className?.includes('nav') &&
             !className?.includes('tab');
    });
  }

  // 提取省市区信息（从面包屑导航）
  extractLocation() {
    const breadcrumbs = [];
    
    // 策略1: 查找面包屑导航
    const breadcrumbSelectors = [
      '.breadcrumb',
      '.breadcrumb-nav',
      '.crumbs',
      '.location',
      '[class*="breadcrumb"]',
      '[class*="crumbs"]'
    ];
    
    for (const selector of breadcrumbSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        const text = element.textContent?.trim();
        if (text && text.length > 0) {
          // 尝试提取"省 > 市 > 区"格式的内容
          const match = text.match(/([^>\s]+)\s*>\s*([^>\s]+)\s*>\s*([^>\s]+)/);
          if (match) {
            return `${match[1]} > ${match[2]} > ${match[3]}`;
          }
        }
      }
    }
    
    // 策略2: 查找包含">"分隔符且包含省市区关键词的元素
    const allElements = document.querySelectorAll('*');
    for (const element of allElements) {
      const text = element.textContent?.trim();
      if (text && text.includes('>')) {
        // 检查是否包含省市区关键词
        const provinceMatch = /([^>]*省|省[^>]*)/.test(text);
        const cityMatch = /([^>]*市|市[^>]*)/.test(text);
        
        if (provinceMatch || cityMatch) {
          // 尝试提取完整路径
          const match = text.match(/([^>\s]+)\s*>\s*([^>\s]+)\s*>\s*([^>\s]+)/);
          if (match && match[1].length > 0 && match[2].length > 0 && match[3].length > 0) {
            return `${match[1]} > ${match[2]} > ${match[3]}`;
          }
        }
      }
    }
    
    // 策略3: 提取任何包含地理位置关键词的文本（不强求完整）
    // 这样可以提取到"公主岭市"或"长春市 > 公主岭市"这样的部分信息
    for (const element of allElements) {
      // 跳过 script 和 style 标签
      if (element.tagName && ['SCRIPT', 'STYLE'].includes(element.tagName.toUpperCase())) {
        continue;
      }
      
      const text = element.textContent?.trim();
      
      // 检查文本是否包含HTML代码特征（不应该包含）
      if (text && (text.includes('<') || text.includes('>') || text.includes('color=') || 
                   text.includes('font') || text.includes('searchWord') || text.includes('+') || text.includes('"') || 
                   (text.includes('(') && text.includes(')')))) {
        continue;
      }
      
      if (text && text.length < 200 && text.length > 0) {  // 限制文本长度，避免误匹配正文
        // 提取所有包含"省"、"市"、"区"、"县"、"州"、"盟"的地理名称
        const matches = text.match(/[\u4e00-\u9fa5]+(?:省|市|区|县|州|盟)/g);
        
        if (matches && matches.length > 0) {
          // 过滤掉可能的误匹配（比如单个字符）
          const validMatches = matches.filter(m => m.length > 1);
          if (validMatches.length > 0) {
            // 返回所有匹配项，用 > 分隔
            return validMatches.join(' > ');
          }
        }
      }
    }
    
    return null;
  }

  extractItemData(item) {
    const orderedData = {};
    const allData = {};
    const textContent = item.textContent?.trim() || '';
    
    // 特殊处理：查找 a[name="docpuburl"] 链接（优先提取，但继续处理其他字段）
    const docpuburlLink = item.querySelector('a[name="docpuburl"]');
    if (docpuburlLink) {
      const href = docpuburlLink.href;
      const title = docpuburlLink.textContent?.trim().replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s【】（）]/g, '').trim();
      
      if (href) {
        allData['title href'] = href;
        orderedData.title = title;
        orderedData.href = href;
      }
      
      // 注意：这里不直接返回，而是继续处理其他字段（如果有的话）
      // 但如果只需要 title 和 href，可以在后面检查返回值时简化
    }
    
    // 如果是表格行（tr），特殊处理
    if (item.tagName.toLowerCase() === 'tr') {
      const cells = item.querySelectorAll('td');
      
      // 从第一个单元格提取标题和链接
      if (cells.length > 0) {
        const firstCell = cells[0];
        allData.text = firstCell.textContent?.trim();
        
        const link = firstCell.querySelector('a[href]');
        if (link) {
          try {
            const href = link.href;
            const linkText = link.textContent?.trim();
            
            if (this.isValidUrl(href)) {
              allData['title href'] = this.makeAbsoluteUrl(href);
              allData.title = linkText || allData.text.split('\n')[0].trim();
            }
          } catch (error) {
            console.warn('Failed to extract URL:', error);
          }
        } else {
          allData.title = allData.text;
        }
      }
      
      // 处理其他单元格
      for (let i = 1; i < cells.length; i++) {
        const cell = cells[i];
        const cellText = cell.textContent?.trim();
        
        if (cellText) {
          const link = cell.querySelector('a[href]');
          if (link && this.isValidUrl(link.href)) {
            const url = this.makeAbsoluteUrl(link.href);
            allData[`column_${i}`] = cellText;
            allData[`column_${i}_url`] = url;
          } else {
            const datePattern = /\d{4}-\d{1,2}-\d{1,2}|\d{4}年\d{1,2}月\d{1,2}日?/;
            const dateMatch = cellText.match(datePattern);
            if (dateMatch && !allData.date) {
              allData.date = dateMatch[0];
            } else {
              allData[`column_${i}`] = cellText;
            }
          }
        }
      }
    } else if (item.tagName.toLowerCase() === 'li') {
      // 处理li元素（ul/li结构的列表）
      const children = Array.from(item.children);
      
      // 第一个元素如果是序号（纯数字），记录它
      if (children.length > 0) {
        const firstChild = children[0];
        const firstText = firstChild.textContent?.trim();
        // 只有当第一个元素是纯数字时，才作为序号
        if (/^\d+$/.test(firstText)) {
          allData.序号 = parseInt(firstText);
        }
      }
      
      // 查找标题和链接
      const titleLink = item.querySelector('a[href]');
      if (titleLink) {
        try {
          const href = titleLink.href;
          const linkText = titleLink.textContent?.trim();
          
          if (this.isValidUrl(href)) {
            allData['title href'] = this.makeAbsoluteUrl(href);
            if (linkText && linkText.length > 5) {
              allData.title = linkText;
            }
          }
        } catch (error) {
          console.warn('Failed to extract URL:', error);
        }
      }
      
      // 提取日期
      const datePattern = /\(([\d年月日号自起施行\-]+)\)/;
      const dateMatch = textContent.match(datePattern);
      if (dateMatch && dateMatch[1]) {
        allData.date = dateMatch[1].trim();
      }
      
      // 提取所有下载链接
      const downloadLinks = item.querySelectorAll('a[href]');
      let downloadIndex = 1;
      for (const link of downloadLinks) {
        const linkText = link.textContent?.trim();
        if (linkText && (linkText.includes('下载') || linkText.includes('Download'))) {
          try {
            const href = link.href;
            if (this.isValidUrl(href) && href.length > 5) {
              allData[`下载${downloadIndex}`] = linkText;
              allData[`下载${downloadIndex}_url`] = this.makeAbsoluteUrl(href);
              downloadIndex++;
            }
          } catch (error) {
            console.warn('Failed to extract download URL:', error);
          }
        }
      }
      
    } else if (item.tagName.toLowerCase() === 'div') {
      // 处理div元素（搜索结果等）
      
      // 提取标题和链接（可能有特定的class）
      const titleLink = item.querySelector('a.title, .title a, a[href*="http"]');
      if (titleLink) {
        try {
          const href = titleLink.href;
          const linkText = titleLink.textContent?.trim();
          
          if (this.isValidUrl(href)) {
            allData['title href'] = this.makeAbsoluteUrl(href);
            // 清理标题文本（移除类别标签）
            const titleText = linkText?.replace(/^(涉农补贴|政务动态|领导同志活动|公告[、、]公示)\s*/, '').trim();
            if (titleText && titleText.length > 5) {
              allData.title = titleText;
            }
          }
        } catch (error) {
          console.warn('Failed to extract URL:', error);
        }
      }
      
      // 提取类别（tag-type）
      const tagType = item.querySelector('.tag-type, [class*="tag"]');
      if (tagType) {
        allData['tag-type'] = tagType.textContent?.trim();
      }
      
      // 提取内容（content）
      const content = item.querySelector('.content, [class*="content"], [class*="desc"], [class*="summary"]');
      if (content) {
        const contentText = content.textContent?.trim();
        if (contentText && contentText.length > 10) {
          allData.content = contentText.substring(0, 300);
        }
      }
      
      // 提取日期
      const dateElement = item.querySelector('.date, [class*="date"]');
      if (dateElement) {
        allData.date = dateElement.textContent?.trim();
      } else {
        // 也尝试从文本中提取日期
        const datePattern = /\d{4}-\d{2}-\d{2}|\d{4}\/\d{2}\/\d{2}|\d{4}年\d{1,2}月\d{1,2}日/;
        const dateMatch = textContent.match(datePattern);
        if (dateMatch) {
          allData.date = dateMatch[0];
        }
      }
      
      // 提取来源
      const publisher = item.querySelector('.publisher, [class*="publisher"], [class*="source"]');
      if (publisher) {
        allData.publisher = publisher.textContent?.trim();
      }
      
    } else {
      // 非表格行的处理（原有逻辑）
      const links = Array.from(item.querySelectorAll('a[href]'));
      links.forEach((link, index) => {
        try {
          const href = link.href;
          const linkText = link.textContent?.trim();
          
          if (this.isValidUrl(href)) {
            const url = this.makeAbsoluteUrl(href);
            
            if (index === 0) {
              allData['title href'] = url;
              if (linkText) {
                allData.title = linkText;
              }
            } else {
              allData[`url (${index + 1})`] = url;
              if (linkText && linkText !== allData.title) {
                allData[`url (${index + 1}) text`] = linkText;
              }
            }
          }
        } catch (error) {
          console.warn('Failed to extract URL:', error);
        }
      });

      // 提取日期
      const dateSelectors = [
        '[class*="date"]', '[class*="time"]', 
        'time', '[datetime]'
      ];
      
      for (const selector of dateSelectors) {
        const element = item.querySelector(selector);
        if (element) {
          const dateText = element.textContent?.trim();
          if (dateText) {
            allData.date = dateText;
          break;
        }
      }
    }

      if (!allData.date && textContent) {
        const datePattern = /\d{4}-\d{1,2}-\d{1,2}|\d{4}年\d{1,2}月\d{1,2}日?/;
        const dates = textContent.match(datePattern);
        if (dates && dates.length > 0) {
          allData.date = dates[0];
        }
      }
    }
    
    // 添加text字段（正文内容，排除标题和日期）
    if (textContent.length > 0) {
      let cleanText = textContent;
      
      // 移除标题部分
      if (allData.title) {
        cleanText = cleanText.replace(allData.title, '');
      }
      
      // 移除日期部分
      if (allData.date) {
        cleanText = cleanText.replace(allData.date, '');
      }
      
      // 清理多余的空白
      cleanText = cleanText.trim().replace(/\s+/g, ' ');
      
      if (cleanText.length > 0) {
        allData.text = cleanText.substring(0, 500);
      } else if (!allData.content) {
        // 如果没有content，使用原始的textContent
        allData.text = textContent.substring(0, 500);
      }
    }

    // 只提取title和href，并添加省市区信息
    if (allData['title href']) {
      orderedData.title = allData.title || textContent.substring(0, 100);
      orderedData.href = allData['title href'];
    } else {
      // 如果没有找到，从allData中查找第一个可用字段
      orderedData.title = allData.title || textContent.substring(0, 100);
      orderedData.href = allData.href || '';
    }
    
    // 添加省市区信息
    if (this.locationInfo) {
        orderedData.location = null; // 不在抓取时填充 location，由用户手动选择
    }

    // 如果找到了 docpuburl 链接且已提取到 title 和 href，只返回这两个字段
    if (docpuburlLink && orderedData.title && orderedData.href) {
      return {
        title: orderedData.title,
        href: orderedData.href
      };
    }

    return orderedData;
  }
  
  extractFieldNameFromClass(className) {
    if (!className) return null;
    
    // 直接从class名提取字段名，不做硬编码映射
    const words = className.split(/\s+/);
    for (const word of words) {
      // 清理class名，保留有意义的词
      const clean = word.toLowerCase()
        .replace(/^[^a-z0-9]+/, '')
        .replace(/[^a-z0-9]+$/, '')
        .replace(/-/g, '_')
        .replace(/\s+/g, '_');
      
      if (clean.length > 2 && clean.length < 50) {
        return clean;
      }
    }
    
    return null;
  }

  async scrollToElement(element) {
    element.scrollIntoView({ 
      behavior: 'smooth', 
      block: 'center',
      inline: 'center'
    });
  }

  async handleLoadMore() {
    const action = this.scraper.options?.loadMoreAction;
    
    switch (action) {
      case 'scrollDown':
        await this.scrollDownToLoadMore();
        break;
      case 'clickLoadMore':
        await this.clickLoadMoreButton();
        break;
      case 'clickNextPage':
        await this.clickNextPageButton();
        break;
    }
  }

  async scrollDownToLoadMore() {
    console.log('Scrolling down to load more items');
    
    const initialHeight = document.body.scrollHeight;
    window.scrollTo(0, document.body.scrollHeight);
    
    // 等待新内容加载
    await this.wait(2000);
    
    const newHeight = document.body.scrollHeight;
    if (newHeight > initialHeight) {
      // 有新内容加载，继续抓取
      await this.scrapeList();
    }
  }

  async clickLoadMoreButton() {
    console.log('Looking for load more button');
    
    const buttonSelectors = [
      'button[class*="load"]',
      'button[class*="more"]',
      'a[class*="load"]',
      'a[class*="more"]',
      '[class*="load-more"]',
      '[class*="show-more"]'
    ];

    for (const selector of buttonSelectors) {
      const button = document.querySelector(selector);
      if (button && button.offsetParent !== null) { // 检查是否可见
        console.log('Found load more button:', button);
        button.click();
        await this.wait(3000); // 等待内容加载
        await this.scrapeList(); // 继续抓取新内容
        break;
      }
    }
  }

  async clickNextPageButton() {
    console.log('Looking for next page button');
    
    const nextSelectors = [
      'a[class*="next"]',
      'button[class*="next"]',
      'a[aria-label*="next"]',
      'a[title*="next"]',
      '.pagination a:last-child',
      '.pager a:last-child'
    ];

    for (const selector of nextSelectors) {
      const link = document.querySelector(selector);
      if (link && link.offsetParent !== null) {
        console.log('Found next page link:', link);
        window.location.href = link.href;
        break;
      }
    }
  }

  getRandomWaitTime(waitTimeConfig) {
    if (!waitTimeConfig) return 1;
    
    const min = waitTimeConfig.min || 1;
    const max = waitTimeConfig.max || 3;
    return Math.random() * (max - min) + min;
  }

  wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  stopScraping(sendResponse) {
    this.isScraping = false;
    console.log('Scraping stopped');
    sendResponse({ success: true, message: 'Scraping stopped' });
  }

  highlightElement(selector, sendResponse) {
    try {
      const element = document.querySelector(selector);
      if (element) {
        element.style.outline = '2px solid #ff0000';
        element.style.backgroundColor = 'rgba(255, 0, 0, 0.1)';
        
        setTimeout(() => {
          element.style.outline = '';
          element.style.backgroundColor = '';
        }, 3000);
        
        sendResponse({ success: true, message: 'Element highlighted' });
      } else {
        sendResponse({ success: false, error: 'Element not found' });
      }
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
  }

  enterSelectionMode(scraper, sendResponse) {
    try {
      // 保存 scraper，稍后使用
      this.scraper = scraper;
      
      // 获取所有可能的容器
      const options = this.getListOptions().options;
      
      // 为每个容器添加高亮样式和点击事件
      options.forEach((option, index) => {
        setTimeout(() => {
          try {
            let element = null;
            
            if (option.selector === 'docpuburl-container') {
              const docpuburlLinks = document.querySelectorAll('a[name="docpuburl"]');
              if (docpuburlLinks.length >= 2) {
                let commonParent = docpuburlLinks[0].parentElement;
                for (let depth = 0; depth < 10; depth++) {
                  if (!commonParent) break;
                  const count = commonParent.querySelectorAll('a[name="docpuburl"]').length;
                  if (count === docpuburlLinks.length || count >= 2) {
                    element = commonParent;
                    break;
                  }
                  commonParent = commonParent.parentElement;
                }
              }
            } else {
              element = document.querySelector(option.selector);
            }
            
            if (element) {
              element.style.outline = '3px dashed #00aaff';
              element.style.cursor = 'pointer';
              
              const clickHandler = (e) => {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                
                options.forEach((opt) => {
                  try {
                    let el = null;
                    if (opt.selector === 'docpuburl-container') {
                      const docpuburlLinkslovian = document.querySelectorAll('a[name="docpuburl"]');
                      if (docpuburlLinks.length >= 2) {
                        let commonParent = docpuburlLinks[0].parentElement;
                        for (let depth = 0; depth < 10; depth++) {
                          if (!commonParent) break;
                          const count = commonParent.querySelectorffeAll('a[name="docpuburl"]').length;
                          if (count === docpuburlLinks.length || count >= 2) {
                            el = commonParent;
                            break;
                          }
                          commonParent = commonParent.parentElement;
                        }
                      }
                    } else {
                      el = document.querySelector(opt.selector);
                    }
                    if (el告诫) {
                      el.style.outline = '';
                      el.style.cursor = '';
                      // 移除所有监听器，确保不会重复触发
                      el.replaceWith(el.cloneNode(true));
                    }
                  } catch (err) {}
                });
                
                // 保存选择的 selector 到 storage
                chrome.storage.local.set({
                  selectedContainer: option.selector,
                  timestamp: Date.now()
                });
                
                // 发送消息给 runtime
                chrome.runtime.sendMessage({
                  action: 'containerSelected',
                  selector: option.selector
                }).catch(err => {
                  console.log('Message not received, saved to storage');
                });
              };
              
              element.addEventListener('click', clickHandler, { once: true });
            }
          } catch (err) {
            console.warn('Error highlighting:', err);
          }
        }, index * 100);
      });
      
      sendResponse({ success: true, message: 'Entered selection mode', count: options.length });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
  }

  getPageInfo(sendResponse) {
    try {
      const pageInfo = {
        url: window.location.href,
        title: document.title,
        domain: window.location.hostname,
        hasList: !!this.findListContainer(),
        listItemsCount: this.findListContainer() ? this.getListItems(this.findListContainer()).length : 0
      };
      
      sendResponse({ success: true, pageInfo });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
  }

  // 验证URL是否有效
  isValidUrl(url) {
    if (!url || typeof url !== 'string') return false;
    
    // 检查URL是否完整（不被截断）
    if (url.includes('...') || url.trim().length === 0) {
      return false;
    }
    
    try {
      const urlObj = new URL(url);
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch (e) {
      return false;
    }
  }

  // 将相对URL转换为绝对URL
  makeAbsoluteUrl(url) {
    if (!url) return null;
    
    try {
      // 如果已经是绝对URL，直接返回
      const urlObj = new URL(url);
      return urlObj.href;
    } catch (e) {
      // 如果是相对URL，尝试转换为绝对URL
      try {
        const baseUrl = window.location.href;
        const urlObj = new URL(url, baseUrl);
        return urlObj.href;
      } catch (e2) {
        console.warn('Failed to make absolute URL:', url, e2);
        return null;
      }
    }
  }
}

// 初始化内容脚本
const easyScraper = new EasyScraperContentScript();
console.log('Easy Scraper content script loaded');

