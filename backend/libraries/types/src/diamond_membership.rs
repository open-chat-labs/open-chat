use crate::{Milliseconds, TimestampMillis};
use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::fmt::{Display, Formatter};

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

#[derive(CandidType, Serialize, Deserialize, Debug, Clone)]
pub struct DiamondMembershipFees {
    pub chat_fees: DiamondMembershipFeesByDuration,
    pub icp_fees: DiamondMembershipFeesByDuration,
}

#[derive(CandidType, Serialize, Deserialize, Debug, Clone)]
pub struct DiamondMembershipFeesByDuration {
    pub one_month: u64,
    pub three_months: u64,
    pub one_year: u64,
    pub lifetime: u64,
}

impl DiamondMembershipFees {
    pub fn chat_price_e8s(&self, duration: DiamondMembershipPlanDuration) -> u64 {
        match duration {
            DiamondMembershipPlanDuration::OneMonth => self.chat_fees.one_month,
            DiamondMembershipPlanDuration::ThreeMonths => self.chat_fees.three_months,
            DiamondMembershipPlanDuration::OneYear => self.chat_fees.one_year,
            DiamondMembershipPlanDuration::Lifetime => self.chat_fees.lifetime,
        }
    }

    pub fn icp_price_e8s(&self, duration: DiamondMembershipPlanDuration) -> u64 {
        match duration {
            DiamondMembershipPlanDuration::OneMonth => self.icp_fees.one_month,
            DiamondMembershipPlanDuration::ThreeMonths => self.icp_fees.three_months,
            DiamondMembershipPlanDuration::OneYear => self.icp_fees.one_year,
            DiamondMembershipPlanDuration::Lifetime => self.icp_fees.lifetime,
        }
    }
}

impl Default for DiamondMembershipFees {
    fn default() -> Self {
        DiamondMembershipFees {
            chat_fees: DiamondMembershipFeesByDuration {
                one_month: 200_000_000,    // 2 CHAT
                three_months: 500_000_000, // 5 CHAT
                one_year: 1_500_000_000,   // 15 CHAT
                lifetime: 6_000_000_000,   // 60 CHAT
            },
            icp_fees: DiamondMembershipFeesByDuration {
                one_month: 15_000_000,    // 0.15 ICP
                three_months: 35_000_000, // 0.35 ICP
                one_year: 100_000_000,    // 1 ICP
                lifetime: 400_000_000,    // 4 ICP
            },
        }
    }
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

    pub const fn is_lifetime(&self) -> bool {
        matches!(self, DiamondMembershipPlanDuration::Lifetime)
    }
}

#[derive(CandidType, Serialize, Deserialize, Clone, Copy, Debug, Default, Eq, PartialEq)]
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

impl Display for DiamondMembershipPlanDuration {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        f.write_str(match self {
            DiamondMembershipPlanDuration::OneMonth => "1 month",
            DiamondMembershipPlanDuration::ThreeMonths => "3 months",
            DiamondMembershipPlanDuration::OneYear => "1 year",
            DiamondMembershipPlanDuration::Lifetime => "Lifetime",
        })
    }
}
