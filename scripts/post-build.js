const fs = require('fs');
const path = require('path');

// 复制 manifest.json 到 dist 目录
function copyManifest() {
  const srcManifest = path.join(__dirname, 'src', 'manifest.json');
  const distManifest = path.join(__dirname, 'dist', 'manifest.json');
  
  if (fs.existsSync(srcManifest)) {
    fs.copyFileSync(srcManifest, distManifest);
    console.log('✓ Copied manifest.json');
  }
}

// 复制多语言文件到 dist 目录
function copyLocales() {
  const srcLocales = path.join(__dirname, 'src', '_locales');
  const distLocales = path.join(__dirname, 'dist', '_locales');
  
  if (fs.existsSync(srcLocales)) {
    // 创建目标目录
    if (!fs.existsSync(distLocales)) {
      fs.mkdirSync(distLocales, { recursive: true });
    }
    
    // 复制所有语言文件
    const locales = fs.readdirSync(srcLocales);
    locales.forEach(locale => {
      const srcPath = path.join(srcLocales, locale);
      const distPath = path.join(distLocales, locale);
      
      if (fs.statSync(srcPath).isDirectory()) {
        if (!fs.existsSync(distPath)) {
          fs.mkdirSync(distPath, { recursive: true });
        }
        
        const files = fs.readdirSync(srcPath);
        files.forEach(file => {
          fs.copyFileSync(
            path.join(srcPath, file),
            path.join(distPath, file)
          );
        });
      }
    });
    
    console.log('✓ Copied locale files');
  }
}

// 复制图标文件
function copyIcons() {
  const srcAssets = path.join(__dirname, '..', '..', '1.3.6_1', 'assets');
  const distAssets = path.join(__dirname, '..', 'dist', 'assets');
  
  // 确保目标目录存在
  if (!fs.existsSync(distAssets)) {
    fs.mkdirSync(distAssets, { recursive: true });
  }
  
  // 复制 PNG 图标文件
  const iconFiles = ['icon-16.png', 'icon-48.png', 'icon-128.png'];
  let copiedCount = 0;
  
  iconFiles.forEach(file => {
    const srcFile = path.join(srcAssets, file);
    const distFile = path.join(distAssets, file);
    
    if (fs.existsSync(srcFile)) {
      try {
        fs.copyFileSync(srcFile, distFile);
        copiedCount++;
        console.log(`✓ Copied ${file}`);
      } catch (error) {
        console.error(`✗ Failed to copy ${file}:`, error.message);
      }
    } else {
      console.error(`✗ Source file not found: ${srcFile}`);
    }
  });
  
  if (copiedCount === iconFiles.length) {
    console.log('✓ All icon files copied successfully');
  } else {
    console.log(`⚠ Only ${copiedCount}/${iconFiles.length} icon files copied`);
  }
}

// 创建 README 文件
function createReadme() {
  const readmeContent = `# Easy Scraper Clone

A free web scraper for instant results. Scrape any website with one click. No coding required.

## Features

- 🔍 **One-click scraping** - Extract data from any website without coding
- 📊 **Smart data detection** - Automatically detects text, URLs, images, and more
- 📋 **CSV/JSON export** - Export data in multiple formats with checkbox selection
- 🎯 **List & Details scraping** - Support for both list pages and detail pages
- ⚙️ **Advanced options** - Auto-scroll, pagination, wait times, and more
- 🌍 **Multi-language support** - Available in English and Chinese
- 💾 **Save scrapers** - Create and reuse scraper configurations

## Installation

1. Clone this repository
2. Run \`npm install\` to install dependencies
3. Run \`npm run build\` to build the extension
4. Load the \`dist\` folder as an unpacked extension in Chrome

## Development

- \`npm run dev\` - Build in development mode with watch
- \`npm run build\` - Build for production
- \`npm run clean\` - Clean dist directory

## Usage

1. Navigate to any website with a list of items
2. Click the Easy Scraper extension icon
3. Click "New Scraper" to create a scraper
4. Configure your scraper settings
5. Click "Start Scraping" to extract data
6. Use checkboxes to select specific rows
7. Export selected data as CSV or JSON

## Technology Stack

- **Frontend**: React 18, TanStack Table v8
- **Styling**: CSS3 with modern features
- **Data Processing**: PapaParse for CSV handling
- **Build Tool**: Webpack 5
- **Browser APIs**: Chrome Extension APIs

## License

MIT License - feel free to use and modify as needed.
`;

  fs.writeFileSync(path.join(__dirname, 'README.md'), readmeContent);
  console.log('✓ Created README.md');
}

// 主函数
function postBuild() {
  console.log('Running post-build tasks...');
  
  copyManifest();
  copyLocales();
  copyIcons();
  createReadme();
  
  console.log('✅ Post-build tasks completed!');
}

// 如果直接运行此脚本
if (require.main === module) {
  postBuild();
}

module.exports = { postBuild, copyManifest, copyLocales, copyIcons };
