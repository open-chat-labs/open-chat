use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::UnitResult;

// Sets or clears a legal hold on the vaulted evidence for a report. A hold suspends the
// retention clock: while it is set the blobs are never deleted at expiry, and a release
// requested meanwhile is deferred until the hold is cleared. Used for preservation requests
// from law enforcement, which routinely outlast the ordinary retention period.
#[ts_export(user_index, set_vault_legal_hold)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub report_index: u64,
    pub legal_hold: bool,
    // Free-text reference for the request the hold was applied under (eg. the police reference)
    pub reference: String,
}

pub type Response = UnitResult;
