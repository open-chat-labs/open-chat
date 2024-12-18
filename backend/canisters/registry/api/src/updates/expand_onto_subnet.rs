use candid::{CandidType, Principal};
use human_readable::{HumanReadablePrincipal, ToHumanReadable};
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub subnet_id: Principal,
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
}

impl ToHumanReadable for Args {
    type Target = HumanReadableArgs;

    fn to_human_readable(&self) -> Self::Target {
        HumanReadableArgs {
            subnet_id: self.subnet_id.into(),
        }
    }
}
