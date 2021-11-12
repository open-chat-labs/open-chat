use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::fmt::{Display, Formatter};

const MIN_LENGTH: usize = 3;
const MAX_LENGTH: usize = 15;

#[derive(CandidType, Serialize, Deserialize, Clone, Eq, PartialEq, Hash, Debug)]
pub struct PhoneNumber {
    pub country_code: u16,
    pub number: String,
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

    pub fn is_valid(&self) -> bool {
        self.country_code > 0
            && (MIN_LENGTH..=MAX_LENGTH).contains(&self.number.len())
            && self.number.chars().all(|c| c.is_ascii_digit())
    }
}

impl Display for PhoneNumber {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        f.write_fmt(format_args!("+{} {}", self.country_code, self.number))
    }
}
