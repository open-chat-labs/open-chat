use candid::CandidType;
use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{CompletedCryptoTransaction, FailedCryptoTransaction, MessageId, MultiUserChat};

#[ts_export(local_user_index, claim_prize)]
#[derive(CandidType, Serialize, Deserialize)]
pub struct Args {
    pub chat_id: MultiUserChat,
    pub message_id: MessageId,
    pub sign_in_proof_jwt: Option<String>,
    pub turnstile: Option<TurnstilePass>,
}

// A passed Cloudflare Turnstile check, issued for this user and message (see turnstile.rs)
#[ts_export(local_user_index, claim_prize)]
#[derive(CandidType, Serialize, Deserialize)]
pub struct TurnstilePass {
    pub token: String,
    // The random salt hashed with this user and message into the token's custom data
    pub salt: String,
}

// Written by hand so that `#[trace]` doesn't record the sign-in proof or the token
impl std::fmt::Debug for Args {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Args")
            .field("chat_id", &self.chat_id)
            .field("message_id", &self.message_id)
            .field("sign_in_proof_jwt_set", &self.sign_in_proof_jwt.is_some())
            .field("turnstile_set", &self.turnstile.is_some())
            .finish()
    }
}

#[ts_export(local_user_index, claim_prize)]
#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    TransferFailed(String, FailedCryptoTransaction),
    FailedAfterTransfer(String, CompletedCryptoTransaction),
    Error(OCError),
}
