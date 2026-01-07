# Wallpaper Search Test Suite

Automated test suite for wallpaper search functionality using Playwright.

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn

## Installation

```bash
npm install
npx playwright install
```

## Configuration

**Required:** Set the `BASE_URL` and `SEARCH_KEYWORD` environment variables before running tests:

```bash
export BASE_URL=https://www.example.com
export SEARCH_KEYWORD=keyword
```

Or run tests with environment variables inline:

```bash
BASE_URL=https://www.example.com SEARCH_KEYWORD=keyword npm test
```

## Running Tests

### Run all tests (headless)
```bash
npm test
```

Or with BASE_URL and SEARCH_KEYWORD:
```bash
BASE_URL=https://www.example.com SEARCH_KEYWORD=keyword npm test
BASE_URL=https://www.example.com SEARCH_KEYWORD=keyword npm test
```

## Test Structure

Tests are located in the `tests/` directory:
- `tests/search.spec.ts` - Contains all search-related test cases
- `tests/helpers/search-helpers.ts` - Helper functions for search operations

## Test Cases

1. **Search by keyword** - Tests searching for wallpapers using keywords
   - Performs a search with a keyword
   - Verifies search results are displayed
   - Validates that results are related to the search query

2. **Identify free vs premium** - Tests ability to distinguish between free and premium wallpapers
   - Searches for wallpapers
   - Checks multiple wallpapers to identify free vs premium
   - Verifies that at least one free wallpaper is found

3. **Download free wallpaper** - Tests downloading a free wallpaper
   - Finds a free wallpaper from search results
   - Initiates download
   - Verifies that download process completes

4. **Verify download** - Tests that downloaded wallpaper file exists and is valid
   - Downloads a free wallpaper
   - Verifies file exists on filesystem
   - Validates file size (> 0 bytes)

## Test Configuration

Test configuration is in `playwright.config.ts`. Settings:
- Base URL: **Required** - Must be set via BASE_URL environment variable
- Browser: Chromium
- Screenshots: On failure
- Videos: Retained on failure
- Retries: 2 (in CI), 0 (local)

## Project Structure

```
.
├── tests/
│   ├── search.spec.ts           # Test specifications
│   └── helpers/
│       └── search-helpers.ts     # Helper functions for tests
├── playwright.config.ts          # Playwright configuration
├── package.json                  # Dependencies and scripts
├── downloads/                    # Downloaded wallpapers (gitignored)
└── README.md                     # This file
```

## Implementation Details

### Helper Functions

The `SearchHelpers` class provides simple, straightforward methods:

- `searchByKeyword(keyword: string)` - Performs a search operation using the search input
- `getWallpaperElements()` - Retrieves wallpaper elements from the page
- `isFreeWallpaper(element)` - Determines if a wallpaper is free or premium
- `downloadFreeWallpaper(element)` - Downloads a free wallpaper using Playwright's simple download pattern
- `verifyDownload(filePath)` - Verifies downloaded file exists and has content
- `waitForSearchResults()` - Waits for search results to load

### Test Features

- **Simple Playwright patterns**: Tests use straightforward Playwright APIs (getByRole, waitForEvent, etc.)
- **Download pattern**: Uses the standard Playwright download pattern:
  ```typescript
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download' }).click();
  const download = await downloadPromise;
  ```
- **File verification**: Validates downloaded files by checking:
  - File existence
  - File size (> 0 bytes)
- **Cleanup**: Automatically cleans up downloaded files after each test

## Notes

- Tests run against the production website (configured via BASE_URL)
- Downloaded files are stored in the `downloads/` directory (gitignored)
- Tests automatically clean up downloaded files after execution
- Screenshots are saved on test failures
- Videos are retained on test failures for debugging

