use crate::ic_agent::IcAgent;
use candid::Principal;
use envconfig::Envconfig;
use fcm_service::FcmService;
use index_store::IndexStore;
use std::sync::Arc;
use types::Error;

#[derive(Envconfig, Clone, Debug)]
pub struct EnvConfig {
    #[envconfig(from = "VAPID_PRIVATE_PEM")]
    pub vapid_private_pem: String,

    #[envconfig(from = "NOTIFICATIONS_INDEX_CANISTER_ID")]
    pub index_canister_id: String,

    #[envconfig(from = "IC_URL")]
    pub ic_url: String,

    #[envconfig(from = "IC_IDENTITY_PEM")]
    pub ic_identity_pem: String,

    #[envconfig(from = "IS_PRODUCTION")]
    pub is_production: bool,

    #[envconfig(from = "PUSHER_COUNT", default = "10")]
    pub pusher_count: u32,

    #[envconfig(from = "GCLOUD_SA_JSON_PATH")]
    pub gcloud_sa_json_path: String,
}

pub struct Config<I> {
    pub ic_agent: IcAgent,
    pub vapid_private_pem: String,
    pub index_canister_id: Principal,
    pub is_production: bool,
    pub pusher_count: u32,
    pub index_store: I,
    pub fcm_service: Arc<FcmService>,
}

impl<I: IndexStore + 'static> Config<I> {
    pub async fn init_with_store(index_store: I) -> Result<Self, Error> {
        // Load environment variables from .env file
        dotenv::dotenv()?;

        // Load environment configuration
        let env_config = EnvConfig::init_from_env().map_err(|e| format!("Failed to load environment config: {}", e))?;

        // Initialize the IC agent and index store
        let ic_agent = IcAgent::build(&env_config.ic_url, &env_config.ic_identity_pem, !env_config.is_production).await?;

        Ok(Self {
            ic_agent,
            index_store,
            vapid_private_pem: env_config.vapid_private_pem,
            index_canister_id: Principal::from_text(env_config.index_canister_id)?,
            is_production: env_config.is_production,
            pusher_count: env_config.pusher_count,
            fcm_service: Arc::new(FcmService::new(env_config.gcloud_sa_json_path)),
        })
    }
}
