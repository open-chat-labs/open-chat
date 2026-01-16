use crate::EmailSenderConfigPublic;
use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize)]
pub struct Response {
    pub email_sender_rsa_public_key: String,
    pub email_sender_config: Option<EmailSenderConfigPublic>,
}
