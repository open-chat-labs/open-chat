use crate::ic_agent::IcAgent;
use candid::Principal;
use candid::types::principal::PrincipalError;
use envconfig::Envconfig;
use fcm_service::FcmService;
use index_store::IndexStore;
use std::sync::Arc;
use types::Error;

#[derive(Envconfig, Clone)]
pub struct EnvConfig {
    #[envconfig(from = "VAPID_PRIVATE_PEM")]
    pub vapid_private_pem: String,

    #[envconfig(from = "NOTIFICATIONS_INDEX_CANISTER_ID")]
    pub index_canister_id: String,

    // One of the following two fields must be set
    #[envconfig(from = "NOTIFICATIONS_CANISTER_IDS")]
    pub notifications_canister_ids: Option<String>,
    #[envconfig(from = "NOTIFICATIONS_CANISTER_ID")]
    pub notifications_canister_id: Option<String>,

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

impl EnvConfig {
    pub fn get_notifications_canister_ids(&self) -> Result<Vec<Principal>, Error> {
        // One of the following two fields must be set, or an error is returned.
        match (&self.notifications_canister_ids, &self.notifications_canister_id) {
            (Some(ids), _) => Ok(ids
                .split(';')
                .map(Principal::from_text)
                .collect::<Result<Vec<Principal>, PrincipalError>>()?),
            (None, Some(id)) => Ok(vec![Principal::from_text(id)?]),
            _ => Err("Neither NOTIFICATIONS_CANISTER_IDS nor NOTIFICATIONS_CANISTER_ID is set".into()),
        }
    }
}

pub struct Config<I> {
    pub ic_agent: IcAgent,
    pub vapid_private_pem: String,
    pub index_canister_id: Principal,
    pub notifications_canister_ids: Vec<Principal>,
    pub is_production: bool,
    pub pusher_count: u32,
    pub index_store: I,
    pub fcm_service: Arc<FcmService>,
}

impl<I: IndexStore + 'static> Config<I> {
    pub async fn init_with_store<F>(index_store_init_fn: F) -> Result<Self, Error>
    where
        F: FnOnce(EnvConfig) -> Result<I, Error>,
    {
        // Load environment configuration
        let env_config = EnvConfig::init_from_env().map_err(|e| format!("Failed to load environment config: {}", e))?;

        // Initialize the IC agent and index store
        let ic_agent = IcAgent::build(&env_config.ic_url, &env_config.ic_identity_pem, !env_config.is_production).await?;
        let index_store = index_store_init_fn(env_config.clone())?;

        Ok(Self {
            ic_agent,
            index_store,
            notifications_canister_ids: env_config.get_notifications_canister_ids()?,
            vapid_private_pem: env_config.vapid_private_pem,
            index_canister_id: Principal::from_text(env_config.index_canister_id)?,
            is_production: env_config.is_production,
            pusher_count: env_config.pusher_count,
            fcm_service: Arc::new(FcmService::new(env_config.gcloud_sa_json_path)),
        })
    }
}
