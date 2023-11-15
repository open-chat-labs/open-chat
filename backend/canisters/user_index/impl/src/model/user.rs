use crate::model::account_billing::AccountBilling;
use crate::model::diamond_membership_details::DiamondMembershipDetailsInternal;
use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use types::{CyclesTopUp, Milliseconds, PhoneNumber, RegistrationFee, TimestampMillis, UserId, UserSummary};

#[derive(Serialize, Deserialize, Clone)]
pub struct User {
    pub principal: Principal,
    pub user_id: UserId,
    pub username: String,
    pub display_name: Option<String>,
    pub display_name_upper: Option<String>,
    pub date_created: TimestampMillis,
    pub date_updated: TimestampMillis,
    pub upgrade_in_progress: bool,
    pub cycle_top_ups: Vec<CyclesTopUp>,
    pub avatar_id: Option<u128>,
    pub registration_fee: Option<RegistrationFee>,
    pub account_billing: AccountBilling,
    pub phone_status: PhoneStatus,
    pub referred_by: Option<UserId>,
    pub is_bot: bool,
    pub suspension_details: Option<SuspensionDetails>,
    pub diamond_membership_details: DiamondMembershipDetailsInternal,
    pub moderation_flags_enabled: u32,
    pub reported_messages: Vec<u64>,
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

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Default, Eq, PartialEq)]
pub enum PhoneStatus {
    #[default]
    None,
    Unconfirmed(UnconfirmedPhoneNumber),
    Confirmed(PhoneNumber),
}

impl User {
    pub fn new(
        principal: Principal,
        user_id: UserId,
        username: String,
        display_name: Option<String>,
        now: TimestampMillis,
        referred_by: Option<UserId>,
        is_bot: bool,
    ) -> User {
        let display_name_upper = display_name.as_ref().map(|s| s.to_uppercase());
        User {
            principal,
            user_id,
            username,
            display_name,
            display_name_upper,
            date_created: now,
            date_updated: now,
            upgrade_in_progress: false,
            cycle_top_ups: Vec::new(),
            avatar_id: None,
            registration_fee: None,
            account_billing: AccountBilling::default(),
            phone_status: PhoneStatus::None,
            referred_by,
            is_bot,
            suspension_details: None,
            diamond_membership_details: DiamondMembershipDetailsInternal::default(),
            moderation_flags_enabled: 0,
            reported_messages: Vec::new(),
        }
    }

    pub fn to_summary(&self, now: TimestampMillis) -> UserSummary {
        UserSummary {
            user_id: self.user_id,
            username: self.username.clone(),
            display_name: self.display_name.clone(),
            avatar_id: self.avatar_id,
            is_bot: self.is_bot,
            suspended: self.suspension_details.is_some(),
            diamond_member: self.diamond_membership_details.is_active(now),
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

impl From<SuspensionDuration> for Option<Milliseconds> {
    fn from(value: SuspensionDuration) -> Self {
        if let SuspensionDuration::Duration(duration) = value {
            Some(duration)
        } else {
            None
        }
    }
}

#[cfg(test)]
impl Default for User {
    fn default() -> Self {
        User {
            principal: Principal::anonymous(),
            user_id: Principal::anonymous().into(),
            username: String::new(),
            display_name: None,
            display_name_upper: None,
            date_created: 0,
            date_updated: 0,
            upgrade_in_progress: false,
            cycle_top_ups: Vec::new(),
            avatar_id: None,
            registration_fee: None,
            account_billing: AccountBilling::default(),
            phone_status: PhoneStatus::None,
            referred_by: None,
            is_bot: false,
            suspension_details: None,
            diamond_membership_details: DiamondMembershipDetailsInternal::default(),
            moderation_flags_enabled: 0,
            reported_messages: Vec::new(),
        }
    }
}
