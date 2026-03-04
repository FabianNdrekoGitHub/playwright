import { registerAs } from '@nestjs/config';

export interface FormFillerConfig {
  formUrl: string;
  webshareUser: string | null;
  websharePass: string | null;
  webshareApiKey: string | null;
}

export default registerAs(
  'formFiller',
  (): FormFillerConfig => {
    const env = process.env;
    return {
      formUrl: env.FORM_URL || 'https://example.com/form',
      webshareUser: env.WEBSHARE_USERNAME || null,
      websharePass: env.WEBSHARE_PASSWORD || null,
      webshareApiKey: env.WEBSHARE_API_KEY || null,
    };
  },
);
