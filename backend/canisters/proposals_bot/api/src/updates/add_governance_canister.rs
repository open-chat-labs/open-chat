use candid::CandidType;
use human_readable::{HumanReadablePrincipal, ToHumanReadable};
use serde::{Deserialize, Serialize};
use types::{CanisterId, CommunityId, Document};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub governance_canister_id: CanisterId,
    pub community_id: Option<CommunityId>,
    pub name: String,
    pub description: Option<String>,
    pub avatar: Option<Document>,
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
    community_id: Option<HumanReadablePrincipal>,
    name: String,
    description: Option<String>,
    avatar: Option<String>,
}

impl ToHumanReadable for Args {
    type Target = HumanReadableArgs;

    fn to_human_readable(&self) -> Self::Target {
        HumanReadableArgs {
            governance_canister_id: self.governance_canister_id.into(),
            community_id: self.community_id.map(|c| CanisterId::from(c).into()),
            name: self.name.clone(),
            description: self.description.clone(),
            avatar: self.avatar.as_ref().map(|a| format!("{a:?}")),
        }
    }
}
