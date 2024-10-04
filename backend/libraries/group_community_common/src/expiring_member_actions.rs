use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use types::{ChannelId, Milliseconds, TimestampMillis, UserId};

#[derive(Serialize, Deserialize, Default)]
pub struct ExpiringMemberActions {
    queue: VecDeque<ExpiringMemberAction>,
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

    pub fn remove_gate(&mut self, channel_id: Option<ChannelId>) {
        for a in self.queue.iter_mut() {
            if let ExpiringMemberAction::Batch(list) = a {
                list.retain(|d| d.channel_id != channel_id);
            }
        }

        self.queue.retain(|a| match a {
            ExpiringMemberAction::Batch(vec) => !vec.is_empty(),
            ExpiringMemberAction::Single(d) => d.channel_id != channel_id,
        });
    }

    pub fn remove_member(&mut self, user_id: UserId, channel_id: Option<ChannelId>) {
        for a in self.queue.iter_mut() {
            if let ExpiringMemberAction::Batch(list) = a {
                list.retain(|d| !(d.user_id == user_id && (channel_id.is_none() || channel_id == d.channel_id)));
            }
        }

        self.queue.retain(|a| match a {
            ExpiringMemberAction::Batch(vec) => !vec.is_empty(),
            ExpiringMemberAction::Single(d) => !(d.user_id == user_id && (channel_id.is_none() || channel_id == d.channel_id)),
        });
    }

    pub fn is_empty(&self) -> bool {
        self.queue.is_empty()
    }
}

#[derive(Serialize, Deserialize)]
pub enum ExpiringMemberAction {
    Batch(Vec<ExpiringMemberActionDetails>),
    Single(ExpiringMemberActionDetails),
}

#[derive(Serialize, Deserialize)]
pub struct ExpiringMemberActionDetails {
    pub user_id: UserId,
    pub channel_id: Option<ChannelId>,
    pub member_expires: TimestampMillis,
    pub original_gate_expiry: Milliseconds,
}
