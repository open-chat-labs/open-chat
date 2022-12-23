use crate::actions::{prune_notifications, push_notifications};
use crate::ic_agent::IcAgent;
use index_store::IndexStore;
use tokio::time;
use tracing::{error, info};
use types::{CanisterId, Error};

pub async fn run(
    ic_agent: &IcAgent,
    index_canister_id: CanisterId,
    notifications_canister_id: CanisterId,
    index_store: &dyn IndexStore,
    vapid_private_pem: &str,
) -> Result<(), Error> {
    info!("Starting runner");

    let mut interval = time::interval(time::Duration::from_secs(2));
    loop {
        for _ in 0..30 {
            if let Err(error) = push_notifications::run(
                ic_agent,
                index_canister_id,
                notifications_canister_id,
                index_store,
                vapid_private_pem,
            )
            .await
            {
                error!(?error, "Push notifications failed");
            }

            interval.tick().await;
        }

        if let Err(error) = prune_notifications::run(ic_agent, notifications_canister_id, index_store).await {
            error!(?error, "Prune notifications failed");
        }
    }
}
