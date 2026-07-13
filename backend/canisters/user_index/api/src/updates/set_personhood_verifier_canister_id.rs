use candid::{CandidType, Principal};
use human_readable::{HumanReadablePrincipal, ToHumanReadable};
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::UnitResult;

// Sets the personhood_verifier canister id on a live user_index. On upgrade
// the id defaults to anonymous (init args do not re-run), so without this a
// production user_index would reject the verifier's proof notifications and
// skip embedding deletion. Governance-controlled (SNS proposal).
#[ts_export(user_index, set_personhood_verifier_canister_id)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub canister_id: Principal,
}

pub type Response = UnitResult;

#[derive(Serialize)]
pub struct HumanReadableArgs {
    canister_id: HumanReadablePrincipal,
}

impl ToHumanReadable for Args {
    type Target = HumanReadableArgs;

    fn to_human_readable(&self) -> Self::Target {
        HumanReadableArgs {
            canister_id: self.canister_id.into(),
        }
    }
}
