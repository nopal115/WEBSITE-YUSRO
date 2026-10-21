import { Injectable, OnModuleDestroy } from '@nestjs/common';
import puppeteer, { Browser } from 'puppeteer';

@Injectable()
export class BrowserService implements OnModuleDestroy {
  private browser?: Browser;

  async renderHtmlToPdf(html: string, options?: { landscape?: boolean }): Promise<Uint8Array> {
    this.browser ??= await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await this.browser.newPage();
    try {
      await page.setContent(html, { waitUntil: 'networkidle0' });
      return await page.pdf({
        format: 'A4',
        printBackground: true,
        landscape: options?.landscape ?? false,
      });
    } finally {
      await page.close();
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.browser?.close();
  }
}
