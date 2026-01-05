use candid::{CandidType, Deserialize, Principal};
use serde::Serialize;

mod lifecycle;
mod model;
mod queries;
mod updates;

pub use lifecycle::*;
pub use model::*;
pub use queries::*;
use ts_export::ts_export;
use types::{CanisterId, UserId};
pub use updates::*;

// zzzxd-webau-thnke-yr7oc-cai
pub const WEBAUTHN_ORIGINATING_CANISTER: CanisterId = CanisterId::from_slice(&[129, 5, 38, 118, 168, 152, 143, 220, 33, 1]);

pub type ChallengeKey = u32;

#[ts_export(identity)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Challenge {
    pub key: ChallengeKey,
    pub png_base64: String,
}

#[ts_export(identity)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct ChallengeAttempt {
    pub key: ChallengeKey,
    pub chars: String,
}

#[ts_export(identity)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct WebAuthnKey {
    #[serde(with = "serde_bytes")]
    pub public_key: Vec<u8>,
    #[serde(with = "serde_bytes")]
    pub credential_id: Vec<u8>,
    pub origin: String,
    pub cross_platform: bool,
    pub aaguid: [u8; 16],
}

#[derive(CandidType, Serialize, Deserialize, Debug, Clone)]
pub struct UserIdentity {
    pub principal: Principal,
    pub user_id: Option<UserId>,
    pub email: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct UserSignedInClaims {
    pub principal: Principal,
}
