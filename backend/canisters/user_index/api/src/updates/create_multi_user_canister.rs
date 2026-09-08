use candid::CandidType;
use human_readable::{HumanReadablePrincipal, ToHumanReadable};
use serde::{Deserialize, Serialize};
use types::CanisterId;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub local_user_index_canister_id: CanisterId,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(CanisterId),
    LocalUserIndexNotFound,
    InternalError(String),
}

#[derive(Serialize)]
pub struct HumanReadableArgs {
    local_user_index_canister_id: HumanReadablePrincipal,
}

impl ToHumanReadable for Args {
    type Target = HumanReadableArgs;

    fn to_human_readable(&self) -> Self::Target {
        HumanReadableArgs {
            local_user_index_canister_id: self.local_user_index_canister_id.into(),
        }
    }
}
