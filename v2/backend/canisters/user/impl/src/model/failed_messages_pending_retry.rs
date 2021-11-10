use crate::updates::send_message::{send_to_recipients_canister, CyclesTransferDetails};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use types::UserId;
use user_canister::c2c_send_message;

#[derive(Serialize, Deserialize, Default)]
pub struct FailedMessagesPendingRetry {
    messages: HashMap<UserId, Vec<(c2c_send_message::Args, Option<CyclesTransferDetails>)>>,
}

impl FailedMessagesPendingRetry {
    pub fn add(&mut self, recipient: UserId, args: c2c_send_message::Args, cycles_transfer: Option<CyclesTransferDetails>) {
        self.messages.entry(recipient).or_default().push((args, cycles_transfer));
    }

    pub fn retry(&mut self, recipient: &UserId) {
        if let Some((recipient, messages)) = self.messages.remove_entry(recipient) {
            ic_cdk::block_on(Self::retry_async(recipient, messages));
        }
    }

    async fn retry_async(recipient: UserId, messages: Vec<(c2c_send_message::Args, Option<CyclesTransferDetails>)>) {
        let futures: Vec<_> = messages
            .into_iter()
            .map(|(args, cycles_transfer)| send_to_recipients_canister(recipient, args, cycles_transfer, true))
            .collect();

        futures::future::join_all(futures).await;
    }
}
