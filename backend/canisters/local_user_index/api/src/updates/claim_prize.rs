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
    // A Cloudflare Turnstile token, issued for this user and message (see turnstile.rs)
    pub turnstile_token: Option<String>,
}

// Written by hand so that `#[trace]` doesn't record the sign-in proof or the token
impl std::fmt::Debug for Args {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Args")
            .field("chat_id", &self.chat_id)
            .field("message_id", &self.message_id)
            .field("sign_in_proof_jwt_set", &self.sign_in_proof_jwt.is_some())
            .field("turnstile_token_set", &self.turnstile_token.is_some())
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
