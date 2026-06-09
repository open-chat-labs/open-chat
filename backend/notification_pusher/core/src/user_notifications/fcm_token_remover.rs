use crate::ic_agent::IcAgent;
use async_channel::Receiver;
use std::collections::HashMap;
use tokio::time;
use tracing::{error, info};
use types::{CanisterId, FcmToken, PushIfNotContains, UserId};

// Mirrors SubscriptionRemover: batches FCM tokens that FCM rejected as no longer valid
// and removes them from the notifications index, so we stop pushing to dead tokens.
pub struct FcmTokenRemover {
    ic_agent: IcAgent,
    index_canister_id: CanisterId,
    fcm_tokens_to_remove_receiver: Receiver<(UserId, FcmToken)>,
}

impl FcmTokenRemover {
    pub fn new(
        ic_agent: IcAgent,
        index_canister_id: CanisterId,
        fcm_tokens_to_remove_receiver: Receiver<(UserId, FcmToken)>,
    ) -> Self {
        Self {
            ic_agent,
            index_canister_id,
            fcm_tokens_to_remove_receiver,
        }
    }

    pub async fn run(self) {
        let mut interval = time::interval(time::Duration::from_secs(60));
        loop {
            let mut tokens_to_remove: HashMap<UserId, Vec<FcmToken>> = HashMap::new();
            while let Ok((user_id, token)) = self.fcm_tokens_to_remove_receiver.try_recv() {
                tokens_to_remove.entry(user_id).or_default().push_if_not_contains(token);
            }

            if !tokens_to_remove.is_empty() {
                let count = tokens_to_remove.len();
                let user_ids: Vec<_> = tokens_to_remove.keys().map(|u| u.to_string()).collect();
                if let Err(error) = self
                    .ic_agent
                    .remove_fcm_tokens(&self.index_canister_id, tokens_to_remove)
                    .await
                {
                    error!(?error, "Failed to remove FCM tokens");
                } else {
                    info!(?user_ids, "Removed FCM tokens for {count} users");
                }
            }

            interval.tick().await;
        }
    }
}
