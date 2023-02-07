use crate::{Milliseconds, TimestampMillis};
use candid::types::{Serializer, Type};
use candid::CandidType;
use serde::{Deserialize, Deserializer, Serialize};

#[derive(CandidType, Serialize, Deserialize, Debug, Default)]
pub struct DiamondMembershipDetails {
    pub expires_at: TimestampMillis,
    pub recurring: Option<DiamondMembershipPlanDuration>,
}

#[derive(Clone, Copy, Debug)]
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

    const fn months(&self) -> u8 {
        match self {
            DiamondMembershipPlanDuration::OneMonth => 1,
            DiamondMembershipPlanDuration::ThreeMonths => 3,
            DiamondMembershipPlanDuration::OneYear => 12,
        }
    }
}

impl CandidType for DiamondMembershipPlanDuration {
    fn _ty() -> Type {
        u8::_ty()
    }

    fn idl_serialize<S>(&self, serializer: S) -> Result<(), S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_nat8(self.months())
    }
}

impl Serialize for DiamondMembershipPlanDuration {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_u8(self.months())
    }
}

impl<'de> Deserialize<'de> for DiamondMembershipPlanDuration {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let months = u8::deserialize(deserializer)?;

        match months {
            1 => Ok(DiamondMembershipPlanDuration::OneMonth),
            3 => Ok(DiamondMembershipPlanDuration::ThreeMonths),
            12 => Ok(DiamondMembershipPlanDuration::OneYear),
            _ => Err(serde::de::Error::custom(format!("invalid value: {months}"))),
        }
    }
}
