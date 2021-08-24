use candid::Principal;
use log::error;
use shared::actions::{prune_notifications, push_notifications};
use shared::error::Error;
use shared::ic_agent::IcAgentConfig;
use shared::store::Store;
use tokio::time;

pub async fn run(
    ic_agent_config: IcAgentConfig,
    canister_id: Principal,
    store: &mut Box<dyn Store + Send + Sync>,
    vapid_private_pem: &str,
) -> Result<(), Error> {
    let mut interval = time::interval(time::Duration::from_secs(2));
    loop {
        for _ in 0..30 {
            if let Err(err) = push_notifications::run(&ic_agent_config, canister_id, store, vapid_private_pem).await {
                error!("push notifications failed: {:?}", err);
            }

            interval.tick().await;
        }

        if let Err(err) = prune_notifications::run(&ic_agent_config, canister_id, store).await {
            error!("prune notifications failed: {:?}", err);
        }
    }
}
