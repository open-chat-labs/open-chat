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
        self.queue.retain(|a| match a {
            ExpiringMemberAction::UserLookup(_) => true,
            ExpiringMemberAction::AsyncGateCheck(d) => d.channel_id != channel_id,
        });
    }

    pub fn remove_member(&mut self, user_id: UserId, channel_id: Option<ChannelId>) {
        self.queue.retain(|a| match a {
            ExpiringMemberAction::UserLookup(_) => true,
            ExpiringMemberAction::AsyncGateCheck(d) => {
                !(d.user_id == user_id && (channel_id.is_none() || channel_id == d.channel_id))
            }
        });
    }

    pub fn change_user_id(&mut self, old_user_id: UserId, new_user_id: UserId) {
        for action in self.queue.iter_mut() {
            match action {
                ExpiringMemberAction::UserLookup(user_ids) => {
                    for user_id in user_ids.iter_mut().filter(|u| **u == old_user_id) {
                        *user_id = new_user_id;
                    }
                }
                ExpiringMemberAction::AsyncGateCheck(d) => {
                    if d.user_id == old_user_id {
                        d.user_id = new_user_id;
                    }
                }
            }
        }
    }

    pub fn is_empty(&self) -> bool {
        self.queue.is_empty()
    }
}

#[derive(Serialize, Deserialize)]
pub enum ExpiringMemberAction {
    UserLookup(Vec<UserId>),
    AsyncGateCheck(ExpiringMemberActionDetails),
}

#[derive(Serialize, Deserialize)]
pub struct ExpiringMemberActionDetails {
    pub user_id: UserId,
    pub channel_id: Option<ChannelId>,
    pub member_expires: TimestampMillis,
    pub original_gate_expiry: Milliseconds,
}
