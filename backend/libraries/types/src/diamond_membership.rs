use crate::{Milliseconds, TimestampMillis};
use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Default)]
pub struct DiamondMembershipDetails {
    pub expires_at: TimestampMillis,
    pub pay_in_chat: bool,
    #[deprecated]
    pub recurring: Option<DiamondMembershipSubscription>,
    pub subscription: DiamondMembershipSubscription,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum DiamondMembershipStatusFull {
    Inactive,
    Active(DiamondMembershipDetails),
    Lifetime,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Copy, Debug)]
#[repr(u8)]
pub enum DiamondMembershipStatus {
    Inactive = 0,
    Active = 1,
    Lifetime = 2,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Copy, Debug)]
#[repr(u8)]
pub enum DiamondMembershipPlanDuration {
    OneMonth = 1,
    ThreeMonths = 3,
    OneYear = 12,
    Lifetime = 255,
}

impl DiamondMembershipPlanDuration {
    // Using 1 year = 365.25 days
    const MONTH_IN_MS: Milliseconds = ((4 * 365) + 1) * 24 * 60 * 60 * 1000 / (4 * 12);

    pub const fn as_millis(&self) -> Milliseconds {
        match self {
            Self::OneMonth => Self::MONTH_IN_MS,
            Self::ThreeMonths => 3 * Self::MONTH_IN_MS,
            Self::OneYear => 12 * Self::MONTH_IN_MS,
            Self::Lifetime => 1000 * 12 * Self::MONTH_IN_MS,
        }
    }

    pub const fn icp_price_e8s(&self) -> u64 {
        match self {
            DiamondMembershipPlanDuration::OneMonth => 15_000_000,    // 0.15 ICP
            DiamondMembershipPlanDuration::ThreeMonths => 35_000_000, // 0.35 ICP
            DiamondMembershipPlanDuration::OneYear => 100_000_000,    // 1 ICP
            DiamondMembershipPlanDuration::Lifetime => 400_000_000,   // 4 ICP
        }
    }

    pub const fn chat_price_e8s(&self) -> u64 {
        match self {
            DiamondMembershipPlanDuration::OneMonth => 200_000_000,    // 2 CHAT
            DiamondMembershipPlanDuration::ThreeMonths => 500_000_000, // 5 CHAT
            DiamondMembershipPlanDuration::OneYear => 1_500_000_000,   // 15 CHAT
            DiamondMembershipPlanDuration::Lifetime => 60_000_000_000, // 60 CHAT
        }
    }

    pub const fn is_lifetime(&self) -> bool {
        matches!(self, DiamondMembershipPlanDuration::Lifetime)
    }
}

#[derive(CandidType, Serialize, Deserialize, Clone, Copy, Debug, Default)]
#[repr(u8)]
pub enum DiamondMembershipSubscription {
    #[default]
    Disabled = 0,
    OneMonth = 1,
    ThreeMonths = 3,
    OneYear = 12,
}

impl DiamondMembershipSubscription {
    pub fn is_active(&self) -> bool {
        !matches!(self, DiamondMembershipSubscription::Disabled)
    }
}

impl From<DiamondMembershipPlanDuration> for DiamondMembershipSubscription {
    fn from(value: DiamondMembershipPlanDuration) -> Self {
        match value {
            DiamondMembershipPlanDuration::OneMonth => DiamondMembershipSubscription::OneMonth,
            DiamondMembershipPlanDuration::ThreeMonths => DiamondMembershipSubscription::ThreeMonths,
            DiamondMembershipPlanDuration::OneYear => DiamondMembershipSubscription::OneYear,
            DiamondMembershipPlanDuration::Lifetime => DiamondMembershipSubscription::Disabled,
        }
    }
}

impl TryFrom<DiamondMembershipSubscription> for DiamondMembershipPlanDuration {
    type Error = ();

    fn try_from(value: DiamondMembershipSubscription) -> Result<Self, Self::Error> {
        match value {
            DiamondMembershipSubscription::Disabled => Err(()),
            DiamondMembershipSubscription::OneMonth => Ok(DiamondMembershipPlanDuration::OneMonth),
            DiamondMembershipSubscription::ThreeMonths => Ok(DiamondMembershipPlanDuration::ThreeMonths),
            DiamondMembershipSubscription::OneYear => Ok(DiamondMembershipPlanDuration::OneYear),
        }
    }
}
