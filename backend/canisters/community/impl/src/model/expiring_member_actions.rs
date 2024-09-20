use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use types::{ChannelId, UserId};

#[derive(Serialize, Deserialize, Default)]
pub struct ExpiringMemberActions {
    queue: VecDeque<ExpiringMemberAction>,
}

#[derive(Serialize, Deserialize)]
pub enum ExpiringMemberAction {
    UserDetails(Vec<(UserId, Option<ChannelId>)>),
    TokenBalance(UserId, Option<ChannelId>),
    SnsNeuron(UserId, Option<ChannelId>),
}

impl ExpiringMemberActions {
    pub fn push(&mut self, action: ExpiringMemberAction) {
        self.queue.push_back(action);
    }

    pub fn pop_batch(&mut self) -> Vec<ExpiringMemberAction> {
        let mut batch = Vec::new();

        for _ in 0..5 {
            match self.queue.pop_front() {
                Some(a) => batch.push(a),
                None => break,
            }
        }

        batch
    }

    pub fn is_empty(&self) -> bool {
        self.queue.is_empty()
    }
}
