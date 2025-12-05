use crate::state;
use ic_cdk::query;
use rsa::pkcs8::{EncodePublicKey, LineEnding};
use sign_in_with_email_canister::email_sender_config::Response;

#[query]
fn email_sender_config() -> Response {
    state::read(|s| Response {
        email_sender_rsa_public_key: s.email_sender_rsa_public_key().to_public_key_pem(LineEnding::LF).unwrap(),
        email_sender_config: s.email_sender_config().map(|c| c.into()),
    })
}
