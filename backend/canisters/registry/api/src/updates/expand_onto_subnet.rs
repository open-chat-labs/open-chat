use candid::{CandidType, Principal};
use human_readable::{HumanReadablePrincipal, ToHumanReadable};
use serde::{Deserialize, Serialize};
use types::CanisterId;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub subnet_id: Principal,
    pub local_user_index: Option<CanisterId>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    AlreadyOnSubnet,
    AlreadyInProgress,
}

#[derive(Serialize)]
pub struct HumanReadableArgs {
    subnet_id: HumanReadablePrincipal,
    #[serde(skip_serializing_if = "Option::is_none")]
    local_user_index: Option<HumanReadablePrincipal>,
}

impl ToHumanReadable for Args {
    type Target = HumanReadableArgs;

    fn to_human_readable(&self) -> Self::Target {
        HumanReadableArgs {
            subnet_id: self.subnet_id.into(),
            local_user_index: self.local_user_index.map(HumanReadablePrincipal::from),
        }
    }
}
