use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use types::{
    CanisterCreationStatusInternal, Cycles, CyclesTopUp, PartialUserSummary, PhoneNumber, TimestampMillis, UserId, UserSummary,
    Version,
};

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
                if let RegistrationState::PhoneNumber(p) = &u.state {
                    Some(&p.phone_number)
                } else {
                    None
                }
            }
            User::Confirmed(u) => u.phone_number.as_ref(),
            User::Created(u) => u.phone_number.as_ref(),
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

    pub fn get_registration_fee_cycles(&self) -> Option<Cycles> {
        match self {
            User::Unconfirmed(u) => {
                if let RegistrationState::CyclesFee(fee) = &u.state {
                    Some(fee.amount)
                } else {
                    None
                }
            }
            _ => None,
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

    pub fn set_avatar_id(&mut self, avatar_id: u128, now: TimestampMillis) -> bool {
        match self {
            User::Created(u) => {
                u.avatar_id = Some(avatar_id);
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
    pub state: RegistrationState,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Eq, PartialEq)]
pub struct ConfirmedUser {
    pub principal: Principal,
    pub phone_number: Option<PhoneNumber>,
    pub username: Option<String>,
    pub date_confirmed: TimestampMillis,
    pub canister_creation_status: CanisterCreationStatusInternal,
    pub upgrade_in_progress: bool,
    #[serde(default)]
    pub registration_fee: Option<Cycles>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Eq, PartialEq)]
pub struct CreatedUser {
    pub principal: Principal,
    pub phone_number: Option<PhoneNumber>,
    pub user_id: UserId,
    pub username: String,
    pub date_created: TimestampMillis,
    pub date_updated: TimestampMillis,
    pub last_online: TimestampMillis,
    pub wasm_version: Version,
    pub upgrade_in_progress: bool,
    pub cycle_top_ups: Vec<CyclesTopUp>,
    pub avatar_id: Option<u128>,
    pub registration_fee: Option<Cycles>,
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
pub enum RegistrationState {
    PhoneNumber(UnconfirmedPhoneNumber),
    CyclesFee(CyclesRegistrationFee),
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Eq, PartialEq)]
pub struct UnconfirmedPhoneNumber {
    pub phone_number: PhoneNumber,
    pub confirmation_code: String,
    pub valid_until: TimestampMillis,
    pub sms_messages_sent: u16,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Eq, PartialEq)]
pub struct CyclesRegistrationFee {
    pub amount: Cycles,
    pub valid_until: TimestampMillis,
}

impl From<&RegistrationState> for user_index_canister::current_user::RegistrationState {
    fn from(state: &RegistrationState) -> Self {
        match state {
            RegistrationState::PhoneNumber(p) => user_index_canister::current_user::RegistrationState::PhoneNumber(
                user_index_canister::current_user::UnconfirmedPhoneNumberState {
                    valid_until: p.valid_until,
                },
            ),
            RegistrationState::CyclesFee(c) => user_index_canister::current_user::RegistrationState::CyclesFee(
                user_index_canister::current_user::CyclesFeeState {
                    amount: c.amount,
                    valid_until: c.valid_until,
                },
            ),
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
            phone_number: Some(PhoneNumber::new(44, "000".to_owned())),
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
        }
    }
}
