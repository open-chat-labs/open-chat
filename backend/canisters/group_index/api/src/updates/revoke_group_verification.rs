use candid::CandidType;
use human_readable::{HumanReadablePrincipal, ToHumanReadable};
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{CanisterId, ChatId};

#[ts_export(group_index, revoke_group_verification)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub group_id: ChatId,
}

#[ts_export(group_index, revoke_group_verification)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    NotFound,
}

#[derive(Serialize)]
pub struct HumanReadableArgs {
    pub group_id: HumanReadablePrincipal,
}

impl ToHumanReadable for Args {
    type Target = HumanReadableArgs;

    fn to_human_readable(&self) -> Self::Target {
        HumanReadableArgs {
            group_id: CanisterId::from(self.group_id).into(),
        }
    }
}
