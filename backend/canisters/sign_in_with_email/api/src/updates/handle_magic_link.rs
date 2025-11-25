use candid::{CandidType, Deserialize};
use serde::Serialize;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct HandleMagicLinkArgs {
    pub link: String,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum HandleMagicLinkResponse {
    Success,
    LinkExpired,
    LinkInvalid(String),
    CodeIncorrect,
}
