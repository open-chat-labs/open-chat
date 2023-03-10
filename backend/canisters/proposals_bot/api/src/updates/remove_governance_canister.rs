use candid::CandidType;
use human_readable::{HumanReadablePrincipal, ToHumanReadable};
use serde::{Deserialize, Serialize};
use types::CanisterId;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub governance_canister_id: CanisterId,
    pub delete_group: bool,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    NotFound,
    InternalError(String),
}

#[derive(Serialize)]
pub struct HumanReadableArgs {
    governance_canister_id: HumanReadablePrincipal,
    delete_group: bool,
}

impl ToHumanReadable for Args {
    type Target = HumanReadableArgs;

    fn to_human_readable(&self) -> Self::Target {
        HumanReadableArgs {
            governance_canister_id: self.governance_canister_id.into(),
            delete_group: self.delete_group,
        }
    }
}
