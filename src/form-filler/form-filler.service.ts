import * as https from 'https';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { chromium } from 'playwright';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProxyEntry {
  host: string;
  port: number;
}

interface Persona {
  screenWidth:   number;
  screenHeight:  number;
  chromeVersion: number;
  chromeBuild:   string;
  cores:         number;
  memory:        number;
  timezoneId:    string;
  locale:        string;
  userAgent:     string;
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

// ─── Persona pools ────────────────────────────────────────────────────────────

const RESOLUTIONS = [
  { w: 1366, h: 768  },
  { w: 1920, h: 1080 },
  { w: 1440, h: 900  },
  { w: 1280, h: 800  },
  { w: 1600, h: 900  },
  { w: 2560, h: 1440 },
  { w: 1280, h: 1024 },
];

const CHROME_VERSIONS = [
  120, 121, 122, 123, 124, 125, 126, 127, 128,
  129, 130, 131, 132, 133, 134, 135, 136, 137,
  138, 139, 140, 141, 142, 143, 144, 145,
];

const US_TIMEZONES = [
  { id: 'America/New_York',    locale: 'en-US' },
  { id: 'America/Chicago',     locale: 'en-US' },
  { id: 'America/Denver',      locale: 'en-US' },
  { id: 'America/Los_Angeles', locale: 'en-US' },
  { id: 'America/Phoenix',     locale: 'en-US' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generatePersona(): Persona {
  const res      = pickRandom(RESOLUTIONS);
  const chromeV  = pickRandom(CHROME_VERSIONS);
  const tz       = pickRandom(US_TIMEZONES);
  const build    = `${rand(1000, 9999)}.${rand(10, 99)}`;

  return {
    screenWidth:   res.w,
    screenHeight:  res.h,
    chromeVersion: chromeV,
    chromeBuild:   build,
    cores:         pickRandom([2, 4, 8, 16]),
    memory:        pickRandom([2, 4, 8]),
    timezoneId:    tz.id,
    locale:        tz.locale,
    userAgent:     `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeV}.0.0.0 Safari/537.36`,
  };
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
    // If WEBSHARE_PROXY_SERVER is set (rotating endpoint), use it directly.
    // Otherwise fall back to picking a random IP from the static list.
    let proxyServer: string;
    if (wsProxyServer) {
      proxyServer = wsProxyServer;
    } else {
      const proxyList = wsApiKey ? await fetchWebshareProxies(wsApiKey) : FALLBACK_PROXIES;
      const proxy     = pickRandom(proxyList);
      proxyServer     = `http://${proxy.host}:${proxy.port}`;
    }

    // ── Persona (new random identity each run) ─────────────────────────────
    const persona = generatePersona();

    console.log('─────────────────────────────────────────');
    console.log(`Target URL   : ${formUrl}`);
    console.log(`Proxy        : ${proxyServer}`);
    console.log(`Screen       : ${persona.screenWidth}x${persona.screenHeight}`);
    console.log(`Chrome       : ${persona.chromeVersion}`);
    console.log(`Cores / RAM  : ${persona.cores} cores / ${persona.memory} GB`);
    console.log(`Timezone     : ${persona.timezoneId}`);
    console.log('─────────────────────────────────────────');

    try {
      const browser = await chromium.launch({
        headless: false,
        proxy: { server: proxyServer, username: wsUser, password: wsPass },
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-blink-features=AutomationControlled',
          '--disable-infobars',
          `--window-size=${persona.screenWidth},${persona.screenHeight}`,
          '--ignore-certificate-errors',
          '--ignore-certificate-errors-spki-list',
          '--use-gl=swiftshader',
          '--disable-features=IsolateOrigins,site-per-process',
          '--force-webrtc-ip-handling-policy=disable_non_proxied_udp',
        ],
      });

      const context = await browser.newContext({
        viewport:        { width: persona.screenWidth, height: persona.screenHeight },
        ignoreHTTPSErrors: true,
        locale:          persona.locale,
        timezoneId:      persona.timezoneId,
        userAgent:       persona.userAgent,
      });

      // Inject persona fingerprint values into every page/frame
      await context.addInitScript(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (p: any) => {
          const w = window as any;

          // ── Automation flag ──────────────────────────────────────────────
          Object.defineProperty(navigator, 'webdriver', { get: () => undefined });

          // ── Platform ─────────────────────────────────────────────────────
          Object.defineProperty(navigator, 'platform', { get: () => 'Win32' });

          // ── Languages ────────────────────────────────────────────────────
          Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });

          // ── Hardware (randomised per run) ─────────────────────────────────
          Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => p.cores });
          Object.defineProperty(navigator, 'deviceMemory',        { get: () => p.memory });

          // ── Screen dimensions (match window size) ─────────────────────────
          Object.defineProperty(screen, 'width',       { get: () => p.screenWidth });
          Object.defineProperty(screen, 'height',      { get: () => p.screenHeight });
          Object.defineProperty(screen, 'availWidth',  { get: () => p.screenWidth });
          Object.defineProperty(screen, 'availHeight', { get: () => p.screenHeight - 40 });
          Object.defineProperty(screen, 'colorDepth',  { get: () => 24 });
          Object.defineProperty(screen, 'pixelDepth',  { get: () => 24 });

          // ── Chrome runtime mock ───────────────────────────────────────────
          w.chrome = {
            app: {
              isInstalled: false,
              InstallState: { DISABLED: 'disabled', INSTALLED: 'installed', NOT_INSTALLED: 'not_installed' },
              RunningState: { CANNOT_RUN: 'cannot_run', READY_TO_RUN: 'ready_to_run', RUNNING: 'running' },
            },
            runtime: {
              PlatformOs:   { MAC: 'mac', WIN: 'win', ANDROID: 'android', CROS: 'cros', LINUX: 'linux', OPENBSD: 'openbsd' },
              PlatformArch: { ARM: 'arm', ARM64: 'arm64', X86_32: 'x86-32', X86_64: 'x86-64', MIPS: 'mips', MIPS64: 'mips64' },
              connect:      () => ({ postMessage: () => {}, disconnect: () => {}, onDisconnect: { addListener: () => {} }, onMessage: { addListener: () => {} } }),
              sendMessage:  () => {},
              onMessage: { addListener: () => {}, removeListener: () => {}, hasListeners: () => false },
              onConnect:  { addListener: () => {}, removeListener: () => {}, hasListeners: () => false },
            },
            csi: () => {},
            loadTimes: () => ({}),
          };

          // ── Permissions ───────────────────────────────────────────────────
          const origQuery = navigator.permissions.query.bind(navigator.permissions);
          (navigator.permissions as any).query = (params: any) =>
            params?.name === 'notifications'
              ? Promise.resolve({ state: w.Notification?.permission ?? 'default', onchange: null })
              : origQuery(params);

          // ── userAgentData (randomised Chrome version + Win10) ─────────────
          const cv  = String(p.chromeVersion);
          const cvf = `${p.chromeVersion}.0.${p.chromeBuild}`;
          const uaData = {
            brands: [
              { brand: 'Not(A:Brand',   version: '99' },
              { brand: 'Google Chrome', version: cv   },
              { brand: 'Chromium',      version: cv   },
            ],
            mobile: false,
            platform: 'Windows',
            getHighEntropyValues: () =>
              Promise.resolve({
                platform:        'Windows',
                platformVersion: '10.0.0',
                architecture:    'x86',
                bitness:         '64',
                model:           '',
                uaFullVersion:   cvf,
                fullVersionList: [
                  { brand: 'Not(A:Brand',   version: '99.0.0.0' },
                  { brand: 'Google Chrome', version: cvf },
                  { brand: 'Chromium',      version: cvf },
                ],
              }),
            toJSON: () => ({
              brands: [
                { brand: 'Not(A:Brand',   version: '99' },
                { brand: 'Google Chrome', version: cv   },
                { brand: 'Chromium',      version: cv   },
              ],
              mobile: false,
              platform: 'Windows',
            }),
          };
          Object.defineProperty(navigator, 'userAgentData', { get: () => uaData, configurable: true });
        },
        // Persona values are serialised and passed as the script argument
        {
          cores:         persona.cores,
          memory:        persona.memory,
          screenWidth:   persona.screenWidth,
          screenHeight:  persona.screenHeight,
          chromeVersion: persona.chromeVersion,
          chromeBuild:   persona.chromeBuild,
        },
      );

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
