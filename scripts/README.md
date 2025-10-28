# Easy Scraper Clone

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
2. Run `npm install` to install dependencies
3. Run `npm run build` to build the extension
4. Load the `dist` folder as an unpacked extension in Chrome

## Development

- `npm run dev` - Build in development mode with watch
- `npm run build` - Build for production
- `npm run clean` - Clean dist directory

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
