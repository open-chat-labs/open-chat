use candid::CandidType;
use serde::Deserialize;
use std::collections::HashMap;
use types::MessageIndex;

/// This is used to tell the other user which of their messages we have read.
/// Their message indexes will not necessarily match with ours, so when we mark a message as read
/// using our own message index, we then need to convert that into their message index and tell them
/// that it has been read. Because this map is only used to handle marking their messages as read,
/// it only stores data for messages sent by them and we can remove entries once they have been
/// marked as read.
#[derive(CandidType, Deserialize, Default)]
pub struct UnreadMessageIndexMap {
    map: HashMap<MessageIndex, MessageIndex>,
}

impl UnreadMessageIndexMap {
    pub fn add(&mut self, ours: MessageIndex, theirs: MessageIndex) {
        self.map.insert(ours, theirs);
    }

    pub fn get(&self, ours: &MessageIndex) -> Option<MessageIndex> {
        self.map.get(ours).cloned()
    }

    pub fn remove(&mut self, ours: &MessageIndex) -> bool {
        self.map.remove(ours).is_some()
    }
}
