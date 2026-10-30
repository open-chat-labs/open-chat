use envconfig::Envconfig;

#[derive(Envconfig)]
pub struct Config {
    #[envconfig(from = "IC_URL", default = "http://127.0.0.1:8080")]
    pub ic_url: String,

    // The service's identity on the IC, whose principal a platform operator sets through the UserIndex's
    // `set_mini_app_service_principal`, so the LocalUserIndexes take its card writes
    #[envconfig(from = "IC_IDENTITY_PEM")]
    pub ic_identity_pem: String,

    // OpenChat's public key, which the tokens the service takes are signed with, is fetched from here
    #[envconfig(from = "USER_INDEX_CANISTER_ID")]
    pub user_index_canister_id: String,

    // The key the service signs its own tokens with: a P-256 key in PKCS#8 PEM
    #[envconfig(from = "MINI_APP_SERVICE_KEY_PEM")]
    pub key_pem: String,

    // Without one, games are kept in memory, so they end when the service does
    #[envconfig(from = "REDIS_URL")]
    pub redis_url: Option<String>,

    #[envconfig(from = "PORT", default = "8095")]
    pub port: u16,

    #[envconfig(from = "IS_PRODUCTION", default = "false")]
    pub is_production: bool,
}
