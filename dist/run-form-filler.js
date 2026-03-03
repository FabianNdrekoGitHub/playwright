"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const form_filler_service_1 = require("./form-filler/form-filler.service");
async function bootstrap() {
    const app = await core_1.NestFactory.createApplicationContext(app_module_1.AppModule, {
        logger: ['log', 'error'],
    });
    const formFiller = app.get(form_filler_service_1.FormFillerService);
    await formFiller.run();
    await app.close();
    process.exit(0);
}
bootstrap().catch((err) => {
    console.error(err);
    process.exit(1);
});
//# sourceMappingURL=run-form-filler.js.map