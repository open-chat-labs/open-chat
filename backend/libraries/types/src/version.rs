use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::fmt::{Display, Formatter};
use ts_export::ts_export;

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Debug, Default, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct Version(u32);

impl Version {
    pub fn incr(&self) -> Version {
        Version(self.0.saturating_add(1))
    }

    pub fn zero() -> Version {
        Version(0)
    }
}

impl From<u32> for Version {
    fn from(val: u32) -> Self {
        Version(val)
    }
}

impl From<Version> for u32 {
    fn from(version: Version) -> Self {
        version.0
    }
}

impl Display for Version {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        self.0.fmt(f)
    }
}
