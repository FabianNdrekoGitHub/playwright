import { registerAs } from '@nestjs/config';

export interface FormFillerConfig {
  formUrl: string;
  brightDataUser: string | null;
  brightDataPass: string | null;
}

export default registerAs(
  'formFiller',
  (): FormFillerConfig => {
    const env = process.env;
    return {
      formUrl: env.FORM_URL || 'https://example.com/form',
      brightDataUser: env.BRIGHT_DATA_USERNAME || null,
      brightDataPass: env.BRIGHT_DATA_PASSWORD || null,
    };
  },
);
