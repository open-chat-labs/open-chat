use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum ProviderError {
    InvalidContentStatus,
    InvalidContentType,
    InvalidProvider,
    NotFound,
    ProviderAdminIsAlreadyRegistered,
    ProviderIsRegistered,
    RequiresWhitelisting,
    Unauthorized,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
#[expect(non_camel_case_types)]
pub enum ProviderResult {
    err(ProviderError),
    ok,
}

pub type Args = (Principal, String, Option<Principal>);
pub type Response = (ProviderResult,);
