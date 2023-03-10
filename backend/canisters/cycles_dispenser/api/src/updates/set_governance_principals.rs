use candid::{CandidType, Principal};
use human_readable::{HumanReadablePrincipal, ToHumanReadable};
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub principals: Vec<Principal>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
}

#[derive(Serialize)]
pub struct HumanReadableArgs {
    principals: Vec<HumanReadablePrincipal>,
}

impl ToHumanReadable for Args {
    type Target = HumanReadableArgs;

    fn to_human_readable(&self) -> Self::Target {
        HumanReadableArgs {
            principals: self.principals.iter().copied().map(|p| p.into()).collect(),
        }
    }
}
