import * as https from 'https';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { chromium } from 'playwright-extra';
import stealthPlugin from 'puppeteer-extra-plugin-stealth';

chromium.use(stealthPlugin());

interface ProxyEntry {
  host: string;
  port: number;
}

const FALLBACK_PROXIES: ProxyEntry[] = [
  { host: '31.59.20.176',    port: 6754 },
  { host: '23.95.150.145',   port: 6114 },
  { host: '198.23.239.134',  port: 6540 },
  { host: '45.38.107.97',    port: 6014 },
  { host: '107.172.163.27',  port: 6543 },
  { host: '198.105.121.200', port: 6462 },
  { host: '64.137.96.74',    port: 6641 },
  { host: '216.10.27.159',   port: 6837 },
  { host: '142.111.67.146',  port: 5611 },
  { host: '194.39.32.164',   port: 6461 },
];

// Consistent Windows 10 + Chrome 145 user agent
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36';

function fetchWebshareProxies(apiKey: string): Promise<ProxyEntry[]> {
  return new Promise((resolve) => {
    const options = {
      hostname: 'proxy.webshare.io',
      path: '/api/v2/proxy/list/?mode=direct&page=1&page_size=100',
      headers: { Authorization: `Token ${apiKey}` },
    };
    https.get(options, (res) => {
      let raw = '';
      res.on('data', (chunk) => (raw += chunk));
      res.on('end', () => {
        try {
          const json = JSON.parse(raw);
          const proxies: ProxyEntry[] = (json.results || []).map((p: any) => ({
            host: p.proxy_address,
            port: p.port,
          }));
          resolve(proxies.length ? proxies : FALLBACK_PROXIES);
        } catch {
          resolve(FALLBACK_PROXIES);
        }
      });
    }).on('error', () => resolve(FALLBACK_PROXIES));
  });
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

@Injectable()
export class FormFillerService {
  constructor(private config: ConfigService) {}

  async run(): Promise<void> {
    const formUrl = this.config.get<string>('formFiller.formUrl')!;
    const wsUser = this.config.get<string>('formFiller.webshareUser');
    const wsPass = this.config.get<string>('formFiller.websharePass');
    const wsApiKey = this.config.get<string>('formFiller.webshareApiKey');

    if (!wsUser || !wsPass) {
      console.error('Error: WEBSHARE_USERNAME and WEBSHARE_PASSWORD must be set in .env');
      return;
    }

    const proxyList = wsApiKey
      ? await fetchWebshareProxies(wsApiKey)
      : FALLBACK_PROXIES;

    const proxy = pickRandom(proxyList);
    const proxyServer = `http://${proxy.host}:${proxy.port}`;

    console.log(`Target URL  : ${formUrl}`);
    console.log(`Proxy       : ${proxyServer}`);
    console.log(`Proxy User  : ${wsUser}`);
    console.log(`Source      : ${wsApiKey ? 'Webshare API (live list)' : 'hardcoded fallback list'}`);

    try {
      const browser = await chromium.launch({
        headless: false,
        proxy: { server: proxyServer, username: wsUser, password: wsPass },
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-blink-features=AutomationControlled',
          '--disable-infobars',
          '--window-position=0,0',
          '--ignore-certificate-errors',
          '--ignore-certificate-errors-spki-list',
          '--use-gl=swiftshader',            // Mask real GPU with Google SwiftShader
          '--disable-features=IsolateOrigins,site-per-process',
        ],
      });

      const context = await browser.newContext({
        viewport: { width: 1920, height: 1080 },
        ignoreHTTPSErrors: true,
        locale: 'en-US',
        timezoneId: 'America/Chicago',       // Match US proxy IPs; avoids Albania timezone leak
        userAgent: USER_AGENT,
      });

      // Patch navigator properties that fingerprinting tools inspect
      await context.addInitScript(() => {
        // Remove automation flag
        Object.defineProperty(navigator, 'webdriver', { get: () => false });

        // Fix userAgentData to match the Win10 userAgent string (removes Win10/Win11 mismatch)
        const uaData = {
          brands: [
            { brand: 'Not(A:Brand', version: '99' },
            { brand: 'Google Chrome', version: '145' },
            { brand: 'Chromium', version: '145' },
          ],
          mobile: false,
          platform: 'Windows',
          getHighEntropyValues: () =>
            Promise.resolve({
              platform: 'Windows',
              platformVersion: '10.0.0',
              architecture: 'x86',
              bitness: '64',
              model: '',
              uaFullVersion: '145.0.7632.6',
              fullVersionList: [
                { brand: 'Not(A:Brand', version: '99.0.0.0' },
                { brand: 'Google Chrome', version: '145.0.7632.6' },
                { brand: 'Chromium', version: '145.0.7632.6' },
              ],
            }),
          toJSON: () => ({
            brands: [
              { brand: 'Not(A:Brand', version: '99' },
              { brand: 'Google Chrome', version: '145' },
              { brand: 'Chromium', version: '145' },
            ],
            mobile: false,
            platform: 'Windows',
          }),
        };
        Object.defineProperty(navigator, 'userAgentData', {
          get: () => uaData,
          configurable: true,
        });

        // Remove puppeteer-extra / playwright runtime traces
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const w = window as any;
        delete w.__playwright;
        delete w.__pw_manual;
        delete w.__pw_hooks;
        delete w.__PW_inspect_custom_element__;
      });

      const page = await context.newPage();

      console.log('Navigating to URL...');
      await page.goto(formUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

      console.log('Browser is open. Interact manually or press Ctrl+C to stop.');

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
