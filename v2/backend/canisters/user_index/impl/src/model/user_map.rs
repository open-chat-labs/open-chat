use crate::model::user::User;
use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use std::collections::hash_map::Entry::Vacant;
use std::collections::{HashMap, HashSet};
use types::{CyclesTopUp, Milliseconds, PhoneNumber, TimestampMillis, Timestamped, UserId};
use utils::case_insensitive_hash_map::CaseInsensitiveHashMap;
use utils::time::{DAY_IN_MS, HOUR_IN_MS, MINUTE_IN_MS, WEEK_IN_MS};

const FIVE_MINUTES_IN_MS: Milliseconds = MINUTE_IN_MS * 5;
const THIRTY_DAYS_IN_MS: Milliseconds = DAY_IN_MS * 30;
const REMOVE_EXPIRED_PHONE_NUMBERS_INTERVAL_MS: Milliseconds = MINUTE_IN_MS * 15;

#[derive(Serialize, Deserialize, Default)]
pub struct UserMap {
    users_by_principal: HashMap<Principal, User>,
    phone_number_to_principal: HashMap<PhoneNumber, Principal>,
    username_to_principal: CaseInsensitiveHashMap<Principal>,
    user_id_to_principal: HashMap<UserId, Principal>,
    #[serde(default)]
    users_with_unconfirmed_phone_numbers: HashSet<Principal>,
    cached_metrics: Timestamped<Metrics>,
    #[serde(default)]
    expired_phone_numbers_last_removed: TimestampMillis,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Default, Debug)]
pub struct Metrics {
    pub users_unconfirmed: u32,
    pub users_confirmed: u32,
    pub users_created: u64,
    pub users_deleted: u64,
    pub users_online_5_minutes: u32,
    pub users_online_1_hour: u32,
    pub users_online_1_week: u32,
    pub users_online_1_month: u32,
    pub canister_upgrades_in_progress: u32,
}

impl UserMap {
    pub fn add(&mut self, user: User) -> AddUserResult {
        let principal = user.get_principal();
        let maybe_phone_number = user.get_phone_number();
        let maybe_username = user.get_username();
        let maybe_user_id = user.get_user_id();

        if let Vacant(principal_entry) = self.users_by_principal.entry(principal) {
            if maybe_phone_number.is_some() && self.phone_number_to_principal.contains_key(maybe_phone_number.unwrap()) {
                AddUserResult::PhoneNumberTaken
            } else if maybe_username.is_some() && self.username_to_principal.contains_key(maybe_username.unwrap()) {
                AddUserResult::UsernameTaken
            } else {
                if let Some(phone_number) = maybe_phone_number {
                    self.phone_number_to_principal.insert(phone_number.clone(), principal);
                }
                if let Some(username) = maybe_username {
                    self.username_to_principal.insert(username, principal);
                }
                if let Some(user_id) = maybe_user_id {
                    self.user_id_to_principal.insert(user_id, principal);
                }

                if maybe_phone_number.is_some() && matches!(user, User::Unconfirmed(_)) {
                    self.users_with_unconfirmed_phone_numbers.insert(principal);
                }
                principal_entry.insert(user);
                AddUserResult::Success
            }
        } else {
            AddUserResult::AlreadyExists
        }
    }

    pub fn update(&mut self, user: User) -> UpdateUserResult {
        let principal = user.get_principal();

        if let Some(previous) = self.users_by_principal.get(&principal) {
            let previous_phone_number = previous.get_phone_number();
            let phone_number = user.get_phone_number();
            let phone_number_changed = previous_phone_number != phone_number;

            let previous_username = previous.get_username();
            let username = user.get_username();
            let username_case_insensitive_changed =
                username.is_some() && previous_username.map(|u| u.to_uppercase()) != username.map(|u| u.to_uppercase());

            let previous_user_id = previous.get_user_id();
            let user_id = user.get_user_id();
            let user_id_changed = previous_user_id != user_id;

            if phone_number_changed {
                if let Some(phone_number) = phone_number {
                    if self.phone_number_to_principal.contains_key(phone_number) {
                        return UpdateUserResult::PhoneNumberTaken;
                    }
                }
            }

            if username_case_insensitive_changed && self.username_to_principal.contains_key(username.unwrap()) {
                return UpdateUserResult::UsernameTaken;
            }

            if phone_number_changed {
                if let Some(previous_phone_number) = previous_phone_number {
                    self.phone_number_to_principal.remove(previous_phone_number);
                }
                if let Some(phone_number) = phone_number {
                    self.phone_number_to_principal.insert(phone_number.clone(), principal);
                }
            }

            if username_case_insensitive_changed {
                if let Some(val) = previous_username {
                    self.username_to_principal.remove(val);
                }
                if let Some(val) = username {
                    self.username_to_principal.insert(val, principal);
                }
            }

            if user_id_changed {
                if let Some(val) = previous_user_id {
                    self.user_id_to_principal.remove(&val);
                }
                if let Some(val) = user_id {
                    self.user_id_to_principal.insert(val, principal);
                }
            }

            if phone_number.is_some() && matches!(user, User::Unconfirmed(_)) {
                self.users_with_unconfirmed_phone_numbers.insert(principal);
            } else if previous_phone_number.is_some() && matches!(previous, User::Unconfirmed(_)) {
                self.users_with_unconfirmed_phone_numbers.remove(&principal);
            }
            self.users_by_principal.insert(principal, user);
            UpdateUserResult::Success
        } else {
            UpdateUserResult::UserNotFound
        }
    }

    pub fn mark_online(&mut self, principal: &Principal, now: TimestampMillis) -> bool {
        if let Some(User::Created(user)) = self.users_by_principal.get_mut(principal) {
            user.last_online = now;
            true
        } else {
            false
        }
    }

    pub fn get_by_principal(&self, principal: &Principal) -> Option<&User> {
        self.users_by_principal.get(principal)
    }

    pub fn get_by_user_id(&self, user_id: &UserId) -> Option<&User> {
        self.user_id_to_principal
            .get(user_id)
            .map(|p| self.users_by_principal.get(p))
            .flatten()
    }

    pub fn get_by_phone_number(&self, phone_number: &PhoneNumber) -> Option<&User> {
        self.phone_number_to_principal
            .get(phone_number)
            .map(|p| self.users_by_principal.get(p))
            .flatten()
    }

    #[allow(dead_code)]
    pub fn get_by_username(&self, username: &str) -> Option<&User> {
        self.username_to_principal
            .get(username)
            .map(|p| self.users_by_principal.get(p))
            .flatten()
    }

    pub fn is_valid_caller(&self, caller: Principal) -> bool {
        self.users_by_principal.contains_key(&caller) || self.user_id_to_principal.contains_key(&caller.into())
    }

    pub fn remove_by_principal(&mut self, principal: &Principal) -> Option<User> {
        if let Some(user) = self.users_by_principal.remove(principal) {
            if let Some(phone_number) = user.get_phone_number() {
                self.phone_number_to_principal.remove(phone_number);
            }

            if let Some(username) = user.get_username() {
                self.username_to_principal.remove(username);
            }
            if let Some(user_id) = user.get_user_id() {
                self.user_id_to_principal.remove(&user_id);
            }
            Some(user)
        } else {
            None
        }
    }

    pub fn mark_cycles_top_up(&mut self, user_id: &UserId, top_up: CyclesTopUp) -> bool {
        if let Some(principal) = self.user_id_to_principal.get(user_id) {
            if let Some(user) = self.users_by_principal.get_mut(principal) {
                return user.mark_cycles_top_up(top_up);
            }
        }
        false
    }

    pub fn set_avatar_id(&mut self, user_id: &UserId, avatar_id: u128, now: TimestampMillis) -> bool {
        if let Some(principal) = self.user_id_to_principal.get(user_id) {
            if let Some(user) = self.users_by_principal.get_mut(principal) {
                return user.set_avatar_id(avatar_id, now);
            }
        }

        false
    }

    pub fn search(&self, term: &str) -> impl Iterator<Item = &User> {
        self.username_to_principal
            .search(term)
            .filter_map(move |p| self.users_by_principal.get(p))
    }

    // Remove phone numbers whose confirmation codes have expired, if that leaves a user record
    // empty, remove the user record. This frees up memory and also allows phone numbers to be
    // reused.
    // This will only execute once every 15 minutes.
    // Returns true if the process ran, else false
    pub fn remove_expired_phone_numbers_if_required(&mut self, now: TimestampMillis) -> bool {
        if now.saturating_sub(self.expired_phone_numbers_last_removed) > REMOVE_EXPIRED_PHONE_NUMBERS_INTERVAL_MS {
            // Find all the users with expired phone numbers
            let to_remove: Vec<_> = self
                .users_with_unconfirmed_phone_numbers
                .iter()
                .filter_map(|u| self.users_by_principal.get(u))
                .filter_map(|u| if let User::Unconfirmed(user) = u { Some(user) } else { None })
                .filter(|u| u.phone_number.as_ref().map_or(true, |p| p.has_code_expired(now)))
                .cloned()
                .collect();

            for mut user in to_remove {
                self.users_with_unconfirmed_phone_numbers.remove(&user.principal);

                if user.wallet.is_none() {
                    self.remove_by_principal(&user.principal);
                } else {
                    user.phone_number = None;
                    self.update(User::Unconfirmed(user));
                }
            }
            self.expired_phone_numbers_last_removed = now;
            true
        } else {
            false
        }
    }

    pub fn metrics(&self) -> Metrics {
        self.cached_metrics.value.clone()
    }

    pub fn calculate_metrics(&mut self, now: TimestampMillis) {
        // Throttle to once every 5 minutes
        if now < self.cached_metrics.timestamp + FIVE_MINUTES_IN_MS {
            return;
        }

        let mut metrics = Metrics::default();

        for user in self.users_by_principal.values() {
            match user {
                User::Unconfirmed(_) => {
                    metrics.users_unconfirmed += 1;
                }
                User::Confirmed(_) => {
                    metrics.users_confirmed += 1;
                }
                User::Created(u) => {
                    metrics.users_created += 1;
                    if u.last_online > now - FIVE_MINUTES_IN_MS {
                        metrics.users_online_5_minutes += 1;
                    }
                    if u.last_online > now - HOUR_IN_MS {
                        metrics.users_online_1_hour += 1;
                    }
                    if u.last_online > now - WEEK_IN_MS {
                        metrics.users_online_1_week += 1;
                    }
                    if u.last_online > now - THIRTY_DAYS_IN_MS {
                        metrics.users_online_1_month += 1;
                    }
                    if u.upgrade_in_progress {
                        metrics.canister_upgrades_in_progress += 1;
                    }
                }
            }
        }

        self.cached_metrics = Timestamped::new(metrics, now);
    }

    pub fn iter(&self) -> impl Iterator<Item = &User> {
        self.users_by_principal.values()
    }

    pub fn len(&self) -> usize {
        self.users_by_principal.len()
    }
}

pub enum AddUserResult {
    Success,
    AlreadyExists,
    PhoneNumberTaken,
    UsernameTaken,
}

#[derive(Debug)]
pub enum UpdateUserResult {
    Success,
    PhoneNumberTaken,
    UsernameTaken,
    UserNotFound,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::user::{ConfirmedUser, CreatedUser, UnconfirmedPhoneNumber, UnconfirmedUser};
    use crate::CONFIRMATION_CODE_EXPIRY_MILLIS;
    use itertools::Itertools;
    use types::CanisterCreationStatusInternal;

    #[test]
    fn add_with_no_clashes() {
        let mut user_map = UserMap::default();
        let principal1 = Principal::from_slice(&[1]);
        let principal2 = Principal::from_slice(&[2]);
        let principal3 = Principal::from_slice(&[3]);

        let phone_number1 = PhoneNumber::new(44, "1111 111 111".to_owned());
        let phone_number2 = PhoneNumber::new(44, "2222 222 222".to_owned());
        let phone_number3 = PhoneNumber::new(44, "3333 333 333".to_owned());

        let username2 = "2".to_string();
        let username3 = "3".to_string();

        let user_id2: UserId = Principal::from_slice(&[2, 2]).into();
        let user_id3: UserId = Principal::from_slice(&[3, 3]).into();

        let unconfirmed = User::Unconfirmed(UnconfirmedUser {
            principal: principal1,
            phone_number: Some(UnconfirmedPhoneNumber {
                phone_number: phone_number1.clone(),
                confirmation_code: "1".to_string(),
                date_generated: 1,
                sms_messages_sent: 1,
            }),
            wallet: None,
        });
        user_map.add(unconfirmed.clone());

        let confirmed = User::Confirmed(ConfirmedUser {
            principal: principal2,
            phone_number: Some(phone_number2.clone()),
            username: Some(username2.clone()),
            canister_creation_status: CanisterCreationStatusInternal::Pending(Some(user_id2.into())),
            upgrade_in_progress: false,
            date_confirmed: 2,
        });
        user_map.add(confirmed.clone());

        let created = User::Created(CreatedUser {
            principal: principal3,
            phone_number: Some(phone_number3.clone()),
            user_id: user_id3,
            username: username3.clone(),
            date_created: 3,
            date_updated: 3,
            last_online: 1,
            ..Default::default()
        });
        user_map.add(created.clone());

        let users_by_principal: Vec<_> = user_map
            .users_by_principal
            .iter()
            .map(|(p, u)| (p.clone(), u.clone()))
            .sorted_by_key(|(p, _)| *p)
            .collect();
        let phone_number_to_principal: Vec<_> = user_map
            .phone_number_to_principal
            .iter()
            .map(|(ph, p)| (ph.clone(), p.clone()))
            .sorted_by_key(|(_, p)| *p)
            .collect();
        let user_id_to_principal: Vec<_> = user_map
            .user_id_to_principal
            .iter()
            .map(|(u, p)| (u.clone(), p.clone()))
            .sorted_by_key(|(_, p)| *p)
            .collect();

        assert_eq!(
            users_by_principal,
            vec!((principal1, unconfirmed), (principal2, confirmed), (principal3, created))
        );
        assert_eq!(
            phone_number_to_principal,
            vec!(
                (phone_number1, principal1),
                (phone_number2, principal2),
                (phone_number3, principal3)
            )
        );
        assert_eq!(user_map.username_to_principal.len(), 2);
        assert_eq!(user_map.username_to_principal.get(&username2), Some(&principal2));
        assert_eq!(user_map.username_to_principal.get(&username3), Some(&principal3));
        assert_eq!(user_id_to_principal, vec!((user_id2, principal2), (user_id3, principal3)));
    }

    #[test]
    fn add_with_clashing_principal() {
        let mut user_map = UserMap::default();
        let principal = Principal::from_slice(&[1]);

        let phone_number1 = PhoneNumber::new(44, "1111 111 111".to_owned());
        let phone_number2 = PhoneNumber::new(44, "2222 222 222".to_owned());

        let user_id: UserId = Principal::from_slice(&[1, 1]).into();

        let unconfirmed = User::Unconfirmed(UnconfirmedUser {
            principal,
            phone_number: Some(UnconfirmedPhoneNumber {
                phone_number: phone_number1.clone(),
                confirmation_code: "1".to_string(),
                date_generated: 1,
                sms_messages_sent: 1,
            }),
            wallet: None,
        });
        user_map.add(unconfirmed);

        let confirmed = User::Confirmed(ConfirmedUser {
            principal,
            phone_number: Some(phone_number2.clone()),
            username: Some("2".to_string()),
            canister_creation_status: CanisterCreationStatusInternal::Pending(Some(user_id.into())),
            upgrade_in_progress: false,
            date_confirmed: 2,
        });
        assert!(matches!(user_map.add(confirmed), AddUserResult::AlreadyExists));
        assert_eq!(user_map.users_by_principal.len(), 1);
    }

    #[test]
    fn add_with_clashing_phone_number() {
        let mut user_map = UserMap::default();
        let principal1 = Principal::from_slice(&[1]);
        let principal2 = Principal::from_slice(&[2]);

        let phone_number = PhoneNumber::new(44, "1111 111 111".to_owned());

        let user_id = Principal::from_slice(&[2, 2]).into();

        let unconfirmed = User::Unconfirmed(UnconfirmedUser {
            principal: principal1,
            phone_number: Some(UnconfirmedPhoneNumber {
                phone_number: phone_number.clone(),
                confirmation_code: "1".to_string(),
                date_generated: 1,
                sms_messages_sent: 1,
            }),
            wallet: None,
        });
        user_map.add(unconfirmed);

        let confirmed = User::Confirmed(ConfirmedUser {
            principal: principal2,
            phone_number: Some(phone_number),
            username: Some("2".to_string()),
            canister_creation_status: CanisterCreationStatusInternal::Pending(Some(user_id).into()),
            upgrade_in_progress: false,
            date_confirmed: 2,
        });
        assert!(matches!(user_map.add(confirmed), AddUserResult::PhoneNumberTaken));
        assert_eq!(user_map.users_by_principal.len(), 1);
    }

    #[test]
    fn add_with_clashing_username() {
        let mut user_map = UserMap::default();
        let principal1 = Principal::from_slice(&[1]);
        let principal2 = Principal::from_slice(&[2]);

        let phone_number1 = PhoneNumber::new(44, "1111 111 111".to_owned());
        let phone_number2 = PhoneNumber::new(44, "2222 222 222".to_owned());

        let user_id1 = Principal::from_slice(&[1, 1]).into();
        let user_id2 = Principal::from_slice(&[2, 2]).into();

        let username = "1".to_string();

        let confirmed = User::Confirmed(ConfirmedUser {
            principal: principal1,
            phone_number: Some(phone_number1),
            username: Some(username.clone()),
            canister_creation_status: CanisterCreationStatusInternal::Pending(Some(user_id1).into()),
            upgrade_in_progress: false,
            date_confirmed: 2,
        });
        user_map.add(confirmed);

        let created = User::Created(CreatedUser {
            principal: principal2,
            phone_number: Some(phone_number2),
            user_id: user_id2,
            username,
            date_created: 3,
            date_updated: 3,
            last_online: 3,
            ..Default::default()
        });
        assert!(matches!(user_map.add(created), AddUserResult::UsernameTaken));
        assert_eq!(user_map.users_by_principal.len(), 1);
    }

    #[test]
    fn add_with_case_insensitive_clashing_username() {
        let mut user_map = UserMap::default();
        let principal1 = Principal::from_slice(&[1]);
        let principal2 = Principal::from_slice(&[2]);

        let phone_number1 = PhoneNumber::new(44, "1111 111 111".to_owned());
        let phone_number2 = PhoneNumber::new(44, "2222 222 222".to_owned());

        let user_id1 = Principal::from_slice(&[1, 1]).into();
        let user_id2 = Principal::from_slice(&[2, 2]).into();

        let username1 = "abc".to_string();
        let username2 = "ABC".to_string();

        let confirmed = User::Confirmed(ConfirmedUser {
            principal: principal1,
            phone_number: Some(phone_number1),
            username: Some(username1),
            canister_creation_status: CanisterCreationStatusInternal::Pending(Some(user_id1).into()),
            upgrade_in_progress: false,
            date_confirmed: 2,
        });
        user_map.add(confirmed);

        let created = User::Created(CreatedUser {
            principal: principal2,
            phone_number: Some(phone_number2),
            user_id: user_id2,
            username: username2,
            date_created: 3,
            date_updated: 3,
            last_online: 3,
            ..Default::default()
        });
        assert!(matches!(user_map.add(created), AddUserResult::UsernameTaken));
        assert_eq!(user_map.users_by_principal.len(), 1);
    }

    #[test]
    fn update_with_no_clashes() {
        let mut user_map = UserMap::default();
        let principal = Principal::from_slice(&[1]);

        let phone_number1 = PhoneNumber::new(44, "1111 111 111".to_owned());
        let phone_number2 = PhoneNumber::new(44, "2222 222 222".to_owned());

        let username1 = "1".to_string();
        let username2 = "2".to_string();

        let user_id = Principal::from_slice(&[1, 1]).into();

        let original = CreatedUser {
            principal,
            phone_number: Some(phone_number1.clone()),
            user_id,
            username: username1.clone(),
            date_created: 1,
            date_updated: 1,
            last_online: 1,
            ..Default::default()
        };

        let mut updated = original.clone();
        updated.username = username2.clone();
        updated.phone_number = Some(phone_number2.clone());

        user_map.add(User::Created(original));
        assert!(matches!(user_map.update(User::Created(updated)), UpdateUserResult::Success));

        assert_eq!(user_map.users_by_principal.keys().collect_vec(), vec!(&principal));
        assert_eq!(user_map.phone_number_to_principal.keys().collect_vec(), vec!(&phone_number2));
        assert_eq!(user_map.username_to_principal.len(), 1);
        assert!(user_map.username_to_principal.contains_key(&username2));
        assert_eq!(user_map.user_id_to_principal.keys().collect_vec(), vec!(&user_id));
    }

    #[test]
    fn update_with_clashing_phone_number() {
        let mut user_map = UserMap::default();
        let principal1 = Principal::from_slice(&[1]);
        let principal2 = Principal::from_slice(&[2]);

        let phone_number1 = PhoneNumber::new(44, "1111 111 111".to_owned());
        let phone_number2 = PhoneNumber::new(44, "2222 222 222".to_owned());

        let username1 = "1".to_string();
        let username2 = "2".to_string();

        let user_id1 = Principal::from_slice(&[1, 1]).into();
        let user_id2 = Principal::from_slice(&[2, 2]).into();

        let original = CreatedUser {
            principal: principal1,
            phone_number: Some(phone_number1),
            user_id: user_id1,
            username: username1.clone(),
            date_created: 1,
            date_updated: 1,
            last_online: 1,
            ..Default::default()
        };

        let other = CreatedUser {
            principal: principal2,
            phone_number: Some(phone_number2.clone()),
            user_id: user_id2,
            username: username2.clone(),
            date_created: 2,
            date_updated: 2,
            last_online: 2,
            ..Default::default()
        };

        let mut updated = original.clone();
        updated.phone_number = Some(phone_number2);

        user_map.add(User::Created(original));
        user_map.add(User::Created(other));
        assert!(matches!(
            user_map.update(User::Created(updated)),
            UpdateUserResult::PhoneNumberTaken
        ));
    }

    #[test]
    fn update_with_clashing_username() {
        let mut user_map = UserMap::default();
        let principal1 = Principal::from_slice(&[1]);
        let principal2 = Principal::from_slice(&[2]);

        let phone_number1 = PhoneNumber::new(44, "1111 111 111".to_owned());
        let phone_number2 = PhoneNumber::new(44, "2222 222 222".to_owned());

        let username1 = "1".to_string();
        let username2 = "2".to_string();

        let user_id1 = Principal::from_slice(&[1, 1]).into();
        let user_id2 = Principal::from_slice(&[2, 2]).into();

        let original = CreatedUser {
            principal: principal1,
            phone_number: Some(phone_number1),
            user_id: user_id1,
            username: username1.clone(),
            date_created: 1,
            date_updated: 1,
            last_online: 1,
            ..Default::default()
        };

        let other = CreatedUser {
            principal: principal2,
            phone_number: Some(phone_number2.clone()),
            user_id: user_id2,
            username: username2.clone(),
            date_created: 2,
            date_updated: 2,
            last_online: 2,
            ..Default::default()
        };

        let mut updated = original.clone();
        updated.username = username2;

        user_map.add(User::Created(original));
        user_map.add(User::Created(other));
        assert!(matches!(
            user_map.update(User::Created(updated)),
            UpdateUserResult::UsernameTaken
        ));
    }

    #[test]
    fn update_username_change_casing() {
        let mut user_map = UserMap::default();
        let principal = Principal::from_slice(&[1]);
        let phone_number = PhoneNumber::new(44, "1111 111 111".to_owned());
        let username = "abc".to_string();
        let user_id = Principal::from_slice(&[1, 1]).into();

        let original = CreatedUser {
            principal,
            phone_number: Some(phone_number),
            user_id: user_id,
            username: username.clone(),
            date_created: 1,
            date_updated: 1,
            last_online: 1,
            ..Default::default()
        };

        let mut updated = original.clone();

        user_map.add(User::Created(original));
        updated.username = "ABC".to_string();

        assert!(matches!(user_map.update(User::Created(updated)), UpdateUserResult::Success));
    }

    #[test]
    fn remove() {
        let mut user_map = UserMap::default();
        let principal1 = Principal::from_slice(&[1]);
        let principal2 = Principal::from_slice(&[2]);
        let principal3 = Principal::from_slice(&[3]);

        let phone_number1 = PhoneNumber::new(44, "1111 111 111".to_owned());
        let phone_number2 = PhoneNumber::new(44, "2222 222 222".to_owned());
        let phone_number3 = PhoneNumber::new(44, "3333 333 333".to_owned());

        let username2 = "2".to_string();
        let username3 = "3".to_string();

        let user_id2 = Principal::from_slice(&[2, 2]).into();
        let user_id3 = Principal::from_slice(&[3, 3]).into();

        let unconfirmed = User::Unconfirmed(UnconfirmedUser {
            principal: principal1,
            phone_number: Some(UnconfirmedPhoneNumber {
                phone_number: phone_number1.clone(),
                confirmation_code: "1".to_string(),
                date_generated: 1,
                sms_messages_sent: 1,
            }),
            wallet: None,
        });
        user_map.add(unconfirmed.clone());

        let confirmed = User::Confirmed(ConfirmedUser {
            principal: principal2,
            phone_number: Some(phone_number2.clone()),
            username: Some(username2.clone()),
            canister_creation_status: CanisterCreationStatusInternal::Pending(Some(user_id2).into()),
            upgrade_in_progress: false,
            date_confirmed: 2,
        });
        user_map.add(confirmed.clone());

        let created = User::Created(CreatedUser {
            principal: principal3,
            phone_number: Some(phone_number3.clone()),
            user_id: user_id3,
            username: username3.clone(),
            date_created: 3,
            date_updated: 3,
            last_online: 3,
            ..Default::default()
        });
        user_map.add(created.clone());

        user_map.remove_by_principal(&principal1);
        user_map.remove_by_principal(&principal2);
        user_map.remove_by_principal(&principal3);

        assert_eq!(user_map.users_by_principal.len(), 0);
        assert_eq!(user_map.phone_number_to_principal.len(), 0);
        assert_eq!(user_map.username_to_principal.len(), 0);
        assert_eq!(user_map.user_id_to_principal.len(), 0);
    }

    #[test]
    fn remove_expired_phone_numbers_runs_once_every_specified_interval() {
        let mut now = 1_000_000;
        let mut user_map = UserMap::default();
        assert!(user_map.remove_expired_phone_numbers_if_required(now));
        now += REMOVE_EXPIRED_PHONE_NUMBERS_INTERVAL_MS;
        assert!(!user_map.remove_expired_phone_numbers_if_required(now));
        now += 1;
        assert!(user_map.remove_expired_phone_numbers_if_required(now));
    }

    #[test]
    fn remove_expired_phone_numbers_only_removes_users_with_expired_codes() {
        let mut now = 1_000_000;
        let mut user_map = UserMap::default();
        assert!(user_map.remove_expired_phone_numbers_if_required(now));

        let principal1 = Principal::from_slice(&[1]);
        let principal2 = Principal::from_slice(&[2]);

        let phone_number1 = PhoneNumber::new(44, "1111 111 111".to_owned());
        let phone_number2 = PhoneNumber::new(44, "2222 222 222".to_owned());

        let user1 = User::Unconfirmed(UnconfirmedUser {
            principal: principal1,
            phone_number: Some(UnconfirmedPhoneNumber {
                phone_number: phone_number1,
                confirmation_code: "1".to_string(),
                date_generated: now,
                sms_messages_sent: 0,
            }),
            wallet: None,
        });

        now += 1;

        let user2 = User::Unconfirmed(UnconfirmedUser {
            principal: principal2,
            phone_number: Some(UnconfirmedPhoneNumber {
                phone_number: phone_number2,
                confirmation_code: "2".to_string(),
                date_generated: now,
                sms_messages_sent: 0,
            }),
            wallet: None,
        });

        user_map.add(user1);
        user_map.add(user2);

        now += CONFIRMATION_CODE_EXPIRY_MILLIS;

        assert!(user_map.remove_expired_phone_numbers_if_required(now));
        assert_eq!(user_map.users_by_principal.into_keys().collect_vec(), vec![principal2]);
    }

    #[test]
    fn remove_expired_phone_numbers_retains_users_with_wallets_set() {
        let mut now = 1_000_000;
        let mut user_map = UserMap::default();
        assert!(user_map.remove_expired_phone_numbers_if_required(now));

        let principal1 = Principal::from_slice(&[1]);
        let principal2 = Principal::from_slice(&[2]);

        let phone_number1 = PhoneNumber::new(44, "1111 111 111".to_owned());
        let phone_number2 = PhoneNumber::new(44, "2222 222 222".to_owned());

        let wallet1 = Principal::from_slice(&[1, 1]);

        let user1 = User::Unconfirmed(UnconfirmedUser {
            principal: principal1,
            phone_number: Some(UnconfirmedPhoneNumber {
                phone_number: phone_number1,
                confirmation_code: "1".to_string(),
                date_generated: now,
                sms_messages_sent: 0,
            }),
            wallet: Some(wallet1),
        });

        let user2 = User::Unconfirmed(UnconfirmedUser {
            principal: principal2,
            phone_number: Some(UnconfirmedPhoneNumber {
                phone_number: phone_number2,
                confirmation_code: "2".to_string(),
                date_generated: now,
                sms_messages_sent: 0,
            }),
            wallet: None,
        });

        user_map.add(user1);
        user_map.add(user2);

        now += CONFIRMATION_CODE_EXPIRY_MILLIS + 1;

        assert!(user_map.remove_expired_phone_numbers_if_required(now));
        assert_eq!(user_map.users_by_principal.into_keys().collect_vec(), vec![principal1]);
    }

    #[test]
    fn confirming_a_user_removes_principal_from_unconfirmed_phone_numbers_set() {
        let mut user_map = UserMap::default();
        let principal = Principal::from_slice(&[1]);
        let phone_number = PhoneNumber::new(44, "1111 111 111".to_owned());

        let unconfirmed = User::Unconfirmed(UnconfirmedUser {
            principal,
            phone_number: Some(UnconfirmedPhoneNumber {
                phone_number: phone_number.clone(),
                confirmation_code: "1".to_string(),
                date_generated: 1,
                sms_messages_sent: 1,
            }),
            wallet: None,
        });
        user_map.add(unconfirmed);

        assert_eq!(user_map.users_with_unconfirmed_phone_numbers.len(), 1);

        let confirmed = User::Confirmed(ConfirmedUser {
            principal,
            phone_number: Some(phone_number),
            username: None,
            date_confirmed: 1,
            canister_creation_status: CanisterCreationStatusInternal::Pending(None),
            upgrade_in_progress: false,
        });
        assert!(matches!(user_map.update(confirmed), UpdateUserResult::Success));
        assert!(user_map.users_with_unconfirmed_phone_numbers.is_empty());
    }
}
