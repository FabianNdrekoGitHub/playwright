import { registerAs } from '@nestjs/config';

export interface FormFillerConfig {
  formUrl: string;
  webshareProxyServer: string | null;
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
      webshareProxyServer: env.WEBSHARE_PROXY_SERVER || null,
      webshareUser: env.WEBSHARE_USERNAME || null,
      websharePass: env.WEBSHARE_PASSWORD || null,
      webshareApiKey: env.WEBSHARE_API_KEY || null,
    };
  },
);
