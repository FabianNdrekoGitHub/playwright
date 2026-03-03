import { ConfigService } from '@nestjs/config';
export declare class FormFillerService {
    private config;
    constructor(config: ConfigService);
    run(): Promise<void>;
}
