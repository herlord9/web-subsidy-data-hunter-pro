import { useState, useEffect } from 'react';

export function useCurrentTab() {
  const [currentTab, setCurrentTab] = useState(null);
  const [isValidTab, setIsValidTab] = useState(true);

  useEffect(() => {
    // 获取当前活动标签页
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length > 0) {
        const tab = tabs[0];
        setCurrentTab(tab);
        
        // 检查是否为受限页面
        const restrictedPages = [
          'chrome://',
          'chrome-extension://',
          'moz-extension://',
          'edge://',
          'about:',
          'file://'
        ];
        
        const isRestricted = restrictedPages.some(prefix => 
          tab.url && tab.url.startsWith(prefix)
        );
        
        setIsValidTab(!isRestricted);
      }
    });
  }, []);

  return {
    currentTab,
    isValidTab
  };
}
