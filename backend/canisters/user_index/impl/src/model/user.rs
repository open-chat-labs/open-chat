use crate::model::account_billing::AccountBilling;
use crate::model::diamond_membership_details::DiamondMembershipDetailsInternal;
use crate::model::streak::Streak;
use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use types::{
    is_default, is_empty_slice, CyclesTopUp, CyclesTopUpInternal, Milliseconds, PhoneNumber, RegistrationFee, TimestampMillis,
    UserId, UserSummary,
};

#[derive(Serialize, Deserialize, Clone)]
pub struct User {
    #[serde(rename = "pr", alias = "principal")]
    pub principal: Principal,
    #[serde(rename = "id", alias = "user_id")]
    pub user_id: UserId,
    #[serde(rename = "un", alias = "username")]
    pub username: String,
    #[serde(rename = "dn", alias = "display_name", default, skip_serializing_if = "Option::is_none")]
    pub display_name: Option<String>,
    #[serde(
        rename = "dnu",
        alias = "display_name_upper",
        default,
        skip_serializing_if = "Option::is_none"
    )]
    pub display_name_upper: Option<String>,
    #[serde(rename = "dc", alias = "date_created")]
    pub date_created: TimestampMillis,
    #[serde(rename = "du", alias = "date_updated")]
    pub date_updated: TimestampMillis,
    #[serde(rename = "ct", alias = "cycle_top_ups")]
    pub cycle_top_ups: Vec<CyclesTopUpInternal>,
    #[serde(rename = "av", alias = "avatar_id", default, skip_serializing_if = "Option::is_none")]
    pub avatar_id: Option<u128>,
    #[serde(rename = "rf", alias = "registration_fee", default, skip_serializing_if = "Option::is_none")]
    pub registration_fee: Option<RegistrationFee>,
    #[serde(rename = "ab", alias = "account_billing")]
    pub account_billing: AccountBilling,
    #[serde(rename = "ps", alias = "phone_status", default, skip_serializing_if = "is_default")]
    pub phone_status: PhoneStatus,
    #[serde(rename = "rb", alias = "referred_by", default, skip_serializing_if = "Option::is_none")]
    pub referred_by: Option<UserId>,
    #[serde(rename = "ib", alias = "is_bot", default, skip_serializing_if = "is_default")]
    pub is_bot: bool,
    #[serde(
        rename = "sd",
        alias = "suspension_details",
        default,
        skip_serializing_if = "Option::is_none"
    )]
    pub suspension_details: Option<SuspensionDetails>,
    #[serde(
        rename = "dm",
        alias = "diamond_membership_details",
        default,
        skip_serializing_if = "DiamondMembershipDetailsInternal::has_never_been_diamond_member"
    )]
    pub diamond_membership_details: DiamondMembershipDetailsInternal,
    #[serde(
        rename = "mf",
        alias = "moderation_flags_enabled",
        default,
        skip_serializing_if = "is_default"
    )]
    pub moderation_flags_enabled: u32,
    #[serde(rename = "rm", alias = "reported_messages", default, skip_serializing_if = "is_empty_slice")]
    pub reported_messages: Vec<u64>,
    #[serde(rename = "cb", alias = "chit_balance", default, skip_serializing_if = "is_default")]
    pub chit_balance: i32,
    #[serde(rename = "st", alias = "streak", default, skip_serializing_if = "is_default")]
    pub streak: Streak,
}

impl User {
    pub fn set_avatar_id(&mut self, avatar_id: Option<u128>, now: TimestampMillis) {
        self.avatar_id = avatar_id;
        self.date_updated = now;
    }

    pub fn mark_cycles_top_up(&mut self, top_up: CyclesTopUp) {
        self.cycle_top_ups.push(top_up.into())
    }

    pub fn claim_daily_chit(&mut self, now: TimestampMillis) -> Option<ClaimDailyChitResult> {
        fn chit_for_streak(days: u16) -> u32 {
            if days == 0 {
                return 0;
            }
            if days < 3 {
                return 200;
            }
            if days < 7 {
                return 300;
            }
            if days < 30 {
                return 400;
            }
            500
        }

        if !self.streak.claim(now) {
            return None;
        }

        let streak = self.streak.days(now);
        let chit_earned = chit_for_streak(streak);
        let chit_balance = self.chit_balance + chit_earned as i32;

        self.chit_balance = chit_balance;
        self.date_updated = now;

        Some(ClaimDailyChitResult {
            user_id: self.user_id,
            chit_earned,
            chit_balance,
            streak,
        })
    }
}

pub struct ClaimDailyChitResult {
    pub user_id: UserId,
    pub chit_earned: u32,
    pub chit_balance: i32,
    pub streak: u16,
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
        referred_by: Option<UserId>,
        is_bot: bool,
    ) -> User {
        User {
            principal,
            user_id,
            username,
            display_name: None,
            display_name_upper: None,
            date_created: now,
            date_updated: now,
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
            chit_balance: 0,
            streak: Streak::default(),
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
            diamond_membership_status: self.diamond_membership_details.status(now),
            chit_balance: self.chit_balance,
            streak: self.streak.days(now),
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
            chit_balance: 0,
            streak: Streak::default(),
        }
    }
}
