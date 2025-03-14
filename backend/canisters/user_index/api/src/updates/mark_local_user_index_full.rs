use candid::CandidType;
use human_readable::{HumanReadablePrincipal, ToHumanReadable};
use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use types::CanisterId;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub canister_id: CanisterId,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    LocalUserIndexNotFound,
    Error(OCError),
}

#[derive(Serialize)]
pub struct HumanReadableArgs {
    canister_id: HumanReadablePrincipal,
}

impl ToHumanReadable for Args {
    type Target = HumanReadableArgs;

    fn to_human_readable(&self) -> Self::Target {
        HumanReadableArgs {
            canister_id: self.canister_id.into(),
        }
    }
}
