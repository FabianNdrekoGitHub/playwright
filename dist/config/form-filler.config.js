"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("@nestjs/config");
exports.default = (0, config_1.registerAs)('formFiller', () => {
    const env = process.env;
    return {
        formUrl: env.FORM_URL || 'https://example.com/form',
        webshareUser: env.WEBSHARE_USERNAME || null,
        websharePass: env.WEBSHARE_PASSWORD || null,
        webshareApiKey: env.WEBSHARE_API_KEY || null,
    };
});
//# sourceMappingURL=form-filler.config.js.map