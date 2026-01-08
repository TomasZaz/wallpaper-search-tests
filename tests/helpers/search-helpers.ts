import { Page, Locator } from '@playwright/test';
import * as fs from 'fs';

/**
 * Helper functions for wallpaper search tests
 */
export class SearchHelpers {
  constructor(private page: Page) { }

  /**
   * Dismiss cookie consent popup if present
   */
  async dismissCookieConsent(): Promise<void> {
    try {
      // Wait for cookie banner to appear and click accept
      const acceptButton = this.page.getByRole('button', { name: /Accept/i });
      await acceptButton.waitFor({ state: 'visible', timeout: 3000 });
      await acceptButton.click();
      // Wait for banner to disappear
      await acceptButton.waitFor({ state: 'hidden', timeout: 2000 }).catch(() => {});
    } catch {
      // No popup or already dismissed
    }
  }

  /**
   * Close advertising banners/modals that appear
   */
  async closeAdBanners(): Promise<void> {
    try {
      await this.page.getByRole('button', { name: 'Close' }).click({ timeout: 2000 });
    } catch {
      // No ad banner or already closed
    }
  }

  /**
   * Perform a search for wallpapers by keyword
   */
  async searchByKeyword(keyword: string): Promise<void> {
    await this.page.locator('#search').first().fill(keyword);
    await this.page.locator('#search').first().press('Enter');
    await this.page.waitForURL(/\/find\//);
  }

  /**
   * Get all wallpaper elements from the current page
   */
  async getWallpaperElements(): Promise<Locator[]> {
    // Try different patterns
    let elements = this.page.locator('a[href*="/wallpapers/"]');
    let count = await elements.count();

    if (count === 0) {
      elements = this.page.locator('a[href*="/w/"]');
      count = await elements.count();
    }

    if (count === 0) {
      elements = this.page.locator('a[href*="/wallpaper/"]');
      count = await elements.count();
    }

    const result: Locator[] = [];
    for (let i = 0; i < count; i++) {
      const element = elements.nth(i);
      const href = await element.getAttribute('href');
      if (href && !href.includes('/profiles/') && !href.includes('/profile/')) {
        result.push(element);
      }
    }
    return result;
  }

  /**
   * Check if a wallpaper is free or premium
   */
  async isFreeWallpaper(wallpaperElement: Locator): Promise<boolean> {
    const text = await wallpaperElement.textContent();
    const hasPremium = /premium/i.test(text || '');
    return !hasPremium;
  }

  /**
   * Download a free wallpaper
   */
  async downloadFreeWallpaper(wallpaperElement: Locator): Promise<string> {
    // Get the wallpaper URL
    const href = await wallpaperElement.getAttribute('href');
    if (!href) {
      throw new Error('Could not find wallpaper URL');
    }

    // Navigate to wallpaper page
    await this.page.goto(href);
    
    // Dismiss cookie banner
    await this.dismissCookieConsent();

    // Set up download promise before clicking
    const downloadPromise = this.page.waitForEvent('download', { timeout: 60000 });
    
    // Click download button
    await this.page.getByRole('button', { name: 'Download' }).click();
    
    // Wait for "preparing download" banner to appear and disappear
    try {
      // Look for text containing "preparing"
      const preparingBanner = this.page.getByText(/preparing/i);
      
      // Wait for banner to appear (if it appears)
      await preparingBanner.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {
      });
      
      // Wait for banner to disappear
      await preparingBanner.waitFor({ state: 'hidden', timeout: 25000 }).catch(() => {
      });
      
      // Wait a bit more after banner disappears to ensure download starts
      await this.page.waitForTimeout(7000);
    } catch {
      // If cannot find the banner, wait a bit for the download to start
      await this.page.waitForTimeout(2000);
    }

    // Wait for download to complete
    const download = await downloadPromise;

    const downloadPath = await download.path();
    if (!downloadPath) {
      throw new Error('Download failed');
    }

    return downloadPath;
  }

  /**
   * Verify that a file was downloaded successfully
   */
  async verifyDownload(filePath: string): Promise<boolean> {
    if (!fs.existsSync(filePath)) {
      return false;
    }
    const stats = fs.statSync(filePath);
    return stats.size > 0;
  }

  /**
   * Wait for search results to appear
   */
  async waitForSearchResults(): Promise<void> {
    await Promise.race([
      this.page.waitForSelector('a[href*="/w/"]'),
      this.page.waitForSelector('a[href*="/wallpaper/"]'),
      this.page.waitForSelector('img'),
    ]);
  }
}
