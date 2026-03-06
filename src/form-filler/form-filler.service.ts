import * as https from 'https';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { chromium } from 'playwright';
import * as proxyChain from 'proxy-chain';
import { ProxyAgent, fetch as undiciFetch } from 'undici';

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
  latitude:    number;
  longitude:   number;
}

interface DeviceProfile {
  name:                string;
  userAgent:           string;
  platform:            string;
  viewport:            { width: number; height: number };
  screen:              { width: number; height: number };
  isMobile:            boolean;
  hasTouch:            boolean;
  hardwareConcurrency: number;
  deviceMemory:        number;
  gpu:                 { vendor: string; renderer: string };
  engine:              'chromium';
}

// ─── Device profiles ──────────────────────────────────────────────────────────

const DEVICE_PROFILES: DeviceProfile[] = [
  {
    name:      'Windows Desktop (RTX 3060)',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    platform:  'Win32',
    viewport:  { width: 1920, height: 1080 },
    screen:    { width: 1920, height: 1080 },
    isMobile:  false,
    hasTouch:  false,
    hardwareConcurrency: 16,
    deviceMemory: 16,
    gpu: { vendor: 'NVIDIA Corporation', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)' },
    engine:    'chromium',
  },
  {
    name:      'Windows Desktop (GTX 1080)',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.6312.122 Safari/537.36',
    platform:  'Win32',
    viewport:  { width: 2560, height: 1440 },
    screen:    { width: 2560, height: 1440 },
    isMobile:  false,
    hasTouch:  false,
    hardwareConcurrency: 12,
    deviceMemory: 16,
    gpu: { vendor: 'NVIDIA Corporation', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1080 Direct3D11 vs_5_0 ps_5_0, D3D11)' },
    engine:    'chromium',
  },
  {
    name:      'Windows Laptop (Intel Iris)',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    platform:  'Win32',
    viewport:  { width: 1366, height: 768 },
    screen:    { width: 1366, height: 768 },
    isMobile:  false,
    hasTouch:  false,
    hardwareConcurrency: 8,
    deviceMemory: 8,
    gpu: { vendor: 'Intel Inc.', renderer: 'ANGLE (Intel, Intel(R) Iris(R) Xe Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)' },
    engine:    'chromium',
  },
  {
    name:      'Windows Laptop (AMD Radeon)',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    platform:  'Win32',
    viewport:  { width: 1600, height: 900 },
    screen:    { width: 1600, height: 900 },
    isMobile:  false,
    hasTouch:  false,
    hardwareConcurrency: 8,
    deviceMemory: 8,
    gpu: { vendor: 'AMD', renderer: 'ANGLE (AMD, AMD Radeon RX 580 Series Direct3D11 vs_5_0 ps_5_0, D3D11)' },
    engine:    'chromium',
  },
];

// ─── Proxy pool (fallback) ────────────────────────────────────────────────────

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
 * Geo lookup via the local proxy-chain tunnel.
 * The tunnel requires no auth (proxy-chain handles upstream credentials),
 * so we just point undici at it and make a plain HTTPS request.
 */
async function getProxyGeoInfo(localProxyUrl: string): Promise<GeoInfo | null> {
  const dispatcher = new ProxyAgent({ uri: localProxyUrl });
  
  // Try primary provider (ip-api.com)
  try {
    const res = await undiciFetch(
      'http://ip-api.com/json/?fields=status,timezone,countryCode,city,lat,lon',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { dispatcher } as any,
    );
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json: any = await res.json();
    console.log('Proxy geo response (ip-api):', json);

    if (json.status === 'success' && json.timezone && json.countryCode) {
      return {
        timezone:    json.timezone,
        city:        json.city,
        countryCode: json.countryCode,
        locale:      COUNTRY_LOCALE[json.countryCode] || 'en-US',
        latitude:    json.lat,
        longitude:   json.lon,
      };
    }
  } catch (err) {
    console.warn('Primary geo lookup failed:', err.message);
  }

  // Fallback provider (ipwho.is)
  try {
    console.log('Trying fallback geo provider (ipwho.is)...');
    const res = await undiciFetch(
      'https://ipwho.is/',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { dispatcher } as any,
    );
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json: any = await res.json();
    console.log('Proxy geo response (ipwho.is):', json);

    if (json.success && json.timezone && json.country_code) {
      return {
        timezone:    json.timezone.id,
        city:        json.city,
        countryCode: json.country_code,
        locale:      COUNTRY_LOCALE[json.country_code] || 'en-US',
        latitude:    json.latitude,
        longitude:   json.longitude,
      };
    }
  } catch (err) {
    console.warn('Fallback geo lookup failed:', err.message);
  }

  return null;
}

// ─── Webshare API ─────────────────────────────────────────────────────────────

function fetchWebshareProxies(apiKey: string): Promise<ProxyEntry[]> {
  return new Promise((resolve) => {
    const options = {
      hostname: 'proxy.webshare.io',
      path:     '/api/v2/proxy/list/?mode=direct&page=1&page_size=100',
      headers:  { Authorization: `Token ${apiKey}` },
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
    const wsUser        = this.config.get<string>('formFiller.webshareUser')!;
    const wsPass        = this.config.get<string>('formFiller.websharePass')!;
    const wsApiKey      = this.config.get<string>('formFiller.webshareApiKey');

    if (!wsUser || !wsPass) {
      console.error('Error: WEBSHARE_USERNAME and WEBSHARE_PASSWORD must be set in .env');
      return;
    }

      // ─── Device profile ──────────────────────────────────────────────────────
      const device = pickRandom(DEVICE_PROFILES);
      console.log(`Device profile : ${device.name} (${device.engine})`);

      // ─── Proxy server ────────────────────────────────────────────────────────
      let proxyServer: string;
      if (wsProxyServer) {
        proxyServer = wsProxyServer;
      } else {
        const proxyList = wsApiKey ? await fetchWebshareProxies(wsApiKey) : FALLBACK_PROXIES;
        const proxy     = pickRandom(proxyList);
        proxyServer     = `http://${proxy.host}:${proxy.port}`;
      }

      // ── Build local anonymous tunnel first ─────────────────────────────────
      const upstreamUrl = proxyServer.replace('http://', `http://${wsUser}:${wsPass}@`);
      const localProxy  = await proxyChain.anonymizeProxy(upstreamUrl);

      // ── Geo lookup through the tunnel (no auth needed) ──────────────────────
      console.log('Detecting proxy location...');
      const geo = await getProxyGeoInfo(localProxy);
      
      // Fallback if geo lookup fails to avoid "Timezone spoofed" (mismatch between system and IP)
      // We default to a common timezone if we can't detect it, but this might still flag.
      // Better to warn.
      if (!geo) {
        console.warn('⚠️ Geo lookup failed! Timezone/Locale will default to system, which may trigger "Timezone spoofed".');
      }

      console.log('─────────────────────────────────────────');
      console.log(`Target URL     : ${formUrl}`);
      console.log(`Proxy          : ${proxyServer}`);
      console.log(`Local tunnel   : ${localProxy}`);
      if (geo) {
        console.log(`Location       : ${geo.city}, ${geo.countryCode}`);
        console.log(`Timezone       : ${geo.timezone}`);
        console.log(`Locale         : ${geo.locale}`);
        console.log(`Geolocation    : ${geo.latitude}, ${geo.longitude}`);
      }
      console.log(`Screen         : ${device.screen.width}x${device.screen.height}`);
      console.log('─────────────────────────────────────────');

      try {
        const commonArgs = [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--ignore-certificate-errors',
        ];
  
        const chromiumArgs = [
          '--disable-blink-features=AutomationControlled',
          '--disable-infobars',
          '--ignore-certificate-errors-spki-list',
          '--disable-features=IsolateOrigins,site-per-process',
          '--force-webrtc-ip-handling-policy=default_public_interface_only',
          `--window-size=${device.screen.width},${device.screen.height}`,
        ];
  
        const launchArgs = [...commonArgs, ...chromiumArgs];
  
        const browser = await chromium.launch({
          headless: false,
          proxy:    { server: localProxy },
          args:     launchArgs,
        });
  
        const context = await browser.newContext({
          viewport:          device.viewport,
          userAgent:         device.userAgent,
          isMobile:          device.isMobile,
          hasTouch:          device.hasTouch,
          ignoreHTTPSErrors: true,
          // CRITICAL: Set timezone and locale to match the proxy IP
          ...(geo ? {
            locale:      geo.locale,
            timezoneId:  geo.timezone,
            // REMOVED: Geolocation spoofing.
            // Providing exact lat/lon from IP-API (city center) often flags as "Timezone spoofed"
            // or "Location spoofed" because it's too precise or doesn't match the IP's fuzzy range.
            // By removing this, we force the site to rely on IP-based location, which matches our timezone.
          } : {}),
        });
  
        // REMOVED: Manual addInitScript for hardware/WebGL spoofing.
        // The manual overrides (especially WebGL) were causing "Masking detected".
        // We rely on the device profile matching the engine (Chromium vs WebKit)
        // and the stealth plugin to handle the rest.
        // If specific hardware spoofing is needed, it must be done with deep native hooks,
        // but often "less is more" for avoiding masking detection.

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
    } finally {
      await proxyChain.closeAnonymizedProxy(localProxy, true);
    }
  }
}
