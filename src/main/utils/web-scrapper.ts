import { BrowserWindow } from 'electron';
import Turndown from 'turndown';
import * as cheerio from 'cheerio';

import { isAbortError } from '@/utils/errors';

export class WebScraper {
  private window: BrowserWindow | null = null;

  async scrape(url: string, timeout: number = 60000, abortSignal?: AbortSignal): Promise<string> {
    return await this.scrapeWithBrowserWindow(url, timeout, abortSignal);
  }

  private async scrapeWithBrowserWindow(url: string, timeout: number = 60000, abortSignal?: AbortSignal): Promise<string> {
    // Create hidden BrowserWindow for scraping
    this.window = new BrowserWindow({
      show: false,
      width: 1024,
      height: 768,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: true,
      },
    });

    try {
      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Scraping timeout after ${timeout}ms`)), timeout);
      });

      // Create abort promise if signal is provided
      const abortPromise = abortSignal
        ? new Promise<never>((_, reject) => {
            abortSignal.addEventListener('abort', () => {
              reject(new Error('The operation was aborted'));
            });
          })
        : new Promise<never>(() => {});

      // Load the URL with timeout and abort signal
      await Promise.race([this.window.loadURL(url), timeoutPromise, abortPromise]);

      // Wait for page to load completely with timeout and abort signal
      await Promise.race([this.waitForPageLoad(), timeoutPromise, abortPromise]);

      // Get page content with timeout and abort signal
      const content = await Promise.race([
        this.window.webContents.executeJavaScript(`
          document.documentElement.outerHTML;
        `),
        timeoutPromise,
        abortPromise,
      ]);

      // Get content type from headers with timeout and abort signal
      const contentType = await Promise.race([this.getContentType(), timeoutPromise, abortPromise]);

      // If it's HTML, convert to markdown-like text
      if (contentType.includes('text/html') || this.looksLikeHTML(content)) {
        return this.htmlToMarkDown(content);
      }

      return content;
    } catch (error) {
      if (isAbortError(error)) {
        return 'Operation was cancelled by user.';
      }
      return `Error: ${error instanceof Error ? error.message : String(error)}`;
    } finally {
      // Cleanup window
      await this.cleanupWindow();
    }
  }

  private async waitForPageLoad(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.window) {
        return resolve();
      }

      const checkLoadState = () => {
        if (this.window!.webContents.isLoading()) {
          setTimeout(checkLoadState, 100);
        } else {
          // Additional wait for dynamic content to load
          setTimeout(resolve, 1000);
        }
      };

      checkLoadState();
    });
  }

  private async getContentType(): Promise<string> {
    if (!this.window) {
      return '';
    }

    try {
      const contentType = await this.window.webContents.executeJavaScript(`
        (() => {
          const xhr = new XMLHttpRequest();
          xhr.open('HEAD', window.location.href, false);
          xhr.send();
          return xhr.getResponseHeader('content-type') || '';
        })()
      `);
      return contentType;
    } catch {
      return '';
    }
  }

  private async cleanupWindow(): Promise<void> {
    if (this.window && !this.window.isDestroyed()) {
      this.window.close();
    }
    this.window = null;
  }

  private looksLikeHTML(content: string): boolean {
    const htmlPatterns = [/<!DOCTYPE\s+html/i, /<html/i, /<head/i, /<body/i, /<div/i, /<p>/i, /<a\s+href=/i];

    return htmlPatterns.some((pattern) => pattern.test(content));
  }

  private cleanHtml(content: string): string {
    const $ = cheerio.load(content);

    $('script, style, link, noscript, iframe, svg, meta, img, video, audio, canvas, form, button, input, select, textarea').remove();

    // Remove comments
    $('*')
      .contents()
      .filter((_, node) => node.type === 'comment')
      .remove();

    return $.html();
  }

  private htmlToMarkDown(content: string): string {
    const cleanedHtml = this.cleanHtml(content);
    const turndownService = new Turndown();

    return turndownService.turndown(cleanedHtml);
  }
}

export const scrapeWeb = async (url: string, timeout: number = 60000, abortSignal?: AbortSignal) => {
  const scraper = new WebScraper();
  return await scraper.scrape(url, timeout, abortSignal);
};
