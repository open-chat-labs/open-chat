use crate::DEFAULT_OPEN_STORAGE_USER_BYTE_LIMIT;
use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use types::{
    CanisterCreationStatusInternal, Cycles, CyclesTopUp, PartialUserSummary, PhoneNumber, RegistrationFee, TimestampMillis,
    UserId, UserSummary, Version,
};
use user_index_canister::current_user::ConfirmationState;

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Eq, PartialEq)]
pub enum User {
    Unconfirmed(UnconfirmedUser),
    Confirmed(ConfirmedUser),
    Created(CreatedUser),
}

impl User {
    pub fn get_principal(&self) -> Principal {
        match self {
            User::Unconfirmed(u) => u.principal,
            User::Confirmed(u) => u.principal,
            User::Created(u) => u.principal,
        }
    }

    pub fn get_phone_number(&self) -> Option<&PhoneNumber> {
        match self {
            User::Unconfirmed(u) => {
                if let UnconfirmedUserState::PhoneNumber(p) = &u.state {
                    Some(&p.phone_number)
                } else {
                    None
                }
            }
            User::Confirmed(u) => u.phone_number.as_ref(),
            User::Created(u) => u.phone_status.phone_number(),
        }
    }

    pub fn get_username(&self) -> Option<&str> {
        match self {
            User::Unconfirmed(_) => None,
            User::Confirmed(u) => u.username.as_deref(),
            User::Created(u) => Some(&u.username),
        }
    }

    pub fn get_user_id(&self) -> Option<UserId> {
        match self {
            User::Unconfirmed(_) => None,
            User::Confirmed(u) => match u.canister_creation_status {
                CanisterCreationStatusInternal::Pending(canister_id) => canister_id.map(|c| c.into()),
                CanisterCreationStatusInternal::Created(canister_id, ..) => Some(canister_id.into()),
                _ => None,
            },
            User::Created(u) => Some(u.user_id),
        }
    }

    pub fn get_registration_fee(&self) -> Option<RegistrationFee> {
        match self {
            User::Unconfirmed(u) => {
                if let UnconfirmedUserState::RegistrationFee(fee) = &u.state {
                    Some(fee.clone())
                } else {
                    None
                }
            }
            _ => None,
        }
    }

    pub fn get_registration_fee_cycles(&self) -> Option<Cycles> {
        if let Some(RegistrationFee::Cycles(fee)) = self.get_registration_fee() {
            Some(fee.amount)
        } else {
            None
        }
    }

    pub fn upgrade_in_progress(&self) -> bool {
        match self {
            User::Unconfirmed(_) => false,
            User::Confirmed(u) => u.upgrade_in_progress,
            User::Created(u) => u.upgrade_in_progress,
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
            _ => None,
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

    pub fn set_canister_upgrade_status(&mut self, upgrade_in_progress: bool, new_version: Option<Version>) -> bool {
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
            _ => return false,
        }
        true
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
pub struct UnconfirmedUser {
    pub principal: Principal,
    pub state: UnconfirmedUserState,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Eq, PartialEq)]
pub struct ConfirmedUser {
    pub principal: Principal,
    pub phone_number: Option<PhoneNumber>,
    pub username: Option<String>,
    pub date_confirmed: TimestampMillis,
    pub canister_creation_status: CanisterCreationStatusInternal,
    pub upgrade_in_progress: bool,
    pub registration_fee: Option<RegistrationFee>,
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
    #[serde(default = "default_byte_limit")]
    pub open_storage_limit_bytes: u64,
    #[serde(rename(deserialize = "phone_number"))]
    pub phone_status: PhoneStatus,
}

fn default_byte_limit() -> u64 {
    DEFAULT_OPEN_STORAGE_USER_BYTE_LIMIT
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Eq, PartialEq)]
#[serde(from = "Option<PhoneNumber>")]
#[allow(dead_code)]
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

impl From<Option<PhoneNumber>> for PhoneStatus {
    fn from(phone_number: Option<PhoneNumber>) -> Self {
        match phone_number {
            Some(pn) => PhoneStatus::Confirmed(pn),
            None => PhoneStatus::None,
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
pub enum UnconfirmedUserState {
    PhoneNumber(UnconfirmedPhoneNumber),
    RegistrationFee(RegistrationFee),
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Eq, PartialEq)]
pub struct UnconfirmedPhoneNumber {
    pub phone_number: PhoneNumber,
    pub confirmation_code: String,
    pub valid_until: TimestampMillis,
    pub sms_messages_sent: u16,
}

impl ConfirmedUser {
    pub fn confirmation_state(&self) -> ConfirmationState {
        if let Some(p) = &self.phone_number {
            ConfirmationState::PhoneNumber(p.clone())
        } else if let Some(f) = &self.registration_fee {
            ConfirmationState::RegistrationFee(f.clone())
        } else {
            panic!("Exactly one of 'phone_number' and 'registration_fee' should be set");
        }
    }
}

impl From<UnconfirmedUserState> for user_index_canister::current_user::UnconfirmedUserState {
    fn from(state: UnconfirmedUserState) -> Self {
        match state {
            UnconfirmedUserState::PhoneNumber(p) => user_index_canister::current_user::UnconfirmedUserState::PhoneNumber(
                user_index_canister::current_user::UnconfirmedPhoneNumber {
                    phone_number: p.phone_number,
                    valid_until: p.valid_until,
                },
            ),
            UnconfirmedUserState::RegistrationFee(f) => {
                user_index_canister::current_user::UnconfirmedUserState::RegistrationFee(f)
            }
        }
    }
}

#[cfg(test)]
impl Default for ConfirmedUser {
    fn default() -> Self {
        ConfirmedUser {
            principal: Principal::anonymous(),
            phone_number: Some(PhoneNumber::new(44, "000".to_owned())),
            username: None,
            canister_creation_status: CanisterCreationStatusInternal::Pending(None),
            upgrade_in_progress: false,
            date_confirmed: 0,
            registration_fee: None,
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
            open_storage_limit_bytes: 0,
            phone_status: PhoneStatus::None,
        }
    }
}
