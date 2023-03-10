use candid::CandidType;
use human_readable::{HumanReadablePrincipal, ToHumanReadable};
use serde::{Deserialize, Serialize};
use types::CanisterId;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub bucket: CanisterId,
    pub full: bool,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
}

#[derive(Serialize)]
pub struct HumanReadableArgs {
    bucket: HumanReadablePrincipal,
    full: bool,
}

impl ToHumanReadable for Args {
    type Target = HumanReadableArgs;

    fn to_human_readable(&self) -> Self::Target {
        HumanReadableArgs {
            bucket: self.bucket.into(),
            full: self.full,
        }
    }
}
