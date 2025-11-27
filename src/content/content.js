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
    this.autoRestoreKeywordHelper();
  }
  
  // 自动恢复关键词选择器（页面刷新后）
  async autoRestoreKeywordHelper() {
    try {
      // 等待页面加载完成
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
          this.checkAndRestoreKeywordHelper();
        });
      } else {
        // 页面已加载，延迟一点确保DOM完全就绪
        setTimeout(() => {
          this.checkAndRestoreKeywordHelper();
        }, 500);
      }
    } catch (error) {
      console.log('自动恢复关键词选择器检查失败:', error);
    }
  }
  
  // 检查并恢复关键词选择器
  async checkAndRestoreKeywordHelper() {
    try {
      const result = await chrome.storage.local.get(['keywordHelperVisible']);
      if (result.keywordHelperVisible) {
        // 检查是否已经存在选择器
        const existingSelector = document.querySelector('#scraper-keyword-selector-sidebar');
        if (!existingSelector) {
          console.log('🔄 检测到页面刷新，自动恢复关键词选择器');
          // 自动创建选择器
          this.addSearchKeywordHelper();
        }
      }
    } catch (error) {
      console.log('检查关键词选择器状态失败:', error);
    }
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
          
        case 'addSearchKeywordHelper':
          this.addSearchKeywordHelper().then(result => {
            sendResponse(result);
          }).catch(error => {
            sendResponse({ success: false, error: error.message });
          });
          return true; // 保持通道开放以支持异步响应
          
        case 'removeSearchKeywordHelper':
          const removeResult = this.removeSearchKeywordHelper();
          sendResponse(removeResult);
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
    console.log('=== 🚀 开始抓取列表 ===');
    console.log('自定义选择器:', this.customSelector);
    
    // 不使用页面自动提取省市区信息，让用户手动选择
    this.locationInfo = null;
    
    // 查找列表容器（使用自定义选择器）
    console.log('📍 步骤1: 查找列表容器...');
    const listContainer = this.findListContainer(this.customSelector);
    console.log('✅ 找到容器:', listContainer);
    console.log('   - 容器类型:', listContainer?.tagName || typeof listContainer);
    console.log('   - 容器 ID:', listContainer?.id);
    console.log('   - 容器 class:', listContainer?.className);
    
    if (!listContainer) {
      console.error('❌ 未找到列表容器');
      throw new Error('Unable to find list on page');
    }

    // 获取列表项
    console.log('📍 步骤2: 获取列表项...');
    const listItems = this.getListItems(listContainer);
    console.log('✅ 获取到列表项数量:', listItems.length);
    
    if (listItems.length === 0) {
      console.error('❌ 列表项数量为0，抓取失败');
      console.error('   - 容器信息:', {
        tagName: listContainer?.tagName,
        id: listContainer?.id,
        className: listContainer?.className,
        innerHTML: listContainer?.innerHTML?.substring(0, 200)
      });
      throw new Error('No list items found');
    }

    console.log(`✅ 找到 ${listItems.length} 个列表项，开始提取数据...`);

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
    console.log('🔍 getListOptions: 开始识别页面列表');
    const options = [];
    const seenElements = new Set(); // 用于跟踪已经处理过的元素
    
    // 策略0-0.1: 优先识别搜索结果区域（包含"当前搜索到"、"搜索结果"等关键词）
    console.log('🔍 策略0-0.1: 识别搜索结果区域');
    const searchKeywords = ['当前搜索到', '搜索结果', '找到.*结果', '共.*条', 'search.*result', '相关结果', '网站内容'];
    for (const keyword of searchKeywords) {
      const searchArea = Array.from(document.querySelectorAll('*')).find(el => {
        const text = el.textContent || '';
        return new RegExp(keyword).test(text);
      });
      
      if (searchArea) {
        console.log(`  ✅ 找到搜索结果区域（关键词"${keyword}"）`);
        
        // 策略0-0.1.2: 优先查找 div 容器中包含多个链接的结构（非标准列表）
        console.log('  🔍 策略0-0.1.2: 查找div容器中的链接列表（优先）');
        
        // 优先查找包含"网站内容"标题的div容器
        const websiteContentDivs = Array.from(searchArea.querySelectorAll('div')).filter(div => {
          // 查找包含"网站内容"标题
          const title = div.querySelector('h3, h2, h1, .title, [class*="title"]');
          const hasTitle = title?.textContent?.includes('网站内容');
          
          // 或者div的文本内容包含"网站内容"且包含多个链接
          const hasWebsiteContentText = div.textContent?.includes('网站内容');
          const linkCount = div.querySelectorAll('a[href]').length;
          
          return (hasTitle || hasWebsiteContentText) && linkCount >= 5;
        });
        
        for (const div of websiteContentDivs) {
          // 查找该div内的所有链接（排除标题链接）
          const allLinks = div.querySelectorAll('a[href]');
          const validLinks = Array.from(allLinks).filter(link => {
            const href = link.href;
            const text = link.textContent?.trim();
            const parent = link.parentElement;
            
            // 排除javascript链接和空链接
            if (!href || href.startsWith('javascript:') || !text || text.length < 10) {
              return false;
            }
            
            // 排除标题中的链接（通常是"网站内容"标题本身）
            if (parent && (parent.tagName === 'H1' || parent.tagName === 'H2' || parent.tagName === 'H3')) {
              return false;
            }
            
            // 排除包含"没有相关"的链接
            if (text.includes('没有相关')) {
              return false;
            }
            
            // 排除导航链接（通常很短）
            if (text.length < 15 && (text.includes('全部结果') || text.includes('服务事项') || text.includes('高级'))) {
              return false;
            }
            
            return true;
          });
          
          if (validLinks.length >= 5) {
            const preview = validLinks[0]?.textContent?.trim().substring(0, 100) || '';
            
            // 生成选择器：优先使用div的class
            let selector = 'div';
            if (div.className) {
              const classes = div.className.split(' ').filter(c => c && !c.includes('full_text_search_module-sort'));
              if (classes.length > 0) {
                selector = `.${classes[0]}`;
              }
            } else if (div.id) {
              selector = `#${div.id}`;
            }
            
            // 生成精确选择器：选择该div内的链接
            let preciseSelector = `${selector} a[href]`;
            
            // 如果搜索结果区域有class，使用更精确的选择器
            if (searchArea.className) {
              const areaClass = searchArea.className.split(' ')[0];
              preciseSelector = `.${areaClass} ${selector} a[href]`;
            }
            
            console.log(`  ✅ 找到div容器搜索结果: ${preciseSelector}, ${validLinks.length} 项`);
            console.log(`  预览: ${preview.substring(0, 80)}...`);
            
            options.push({
              selector: preciseSelector,
              type: '搜索结果列表（div容器）',
              itemCount: validLinks.length,
              preview: preview,
              description: `搜索结果（div容器） - ${validLinks.length} 项 - ${preview.substring(0, 50)}...`,
              priority: -1 // 比ul/ol更高的优先级（数字越小优先级越高）
            });
            seenElements.add(div);
            
            // 找到搜索结果后直接返回（div容器优先于ul/ol）
            console.log(`🎉 通过div容器找到搜索结果，直接返回（优先级最高）`);
            return { options };
          }
        }
        
        // 策略0-0.1.1: 查找标准的 ul/ol 列表（在div容器之后）
        const lists = searchArea.querySelectorAll('ul, ol');
        console.log(`  在搜索结果区域内找到 ${lists.length} 个列表`);
        
        for (const list of lists) {
          const items = list.querySelectorAll('li');
          console.log(`  检查列表: ${list.id || list.className || 'ul'} - ${items.length} 个li`);
          
          // 先检查有效项数量，而不是先跳过
          if (items.length >= 5) { // 搜索结果通常有多个
            const validItems = Array.from(items).filter(item => {
              // 直接检查第一个链接
              const firstLink = item.querySelector('a[href]');
              const text = item.textContent?.trim();
              return firstLink && text && text.length > 10;
            });
            
            console.log(`  有效项: ${validItems.length}`);
            
            // 检查是否被判定为导航或分页
            const isNav = this.isNavigationList(list);
            const isPagination = this.isPaginationList(list);
            console.log(`  判断结果: isNav=${isNav}, isPagination=${isPagination}`);
            
            // 如果有效项足够多（>=5），即使被误判为导航，也认为是搜索结果
            // 但如果是明确的分页列表（如 class="pagination"），仍然跳过
            if (isPagination && list.classList.contains('pagination')) {
              console.log(`  跳过: 明确的分页列表`);
              continue;
            }
            
            if (validItems.length >= 5) {
              const preview = validItems[0]?.textContent?.trim().substring(0, 100) || '';
              
              // 生成选择器：优先使用搜索结果区域的class
              let selector = 'ul';
              if (list.className) {
                selector = `.${list.className.split(' ')[0]}`;
              } else if (list.id) {
                selector = `#${list.id}`;
              }
              
              // 如果搜索结果区域有class，使用更精确的选择器
              let preciseSelector = selector;
              if (searchArea.className) {
                const areaClass = searchArea.className.split(' ')[0];
                preciseSelector = `.${areaClass} ${selector}:not(#headBanner):not(.pagination)`;
              } else {
                // 如果没有class，使用通用选择器但排除导航和分页
                preciseSelector = `${selector}:not(#headBanner):not(.pagination)`;
              }
              
              console.log(`  ✅ 找到搜索结果列表: ${preciseSelector}, ${validItems.length} 项`);
              
              options.push({
                selector: preciseSelector,
                type: '搜索结果列表',
                itemCount: validItems.length,
                preview: preview,
                description: `搜索结果 - ${validItems.length} 项 - ${preview.substring(0, 50)}...`,
                priority: 0 // 最高优先级
              });
              seenElements.add(list);
              
              // 找到搜索结果后直接返回
              console.log(`🎉 通过搜索结果区域找到列表，直接返回`);
              return { options };
            }
          }
        }
      }
    }
    
    // 策略0-0: 优先查找明确的搜索结果列表（ul/ol 带 list/result/search 等关键id/class）
    console.log('🔍 策略0-0: 优先查找搜索结果列表');
    const searchLists = document.querySelectorAll('ul[id*="list"], ul[class*="list"], ul[id*="result"], ul[class*="result"], ol[id*="list"], ol[class*="list"]');
    searchLists.forEach((list, index) => {
      // 使用通用函数排除导航菜单和分页列表
      if (this.isNavigationList(list)) {
        console.log(`  跳过导航列表: ${list.id || list.className}`);
        return;
      }
      
      if (this.isPaginationList(list)) {
        console.log(`  跳过分页列表: ${list.id || list.className}`);
        return;
      }
      
      const items = list.querySelectorAll('li');
      if (items.length >= 2) {
        const validItems = Array.from(items).filter(item => {
          const link = item.querySelector('a[href]');
          const text = item.textContent?.trim();
          return text && text.length > 10 && link;
        });
        
        if (validItems.length >= 2) {
          const preview = validItems[0]?.textContent?.trim().substring(0, 100) || '';
          const selector = list.id ? `#${list.id}` : list.className ? `.${list.className.split(' ')[0]}` : 'ul';
          console.log(`  ✅ 找到搜索结果列表: ${selector}, ${validItems.length} 项`);
          
          options.push({
            selector,
            type: '搜索结果列表',
            itemCount: validItems.length,
            preview: preview,
            description: `${list.tagName.toLowerCase()} - ${validItems.length} 项 - ${preview.substring(0, 50)}...`,
            priority: 1 // 最高优先级
          });
          seenElements.add(list);
        }
      }
    });
    
    // 如果已经找到搜索结果列表，直接返回
    if (options.length > 0) {
      console.log(`🎉 找到 ${options.length} 个搜索结果列表，直接返回`);
      return { options };
    }
    
    // 策略0-0.5: 特殊识别 - 查找包含多个 div.msg.discuss 的容器（滑县网站等）
    console.log('🔍 策略0-0.5: 查找 div.msg.discuss 结构');
    const msgDiscussDivs = document.querySelectorAll('div.msg.discuss, div[class*="msg"]');
    if (msgDiscussDivs.length >= 5) {
      // 找到它们的共同父容器
      const parent = msgDiscussDivs[0].parentElement;
      if (parent) {
        const childrenInParent = parent.querySelectorAll('div.msg.discuss, div[class*="msg"]');
        if (childrenInParent.length >= 5) {
          const preview = msgDiscussDivs[0].textContent?.trim().substring(0, 100) || '';
          const selector = parent.className ? `.${parent.className.split(' ')[0]}` : 'div';
          console.log(`  ✅ 找到 msg 容器: ${selector}, ${childrenInParent.length} 项`);
          
          options.push({
            selector: selector,
            type: '搜索结果容器',
            itemCount: childrenInParent.length,
            preview: preview,
            description: `${parent.tagName.toLowerCase()} - ${childrenInParent.length} 项 - ${preview.substring(0, 50)}...`,
            priority: 1
          });
          
          console.log(`🎉 找到 msg 搜索结果，直接返回`);
          return { options };
        }
      }
    }
    
    // 策略0-0.6: 特殊识别 - 查找 div.result-list 或 div.s-result 结构（临颍县、舞阳县、宁陵县等）
    console.log('🔍 策略0-0.6: 查找 div.result-list / div.s-result 结构');
    const resultListDivs = document.querySelectorAll('div.result-list, div[class*="result-list"], div.s-result, div[class*="s-result"]');
    console.log(`  找到 ${resultListDivs.length} 个 result 容器 div`);
    
    // 收集所有找到的ul及其有效li数量，然后选择最佳的
    const foundUls = [];
    
    resultListDivs.forEach((div, index) => {
      // 查找内部的 ul
      const ul = div.querySelector('ul');
      if (ul) {
        const lis = ul.querySelectorAll('li');
        console.log(`  result容器 ${index + 1} (${div.className.split(' ')[0]}): 内部ul包含 ${lis.length} 个li`);
        
        if (lis.length >= 1) {
          const validLis = Array.from(lis).filter(li => {
            const link = li.querySelector('a[href]');
            const text = li.textContent?.trim();
            return link && text && text.length > 30;
          });
          
          console.log(`    有效li数量: ${validLis.length}`);
          
          if (validLis.length >= 1) {
            const preview = validLis[0]?.textContent?.trim().substring(0, 100) || '';
            const selector = ul.className ? `ul.${ul.className.split(' ')[0]}` : `div.${div.className.split(' ')[0]} ul`;
            
            foundUls.push({
              ul: ul,
              selector: selector,
              validCount: validLis.length,
              preview: preview,
              parentDiv: div
            });
          }
        }
      } else {
        // 没有ul，直接查找li（兼容其他结构）
        const lis = div.querySelectorAll('li');
        if (lis.length >= 1) {
          const validLis = Array.from(lis).filter(li => {
            const link = li.querySelector('a[href]');
            const text = li.textContent?.trim();
            return link && text && text.length > 30;
          });
          
          if (validLis.length >= 1) {
            const preview = validLis[0]?.textContent?.trim().substring(0, 100) || '';
            const selector = div.className ? `.${div.className.split(' ')[0]}` : 'div.result-list';
            console.log(`  ✅ 找到 result 容器（无ul）: ${selector}, ${validLis.length} 项`);
            
            options.push({
              selector: selector,
              type: '搜索结果列表',
              itemCount: validLis.length,
              preview: preview,
              description: `${div.tagName.toLowerCase()} - ${validLis.length} 项 - ${preview.substring(0, 50)}...`,
              priority: 1
            });
            seenElements.add(div);
          }
        }
      }
    });
    
    // 如果找到了多个ul，选择有效li数量最多的那个
    if (foundUls.length > 0) {
      foundUls.sort((a, b) => b.validCount - a.validCount);
      const best = foundUls[0];
      console.log(`  ✅ 选择最佳 ul 容器: ${best.selector}, ${best.validCount} 项（从${foundUls.length}个候选中选出）`);
      
      options.push({
        selector: best.selector,
        type: '搜索结果列表',
        itemCount: best.validCount,
        preview: best.preview,
        description: `ul - ${best.validCount} 项 - ${best.preview.substring(0, 50)}...`,
        priority: 1
      });
      seenElements.add(best.ul);
    }
    
    // 如果已经找到搜索结果列表，直接返回
    if (options.length > 0) {
      console.log(`🎉 通过 result-list 找到 ${options.length} 个选项，直接返回`);
      return { options };
    }
    
    // 策略0-1: 通用搜索结果检测（基于规律，而非特定类名）
    // 方法A: 查找包含特定类名模式的 div
    const allDivs = document.querySelectorAll('div[class*="result"], div[class*="item"], div[class*="news"], div[class*="list"]');
    
    const divGroups = new Map();
    allDivs.forEach(div => {
      const hasLink = div.querySelector('a[href]');
      if (!hasLink) return;
      
      const text = div.textContent?.trim();
      if (!text || text.length < 20) return;
      
      const firstClass = div.className.split(' ')[0];
      if (!firstClass) return;
      
      if (!divGroups.has(firstClass)) {
        divGroups.set(firstClass, []);
      }
      divGroups.get(firstClass).push(div);
    });
    
    divGroups.forEach((divs, className) => {
      if (divs.length >= 2) {
        const preview = divs[0].querySelector('a')?.textContent?.trim() || '';
        options.push({
          selector: `.${className}`,
          type: '搜索结果',
          itemCount: divs.length,
          preview: preview,
          description: `搜索结果 - ${divs.length} 项 - ${preview.substring(0, 50)}...`,
          isSearchResult: true
        });
      }
    });
    
    // 方法B: 查找包含长文本标题链接的元素（如曹县的 div.row > div > a）
    const titleLinks = [];
    const allLinks = document.querySelectorAll('a[href]');
    
    allLinks.forEach(link => {
      const text = link.textContent?.trim();
      const href = link.href;
      
      // 过滤：文本长度>10，URL包含.html，非导航链接
      if (text && text.length > 10 && 
          href && href.includes('.html') &&
          !href.includes('jiansuo') && !href.includes('search') &&
          !text.includes('首页') && !text.includes('下页') && !text.includes('上页')) {
        titleLinks.push(link);
      }
    });
    
    // 如果找到多个标题链接，尝试找共同的祖父容器
    if (titleLinks.length >= 2) {
      const firstLink = titleLinks[0];
      let grandParent = firstLink.parentElement?.parentElement;
      
      if (grandParent && grandParent.className) {
        // 检查所有标题链接是否都在相同结构的元素中
        const selector = grandParent.className.split(' ')[0];
        const matchingElements = document.querySelectorAll(`.${selector}`);
        
        // 统计包含标题链接的元素数量
        let matchCount = 0;
        matchingElements.forEach(elem => {
          const hasResultLink = Array.from(elem.querySelectorAll('a[href]')).some(a => {
            const text = a.textContent?.trim();
            const href = a.href;
            return text && text.length > 10 && href && href.includes('.html');
          });
          if (hasResultLink) matchCount++;
        });
        
        if (matchCount >= 2) {
          const preview = firstLink.textContent?.trim() || '';
          options.push({
            selector: `.${selector}`,
            type: '搜索结果',
            itemCount: matchCount,
            preview: preview,
            description: `搜索结果 - ${matchCount} 项 - ${preview.substring(0, 50)}...`,
            isSearchResult: true
          });
        }
      }
    }
    
    if (options.length > 0) {
      console.log('Found search results by pattern:', options);
      return { options };
    }
    
    // 策略0-2: 检查是否有 a[name="docpuburl"] 的搜索结果
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
      
      // 跳过单条结果的详情表（行数少于5的 table.detail）
      if (tagName === 'table' && className.includes('detail')) {
        const rows = element.querySelectorAll('tr');
        if (rows.length < 5) {
          console.log('跳过详情表:', className, ', 行数:', rows.length);
          return;
        }
      }
      
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
  
  // 通用辅助函数：判断是否是导航菜单
  isNavigationList(list) {
    // 1. 检查是否在导航区域
    if (list.closest('header, nav, [class*="nav"], [class*="menu"], footer, [class*="footer"]')) {
      return true;
    }
    
    // 2. 检查是否有特定的导航ID或class
    if (list.id === 'headBanner' || list.classList.contains('nav') || list.classList.contains('menu')) {
      return true;
    }
    
    // 3. 检查链接特征：导航菜单通常有很多短链接，且第一个链接也很短
    const links = list.querySelectorAll('a[href]');
    if (links.length > 0) {
      // 检查第一个链接的长度（导航菜单的第一个链接通常很短）
      const firstLink = links[0];
      const firstLinkText = firstLink.textContent?.trim() || '';
      
      // 如果第一个链接就很短（<15字符），且大部分链接都很短，可能是导航菜单
      if (firstLinkText.length < 15) {
        const shortLinks = Array.from(links).filter(link => {
          const text = link.textContent?.trim();
          return text && text.length < 20;
        });
        // 如果大部分链接都很短，可能是导航菜单
        if (shortLinks.length / links.length > 0.7) {
          return true;
        }
      }
      
      // 如果第一个链接很长（>50字符），很可能是搜索结果列表，不是导航菜单
      if (firstLinkText.length > 50) {
        return false;
      }
    }
    
    // 4. 检查是否包含常见的导航关键词
    const text = list.textContent?.toLowerCase() || '';
    const navKeywords = ['首页', '关于', '联系', '登录', '注册', '更多'];
    const navKeywordCount = navKeywords.filter(kw => text.includes(kw)).length;
    // 提高阈值：至少4个导航关键词才认为是导航菜单
    if (navKeywordCount >= 4) {
      return true;
    }
    
    return false;
  }

  // 通用辅助函数：判断是否是分页列表
  isPaginationList(list) {
    const text = list.textContent || '';
    // 分页通常包含：数字 + "页" 或 "共" + 数字 + "条"
    const paginationPattern = /(共|第)\s*\d+\s*(页|条|记录)/;
    if (paginationPattern.test(text)) {
      return true;
    }
    
    // 检查是否包含分页按钮特征
    const hasPageNumbers = list.querySelectorAll('a, button').length > 0;
    const hasPageText = /[上一|下一|首页|尾页]/.test(text);
    if (hasPageNumbers && hasPageText) {
      return true;
    }
    
    return false;
  }

  // 通用辅助函数：智能选择标题链接
  selectTitleLink(item) {
    const allLinks = Array.from(item.querySelectorAll('a[href]'));
    if (allLinks.length === 0) return null;
    
    // 如果只有一个链接，直接返回
    if (allLinks.length === 1) return allLinks[0];
    
    // 评分系统选择最佳链接
    let bestLink = allLinks[0];
    let bestScore = -Infinity;
    
    allLinks.forEach((link, index) => {
      const text = link.textContent?.trim() || '';
      const href = link.href || '';
      
      // 评分规则（分数越高越好）
      let score = 0;
      
      // 1. 第一个链接优先（通常是标题）
      if (index === 0) score += 15;
      
      // 2. 文本长度评分（标题通常在10-150字符）
      if (text.length >= 10 && text.length <= 150) {
        score += 25; // 最佳长度范围
      } else if (text.length > 5 && text.length < 10) {
        score += 5; // 太短，可能是标签
      } else if (text.length > 150 && text.length < 300) {
        score += 10; // 稍长，可能是标题+摘要
      } else if (text.length >= 300) {
        score -= 20; // 太长，很可能是摘要
      }
      
      // 3. 包含日期格式（标题可能包含日期，但摘要通常也包含）
      const dateCount = (text.match(/\d{4}[-年]\d{1,2}[-月]\d{1,2}/g) || []).length;
      if (dateCount === 1 && text.length < 100) {
        // 只有一个日期且文本不太长，可能是标题
        score += 5;
      } else if (dateCount > 1 || (dateCount === 1 && text.length > 200)) {
        // 多个日期或日期+长文本，可能是摘要
        score -= 10;
      }
      
      // 4. URL 特征：包含 detail/article/news/content 等加分
      if (/detail|article|news|content|view|show/.test(href.toLowerCase())) {
        score += 8;
      }
      
      // 5. 避免选择包含完整URL文本的链接（通常是显示用的）
      if (text.startsWith('http://') || text.startsWith('https://')) {
        score -= 25;
      }
      
      // 6. 避免选择文本完全是URL格式的
      if (/^https?:\/\//.test(text.trim())) {
        score -= 20;
      }
      
      // 7. 检查是否包含明显的摘要特征（长段落、多个句子）
      const sentenceCount = text.split(/[。！？]/).length;
      if (sentenceCount > 3 && text.length > 200) {
        score -= 15; // 多个句子，很可能是摘要
      }
      
      // 8. 检查链接在DOM中的位置（第一个子元素通常是标题）
      const isFirstChild = link.parentElement && 
                           link.parentElement.firstElementChild === link;
      if (isFirstChild) {
        score += 10;
      }
      
      if (score > bestScore) {
        bestScore = score;
        bestLink = link;
      }
    });
    
    return bestLink;
  }

  // 通用辅助函数：清理标题文本
  cleanTitleText(text) {
    if (!text) return '';
    
    let cleaned = text.trim();
    const originalLength = cleaned.length;
    
    // 1. 去掉日期格式（通用模式：YYYY-MM-DD, YYYY年MM月DD日等）
    cleaned = cleaned.replace(/\d{4}[-年\/]\d{1,2}[-月\/]\d{1,2}[日]?/g, '');
    
    // 2. 去掉开头和结尾的短标签（2-6个中文字符，通常是分类）
    // 使用更智能的方式：检查是否是独立的标签（前后有空格/换行，且后面跟着标题内容）
    // 去掉开头的短标签（2-6个字符，后面跟着空格或换行）
    cleaned = cleaned.replace(/^[\u4e00-\u9fa5]{2,6}[\s\n\r\t]+/g, '');
    // 去掉结尾的短标签（前面有空格或换行）
    cleaned = cleaned.replace(/[\s\n\r\t]+[\u4e00-\u9fa5]{2,6}$/g, '');
    
    // 3. 合并多个空格、换行和制表符
    cleaned = cleaned.replace(/[\s\n\r\t]+/g, ' ').trim();
    
    // 4. 如果清理后太短（少于原长度的30%或少于5个字符），返回原始文本
    if (cleaned.length < Math.max(5, originalLength * 0.3)) {
      return text.trim();
    }
    
    // 5. 如果清理后的文本仍然很长（>200字符），可能是摘要，尝试提取前100字符
    if (cleaned.length > 200) {
      // 尝试找到第一个句号或换行，提取到那里
      const firstSentence = cleaned.match(/^[^。！？\n]+/);
      if (firstSentence && firstSentence[0].length > 10 && firstSentence[0].length < 150) {
        return firstSentence[0].trim();
      }
      // 否则截取前100字符
      return cleaned.substring(0, 100).trim();
    }
    
    return cleaned;
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
        const elements = document.querySelectorAll(selector);
        console.log(`  Selector ${selector} 匹配到 ${elements.length} 个元素`);
        
        // 特殊处理1：如果选择器匹配多个 ul/ol，选择包含最多有效li的那个
        if (elements.length >= 2 && (elements[0].tagName === 'UL' || elements[0].tagName === 'OL')) {
          console.log(`  检测到多个 ${elements[0].tagName}，选择最佳的...`);
          
          let bestUl = null;
          let maxValidLi = 0;
          
          elements.forEach((ul, index) => {
            const lis = ul.querySelectorAll('li');
            const validLis = Array.from(lis).filter(li => {
              const link = li.querySelector('a[href]');
              const text = li.textContent?.trim();
              return link && text && text.length > 30;
            });
            
            console.log(`    ul ${index + 1}: ${lis.length} 个li, ${validLis.length} 个有效li`);
            
            if (validLis.length > maxValidLi) {
              maxValidLi = validLis.length;
              bestUl = ul;
            }
          });
          
          if (bestUl) {
            console.log(`  ✅ 选择了包含 ${maxValidLi} 个有效li的ul`);
            return bestUl;
          }
        }
        
        // 特殊处理2：如果选择器能匹配多个非ul/ol元素，返回选择器本身
        if (elements.length >= 2) {
          console.log(`  Selector ${selector} matches ${elements.length} items, returning selector`);
          return selector; // 返回选择器字符串
        }
        
        // 特殊处理2：如果是 docpuburl-container 标识
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
    
    // 策略2: 优先查找带有搜索结果相关 id/class 的列表
    const searchResultLists = document.querySelectorAll('ul[id*="list"], ul[class*="list"], ul[id*="result"], ul[class*="result"], ul[id*="search"], ul[class*="search"]');
    for (const list of searchResultLists) {
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
        
        if (validItems.length >= 2) {
          console.log(`Found search result list (ul/li) with ${validItems.length} items, selector: ${list.id ? '#' + list.id : '.' + list.className.split(' ')[0]}`);
          return list;
        }
      }
    }
    
    // 策略2.5: 查找普通ul/li结构的列表（某些网站用li模拟表格）
    const allLists = document.querySelectorAll('ul');
    for (const list of allLists) {
      // 使用通用函数排除导航菜单和分页列表
      if (this.isNavigationList(list)) {
        continue;
      }
      
      if (this.isPaginationList(list)) {
        continue;
      }
      
      const items = list.querySelectorAll('li');
      if (items.length >= 2) {
        const validItems = Array.from(items).filter(item => {
          const link = item.querySelector('a[href]');
          const text = item.textContent?.trim();
          return text && text.length > 10 && link;
        });
        
        if (validItems.length >= 2) {  // 降低阈值：从3改为2
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
    console.log('  📋 getListItems 开始执行');
    console.log('  📋 容器类型:', typeof container);
    console.log('  📋 容器值:', container);
    const items = [];
    
    // 策略0-1: 如果传入的是 CSS 选择器字符串，直接查询
    if (typeof container === 'string') {
      console.log('  📋 策略0-1: 容器是字符串选择器');
      const elements = document.querySelectorAll(container);
      console.log(`  📋 找到 ${elements.length} 个容器元素`);
      
      if (elements.length > 0) {
        // 如果选择器直接匹配到链接（如 "div a[href]"），直接返回这些链接
        const firstElement = elements[0];
        const tagName = firstElement.tagName?.toLowerCase();
        
        if (tagName === 'a' && container.includes('a[href]')) {
          console.log(`  📋 选择器直接匹配到链接，返回 ${elements.length} 个链接元素`);
          // 过滤掉无效链接
          const validLinks = Array.from(elements).filter(link => {
            const href = link.href;
            const text = link.textContent?.trim();
            return href && 
                   !href.startsWith('javascript:') && 
                   text && 
                   text.length > 10 &&
                   !text.includes('没有相关');
          });
          console.log(`  ✅ 策略0-1成功: 返回 ${validLinks.length} 个有效链接`);
          return validLinks;
        }
        
        // 如果匹配到的是容器（如ul、div），需要提取其中的子项（如li）
        // 而不是把容器本身当成列表项
        
        // 如果是ul/ol，提取所有匹配容器中的li
        if (tagName === 'ul' || tagName === 'ol') {
          console.log(`  📋 容器是 ${tagName}，提取内部的 li`);
          const allLis = [];
          elements.forEach(element => {
            const lis = element.querySelectorAll('li');
            console.log(`    从容器中找到 ${lis.length} 个 li`);
            allLis.push(...Array.from(lis));
          });
          
          if (allLis.length > 0) {
            console.log(`  ✅ 策略0-1成功: 从 ${elements.length} 个容器中提取了 ${allLis.length} 个 li`);
            return allLis;
          }
        }
        
        // 如果是div等容器，尝试提取内部的li或子元素
        if (tagName === 'div' || tagName === 'section' || tagName === 'article') {
          console.log(`  📋 容器是 ${tagName}，尝试提取内部的列表项`);
          const allItems = [];
          elements.forEach(element => {
            // 先尝试找内部的ul/ol的li
            const lis = element.querySelectorAll('ul li, ol li');
            if (lis.length > 0) {
              console.log(`    从 ${tagName} 中找到 ${lis.length} 个 li`);
              allItems.push(...Array.from(lis));
            } else {
              // 如果没有li，尝试查找内部的链接（div容器中的链接列表）
              const links = element.querySelectorAll('a[href]');
              if (links.length >= 5) {
                const validLinks = Array.from(links).filter(link => {
                  const href = link.href;
                  const text = link.textContent?.trim();
                  return href && 
                         !href.startsWith('javascript:') && 
                         text && 
                         text.length > 10 &&
                         !text.includes('没有相关');
                });
                if (validLinks.length >= 5) {
                  console.log(`    从 ${tagName} 中找到 ${validLinks.length} 个有效链接`);
                  allItems.push(...validLinks);
                }
              } else {
                // 如果没有链接，尝试直接子元素
                const children = Array.from(element.children).filter(child => {
                  const text = child.textContent?.trim();
                  const link = child.querySelector('a[href]');
                  return text && text.length > 10 && link;
                });
                if (children.length > 0) {
                  console.log(`    从 ${tagName} 中找到 ${children.length} 个子元素`);
                  allItems.push(...children);
                }
              }
            }
          });
          
          if (allItems.length > 0) {
            console.log(`  ✅ 策略0-1成功: 从 ${elements.length} 个容器中提取了 ${allItems.length} 个列表项`);
            return allItems;
          }
        }
        
        // 否则直接返回匹配的元素（可能是列表项本身）
        console.log(`  ✅ 策略0-1成功: 返回 ${elements.length} 个元素`);
        return Array.from(elements);
      }
    }
    
    // 策略0-2: 特殊处理 - 查找包含 a[name="docpuburl"] 的项
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
    
    // 策略1: 优先查找常见的列表项class（扩展支持 msg、discuss 等）
    console.log('  📋 策略1: 查找带class的列表项');
    const listItems = container.querySelectorAll('[class*="list-item"], [class*="result-item"], [class*="search-result"], [class*="msg"], [class*="discuss"]');
    console.log(`  📋 找到 ${listItems.length} 个带class的列表项`);
    if (listItems.length > 0) {
      console.log('  ✅ 策略1成功: 返回带class的列表项');
      return Array.from(listItems);
    }
    
    // 如果是表格，直接获取行
    console.log('  📋 检查是否为表格容器');
    if (container.tagName.toLowerCase() === 'table') {
      console.log('  📋 策略2: 容器是表格');
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
    
    // 如果不是表格，尝试找到表格内的行（但要排除详情表）
    console.log('  📋 检查容器内是否有表格');
    const tablesInside = container.querySelectorAll('table');
    console.log(`  📋 容器内找到 ${tablesInside.length} 个表格`);
    
    if (tablesInside.length > 0) {
      const bestTable = Array.from(tablesInside).find(table => {
        // 跳过详情表（table.detail 且行数少于5）
        if (table.className && table.className.includes('detail')) {
          const rows = table.querySelectorAll('tr');
          if (rows.length < 5) {
            console.log('  📋 跳过容器内的详情表');
            return false;
          }
        }
        
        const rows = table.querySelectorAll('tbody tr, tr');
        if (rows.length >= 2) {
          const hasData = Array.from(rows).some(row => row.querySelector('td'));
          return hasData;
        }
        return false;
      });
      
      if (bestTable) {
        console.log('  📋 在容器内找到有效表格，提取行数据');
        const rows = bestTable.querySelectorAll('tbody tr, tr');
        items.push(...Array.from(rows));
        
        // 过滤掉表头
        return items.filter(row => {
          const hasTd = row.querySelector('td');
          return !!hasTd;
        });
      } else {
        console.log('  📋 容器内的表格都被跳过（可能是详情表）');
      }
    }
    
    // 尝试不同的子元素选择器（用于列表）
    console.log('  📋 策略3: 尝试不同的子元素选择器');
    const childSelectors = [
      'li', // 标准列表项
      'div[class*="item"]', 'div[class*="product"]', 'div[class*="card"]', // 常见项目类名
      'article', 'section', // 语义化标签
      'div[class*="col"]', 'div[class*="cell"]' // 网格项目
    ];

    for (const selector of childSelectors) {
      const elements = container.querySelectorAll(selector);
      console.log(`  📋 尝试选择器 "${selector}": 找到 ${elements.length} 个`);
      if (elements.length > 0) {
        items.push(...Array.from(elements));
        console.log(`  ✅ 策略3成功: 使用选择器 "${selector}" 找到 ${elements.length} 项`);
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
      console.log('  📋 策略4: 使用所有直接子元素');
      items.push(...Array.from(container.children));
      console.log(`  📋 找到 ${items.length} 个直接子元素`);
    }

    console.log(`  📋 过滤前总数: ${items.length}`);
    
    if (items.length > 0) {
      console.log(`  📋 开始详细过滤，逐个检查...`);
      items.forEach((item, idx) => {
        const text = item.textContent?.trim();
        console.log(`  📋 检查第${idx + 1}个: 文本长度=${text?.length}, 预览=${text?.substring(0, 50)}`);
      });
    }
    
    const filteredItems = items.filter((item, idx) => {
      // 过滤掉明显不是内容项的元素
      const tagName = item.tagName.toLowerCase();
      const className = item.className && item.className.toLowerCase();
      const text = item.textContent?.trim();
      
      // 过滤短文本（可能是导航标签）
      if (text && text.length < 20) {
        console.log(`  ⊘ 第${idx + 1}个被过滤: 文本太短 (${text.length}字符) - ${text.substring(0, 30)}`);
        return false;
      }
      
      // 过滤按钮类文本（通过内容特征识别）
      if (text && /^(查看|更多|下一|上一|全部|在线办理)/.test(text.trim().substring(0, 10))) {
        console.log(`  ⊘ 第${idx + 1}个被过滤: 按钮类文本 - ${text.substring(0, 30)}`);
        return false;
      }
      
      const pass = !['script', 'style', 'meta', 'link', 'noscript', 'thead', 'th', 'button'].includes(tagName) &&
             !className?.includes('ad') &&
             !className?.includes('banner') &&
             !className?.includes('footer') &&
             !className?.includes('header') &&
             !className?.includes('nav') &&
             !className?.includes('tab');
      
      if (!pass) {
        console.log(`  ⊘ 第${idx + 1}个被过滤: 标签/类名过滤 - ${tagName}, ${className}`);
        return false;
      }
      
      console.log(`  ✅ 第${idx + 1}个通过过滤`);
      return pass;
    });
    
    console.log(`  ✅ 过滤后总数: ${filteredItems.length}`);
    console.log('  📋 getListItems 执行完毕\n');
    
    return filteredItems;
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
    
    // 特殊处理0：如果item本身就是链接元素（a标签）
    if (item.tagName?.toLowerCase() === 'a' && item.href) {
      const title = item.textContent?.trim();
      const href = this.makeAbsoluteUrl(item.href);
      
      if (title && title.length > 10 && href && !href.startsWith('javascript:')) {
        // 清理标题文本（移除日期、来源等）
        const cleanedTitle = this.cleanTitleText(title);
        orderedData.title = cleanedTitle;
        orderedData.href = href;
        
        // 尝试从链接的父元素或兄弟元素中提取日期
        const parent = item.parentElement;
        if (parent) {
          const parentText = parent.textContent || '';
          const dateMatch = parentText.match(/(\d{4}[-年]\d{1,2}[-月]\d{1,2}[日]?)/);
          if (dateMatch) {
            orderedData.date = dateMatch[0];
          }
        }
        
        console.log(`  ✅ 从链接元素提取: ${cleanedTitle.substring(0, 50)}...`);
        return orderedData;
      }
    }
    
    // 特殊处理1：通用搜索结果格式（包含特定子元素的 div）
    // 检测规律：有标题链接、URL链接、日期等结构
    const hasSearchResultPattern = item.classList && (
      item.classList.contains('jcse-result-box') ||
      item.classList.contains('search-result') ||
      item.classList.contains('result-item') ||
      Array.from(item.classList).some(c => c.includes('result') || c.includes('news-'))
    );
    
    if (hasSearchResultPattern) {
      // 查找标题链接（多种可能的选择器）
      const titleLink = item.querySelector('.jcse-news-title a') || 
                       item.querySelector('[class*="title"] a') ||
                       item.querySelector('a[href]');
      
      if (titleLink) {
        orderedData.title = titleLink.textContent?.trim();
        orderedData.href = this.makeAbsoluteUrl(titleLink.href);
      }
      
      // 查找日期
      const dateElem = item.querySelector('.jcse-news-date') ||
                      item.querySelector('[class*="date"]') ||
                      item.querySelector('[class*="time"]');
      
      if (dateElem) {
        orderedData.date = dateElem.textContent?.trim();
      }
      
      // 如果找到了 title 和 href，直接返回
      if (orderedData.title && orderedData.href) {
        return orderedData;
      }
    }
    
    // 特殊处理1.5：通用模式 - 包含长文本标题链接的 div（如曹县的 div.row）
    if (item.tagName?.toLowerCase() === 'div') {
      // 查找链接，优先选择较短的文本作为标题（通常<100字符）
      const links = item.querySelectorAll('a[href]');
      let titleLink = null;
      let shortestLink = null;
      let shortestLength = Infinity;
      
      for (const link of links) {
        const text = link.textContent?.trim();
        const href = link.href;
        
        // 判断是否为主标题链接
        if (text && text.length > 10 && text.length < 200 && // 标题通常不会太长
            href && href.includes('.html') &&
            !href.includes('jiansuo') && !href.includes('search') &&
            !text.includes('首页') && !text.includes('下页') && !text.includes('上页') &&
            !text.includes('加载更多')) {
          
          // 记录最短的链接（最可能是标题）
          if (text.length < shortestLength) {
            shortestLength = text.length;
            shortestLink = link;
          }
          
          // 如果还没找到 titleLink，先记录第一个
          if (!titleLink) {
            titleLink = link;
          }
        }
      }
      
      // 优先使用最短的链接作为标题
      const finalTitleLink = shortestLink || titleLink;
      
      if (finalTitleLink) {
        orderedData.title = finalTitleLink.textContent?.trim();
        orderedData.href = this.makeAbsoluteUrl(finalTitleLink.href);
        
        // 尝试提取日期（查找包含日期格式的文本）
        const allText = item.textContent || '';
        const dateMatch = allText.match(/(\d{4}[-年]\d{1,2}[-月]\d{1,2}[日]?)/);
        if (dateMatch) {
          orderedData.date = dateMatch[0];
        }
        
        return orderedData;
      }
    }
    
    // 特殊处理2：查找 a[name="docpuburl"] 链接（优先提取，但继续处理其他字段）
    const docpuburlLink = item.querySelector('a[name="docpuburl"]');
    if (docpuburlLink) {
      const href = this.makeAbsoluteUrl(docpuburlLink.href);
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
      
      // 对于 li 元素，直接使用第一个链接（最简单直接的方法）
      const allLinks = Array.from(item.querySelectorAll('a[href]'));
      if (allLinks.length > 0) {
        // 直接使用第一个链接作为标题链接
        const titleLink = allLinks[0];
        
        try {
          const href = titleLink.href;
          let linkText = titleLink.textContent?.trim() || '';
          
          if (this.isValidUrl(href)) {
            allData['title href'] = this.makeAbsoluteUrl(href);
            
            // 清理标题文本
            if (linkText && linkText.length > 5) {
              // 1. 去掉日期格式
              linkText = linkText.replace(/\d{4}[-年\/]\d{1,2}[-月\/]\d{1,2}[日]?/g, '');
              
              // 2. 去掉开头和结尾的短标签（分类标签）
              linkText = linkText.replace(/^[\u4e00-\u9fa5]{2,6}[\s\n\r\t]+/g, '');
              linkText = linkText.replace(/[\s\n\r\t]+[\u4e00-\u9fa5]{2,6}$/g, '');
              
              // 3. 合并空白字符
              linkText = linkText.replace(/[\s\n\r\t]+/g, ' ').trim();
              
              // 4. 如果太长（>150字符），可能是包含摘要，提取前100字符
              if (linkText.length > 150) {
                // 尝试提取到第一个句号
                const firstSentence = linkText.match(/^[^。！？]+/);
                if (firstSentence && firstSentence[0].length > 10 && firstSentence[0].length < 150) {
                  linkText = firstSentence[0].trim();
                } else {
                  linkText = linkText.substring(0, 100).trim();
                }
              }
              
              // 5. 如果清理后还有内容，使用清理后的；否则使用原始文本
              if (linkText.length > 5) {
                allData.title = linkText;
              } else {
                const original = titleLink.textContent?.trim() || '';
                allData.title = original.length > 100 ? original.substring(0, 100) : original;
              }
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
      // 特殊处理：如果是 link.do 或 visit/link.do 跳转链接，提取真实 URL
      if (url.includes('link.do?url=') || url.includes('visit/link.do?url=')) {
        try {
          const urlObj = new URL(url);
          const realUrl = urlObj.searchParams.get('url');
          if (realUrl) {
            // 解码真实 URL
            const decodedUrl = decodeURIComponent(realUrl);
            console.log('Extracted real URL from link.do:', decodedUrl);
            return decodedUrl;
          }
        } catch (e) {
          console.warn('Failed to extract URL from link.do:', e);
        }
      }
      
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

  // 添加关键词选择功能
  async addSearchKeywordHelper() {
    // 从 JSON 文件加载关键词列表
    let keywords = [];
    try {
      // 尝试从扩展资源中加载关键词 JSON 文件
      const keywordsUrl = chrome.runtime.getURL('data/keywords.json');
      const response = await fetch(keywordsUrl);
      if (response.ok) {
        const data = await response.json();
        keywords = data.keywords || [];
        console.log(`✅ 成功加载 ${keywords.length} 个关键词`);
      } else {
        throw new Error('无法加载关键词文件');
      }
    } catch (error) {
      console.warn('⚠️ 无法从 JSON 文件加载关键词，使用默认关键词:', error);
      // 如果加载失败，使用默认关键词作为后备
      keywords = [
        '耕地地力',
        '惠农',
        '大豆玉米带状复合种植',
        '稻谷补贴',
        '小麦一喷三防',
        '粮食生产工作实施方案',
        '粮油规模',
        '农机购置',
        '农机报废更新补',
        '扩种油菜',
        '油菜种植',
        '家庭农场',
        '农民合作社 培育项目',
        '新型农业经营主体培育项目',
        '农业经营主体能力提升',
        '耕地轮作',
        '深松作业补助',
        '还田作业补助',
        '绿色高产高效行动',
        '高标准农田建设',
        '农业社会化服务补助',
        '农作物秸秆',
        '地膜科学使用回收',
        '病虫害防治',
        '农业科技培训',
        '农业灾害应急'
      ];
    }

    // 先删除所有现有的关键词选择器
    const existingSelectors = document.querySelectorAll('.scraper-keyword-selector');
    existingSelectors.forEach(selector => selector.remove());
    console.log(`已删除 ${existingSelectors.length} 个旧的关键词选择器`);

    // 查找所有可能的搜索框（用于填充关键词）
    const searchInputs = document.querySelectorAll('input[type="text"], input[type="search"], input[name*="search"], input[name*="keyword"], input[class*="search"], input[id*="search"]');
    console.log(`找到 ${searchInputs.length} 个搜索框`);

    // 创建固定在右侧的关键词选择器容器
    const selectorContainer = document.createElement('div');
    selectorContainer.className = 'scraper-keyword-selector';
    selectorContainer.id = 'scraper-keyword-selector-sidebar';
    selectorContainer.style.cssText = `
      position: fixed;
      top: 50%;
      right: 20px;
      transform: translateY(-50%);
      width: 200px;
      max-height: 80vh;
      overflow-y: auto;
      overflow-x: hidden;
      background: #fff;
      border: 2px solid #667eea;
      border-radius: 8px;
      padding: 12px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.15);
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 13px;
      box-sizing: border-box;
    `;
    
    // 自定义滚动条样式
    const style = document.createElement('style');
    style.textContent = `
      #scraper-keyword-selector-sidebar::-webkit-scrollbar {
        width: 6px;
      }
      #scraper-keyword-selector-sidebar::-webkit-scrollbar-track {
        background: #f1f1f1;
        border-radius: 3px;
      }
      #scraper-keyword-selector-sidebar::-webkit-scrollbar-thumb {
        background: #667eea;
        border-radius: 3px;
      }
      #scraper-keyword-selector-sidebar::-webkit-scrollbar-thumb:hover {
        background: #5568d3;
      }
    `;
    document.head.appendChild(style);

    // 创建标题栏（包含标题和关闭按钮）
    const titleBar = document.createElement('div');
    titleBar.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
      padding-bottom: 8px;
      border-bottom: 2px solid #e0e0e0;
    `;
    
    const title = document.createElement('div');
    title.style.cssText = `
      font-weight: 600;
      color: #667eea;
      font-size: 14px;
    `;
    title.textContent = '🔍 快速选择关键词';
    
    // 创建关闭按钮
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '×';
    closeBtn.style.cssText = `
      background: transparent;
      border: none;
      color: #999;
      font-size: 24px;
      line-height: 1;
      cursor: pointer;
      padding: 0;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: color 0.2s;
    `;
    closeBtn.onmouseenter = () => {
      closeBtn.style.color = '#667eea';
    };
    closeBtn.onmouseleave = () => {
      closeBtn.style.color = '#999';
    };
    closeBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      selectorContainer.remove();
      // 清除持久化标记
      chrome.storage.local.set({ 'keywordHelperVisible': false });
      console.log('已关闭关键词选择器');
    };
    
    titleBar.appendChild(title);
    titleBar.appendChild(closeBtn);
    selectorContainer.appendChild(titleBar);

    // 创建关键词按钮组（垂直排列）
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 6px;
    `;

    keywords.forEach((keyword, index) => {
      const btn = document.createElement('button');
      btn.textContent = keyword;
      btn.dataset.keywordIndex = index; // 保存索引
      btn.style.cssText = `
        width: 100%;
        padding: 8px 12px;
        background: #667eea;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
        transition: all 0.2s;
        text-align: left;
        word-wrap: break-word;
        white-space: normal;
      `;

      // 鼠标悬停效果
      btn.onmouseenter = () => {
        btn.style.background = '#5568d3';
        btn.style.transform = 'translateX(-3px)';
        btn.style.boxShadow = '0 2px 8px rgba(102, 126, 234, 0.4)';
      };
      btn.onmouseleave = () => {
        btn.style.background = '#667eea';
        btn.style.transform = 'translateX(0)';
        btn.style.boxShadow = 'none';
      };

      // 点击事件：填充到第一个找到的搜索框并自动搜索
      btn.onclick = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        // 重新查找搜索框（因为可能是动态加载的）
        // 优先查找可见的、非隐藏的输入框
        const allInputs = document.querySelectorAll('input[type="text"], input[type="search"], input[name*="search"], input[name*="keyword"], input[class*="search"], input[id*="search"], input[id*="Search"], input[id*="Keyword"]');
        // 过滤掉隐藏的输入框
        const visibleInputs = Array.from(allInputs).filter(input => {
          const style = window.getComputedStyle(input);
          return input.type !== 'hidden' && 
                 style.display !== 'none' && 
                 style.visibility !== 'hidden' && 
                 input.offsetWidth > 0 &&
                 input.offsetHeight > 0;
        });
        const firstInput = visibleInputs.length > 0 ? visibleInputs[0] : allInputs[0];
        
        if (firstInput) {
          // 填充搜索框
          firstInput.value = keyword;
          
          // 设置原生值（某些框架需要）
          if (firstInput.setAttribute) {
            firstInput.setAttribute('value', keyword);
          }
          
          // 触发input事件
          const inputEvent = new Event('input', { bubbles: true, cancelable: true });
          firstInput.dispatchEvent(inputEvent);
          
          // 触发change事件
          const changeEvent = new Event('change', { bubbles: true, cancelable: true });
          firstInput.dispatchEvent(changeEvent);
          
          // 触发keyup事件（某些网站需要）
          const keyupEvent = new KeyboardEvent('keyup', { bubbles: true, cancelable: true });
          firstInput.dispatchEvent(keyupEvent);
          
          // 聚焦到搜索框
          firstInput.focus();
          
          // 尝试触发React/Vue等框架的事件（使用原生setter）
          try {
            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
            if (nativeInputValueSetter) {
              nativeInputValueSetter.call(firstInput, keyword);
              const reactEvent = new Event('input', { bubbles: true });
              firstInput.dispatchEvent(reactEvent);
            }
          } catch (err) {
            // 如果原生setter不可用，忽略错误
            console.log('无法使用原生setter，使用标准方式');
          }
          
          console.log(`✅ 已填充关键词: ${keyword} 到搜索框`, {
            input: firstInput,
            value: firstInput.value,
            id: firstInput.id,
            name: firstInput.name
          });
          
          // 自动点击搜索按钮
          await this.triggerSearchButton(firstInput);
          
          // 保存当前点击的关键词索引（下一个位置）
          const nextIndex = index + 1;
          await chrome.storage.local.set({ 'keywordScrollIndex': nextIndex });
          console.log(`📌 已保存滚动位置: ${nextIndex}`);
        } else {
          console.warn('⚠️ 未找到可用的搜索框');
          alert('未找到搜索框，请确保页面上有搜索输入框');
        }
        
        // 点击按钮后高亮提示
        btn.style.background = '#10b981';
        setTimeout(() => {
          btn.style.background = '#667eea';
        }, 1000);
        
        // 阻止事件继续传播，但不阻止当前处理
        return false;
      };

      buttonContainer.appendChild(btn);
    });

    selectorContainer.appendChild(buttonContainer);

    // 阻止选择器容器内的点击事件冒泡到页面（但允许按钮的点击事件正常执行）
    selectorContainer.addEventListener('click', (e) => {
      // 如果点击的是关闭按钮或关键词按钮，不阻止（让它们自己的处理函数执行）
      if (e.target === closeBtn || closeBtn.contains(e.target) || e.target.tagName === 'BUTTON') {
        // 不阻止按钮的点击，但阻止冒泡到页面
        e.stopPropagation();
        return;
      }
      // 其他点击事件阻止冒泡
      e.stopPropagation();
    }, false); // 使用冒泡阶段，让按钮先处理

    // 添加到页面body
    document.body.appendChild(selectorContainer);
    
    // 保存持久化标记，表示选择器已显示
    chrome.storage.local.set({ 'keywordHelperVisible': true });
    
    // 恢复滚动位置
    this.restoreScrollPosition(selectorContainer);
    
    // 监听页面卸载事件，但不在页面刷新时移除（因为刷新后会自动重新加载）
    // 只在用户主动关闭时才移除

    console.log(`✅ 已在页面右侧创建关键词选择器，包含 ${keywords.length} 个关键词`);

    return {
      success: true,
      message: `已在页面右侧创建关键词选择器（${keywords.length} 个关键词）`,
      count: keywords.length
    };
  }

  // 恢复滚动位置
  async restoreScrollPosition(container) {
    try {
      const result = await chrome.storage.local.get(['keywordScrollIndex']);
      if (result.keywordScrollIndex !== undefined) {
        const scrollIndex = result.keywordScrollIndex;
        // 找到对应索引的按钮
        const buttons = container.querySelectorAll('button[data-keyword-index]');
        if (buttons.length > 0 && scrollIndex < buttons.length) {
          const targetButton = buttons[scrollIndex];
          if (targetButton) {
            // 延迟一点确保容器已渲染
            setTimeout(() => {
              targetButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
              console.log(`📌 已恢复滚动位置到第 ${scrollIndex + 1} 个关键词`);
            }, 100);
          }
        }
      }
    } catch (error) {
      console.log('恢复滚动位置失败:', error);
    }
  }
  
  // 自动触发搜索按钮
  async triggerSearchButton(searchInput) {
    try {
      // 等待一下确保输入框值已更新
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // 多种方式查找搜索按钮
      let searchButton = null;
      
      // 方式1: 查找搜索框附近的按钮（最常见）
      const parent = searchInput.closest('form') || searchInput.parentElement;
      if (parent) {
        // 查找同级的按钮，包括 input[type="button"] 和包含 search/icon class 的
        const buttons = parent.querySelectorAll('button[type="submit"], button:not([type]), input[type="submit"], input[type="button"], button[class*="search"], button[id*="search"], input[class*="search"], input[id*="search"], input[class*="icon"], button[class*="icon"]');
        // 优先选择包含 search 或 icon 的按钮
        for (const btn of buttons) {
          const className = btn.className || '';
          const id = btn.id || '';
          if (className.includes('search') || className.includes('icon') || id.includes('search')) {
            searchButton = btn;
            break;
          }
        }
        // 如果没找到，使用第一个按钮
        if (!searchButton && buttons.length > 0) {
          searchButton = buttons[0];
        }
      }
      
      // 方式2: 查找包含搜索图标的按钮（包括 input[type="button"]）
      if (!searchButton) {
        const iconButtons = document.querySelectorAll('button:has(svg), button:has(.icon), button[class*="icon"], input[type="button"][class*="icon"], input[type="button"][class*="search"]');
        for (const btn of iconButtons) {
          const text = btn.textContent || btn.getAttribute('aria-label') || btn.value || '';
          const className = btn.className || '';
          if (text.includes('搜索') || text.includes('search') || text.includes('查询') || className.includes('search') || className.includes('icon')) {
            searchButton = btn;
            break;
          }
        }
      }
      
      // 方式3: 查找包含放大镜图标的按钮（包括 input[type="button"]）
      if (!searchButton) {
        const magnifierButtons = document.querySelectorAll('button, input[type="submit"], input[type="button"]');
        for (const btn of magnifierButtons) {
          const html = btn.innerHTML || '';
          const className = btn.className || '';
          if (html.includes('🔍') || html.includes('search') || html.includes('magnify') || className.includes('search') || className.includes('icon')) {
            searchButton = btn;
            break;
          }
        }
      }
      
      // 方式4: 如果搜索框在表单中，查找表单的提交按钮
      if (!searchButton) {
        const form = searchInput.closest('form');
        if (form) {
          searchButton = form.querySelector('button[type="submit"], input[type="submit"]');
        }
      }
      
      if (searchButton) {
        // 触发点击事件
        console.log('🔍 找到搜索按钮:', searchButton.tagName, searchButton.className, searchButton.id);
        searchButton.click();
        console.log('✅ 已自动触发搜索按钮');
        return true;
      } else {
        console.log('⚠️ 未找到搜索按钮，尝试按回车键');
        // 如果找不到按钮，尝试在输入框上触发回车键
        // 先触发 keydown
        const keydownEvent = new KeyboardEvent('keydown', {
          key: 'Enter',
          code: 'Enter',
          keyCode: 13,
          which: 13,
          bubbles: true,
          cancelable: true
        });
        searchInput.dispatchEvent(keydownEvent);
        
        // 再触发 keypress
        const keypressEvent = new KeyboardEvent('keypress', {
          key: 'Enter',
          code: 'Enter',
          keyCode: 13,
          which: 13,
          bubbles: true,
          cancelable: true
        });
        searchInput.dispatchEvent(keypressEvent);
        
        // 最后触发 keyup
        const keyupEvent = new KeyboardEvent('keyup', {
          key: 'Enter',
          code: 'Enter',
          keyCode: 13,
          which: 13,
          bubbles: true,
          cancelable: true
        });
        searchInput.dispatchEvent(keyupEvent);
        
        return false;
      }
    } catch (error) {
      console.log('触发搜索按钮失败:', error);
      return false;
    }
  }

  // 移除关键词选择器
  removeSearchKeywordHelper() {
    const selectors = document.querySelectorAll('.scraper-keyword-selector');
    selectors.forEach(selector => {
      selector.remove();
    });
    // 清除持久化标记
    chrome.storage.local.set({ 'keywordHelperVisible': false });
    return {
      success: true,
      message: '已移除所有关键词选择器',
      count: selectors.length
    };
  }
}

// 初始化内容脚本
const easyScraper = new EasyScraperContentScript();
console.log('Easy Scraper content script loaded');

