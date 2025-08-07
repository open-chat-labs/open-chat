use candid::CandidType;
use human_readable::{HumanReadablePrincipal, ToHumanReadable};
use serde::{Deserialize, Serialize};
use types::{CanisterId, SuccessOnly};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub bucket: CanisterId,
    pub full: bool,
}

pub type Response = SuccessOnly;

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
