use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct Rule {
    pub description: String,
    pub id: String,
}

pub type Args = ();
pub type Response = (Vec<Rule>,);
