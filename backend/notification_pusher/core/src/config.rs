use crate::apns::{ApnsClient, ApnsConfig};
use crate::ic_agent::IcAgent;
use candid::Principal;
use envconfig::Envconfig;
use fcm_service::FcmService;
use index_store::IndexStore;
use std::sync::Arc;
use tracing::info;
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

    // The App Store Connect `.p8` key for APNs. Without it the pusher skips iOS devices.
    #[envconfig(from = "APNS_KEY_PATH")]
    pub apns_key_path: Option<String>,

    #[envconfig(from = "APNS_KEY_ID")]
    pub apns_key_id: Option<String>,

    #[envconfig(from = "APNS_TEAM_ID", default = "N59KSS69AU")]
    pub apns_team_id: String,

    #[envconfig(from = "APNS_TOPIC", default = "com.oclabs.openchat")]
    pub apns_topic: String,
}

pub struct Config<I> {
    pub ic_agent: IcAgent,
    pub vapid_private_pem: String,
    pub index_canister_id: Principal,
    pub is_production: bool,
    pub pusher_count: u32,
    pub index_store: I,
    pub fcm_service: Arc<FcmService>,
    pub apns_client: Option<Arc<ApnsClient>>,
}

impl<I: IndexStore + 'static> Config<I> {
    pub async fn init_with_store(index_store: I) -> Result<Self, Error> {
        // Load environment variables from .env file
        dotenv::dotenv()?;

        // Load environment configuration
        let env_config = EnvConfig::init_from_env().map_err(|e| format!("Failed to load environment config: {e}"))?;

        let apns_client = match (env_config.apns_key_path, env_config.apns_key_id) {
            (Some(key_path), Some(key_id)) => Some(Arc::new(ApnsClient::new(ApnsConfig {
                key_pem: std::fs::read_to_string(key_path)?,
                key_id,
                team_id: env_config.apns_team_id,
                topic: env_config.apns_topic,
            })?)),
            _ => {
                info!("No APNs key, so no pushes to iOS devices");
                None
            }
        };

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
            apns_client,
        })
    }
}
