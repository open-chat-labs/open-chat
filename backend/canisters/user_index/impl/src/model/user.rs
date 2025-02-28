use crate::model::diamond_membership_details::DiamondMembershipDetailsInternal;
use crate::{model::account_billing::AccountBilling, TIME_UNTIL_SUSPENDED_ACCOUNT_IS_DELETED_MILLIS};
use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use types::{
    is_default, CyclesTopUp, CyclesTopUpInternal, PhoneNumber, RegistrationFee, SuspensionAction, SuspensionDuration,
    TimestampMillis, UniquePersonProof, UserId, UserSummary, UserSummaryStable, UserSummaryV2, UserSummaryVolatile, UserType,
};
use utils::time::MonthKey;

#[derive(Serialize, Deserialize, Clone)]
pub struct User {
    #[serde(rename = "pr")]
    pub principal: Principal,
    #[serde(rename = "id")]
    pub user_id: UserId,
    #[serde(rename = "un")]
    pub username: String,
    #[serde(rename = "dn", default, skip_serializing_if = "Option::is_none")]
    pub display_name: Option<String>,
    #[serde(rename = "dnu", default, skip_serializing_if = "Option::is_none")]
    pub display_name_upper: Option<String>,
    #[serde(rename = "dc")]
    pub date_created: TimestampMillis,
    #[serde(rename = "du")]
    pub date_updated: TimestampMillis,
    #[serde(rename = "ct")]
    pub cycle_top_ups: Vec<CyclesTopUpInternal>,
    #[serde(rename = "av", default, skip_serializing_if = "Option::is_none")]
    pub avatar_id: Option<u128>,
    #[serde(rename = "rf", default, skip_serializing_if = "Option::is_none")]
    pub registration_fee: Option<RegistrationFee>,
    #[serde(rename = "ab", default, skip_serializing_if = "AccountBilling::is_empty")]
    pub account_billing: AccountBilling,
    #[serde(rename = "ps", default, skip_serializing_if = "is_default")]
    pub phone_status: PhoneStatus,
    #[serde(rename = "rb", default, skip_serializing_if = "Option::is_none")]
    pub referred_by: Option<UserId>,
    #[serde(rename = "ut", default, skip_serializing_if = "is_default")]
    pub user_type: UserType,
    #[serde(rename = "sd", default, skip_serializing_if = "Option::is_none")]
    pub suspension_details: Option<SuspensionDetails>,
    #[serde(
        rename = "dm",
        default,
        skip_serializing_if = "DiamondMembershipDetailsInternal::has_never_been_diamond_member"
    )]
    pub diamond_membership_details: DiamondMembershipDetailsInternal,
    #[serde(rename = "mf", default, skip_serializing_if = "is_default")]
    pub moderation_flags_enabled: u32,
    #[serde(rename = "rm", default, skip_serializing_if = "Vec::is_empty")]
    pub reported_messages: Vec<u64>,
    #[serde(rename = "cm", default, skip_serializing_if = "is_default")]
    pub chit_per_month: BTreeMap<MonthKey, i32>,
    #[serde(rename = "sk", default, skip_serializing_if = "is_default")]
    pub streak: u16,
    #[serde(rename = "se", default, skip_serializing_if = "is_default")]
    pub streak_ends: TimestampMillis,
    #[serde(rename = "ms", default, skip_serializing_if = "is_default")]
    pub max_streak: u16,
    #[serde(rename = "cu", default)]
    pub chit_updated: TimestampMillis,
    #[serde(rename = "lc", default)]
    pub latest_chit_event: TimestampMillis,
    #[serde(rename = "lcp", default)]
    pub latest_chit_event_previous_month: TimestampMillis,
    #[serde(rename = "uh", default, skip_serializing_if = "Option::is_none")]
    pub unique_person_proof: Option<UniquePersonProof>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Default, Eq, PartialEq)]
pub enum PhoneStatus {
    #[default]
    None,
    Unconfirmed(UnconfirmedPhoneNumber),
    Confirmed(PhoneNumber),
}

impl User {
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        principal: Principal,
        user_id: UserId,
        username: String,
        display_name: Option<String>,
        now: TimestampMillis,
        referred_by: Option<UserId>,
        user_type: UserType,
        avatar_id: Option<u128>,
    ) -> User {
        let display_name_upper = display_name.as_ref().map(|dn| dn.to_uppercase());

        User {
            principal,
            user_id,
            username,
            display_name,
            display_name_upper,
            date_created: now,
            date_updated: now,
            cycle_top_ups: Vec::new(),
            avatar_id,
            registration_fee: None,
            account_billing: AccountBilling::default(),
            phone_status: PhoneStatus::None,
            referred_by,
            user_type,
            suspension_details: None,
            diamond_membership_details: DiamondMembershipDetailsInternal::default(),
            moderation_flags_enabled: 0,
            reported_messages: Vec::new(),
            chit_per_month: BTreeMap::new(),
            chit_updated: now,
            streak: 0,
            streak_ends: 0,
            max_streak: 0,
            latest_chit_event: 0,
            latest_chit_event_previous_month: 0,
            unique_person_proof: None,
        }
    }

    pub fn to_summary(&self, now: TimestampMillis) -> UserSummary {
        UserSummary {
            user_id: self.user_id,
            username: self.username.clone(),
            display_name: self.display_name.clone(),
            avatar_id: self.avatar_id,
            is_bot: self.user_type.is_bot(),
            suspended: self.suspension_details.is_some(),
            diamond_member: self.diamond_membership_details.is_active(now),
            diamond_membership_status: self.diamond_membership_details.status(now),
            total_chit_earned: self.total_chit_earned(),
            chit_balance: self.current_chit_balance(now),
            streak: self.streak(now),
            max_streak: self.max_streak,
            is_unique_person: self.unique_person_proof.is_some(),
        }
    }

    pub fn to_summary_v2(&self, now: TimestampMillis, month_key: MonthKey) -> UserSummaryV2 {
        UserSummaryV2 {
            user_id: self.user_id,
            stable: Some(self.to_summary_stable(now)),
            volatile: Some(self.to_summary_volatile(now, month_key)),
        }
    }

    pub fn to_summary_stable(&self, now: TimestampMillis) -> UserSummaryStable {
        UserSummaryStable {
            username: self.username.clone(),
            display_name: self.display_name.clone(),
            avatar_id: self.avatar_id,
            is_bot: self.user_type.is_bot(),
            suspended: self.suspension_details.is_some(),
            diamond_membership_status: self.diamond_membership_details.status(now),
            is_unique_person: self.unique_person_proof.is_some(),
        }
    }

    pub fn to_summary_volatile(&self, now: TimestampMillis, month_key: MonthKey) -> UserSummaryVolatile {
        UserSummaryVolatile {
            total_chit_earned: self.total_chit_earned(),
            chit_balance: self.chit_per_month.get(&month_key).copied().unwrap_or_default(),
            streak: self.streak(now),
            max_streak: self.max_streak,
        }
    }

    pub fn streak(&self, now: TimestampMillis) -> u16 {
        if self.streak_ends > now {
            self.streak
        } else {
            0
        }
    }

    pub fn set_avatar_id(&mut self, avatar_id: Option<u128>, now: TimestampMillis) {
        self.avatar_id = avatar_id;
        self.date_updated = now;
    }

    pub fn mark_cycles_top_up(&mut self, top_up: CyclesTopUp) {
        self.cycle_top_ups.push(top_up.into())
    }

    pub fn total_chit_earned(&self) -> i32 {
        self.chit_per_month.values().copied().sum()
    }

    pub fn current_chit_balance(&self, now: TimestampMillis) -> i32 {
        self.chit_per_month
            .get(&MonthKey::from_timestamp(now))
            .copied()
            .unwrap_or_default()
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

impl From<&SuspensionDetails> for types::SuspensionDetails {
    fn from(value: &SuspensionDetails) -> Self {
        types::SuspensionDetails {
            reason: value.reason.to_owned(),
            action: match value.duration {
                SuspensionDuration::Duration(ms) => SuspensionAction::Unsuspend(value.timestamp + ms),
                SuspensionDuration::Indefinitely => {
                    SuspensionAction::Delete(value.timestamp + TIME_UNTIL_SUSPENDED_ACCOUNT_IS_DELETED_MILLIS)
                }
            },
            suspended_by: value.suspended_by,
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
            user_type: UserType::User,
            suspension_details: None,
            diamond_membership_details: DiamondMembershipDetailsInternal::default(),
            moderation_flags_enabled: 0,
            reported_messages: Vec::new(),
            chit_per_month: BTreeMap::new(),
            streak: 0,
            max_streak: 0,
            streak_ends: 0,
            chit_updated: 0,
            latest_chit_event: 0,
            latest_chit_event_previous_month: 0,
            unique_person_proof: None,
        }
    }
}
