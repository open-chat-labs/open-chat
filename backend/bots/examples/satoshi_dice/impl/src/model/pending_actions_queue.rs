use serde::{Deserialize, Serialize};
use std::collections::vec_deque::VecDeque;
use types::{MessageContent, UserId};

#[derive(Serialize, Deserialize, Default)]
pub struct PendingActionsQueue {
    queue: VecDeque<Action>,
}

impl PendingActionsQueue {
    pub fn push(&mut self, action: Action) {
        self.queue.push_back(action);
    }

    pub fn pop(&mut self) -> Option<Action> {
        self.queue.pop_front()
    }

    pub fn is_empty(&self) -> bool {
        self.queue.is_empty()
    }
}

#[derive(Serialize, Deserialize, Clone)]
pub enum Action {
    SendMessages(UserId, Vec<MessageContent>),
    TransferCkbtc(TransferCkbtc),
}

#[derive(Serialize, Deserialize, Clone)]
pub struct TransferCkbtc {
    pub user_id: UserId,
    pub amount: u64,
    pub send_oc_message: bool,
}
