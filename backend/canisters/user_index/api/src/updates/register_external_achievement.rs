use candid::CandidType;
use human_readable::{HumanReadablePrincipal, ToHumanReadable};
use serde::Serialize;
use ts_export::ts_export;
use types::{CanisterId, TimestampMillis};

#[ts_export(user_index, pay_for_diamond_membership)]
#[derive(CandidType, Debug)]
pub struct Args {
    pub id: u32,
    pub name: String,
    pub logo: String,
    pub url: String,
    pub canister_id: CanisterId,
    pub chit_reward: u32,
    pub expires: TimestampMillis,
    pub chit_budget: u32,
}

#[ts_export(user_index, pay_for_diamond_membership)]
#[derive(CandidType, Debug)]
pub enum Response {
    Success,
}

#[derive(Serialize)]
pub struct HumanReadableArgs {
    id: u32,
    name: String,
    logo: String,
    url: String,
    canister_id: HumanReadablePrincipal,
    chit_reward: u32,
    expires: TimestampMillis,
    chit_budget: u32,
}

impl ToHumanReadable for Args {
    type Target = HumanReadableArgs;

    fn to_human_readable(&self) -> Self::Target {
        HumanReadableArgs {
            id: self.id,
            name: self.name.clone(),
            logo: self.logo.clone(),
            url: self.url.clone(),
            canister_id: self.canister_id.into(),
            chit_reward: self.chit_reward,
            expires: self.expires,
            chit_budget: self.chit_budget,
        }
    }
}
