use candid::{CandidType, Deserialize};
use serde::Serialize;

mod lifecycle;
mod queries;
mod updates;

pub use lifecycle::*;
pub use queries::*;
use types::CanisterId;
pub use updates::*;

// zzzxd-webau-thnke-yr7oc-cai
pub const WEBAUTHN_ORIGINATING_CANISTER: CanisterId = CanisterId::from_slice(&[129, 5, 38, 118, 168, 152, 143, 220, 33, 1]);

pub type ChallengeKey = u32;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Challenge {
    pub key: ChallengeKey,
    pub png_base64: String,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct ChallengeAttempt {
    pub key: ChallengeKey,
    pub chars: String,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct WebAuthnKey {
    #[serde(with = "serde_bytes")]
    pub public_key: Vec<u8>,
    #[serde(with = "serde_bytes")]
    pub credential_id: Vec<u8>,
    pub origin: String,
    pub cross_platform: bool,
    pub aaguid: [u8; 16]
}
