use crate::ic_agent::IcAgent;
use async_channel::Receiver;
use std::collections::HashMap;
use tokio::time;
use tracing::{error, info};
use types::{ApnsToken, CanisterId, FcmToken, PushIfNotContains, UserId};

// A device token FCM or APNs rejected as no longer valid
#[derive(Debug)]
pub enum DeadToken {
    Fcm(FcmToken),
    Apns(ApnsToken),
}

// Mirrors SubscriptionRemover: batches the dead tokens and removes them from the notifications
// index, so we stop pushing to them.
pub struct TokenRemover {
    ic_agent: IcAgent,
    index_canister_id: CanisterId,
    tokens_to_remove_receiver: Receiver<(UserId, DeadToken)>,
}

impl TokenRemover {
    pub fn new(
        ic_agent: IcAgent,
        index_canister_id: CanisterId,
        tokens_to_remove_receiver: Receiver<(UserId, DeadToken)>,
    ) -> Self {
        Self {
            ic_agent,
            index_canister_id,
            tokens_to_remove_receiver,
        }
    }

    pub async fn run(self) {
        let mut interval = time::interval(time::Duration::from_secs(60));
        loop {
            let mut fcm_tokens: HashMap<UserId, Vec<FcmToken>> = HashMap::new();
            let mut apns_tokens: HashMap<UserId, Vec<ApnsToken>> = HashMap::new();
            while let Ok((user_id, token)) = self.tokens_to_remove_receiver.try_recv() {
                match token {
                    DeadToken::Fcm(token) => fcm_tokens.entry(user_id).or_default().push_if_not_contains(token),
                    DeadToken::Apns(token) => apns_tokens.entry(user_id).or_default().push_if_not_contains(token),
                };
            }

            if !fcm_tokens.is_empty() {
                let count = fcm_tokens.len();
                let user_ids: Vec<_> = fcm_tokens.keys().map(|u| u.to_string()).collect();
                if let Err(error) = self.ic_agent.remove_fcm_tokens(&self.index_canister_id, fcm_tokens).await {
                    error!(?error, "Failed to remove FCM tokens");
                } else {
                    info!(?user_ids, "Removed FCM tokens for {count} users");
                }
            }

            if !apns_tokens.is_empty() {
                let count = apns_tokens.len();
                let user_ids: Vec<_> = apns_tokens.keys().map(|u| u.to_string()).collect();
                if let Err(error) = self.ic_agent.remove_apns_tokens(&self.index_canister_id, apns_tokens).await {
                    error!(?error, "Failed to remove APNs tokens");
                } else {
                    info!(?user_ids, "Removed APNs tokens for {count} users");
                }
            }

            interval.tick().await;
        }
    }
}
