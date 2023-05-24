use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use types::MessageIndex;

/// This is used to tell the other user which of their messages we have read.
/// Their message indexes will not necessarily match with ours, so when we mark a message as read
/// using our own message index, we then need to convert that into their message index and tell them
/// that it has been read. Because this map is only used to handle marking their messages as read,
/// it only stores data for messages sent by them and we can remove entries once they have been
/// marked as read.
#[derive(CandidType, Serialize, Deserialize, Default)]
pub struct UnreadMessageIndexMap {
    map: BTreeMap<MessageIndex, MessageIndex>,
}

impl UnreadMessageIndexMap {
    pub fn add(&mut self, ours: MessageIndex, theirs: MessageIndex) {
        self.map.insert(ours, theirs);
    }

    pub fn get_max_read_up_to_of_theirs(&self, ours_read_up_to: &MessageIndex) -> Option<MessageIndex> {
        self.map
            .iter()
            .take_while(|(o, _)| *o <= ours_read_up_to)
            .map(|(_, t)| t)
            .copied()
            .max()
    }

    pub fn remove_up_to(&mut self, theirs: MessageIndex) {
        self.map.retain(|_, t| *t > theirs)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn get_max_read_up_to_of_theirs() {
        let mut map = UnreadMessageIndexMap::default();
        map.add(1.into(), 5.into());
        map.add(2.into(), 7.into());
        map.add(3.into(), 6.into());
        map.add(4.into(), 8.into());
        map.add(5.into(), 9.into());

        assert_eq!(map.get_max_read_up_to_of_theirs(&0.into()), None);
        assert_eq!(map.get_max_read_up_to_of_theirs(&3.into()), Some(7.into()));
        assert_eq!(map.get_max_read_up_to_of_theirs(&5.into()), Some(9.into()));
    }

    #[test]
    fn remove_up_to() {
        let mut map = UnreadMessageIndexMap::default();
        map.add(1.into(), 5.into());
        map.add(2.into(), 7.into());
        map.add(3.into(), 6.into());
        map.add(4.into(), 8.into());
        map.add(5.into(), 9.into());

        map.remove_up_to(0.into());
        assert_eq!(map.map.len(), 5);

        map.remove_up_to(7.into());
        assert_eq!(map.map.len(), 2);

        map.remove_up_to(9.into());
        assert_eq!(map.map.len(), 0);
    }
}
