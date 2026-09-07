use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::UnitResult;

// Clears an open filing-attempt marker so the report returns to `due` and can be retried.
// Two callers: the NCA reporting service (authority-reporter principal + the attempt's vault
// token) after a classified failure, and a platform operator reconciling an orphaned marker
// by hand after confirming on the portal that nothing was actually filed.
#[ts_export(user_index, clear_authority_report_attempt)]
#[derive(CandidType, Serialize, Deserialize)]
pub struct Args {
    pub report_index: u64,
    // Required for the service path; operators clear by report index alone
    pub vault_token: Option<String>,
    // Why the attempt failed, shown on the report card and driving the manual checklist
    pub failure: Option<AuthorityReportFailure>,
}

// Hand-written so the vault token (a live credential) never lands in a trace buffer
impl std::fmt::Debug for Args {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Args")
            .field("report_index", &self.report_index)
            .field("failure", &self.failure)
            .finish_non_exhaustive()
    }
}

#[ts_export(user_index, clear_authority_report_attempt)]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum AuthorityReportFailure {
    // Portal down (5xx/timeouts after bounded retries): P1/P2 must go via the contingency
    // email + phone path, P3 waits and retries
    Contingency { error: String },
    // The NCA rejected the payload (400): our defect - file via the web form and fix the mapping
    Validation { error: String },
    // 401: the API key is missing, wrong or revoked
    Auth { error: String },
}

pub type Response = UnitResult;
