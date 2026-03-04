import * as http  from 'http';
import * as https from 'https';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { chromium } from 'playwright';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProxyEntry {
  host: string;
  port: number;
}

interface GeoInfo {
  timezone:    string;
  locale:      string;
  city:        string;
  countryCode: string;
}

// ─── Proxy pool ───────────────────────────────────────────────────────────────

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

const RESOLUTIONS = [
  { w: 1366, h: 768  },
  { w: 1920, h: 1080 },
  { w: 1440, h: 900  },
  { w: 1280, h: 800  },
  { w: 1600, h: 900  },
  { w: 2560, h: 1440 },
  { w: 1280, h: 1024 },
];

// Country code → browser locale mapping
const COUNTRY_LOCALE: Record<string, string> = {
  US: 'en-US', GB: 'en-GB', AU: 'en-AU', CA: 'en-CA',
  CH: 'de-CH', DE: 'de-DE', AT: 'de-AT',
  FR: 'fr-FR', BE: 'fr-BE',
  IT: 'it-IT', ES: 'es-ES', NL: 'nl-NL',
  PL: 'pl-PL', CZ: 'cs-CZ', RO: 'ro-RO',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Asks ip-api.com for the timezone/country of the IP the proxy assigns us.
 * Uses a plain HTTP request forwarded through the proxy (no CONNECT needed for HTTP).
 */
function getProxyGeoInfo(proxyServer: string, username: string, password: string): Promise<GeoInfo> {
  const fallback: GeoInfo = { timezone: 'Europe/Zurich', locale: 'de-CH', city: 'Zurich', countryCode: 'CH' };

  return new Promise((resolve) => {
    try {
      const proxy = new URL(proxyServer);
      const auth  = Buffer.from(`${username}:${password}`).toString('base64');

      const req = http.request(
        {
          hostname: proxy.hostname,
          port:     parseInt(proxy.port) || 80,
          // Full target URL as path — standard HTTP proxy forwarding
          path:    'http://ip-api.com/json/?fields=timezone,countryCode,city',
          method:  'GET',
          headers: {
            Host:                  'ip-api.com',
            'Proxy-Authorization': `Basic ${auth}`,
          },
        },
        (res) => {
          let raw = '';
          res.on('data', (chunk) => (raw += chunk));
          res.on('end', () => {
            try {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const json: any = JSON.parse(raw);
              const cc = json.countryCode || 'CH';
              resolve({
                timezone:    json.timezone    || fallback.timezone,
                city:        json.city        || fallback.city,
                countryCode: cc,
                locale:      COUNTRY_LOCALE[cc] || 'en-US',
              });
            } catch {
              resolve(fallback);
            }
          });
        },
      );

      req.on('error', () => resolve(fallback));
      req.setTimeout(8000, () => { req.destroy(); resolve(fallback); });
      req.end();
    } catch {
      resolve(fallback);
    }
  });
}

// ─── Webshare API ─────────────────────────────────────────────────────────────

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
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class FormFillerService {
  constructor(private config: ConfigService) {}

  async run(): Promise<void> {
    const formUrl       = this.config.get<string>('formFiller.formUrl')!;
    const wsProxyServer = this.config.get<string>('formFiller.webshareProxyServer');
    const wsUser        = this.config.get<string>('formFiller.webshareUser');
    const wsPass        = this.config.get<string>('formFiller.websharePass');
    const wsApiKey      = this.config.get<string>('formFiller.webshareApiKey');

    if (!wsUser || !wsPass) {
      console.error('Error: WEBSHARE_USERNAME and WEBSHARE_PASSWORD must be set in .env');
      return;
    }

    // ── Proxy ──────────────────────────────────────────────────────────────
    let proxyServer: string;
    if (wsProxyServer) {
      proxyServer = wsProxyServer;
    } else {
      const proxyList = wsApiKey ? await fetchWebshareProxies(wsApiKey) : FALLBACK_PROXIES;
      const proxy     = pickRandom(proxyList);
      proxyServer     = `http://${proxy.host}:${proxy.port}`;
    }

    // ── Detect actual timezone/locale from the proxy IP ────────────────────
    console.log('Detecting proxy location...');
    const geo = await getProxyGeoInfo(proxyServer, wsUser, wsPass);

    // ── Random window size ─────────────────────────────────────────────────
    const res = pickRandom(RESOLUTIONS);

    console.log('─────────────────────────────────────────');
    console.log(`Target URL   : ${formUrl}`);
    console.log(`Proxy        : ${proxyServer}`);
    console.log(`Location     : ${geo.city}, ${geo.countryCode}`);
    console.log(`Timezone     : ${geo.timezone}`);
    console.log(`Locale       : ${geo.locale}`);
    console.log(`Screen       : ${res.w}x${res.h}`);
    console.log('─────────────────────────────────────────');

    try {
      const browser = await chromium.launch({
        headless: false,
        proxy: { server: proxyServer, username: wsUser, password: wsPass },
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          // Removes navigator.webdriver at native level — no JS patch needed
          '--disable-blink-features=AutomationControlled',
          '--disable-infobars',
          `--window-size=${res.w},${res.h}`,
          '--ignore-certificate-errors',
          '--ignore-certificate-errors-spki-list',
          '--disable-features=IsolateOrigins,site-per-process',
          '--force-webrtc-ip-handling-policy=disable_non_proxied_udp',
        ],
      });

      // No JS overrides at all — zero patches = nothing for "Masking detected" to find.
      // Timezone and locale are set at context level (not via JS), which is undetectable.
      const context = await browser.newContext({
        viewport:          { width: res.w, height: res.h },
        ignoreHTTPSErrors: true,
        locale:            geo.locale,
        timezoneId:        geo.timezone,
      });

      const page = await context.newPage();

      console.log('Navigating to URL...');
      await page.goto(formUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
      console.log('Browser is open. Fill the form manually, then close the window.');

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
