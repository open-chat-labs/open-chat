use crate::model::account_billing::AccountBilling;
use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use types::{CyclesTopUp, PartialUserSummary, PhoneNumber, RegistrationFee, TimestampMillis, UserId, UserSummary, Version};

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Eq, PartialEq)]
pub struct User {
    pub principal: Principal,
    pub user_id: UserId,
    pub username: String,
    pub date_created: TimestampMillis,
    pub date_updated: TimestampMillis,
    pub last_online: TimestampMillis,
    pub wasm_version: Version,
    pub upgrade_in_progress: bool,
    pub cycle_top_ups: Vec<CyclesTopUp>,
    pub avatar_id: Option<u128>,
    pub registration_fee: Option<RegistrationFee>,
    pub account_billing: AccountBilling,
    pub open_storage_limit_bytes: u64,
    pub phone_status: PhoneStatus,
    pub referred_by: Option<UserId>,
    #[serde(default)]
    pub is_bot: bool,
}

impl User {
    pub fn set_avatar_id(&mut self, avatar_id: Option<u128>, now: TimestampMillis) {
        self.avatar_id = avatar_id;
        self.date_updated = now;
    }

    pub fn set_canister_upgrade_status(&mut self, upgrade_in_progress: bool, new_version: Option<Version>) {
        self.upgrade_in_progress = upgrade_in_progress;
        if let Some(version) = new_version {
            self.wasm_version = version;
        }
    }

    pub fn mark_cycles_top_up(&mut self, top_up: CyclesTopUp) {
        self.cycle_top_ups.push(top_up)
    }
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Eq, PartialEq)]
pub enum PhoneStatus {
    None,
    Unconfirmed(UnconfirmedPhoneNumber),
    Confirmed(PhoneNumber),
}

impl PhoneStatus {
    pub fn phone_number(&self) -> Option<&PhoneNumber> {
        match self {
            PhoneStatus::None => None,
            PhoneStatus::Unconfirmed(un) => Some(&un.phone_number),
            PhoneStatus::Confirmed(pn) => Some(pn),
        }
    }
}

impl Default for PhoneStatus {
    fn default() -> Self {
        PhoneStatus::None
    }
}

impl User {
    pub fn new(
        principal: Principal,
        user_id: UserId,
        username: String,
        now: TimestampMillis,
        wasm_version: Version,
        referred_by: Option<UserId>,
        is_bot: bool,
    ) -> User {
        User {
            principal,
            user_id,
            username,
            date_created: now,
            date_updated: now,
            last_online: now,
            wasm_version,
            upgrade_in_progress: false,
            cycle_top_ups: Vec::new(),
            avatar_id: None,
            registration_fee: None,
            account_billing: AccountBilling::default(),
            open_storage_limit_bytes: 0,
            phone_status: PhoneStatus::None,
            referred_by,
            is_bot,
        }
    }

    pub fn to_summary(&self, now: TimestampMillis) -> UserSummary {
        let millis_since_last_online = now - self.last_online;
        let seconds_since_last_online = (millis_since_last_online / 1000) as u32;

        UserSummary {
            user_id: self.user_id,
            username: self.username.clone(),
            seconds_since_last_online,
            avatar_id: self.avatar_id,
            is_bot: self.is_bot,
        }
    }

    pub fn to_partial_summary(&self, include_username: bool, now: TimestampMillis) -> PartialUserSummary {
        let millis_since_last_online = now - self.last_online;
        let seconds_since_last_online = (millis_since_last_online / 1000) as u32;

        PartialUserSummary {
            user_id: self.user_id,
            username: if include_username { Some(self.username.clone()) } else { None },
            seconds_since_last_online,
            avatar_id: self.avatar_id,
            is_bot: self.is_bot,
        }
    }
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Eq, PartialEq)]
pub struct UnconfirmedPhoneNumber {
    pub phone_number: PhoneNumber,
    pub confirmation_code: String,
    pub valid_until: TimestampMillis,
    pub sms_messages_sent: u16,
}

#[cfg(test)]
impl Default for User {
    fn default() -> Self {
        User {
            principal: Principal::anonymous(),
            user_id: Principal::anonymous().into(),
            username: String::new(),
            date_created: 0,
            date_updated: 0,
            last_online: 0,
            wasm_version: Version::new(0, 0, 0),
            upgrade_in_progress: false,
            cycle_top_ups: Vec::new(),
            avatar_id: None,
            registration_fee: None,
            account_billing: AccountBilling::default(),
            open_storage_limit_bytes: 0,
            phone_status: PhoneStatus::None,
            referred_by: None,
            is_bot: false,
        }
    }
}
