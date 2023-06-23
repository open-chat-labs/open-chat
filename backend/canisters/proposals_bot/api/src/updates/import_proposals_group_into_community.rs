use candid::{CandidType, Principal};
use human_readable::{HumanReadablePrincipal, ToHumanReadable};
use serde::{Deserialize, Serialize};
use types::{CanisterId, CommunityId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub governance_canister_id: CanisterId,
    pub community_id: CommunityId,
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
    community_id: HumanReadablePrincipal,
}

impl ToHumanReadable for Args {
    type Target = HumanReadableArgs;

    fn to_human_readable(&self) -> Self::Target {
        HumanReadableArgs {
            governance_canister_id: self.governance_canister_id.into(),
            community_id: Principal::from(self.community_id).into(),
        }
    }
}
