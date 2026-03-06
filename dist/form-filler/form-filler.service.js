"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FormFillerService = void 0;
const https = __importStar(require("https"));
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const playwright_1 = require("playwright");
const proxyChain = __importStar(require("proxy-chain"));
const undici_1 = require("undici");
const DEVICE_PROFILES = [
    {
        name: 'Windows Desktop (RTX 3060)',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        platform: 'Win32',
        viewport: { width: 1920, height: 1080 },
        screen: { width: 1920, height: 1080 },
        isMobile: false,
        hasTouch: false,
        hardwareConcurrency: 16,
        deviceMemory: 16,
        gpu: { vendor: 'NVIDIA Corporation', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)' },
        engine: 'chromium',
    },
    {
        name: 'Windows Desktop (GTX 1080)',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.6312.122 Safari/537.36',
        platform: 'Win32',
        viewport: { width: 2560, height: 1440 },
        screen: { width: 2560, height: 1440 },
        isMobile: false,
        hasTouch: false,
        hardwareConcurrency: 12,
        deviceMemory: 16,
        gpu: { vendor: 'NVIDIA Corporation', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1080 Direct3D11 vs_5_0 ps_5_0, D3D11)' },
        engine: 'chromium',
    },
    {
        name: 'Windows Laptop (Intel Iris)',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        platform: 'Win32',
        viewport: { width: 1366, height: 768 },
        screen: { width: 1366, height: 768 },
        isMobile: false,
        hasTouch: false,
        hardwareConcurrency: 8,
        deviceMemory: 8,
        gpu: { vendor: 'Intel Inc.', renderer: 'ANGLE (Intel, Intel(R) Iris(R) Xe Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)' },
        engine: 'chromium',
    },
    {
        name: 'Windows Laptop (AMD Radeon)',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        platform: 'Win32',
        viewport: { width: 1600, height: 900 },
        screen: { width: 1600, height: 900 },
        isMobile: false,
        hasTouch: false,
        hardwareConcurrency: 8,
        deviceMemory: 8,
        gpu: { vendor: 'AMD', renderer: 'ANGLE (AMD, AMD Radeon RX 580 Series Direct3D11 vs_5_0 ps_5_0, D3D11)' },
        engine: 'chromium',
    },
];
const FALLBACK_PROXIES = [
    { host: '31.59.20.176', port: 6754 },
    { host: '23.95.150.145', port: 6114 },
    { host: '198.23.239.134', port: 6540 },
    { host: '45.38.107.97', port: 6014 },
    { host: '107.172.163.27', port: 6543 },
    { host: '198.105.121.200', port: 6462 },
    { host: '64.137.96.74', port: 6641 },
    { host: '216.10.27.159', port: 6837 },
    { host: '142.111.67.146', port: 5611 },
    { host: '194.39.32.164', port: 6461 },
];
const COUNTRY_LOCALE = {
    US: 'en-US', GB: 'en-GB', AU: 'en-AU', CA: 'en-CA',
    CH: 'de-CH', DE: 'de-DE', AT: 'de-AT',
    FR: 'fr-FR', BE: 'fr-BE',
    IT: 'it-IT', ES: 'es-ES', NL: 'nl-NL',
    PL: 'pl-PL', CZ: 'cs-CZ', RO: 'ro-RO',
};
function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}
async function getProxyGeoInfo(localProxyUrl) {
    const dispatcher = new undici_1.ProxyAgent({ uri: localProxyUrl });
    try {
        const res = await (0, undici_1.fetch)('http://ip-api.com/json/?fields=status,timezone,countryCode,city,lat,lon', { dispatcher });
        const json = await res.json();
        console.log('Proxy geo response (ip-api):', json);
        if (json.status === 'success' && json.timezone && json.countryCode) {
            return {
                timezone: json.timezone,
                city: json.city,
                countryCode: json.countryCode,
                locale: COUNTRY_LOCALE[json.countryCode] || 'en-US',
                latitude: json.lat,
                longitude: json.lon,
            };
        }
    }
    catch (err) {
        console.warn('Primary geo lookup failed:', err.message);
    }
    try {
        console.log('Trying fallback geo provider (ipwho.is)...');
        const res = await (0, undici_1.fetch)('https://ipwho.is/', { dispatcher });
        const json = await res.json();
        console.log('Proxy geo response (ipwho.is):', json);
        if (json.success && json.timezone && json.country_code) {
            return {
                timezone: json.timezone.id,
                city: json.city,
                countryCode: json.country_code,
                locale: COUNTRY_LOCALE[json.country_code] || 'en-US',
                latitude: json.latitude,
                longitude: json.longitude,
            };
        }
    }
    catch (err) {
        console.warn('Fallback geo lookup failed:', err.message);
    }
    return null;
}
function fetchWebshareProxies(apiKey) {
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
                    const proxies = (json.results || []).map((p) => ({
                        host: p.proxy_address,
                        port: p.port,
                    }));
                    resolve(proxies.length ? proxies : FALLBACK_PROXIES);
                }
                catch {
                    resolve(FALLBACK_PROXIES);
                }
            });
        }).on('error', () => resolve(FALLBACK_PROXIES));
    });
}
let FormFillerService = class FormFillerService {
    constructor(config) {
        this.config = config;
    }
    async run() {
        const formUrl = this.config.get('formFiller.formUrl');
        const wsProxyServer = this.config.get('formFiller.webshareProxyServer');
        const wsUser = this.config.get('formFiller.webshareUser');
        const wsPass = this.config.get('formFiller.websharePass');
        const wsApiKey = this.config.get('formFiller.webshareApiKey');
        if (!wsUser || !wsPass) {
            console.error('Error: WEBSHARE_USERNAME and WEBSHARE_PASSWORD must be set in .env');
            return;
        }
        const device = pickRandom(DEVICE_PROFILES);
        console.log(`Device profile : ${device.name} (${device.engine})`);
        let proxyServer;
        if (wsProxyServer) {
            proxyServer = wsProxyServer;
        }
        else {
            const proxyList = wsApiKey ? await fetchWebshareProxies(wsApiKey) : FALLBACK_PROXIES;
            const proxy = pickRandom(proxyList);
            proxyServer = `http://${proxy.host}:${proxy.port}`;
        }
        const upstreamUrl = proxyServer.replace('http://', `http://${wsUser}:${wsPass}@`);
        const localProxy = await proxyChain.anonymizeProxy(upstreamUrl);
        console.log('Detecting proxy location...');
        const geo = await getProxyGeoInfo(localProxy);
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
            const browser = await playwright_1.chromium.launch({
                headless: false,
                proxy: { server: localProxy },
                args: launchArgs,
            });
            const context = await browser.newContext({
                viewport: device.viewport,
                userAgent: device.userAgent,
                isMobile: device.isMobile,
                hasTouch: device.hasTouch,
                ignoreHTTPSErrors: true,
                ...(geo ? {
                    locale: geo.locale,
                    timezoneId: geo.timezone,
                } : {}),
            });
            const page = await context.newPage();
            console.log('Navigating to URL...');
            await page.goto(formUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
            console.log('Browser is open. Fill the form manually, then close the window.');
            await new Promise((resolve) => {
                browser.on('disconnected', () => {
                    console.log('Browser closed. Exiting...');
                    resolve();
                });
            });
        }
        catch (error) {
            console.error('Error launching browser:', error);
        }
        finally {
            await proxyChain.closeAnonymizedProxy(localProxy, true);
        }
    }
};
exports.FormFillerService = FormFillerService;
exports.FormFillerService = FormFillerService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], FormFillerService);
//# sourceMappingURL=form-filler.service.js.map