use crate::model::user::{
    AccountPayment, ConfirmedUser, PhoneStatus, UnconfirmedPhoneNumber, UnconfirmedUser, UnconfirmedUserState, User,
};
use crate::{CONFIRMATION_CODE_EXPIRY_MILLIS, DEFAULT_OPEN_STORAGE_USER_BYTE_LIMIT, USER_LIMIT};
use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use std::collections::hash_map::Entry::Vacant;
use std::collections::{HashMap, HashSet, VecDeque};
use types::{
    CanisterCreationStatusInternal, Cycles, CyclesTopUp, ICPRegistrationFee, Milliseconds, PhoneNumber, RegistrationFee,
    TimestampMillis, Timestamped, UserId,
};
use utils::case_insensitive_hash_map::CaseInsensitiveHashMap;
use utils::time::{DAY_IN_MS, HOUR_IN_MS, MINUTE_IN_MS, WEEK_IN_MS};

const FIVE_MINUTES_IN_MS: Milliseconds = MINUTE_IN_MS * 5;
const THIRTY_DAYS_IN_MS: Milliseconds = DAY_IN_MS * 30;
const PRUNE_UNCONFIRMED_USERS_INTERVAL_MS: Milliseconds = MINUTE_IN_MS * 15;

#[derive(Serialize, Deserialize, Default)]
pub struct UserMap {
    users_by_principal: HashMap<Principal, User>,
    phone_number_to_principal: HashMap<PhoneNumber, Principal>,
    username_to_principal: CaseInsensitiveHashMap<Principal>,
    user_id_to_principal: HashMap<UserId, Principal>,
    registration_fee_cycles_to_principal: HashMap<Cycles, Principal>,
    registration_fees_pending_cycles_conversion: VecDeque<Principal>,
    unconfirmed_users: HashSet<Principal>,
    users_confirmed_via_phone: u64,
    users_confirmed_via_icp: u64,
    users_confirmed_via_cycles: u64,
    users_confirmed_automatically: u64,
    cached_metrics: Timestamped<Metrics>,
    unconfirmed_users_last_pruned: TimestampMillis,
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
    pub users_confirmed_via_phone: u64,
    pub users_confirmed_via_icp: u64,
    pub users_confirmed_via_cycles: u64,
}

impl UserMap {
    pub fn repopulate_missing_phone_statuses(&mut self) {
        for (phone_number, principal) in self.phone_number_to_principal.iter() {
            if let Some(User::Created(user)) = self.users_by_principal.get_mut(principal) {
                user.phone_status = PhoneStatus::Confirmed(phone_number.clone());
            }
        }
    }

    pub fn register(&mut self, principal: Principal, username: &str, now: TimestampMillis) -> RegisterUserResult {
        if self.users_by_principal.contains_key(&principal) {
            return RegisterUserResult::AlreadyExists;
        }

        if self.username_to_principal.contains_key(username) {
            return RegisterUserResult::UsernameTaken;
        }

        self.username_to_principal.insert(username, principal);

        let user = ConfirmedUser {
            principal,
            phone_number: None,
            username: Some(username.to_owned()),
            date_confirmed: now,
            canister_creation_status: CanisterCreationStatusInternal::Pending(None),
            upgrade_in_progress: false,
            registration_fee: None,
        };

        self.users_by_principal.insert(principal, User::Confirmed(user));

        self.users_confirmed_automatically += 1;

        RegisterUserResult::Success
    }

    pub fn add(&mut self, user: UnconfirmedUser) -> AddUserResult {
        let principal = user.principal;
        let mut maybe_phone_number = None;
        let mut maybe_fee_cycles = None;
        match &user.state {
            UnconfirmedUserState::PhoneNumber(p) => maybe_phone_number = Some(&p.phone_number),
            UnconfirmedUserState::RegistrationFee(fee) => match fee {
                RegistrationFee::ICP(_) => {}
                RegistrationFee::Cycles(f) => maybe_fee_cycles = Some(f.amount),
            },
        };

        if let Vacant(principal_entry) = self.users_by_principal.entry(principal) {
            if maybe_phone_number.is_some() && self.phone_number_to_principal.contains_key(maybe_phone_number.unwrap()) {
                AddUserResult::PhoneNumberTaken
            } else if maybe_fee_cycles.is_some()
                && self
                    .registration_fee_cycles_to_principal
                    .contains_key(&maybe_fee_cycles.unwrap())
            {
                AddUserResult::RegistrationFeeCyclesTaken
            } else {
                if let Some(phone_number) = maybe_phone_number {
                    self.phone_number_to_principal.insert(phone_number.clone(), principal);
                }
                if let Some(fee_cycles) = maybe_fee_cycles {
                    self.registration_fee_cycles_to_principal.insert(fee_cycles, principal);
                }

                self.unconfirmed_users.insert(principal);
                principal_entry.insert(User::Unconfirmed(user));
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

            let previous_fee_cycles = previous.get_registration_fee_cycles();
            let fee_cycles = user.get_registration_fee_cycles();
            let fee_cycles_changed = previous_fee_cycles != fee_cycles;

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

            if fee_cycles_changed {
                if let Some(fee_cycles) = fee_cycles {
                    if self.registration_fee_cycles_to_principal.contains_key(&fee_cycles) {
                        return UpdateUserResult::RegistrationFeeCyclesTaken;
                    }
                }
            }

            // Checks are complete, now update the data

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

            if fee_cycles_changed {
                if let Some(previous_fee_cycles) = previous_fee_cycles {
                    self.registration_fee_cycles_to_principal.remove(&previous_fee_cycles);
                }
                if let Some(fee_cycles) = fee_cycles {
                    self.registration_fee_cycles_to_principal.insert(fee_cycles, principal);
                }
            }

            if matches!(user, User::Unconfirmed(_)) {
                self.unconfirmed_users.insert(principal);
            } else if let User::Unconfirmed(previous) = previous {
                self.unconfirmed_users.remove(&principal);
                match previous.state {
                    UnconfirmedUserState::PhoneNumber(_) => self.users_confirmed_via_phone += 1,
                    UnconfirmedUserState::RegistrationFee(RegistrationFee::ICP(_)) => {
                        self.registration_fees_pending_cycles_conversion.push_back(principal);
                        self.users_confirmed_via_icp += 1
                    }
                    UnconfirmedUserState::RegistrationFee(RegistrationFee::Cycles(_)) => self.users_confirmed_via_cycles += 1,
                };
            }
            self.users_by_principal.insert(principal, user);
            UpdateUserResult::Success
        } else {
            UpdateUserResult::UserNotFound
        }
    }

    pub fn submit_phone_number(
        &mut self,
        principal: Principal,
        phone_number: PhoneNumber,
        confirmation_code: &str,
        now: TimestampMillis,
    ) -> SubmitPhoneNumberResult {
        let phone_number_already_used = self.get_by_phone_number(&phone_number).is_some();

        let mut unconfirmed_phone_number = UnconfirmedPhoneNumber {
            phone_number: phone_number.clone(),
            confirmation_code: confirmation_code.to_owned(),
            valid_until: now + CONFIRMATION_CODE_EXPIRY_MILLIS,
            sms_messages_sent: 1,
        };

        if let Some(user) = self.users_by_principal.get_mut(&principal) {
            if let Some(user_phone_number) = user.get_phone_number() {
                if phone_number_already_used && (user_phone_number != &phone_number) {
                    return SubmitPhoneNumberResult::AlreadyTaken;
                }
            }

            match user {
                User::Unconfirmed(u) => {
                    if let UnconfirmedUserState::PhoneNumber(p) = &u.state {
                        unconfirmed_phone_number.sms_messages_sent += p.sms_messages_sent;
                    }
                    self.remove_by_principal(&principal);
                }
                User::Confirmed(_) => return SubmitPhoneNumberResult::AlreadyConfirmed,
                User::Created(u) => {
                    match &u.phone_status {
                        PhoneStatus::Confirmed(_) => return SubmitPhoneNumberResult::AlreadyConfirmed,
                        PhoneStatus::Unconfirmed(p) => unconfirmed_phone_number.sms_messages_sent += p.sms_messages_sent,
                        PhoneStatus::None => (),
                    }

                    u.phone_status = PhoneStatus::Unconfirmed(unconfirmed_phone_number);
                    return SubmitPhoneNumberResult::Success;
                }
            }
        } else if self.len() >= USER_LIMIT {
            return SubmitPhoneNumberResult::UserLimitReached;
        } else if phone_number_already_used {
            return SubmitPhoneNumberResult::AlreadyTaken;
        }

        let user = UnconfirmedUser {
            principal,
            state: UnconfirmedUserState::PhoneNumber(unconfirmed_phone_number),
        };

        if matches!(self.add(user), AddUserResult::Success) {
            SubmitPhoneNumberResult::Success
        } else {
            panic!("Failed to add user");
        }
    }

    pub fn confirm_phone_number(
        &mut self,
        principal: Principal,
        confirmation_code: String,
        test_mode: bool,
        now: TimestampMillis,
    ) -> ConfirmPhoneNumberResult {
        let test_code = test_mode && confirmation_code == "123456";
        let phone_number: PhoneNumber;
        if let Some(user) = self.users_by_principal.get_mut(&principal) {
            match user {
                User::Unconfirmed(u) => {
                    if let UnconfirmedUserState::PhoneNumber(p) = &u.state {
                        if now > p.valid_until {
                            return ConfirmPhoneNumberResult::CodeExpired;
                        } else if (confirmation_code != p.confirmation_code) && !test_code {
                            return ConfirmPhoneNumberResult::CodeIncorrect;
                        } else {
                            phone_number = p.phone_number.clone();
                        }
                    } else {
                        return ConfirmPhoneNumberResult::PhoneNumberNotSubmitted;
                    }
                }
                User::Created(u) => {
                    return match &u.phone_status {
                        PhoneStatus::Confirmed(_) => ConfirmPhoneNumberResult::AlreadyConfirmed,
                        PhoneStatus::Unconfirmed(p) => {
                            if now > p.valid_until {
                                ConfirmPhoneNumberResult::CodeExpired
                            } else if (confirmation_code != p.confirmation_code) && !test_code {
                                ConfirmPhoneNumberResult::CodeIncorrect
                            } else {
                                u.phone_status = PhoneStatus::Confirmed(p.phone_number.clone());
                                u.open_storage_limit_bytes += DEFAULT_OPEN_STORAGE_USER_BYTE_LIMIT;
                                ConfirmPhoneNumberResult::Success(Some(u.open_storage_limit_bytes))
                            }
                        }
                        PhoneStatus::None => ConfirmPhoneNumberResult::PhoneNumberNotSubmitted,
                    }
                }
                _ => return ConfirmPhoneNumberResult::AlreadyConfirmed,
            }
        } else {
            // We remove unconfirmed users once their confirmation codes expire, so if we are unable to
            // find the user that either means the user never registered, or they registered but
            // subsequently were removed due to their code expiring. Since we can't differentiate
            // between these 2 cases, we simply return CodeExpired for both.
            return ConfirmPhoneNumberResult::CodeExpired;
        }

        let user = ConfirmedUser {
            principal,
            phone_number: Some(phone_number),
            username: None,
            date_confirmed: now,
            canister_creation_status: CanisterCreationStatusInternal::Pending(None),
            upgrade_in_progress: false,
            registration_fee: None,
        };
        self.update(User::Confirmed(user));
        ConfirmPhoneNumberResult::Success(None)
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

    pub fn get_by_registration_fee_cycles(&self, fee: &Cycles) -> Option<&User> {
        self.registration_fee_cycles_to_principal
            .get(fee)
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
            if let Some(fee_cycles) = user.get_registration_fee_cycles() {
                self.registration_fee_cycles_to_principal.remove(&fee_cycles);
            }
            self.unconfirmed_users.remove(principal);
            Some(user)
        } else {
            None
        }
    }

    pub fn mark_cycles_top_up(&mut self, user_id: &UserId, top_up: CyclesTopUp) -> bool {
        if let Some(user) = self.get_by_user_id_mut_internal(user_id) {
            user.mark_cycles_top_up(top_up);
            true
        } else {
            false
        }
    }

    pub fn set_avatar_id(&mut self, user_id: &UserId, avatar_id: Option<u128>, now: TimestampMillis) -> bool {
        if let Some(user) = self.get_by_user_id_mut_internal(user_id) {
            user.set_avatar_id(avatar_id, now);
            true
        } else {
            false
        }
    }

    pub fn record_account_payment(&mut self, user_id: &UserId, payment: AccountPayment) -> bool {
        if let Some(User::Created(user)) = self.get_by_user_id_mut_internal(user_id) {
            user.account_payments.push(payment);
            true
        } else {
            false
        }
    }

    pub fn set_storage_limit(&mut self, user_id: &UserId, bytes: u64) -> bool {
        if let Some(User::Created(user)) = self.get_by_user_id_mut_internal(user_id) {
            user.open_storage_limit_bytes = bytes;
            true
        } else {
            false
        }
    }

    pub fn search(&self, term: &str) -> impl Iterator<Item = &User> {
        self.username_to_principal
            .search(term)
            .filter_map(move |p| self.users_by_principal.get(p))
    }

    // Remove unconfirmed user records whose confirmation codes have expired, this frees up memory
    // and also allows their phone numbers to be reused.
    // This will only execute once every 15 minutes.
    pub fn prune_unconfirmed_users_if_required(&mut self, now: TimestampMillis) -> Option<usize> {
        if now > self.unconfirmed_users_last_pruned + PRUNE_UNCONFIRMED_USERS_INTERVAL_MS {
            let to_remove: Vec<_> = self
                .unconfirmed_users
                .iter()
                .filter_map(|u| self.users_by_principal.get(u))
                .filter_map(|u| if let User::Unconfirmed(user) = u { Some(user) } else { None })
                .filter(|u| match &u.state {
                    UnconfirmedUserState::PhoneNumber(p) => now > p.valid_until,
                    UnconfirmedUserState::RegistrationFee(f) => now > f.valid_until(),
                })
                .map(|u| u.principal)
                .collect();

            let count = to_remove.len();
            for principal in to_remove {
                self.remove_by_principal(&principal);
            }
            self.unconfirmed_users_last_pruned = now;
            Some(count)
        } else {
            None
        }
    }

    #[allow(dead_code)]
    pub fn next_fee_to_convert_to_cycles(&mut self) -> Option<ICPRegistrationFee> {
        self.registration_fees_pending_cycles_conversion
            .pop_front()
            .map(|p| self.users_by_principal.get(&p))
            .flatten()
            .map(|u| if let Some(RegistrationFee::ICP(fee)) = u.get_registration_fee() { Some(fee) } else { None })
            .flatten()
    }

    pub fn metrics(&self) -> Metrics {
        self.cached_metrics.value.clone()
    }

    pub fn calculate_metrics(&mut self, now: TimestampMillis) {
        // Throttle to once every 5 minutes
        if now < self.cached_metrics.timestamp + FIVE_MINUTES_IN_MS {
            return;
        }

        let mut metrics = Metrics {
            users_confirmed_via_phone: self.users_confirmed_via_phone,
            users_confirmed_via_icp: self.users_confirmed_via_icp,
            users_confirmed_via_cycles: self.users_confirmed_via_cycles,
            ..Default::default()
        };

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

    #[cfg(test)]
    pub fn add_test_user(&mut self, user: User) {
        use types::CyclesRegistrationFee;

        if let User::Unconfirmed(u) = user {
            self.add(u);
        } else {
            self.add(UnconfirmedUser {
                principal: user.get_principal(),
                state: UnconfirmedUserState::RegistrationFee(RegistrationFee::Cycles(CyclesRegistrationFee {
                    amount: 0,
                    recipient: Principal::anonymous(),
                    valid_until: 0,
                })),
            });
            self.update(user);
        }
    }

    fn get_by_user_id_mut_internal(&mut self, user_id: &UserId) -> Option<&mut User> {
        let principal = self.user_id_to_principal.get(user_id)?;
        self.users_by_principal.get_mut(principal)
    }
}

pub enum AddUserResult {
    Success,
    AlreadyExists,
    PhoneNumberTaken,
    RegistrationFeeCyclesTaken,
}

pub enum RegisterUserResult {
    Success,
    AlreadyExists,
    UsernameTaken,
}

#[derive(Debug)]
pub enum UpdateUserResult {
    Success,
    PhoneNumberTaken,
    UsernameTaken,
    UserNotFound,
    RegistrationFeeCyclesTaken,
}

pub enum SubmitPhoneNumberResult {
    Success,
    AlreadyTaken,
    AlreadyConfirmed,
    UserLimitReached,
}

pub enum ConfirmPhoneNumberResult {
    Success(Option<u64>),
    CodeExpired,
    CodeIncorrect,
    PhoneNumberNotSubmitted,
    AlreadyConfirmed,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::user::{ConfirmedUser, CreatedUser, PhoneStatus, UnconfirmedPhoneNumber, UnconfirmedUser};
    use ic_ledger_types::{AccountIdentifier, DEFAULT_SUBACCOUNT};
    use itertools::Itertools;
    use types::{CanisterCreationStatusInternal, CyclesRegistrationFee, ICPRegistrationFee, RegistrationFee, ICP};

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
            state: UnconfirmedUserState::PhoneNumber(UnconfirmedPhoneNumber {
                phone_number: phone_number1.clone(),
                confirmation_code: "1".to_string(),
                valid_until: 1,
                sms_messages_sent: 1,
            }),
        });
        user_map.add_test_user(unconfirmed.clone());

        let confirmed = User::Confirmed(ConfirmedUser {
            principal: principal2,
            phone_number: Some(phone_number2.clone()),
            username: Some(username2.clone()),
            canister_creation_status: CanisterCreationStatusInternal::Pending(Some(user_id2.into())),
            upgrade_in_progress: false,
            date_confirmed: 2,
            registration_fee: None,
        });
        user_map.add_test_user(confirmed.clone());

        let created = User::Created(CreatedUser {
            principal: principal3,
            user_id: user_id3,
            username: username3.clone(),
            date_created: 3,
            date_updated: 3,
            last_online: 1,
            phone_status: PhoneStatus::Confirmed(phone_number3.clone()),
            ..Default::default()
        });
        user_map.add_test_user(created.clone());

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

        let confirmed = User::Confirmed(ConfirmedUser {
            principal,
            phone_number: Some(phone_number1),
            username: Some("1".to_string()),
            canister_creation_status: CanisterCreationStatusInternal::Pending(Some(user_id.into())),
            upgrade_in_progress: false,
            date_confirmed: 1,
            registration_fee: None,
        });
        user_map.add_test_user(confirmed);

        let unconfirmed = UnconfirmedUser {
            principal,
            state: UnconfirmedUserState::PhoneNumber(UnconfirmedPhoneNumber {
                phone_number: phone_number2,
                confirmation_code: "2".to_string(),
                valid_until: 2,
                sms_messages_sent: 2,
            }),
        };

        assert!(matches!(user_map.add(unconfirmed), AddUserResult::AlreadyExists));
        assert_eq!(user_map.users_by_principal.len(), 1);
    }

    #[test]
    fn add_with_clashing_phone_number() {
        let mut user_map = UserMap::default();
        let principal1 = Principal::from_slice(&[1]);
        let principal2 = Principal::from_slice(&[2]);

        let phone_number = PhoneNumber::new(44, "1111 111 111".to_owned());

        let user_id = Principal::from_slice(&[2, 2]).into();

        let confirmed = User::Confirmed(ConfirmedUser {
            principal: principal1,
            phone_number: Some(phone_number.clone()),
            username: Some("1".to_string()),
            canister_creation_status: CanisterCreationStatusInternal::Pending(Some(user_id).into()),
            upgrade_in_progress: false,
            date_confirmed: 1,
            registration_fee: None,
        });
        user_map.add_test_user(confirmed);

        let unconfirmed = UnconfirmedUser {
            principal: principal2,
            state: UnconfirmedUserState::PhoneNumber(UnconfirmedPhoneNumber {
                phone_number: phone_number,
                confirmation_code: "2".to_string(),
                valid_until: 2,
                sms_messages_sent: 2,
            }),
        };

        assert!(matches!(user_map.add(unconfirmed), AddUserResult::PhoneNumberTaken));
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
            phone_status: PhoneStatus::Confirmed(phone_number1.clone()),
            user_id,
            username: username1.clone(),
            date_created: 1,
            date_updated: 1,
            last_online: 1,
            ..Default::default()
        };

        let mut updated = original.clone();
        updated.username = username2.clone();
        updated.phone_status = PhoneStatus::Confirmed(phone_number2.clone());

        user_map.add_test_user(User::Created(original));
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
            phone_status: PhoneStatus::Confirmed(phone_number1),
            user_id: user_id1,
            username: username1.clone(),
            date_created: 1,
            date_updated: 1,
            last_online: 1,
            ..Default::default()
        };

        let other = CreatedUser {
            principal: principal2,
            phone_status: PhoneStatus::Confirmed(phone_number2.clone()),
            user_id: user_id2,
            username: username2.clone(),
            date_created: 2,
            date_updated: 2,
            last_online: 2,
            ..Default::default()
        };

        let mut updated = original.clone();
        updated.phone_status = PhoneStatus::Confirmed(phone_number2);

        user_map.add_test_user(User::Created(original));
        user_map.add_test_user(User::Created(other));
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
            phone_status: PhoneStatus::Confirmed(phone_number1),
            user_id: user_id1,
            username: username1.clone(),
            date_created: 1,
            date_updated: 1,
            last_online: 1,
            ..Default::default()
        };

        let other = CreatedUser {
            principal: principal2,
            phone_status: PhoneStatus::Confirmed(phone_number2.clone()),
            user_id: user_id2,
            username: username2.clone(),
            date_created: 2,
            date_updated: 2,
            last_online: 2,
            ..Default::default()
        };

        let mut updated = original.clone();
        updated.username = username2;

        user_map.add_test_user(User::Created(original));
        user_map.add_test_user(User::Created(other));
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
            phone_status: PhoneStatus::Confirmed(phone_number),
            user_id: user_id,
            username: username.clone(),
            date_created: 1,
            date_updated: 1,
            last_online: 1,
            ..Default::default()
        };

        let mut updated = original.clone();

        user_map.add_test_user(User::Created(original));
        updated.username = "ABC".to_string();

        assert!(matches!(user_map.update(User::Created(updated)), UpdateUserResult::Success));
    }

    #[test]
    fn add_with_clashing_registration_fee_cycles() {
        let mut user_map = UserMap::default();
        let principal1 = Principal::from_slice(&[1]);
        let principal2 = Principal::from_slice(&[2]);

        let fee = 1_000_000;

        let user1 = UnconfirmedUser {
            principal: principal1,
            state: UnconfirmedUserState::RegistrationFee(RegistrationFee::Cycles(CyclesRegistrationFee {
                amount: fee,
                recipient: Principal::anonymous(),
                valid_until: 1000,
            })),
        };

        let user2 = UnconfirmedUser {
            principal: principal2,
            state: UnconfirmedUserState::RegistrationFee(RegistrationFee::Cycles(CyclesRegistrationFee {
                amount: fee,
                recipient: Principal::anonymous(),
                valid_until: 1000,
            })),
        };

        user_map.add(user1);
        assert!(matches!(user_map.add(user2), AddUserResult::RegistrationFeeCyclesTaken));
    }

    #[test]
    fn update_with_clashing_registration_fee_cycles() {
        let mut user_map = UserMap::default();
        let principal1 = Principal::from_slice(&[1]);
        let principal2 = Principal::from_slice(&[2]);

        let fee1 = 1_000_000;
        let fee2 = 2_000_000;

        let original = UnconfirmedUser {
            principal: principal1,
            state: UnconfirmedUserState::RegistrationFee(RegistrationFee::Cycles(CyclesRegistrationFee {
                amount: fee1,
                recipient: Principal::anonymous(),
                valid_until: 1000,
            })),
        };

        let other = UnconfirmedUser {
            principal: principal2,
            state: UnconfirmedUserState::RegistrationFee(RegistrationFee::Cycles(CyclesRegistrationFee {
                amount: fee2,
                recipient: Principal::anonymous(),
                valid_until: 1000,
            })),
        };

        let mut updated = original.clone();
        updated.state = UnconfirmedUserState::RegistrationFee(RegistrationFee::Cycles(CyclesRegistrationFee {
            amount: fee2,
            recipient: Principal::anonymous(),
            valid_until: 1000,
        }));

        user_map.add(original);
        user_map.add(other);
        assert!(matches!(
            user_map.update(User::Unconfirmed(updated)),
            UpdateUserResult::RegistrationFeeCyclesTaken
        ));
    }

    #[test]
    fn remove() {
        let mut user_map = UserMap::default();
        let principal1 = Principal::from_slice(&[1]);
        let principal2 = Principal::from_slice(&[2]);
        let principal3 = Principal::from_slice(&[3]);
        let principal4 = Principal::from_slice(&[4]);

        let phone_number1 = PhoneNumber::new(44, "1111 111 111".to_owned());
        let phone_number3 = PhoneNumber::new(44, "3333 333 333".to_owned());
        let phone_number4 = PhoneNumber::new(44, "4444 444 444".to_owned());

        let username3 = "3".to_string();
        let username4 = "4".to_string();

        let user_id3 = Principal::from_slice(&[3]).into();
        let user_id4 = Principal::from_slice(&[4]).into();

        let unconfirmed1 = UnconfirmedUser {
            principal: principal1,
            state: UnconfirmedUserState::PhoneNumber(UnconfirmedPhoneNumber {
                phone_number: phone_number1.clone(),
                confirmation_code: "1".to_string(),
                valid_until: 1,
                sms_messages_sent: 1,
            }),
        };
        user_map.add(unconfirmed1.clone());

        let unconfirmed2 = UnconfirmedUser {
            principal: principal2,
            state: UnconfirmedUserState::RegistrationFee(RegistrationFee::Cycles(CyclesRegistrationFee {
                amount: 1000,
                recipient: Principal::anonymous(),
                valid_until: 2,
            })),
        };
        user_map.add(unconfirmed2.clone());

        let confirmed = User::Confirmed(ConfirmedUser {
            principal: principal3,
            phone_number: Some(phone_number3.clone()),
            username: Some(username3.clone()),
            canister_creation_status: CanisterCreationStatusInternal::Pending(Some(user_id3).into()),
            upgrade_in_progress: false,
            date_confirmed: 3,
            registration_fee: None,
        });
        user_map.add_test_user(confirmed.clone());

        let created = User::Created(CreatedUser {
            principal: principal4,
            phone_status: PhoneStatus::Confirmed(phone_number4.clone()),
            user_id: user_id4,
            username: username4.clone(),
            date_created: 4,
            date_updated: 4,
            last_online: 4,
            ..Default::default()
        });
        user_map.add_test_user(created.clone());

        assert_eq!(user_map.users_by_principal.len(), 4);

        user_map.remove_by_principal(&principal1);
        user_map.remove_by_principal(&principal2);
        user_map.remove_by_principal(&principal3);
        user_map.remove_by_principal(&principal4);

        assert!(user_map.users_by_principal.is_empty());
        assert!(user_map.phone_number_to_principal.is_empty());
        assert!(user_map.username_to_principal.is_empty());
        assert!(user_map.user_id_to_principal.is_empty());
        assert!(user_map.registration_fee_cycles_to_principal.is_empty());
    }

    #[test]
    fn prune_unconfirmed_users_runs_once_every_specified_interval() {
        let mut now = 1_000_000;
        let mut user_map = UserMap::default();
        assert_eq!(user_map.prune_unconfirmed_users_if_required(now), Some(0));
        now += PRUNE_UNCONFIRMED_USERS_INTERVAL_MS;
        assert_eq!(user_map.prune_unconfirmed_users_if_required(now), None);
        now += 1;
        assert_eq!(user_map.prune_unconfirmed_users_if_required(now), Some(0));
    }

    #[test]
    fn prune_unconfirmed_users_only_removes_users_with_expired_codes() {
        let mut now = 1_000_000;
        let mut user_map = UserMap::default();

        let principal1 = Principal::from_slice(&[1]);
        let principal2 = Principal::from_slice(&[2]);
        let principal3 = Principal::from_slice(&[3]);
        let principal4 = Principal::from_slice(&[4]);

        let phone_number1 = PhoneNumber::new(44, "1111 111 111".to_owned());
        let phone_number2 = PhoneNumber::new(44, "2222 222 222".to_owned());

        let user1 = UnconfirmedUser {
            principal: principal1,
            state: UnconfirmedUserState::PhoneNumber(UnconfirmedPhoneNumber {
                phone_number: phone_number1,
                confirmation_code: "1".to_string(),
                valid_until: now + 1000,
                sms_messages_sent: 0,
            }),
        };

        let user2 = UnconfirmedUser {
            principal: principal2,
            state: UnconfirmedUserState::PhoneNumber(UnconfirmedPhoneNumber {
                phone_number: phone_number2,
                confirmation_code: "2".to_string(),
                valid_until: now + 1001,
                sms_messages_sent: 0,
            }),
        };

        let user3 = UnconfirmedUser {
            principal: principal3,
            state: UnconfirmedUserState::RegistrationFee(RegistrationFee::Cycles(CyclesRegistrationFee {
                amount: 3,
                recipient: Principal::anonymous(),
                valid_until: now + 1000,
            })),
        };

        let user4 = UnconfirmedUser {
            principal: principal4,
            state: UnconfirmedUserState::RegistrationFee(RegistrationFee::Cycles(CyclesRegistrationFee {
                amount: 4,
                recipient: Principal::anonymous(),
                valid_until: now + 1001,
            })),
        };

        user_map.add(user1);
        user_map.add(user2);
        user_map.add(user3);
        user_map.add(user4);

        now += 1001;

        assert_eq!(user_map.prune_unconfirmed_users_if_required(now), Some(2));
        assert_eq!(
            user_map.users_by_principal.into_keys().sorted().collect_vec(),
            vec![principal2, principal4]
        );
    }

    #[test]
    fn confirming_users_updates_the_counters() {
        let mut user_map = UserMap::default();

        let principal1 = Principal::from_slice(&[1]);
        let principal2 = Principal::from_slice(&[2]);
        let principal3 = Principal::from_slice(&[3]);

        let phone_number1 = PhoneNumber::new(44, "1111 111 111".to_owned());

        let user1 = UnconfirmedUser {
            principal: principal1,
            state: UnconfirmedUserState::PhoneNumber(UnconfirmedPhoneNumber {
                phone_number: phone_number1.clone(),
                confirmation_code: "1".to_string(),
                valid_until: 1,
                sms_messages_sent: 1,
            }),
        };

        let icp_fee = RegistrationFee::ICP(ICPRegistrationFee {
            amount: ICP::from_e8s(2),
            recipient: AccountIdentifier::new(&Principal::anonymous(), &DEFAULT_SUBACCOUNT),
            valid_until: 2,
        });
        let user2 = UnconfirmedUser {
            principal: principal2,
            state: UnconfirmedUserState::RegistrationFee(icp_fee.clone()),
        };

        let cycles_fee = RegistrationFee::Cycles(CyclesRegistrationFee {
            amount: 3,
            recipient: Principal::anonymous(),
            valid_until: 3,
        });
        let user3 = UnconfirmedUser {
            principal: principal3,
            state: UnconfirmedUserState::RegistrationFee(cycles_fee.clone()),
        };

        user_map.add(user1);
        user_map.add(user2);
        user_map.add(user3);

        let confirmed1 = User::Confirmed(ConfirmedUser {
            principal: principal1,
            phone_number: Some(phone_number1),
            username: None,
            canister_creation_status: CanisterCreationStatusInternal::Pending(None),
            upgrade_in_progress: false,
            date_confirmed: 1,
            registration_fee: None,
        });

        let confirmed2 = User::Confirmed(ConfirmedUser {
            principal: principal2,
            phone_number: None,
            username: None,
            canister_creation_status: CanisterCreationStatusInternal::Pending(None),
            upgrade_in_progress: false,
            date_confirmed: 2,
            registration_fee: Some(icp_fee),
        });

        let confirmed3 = User::Confirmed(ConfirmedUser {
            principal: principal3,
            phone_number: None,
            username: None,
            canister_creation_status: CanisterCreationStatusInternal::Pending(None),
            upgrade_in_progress: false,
            date_confirmed: 3,
            registration_fee: Some(cycles_fee),
        });

        assert_eq!(user_map.users_confirmed_via_phone, 0);
        assert_eq!(user_map.users_confirmed_via_icp, 0);
        assert_eq!(user_map.users_confirmed_via_cycles, 0);

        user_map.update(confirmed1);
        assert_eq!(user_map.users_confirmed_via_phone, 1);
        assert_eq!(user_map.users_confirmed_via_icp, 0);
        assert_eq!(user_map.users_confirmed_via_cycles, 0);

        user_map.update(confirmed2);
        assert_eq!(user_map.users_confirmed_via_phone, 1);
        assert_eq!(user_map.users_confirmed_via_icp, 1);
        assert_eq!(user_map.users_confirmed_via_cycles, 0);

        user_map.update(confirmed3);
        assert_eq!(user_map.users_confirmed_via_phone, 1);
        assert_eq!(user_map.users_confirmed_via_icp, 1);
        assert_eq!(user_map.users_confirmed_via_cycles, 1);

        assert_eq!(
            user_map.registration_fees_pending_cycles_conversion.into_iter().collect_vec(),
            vec![principal2]
        );
    }
}
