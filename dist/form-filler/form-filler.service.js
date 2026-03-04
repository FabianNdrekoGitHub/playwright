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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FormFillerService = void 0;
const https = __importStar(require("https"));
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const playwright_extra_1 = require("playwright-extra");
const puppeteer_extra_plugin_stealth_1 = __importDefault(require("puppeteer-extra-plugin-stealth"));
playwright_extra_1.chromium.use((0, puppeteer_extra_plugin_stealth_1.default)());
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
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36';
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
function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}
let FormFillerService = class FormFillerService {
    constructor(config) {
        this.config = config;
    }
    async run() {
        const formUrl = this.config.get('formFiller.formUrl');
        const wsUser = this.config.get('formFiller.webshareUser');
        const wsPass = this.config.get('formFiller.websharePass');
        const wsApiKey = this.config.get('formFiller.webshareApiKey');
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
            const browser = await playwright_extra_1.chromium.launch({
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
                    '--use-gl=swiftshader',
                    '--disable-features=IsolateOrigins,site-per-process',
                ],
            });
            const context = await browser.newContext({
                viewport: { width: 1920, height: 1080 },
                ignoreHTTPSErrors: true,
                locale: 'en-US',
                timezoneId: 'America/Chicago',
                userAgent: USER_AGENT,
            });
            await context.addInitScript(() => {
                Object.defineProperty(navigator, 'webdriver', { get: () => false });
                const uaData = {
                    brands: [
                        { brand: 'Not(A:Brand', version: '99' },
                        { brand: 'Google Chrome', version: '145' },
                        { brand: 'Chromium', version: '145' },
                    ],
                    mobile: false,
                    platform: 'Windows',
                    getHighEntropyValues: () => Promise.resolve({
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
                const w = window;
                delete w.__playwright;
                delete w.__pw_manual;
                delete w.__pw_hooks;
                delete w.__PW_inspect_custom_element__;
            });
            const page = await context.newPage();
            console.log('Navigating to URL...');
            await page.goto(formUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
            console.log('Browser is open. Interact manually or press Ctrl+C to stop.');
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