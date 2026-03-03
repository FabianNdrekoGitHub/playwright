import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { chromium } from 'playwright-extra';
import stealthPlugin from 'puppeteer-extra-plugin-stealth';

// Enable the stealth plugin
chromium.use(stealthPlugin());

@Injectable()
export class FormFillerService {
  constructor(private config: ConfigService) {}

  async run(): Promise<void> {
    const formUrl = this.config.get<string>('formFiller.formUrl')!;
    const brdUser = this.config.get<string>('formFiller.brightDataUser');
    const brdPass = this.config.get<string>('formFiller.brightDataPass');

    if (!brdUser || !brdPass) {
      console.error('Error: BRIGHT_DATA_USERNAME and BRIGHT_DATA_PASSWORD must be set in .env');
      return;
    }

    const brdHost = 'brd.superproxy.io:22225';

    // Randomly select a country: Germany (de), Switzerland (ch), Greece (gr)
    const countries = ['de', 'ch', 'gr'];
    const randomCountry = countries[Math.floor(Math.random() * countries.length)];

    // Construct the Proxy URL with the country flag
    // Bright Data format: user-country-de
    // Note: If your zone is not configured for country targeting, this might need adjustment.
    // Assuming standard Bright Data zone configuration where country can be appended.
    // If your username already contains -zone-..., we append -country-code.
    
    // Check if username already has 'country' in it, if so, we might need to replace it or append.
    // Standard format: brd-customer-<id>-zone-<zone>-country-<country>
    const proxyUser = `${brdUser}-country-${randomCountry}`;
    const proxyServer = `http://${brdHost}`;

    console.log(`Starting browser in ${randomCountry.toUpperCase()}...`);
    console.log(`Target URL: ${formUrl}`);
    console.log(`Proxy User: ${proxyUser}`);

    try {
      // Launch Browser
      // headless: false -> so you can see it
      const browser = await chromium.launch({
        headless: false,
        proxy: {
          server: proxyServer,
          username: proxyUser,
          password: brdPass,
        },
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-infobars',
          '--window-position=0,0',
          '--ignore-certificate-errors',
          '--ignore-certificate-errors-spki-list',
        ],
      });

      const context = await browser.newContext({
        viewport: null, // Let the browser window decide the size
        ignoreHTTPSErrors: true,
        // Set locale and timezone based on country
        locale: randomCountry === 'gr' ? 'el-GR' : randomCountry === 'de' ? 'de-DE' : 'de-CH',
        timezoneId: randomCountry === 'gr' ? 'Europe/Athens' : randomCountry === 'de' ? 'Europe/Berlin' : 'Europe/Zurich',
      });

      const page = await context.newPage();

      // Go to the URL
      console.log('Navigating to form...');
      await page.goto(formUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

      console.log('Browser is open. You can now interact manually.');
      console.log('Press Ctrl+C in the terminal to close the script and browser.');

      // Keep the process alive until browser is closed
      await new Promise<void>((resolve) => {
        browser.on('disconnected', () => {
          console.log('Browser closed. Exiting...');
          resolve();
        });
      });
    } catch (error) {
      console.error('Error launching browser:', error);
    }
  }
}
