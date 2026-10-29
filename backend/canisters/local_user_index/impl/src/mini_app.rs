use crate::RuntimeState;
use rand::SeedableRng;
use rand::rngs::StdRng;
use serde::Serialize;
use types::{Milliseconds, TimestampMillis};

// The MiniApp service's tokens last an hour, so the website can keep them to reconnect with
pub const MINI_APP_TOKEN_VALIDITY: Milliseconds = 60 * 60 * 1000;

// Signs one of the MiniApp service's tokens with OpenChat's key, for an hour
pub fn sign_token<T: Serialize>(claim_type: &str, claims: T, state: &mut RuntimeState) -> Result<String, String> {
    let expiry = state.env.now() + MINI_APP_TOKEN_VALIDITY;
    sign_token_until(claim_type, claims, expiry, state)
}

// Signs one of the MiniApp service's tokens with OpenChat's key, until `expiry`
pub fn sign_token_until<T: Serialize>(
    claim_type: &str,
    claims: T,
    expiry: TimestampMillis,
    state: &mut RuntimeState,
) -> Result<String, String> {
    if !state.data.oc_key_pair.is_initialised() {
        return Err("OC Secret not set".to_string());
    }

    let mut rng = StdRng::from_seed(state.env.entropy());
    let claims = jwt::Claims::new(expiry, claim_type.to_string(), claims);

    jwt::sign_and_encode_token(state.data.oc_key_pair.secret_key_der(), claims, &mut rng).map_err(|error| format!("{error:?}"))
}
