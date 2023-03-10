use candid::CandidType;
use human_readable::{HumanReadablePrincipal, ToHumanReadable};
use serde::{Deserialize, Serialize};
use types::{Avatar, CanisterId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub governance_canister_id: CanisterId,
    pub name: String,
    pub description: Option<String>,
    pub avatar: Option<Avatar>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    AlreadyAdded,
    InternalError(String),
}

#[derive(Serialize)]
pub struct HumanReadableArgs {
    governance_canister_id: HumanReadablePrincipal,
    name: String,
    description: Option<String>,
    avatar: Option<String>,
}

impl ToHumanReadable for Args {
    type Target = HumanReadableArgs;

    fn to_human_readable(&self) -> Self::Target {
        HumanReadableArgs {
            governance_canister_id: self.governance_canister_id.into(),
            name: self.name.clone(),
            description: self.description.clone(),
            avatar: self.avatar.as_ref().map(|a| format!("{a:?}")),
        }
    }
}
