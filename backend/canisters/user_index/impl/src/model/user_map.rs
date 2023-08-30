use crate::model::diamond_membership_details::DiamondMembershipDetailsInternal;
use crate::model::user::{SuspensionDetails, SuspensionDuration, User};
use crate::DiamondMembershipUserMetrics;
use candid::Principal;
use serde::{Deserialize, Serialize};
use std::collections::{BTreeSet, HashMap};
use types::{CyclesTopUp, Milliseconds, TimestampMillis, UserId};
use utils::case_insensitive_hash_map::CaseInsensitiveHashMap;

#[derive(Serialize, Deserialize, Default)]
#[serde(from = "UserMapTrimmed")]
pub struct UserMap {
    users: HashMap<UserId, User>,
    #[serde(skip)]
    username_to_user_id: CaseInsensitiveHashMap<UserId>,
    #[serde(skip)]
    principal_to_user_id: HashMap<Principal, UserId>,
    #[serde(skip)]
    user_referrals: HashMap<UserId, Vec<UserId>>,
    suspected_bots: BTreeSet<UserId>,
}

impl UserMap {
    pub fn does_username_exist(&self, username: &str) -> bool {
        self.username_to_user_id.contains_key(username)
    }

    pub fn ensure_unique_username(&self, username: &str) -> Result<(), String> {
        if !self.username_to_user_id.contains_key(username) {
            return Ok(());
        }

        // Append the lowest number (starting from 2) which will make this username unique
        let mut suffix = 2;
        loop {
            let u = format!("{username}{suffix}");
            if !self.username_to_user_id.contains_key(&u) {
                return Err(u);
            }
            suffix += 1;
        }
    }

    #[allow(clippy::too_many_arguments)]
    pub fn register(
        &mut self,
        principal: Principal,
        user_id: UserId,
        username: String,
        display_name: Option<String>,
        now: TimestampMillis,
        referred_by: Option<UserId>,
        is_bot: bool,
    ) {
        self.username_to_user_id.insert(&username, user_id);
        self.principal_to_user_id.insert(principal, user_id);

        let user = User::new(principal, user_id, username, display_name, now, referred_by, is_bot);
        self.users.insert(user_id, user);

        if let Some(ref_by) = referred_by {
            self.user_referrals.entry(ref_by).or_default().push(user_id);
        }
    }

    pub fn update(&mut self, mut user: User, now: TimestampMillis) -> UpdateUserResult {
        let user_id = user.user_id;

        if let Some(previous) = self.users.get(&user_id) {
            let previous_principal = previous.principal;
            let principal = user.principal;
            let principal_changed = previous_principal != principal;

            let previous_username = &previous.username;
            let username = &user.username;
            let username_case_insensitive_changed = previous_username.to_uppercase() != username.to_uppercase();

            if principal_changed && self.principal_to_user_id.contains_key(&principal) {
                return UpdateUserResult::PrincipalTaken;
            }

            if username_case_insensitive_changed && self.does_username_exist(username) {
                return UpdateUserResult::UsernameTaken;
            }

            // Checks are complete, now update the data

            user.date_updated = now;

            if principal_changed {
                self.principal_to_user_id.remove(&previous_principal);
                self.principal_to_user_id.insert(principal, user_id);
            }

            if username_case_insensitive_changed {
                self.username_to_user_id.remove(previous_username);
                self.username_to_user_id.insert(username, user_id);
            }

            self.users.insert(user_id, user);
            UpdateUserResult::Success
        } else {
            UpdateUserResult::UserNotFound
        }
    }

    pub fn get(&self, user_id_or_principal: &Principal) -> Option<&User> {
        let user_id = self
            .principal_to_user_id
            .get(user_id_or_principal)
            .copied()
            .unwrap_or_else(|| UserId::from(*user_id_or_principal));

        self.users.get(&user_id)
    }

    pub fn get_by_principal(&self, principal: &Principal) -> Option<&User> {
        self.principal_to_user_id.get(principal).and_then(|u| self.users.get(u))
    }

    pub fn get_by_user_id(&self, user_id: &UserId) -> Option<&User> {
        self.users.get(user_id)
    }

    pub fn get_by_username(&self, username: &str) -> Option<&User> {
        self.username_to_user_id.get(username).and_then(|u| self.users.get(u))
    }

    pub fn diamond_membership_details_mut(&mut self, user_id: &UserId) -> Option<&mut DiamondMembershipDetailsInternal> {
        self.users.get_mut(user_id).map(|u| &mut u.diamond_membership_details)
    }

    pub fn mark_updated(&mut self, user_id: &UserId, now: TimestampMillis) {
        if let Some(user) = self.users.get_mut(user_id) {
            user.date_updated = now;
        }
    }

    pub fn mark_cycles_top_up(&mut self, user_id: &UserId, top_up: CyclesTopUp) -> bool {
        if let Some(user) = self.users.get_mut(user_id) {
            user.mark_cycles_top_up(top_up);
            true
        } else {
            false
        }
    }

    pub fn set_avatar_id(&mut self, user_id: &UserId, avatar_id: Option<u128>, now: TimestampMillis) -> bool {
        if let Some(user) = self.users.get_mut(user_id) {
            user.set_avatar_id(avatar_id, now);
            true
        } else {
            false
        }
    }

    pub fn suspend_user(
        &mut self,
        user_id: &UserId,
        duration: Option<Milliseconds>,
        reason: String,
        suspended_by: UserId,
        now: TimestampMillis,
    ) -> bool {
        if let Some(user) = self.users.get_mut(user_id) {
            user.suspension_details = Some(SuspensionDetails {
                timestamp: now,
                duration: duration.map_or(SuspensionDuration::Indefinitely, SuspensionDuration::Duration),
                reason,
                suspended_by,
            });
            true
        } else {
            false
        }
    }

    pub fn unsuspend_user(&mut self, user_id: &UserId) -> bool {
        if let Some(user) = self.users.get_mut(user_id) {
            user.suspension_details = None;
            true
        } else {
            false
        }
    }

    pub fn is_user_suspended(&self, user_id: &UserId) -> Option<bool> {
        self.users.get(user_id).map(|u| u.suspension_details.is_some())
    }

    pub fn search(&self, term: &str) -> impl Iterator<Item = (&User, bool)> {
        self.username_to_user_id
            .search(term)
            .filter_map(move |(uid, p)| self.users.get(uid).map(|u| (u, p)))
    }

    pub fn iter(&self) -> impl Iterator<Item = &User> {
        self.users.values()
    }

    pub fn len(&self) -> usize {
        self.users.len()
    }

    pub fn referrals(&self, user_id: &UserId) -> Vec<UserId> {
        self.user_referrals.get(user_id).map_or(Vec::new(), |refs| refs.clone())
    }

    pub fn mark_suspected_bot(&mut self, principal: &Principal) {
        if let Some(user_id) = self.principal_to_user_id.get(principal) {
            self.suspected_bots.insert(*user_id);
        }
    }

    pub fn suspected_bots(&self, after: Option<UserId>, count: usize) -> Vec<UserId> {
        if let Some(after) = after {
            self.suspected_bots.range(&after..).skip(1).take(count).copied().collect()
        } else {
            self.suspected_bots.iter().take(count).copied().collect()
        }
    }

    pub fn is_suspected_bot(&self, user_id: &UserId) -> bool {
        self.suspected_bots.contains(user_id)
    }

    pub fn diamond_metrics(&self, now: TimestampMillis) -> DiamondMembershipUserMetrics {
        let mut metrics = DiamondMembershipUserMetrics::default();
        for user in self.users.values().filter(|u| u.diamond_membership_details.is_active(now)) {
            metrics.total += 1;
            if user.diamond_membership_details.is_recurring() {
                metrics.recurring += 1;
            }
        }
        metrics
    }

    pub fn set_moderation_flags_enabled(&mut self, caller: &Principal, moderation_flags_enabled: u32) -> bool {
        if let Some(user) = self.principal_to_user_id.get(caller).and_then(|u| self.users.get_mut(u)) {
            user.moderation_flags_enabled = moderation_flags_enabled;
            true
        } else {
            false
        }
    }

    #[cfg(test)]
    pub fn add_test_user(&mut self, user: User) {
        let date_created = user.date_created;
        self.register(
            user.principal,
            user.user_id,
            user.username.clone(),
            user.display_name.clone(),
            user.date_created,
            None,
            false,
        );
        self.update(user, date_created);
    }
}

#[derive(Debug)]
pub enum UpdateUserResult {
    Success,
    PrincipalTaken,
    UsernameTaken,
    UserNotFound,
}

#[derive(Deserialize)]
struct UserMapTrimmed {
    users: HashMap<UserId, User>,
    suspected_bots: BTreeSet<UserId>,
}

impl From<UserMapTrimmed> for UserMap {
    fn from(value: UserMapTrimmed) -> Self {
        let mut user_map = UserMap {
            users: value.users,
            suspected_bots: value.suspected_bots,
            ..Default::default()
        };

        for (user_id, user) in user_map.users.iter() {
            if let Some(referred_by) = user.referred_by {
                user_map.user_referrals.entry(referred_by).or_default().push(*user_id);
            }

            user_map.username_to_user_id.insert(&user.username, *user_id);
            user_map.principal_to_user_id.insert(user.principal, *user_id);
        }

        user_map
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use itertools::Itertools;

    #[test]
    fn register_with_no_clashes() {
        let mut user_map = UserMap::default();
        let principal1 = Principal::from_slice(&[1]);
        let principal2 = Principal::from_slice(&[2]);
        let principal3 = Principal::from_slice(&[3]);

        let username1 = "1".to_string();
        let username2 = "2".to_string();
        let username3 = "3".to_string();

        let user_id1: UserId = Principal::from_slice(&[3, 1]).into();
        let user_id2: UserId = Principal::from_slice(&[3, 2]).into();
        let user_id3: UserId = Principal::from_slice(&[3, 3]).into();

        user_map.register(principal1, user_id1, username1.clone(), None, 1, None, false);
        user_map.register(principal2, user_id2, username2.clone(), None, 2, None, false);
        user_map.register(principal3, user_id3, username3.clone(), None, 3, None, false);

        let principal_to_user_id: Vec<_> = user_map
            .principal_to_user_id
            .iter()
            .map(|(p, u)| (*p, *u))
            .sorted_by_key(|(_, u)| *u)
            .collect();
        let username_to_user_id: Vec<_> = user_map
            .username_to_user_id
            .iter()
            .map(|(name, u)| (name.clone(), *u))
            .sorted_by_key(|(_, u)| *u)
            .collect();

        assert_eq!(user_map.users.len(), 3);

        assert_eq!(
            username_to_user_id,
            vec!((username1, user_id1), (username2, user_id2), (username3, user_id3))
        );
        assert_eq!(
            principal_to_user_id,
            vec!((principal1, user_id1), (principal2, user_id2), (principal3, user_id3))
        );
    }

    #[test]
    fn update_with_no_clashes() {
        let mut user_map = UserMap::default();
        let principal = Principal::from_slice(&[1]);

        let username1 = "1".to_string();
        let username2 = "2".to_string();

        let user_id = Principal::from_slice(&[1, 1]).into();

        user_map.register(principal, user_id, username1, None, 1, None, false);

        if let Some(original) = user_map.get_by_principal(&principal) {
            let mut updated = original.clone();
            updated.username = username2.clone();

            assert!(matches!(user_map.update(updated, 3), UpdateUserResult::Success));

            assert_eq!(user_map.users.keys().collect_vec(), vec!(&user_id));
            assert_eq!(user_map.username_to_user_id.len(), 1);
            assert!(user_map.username_to_user_id.contains_key(&username2));
            assert_eq!(user_map.principal_to_user_id.keys().collect_vec(), vec!(&principal));
        }
    }

    #[test]
    fn update_with_clashing_username() {
        let mut user_map = UserMap::default();
        let principal1 = Principal::from_slice(&[1]);
        let principal2 = Principal::from_slice(&[2]);

        let username1 = "1".to_string();
        let username2 = "2".to_string();

        let user_id1 = Principal::from_slice(&[1, 1]).into();
        let user_id2 = Principal::from_slice(&[2, 2]).into();

        let original = User {
            principal: principal1,
            user_id: user_id1,
            username: username1,
            date_created: 1,
            date_updated: 1,
            ..Default::default()
        };

        let other = User {
            principal: principal2,
            user_id: user_id2,
            username: username2.clone(),
            date_created: 2,
            date_updated: 2,
            ..Default::default()
        };

        let mut updated = original.clone();
        updated.username = username2;

        user_map.add_test_user(original);
        user_map.add_test_user(other);
        assert!(matches!(user_map.update(updated, 3), UpdateUserResult::UsernameTaken));
    }

    #[test]
    fn update_username_change_casing() {
        let mut user_map = UserMap::default();
        let principal = Principal::from_slice(&[1]);
        let username = "abc".to_string();
        let user_id = Principal::from_slice(&[1, 1]).into();

        let original = User {
            principal,
            user_id,
            username,
            date_created: 1,
            date_updated: 1,
            ..Default::default()
        };

        let mut updated = original.clone();

        user_map.add_test_user(original);
        updated.username = "ABC".to_string();

        assert!(matches!(user_map.update(updated, 2), UpdateUserResult::Success));
    }
}
