"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("@nestjs/config");
exports.default = (0, config_1.registerAs)('formFiller', () => {
    const env = process.env;
    return {
        formUrl: env.FORM_URL || 'https://example.com/form',
        brightDataUser: env.BRIGHT_DATA_USERNAME || null,
        brightDataPass: env.BRIGHT_DATA_PASSWORD || null,
    };
});
//# sourceMappingURL=form-filler.config.js.map