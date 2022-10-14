use ic_ledger_types::TransferArgs;
use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use tracing::info;
use types::{BotMessage, TimestampMillis, TransactionHash, UserId};

#[derive(Serialize, Deserialize, Default)]
pub struct PendingActions {
    queue: VecDeque<(PendingAction, TimestampMillis)>,
}

impl PendingActions {
    pub fn add(&mut self, action: PendingAction, now: TimestampMillis) {
        info!(?action, "PendingAction added");
        self.queue.push_back((action, now));
    }

    pub fn take(&mut self) -> Option<PendingAction> {
        self.queue.pop_front().map(|(a, _)| a)
    }
}

#[derive(Serialize, Deserialize, Debug)]
pub enum PendingAction {
    IcpTransfer(UserId, TransferArgs, TransactionHash),
    SendMessages(UserId, Vec<BotMessage>),
}
