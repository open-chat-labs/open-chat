use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::Empty;

pub type Args = Empty;

#[derive(CandidType, Deserialize, Serialize)]
pub struct Response {
    pub url: Option<String>,
    pub logo: Option<String>,
    pub name: Option<String>,
    pub description: Option<String>,
}
