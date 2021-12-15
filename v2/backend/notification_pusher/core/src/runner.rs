use crate::actions::{prune_notifications, push_notifications};
use crate::ic_agent::IcAgentConfig;
use index_store::IndexStore;
use tokio::time;
use tracing::{error, info};
use types::Error;

pub async fn run(ic_agent_config: IcAgentConfig, index_store: &dyn IndexStore, vapid_private_pem: &str) -> Result<(), Error> {
    info!("Starting runner");

    let mut interval = time::interval(time::Duration::from_secs(2));
    loop {
        for _ in 0..30 {
            if let Err(error) = push_notifications::run(&ic_agent_config, index_store, vapid_private_pem).await {
                error!(?error, "Push notifications failed");
            }

            interval.tick().await;
        }

        if let Err(error) = prune_notifications::run(&ic_agent_config, index_store).await {
            error!(?error, "Prune notifications failed");
        }
    }
}
