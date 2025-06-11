use candid::Principal;
use index_store::DummyStore;
use notification_pusher_core::config::Config;
use notification_pusher_core::{run_notifications_pusher, write_metrics};
use std::collections::HashMap;
use tokio::time;
use tracing::info;
use types::Error;

#[tokio::main]
async fn main() -> Result<(), Error> {
    tracing_subscriber::fmt::init();

    info!("Initializing notification pusher");

    let args: Vec<String> = std::env::args().collect();
    let index = args.get(1).map(|a| a.parse::<u64>().unwrap()).unwrap_or_default();
    let config = Config::init_with_store(move |envc| {
        if let Some(ncid) = envc.notifications_canister_id {
            Ok(DummyStore::new(HashMap::from([(Principal::from_text(ncid)?, index)])))
        } else {
            Err("Notifications canister ID is not provided".into())
        }
    })
    .await?;

    info!("Initialization complete");

    tokio::spawn(write_metrics_to_file());

    run_notifications_pusher(config).await;

    Ok(())
}

async fn write_metrics_to_file() {
    let mut interval = time::interval(time::Duration::from_secs(30));

    loop {
        interval.tick().await;

        let mut bytes = Vec::new();
        write_metrics(&mut bytes);

        std::fs::write("metrics.md", bytes).unwrap();
    }
}
