use crate::model::community::Community;
use direct_chat::removed_chats;
use serde::{Deserialize, Serialize};
use stable_memory_map::{
    CommunityKey, CommunityKeyPrefix, HeapStableSplitMap, HeapStableSplitMapMut, HeapStableSplitMapRef,
    HeapStableSplitMapValue, KeyPrefix, RemovedChatKeyPrefix,
};
use std::collections::HashMap;
use types::{CanisterId, CommunityId, TimestampMillis};

// The communities the user is in, each of which (with each of its channels) is stored whole in the
// stable memory map (see `HeapStableSplitMap`). The heap only holds each community's index and when it was
// last updated.
#[derive(Serialize, Deserialize, Default)]
#[serde(from = "CommunitiesCombined")]
pub struct Communities {
    communities_created: u32,
    communities_v2: HeapStableSplitMap<Community>,
}

// Reads both the current layout and the one before it, in which every community was on the heap (see
// `GroupChatsCombined`)
#[derive(Deserialize)]
struct CommunitiesCombined {
    communities_created: u32,
    #[serde(default)]
    communities: HashMap<CommunityId, Community>,
    #[serde(default)]
    communities_v2: HeapStableSplitMap<Community>,
}

impl From<CommunitiesCombined> for Communities {
    fn from(value: CommunitiesCombined) -> Self {
        let mut communities_v2 = value.communities_v2;
        communities_v2.extend_from_heap(value.communities);
        Communities {
            communities_created: value.communities_created,
            communities_v2,
        }
    }
}

// What is kept on the heap for each community
#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub struct CommunityEntry {
    #[serde(rename = "i")]
    index: u32,
    #[serde(rename = "u")]
    last_updated: TimestampMillis,
}

impl HeapStableSplitMapValue for Community {
    type Id = CommunityId;
    type Entry = CommunityEntry;
    type Key = CommunityKey;

    fn entry(&self) -> CommunityEntry {
        CommunityEntry {
            index: self.index.value,
            last_updated: self.last_updated(),
        }
    }

    fn key(community_id: &CommunityId, _: &CommunityEntry) -> CommunityKey {
        CommunityKeyPrefix::new().create_key(community_id)
    }

    fn to_bytes(&self) -> Vec<u8> {
        msgpack::serialize_then_unwrap(self)
    }

    fn from_bytes(bytes: &[u8]) -> Self {
        msgpack::deserialize_then_unwrap(bytes)
    }
}

impl Communities {
    pub fn exists(&self, community_id: &CommunityId) -> bool {
        self.communities_v2.contains_key(community_id)
    }

    pub fn get_mut(&mut self, community_id: &CommunityId) -> Option<HeapStableSplitMapMut<'_, Community>> {
        self.communities_v2.get_mut(community_id)
    }

    pub fn any_updated(&self, since: TimestampMillis) -> bool {
        self.communities_v2.entries().any(|(_, entry)| entry.last_updated > since)
            || removed_chats::any_removed_since(&RemovedChatKeyPrefix::new_for_communities(), since)
    }

    pub fn create(
        &mut self,
        community_id: CommunityId,
        local_user_index_canister_id: CanisterId,
        now: TimestampMillis,
    ) -> bool {
        self.join(community_id, local_user_index_canister_id, now);
        self.communities_created += 1;
        true
    }

    // Returns the community, and whether it was newly joined
    pub fn join(
        &mut self,
        community_id: CommunityId,
        local_user_index_canister_id: CanisterId,
        now: TimestampMillis,
    ) -> (HeapStableSplitMapMut<'_, Community>, bool) {
        if self.exists(&community_id) {
            return (self.communities_v2.get_mut(&community_id).unwrap(), false);
        }
        let index = self.next_index();
        let community = Community::new(community_id, local_user_index_canister_id, index, now);
        (self.communities_v2.insert(community_id, community), true)
    }

    pub fn remove(&mut self, community_id: CommunityId, now: TimestampMillis) -> Option<Community> {
        removed_chats::add(&RemovedChatKeyPrefix::new_for_communities(), community_id.into(), now);
        self.communities_v2.remove(&community_id)
    }

    pub fn updated_since(&self, updated_since: TimestampMillis) -> impl Iterator<Item = HeapStableSplitMapRef<'_, Community>> {
        self.communities_v2.filter(move |entry| entry.last_updated > updated_since)
    }

    // Every community, each of which is read from stable memory as the iterator reaches it
    pub fn iter(&self) -> impl Iterator<Item = HeapStableSplitMapRef<'_, Community>> {
        self.communities_v2.iter()
    }

    pub fn ids(&self) -> impl Iterator<Item = CommunityId> + '_ {
        self.communities_v2.ids()
    }

    pub fn removed_since(&self, timestamp: TimestampMillis) -> Vec<CommunityId> {
        removed_chats::removed_since_excluding(&RemovedChatKeyPrefix::new_for_communities(), timestamp, |community_id| {
            self.exists(community_id)
        })
    }

    pub fn communities_created(&self) -> u32 {
        self.communities_created
    }

    pub fn len(&self) -> usize {
        self.communities_v2.len()
    }

    pub fn is_empty(&self) -> bool {
        self.communities_v2.is_empty()
    }

    // Moves every community still on the heap into stable memory, returning how many were moved
    pub fn migrate_to_stable_memory(&mut self) -> usize {
        self.communities_v2.migrate_to_stable_memory()
    }

    fn next_index(&self) -> u32 {
        self.communities_v2
            .entries()
            .map(|(_, entry)| entry.index)
            .max()
            .unwrap_or_default()
            + 1
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use candid::Principal;
    use ic_stable_structures::DefaultMemoryImpl;
    use ic_stable_structures::memory_manager::{MemoryId, MemoryManager};
    use stable_memory_map::{with_map, with_map_mut};
    use types::ChannelId;
    use user_canister::mark_read::ChannelMessagesRead;

    #[test]
    fn removed_since_excludes_communities_rejoined() {
        init_stable_memory_map();
        let mut communities = Communities::default();
        let local_user_index = Principal::from_slice(&[9; 10]);

        for i in 1..=3 {
            communities.join(community(i), local_user_index, i as u64);
        }
        communities.remove(community(1), 10);
        communities.remove(community(2), 20);
        communities.remove(community(3), 30);
        communities.join(community(2), local_user_index, 40);
        communities.remove(community(1), 50);

        assert_eq!(communities.removed_since(0), vec![community(1), community(3)]);
        assert_eq!(communities.removed_since(30), vec![community(1)]);
        assert!(communities.removed_since(50).is_empty());
        assert!(communities.any_updated(49));
    }

    #[test]
    fn communities_are_stored_in_stable_memory_with_their_channels() {
        init_stable_memory_map();
        let mut communities = Communities::default();
        let local_user_index = Principal::from_slice(&[9; 10]);

        let (mut joined, newly_joined) = communities.join(community(1), local_user_index, 10);
        assert!(newly_joined);
        assert_eq!(joined.index.value, 1);
        joined.mark_read(vec![channel_read(1, 5), channel_read(2, 6)], 20);
        drop(joined);
        communities.join(community(2), local_user_index, 30);
        assert!(is_stored(community(1)) && is_stored(community(2)));

        // Joining again returns the community as it is
        let (joined, newly_joined) = communities.join(community(1), local_user_index, 40);
        assert!(!newly_joined);
        assert_eq!(joined.channels.len(), 2);
        drop(joined);

        let updated: Vec<_> = communities.updated_since(25).map(|c| c.community_id).collect();
        assert_eq!(updated, vec![community(2)]);
        communities
            .get_mut(&community(1))
            .unwrap()
            .mark_read(vec![channel_read(1, 8)], 50);
        let updated: Vec<_> = communities.updated_since(40).map(|c| c.community_id).collect();
        assert_eq!(updated, vec![community(1)]);
        let community_1 = communities.iter().find(|c| c.community_id == community(1)).unwrap();
        let channel = community_1.channels.get(&ChannelId::from(1u32)).unwrap();
        assert_eq!(channel.messages_read.read_by_me_up_to.value, Some(8.into()));
        drop(community_1);

        // The next community's index, and which communities the user is in, are known without
        // reading them
        for i in 1..=2 {
            with_map_mut(|m| m.insert(CommunityKeyPrefix::new().create_key(&community(i)), vec![1, 2, 3]));
        }
        assert_eq!(communities.next_index(), 3);
        let mut ids: Vec<_> = communities.ids().collect();
        ids.sort();
        assert_eq!(ids, vec![community(1), community(2)]);
        assert!(communities.any_updated(49));
        assert!(!communities.any_updated(50));
    }

    #[test]
    fn communities_from_the_previous_layout_are_moved_into_stable_memory() {
        init_stable_memory_map();
        let local_user_index = Principal::from_slice(&[9; 10]);

        #[derive(Serialize)]
        struct CommunitiesPrevious {
            communities_created: u32,
            communities: HashMap<CommunityId, Community>,
        }
        let mut previous_community = Community::new(community(1), local_user_index, 7, 10);
        previous_community.mark_read(vec![channel_read(3, 4)], 20);
        let previous = CommunitiesPrevious {
            communities_created: 1,
            communities: HashMap::from([(community(1), previous_community)]),
        };
        let mut communities: Communities = msgpack::deserialize_then_unwrap(&msgpack::serialize_then_unwrap(previous));
        assert_eq!(communities.len(), 1);
        assert_eq!(communities.communities_created(), 1);
        assert_eq!(communities.next_index(), 8);
        assert!(!is_stored(community(1)));

        assert_eq!(communities.migrate_to_stable_memory(), 1);
        assert!(is_stored(community(1)));
        let migrated = communities.iter().next().unwrap();
        assert_eq!(migrated.index.value, 7);
        assert_eq!(
            migrated
                .channels
                .get(&ChannelId::from(3u32))
                .unwrap()
                .messages_read
                .read_by_me_up_to
                .value,
            Some(4.into())
        );
        drop(migrated);
        assert_eq!(communities.next_index(), 8);

        let deserialized: Communities = msgpack::deserialize_then_unwrap(&msgpack::serialize_then_unwrap(&communities));
        assert_eq!(deserialized.len(), 1);
        assert_eq!(deserialized.updated_since(15).count(), 1);
    }

    fn channel_read(channel_id: u32, read_up_to: u32) -> ChannelMessagesRead {
        ChannelMessagesRead {
            channel_id: channel_id.into(),
            read_up_to: Some(read_up_to.into()),
            threads: Vec::new(),
            date_read_pinned: None,
        }
    }

    fn is_stored(community_id: CommunityId) -> bool {
        with_map(|m| m.contains_key(CommunityKeyPrefix::new().create_key(&community_id)))
    }

    fn community(i: u8) -> CommunityId {
        Principal::from_slice(&[i; 10]).into()
    }

    fn init_stable_memory_map() {
        let memory = MemoryManager::init(DefaultMemoryImpl::default());
        stable_memory_map::init_with_small_entries_map(memory.get(MemoryId::new(1)), memory.get(MemoryId::new(2)));
    }
}
