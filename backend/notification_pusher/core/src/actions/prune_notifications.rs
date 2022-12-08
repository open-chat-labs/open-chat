use crate::ic_agent::IcAgent;
use index_store::IndexStore;
use types::{CanisterId, Error};

pub async fn run(ic_agent: &IcAgent, notifications_canister_id: CanisterId, index_store: &dyn IndexStore) -> Result<(), Error> {
    let maybe_notification_index_processed_up_to = index_store.get(notifications_canister_id).await?;

    if let Some(notification_index_processed_up_to) = maybe_notification_index_processed_up_to {
        ic_agent
            .remove_notifications(&notifications_canister_id, notification_index_processed_up_to)
            .await?;
    }

    Ok(())
}
