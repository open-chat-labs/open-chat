use candid::CandidType;
#[cfg(feature = "phonenumber")]
use phonenumber::PhoneNumber as _PhoneNumber;
use serde::{Deserialize, Serialize};
use std::fmt::{Display, Formatter};
#[cfg(feature = "phonenumber")]
use std::str::FromStr;

#[derive(CandidType, Serialize, Deserialize, Clone, Eq, PartialEq, Hash, Debug)]
pub struct PhoneNumber {
    country_code: u16,
    number: String,
}

impl PhoneNumber {
    pub fn new(country_code: u16, number: String) -> PhoneNumber {
        let mut phone_number = PhoneNumber { country_code, number };
        phone_number.prune_whitespace();
        phone_number
    }

    pub fn prune_whitespace(&mut self) {
        self.number.retain(|c| !c.is_whitespace());
    }

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
