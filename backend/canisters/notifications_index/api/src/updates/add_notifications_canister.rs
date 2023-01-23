use candid::CandidType;
use human_readable::{HumanReadablePrincipal, ToHumanReadable};
use serde::{Deserialize, Serialize};
use types::CanisterId;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub canister_id: CanisterId,
    pub authorizers: Vec<CanisterId>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    AlreadyAdded,
    InternalError(String),
}

#[derive(Serialize)]
pub struct HumanReadableArgs {
    canister_id: HumanReadablePrincipal,
    authorizers: Vec<HumanReadablePrincipal>,
}

impl ToHumanReadable for Args {
    type Target = HumanReadableArgs;

    fn to_human_readable(&self) -> Self::Target {
        HumanReadableArgs {
            canister_id: self.canister_id.into(),
            authorizers: self.authorizers.iter().copied().map(|p| p.into()).collect(),
        }
    }
}
