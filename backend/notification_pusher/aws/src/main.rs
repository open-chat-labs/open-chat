use aws_config::BehaviorVersion;
use dynamodb_index_store::DynamoDbIndexStore;
use notification_pusher_core::config::Config;
use notification_pusher_core::{run_notifications_pusher, write_metrics};
use tokio::time;
use tracing::info;
use types::Error;

#[tokio::main]
async fn main() -> Result<(), Error> {
    tracing_subscriber::fmt::init();
    info!("Starting...");

    let aws_config = aws_config::load_defaults(BehaviorVersion::latest()).await;
    let index_store = DynamoDbIndexStore::build(&aws_config, "push_notification_stream_indexes".to_string());
    let config = Config::init_with_store(index_store).await?;
    info!("DynamoDbClient created & config initialized");

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
