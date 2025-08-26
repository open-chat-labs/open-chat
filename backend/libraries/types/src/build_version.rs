use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::fmt::{Display, Formatter};
use std::str::FromStr;
use ts_export::ts_export;

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Copy, Debug, Default, Ord, PartialOrd, Eq, PartialEq, Hash)]
pub struct BuildVersion {
    pub major: u32,
    pub minor: u32,
    pub patch: u32,
}

impl BuildVersion {
    pub fn new(major: u32, minor: u32, patch: u32) -> BuildVersion {
        BuildVersion { major, minor, patch }
    }

    pub fn min() -> BuildVersion {
        BuildVersion::default()
    }
}

impl Display for BuildVersion {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        f.write_str(&format!("{}.{}.{}", self.major, self.minor, self.patch))
    }
}

impl FromStr for BuildVersion {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        let parts: Vec<_> = s.split('.').collect();
        if parts.len() != 3 {
            return Err(format!("Unable to parse version: {s}"));
        }

        let major = u32::from_str(parts[0]).map_err(|e| e.to_string())?;
        let minor = u32::from_str(parts[1]).map_err(|e| e.to_string())?;
        let patch = u32::from_str(parts[2]).map_err(|e| e.to_string())?;

        Ok(BuildVersion { major, minor, patch })
    }
}
