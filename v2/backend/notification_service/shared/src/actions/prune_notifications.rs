use crate::ic_agent::IcAgent;
use crate::store::Store;
use shared::error::Error;
use shared::types::CanisterId;

pub async fn run(canister_id: CanisterId, store: Box<dyn Store + Send + Sync>, ic_identity_pem: String) -> Result<(), Error> {
    let ic_agent = IcAgent::build(&ic_identity_pem)?;
    let maybe_notification_index_processed_up_to = store.get_notification_index_processed_up_to(canister_id).await?;

    if let Some(notification_index_processed_up_to) = maybe_notification_index_processed_up_to {
        ic_agent
            .remove_notifications(canister_id, notification_index_processed_up_to)
            .await?;
    }

    Ok(())
}
