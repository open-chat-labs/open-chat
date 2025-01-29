use candid::{CandidType, Deserialize, Principal};
use serde::Serialize;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub linked_principal: Principal,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    CannotUnlinkActivePrincipal,
    IdentityLinkNotFound,
    UserNotFound,
}
