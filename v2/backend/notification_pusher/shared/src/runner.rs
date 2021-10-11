use crate::actions::{prune_notifications, push_notifications};
use crate::error::Error;
use crate::ic_agent::IcAgentConfig;
use crate::store::Store;
use candid::Principal;
use tokio::time;
use tracing::{error, info};

pub async fn run(
    ic_agent_config: IcAgentConfig,
    canister_id: Principal,
    store: &mut Box<dyn Store + Send + Sync>,
    vapid_private_pem: &str,
) -> Result<(), Error> {
    info!("Starting runner");

    let mut interval = time::interval(time::Duration::from_secs(2));
    loop {
        for _ in 0..30 {
            if let Err(error) = push_notifications::run(&ic_agent_config, canister_id, store, vapid_private_pem).await {
                error!(?error, "Push notifications failed");
            }

            interval.tick().await;
        }

        if let Err(error) = prune_notifications::run(&ic_agent_config, canister_id, store).await {
            error!(?error, "Prune notifications failed");
        }
    }
}
