use candid::{CandidType, Principal};
use human_readable::{HumanReadablePrincipal, ToHumanReadable};
use serde::{Deserialize, Serialize};
use types::UnitResult;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub subnet_id: Option<Principal>,
}

pub type Response = UnitResult;

#[derive(Serialize)]
pub struct HumanReadableArgs {
    subnet_id: Option<HumanReadablePrincipal>,
}

impl ToHumanReadable for Args {
    type Target = HumanReadableArgs;

    fn to_human_readable(&self) -> Self::Target {
        HumanReadableArgs {
            subnet_id: self.subnet_id.map(|p| p.into()),
        }
    }
}
