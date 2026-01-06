import { Page, Locator } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Helper functions for wallpaper search tests
 */

export class SearchHelpers {
  constructor(private page: Page) {}

  /**
   * Dismiss cookie consent popup if present
   */
  async dismissCookieConsent(): Promise<void> {
    try {
      // Wait for popup to appear (if it exists)
      const popupSelectors = ['#didomi-popup', '.didomi-popup-backdrop', '.didomi-popup-view', '#didomi-host'];
      let popupVisible = false;
      for (const popupSelector of popupSelectors) {
        try {
          const popup = this.page.locator(popupSelector).first();
          if (await popup.isVisible({ timeout: 2000 }).catch(() => false)) {
            popupVisible = true;
            break;
          }
        } catch {
          continue;
        }
      }
      
      // If no popup found, return early
      if (!popupVisible) {
        return;
      }
      
      // Common selectors for cookie consent accept buttons
      const consentSelectors = [
        '#didomi-notice-agree-button',
        'button[id*="didomi"]:has-text("Accept")',
        'button[id*="didomi"]:has-text("I agree")',
        'button[id*="didomi"]:has-text("Agree")',
        'button[id*="didomi"]:has-text("OK")',
        '[id*="didomi"] button:has-text("Accept")',
        '[id*="didomi"] button:has-text("I agree")',
        '[id*="didomi"] button:has-text("Agree")',
        'button:has-text("Accept All")',
        'button:has-text("Accept cookies")',
        '[data-didomi-button-id="didomi-notice-agree-button"]',
        '.didomi-button-agree',
      ];

      for (const selector of consentSelectors) {
        try {
          const button = this.page.locator(selector).first();
          if (await button.isVisible({ timeout: 2000 })) {
            // Use force click to bypass any overlays
            await button.click({ force: true });
            
            // Wait for popup to disappear
            const popup = this.page.locator('#didomi-popup, .didomi-popup-backdrop, .didomi-popup-view').first();
            try {
              await popup.waitFor({ state: 'hidden', timeout: 3000 });
            } catch {
              // Popup might already be gone or selector changed
            }
            return;
          }
        } catch {
          continue;
        }
      }

      // Alternative: try to click outside or press Escape
      const popup = this.page.locator('#didomi-popup, .didomi-popup-backdrop, #didomi-host').first();
      if (await popup.isVisible({ timeout: 2000 }).catch(() => false)) {
        // Try pressing Escape
        await this.page.keyboard.press('Escape');
        // Wait for popup to disappear
        try {
          await popup.waitFor({ state: 'hidden', timeout: 2000 });
        } catch {
          // Popup might not disappear, continue anyway
        }
      }
    } catch {
      // If we can't dismiss it, continue anyway - might not be present
      console.log('Could not dismiss cookie consent popup, continuing...');
    }
  }

  /**
   * Close advertising banners/modals that appear
   */
  async closeAdBanners(): Promise<void> {
    try {
      // Common selectors for ad close buttons
      const adCloseSelectors = [
        'button[aria-label*="close" i]',
        'button[aria-label*="Close" i]',
        'button[title*="close" i]',
        'button[title*="Close" i]',
        '.close',
        '.close-button',
        '.ad-close',
        '.modal-close',
        '[class*="close"]',
        '[class*="Close"]',
        'button:has-text("×")',
        'button:has-text("✕")',
        'button:has-text("Close")',
        '[data-dismiss="modal"]',
        '[data-close]',
        'button.close',
        'span.close',
      ];

      // Try to find and click close buttons
      for (const selector of adCloseSelectors) {
        try {
          const closeBtn = this.page.locator(selector).first();
          if (await closeBtn.isVisible({ timeout: 2000 })) {
            await closeBtn.click({ force: true });
            // Wait for ad to disappear
            try {
              await closeBtn.waitFor({ state: 'hidden', timeout: 2000 });
            } catch {
              // Ad might still be visible, continue to next method
            }
            // Check if ad is gone
            const adStillVisible = await closeBtn.isVisible({ timeout: 500 }).catch(() => false);
            if (!adStillVisible) {
              return; // Ad closed successfully
            }
          }
        } catch {
          continue;
        }
      }

      // Also try pressing Escape key
      await this.page.keyboard.press('Escape');
      // Wait a moment for Escape to take effect
      try {
        await this.page.waitForTimeout(300);
      } catch {
        // Continue if timeout fails
      }
      
      // Try clicking outside the ad (on backdrop)
      const backdrop = this.page.locator('.modal-backdrop, .ad-backdrop, [class*="backdrop"]').first();
      if (await backdrop.isVisible({ timeout: 1000 }).catch(() => false)) {
        await backdrop.click({ force: true });
        // Wait for backdrop to disappear
        try {
          await backdrop.waitFor({ state: 'hidden', timeout: 2000 });
        } catch {
          // Backdrop might not disappear, continue anyway
        }
      }
    } catch {
      // If we can't close ads, continue anyway
      console.log('Could not close ad banner, continuing...');
    }
  }

  /**
   * Perform a search for wallpapers by keyword
   */
  async searchByKeyword(keyword: string): Promise<void> {
    // Wait for page to be ready (more lenient than networkidle)
    try {
      await this.page.waitForLoadState('domcontentloaded', { timeout: 10000 });
    } catch {
      // Continue even if timeout
    }
    
    // Look for search input - try multiple possible selectors
    const searchSelectors = [
      'input[type="search"]',
      'input[placeholder*="Search"]',
      'input[placeholder*="search"]',
      'input[name="search"]',
      'input[aria-label*="Search"]',
      'input[aria-label*="search"]',
      '[data-testid*="search"] input',
      '.search input',
      '#search',
    ];

    let searchInput: Locator | null = null;
    for (const selector of searchSelectors) {
      try {
        const element = this.page.locator(selector).first();
        if (await element.isVisible({ timeout: 2000 })) {
          searchInput = element;
          break;
        }
      } catch {
        continue;
      }
    }

    if (!searchInput) {
      throw new Error('Search input field not found');
    }

    await searchInput.fill(keyword);
    await searchInput.press('Enter');
    
    // Wait for search to complete - wait for URL to change or content to appear
    try {
      await Promise.race([
        this.page.waitForURL(/\/find\//, { timeout: 10000 }),
        this.page.waitForSelector('img, article, [data-testid*="wallpaper"]', { timeout: 10000 }),
      ]);
    } catch {
      // If both time out, try to wait for any content to appear
      try {
        await this.page.waitForSelector('img, a[href*="/w/"], a[href*="/wallpaper/"]', { timeout: 2000 });
      } catch {
        // Continue even if no content found
      }
    }
    
    // Wait for results to be visible (not just present in DOM)
    try {
      const contentSelectors = ['img[src*="wallpaper"]', 'img[src*="image"]', 'a[href*="/w/"]', 'article'];
      await Promise.race(
        contentSelectors.map(selector => 
          this.page.locator(selector).first().waitFor({ state: 'visible', timeout: 3000 }).catch(() => null)
        )
      );
    } catch {
      // Continue even if content not visible yet
    }
  }

  /**
   * Get all wallpaper elements from the current page
   */
  async getWallpaperElements(): Promise<Locator[]> {
    // 1. Try to find links to specific wallpapers
    const wallpaperLinkSelectors = [
      'a[href*="/w/"]',
      'a[href^="/wallpaper/"]',
      'a[href*="/wallpaper"]',
    ];

    for (const selector of wallpaperLinkSelectors) {
      const elements = this.page.locator(selector);
      const count = await elements.count();
      if (count > 0) {
        const filtered: Locator[] = [];
        for (let i = 0; i < count; i++) {
          const element = elements.nth(i);
          const href = await element.getAttribute('href').catch(() => '');
          if (href && !href.includes('/profiles/') && !href.includes('/profile/')) {
            filtered.push(element);
          }
        }
        if (filtered.length > 0) {
          return filtered;
        }
      }
    }

    // 2. Try to find any images and their containers
    const images = this.page.locator('img');
    const imageCount = await images.count();
    if (imageCount > 0) {
      const wallpaperElements: Locator[] = [];
      for (let i = 0; i < Math.min(imageCount, 50); i++) {
        const img = images.nth(i);
        try {
          const src = await img.getAttribute('src').catch(() => '');
          if (src && 
              !src.includes('avatar') && 
              !src.includes('icon') && 
              !src.includes('logo') &&
              src.length > 20) {
            const ancestorLink = img.locator('xpath=ancestor::a[1]');
            const hasLink = await ancestorLink.count() > 0;
            
            if (hasLink) {
              const link = ancestorLink.first();
              const href = await link.getAttribute('href').catch(() => '');
              if (!href || (!href.includes('/profiles/') && !href.includes('/profile/'))) {
                wallpaperElements.push(link);
              }
            } else {
              wallpaperElements.push(img.locator('..'));
            }
          }
        } catch {
          continue;
        }
      }
      if (wallpaperElements.length > 0) {
        return wallpaperElements;
      }
    }

    // 3. Try generic content selectors
    const genericSelectors = [
      '[data-testid*="wallpaper"]',
      '[data-testid*="item"]',
      '[data-testid*="content"]',
      '.wallpaper-item',
      '.grid-item',
      '.item',
      'article',
      '[role="article"]',
      'a[href*="wallpaper"]',
      'a[href*="/w/"]',
    ];

    for (const selector of genericSelectors) {
      const elements = this.page.locator(selector);
      const count = await elements.count();
      if (count > 0) {
        const filtered: Locator[] = [];
        for (let i = 0; i < Math.min(count, 30); i++) {
          const element = elements.nth(i);
          try {
            const href = await element.getAttribute('href').catch(() => '');
            if (!href || (!href.includes('/profiles/') && !href.includes('/profile/'))) {
              filtered.push(element);
            }
          } catch {
            filtered.push(element);
          }
        }
        if (filtered.length > 0) {
          return filtered;
        }
      }
    }

    // 4. Last resort: find any clickable elements that contain images
    const clickableWithImages = this.page.locator('a:has(img), button:has(img), [role="button"]:has(img)');
    const clickableCount = await clickableWithImages.count();
    if (clickableCount > 0) {
      const filtered: Locator[] = [];
      for (let i = 0; i < Math.min(clickableCount, 30); i++) {
        const element = clickableWithImages.nth(i);
        try {
          const href = await element.getAttribute('href').catch(() => '');
          if (!href || (!href.includes('/profiles/') && !href.includes('/profile/'))) {
            filtered.push(element);
          }
        } catch {
          filtered.push(element);
        }
      }
      if (filtered.length > 0) {
        return filtered;
      }
    }

    // 5. Absolute last resort: return any links that aren't profiles
    const allLinks = this.page.locator('a[href]');
    const linkCount = await allLinks.count();
    if (linkCount > 0) {
      const filteredLinks: Locator[] = [];
      for (let i = 0; i < Math.min(linkCount, 50); i++) {
        const link = allLinks.nth(i);
        const href = await link.getAttribute('href').catch(() => '');
        if (href && 
            !href.includes('/profiles/') &&
            !href.includes('/profile/') &&
            !href.includes('/ringtones') &&
            !href.includes('?keyword=') &&
            !href.includes('?category=') &&
            href.length > 5) {
          filteredLinks.push(link);
        }
      }
      if (filteredLinks.length > 0) {
        return filteredLinks;
      }
    }

    return [];
  }

  /**
   * Check if a wallpaper is free or premium
   */
  async isFreeWallpaper(wallpaperElement: Locator): Promise<boolean> {
    try {
      // Look for premium indicators
      const premiumIndicators = [
        'premium',
        'pro',
        'paid',
        'subscribe',
        'lock',
        '🔒',
        '💰',
      ];

      const elementText = await wallpaperElement.textContent();
      const elementHTML = await wallpaperElement.innerHTML();

      // Check if any premium indicator is present
      const hasPremiumIndicator = premiumIndicators.some(indicator => {
        const lowerText = (elementText || '').toLowerCase();
        const lowerHTML = (elementHTML || '').toLowerCase();
        return lowerText.includes(indicator) || lowerHTML.includes(indicator);
      });

      if (hasPremiumIndicator) {
        return false;
      }

      // If no premium indicators found, assume it's free
      // In many cases, free items don't have explicit badges
      return true;
    } catch {
      // If we can't determine, assume it might be free (optimistic approach)
      return true;
    }
  }

  /**
   * Download a free wallpaper
   */
  async downloadFreeWallpaper(wallpaperElement: Locator): Promise<string> {
    // Make sure cookie consent is dismissed
    await this.dismissCookieConsent();
    
    // First, try to find a direct download link within the element
    const directDownloadLink = wallpaperElement.locator('a[href*="download"], a[href*=".jpg"], a[href*=".png"], a[href*=".jpeg"]').first();
    const hasDirectLink = await directDownloadLink.count() > 0;

    if (hasDirectLink) {
      // Set up download listener before clicking
      const downloadPromise = this.page.waitForEvent('download', { timeout: 30000 });
      await directDownloadLink.click({ force: true });
      const download = await downloadPromise;
      const downloadPath = await download.path();
      if (!downloadPath) {
        throw new Error('Download path is null');
      }
      return downloadPath;
    }

    // If no direct link, click on wallpaper to open detail page
    // Use force click to bypass any overlays
    await wallpaperElement.click({ force: true });
    
    // Wait for navigation or modal to appear (more lenient than networkidle)
    try {
      await Promise.race([
        this.page.waitForLoadState('domcontentloaded', { timeout: 10000 }),
        this.page.waitForURL(/\/w\/|\/wallpaper\//, { timeout: 10000 }),
        this.page.waitForSelector('img, button, a[href*="download"]', { timeout: 10000 }),
      ]);
    } catch {
      // Continue even if timeout
    }
    
    // Wait for page content to be ready
    try {
      await Promise.race([
        this.page.waitForSelector('img', { timeout: 5000 }),
        this.page.waitForLoadState('domcontentloaded', { timeout: 5000 }),
      ]);
    } catch {
      // Continue even if timeout
    }
    
    // Close any advertising banners/modals that appear
    await this.closeAdBanners();
    
    // Wait for download button or main content to be ready after closing ads
    try {
      await Promise.race([
        this.page.locator('button, a[href*="download"], img').first().waitFor({ state: 'visible', timeout: 3000 }),
        this.page.waitForLoadState('domcontentloaded', { timeout: 3000 }),
      ]);
    } catch {
      // Continue even if not ready
    }
    
    // Look for download button/link on detail page
    const downloadSelectors = [
      'a[href*="download"]',
      'a[href*=".jpg"]',
      'a[href*=".png"]',
      'a[href*=".jpeg"]',
      'button[aria-label*="download" i]',
      'button[aria-label*="Download"]',
      '[data-action*="download" i]',
      'button:has-text("Download")',
      'a:has-text("Download")',
      '[data-testid*="download" i]',
      'button.download',
      'a.download',
      'button[title*="download" i]',
      'a[title*="download" i]',
    ];

    // Wait for download button to appear (it might appear after ad is closed)
    let downloadButton: Locator | null = null;
    for (const selector of downloadSelectors) {
      try {
        const btn = this.page.locator(selector).first();
        // Wait longer for button to appear (ads might delay it)
        if (await btn.isVisible({ timeout: 5000 })) {
          downloadButton = btn;
          break;
        }
      } catch {
        continue;
      }
    }

    if (downloadButton) {
      try {
        // Set up download listener right before clicking
        // Use timeout (45 seconds) to account for 10-second delay + download time, leaving time for fallback
        const downloadPromise = this.page.waitForEvent('download', { timeout: 45000 });
        await downloadButton.click();
        
        // Wait for download to start (with timeout for the 10-second delay)
        const download = await downloadPromise;
        
        // Get the download path
        const downloadPath = await download.path();
        if (!downloadPath) {
          throw new Error('Download path is null');
        }

        return downloadPath;
      } catch {
        // If download event doesn't fire (maybe JavaScript download), try fallback
        console.log('Download event did not fire after 45 seconds, trying to fetch image directly...');
        // Continue to fallback method below
      }
    }

    // If no download button found or download event didn't fire, try alternative methods
    // Method 1: Try to find the main image and get its source URL
    // Wait for images to be visible
    try {
      await this.page.waitForSelector('img', { timeout: 5000 });
    } catch {
      // Continue even if no images found
    }
    
    // Try to find the actual wallpaper image (not logos/avatars)
    // Look for larger images that are likely wallpapers
    const imageSelectors = [
      'img[src*="wallpaper"]',
      'img[src*="image"]',
      'img[alt*="wallpaper"]',
      'img[class*="wallpaper"]',
      'img',
    ];
    
    let mainImage: Locator | null = null;
    for (const selector of imageSelectors) {
      const images = this.page.locator(selector);
      const count = await images.count();
      if (count > 0) {
        // Filter out small images (likely icons/logos) and avatar images
        for (let i = 0; i < count; i++) {
          const img = images.nth(i);
          try {
            const src = await img.getAttribute('src').catch(() => '');
            const alt = await img.getAttribute('alt').catch(() => '');
            const className = await img.getAttribute('class').catch(() => '');
            
            // Skip if it's clearly a logo, avatar, or icon
            if (src && (
              src.includes('logo') || 
              src.includes('avatar') || 
              src.includes('icon') ||
              src.includes('32dp') ||
              src.includes('16dp') ||
              alt?.toLowerCase().includes('logo') ||
              alt?.toLowerCase().includes('avatar') ||
              className?.toLowerCase().includes('logo') ||
              className?.toLowerCase().includes('avatar')
            )) {
              continue;
            }
            
            // Check image dimensions if possible (larger images are more likely wallpapers)
            const boundingBox = await img.boundingBox().catch(() => null);
            if (boundingBox && (boundingBox.width > 100 && boundingBox.height > 100)) {
              mainImage = img;
              break;
            } else if (!boundingBox) {
              // If we can't get dimensions, use it if it doesn't look like a logo
              mainImage = img;
              break;
            }
          } catch {
            continue;
          }
        }
        if (mainImage) break;
      }
    }
    
    // Fallback to first image if we didn't find a good one
    if (!mainImage) {
      mainImage = this.page.locator('img').first();
    }
    if (await mainImage.isVisible({ timeout: 3000 }).catch(() => false)) {
      const imageSrc = await mainImage.getAttribute('src').catch(() => '');
      if (imageSrc) {
        // Skip if it's clearly a logo/avatar based on filename
        const fileName = imageSrc.split('/').pop()?.toLowerCase() || '';
        if (fileName.includes('logo') || fileName.includes('avatar') || fileName.includes('icon') || 
            fileName.includes('32dp') || fileName.includes('16dp')) {
          throw new Error('Found logo/avatar image instead of wallpaper, skipping download');
        }
        
        // Make sure it's a full URL
        let imageUrl = imageSrc;
        if (imageSrc.startsWith('/')) {
          const baseUrl = this.page.url().split('/').slice(0, 3).join('/');
          imageUrl = baseUrl + imageSrc;
        } else if (!imageSrc.startsWith('http')) {
          const baseUrl = this.page.url().split('/').slice(0, 3).join('/');
          imageUrl = baseUrl + '/' + imageSrc;
        }

        // Try to download by navigating to the image URL
        try {
          const downloadPromise = this.page.waitForEvent('download', { timeout: 10000 });
          await this.page.goto(imageUrl);
          const download = await downloadPromise;
          const downloadPath = await download.path();
          if (downloadPath) {
            return downloadPath;
          }
        } catch {
          // If navigation doesn't trigger download, try fetching the image
          try {
            // Use shorter timeout since we already waited 45 seconds
            const response = await this.page.request.get(imageUrl, { timeout: 20000 });
            if (response.ok()) {
              const buffer = await response.body();
              let fileName = imageUrl.split('/').pop()?.split('?')[0] || `wallpaper.jpg`;
              
              // Sanitize filename - remove invalid characters and ensure it has an extension
              fileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
              if (!fileName.match(/\.(jpg|jpeg|png|gif|webp|bmp)$/i)) {
                // If no extension, add .jpg
                fileName = `${fileName}.jpg`;
              }
              
              // Add unique identifier to prevent collisions when tests run in parallel
              const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
              const baseName = fileName.replace(/\.(jpg|jpeg|png|gif|webp|bmp)$/i, '');
              const ext = fileName.match(/\.(jpg|jpeg|png|gif|webp|bmp)$/i)?.[0] || '.jpg';
              fileName = `${baseName}-${uniqueId}${ext}`;
              
              const downloadDir = path.join(process.cwd(), 'downloads');
              if (!fs.existsSync(downloadDir)) {
                fs.mkdirSync(downloadDir, { recursive: true });
              }
              const filePath = path.join(downloadDir, fileName);
              fs.writeFileSync(filePath, buffer);
              
              // Verify file was actually written
              if (!fs.existsSync(filePath)) {
                throw new Error(`File was not created at ${filePath}`);
              }
              
              console.log(`Successfully downloaded image to ${filePath}, size: ${buffer.length} bytes`);
              return filePath;
            } else {
              throw new Error(`Failed to fetch image: HTTP ${response.status()}`);
            }
          } catch (fetchError) {
            console.log(`Failed to fetch image from ${imageUrl}: ${fetchError}`);
            // Don't continue silently - rethrow if this was our last good option
            // But first, let's try to find a better image
          }
        }
      }
    }

    throw new Error('Could not find download button or trigger download. The wallpaper may require user interaction or authentication.');
  }

  /**
   * Verify that a file was downloaded successfully
   */
  async verifyDownload(filePath: string): Promise<boolean> {
    try {
      if (!fs.existsSync(filePath)) {
        return false;
      }

      const stats = fs.statSync(filePath);
      if (stats.size === 0) {
        return false;
      }

      // Check image file signature
      try {
        const fullBuffer = fs.readFileSync(filePath);
        if (fullBuffer.length < 10) {
          return stats.size > 0;
        }
        
        const buffer = fullBuffer.slice(0, 10);
        const isImage = 
          (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) || // JPEG
          (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) || // PNG
          (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) || // GIF
          (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46); // RIFF (WEBP/other)

        if (isImage) {
          return true;
        }
        
        // Accept if reasonably large even without signature
        return stats.size > 100;
      } catch {
        return stats.size > 0;
      }
    } catch {
      return false;
    }
  }

  /**
   * Wait for search results to appear
   */
  async waitForSearchResults(): Promise<void> {
    // Wait for DOM to be ready (more lenient than networkidle)
    try {
      await this.page.waitForLoadState('domcontentloaded', { timeout: 10000 });
    } catch {
      // If domcontentloaded times out, continue anyway
    }
    
    // Wait for content to appear - this is the important part
    const contentSelectors = [
      'img[src*="wallpaper"]',
      'img[src*="image"]',
      '[data-testid*="wallpaper"]',
      'article',
      '.grid-item',
      'a[href*="/w/"]',
      'a[href*="/wallpaper/"]',
    ];

    let contentFound = false;
    for (const selector of contentSelectors) {
      try {
        await this.page.waitForSelector(selector, { timeout: 10000 });
        contentFound = true;
        break;
      } catch {
        continue;
      }
    }

    if (!contentFound) {
      // Fallback: try to wait for any content to appear
      try {
        await this.page.waitForSelector('img, a, article', { timeout: 2000 });
      } catch {
        // Continue even if no content found
      }
    } else {
      // Wait for content to be visible (not just in DOM)
      try {
        await Promise.race(
          contentSelectors.map(selector => 
            this.page.locator(selector).first().waitFor({ state: 'visible', timeout: 2000 }).catch(() => null)
          )
        );
      } catch {
        // Continue even if not visible
      }
    }
  }
}

