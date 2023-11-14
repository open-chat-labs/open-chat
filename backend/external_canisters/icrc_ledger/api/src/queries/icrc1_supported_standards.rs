use candid::{CandidType, Deserialize};

#[derive(CandidType, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct Standard {
    pub name: String,
    pub url: String,
}

pub type Response = Vec<Standard>;
