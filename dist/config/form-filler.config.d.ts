export interface FormFillerConfig {
    formUrl: string;
    brightDataUser: string | null;
    brightDataPass: string | null;
}
declare const _default: (() => FormFillerConfig) & import("@nestjs/config").ConfigFactoryKeyHost<FormFillerConfig>;
export default _default;
