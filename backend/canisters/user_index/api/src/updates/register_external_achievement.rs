use candid::{CandidType, Principal};
use human_readable::{HumanReadablePrincipal, ToHumanReadable};
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{CanisterId, TimestampMillis, UserId};

#[ts_export(user_index, pay_for_diamond_membership)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub id: u32,
    pub submitted_by: UserId,
    pub name: String,
    pub logo: String,
    pub url: String,
    pub canister_id: CanisterId,
    pub chit_reward: u32,
    pub expires: TimestampMillis,
    pub max_awards: u32,
}

#[ts_export(user_index, pay_for_diamond_membership)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
}

#[derive(Serialize)]
pub struct HumanReadableArgs {
    id: u32,
    submitted_by: HumanReadablePrincipal,
    name: String,
    logo: String,
    url: String,
    canister_id: HumanReadablePrincipal,
    chit_reward: u32,
    expires: TimestampMillis,
    max_awards: u32,
}

impl ToHumanReadable for Args {
    type Target = HumanReadableArgs;

    fn to_human_readable(&self) -> Self::Target {
        HumanReadableArgs {
            id: self.id,
            submitted_by: Principal::from(self.submitted_by).into(),
            name: self.name.clone(),
            logo: self.logo.clone(),
            url: self.url.clone(),
            canister_id: self.canister_id.into(),
            chit_reward: self.chit_reward,
            expires: self.expires,
            max_awards: self.max_awards,
        }
    }
}
