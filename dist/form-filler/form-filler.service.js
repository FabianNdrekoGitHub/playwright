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
const RESOLUTIONS = [
    { w: 1366, h: 768 },
    { w: 1920, h: 1080 },
    { w: 1440, h: 900 },
    { w: 1280, h: 800 },
    { w: 1600, h: 900 },
    { w: 2560, h: 1440 },
    { w: 1280, h: 1024 },
];
const CHROME_VERSIONS = [
    120, 121, 122, 123, 124, 125, 126, 127, 128,
    129, 130, 131, 132, 133, 134, 135, 136, 137,
    138, 139, 140, 141, 142, 143, 144, 145,
];
const US_TIMEZONES = [
    { id: 'America/New_York', locale: 'en-US' },
    { id: 'America/Chicago', locale: 'en-US' },
    { id: 'America/Denver', locale: 'en-US' },
    { id: 'America/Los_Angeles', locale: 'en-US' },
    { id: 'America/Phoenix', locale: 'en-US' },
];
function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}
function rand(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
function generatePersona() {
    const res = pickRandom(RESOLUTIONS);
    const chromeV = pickRandom(CHROME_VERSIONS);
    const tz = pickRandom(US_TIMEZONES);
    const build = `${rand(1000, 9999)}.${rand(10, 99)}`;
    return {
        screenWidth: res.w,
        screenHeight: res.h,
        chromeVersion: chromeV,
        chromeBuild: build,
        cores: pickRandom([2, 4, 8, 16]),
        memory: pickRandom([2, 4, 8]),
        timezoneId: tz.id,
        locale: tz.locale,
        userAgent: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeV}.0.0.0 Safari/537.36`,
    };
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
        let proxyServer;
        if (wsProxyServer) {
            proxyServer = wsProxyServer;
        }
        else {
            const proxyList = wsApiKey ? await fetchWebshareProxies(wsApiKey) : FALLBACK_PROXIES;
            const proxy = pickRandom(proxyList);
            proxyServer = `http://${proxy.host}:${proxy.port}`;
        }
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
            const browser = await playwright_1.chromium.launch({
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
                viewport: { width: persona.screenWidth, height: persona.screenHeight },
                ignoreHTTPSErrors: true,
                locale: persona.locale,
                timezoneId: persona.timezoneId,
                userAgent: persona.userAgent,
            });
            await context.addInitScript((p) => {
                const w = window;
                Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
                Object.defineProperty(navigator, 'platform', { get: () => 'Win32' });
                Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
                Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => p.cores });
                Object.defineProperty(navigator, 'deviceMemory', { get: () => p.memory });
                Object.defineProperty(screen, 'width', { get: () => p.screenWidth });
                Object.defineProperty(screen, 'height', { get: () => p.screenHeight });
                Object.defineProperty(screen, 'availWidth', { get: () => p.screenWidth });
                Object.defineProperty(screen, 'availHeight', { get: () => p.screenHeight - 40 });
                Object.defineProperty(screen, 'colorDepth', { get: () => 24 });
                Object.defineProperty(screen, 'pixelDepth', { get: () => 24 });
                w.chrome = {
                    app: {
                        isInstalled: false,
                        InstallState: { DISABLED: 'disabled', INSTALLED: 'installed', NOT_INSTALLED: 'not_installed' },
                        RunningState: { CANNOT_RUN: 'cannot_run', READY_TO_RUN: 'ready_to_run', RUNNING: 'running' },
                    },
                    runtime: {
                        PlatformOs: { MAC: 'mac', WIN: 'win', ANDROID: 'android', CROS: 'cros', LINUX: 'linux', OPENBSD: 'openbsd' },
                        PlatformArch: { ARM: 'arm', ARM64: 'arm64', X86_32: 'x86-32', X86_64: 'x86-64', MIPS: 'mips', MIPS64: 'mips64' },
                        connect: () => ({ postMessage: () => { }, disconnect: () => { }, onDisconnect: { addListener: () => { } }, onMessage: { addListener: () => { } } }),
                        sendMessage: () => { },
                        onMessage: { addListener: () => { }, removeListener: () => { }, hasListeners: () => false },
                        onConnect: { addListener: () => { }, removeListener: () => { }, hasListeners: () => false },
                    },
                    csi: () => { },
                    loadTimes: () => ({}),
                };
                const origQuery = navigator.permissions.query.bind(navigator.permissions);
                navigator.permissions.query = (params) => params?.name === 'notifications'
                    ? Promise.resolve({ state: w.Notification?.permission ?? 'default', onchange: null })
                    : origQuery(params);
                const cv = String(p.chromeVersion);
                const cvf = `${p.chromeVersion}.0.${p.chromeBuild}`;
                const uaData = {
                    brands: [
                        { brand: 'Not(A:Brand', version: '99' },
                        { brand: 'Google Chrome', version: cv },
                        { brand: 'Chromium', version: cv },
                    ],
                    mobile: false,
                    platform: 'Windows',
                    getHighEntropyValues: () => Promise.resolve({
                        platform: 'Windows',
                        platformVersion: '10.0.0',
                        architecture: 'x86',
                        bitness: '64',
                        model: '',
                        uaFullVersion: cvf,
                        fullVersionList: [
                            { brand: 'Not(A:Brand', version: '99.0.0.0' },
                            { brand: 'Google Chrome', version: cvf },
                            { brand: 'Chromium', version: cvf },
                        ],
                    }),
                    toJSON: () => ({
                        brands: [
                            { brand: 'Not(A:Brand', version: '99' },
                            { brand: 'Google Chrome', version: cv },
                            { brand: 'Chromium', version: cv },
                        ],
                        mobile: false,
                        platform: 'Windows',
                    }),
                };
                Object.defineProperty(navigator, 'userAgentData', { get: () => uaData, configurable: true });
            }, {
                cores: persona.cores,
                memory: persona.memory,
                screenWidth: persona.screenWidth,
                screenHeight: persona.screenHeight,
                chromeVersion: persona.chromeVersion,
                chromeBuild: persona.chromeBuild,
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
    }
};
exports.FormFillerService = FormFillerService;
exports.FormFillerService = FormFillerService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], FormFillerService);
//# sourceMappingURL=form-filler.service.js.map