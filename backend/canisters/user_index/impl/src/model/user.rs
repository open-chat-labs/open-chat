use crate::model::account_billing::AccountBilling;
use crate::model::diamond_membership_details::DiamondMembershipDetailsInternal;
use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use types::{
    CanisterId, CyclesTopUp, Milliseconds, PartialUserSummary, PhoneNumber, RegistrationFee, TimestampMillis, UserId,
    UserSummary, Version,
};

// See `validate_dev_team_user_ids` test at the bottom of this file for validation that these are
// the correct userIds
const DEV_TEAM_USER_IDS: [UserId; 3] = [
    UserId::new(CanisterId::from_slice(&[0, 0, 0, 0, 0, 160, 0, 55, 1, 1])), // 3skqk-iqaaa-aaaaf-aaa3q-cai
    UserId::new(CanisterId::from_slice(&[0, 0, 0, 0, 0, 160, 0, 56, 1, 1])), // 27eue-hyaaa-aaaaf-aaa4a-cai
    UserId::new(CanisterId::from_slice(&[0, 0, 0, 0, 0, 160, 0, 57, 1, 1])), // 2yfsq-kaaaa-aaaaf-aaa4q-cai
];

#[derive(Serialize, Deserialize, Clone)]
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
    pub phone_status: PhoneStatus,
    pub referred_by: Option<UserId>,
    pub is_bot: bool,
    pub suspension_details: Option<SuspensionDetails>,
    pub diamond_membership_details: DiamondMembershipDetailsInternal,
}

impl User {
    pub fn set_avatar_id(&mut self, avatar_id: Option<u128>, now: TimestampMillis) {
        self.avatar_id = avatar_id;
        self.date_updated = now;
    }

    pub fn mark_cycles_top_up(&mut self, top_up: CyclesTopUp) {
        self.cycle_top_ups.push(top_up)
    }

    pub fn is_eligible_for_initial_airdrop(&self) -> bool {
        // 2023-02-27 15:56 GMT (the time of this Tweet - https://twitter.com/OpenChat/status/1630235287941988353)
        const INITIAL_AIRDROP_CUTOFF: TimestampMillis = 1677513360000;

        self.was_diamond_member_at(INITIAL_AIRDROP_CUTOFF) && !DEV_TEAM_USER_IDS.contains(&self.user_id)
    }

    pub fn was_diamond_member_at(&self, timestamp: TimestampMillis) -> bool {
        // Users who got 1 year for free
        if self.diamond_membership_details.payments().is_empty() && self.diamond_membership_details.is_active(timestamp) {
            return true;
        }

        self.diamond_membership_details
            .payments()
            .iter()
            .any(|p| p.timestamp < timestamp && timestamp < p.timestamp + p.duration.as_millis())
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
            phone_status: PhoneStatus::None,
            referred_by,
            is_bot,
            suspension_details: None,
            diamond_membership_details: DiamondMembershipDetailsInternal::default(),
        }
    }

    pub fn to_summary(&self, now: TimestampMillis) -> UserSummary {
        UserSummary {
            user_id: self.user_id,
            username: self.username.clone(),
            avatar_id: self.avatar_id,
            is_bot: self.is_bot,
            suspended: self.suspension_details.is_some(),
            seconds_since_last_online: 0,
            diamond_member: self.diamond_membership_details.is_active(now),
        }
    }

    pub fn to_partial_summary(&self, now: TimestampMillis) -> PartialUserSummary {
        PartialUserSummary {
            user_id: self.user_id,
            username: Some(self.username.clone()),
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
            phone_status: PhoneStatus::None,
            referred_by: None,
            is_bot: false,
            suspension_details: None,
            diamond_membership_details: DiamondMembershipDetailsInternal::default(),
        }
    }
}

#[test]
fn validate_dev_team_user_ids() {
    assert_eq!(
        CanisterId::from_slice(&[0, 0, 0, 0, 0, 160, 0, 55, 1, 1]),
        CanisterId::from_text("3skqk-iqaaa-aaaaf-aaa3q-cai").unwrap()
    );
    assert_eq!(
        CanisterId::from_slice(&[0, 0, 0, 0, 0, 160, 0, 56, 1, 1]),
        CanisterId::from_text("27eue-hyaaa-aaaaf-aaa4a-cai").unwrap()
    );
    assert_eq!(
        CanisterId::from_slice(&[0, 0, 0, 0, 0, 160, 0, 57, 1, 1]),
        CanisterId::from_text("2yfsq-kaaaa-aaaaf-aaa4q-cai").unwrap()
    );
}
