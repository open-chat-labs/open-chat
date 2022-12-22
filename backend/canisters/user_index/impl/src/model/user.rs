use crate::model::account_billing::AccountBilling;
use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use types::{
    CyclesTopUp, Milliseconds, PartialUserSummary, PhoneNumber, RegistrationFee, TimestampMillis, UserId, UserSummary, Version,
};

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Eq, PartialEq)]
pub struct User {
    pub principal: Principal,
    pub user_id: UserId,
    pub username: String,
    pub date_created: TimestampMillis,
    pub date_updated: TimestampMillis,
    pub wasm_version: Version,
    pub upgrade_in_progress: bool,
    pub cycle_top_ups: Vec<CyclesTopUp>,
    pub avatar_id: Option<u128>,
    pub registration_fee: Option<RegistrationFee>,
    pub account_billing: AccountBilling,
    pub open_storage_limit_bytes: u64,
    pub phone_status: PhoneStatus,
    pub referred_by: Option<UserId>,
    pub is_bot: bool,
    pub suspension_details: Option<SuspensionDetails>,
}

impl User {
    pub fn set_avatar_id(&mut self, avatar_id: Option<u128>, now: TimestampMillis) {
        self.avatar_id = avatar_id;
        self.date_updated = now;
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
            suspension_details: None,
        }
    }

    pub fn to_summary(&self) -> UserSummary {
        UserSummary {
            user_id: self.user_id,
            username: self.username.clone(),
            avatar_id: self.avatar_id,
            is_bot: self.is_bot,
            suspended: self.suspension_details.is_some(),
        }
    }

    pub fn to_partial_summary(&self) -> PartialUserSummary {
        PartialUserSummary {
            user_id: self.user_id,
            username: Some(self.username.clone()),
            avatar_id: self.avatar_id,
            is_bot: self.is_bot,
            suspended: self.suspension_details.is_some(),
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

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Eq, PartialEq)]
pub struct SuspensionDetails {
    pub timestamp: TimestampMillis,
    pub duration: SuspensionDuration,
    pub reason: String,
    pub suspended_by: UserId,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Eq, PartialEq)]
pub enum SuspensionDuration {
    Duration(Milliseconds),
    Indefinitely,
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
            suspension_details: None,
        }
    }
}
