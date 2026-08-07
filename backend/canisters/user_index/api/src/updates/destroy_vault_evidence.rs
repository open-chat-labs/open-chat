use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::UnitResult;

// Permanently destroys the vaulted evidence for a report on a law enforcement request,
// overriding the retention clock (18 U.S.C. 2258B(c)(2)). Refused while a legal hold stands
// on any of the evidence - clearing the hold is a separate, separately logged act - and
// reachable only via propose_protected_action + confirm_protected_action by two different
// platform operators (#9136). The vault log entry, including the request reference and both
// operator identities, survives the destruction.
#[ts_export(user_index, destroy_vault_evidence)]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct Args {
    pub report_index: u64,
    // The law enforcement request this destruction is made under; recorded in the vault log
    pub le_request_ref: String,
}

pub type Response = UnitResult;
