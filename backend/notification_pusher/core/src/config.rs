use crate::apns::{ApnsClient, ApnsConfig};
use crate::ic_agent::IcAgent;
use candid::Principal;
use envconfig::Envconfig;
use fcm_service::FcmService;
use index_store::IndexStore;
use std::sync::Arc;
use tracing::{error, info};
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

        let apns_client = apns_client(
            env_config.apns_key_path,
            env_config.apns_key_id,
            env_config.apns_team_id,
            env_config.apns_topic,
        );

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

// Without a usable APNs key the pusher skips iOS devices. A bad key is logged rather than
// stopping the pusher, as that would stop Android and web pushes too.
fn apns_client(key_path: Option<String>, key_id: Option<String>, team_id: String, topic: String) -> Option<Arc<ApnsClient>> {
    let (Some(key_path), Some(key_id)) = (key_path, key_id) else {
        info!("No APNs key, so no pushes to iOS devices");
        return None;
    };
    let client = std::fs::read_to_string(&key_path).map_err(Error::from).and_then(|key_pem| {
        ApnsClient::new(ApnsConfig {
            key_pem,
            key_id,
            team_id,
            topic,
        })
    });
    match client {
        Ok(client) => Some(Arc::new(client)),
        Err(error) => {
            error!("Bad APNs key at {key_path}, so no pushes to iOS devices: {error}");
            None
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use p256::ecdsa::SigningKey;
    use p256::pkcs8::{EncodePrivateKey, LineEnding};

    fn client_from_key_file(contents: Option<&str>) -> Option<Arc<ApnsClient>> {
        let path = std::env::temp_dir().join(format!(
            "apns-key-test-{}-{}.p8",
            std::process::id(),
            contents.map_or(0, str::len)
        ));
        if let Some(contents) = contents {
            std::fs::write(&path, contents).unwrap();
        }
        let client = apns_client(
            Some(path.to_string_lossy().into_owned()),
            Some("KEYID".to_string()),
            "TEAM".to_string(),
            "com.oclabs.openchat".to_string(),
        );
        let _ = std::fs::remove_file(&path);
        client
    }

    // A bad APNs setting only costs iOS pushes. The pusher still starts, so Android and web
    // pushes carry on.
    #[test]
    fn a_bad_apns_key_leaves_the_pusher_running_without_ios_pushes() {
        let valid = SigningKey::from_slice(&[7; 32])
            .unwrap()
            .to_pkcs8_pem(LineEnding::LF)
            .unwrap();

        assert!(client_from_key_file(Some(&valid)).is_some());
        assert!(client_from_key_file(Some("not a key")).is_none());
        assert!(client_from_key_file(None).is_none());
    }
}
