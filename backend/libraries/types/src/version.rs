use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::fmt::{Display, Formatter};
use std::str::FromStr;

#[derive(CandidType, Serialize, Deserialize, Clone, Copy, Debug, Default, Ord, PartialOrd, Eq, PartialEq)]
pub struct Version {
    pub major: u32,
    pub minor: u32,
    pub patch: u32,
}

impl Version {
    pub fn new(major: u32, minor: u32, patch: u32) -> Version {
        Version { major, minor, patch }
    }

    pub fn min() -> Version {
        Version::default()
    }
}

impl Display for Version {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        f.write_str(&format!("{}.{}.{}", self.major, self.minor, self.patch))
    }
}

impl FromStr for Version {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        let parts: Vec<_> = s.split('.').collect();
        if parts.len() != 3 {
            return Err(format!("Unable to parse version: {s}"));
        }

        let major = u32::from_str(parts[0]).map_err(|e| e.to_string())?;
        let minor = u32::from_str(parts[1]).map_err(|e| e.to_string())?;
        let patch = u32::from_str(parts[2]).map_err(|e| e.to_string())?;

        Ok(Version { major, minor, patch })
    }
}
