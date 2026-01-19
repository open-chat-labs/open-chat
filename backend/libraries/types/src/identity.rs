use candid::{Deserialize, Principal};
use serde::Serialize;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct UserSignedInClaims {
    pub principal: Principal,
}
