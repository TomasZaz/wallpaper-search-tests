import { test, expect } from '@playwright/test';
import { SearchHelpers } from './helpers/search-helpers';
import * as fs from 'fs';

test.describe('Wallpaper Search by Keyword Functionality Tests', () => {
  // Track downloaded files per test for cleanup
  const downloadedFiles = new Map<string, string>();

  test.beforeEach(async ({ page }) => {
    const helpers = new SearchHelpers(page);
    await page.goto('/ringtones-and-wallpapers');
    // Wait for page content to appear (wait for any content element)
    try {
      await Promise.race([
        page.waitForSelector('body', { timeout: 10000 }),
        page.waitForLoadState('domcontentloaded', { timeout: 10000 }),
      ]);
    } catch {
      // Continue even if timeout
    }
    // Dismiss cookie consent popup if present
    await helpers.dismissCookieConsent();
  });

  test.afterEach(async ({ }, testInfo) => {
    // Clean up downloaded files
    const filePath = downloadedFiles.get(testInfo.testId);
    if (filePath) {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch {
        // Ignore cleanup errors
      }
      downloadedFiles.delete(testInfo.testId);
    }
  });

  /**
   * Helper function to perform search and get wallpaper elements
   */
  async function searchAndGetWallpapers(page: any, keyword?: string) {
    const searchKeyword = keyword || process.env.SEARCH_KEYWORD;
    if (!searchKeyword) {
      throw new Error('SEARCH_KEYWORD environment variable is required. Please set it before running tests.');
    }
    const helpers = new SearchHelpers(page);
    await helpers.searchByKeyword(searchKeyword);
    await helpers.waitForSearchResults();
    const wallpaperElements = await helpers.getWallpaperElements();
    return { helpers, wallpaperElements };
  }

  /**
   * Helper function to find a free wallpaper from wallpaper elements
   */
  async function findFreeWallpaper(helpers: SearchHelpers, wallpaperElements: any[]) {
    for (const element of wallpaperElements.slice(0, 10)) {
      const isFree = await helpers.isFreeWallpaper(element);
      if (isFree) {
        return element;
      }
    }
    return null;
  }

  test('should search for wallpapers by keyword', async ({ page }) => {
    // Get keyword from environment variable (required)
    const searchKeyword = process.env.SEARCH_KEYWORD;
    if (!searchKeyword) {
      throw new Error('SEARCH_KEYWORD environment variable is required. Please set it before running tests.');
    }
    const { wallpaperElements } = await searchAndGetWallpapers(page, searchKeyword);

    // Verify search results are displayed
    expect(wallpaperElements.length).toBeGreaterThan(0);

    // Verify that results are related to the search (check page title or URL)
    const currentUrl = page.url();
    // URL should contain "find" or "search" or the search keyword
    expect(
      currentUrl.includes('find') ||
      currentUrl.includes('search') ||
      currentUrl.toLowerCase().includes(searchKeyword.toLowerCase())
    ).toBe(true);

    // Take a screenshot for verification
    await page.screenshot({ path: 'test-results/search-results.png', fullPage: false });
  });

  test('should identify free vs premium wallpapers', async ({ page }) => {
    const { helpers, wallpaperElements } = await searchAndGetWallpapers(page);
    expect(wallpaperElements.length).toBeGreaterThan(0);

    // Check at least the first few wallpapers
    const elementsToCheck = Math.min(5, wallpaperElements.length);
    let freeCount = 0;
    let premiumCount = 0;

    for (let i = 0; i < elementsToCheck; i++) {
      const element = wallpaperElements[i];
      const isFree = await helpers.isFreeWallpaper(element);

      if (isFree) {
        freeCount++;
      } else {
        premiumCount++;
      }
    }

    // Log the results
    console.log(`Checked ${elementsToCheck} wallpapers: ${freeCount} free, ${premiumCount} premium`);

    // Verify we can identify at least some wallpapers
    expect(freeCount + premiumCount).toBeGreaterThan(0);

    // Verify we found at least one free wallpaper (for download test)
    expect(freeCount).toBeGreaterThan(0);
  });

  test('should download free wallpaper', async ({ page }, testInfo) => {
    const { helpers, wallpaperElements } = await searchAndGetWallpapers(page);
    expect(wallpaperElements.length).toBeGreaterThan(0);

    // Find a free wallpaper
    const freeWallpaper = await findFreeWallpaper(helpers, wallpaperElements);
    expect(freeWallpaper).not.toBeNull();

    // Download the wallpaper
    const downloadedFilePath = await helpers.downloadFreeWallpaper(freeWallpaper!);

    // Store file path for cleanup in afterEach
    downloadedFiles.set(testInfo.testId, downloadedFilePath);

    // Verify download started
    expect(downloadedFilePath).toBeTruthy();

    // Wait for file to exist - poll until file appears or timeout
    const maxWaitTime = 5000; // 5 seconds max
    const startTime = Date.now();

    // Wait for file to exist (condition-based, not fixed delay)
    while (Date.now() - startTime < maxWaitTime) {
      if (fs.existsSync(downloadedFilePath)) {
        break; // File exists, exit loop immediately
      }
      // Short delay before next check (minimal wait)
      await page.waitForTimeout(100);
    }

    // Verify file exists
    expect(fs.existsSync(downloadedFilePath)).toBe(true);

    // Verify file has content
    const stats = fs.statSync(downloadedFilePath);
    expect(stats.size).toBeGreaterThan(0);
  });

  test('should verify wallpaper was successfully downloaded', async ({ page }, testInfo) => {
    const { helpers, wallpaperElements } = await searchAndGetWallpapers(page);
    expect(wallpaperElements.length).toBeGreaterThan(0);

    // Find a free wallpaper
    const freeWallpaper = await findFreeWallpaper(helpers, wallpaperElements);
    expect(freeWallpaper).not.toBeNull();

    // Download the wallpaper
    const downloadedFilePath = await helpers.downloadFreeWallpaper(freeWallpaper!);

    // Store file path for cleanup in afterEach
    downloadedFiles.set(testInfo.testId, downloadedFilePath);

    // Verify we got a file path
    expect(downloadedFilePath).toBeTruthy();
    expect(typeof downloadedFilePath).toBe('string');

    // Wait for file to exist (with timeout)
    const maxWaitTime = 5000; // 5 seconds max
    const startTime = Date.now();
    let fileExists = false;

    while (Date.now() - startTime < maxWaitTime) {
      if (fs.existsSync(downloadedFilePath)) {
        fileExists = true;
        break;
      }
      // Wait a short time before checking again
      await page.waitForTimeout(200);
    }

    // Verify file exists before verification
    expect(fileExists).toBe(true);
    expect(fs.existsSync(downloadedFilePath)).toBe(true);

    // Verify download using helper method
    const isValid = await helpers.verifyDownload(downloadedFilePath);
    expect(isValid).toBe(true);

    // Additional verification: check file size (if file still exists)
    try {
      if (fs.existsSync(downloadedFilePath)) {
        const stats = fs.statSync(downloadedFilePath);
        expect(stats.size).toBeGreaterThan(0);
        console.log(`Downloaded file size: ${stats.size} bytes`);
      }
    } catch {
    }
  });
});

