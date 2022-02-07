use crate::model::account_billing::AccountBilling;
use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use serializer::unwrap_option;
use types::{
    CanisterCreationStatusInternal, CyclesTopUp, PartialUserSummary, PhoneNumber, RegistrationFee, TimestampMillis, UserId,
    UserSummary, Version,
};

#[allow(clippy::large_enum_variant)]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Eq, PartialEq)]
pub enum User {
    Confirmed(ConfirmedUser),
    Created(CreatedUser),
}

impl User {
    pub fn get_principal(&self) -> Principal {
        match self {
            User::Confirmed(u) => u.principal,
            User::Created(u) => u.principal,
        }
    }

    pub fn get_phone_number(&self) -> Option<&PhoneNumber> {
        match self {
            User::Confirmed(_) => None,
            User::Created(u) => u.phone_status.phone_number(),
        }
    }

    pub fn get_username(&self) -> &str {
        match self {
            User::Confirmed(u) => &u.username,
            User::Created(u) => &u.username,
        }
    }

    pub fn get_user_id(&self) -> Option<UserId> {
        match self {
            User::Confirmed(u) => match u.canister_creation_status {
                CanisterCreationStatusInternal::Pending(canister_id) => canister_id.map(|c| c.into()),
                CanisterCreationStatusInternal::Created(canister_id, ..) => Some(canister_id.into()),
                _ => None,
            },
            User::Created(u) => Some(u.user_id),
        }
    }

    pub fn wasm_version(&self) -> Option<Version> {
        match self {
            User::Confirmed(u) => {
                if let CanisterCreationStatusInternal::Created(_, v, _) = u.canister_creation_status {
                    Some(v)
                } else {
                    None
                }
            }
            User::Created(u) => Some(u.wasm_version),
        }
    }

    pub fn created_user(&self) -> Option<&CreatedUser> {
        match self {
            User::Created(u) => Some(u),
            _ => None,
        }
    }

    pub fn set_avatar_id(&mut self, avatar_id: Option<u128>, now: TimestampMillis) -> bool {
        match self {
            User::Created(u) => {
                u.avatar_id = avatar_id;
                u.date_updated = now;
                true
            }
            _ => false,
        }
    }

    pub fn set_canister_creation_status(&mut self, canister_creation_status: CanisterCreationStatusInternal) -> bool {
        match self {
            User::Confirmed(u) => u.canister_creation_status = canister_creation_status,
            _ => return false,
        }
        true
    }

    pub fn set_canister_upgrade_status(&mut self, upgrade_in_progress: bool, new_version: Option<Version>) {
        match self {
            User::Created(u) => {
                u.upgrade_in_progress = upgrade_in_progress;
                if let Some(version) = new_version {
                    u.wasm_version = version;
                }
            }
            User::Confirmed(u) => {
                u.upgrade_in_progress = upgrade_in_progress;
                if let Some(version) = new_version {
                    if let CanisterCreationStatusInternal::Created(_, v, _) = &mut u.canister_creation_status {
                        *v = version;
                    }
                }
            }
        }
    }

    pub fn mark_cycles_top_up(&mut self, top_up: CyclesTopUp) -> bool {
        if let User::Created(u) = self {
            u.cycle_top_ups.push(top_up);
            true
        } else {
            false
        }
    }
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Eq, PartialEq)]
pub struct ConfirmedUser {
    pub principal: Principal,
    #[serde(deserialize_with = "unwrap_option")]
    pub username: String,
    pub date_confirmed: TimestampMillis,
    pub canister_creation_status: CanisterCreationStatusInternal,
    pub upgrade_in_progress: bool,
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

#[cfg(test)]
impl Default for ConfirmedUser {
    fn default() -> Self {
        ConfirmedUser {
            principal: Principal::anonymous(),
            username: "abc".to_string(),
            canister_creation_status: CanisterCreationStatusInternal::Pending(None),
            upgrade_in_progress: false,
            date_confirmed: 0,
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
