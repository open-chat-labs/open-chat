use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::UnitResult;

// Registers (or clears) the principal of the off-chain NCA reporting service. Reachable only
// through propose_protected_action + confirm_protected_action (#9136): the principal gains a
// token-gated path to vaulted CSAM, so no single operator key may grant it. Executing also
// syncs the principal and the OC public key to the storage buckets, which otherwise cannot
// verify a vault token.
#[ts_export(user_index, set_authority_reporter)]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct Args {
    #[ts(as = "Option::<ts_export::TSPrincipal>", optional)]
    pub principal: Option<Principal>,
}

pub type Response = UnitResult;
