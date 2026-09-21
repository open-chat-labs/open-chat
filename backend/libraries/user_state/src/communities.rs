use crate::community::Community;
use direct_chat::removed_chats;
use serde::{Deserialize, Serialize};
use stable_memory_map::RemovedChatKeyPrefix;
use std::collections::HashMap;
use std::collections::hash_map::Entry::{Occupied, Vacant};
use types::{CanisterId, CommunityId, TimestampMillis};

#[derive(Serialize, Deserialize, Default)]
pub struct Communities {
    communities_created: u32,
    communities: HashMap<CommunityId, Community>,
    // The communities removed which were held on the heap, which are all moved into stable memory in
    // `post_upgrade` by `migrate_to_stable_memory`, so this is always empty otherwise.
    // TODO: Remove this after next release
    #[serde(rename = "removed", default, skip_serializing)]
    removed_on_heap: Vec<RemovedCommunity>,
}

#[derive(Serialize, Deserialize)]
struct RemovedCommunity {
    community_id: CommunityId,
    timestamp: TimestampMillis,
}

impl Communities {
    pub fn exists(&self, community_id: &CommunityId) -> bool {
        self.communities.contains_key(community_id)
    }

    pub fn get_mut(&mut self, community_id: &CommunityId) -> Option<&mut Community> {
        self.communities.get_mut(community_id)
    }

    pub fn any_updated(&self, since: TimestampMillis) -> bool {
        self.communities.values().any(|c| c.last_updated() > since)
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

    pub fn join(
        &mut self,
        community_id: CommunityId,
        local_user_index_canister_id: CanisterId,
        now: TimestampMillis,
    ) -> (&mut Community, bool) {
        let index = self.next_index();
        match self.communities.entry(community_id) {
            Vacant(e) => (
                e.insert(Community::new(community_id, local_user_index_canister_id, index, now)),
                true,
            ),
            Occupied(e) => (e.into_mut(), false),
        }
    }

    pub fn remove(&mut self, community_id: CommunityId, now: TimestampMillis) -> Option<Community> {
        removed_chats::add(&RemovedChatKeyPrefix::new_for_communities(), community_id.into(), now);
        self.communities.remove(&community_id)
    }

    pub fn updated_since(&self, updated_since: TimestampMillis) -> impl Iterator<Item = &Community> {
        self.communities.values().filter(move |c| c.last_updated() > updated_since)
    }

    pub fn iter(&self) -> impl Iterator<Item = &Community> {
        self.communities.values()
    }

    pub fn iter_mut(&mut self) -> impl Iterator<Item = &mut Community> {
        self.communities.values_mut()
    }

    pub fn removed_since(&self, timestamp: TimestampMillis) -> Vec<CommunityId> {
        removed_chats::removed_since_excluding(&RemovedChatKeyPrefix::new_for_communities(), timestamp, |community_id| {
            self.communities.contains_key(community_id)
        })
    }

    // TODO: Remove this after next release
    pub fn migrate_removed_to_stable_memory(&mut self) -> usize {
        removed_chats::migrate_to_stable_memory(
            &RemovedChatKeyPrefix::new_for_communities(),
            std::mem::take(&mut self.removed_on_heap)
                .into_iter()
                .map(|c| (c.timestamp, c.community_id.into())),
        )
    }

    pub fn communities_created(&self) -> u32 {
        self.communities_created
    }

    pub fn len(&self) -> usize {
        self.communities.len()
    }

    pub fn is_empty(&self) -> bool {
        self.communities.is_empty()
    }

    fn next_index(&self) -> u32 {
        self.communities.values().map(|c| c.index.value).max().unwrap_or_default() + 1
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use candid::Principal;
    use ic_stable_structures::DefaultMemoryImpl;
    use ic_stable_structures::memory_manager::{MemoryId, MemoryManager};

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
    fn removed_communities_serialized_before_the_migration_are_migrated_to_stable_memory() {
        // The format `Communities` was serialized in before the removed communities were moved
        // into stable memory
        #[derive(Serialize)]
        struct LegacyCommunities {
            communities_created: u32,
            communities: HashMap<CommunityId, Community>,
            removed: Vec<RemovedCommunity>,
        }

        init_stable_memory_map();
        let legacy = LegacyCommunities {
            communities_created: 2,
            communities: HashMap::new(),
            removed: (1..=5)
                .map(|i| RemovedCommunity {
                    community_id: community(i),
                    timestamp: i as u64 * 10,
                })
                .collect(),
        };

        let mut communities: Communities = msgpack::deserialize_then_unwrap(&msgpack::serialize_then_unwrap(&legacy));

        assert_eq!(communities.communities_created(), 2);
        assert_eq!(communities.migrate_removed_to_stable_memory(), 5);
        assert_eq!(communities.migrate_removed_to_stable_memory(), 0);
        assert_eq!(communities.removed_since(20), vec![community(5), community(4), community(3)]);
    }

    fn community(i: u8) -> CommunityId {
        Principal::from_slice(&[i; 10]).into()
    }

    fn init_stable_memory_map() {
        let memory = MemoryManager::init(DefaultMemoryImpl::default());
        stable_memory_map::init_with_small_entries_map(memory.get(MemoryId::new(1)), memory.get(MemoryId::new(2)));
    }
}
