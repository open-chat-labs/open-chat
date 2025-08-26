use candid::{CandidType, Deserialize, Principal};
use serde::Serialize;
use ts_export::ts_export;

#[ts_export(identity, remove_identity_link)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub linked_principal: Principal,
}

#[ts_export(identity, remove_identity_link)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    CannotUnlinkActivePrincipal,
    IdentityLinkNotFound,
    UserNotFound,
}
