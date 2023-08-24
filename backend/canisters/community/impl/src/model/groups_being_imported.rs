use serde::{Deserialize, Serialize};
use std::collections::hash_map::Entry::Vacant;
use std::collections::HashMap;
use types::{ChannelId, ChatId, TimestampMillis, Timestamped, UserId};

#[derive(Serialize, Deserialize, Default)]
pub struct GroupsBeingImported {
    #[serde(skip_deserializing)]
    groups: HashMap<ChatId, GroupBeingImported>,
}

pub enum NextBatchResult {
    Success(Vec<(ChatId, u64)>),
    Continue,
    Exit,
}

impl GroupsBeingImported {
    pub fn add(
        &mut self,
        group_id: ChatId,
        channel_id: ChannelId,
        imported_by: UserId,
        total_bytes: u64,
        now: TimestampMillis,
        is_default: bool,
    ) -> bool {
        match self.groups.entry(group_id) {
            Vacant(e) => {
                e.insert(GroupBeingImported::new(channel_id, imported_by, total_bytes, is_default, now));
                true
            }
            _ => false,
        }
    }

    pub fn contains(&self, group_id: &ChatId) -> bool {
        self.groups.contains_key(group_id)
    }

    pub fn next_batch(&mut self, now: TimestampMillis) -> NextBatchResult {
        if self.groups.is_empty() {
            NextBatchResult::Exit
        } else {
            let mut batch = Vec::new();
            for (chat_id, group) in self.groups.iter_mut().filter(|(_, g)| !g.is_complete()) {
                if group.current_batch_started.is_none() {
                    group.current_batch_started = Some(now);
                    batch.push((*chat_id, group.bytes.len() as u64));
                }
            }
            if batch.is_empty() {
                NextBatchResult::Continue
            } else {
                NextBatchResult::Success(batch)
            }
        }
    }

    // Returns true if the group bytes have all been imported, else false
    pub fn mark_batch_complete(&mut self, group_id: &ChatId, bytes: &[u8]) -> bool {
        if let Some(group) = self.groups.get_mut(group_id) {
            group.current_batch_started = None;
            group.error_message = None;
            group.bytes.extend_from_slice(bytes);
            group.is_complete()
        } else {
            false
        }
    }

    pub fn mark_batch_failed(&mut self, group_id: &ChatId, error_message: String) {
        if let Some(group) = self.groups.get_mut(group_id) {
            group.current_batch_started = None;
            group.error_message = Some(error_message);
        }
    }

    pub fn take(&mut self, group_id: &ChatId) -> Option<GroupBeingImported> {
        self.groups.remove(group_id)
    }

    pub fn is_empty(&self) -> bool {
        self.groups.is_empty()
    }

    pub fn summaries(&self) -> Vec<GroupBeingImportedSummary> {
        self.groups.values().map(|g| g.into()).collect()
    }

    pub fn completed_imports(&self) -> Vec<ChatId> {
        self.groups.iter().filter(|(_, g)| g.is_complete()).map(|(g, _)| *g).collect()
    }
}

#[derive(Serialize, Deserialize)]
pub struct GroupBeingImported {
    channel_id: ChannelId,
    imported_by: UserId,
    import_started: TimestampMillis,
    current_batch_started: Option<TimestampMillis>,
    total_bytes: u64,
    #[serde(with = "serde_bytes")]
    bytes: Vec<u8>,
    error_message: Option<String>,
    is_default: Timestamped<bool>,
}

impl GroupBeingImported {
    pub fn new(
        channel_id: ChannelId,
        imported_by: UserId,
        total_bytes: u64,
        is_default: bool,
        now: TimestampMillis,
    ) -> GroupBeingImported {
        GroupBeingImported {
            channel_id,
            imported_by,
            import_started: now,
            current_batch_started: None,
            total_bytes,
            bytes: Vec::with_capacity(total_bytes as usize),
            error_message: None,
            is_default: Timestamped::new(is_default, now),
        }
    }

    pub fn channel_id(&self) -> ChannelId {
        self.channel_id
    }

    pub fn bytes(&self) -> &[u8] {
        &self.bytes
    }

    pub fn is_default(&self) -> Timestamped<bool> {
        self.is_default.clone()
    }

    pub fn is_complete(&self) -> bool {
        self.bytes.len() as u64 == self.total_bytes
    }
}

#[derive(Serialize, Debug)]
pub struct GroupBeingImportedSummary {
    imported_by: UserId,
    import_started: TimestampMillis,
    current_batch_started: Option<TimestampMillis>,
    total_bytes: u64,
    bytes_synced: u64,
    error_message: Option<String>,
}

impl From<&GroupBeingImported> for GroupBeingImportedSummary {
    fn from(value: &GroupBeingImported) -> Self {
        GroupBeingImportedSummary {
            imported_by: value.imported_by,
            import_started: value.import_started,
            current_batch_started: value.current_batch_started,
            total_bytes: value.total_bytes,
            bytes_synced: value.bytes.len() as u64,
            error_message: value.error_message.clone(),
        }
    }
}
