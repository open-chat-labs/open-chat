use stable_memory_map::{ChatEventKeyPrefix, MessageIdKeyPrefix, StableMemoryMap};
use types::{EventIndex, MessageId};

// Maps each message's `MessageId` to its `EventIndex`, stored in the stable memory map for small
// entries
pub struct MessageIdsStableStorage {
    prefix: MessageIdKeyPrefix,
}

impl MessageIdsStableStorage {
    pub fn new(events_prefix: &ChatEventKeyPrefix) -> Self {
        MessageIdsStableStorage {
            prefix: MessageIdKeyPrefix::from(events_prefix),
        }
    }
}

impl StableMemoryMap<MessageIdKeyPrefix, EventIndex> for MessageIdsStableStorage {
    fn prefix(&self) -> &MessageIdKeyPrefix {
        &self.prefix
    }

    fn value_to_bytes(value: EventIndex) -> Vec<u8> {
        u32::from(value).to_be_bytes().to_vec()
    }

    fn bytes_to_value(_key: &MessageId, bytes: Vec<u8>) -> EventIndex {
        u32::from_be_bytes(bytes.try_into().unwrap()).into()
    }
}
