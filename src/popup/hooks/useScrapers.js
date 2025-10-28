import { useState, useEffect } from 'react';

const STORAGE_KEY = 'easyScraper_scrapers';

export function useScrapers() {
  const [scrapers, setScrapers] = useState([]);

  // 从存储中加载抓取器
  useEffect(() => {
    chrome.storage.local.get([STORAGE_KEY], (result) => {
      if (result[STORAGE_KEY]) {
        setScrapers(result[STORAGE_KEY]);
      }
    });
  }, []);

  // 保存到存储
  const saveToStorage = (newScrapers) => {
    chrome.storage.local.set({ [STORAGE_KEY]: newScrapers });
  };

  const addScraper = (scraper) => {
    const newScrapers = [...scrapers, scraper];
    setScrapers(newScrapers);
    saveToStorage(newScrapers);
  };

  const updateScraper = (updatedScraper) => {
    const newScrapers = scrapers.map(scraper => 
      scraper.id === updatedScraper.id ? updatedScraper : scraper
    );
    setScrapers(newScrapers);
    saveToStorage(newScrapers);
  };

  const deleteScraper = (scraperId) => {
    const newScrapers = scrapers.filter(scraper => scraper.id !== scraperId);
    setScrapers(newScrapers);
    saveToStorage(newScrapers);
  };

  return {
    scrapers,
    addScraper,
    updateScraper,
    deleteScraper
  };
}
