use crate::ic_agent::IcAgent;
use crate::ic_agent::IcAgentConfig;
use index_store::IndexStore;
use types::Error;

pub async fn run(config: &IcAgentConfig, index_store: &dyn IndexStore) -> Result<(), Error> {
    let ic_agent = IcAgent::build(config).await?;
    let maybe_notification_index_processed_up_to = index_store.get().await?;

    if let Some(notification_index_processed_up_to) = maybe_notification_index_processed_up_to {
        ic_agent.remove_notifications(notification_index_processed_up_to).await?;
    }

    Ok(())
}
