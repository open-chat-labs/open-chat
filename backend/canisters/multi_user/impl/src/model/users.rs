use crate::model::user::User;
use candid::Principal;
use serde::{Deserialize, Serialize};
use stable_memory_map::{KeyScope, with_key_scope};
use std::collections::{BTreeMap, HashMap};
use types::{MAX_USER_INDEX, TimestampMillis, UserId};

// Index 0 is never assigned, since `UserId::index` returns 0 for a user id which carries no
// index, and indexes are never reused, so a deleted user's stable memory map entries can never be
// mistaken for a new user's.
const FIRST_USER_INDEX: u16 = 1;

// The users held by the canister, each identified by the index carried in their `UserId`.
//
// Every access to a user runs within that user's key scope, so any stable memory map entries read
// or written along the way belong to that user.
#[derive(Serialize, Deserialize)]
pub struct Users {
    users: BTreeMap<u16, User>,
    principal_to_index: HashMap<Principal, u16>,
    next_index: u16,
}

impl Default for Users {
    fn default() -> Users {
        Users {
            users: BTreeMap::new(),
            principal_to_index: HashMap::new(),
            next_index: FIRST_USER_INDEX,
        }
    }
}

#[derive(Debug, Eq, PartialEq)]
pub enum AddUserError {
    PrincipalAlreadyRegistered,
    CanisterFull,
}

impl Users {
    // Returns the index assigned to the new user
    pub fn add(
        &mut self,
        principal: Principal,
        username: String,
        referred_by: Option<UserId>,
        now: TimestampMillis,
    ) -> Result<u16, AddUserError> {
        if self.principal_to_index.contains_key(&principal) {
            return Err(AddUserError::PrincipalAlreadyRegistered);
        }
        if self.next_index > MAX_USER_INDEX {
            return Err(AddUserError::CanisterFull);
        }

        let index = self.next_index;
        self.next_index += 1;
        self.principal_to_index.insert(principal, index);
        self.users.insert(index, User::new(principal, username, referred_by, now));
        Ok(index)
    }

    pub fn index_by_principal(&self, principal: &Principal) -> Option<u16> {
        self.principal_to_index.get(principal).copied()
    }

    pub fn contains(&self, index: u16) -> bool {
        self.users.contains_key(&index)
    }

    pub fn with_user<R>(&self, index: u16, f: impl FnOnce(&User) -> R) -> Option<R> {
        self.users
            .get(&index)
            .map(|user| with_key_scope(KeyScope::User(index), || f(user)))
    }

    pub fn with_user_mut<R>(&mut self, index: u16, f: impl FnOnce(&mut User) -> R) -> Option<R> {
        self.users
            .get_mut(&index)
            .map(|user| with_key_scope(KeyScope::User(index), || f(user)))
    }

    pub fn len(&self) -> usize {
        self.users.len()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use ic_stable_structures::DefaultMemoryImpl;
    use ic_stable_structures::memory_manager::{MemoryId, MemoryManager};
    use stable_memory_map::{KeyPrefix, PrincipalKeyPrefix, with_map, with_map_mut};

    fn principal(i: u8) -> Principal {
        Principal::from_slice(&[i])
    }

    fn init_stable_memory_map() {
        let memory_manager = MemoryManager::init(DefaultMemoryImpl::default());
        stable_memory_map::init_multi_user(memory_manager.get(MemoryId::new(0)), memory_manager.get(MemoryId::new(1)));
    }

    #[test]
    fn indexes_start_at_one_and_increment() {
        let mut users = Users::default();

        assert_eq!(users.add(principal(1), "a".to_string(), None, 1), Ok(1));
        assert_eq!(users.add(principal(2), "b".to_string(), None, 2), Ok(2));
        assert_eq!(users.len(), 2);
        assert_eq!(users.index_by_principal(&principal(1)), Some(1));
        assert_eq!(users.index_by_principal(&principal(2)), Some(2));
        assert_eq!(users.index_by_principal(&principal(3)), None);
    }

    #[test]
    fn principal_can_only_be_registered_once() {
        let mut users = Users::default();

        assert_eq!(users.add(principal(1), "a".to_string(), None, 1), Ok(1));
        assert_eq!(
            users.add(principal(1), "b".to_string(), None, 2),
            Err(AddUserError::PrincipalAlreadyRegistered)
        );
        assert_eq!(users.len(), 1);
    }

    #[test]
    fn indexes_stop_at_the_max_user_index() {
        let mut users = Users {
            next_index: MAX_USER_INDEX,
            ..Default::default()
        };

        assert_eq!(users.add(principal(1), "a".to_string(), None, 1), Ok(MAX_USER_INDEX));
        assert_eq!(
            users.add(principal(2), "b".to_string(), None, 2),
            Err(AddUserError::CanisterFull)
        );
    }

    #[test]
    fn users_are_accessed_within_their_own_key_scope() {
        init_stable_memory_map();
        let mut users = Users::default();
        let first = users.add(principal(1), "a".to_string(), None, 1).unwrap();
        let second = users.add(principal(2), "b".to_string(), None, 2).unwrap();

        let key = || PrincipalKeyPrefix::new_for_principal_to_user_id_map().create_key(&principal(9));
        users.with_user_mut(first, |_| with_map_mut(|m| m.insert(key(), vec![1])));

        assert_eq!(users.with_user(first, |_| with_map(|m| m.get(key()))), Some(Some(vec![1])));
        assert_eq!(users.with_user(second, |_| with_map(|m| m.get(key()))), Some(None));
        assert_eq!(
            with_key_scope(KeyScope::User(first), || with_map(|m| m.get(key()))),
            Some(vec![1])
        );
        assert!(users.with_user(3, |_| ()).is_none());
    }
}
