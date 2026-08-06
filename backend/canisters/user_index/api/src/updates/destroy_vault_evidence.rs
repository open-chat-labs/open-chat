use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::UnitResult;

// Permanently destroys the vaulted evidence for a report on a law enforcement request,
// overriding both the retention clock and any legal hold (18 U.S.C. 2258B(c)(2)). The access
// log entry, including the request reference, survives the destruction.
#[ts_export(user_index, destroy_vault_evidence)]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct Args {
    pub report_index: u64,
    // The law enforcement request this destruction is made under; recorded in the vault log
    pub le_request_ref: String,
}

pub type Response = UnitResult;
