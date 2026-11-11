use candid::Principal;
use local_user_index_canister::{ChitBalance, GlobalUser};
use principal_to_user_id_map::PrincipalToUserIdMap;
use serde::{Deserialize, Serialize};
use stable_memory_map::StableMemoryMap;
use std::collections::{BTreeSet, HashMap, HashSet};
use types::{CanisterId, TimestampMillis, UniquePersonProof, UserId, UserType, is_default};

#[derive(Serialize, Deserialize, Default)]
pub struct GlobalUserMap {
    // Moved into `users` by `migrate_principals` on the upgrade which added `users`.
    // TODO remove once every LocalUserIndex has been upgraded with it.
    #[serde(default, skip_serializing)]
    user_id_to_principal: HashMap<UserId, Principal>,
    #[serde(default)]
    users: HashMap<UserId, GlobalUserEntry>,
    principal_to_user_id: PrincipalToUserIdMap,
    unique_person_proofs: HashMap<UserId, UniquePersonProof>,
    platform_operators: HashSet<UserId>,
    platform_moderators: HashSet<UserId>,
    legacy_bots: HashSet<UserId>,
    oc_controlled_bot_users: HashSet<UserId>,
    diamond_membership_expiry_dates: HashMap<UserId, TimestampMillis>,
    #[serde(default)]
    chit: HashMap<UserId, ChitBalance>,
    // This LocalUserIndex's MultiUser canisters, plus those on other LocalUserIndexes which hold at
    // least one registered user
    #[serde(default)]
    multi_user_canisters: BTreeSet<CanisterId>,
}

impl GlobalUserMap {
    // A date of 0 (not known) keeps any date the user already has
    pub fn add(&mut self, principal: Principal, user_id: UserId, user_type: UserType, date_created: TimestampMillis) {
        let date_created = if date_created > 0 { date_created } else { self.users.get(&user_id).map_or(0, |u| u.date_created) };
        self.users.insert(user_id, GlobalUserEntry { principal, date_created });
        self.principal_to_user_id.insert(principal, user_id);

        // A user in a MultiUser canister carries an index, and is how this LocalUserIndex learns of
        // the MultiUser canisters on other LocalUserIndexes
        if user_id.index() != 0 {
            self.multi_user_canisters.insert(user_id.canister_id());
        }

        if user_type.is_bot() {
            self.legacy_bots.insert(user_id);

            if user_type.is_oc_controlled_bot() {
                self.oc_controlled_bot_users.insert(user_id);
            }
        }
    }

    // Leaves users this LocalUserIndex doesn't know of untouched
    pub fn update_principal(&mut self, user_id: UserId, principal: Principal) {
        if let Some(entry) = self.users.get_mut(&user_id)
            && entry.principal != principal
        {
            self.principal_to_user_id.remove_if(&entry.principal, |u| *u == user_id);
            self.principal_to_user_id.insert(principal, user_id);
            entry.principal = principal;
        }
    }

    pub fn migrate_principals(&mut self) {
        for (user_id, principal) in std::mem::take(&mut self.user_id_to_principal) {
            self.users.entry(user_id).or_insert(GlobalUserEntry {
                principal,
                date_created: 0,
            });
        }
    }

    // Sets the registration dates of users this map holds, ignoring any it doesn't
    pub fn set_registration_dates(&mut self, dates: Vec<(UserId, TimestampMillis)>) {
        for (user_id, date_created) in dates {
            if let Some(entry) = self.users.get_mut(&user_id) {
                entry.date_created = date_created;
            }
        }
    }

    // Users other than bots without a registration date
    pub fn undated_user_ids(&self) -> Vec<UserId> {
        self.undated_users().map(|(user_id, _)| *user_id).collect()
    }

    pub fn undated_user_count(&self) -> usize {
        self.undated_users().count()
    }

    fn undated_users(&self) -> impl Iterator<Item = (&UserId, &GlobalUserEntry)> {
        self.users
            .iter()
            .filter(|(user_id, entry)| entry.date_created == 0 && !self.legacy_bots.contains(user_id))
    }

    pub fn add_multi_user_canister(&mut self, canister_id: CanisterId) {
        self.multi_user_canisters.insert(canister_id);
    }

    pub fn multi_user_canisters(&self) -> &BTreeSet<CanisterId> {
        &self.multi_user_canisters
    }

    pub fn set_platform_operator(&mut self, user_id: UserId, is_platform_operator: bool) {
        if is_platform_operator {
            self.platform_operators.insert(user_id);
        } else {
            self.platform_operators.remove(&user_id);
        }
    }

    pub fn set_platform_moderator(&mut self, user_id: UserId, is_platform_moderator: bool) {
        if is_platform_moderator {
            self.platform_moderators.insert(user_id);
        } else {
            self.platform_moderators.remove(&user_id);
        }
    }

    pub fn get(&self, user_id_or_principal: &Principal) -> Option<GlobalUser> {
        self.get_by_principal(user_id_or_principal)
            .or_else(|| self.get_by_user_id(&UserId::from(*user_id_or_principal)))
    }

    pub fn get_by_principal(&self, principal: &Principal) -> Option<GlobalUser> {
        self.principal_to_user_id
            .get(principal)
            .and_then(|user_id| self.get_by_user_id(&user_id))
    }

    pub fn get_by_user_id(&self, user_id: &UserId) -> Option<GlobalUser> {
        self.users.get(user_id).map(|entry| self.hydrate_user(*user_id, entry))
    }

    pub fn contains(&self, user_id: &UserId) -> bool {
        self.users.contains_key(user_id)
    }

    pub fn diamond_membership_expiry_date(&self, user_id: &UserId) -> Option<TimestampMillis> {
        self.diamond_membership_expiry_dates.get(user_id).copied()
    }

    pub fn set_diamond_membership_expiry_date(&mut self, user_id: UserId, expires_at: TimestampMillis) {
        self.diamond_membership_expiry_dates.insert(user_id, expires_at);
    }

    pub fn remove(&mut self, user_id: &UserId) -> bool {
        if let Some(entry) = self.users.remove(user_id) {
            self.principal_to_user_id.remove_if(&entry.principal, |u| u == user_id);
            self.platform_moderators.remove(user_id);
            self.legacy_bots.remove(user_id);
            self.diamond_membership_expiry_dates.remove(user_id);
            true
        } else {
            false
        }
    }

    pub fn insert_unique_person_proof(&mut self, user_id: UserId, proof: UniquePersonProof) {
        self.unique_person_proofs.insert(user_id, proof);
    }

    pub fn insert_chit_record(&mut self, user_id: UserId, chit_record: ChitBalance) {
        self.chit.insert(user_id, chit_record);
    }

    pub fn is_bot(&self, user_id: &UserId) -> bool {
        self.legacy_bots.contains(user_id)
    }

    pub fn len(&self) -> usize {
        self.users.len()
    }

    pub fn legacy_bots(&self) -> &HashSet<UserId> {
        &self.legacy_bots
    }

    pub fn oc_controlled_bots(&self) -> &HashSet<UserId> {
        &self.oc_controlled_bot_users
    }

    pub fn platform_moderators(&self) -> &HashSet<UserId> {
        &self.platform_moderators
    }

    pub fn platform_operators(&self) -> &HashSet<UserId> {
        &self.platform_operators
    }

    pub fn is_diamond_member(&self, user_id: &UserId, now: TimestampMillis) -> bool {
        self.diamond_membership_expiry_date(user_id).is_some_and(|t| t > now)
    }

    fn hydrate_user(&self, user_id: UserId, entry: &GlobalUserEntry) -> GlobalUser {
        let user_type = if self.oc_controlled_bot_users.contains(&user_id) {
            UserType::OcControlledBot
        } else if self.legacy_bots.contains(&user_id) {
            UserType::Bot
        } else {
            UserType::User
        };

        GlobalUser {
            user_id,
            principal: entry.principal,
            is_platform_operator: self.platform_operators.contains(&user_id),
            is_platform_moderator: self.platform_moderators.contains(&user_id),
            diamond_membership_expires_at: self.diamond_membership_expiry_dates.get(&user_id).copied(),
            unique_person_proof: self.unique_person_proofs.get(&user_id).cloned(),
            user_type,
            chit: self.chit.get(&user_id).cloned().unwrap_or_default(),
            date_created: (entry.date_created > 0).then_some(entry.date_created),
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Copy)]
struct GlobalUserEntry {
    #[serde(rename = "p")]
    principal: Principal,
    // When the user registered, 0 until it's known
    #[serde(rename = "d", default, skip_serializing_if = "is_default")]
    date_created: TimestampMillis,
}

#[cfg(test)]
mod tests {
    use super::*;
    use ic_stable_structures::DefaultMemoryImpl;
    use ic_stable_structures::memory_manager::{MemoryId, MemoryManager};

    #[test]
    fn multi_user_canisters_learnt_from_indexed_users() {
        let memory = MemoryManager::init(DefaultMemoryImpl::default());
        stable_memory_map::init(memory.get(MemoryId::new(1)));

        let user_canister = CanisterId::from_slice(&[0, 0, 0, 0, 0, 0, 0, 1, 1, 1]);
        let multi_user_canister = CanisterId::from_slice(&[0, 0, 0, 0, 0, 0, 0, 2, 1, 1]);
        let mut map = GlobalUserMap::default();

        map.add(Principal::from_slice(&[1]), user_canister.into(), UserType::User, 0);
        assert!(map.multi_user_canisters().is_empty());

        map.add(
            Principal::from_slice(&[2]),
            UserId::new_indexed(multi_user_canister, 1),
            UserType::User,
            0,
        );
        map.add(
            Principal::from_slice(&[3]),
            UserId::new_indexed(multi_user_canister, 2),
            UserType::User,
            0,
        );
        assert_eq!(
            map.multi_user_canisters().iter().copied().collect::<Vec<_>>(),
            vec![multi_user_canister]
        );
    }
    // Invariant: a LocalUserIndex upgraded from the old shape keeps every user's principal, with their
    // registration date unknown until the backfill sets it
    #[test]
    fn map_in_the_old_shape_keeps_its_users_with_dates_unknown() {
        // The map as it was before it held registration dates
        #[derive(Serialize, Default)]
        struct OldShape {
            user_id_to_principal: HashMap<UserId, Principal>,
            principal_to_user_id: PrincipalToUserIdMap,
            unique_person_proofs: HashMap<UserId, UniquePersonProof>,
            platform_operators: HashSet<UserId>,
            platform_moderators: HashSet<UserId>,
            legacy_bots: HashSet<UserId>,
            oc_controlled_bot_users: HashSet<UserId>,
            diamond_membership_expiry_dates: HashMap<UserId, TimestampMillis>,
            chit: HashMap<UserId, ChitBalance>,
            multi_user_canisters: BTreeSet<CanisterId>,
        }

        let memory = MemoryManager::init(DefaultMemoryImpl::default());
        stable_memory_map::init(memory.get(MemoryId::new(1)));

        let user_id: UserId = Principal::from_slice(&[1, 1]).into();
        let principal = Principal::from_slice(&[2]);
        let mut old_shape = OldShape {
            user_id_to_principal: HashMap::from([(user_id, principal)]),
            ..Default::default()
        };
        old_shape.principal_to_user_id.insert(principal, user_id);
        let bytes = msgpack::serialize_then_unwrap(old_shape);

        let mut map: GlobalUserMap = msgpack::deserialize_then_unwrap(&bytes);
        map.migrate_principals();

        let user = map.get_by_user_id(&user_id).unwrap();
        assert_eq!(user.principal, principal);
        assert_eq!(map.get_by_principal(&principal).unwrap().user_id, user_id);
        assert_eq!(user.date_created, None);
        assert_eq!(map.len(), 1);
        assert_eq!(map.undated_user_ids(), vec![user_id]);

        map.set_registration_dates(vec![(user_id, 100)]);
        assert_eq!(map.get_by_user_id(&user_id).unwrap().date_created, Some(100));
        assert!(map.undated_user_ids().is_empty());

        // A later sync without a date keeps the one it has, and the date survives an upgrade
        map.add(principal, user_id, UserType::User, 0);
        let map: GlobalUserMap = msgpack::deserialize_then_unwrap(&msgpack::serialize_then_unwrap(&map));
        assert_eq!(map.get_by_user_id(&user_id).unwrap().date_created, Some(100));
    }
}
