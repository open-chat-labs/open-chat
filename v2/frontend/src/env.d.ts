/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_INTERNET_IDENTITY_URL: string;
    readonly VITE_USERGEEK_APIKEY: string;
    // more env variables...
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
