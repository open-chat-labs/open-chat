use crate::actions::{prune_notifications, push_notifications};
use crate::error::Error;
use crate::ic_agent::IcAgentConfig;
use crate::store::Store;
use candid::Principal;
use slog::{error, info, Logger};
use tokio::time;

pub async fn run(
    ic_agent_config: IcAgentConfig,
    canister_id: Principal,
    store: &mut Box<dyn Store + Send + Sync>,
    vapid_private_pem: &str,
    logger: &Logger,
) -> Result<(), Error> {
    info!(logger, "Starting runner");

    let mut interval = time::interval(time::Duration::from_secs(2));
    loop {
        for _ in 0..30 {
            if let Err(err) = push_notifications::run(&ic_agent_config, canister_id, store, vapid_private_pem, logger).await {
                error!(logger, "Push notifications failed"; "error" => ?err);
            }

            interval.tick().await;
        }

        if let Err(err) = prune_notifications::run(&ic_agent_config, canister_id, store).await {
            error!(logger, "Prune notifications failed"; "error" => ?err);
        }
    }
}
