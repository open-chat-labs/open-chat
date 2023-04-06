use crate::{Milliseconds, TimestampMillis};
use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Debug, Default)]
pub struct DiamondMembershipDetails {
    pub expires_at: TimestampMillis,
    pub recurring: Option<DiamondMembershipPlanDuration>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Copy, Debug)]
#[repr(u8)]
pub enum DiamondMembershipPlanDuration {
    OneMonth = 1,
    ThreeMonths = 3,
    OneYear = 12,
}

impl DiamondMembershipPlanDuration {
    // Using 1 year = 365.25 days
    const MONTH_IN_MS: Milliseconds = ((4 * 365) + 1) * 24 * 60 * 60 * 1000 / (4 * 12);

    pub const fn as_millis(&self) -> Milliseconds {
        match self {
            Self::OneMonth => Self::MONTH_IN_MS,
            Self::ThreeMonths => 3 * Self::MONTH_IN_MS,
            Self::OneYear => 12 * Self::MONTH_IN_MS,
        }
    }

    pub const fn icp_price_e8s(&self) -> u64 {
        match self {
            DiamondMembershipPlanDuration::OneMonth => 20_000_000,    // 0.2 ICP
            DiamondMembershipPlanDuration::ThreeMonths => 50_000_000, // 0.5 ICP
            DiamondMembershipPlanDuration::OneYear => 150_000_000,    // 1.5 ICP
        }
    }
}
