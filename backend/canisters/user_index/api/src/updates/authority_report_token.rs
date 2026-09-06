use candid::CandidType;
use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::NcaPriority;

// Opens a report-scoped filing window for the NCA reporting service by minting two short-lived
// tokens: a vault token (no PII, forwarded to canisters to authorize the evidence export) and a
// submitter token (the reporter's contact details, consumed only by the service). The service
// can act only inside a window a human moderator opened - its principal alone exports nothing.
#[ts_export(user_index, authority_report_token)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub report_index: u64,
    // The moderator's assessment, bound into the signed token so the service cannot change it
    pub priority: NcaPriority,
    pub reporter: ReporterContact,
    // The moderator acknowledged the out-of-hours phone-call obligation for P1/P2 filings
    pub ooh_call_acknowledged: bool,
}

// The person the NCA can call about this report. Never persisted on chain: it goes straight
// into the submitter token and nowhere else.
#[ts_export(user_index, authority_report_token)]
#[derive(CandidType, Serialize, Deserialize, Clone)]
pub struct ReporterContact {
    pub first_name: String,
    pub last_name: String,
    pub phone: String,
    pub country_calling_code: String,
    pub email: String,
}

// Hand-written so the contact details can never land in a trace buffer
impl std::fmt::Debug for ReporterContact {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("ReporterContact").finish_non_exhaustive()
    }
}

#[ts_export(user_index, authority_report_token)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    Error(OCError),
}

#[ts_export(user_index, authority_report_token)]
#[derive(CandidType, Serialize, Deserialize)]
pub struct SuccessResult {
    pub vault_token: String,
    pub submitter_token: String,
}

// Hand-written: both tokens are live credentials and the submitter token carries PII
impl std::fmt::Debug for SuccessResult {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("SuccessResult").finish_non_exhaustive()
    }
}
