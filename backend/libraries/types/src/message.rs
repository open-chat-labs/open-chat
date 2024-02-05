use crate::{
    CanisterId, Chat, EventIndex, MessageContent, MessageId, MessageIndex, Reaction, ThreadSummary, TimestampMillis, UserId,
};
use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::ops::{Deref, DerefMut};

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct Message {
    pub message_index: MessageIndex,
    pub message_id: MessageId,
    pub sender: UserId,
    pub content: MessageContent,
    pub replies_to: Option<ReplyContext>,
    pub reactions: Vec<(Reaction, Vec<UserId>)>,
    pub tips: Tips,
    pub thread_summary: Option<ThreadSummary>,
    pub edited: bool,
    pub forwarded: bool,
    pub last_updated: Option<TimestampMillis>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct ReplyContext {
    pub chat_if_other: Option<(Chat, Option<MessageIndex>)>,
    pub event_index: EventIndex,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct GroupReplyContext {
    pub event_index: EventIndex,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Default)]
pub struct Tips(Vec<(CanisterId, Vec<(UserId, u128)>)>);

impl Deref for Tips {
    type Target = Vec<(CanisterId, Vec<(UserId, u128)>)>;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

impl DerefMut for Tips {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.0
    }
}

impl Tips {
    pub fn push(&mut self, ledger: CanisterId, user_id: UserId, amount: u128) {
        if let Some((_, tips)) = self.iter_mut().find(|(c, _)| *c == ledger) {
            if let Some((_, total)) = tips.iter_mut().find(|(u, _)| *u == user_id) {
                *total += amount;
            } else {
                tips.push((user_id, amount));
            }
        } else {
            self.0.push((ledger, vec![(user_id, amount)]));
        }
    }
}
