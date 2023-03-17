use candid::{CandidType, Principal};
use human_readable::{HumanReadablePrincipal, ToHumanReadable};
use serde::{Deserialize, Serialize};
use types::{CanisterId, UserId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub governance_canister_id: CanisterId,
    pub users: Vec<UserId>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    NotFound,
}

#[derive(Serialize)]
pub struct HumanReadableArgs {
    pub governance_canister_id: HumanReadablePrincipal,
    pub users: Vec<HumanReadablePrincipal>,
}

impl ToHumanReadable for Args {
    type Target = HumanReadableArgs;

    fn to_human_readable(&self) -> Self::Target {
        HumanReadableArgs {
            governance_canister_id: self.governance_canister_id.into(),
            users: self
                .users
                .iter()
                .copied()
                .map(|u| HumanReadablePrincipal::from(Principal::from(u)))
                .collect(),
        }
    }
}
