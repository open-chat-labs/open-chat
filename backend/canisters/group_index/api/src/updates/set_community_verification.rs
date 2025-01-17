use candid::CandidType;
use human_readable::{HumanReadablePrincipal, ToHumanReadable};
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{CanisterId, CommunityId};

#[ts_export(group_index, set_community_verification)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub community_id: CommunityId,
    pub name: String,
}

#[ts_export(group_index, set_community_verification)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    NotFound,
    NameReserved,
    NameTaken,
    AlreadyVerified,
    InternalError(String),
}

#[derive(Serialize)]
pub struct HumanReadableArgs {
    pub community_id: HumanReadablePrincipal,
    pub name: String,
}

impl ToHumanReadable for Args {
    type Target = HumanReadableArgs;

    fn to_human_readable(&self) -> Self::Target {
        HumanReadableArgs {
            community_id: CanisterId::from(self.community_id).into(),
            name: self.name.clone(),
        }
    }
}
