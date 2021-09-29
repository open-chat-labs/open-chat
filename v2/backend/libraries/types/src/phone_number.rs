use candid::CandidType;
#[cfg(feature = "phonenumber")]
use phonenumber::PhoneNumber as _PhoneNumber;
use serde::{Deserialize, Serialize};
#[cfg(feature = "phonenumber")]
use std::str::FromStr;
use std::fmt::{Display, Formatter};

#[derive(CandidType, Serialize, Deserialize, Clone, Eq, PartialEq, Hash, Debug)]
pub struct PhoneNumber {
    pub country_code: u16,
    pub number: String,
}

impl PhoneNumber {
    #[cfg(feature = "phonenumber")]
    pub fn is_valid(&self) -> bool {
        _PhoneNumber::from_str(&self.to_string()).is_ok()
    }
}

impl Display for PhoneNumber {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        f.write_fmt(format_args!("+{} {}", self.country_code, self.number))
    }
}