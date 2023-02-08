use crate::model::account_billing::AccountCharge;
use crate::model::diamond_membership_details::DiamondMembershipDetailsInternal;
use crate::model::user::{PhoneStatus, SuspensionDetails, SuspensionDuration, UnconfirmedPhoneNumber, User};
use crate::{CONFIRMATION_CODE_EXPIRY_MILLIS, CONFIRMED_PHONE_NUMBER_STORAGE_ALLOWANCE};
use candid::Principal;
use serde::{Deserialize, Serialize};
use std::collections::{BTreeSet, HashMap, HashSet};
use types::{CyclesTopUp, Milliseconds, PhoneNumber, TimestampMillis, UserId, Version};
use utils::case_insensitive_hash_map::CaseInsensitiveHashMap;
use utils::time::MINUTE_IN_MS;

const PRUNE_UNCONFIRMED_PHONE_NUMBERS_INTERVAL_MS: Milliseconds = MINUTE_IN_MS * 15;

#[derive(Serialize, Deserialize, Default)]
#[serde(from = "UserMapTrimmed")]
pub struct UserMap {
    users: HashMap<UserId, User>,
    #[serde(skip)]
    phone_number_to_user_id: HashMap<PhoneNumber, UserId>,
    #[serde(skip)]
    username_to_user_id: CaseInsensitiveHashMap<UserId>,
    #[serde(skip)]
    principal_to_user_id: HashMap<Principal, UserId>,
    #[serde(skip)]
    users_with_unconfirmed_phone_numbers: HashSet<UserId>,
    unconfirmed_phone_numbers_last_pruned: TimestampMillis,
    reserved_usernames: HashSet<String>,
    #[serde(skip)]
    user_referrals: HashMap<UserId, Vec<UserId>>,
    suspected_bots: BTreeSet<UserId>,
}

impl UserMap {
    pub fn does_username_exist(&self, username: &str) -> bool {
        self.username_to_user_id.contains_key(username) || self.reserved_usernames.contains(username)
    }

    // Returns true if the username can be reserved or false if the username is taken
    pub fn reserve_username(&mut self, username: &str) -> bool {
        !self.username_to_user_id.contains_key(username) && self.reserved_usernames.insert(username.to_string())
    }

    pub fn release_username(&mut self, username: &str) {
        self.reserved_usernames.remove(username);
    }

    #[allow(clippy::too_many_arguments)]
    pub fn register(
        &mut self,
        principal: Principal,
        user_id: UserId,
        wasm_version: Version,
        username: String,
        now: TimestampMillis,
        referred_by: Option<UserId>,
        is_bot: bool,
    ) {
        self.username_to_user_id.insert(&username, user_id);
        self.principal_to_user_id.insert(principal, user_id);

        let user = User::new(principal, user_id, username, now, wasm_version, referred_by, is_bot);
        self.users.insert(user_id, user);

        if let Some(ref_by) = referred_by {
            self.user_referrals.entry(ref_by).or_default().push(user_id);
        }
    }

    pub fn update(&mut self, user: User) -> UpdateUserResult {
        let user_id = user.user_id;

        if let Some(previous) = self.users.get(&user_id) {
            let previous_principal = previous.principal;
            let principal = user.principal;
            let principal_changed = previous_principal != principal;

            let previous_phone_number = previous.phone_status.phone_number();
            let phone_number = user.phone_status.phone_number();
            let phone_number_changed = previous_phone_number != phone_number;

            let previous_username = &previous.username;
            let username = &user.username;
            let username_case_insensitive_changed = previous_username.to_uppercase() != username.to_uppercase();

            if principal_changed && self.principal_to_user_id.contains_key(&principal) {
                return UpdateUserResult::PrincipalTaken;
            }

            if phone_number_changed {
                if let Some(phone_number) = phone_number {
                    if self.phone_number_to_user_id.contains_key(phone_number) {
                        return UpdateUserResult::PhoneNumberTaken;
                    }
                }
            }

            if username_case_insensitive_changed && self.username_to_user_id.contains_key(username) {
                return UpdateUserResult::UsernameTaken;
            }

            // Checks are complete, now update the data

            if principal_changed {
                self.principal_to_user_id.remove(&previous_principal);
                self.principal_to_user_id.insert(principal, user_id);
            }

            if phone_number_changed {
                if let Some(previous_phone_number) = previous_phone_number {
                    self.phone_number_to_user_id.remove(previous_phone_number);
                }
                if let Some(phone_number) = phone_number {
                    self.phone_number_to_user_id.insert(phone_number.clone(), user_id);
                }
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

    pub fn submit_phone_number(
        &mut self,
        principal: Principal,
        phone_number: PhoneNumber,
        confirmation_code: String,
        now: TimestampMillis,
    ) -> SubmitPhoneNumberResult {
        if let Some(user) = self.principal_to_user_id.get(&principal).and_then(|u| self.users.get_mut(u)) {
            match &mut user.phone_status {
                PhoneStatus::Confirmed(_) => return SubmitPhoneNumberResult::AlreadyConfirmed,
                PhoneStatus::Unconfirmed(p) => {
                    if p.phone_number != phone_number {
                        if self.phone_number_to_user_id.contains_key(&phone_number) {
                            return SubmitPhoneNumberResult::PhoneNumberTaken;
                        }
                        self.phone_number_to_user_id.remove(&p.phone_number);
                        self.phone_number_to_user_id.insert(phone_number.clone(), user.user_id);
                    }
                    p.phone_number = phone_number;
                    p.sms_messages_sent += 1;
                    p.confirmation_code = confirmation_code;
                    p.valid_until = now + CONFIRMATION_CODE_EXPIRY_MILLIS;
                }
                PhoneStatus::None => {
                    if self.phone_number_to_user_id.contains_key(&phone_number) {
                        return SubmitPhoneNumberResult::PhoneNumberTaken;
                    }
                    self.phone_number_to_user_id.insert(phone_number.clone(), user.user_id);
                    user.phone_status = PhoneStatus::Unconfirmed(UnconfirmedPhoneNumber {
                        phone_number,
                        confirmation_code,
                        valid_until: now + CONFIRMATION_CODE_EXPIRY_MILLIS,
                        sms_messages_sent: 1,
                    });
                }
            }

            self.users_with_unconfirmed_phone_numbers.insert(user.user_id);
            SubmitPhoneNumberResult::Success
        } else {
            SubmitPhoneNumberResult::UserNotFound
        }
    }

    pub fn confirm_phone_number(
        &mut self,
        principal: Principal,
        confirmation_code: String,
        test_mode: bool,
        now: TimestampMillis,
    ) -> ConfirmPhoneNumberResult {
        if let Some(user) = self.principal_to_user_id.get(&principal).and_then(|u| self.users.get_mut(u)) {
            match &user.phone_status {
                PhoneStatus::Confirmed(_) => ConfirmPhoneNumberResult::AlreadyConfirmed,
                PhoneStatus::Unconfirmed(p) => {
                    let test_code = test_mode && confirmation_code == "123456";

                    if now > p.valid_until {
                        ConfirmPhoneNumberResult::CodeExpired
                    } else if (confirmation_code != p.confirmation_code) && !test_code {
                        ConfirmPhoneNumberResult::CodeIncorrect
                    } else {
                        let phone_number = p.phone_number.clone();
                        user.phone_status = PhoneStatus::Confirmed(phone_number.clone());
                        user.open_storage_limit_bytes += CONFIRMED_PHONE_NUMBER_STORAGE_ALLOWANCE;
                        ConfirmPhoneNumberResult::Success(ConfirmPhoneNumberSuccess {
                            user_id: user.user_id,
                            storage_added: CONFIRMED_PHONE_NUMBER_STORAGE_ALLOWANCE,
                            new_byte_limit: user.open_storage_limit_bytes,
                            phone_number,
                        })
                    }
                }
                // We remove unconfirmed phone numbers once their confirmation codes expire, so we
                // are not able to distinguish between a user who never submitted a phone number and
                // a user who's confirmation code has expired.
                PhoneStatus::None => ConfirmPhoneNumberResult::CodeExpired,
            }
        } else {
            ConfirmPhoneNumberResult::UserNotFound
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

    pub fn is_valid_caller(&self, caller: Principal) -> bool {
        self.principal_to_user_id.contains_key(&caller) || self.users.contains_key(&caller.into())
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

    pub fn record_account_charge(&mut self, user_id: &UserId, charge: AccountCharge) -> bool {
        if let Some(user) = self.users.get_mut(user_id) {
            user.account_billing.add_charge(charge);
            true
        } else {
            false
        }
    }

    pub fn set_storage_limit(&mut self, user_id: &UserId, bytes: u64) -> bool {
        if let Some(user) = self.users.get_mut(user_id) {
            user.open_storage_limit_bytes = bytes;
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

    pub fn search(&self, term: &str) -> impl Iterator<Item = (&User, bool)> {
        self.username_to_user_id
            .search(term)
            .filter_map(move |(uid, p)| self.users.get(uid).map(|u| (u, p)))
    }

    // Remove unconfirmed phone numbers whose confirmation codes have expired, this frees up memory
    // and also allows the phone numbers to be reused.
    // This will only execute once every 15 minutes.
    pub fn prune_unconfirmed_phone_numbers_if_required(&mut self, now: TimestampMillis) -> Option<usize> {
        if now > self.unconfirmed_phone_numbers_last_pruned + PRUNE_UNCONFIRMED_PHONE_NUMBERS_INTERVAL_MS {
            let mut removed = Vec::new();

            for user_id in self.users_with_unconfirmed_phone_numbers.iter() {
                if let Some(user) = self.users.get_mut(user_id) {
                    if let PhoneStatus::Unconfirmed(p) = &mut user.phone_status {
                        if now > p.valid_until {
                            self.phone_number_to_user_id.remove(&p.phone_number);
                            user.phone_status = PhoneStatus::None;
                            removed.push(user.user_id);
                        }
                    }
                }
            }

            for user_id in removed.iter() {
                self.users_with_unconfirmed_phone_numbers.remove(user_id);
            }
            self.unconfirmed_phone_numbers_last_pruned = now;
            Some(removed.len())
        } else {
            None
        }
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

    #[cfg(test)]
    pub fn add_test_user(&mut self, user: User) {
        self.register(
            user.principal,
            user.user_id,
            user.wasm_version,
            user.username.clone(),
            user.date_created,
            None,
            false,
        );
        self.update(user);
    }
}

#[derive(Debug)]
pub enum UpdateUserResult {
    Success,
    PrincipalTaken,
    PhoneNumberTaken,
    UsernameTaken,
    UserNotFound,
}

pub enum SubmitPhoneNumberResult {
    Success,
    PhoneNumberTaken,
    AlreadyConfirmed,
    UserNotFound,
}

pub enum ConfirmPhoneNumberResult {
    Success(ConfirmPhoneNumberSuccess),
    CodeExpired,
    CodeIncorrect,
    AlreadyConfirmed,
    UserNotFound,
}

pub struct ConfirmPhoneNumberSuccess {
    pub user_id: UserId,
    pub storage_added: u64,
    pub new_byte_limit: u64,
    pub phone_number: PhoneNumber,
}

#[derive(Deserialize)]
struct UserMapTrimmed {
    users: HashMap<UserId, User>,
    unconfirmed_phone_numbers_last_pruned: TimestampMillis,
    reserved_usernames: HashSet<String>,
    suspected_bots: BTreeSet<UserId>,
}

impl From<UserMapTrimmed> for UserMap {
    fn from(value: UserMapTrimmed) -> Self {
        let mut user_map = UserMap {
            users: value.users,
            unconfirmed_phone_numbers_last_pruned: value.unconfirmed_phone_numbers_last_pruned,
            reserved_usernames: value.reserved_usernames,
            suspected_bots: value.suspected_bots,
            ..Default::default()
        };

        for (user_id, user) in user_map.users.iter() {
            match &user.phone_status {
                PhoneStatus::Confirmed(p) => {
                    user_map.phone_number_to_user_id.insert(p.clone(), *user_id);
                }
                PhoneStatus::Unconfirmed(p) => {
                    user_map.phone_number_to_user_id.insert(p.phone_number.clone(), *user_id);
                    user_map.users_with_unconfirmed_phone_numbers.insert(*user_id);
                }
                _ => {}
            };

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
    use crate::model::user::{PhoneStatus, User};
    use itertools::Itertools;

    #[test]
    fn register_with_no_clashes() {
        let mut user_map = UserMap::default();
        let principal1 = Principal::from_slice(&[1]);
        let principal2 = Principal::from_slice(&[2]);
        let principal3 = Principal::from_slice(&[3]);

        let phone_number3 = PhoneNumber::new(44, "3333 333 333".to_owned());

        let username1 = "1".to_string();
        let username2 = "2".to_string();
        let username3 = "3".to_string();

        let user_id1: UserId = Principal::from_slice(&[3, 1]).into();
        let user_id2: UserId = Principal::from_slice(&[3, 2]).into();
        let user_id3: UserId = Principal::from_slice(&[3, 3]).into();

        user_map.register(principal1, user_id1, Version::new(0, 0, 0), username1.clone(), 1, None, false);
        user_map.register(principal2, user_id2, Version::new(0, 0, 0), username2.clone(), 2, None, false);
        user_map.register(principal3, user_id3, Version::new(0, 0, 0), username3.clone(), 3, None, false);
        user_map.submit_phone_number(principal3, phone_number3.clone(), "123".to_string(), 4);

        let phone_number_to_user_id: Vec<_> = user_map
            .phone_number_to_user_id
            .iter()
            .map(|(ph, u)| (ph.clone(), u.clone()))
            .sorted_by_key(|(_, u)| *u)
            .collect();
        let principal_to_user_id: Vec<_> = user_map
            .principal_to_user_id
            .iter()
            .map(|(p, u)| (p.clone(), u.clone()))
            .sorted_by_key(|(_, u)| *u)
            .collect();
        let username_to_user_id: Vec<_> = user_map
            .username_to_user_id
            .iter()
            .map(|(name, u)| (name.clone(), u.clone()))
            .sorted_by_key(|(_, u)| *u)
            .collect();

        assert_eq!(user_map.users.len(), 3);

        assert_eq!(phone_number_to_user_id, vec!((phone_number3, user_id3)));
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
    fn submit_phone_number_with_clashing_phone_number() {
        let mut user_map = UserMap::default();
        let principal1 = Principal::from_slice(&[1]);
        let principal2 = Principal::from_slice(&[2]);

        let user_id1 = Principal::from_slice(&[1, 1]).into();
        let user_id2 = Principal::from_slice(&[2, 2]).into();

        let phone_number = PhoneNumber::new(44, "1111 111 111".to_owned());

        user_map.register(principal1, user_id1, Version::new(0, 0, 0), "1".to_string(), 1, None, false);
        user_map.submit_phone_number(principal1, phone_number.clone(), "123".to_string(), 2);
        user_map.register(principal2, user_id2, Version::new(0, 0, 0), "2".to_string(), 3, None, false);

        assert!(matches!(
            user_map.submit_phone_number(principal2, phone_number, "123".to_string(), 4),
            SubmitPhoneNumberResult::PhoneNumberTaken
        ));
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

        user_map.register(principal, user_id, Version::new(0, 0, 0), username1, 1, None, false);
        user_map.submit_phone_number(principal, phone_number1, "123".to_string(), 2);

        if let Some(original) = user_map.get_by_principal(&principal) {
            let mut updated = original.clone();
            updated.username = username2.clone();
            updated.phone_status = PhoneStatus::Confirmed(phone_number2.clone());

            assert!(matches!(user_map.update(updated), UpdateUserResult::Success));

            assert_eq!(user_map.users.keys().collect_vec(), vec!(&user_id));
            assert_eq!(user_map.phone_number_to_user_id.keys().collect_vec(), vec!(&phone_number2));
            assert_eq!(user_map.username_to_user_id.len(), 1);
            assert!(user_map.username_to_user_id.contains_key(&username2));
            assert_eq!(user_map.principal_to_user_id.keys().collect_vec(), vec!(&principal));
        }
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

        let original = User {
            principal: principal1,
            phone_status: PhoneStatus::Confirmed(phone_number1),
            user_id: user_id1,
            username: username1.clone(),
            date_created: 1,
            date_updated: 1,
            ..Default::default()
        };

        let other = User {
            principal: principal2,
            phone_status: PhoneStatus::Confirmed(phone_number2.clone()),
            user_id: user_id2,
            username: username2.clone(),
            date_created: 2,
            date_updated: 2,
            ..Default::default()
        };

        let mut updated = original.clone();
        updated.phone_status = PhoneStatus::Confirmed(phone_number2);

        user_map.add_test_user(original);
        user_map.add_test_user(other);
        assert!(matches!(user_map.update(updated), UpdateUserResult::PhoneNumberTaken));
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

        let original = User {
            principal: principal1,
            phone_status: PhoneStatus::Confirmed(phone_number1),
            user_id: user_id1,
            username: username1.clone(),
            date_created: 1,
            date_updated: 1,
            ..Default::default()
        };

        let other = User {
            principal: principal2,
            phone_status: PhoneStatus::Confirmed(phone_number2.clone()),
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
        assert!(matches!(user_map.update(updated), UpdateUserResult::UsernameTaken));
    }

    #[test]
    fn update_username_change_casing() {
        let mut user_map = UserMap::default();
        let principal = Principal::from_slice(&[1]);
        let phone_number = PhoneNumber::new(44, "1111 111 111".to_owned());
        let username = "abc".to_string();
        let user_id = Principal::from_slice(&[1, 1]).into();

        let original = User {
            principal,
            phone_status: PhoneStatus::Confirmed(phone_number),
            user_id: user_id,
            username: username.clone(),
            date_created: 1,
            date_updated: 1,
            ..Default::default()
        };

        let mut updated = original.clone();

        user_map.add_test_user(original);
        updated.username = "ABC".to_string();

        assert!(matches!(user_map.update(updated), UpdateUserResult::Success));
    }

    #[test]
    fn prune_unconfirmed_phone_numbers_runs_once_every_specified_interval() {
        let mut now = 1_000_000;
        let mut user_map = UserMap::default();
        assert_eq!(user_map.prune_unconfirmed_phone_numbers_if_required(now), Some(0));
        now += PRUNE_UNCONFIRMED_PHONE_NUMBERS_INTERVAL_MS;
        assert_eq!(user_map.prune_unconfirmed_phone_numbers_if_required(now), None);
        now += 1;
        assert_eq!(user_map.prune_unconfirmed_phone_numbers_if_required(now), Some(0));
    }

    #[test]
    fn prune_unconfirmed_phone_numbers_only_removes_users_with_expired_codes() {
        let mut now = 1_000_000;
        let mut user_map = UserMap::default();

        let principal1 = Principal::from_slice(&[1]);
        let principal2 = Principal::from_slice(&[2]);

        let user_id1 = Principal::from_slice(&[1, 1]).into();
        let user_id2 = Principal::from_slice(&[2, 2]).into();

        let phone_number1 = PhoneNumber::new(44, "1111 111 111".to_owned());
        let phone_number2 = PhoneNumber::new(44, "2222 222 222".to_owned());

        let user1 = User {
            principal: principal1,
            user_id: user_id1,
            username: "1".to_string(),
            ..Default::default()
        };

        let user2 = User {
            principal: principal2,
            user_id: user_id2,
            username: "2".to_string(),
            ..Default::default()
        };

        user_map.add_test_user(user1);
        user_map.add_test_user(user2);

        user_map.submit_phone_number(principal1, phone_number1.clone(), "1".to_string(), now);

        now += 1;

        user_map.submit_phone_number(principal2, phone_number2.clone(), "2".to_string(), now);

        now += CONFIRMATION_CODE_EXPIRY_MILLIS;

        assert_eq!(user_map.prune_unconfirmed_phone_numbers_if_required(now), Some(1));
        assert_eq!(
            user_map.users_with_unconfirmed_phone_numbers.iter().copied().collect_vec(),
            vec![user_id2]
        );
        assert!(user_map.users.get(&user_id1).unwrap().phone_status.phone_number().is_none());
        assert_eq!(
            user_map.phone_number_to_user_id.keys().cloned().collect_vec(),
            vec![phone_number2]
        );
    }
}
