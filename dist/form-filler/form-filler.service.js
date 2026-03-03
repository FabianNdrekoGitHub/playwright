"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FormFillerService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const playwright_extra_1 = require("playwright-extra");
const puppeteer_extra_plugin_stealth_1 = __importDefault(require("puppeteer-extra-plugin-stealth"));
playwright_extra_1.chromium.use((0, puppeteer_extra_plugin_stealth_1.default)());
let FormFillerService = class FormFillerService {
    constructor(config) {
        this.config = config;
    }
    async run() {
        const formUrl = this.config.get('formFiller.formUrl');
        const brdUser = this.config.get('formFiller.brightDataUser');
        const brdPass = this.config.get('formFiller.brightDataPass');
        if (!brdUser || !brdPass) {
            console.error('Error: BRIGHT_DATA_USERNAME and BRIGHT_DATA_PASSWORD must be set in .env');
            return;
        }
        const brdHost = 'brd.superproxy.io:22225';
        const countries = ['de', 'ch', 'gr'];
        const randomCountry = countries[Math.floor(Math.random() * countries.length)];
        const proxyUser = `${brdUser}-country-${randomCountry}`;
        const proxyServer = `http://${brdHost}`;
        console.log(`Starting browser in ${randomCountry.toUpperCase()}...`);
        console.log(`Target URL: ${formUrl}`);
        console.log(`Proxy User: ${proxyUser}`);
        try {
            const browser = await playwright_extra_1.chromium.launch({
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
                viewport: null,
                ignoreHTTPSErrors: true,
                locale: randomCountry === 'gr' ? 'el-GR' : randomCountry === 'de' ? 'de-DE' : 'de-CH',
                timezoneId: randomCountry === 'gr' ? 'Europe/Athens' : randomCountry === 'de' ? 'Europe/Berlin' : 'Europe/Zurich',
            });
            const page = await context.newPage();
            console.log('Navigating to form...');
            await page.goto(formUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
            console.log('Browser is open. You can now interact manually.');
            console.log('Press Ctrl+C in the terminal to close the script and browser.');
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