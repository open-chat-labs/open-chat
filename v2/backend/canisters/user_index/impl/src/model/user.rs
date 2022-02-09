use crate::model::account_billing::AccountBilling;
use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use types::{CyclesTopUp, PartialUserSummary, PhoneNumber, RegistrationFee, TimestampMillis, UserId, UserSummary, Version};

#[allow(clippy::large_enum_variant)]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Eq, PartialEq)]
pub enum User {
    Created(CreatedUser),
}

impl User {
    pub fn get_principal(&self) -> Principal {
        let User::Created(u) = self;
        u.principal
    }

    pub fn get_phone_number(&self) -> Option<&PhoneNumber> {
        let User::Created(u) = self;
        u.phone_status.phone_number()
    }

    pub fn get_username(&self) -> &str {
        let User::Created(u) = self;
        &u.username
    }

    pub fn get_user_id(&self) -> UserId {
        let User::Created(u) = self;
        u.user_id
    }

    pub fn wasm_version(&self) -> Version {
        let User::Created(u) = self;
        u.wasm_version
    }

    pub fn created_user(&self) -> &CreatedUser {
        let User::Created(u) = self;
        u
    }

    pub fn set_avatar_id(&mut self, avatar_id: Option<u128>, now: TimestampMillis) -> bool {
        let User::Created(u) = self;
        u.avatar_id = avatar_id;
        u.date_updated = now;
        true
    }

    pub fn set_canister_upgrade_status(&mut self, upgrade_in_progress: bool, new_version: Option<Version>) {
        let User::Created(u) = self;
        u.upgrade_in_progress = upgrade_in_progress;
        if let Some(version) = new_version {
            u.wasm_version = version;
        }
    }

    pub fn mark_cycles_top_up(&mut self, top_up: CyclesTopUp) -> bool {
        let User::Created(u) = self;
        u.cycle_top_ups.push(top_up);
        true
    }
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Eq, PartialEq)]
pub struct CreatedUser {
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
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Eq, PartialEq)]
pub enum PhoneStatus {
    None,
    Unconfirmed(UnconfirmedPhoneNumber),
    Confirmed(PhoneNumber),
}

impl PhoneStatus {
    fn phone_number(&self) -> Option<&PhoneNumber> {
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

impl CreatedUser {
    pub fn to_summary(&self, now: TimestampMillis) -> UserSummary {
        let millis_since_last_online = now - self.last_online;
        let seconds_since_last_online = (millis_since_last_online / 1000) as u32;

        UserSummary {
            user_id: self.user_id,
            username: self.username.clone(),
            seconds_since_last_online,
            avatar_id: self.avatar_id,
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

impl CreatedUser {
    pub fn new(
        principal: Principal,
        user_id: UserId,
        username: String,
        now: TimestampMillis,
        wasm_version: Version,
    ) -> CreatedUser {
        CreatedUser {
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
        }
    }
}

#[cfg(test)]
impl Default for CreatedUser {
    fn default() -> Self {
        CreatedUser {
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
        }
    }
}