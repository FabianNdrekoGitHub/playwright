export interface FormFillerConfig {
    formUrl: string;
    webshareProxyServer: string | null;
    webshareUser: string | null;
    websharePass: string | null;
    webshareApiKey: string | null;
}
declare const _default: (() => FormFillerConfig) & import("@nestjs/config").ConfigFactoryKeyHost<FormFillerConfig>;
export default _default;
