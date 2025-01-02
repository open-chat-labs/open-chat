use candid::{CandidType, Principal};
use human_readable::{HumanReadablePrincipal, ToHumanReadable};
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{BotDefinition, UserId};

#[ts_export(user_index, register_bot)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub principal: Principal,
    pub owner: UserId,
    pub name: String,
    pub avatar: Option<String>, // Image as a data URL
    pub endpoint: String,
    pub definition: BotDefinition,
}

#[ts_export(user_index, register_bot)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
}

#[derive(Serialize)]
pub struct HumanReadableArgs {
    principal: HumanReadablePrincipal,
    owner: HumanReadablePrincipal,
    name: String,
    endpoint: String,
    description: String,
    definition: BotDefinition,
}

impl ToHumanReadable for Args {
    type Target = HumanReadableArgs;

    fn to_human_readable(&self) -> Self::Target {
        HumanReadableArgs {
            principal: self.principal.into(),
            owner: Principal::from(self.owner).into(),
            name: self.name.clone(),
            endpoint: self.endpoint.clone(),
            description: self.endpoint.clone(),
            definition: self.definition.clone(),
        }
    }
}
