use crate::{SmsReader, SmsSender};
use futures::future;
use index_store::IndexStore;
use tokio::time;
use tracing::{error, info};
use types::{CanisterId, Error};

pub async fn run(
    canister_id: CanisterId,
    sms_reader: &dyn SmsReader,
    index_store: &dyn IndexStore,
    sms_sender: &dyn SmsSender,
) -> Result<(), Error> {
    info!("Starting runner");

    let mut interval = time::interval(time::Duration::from_secs(2));
    let mut processed_up_to = index_store.get(canister_id).await?;
    let mut pruned_up_to = 0;

    loop {
        match send_messages(sms_reader, processed_up_to.map_or(0, |i| i + 1), sms_sender).await {
            Ok(Some(new_processed_up_to)) => {
                index_store.set(canister_id, new_processed_up_to).await?;
                processed_up_to = Some(new_processed_up_to);
            }
            Ok(None) => {}
            Err(err) => error!("sending messages failed: {err:?}"),
        };

        if let Some(processed_up_to) = processed_up_to {
            if processed_up_to - pruned_up_to >= 1000 {
                match sms_reader.remove(processed_up_to).await {
                    Ok(_) => pruned_up_to = processed_up_to,
                    Err(err) => error!("pruning messages failed: {err:?}"),
                }
                continue;
            }
        }

        interval.tick().await;
    }
}

async fn send_messages(sms_reader: &dyn SmsReader, from_index: u64, sms_sender: &dyn SmsSender) -> Result<Option<u64>, Error> {
    let success_result = sms_reader.get(from_index).await?;

    let maybe_latest_index = success_result.messages.last().map(|e| e.index);
    if maybe_latest_index.is_some() {
        let futures: Vec<_> = success_result
            .messages
            .into_iter()
            .map(|sms| sms_sender.send(sms.value.phone_number, sms.value.confirmation_code))
            .collect();

        future::join_all(futures).await;
    }

    Ok(maybe_latest_index)
}
