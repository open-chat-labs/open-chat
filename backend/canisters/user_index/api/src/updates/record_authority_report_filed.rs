use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::UnitResult;

// Records that an authority report (NCA CSEA-IRP) was filed for a detection - the filed-report
// register is the compliance evidence that reporting deadlines were met. An unverified filing
// (made before any human verdict, via the urgency valve) leaves the report's verdict open.
//
// Two callers: a platform operator recording a manual filing (or a reference found during
// reconciliation), and the NCA reporting service completing an automated filing - the service
// must present the attempt's vault token, and its open attempt marker is consumed.
#[ts_export(user_index, record_authority_report_filed)]
#[derive(CandidType, Serialize, Deserialize)]
pub struct Args {
    pub report_index: u64,
    // The NCA's referralFriendlyID, eg. "SR-CSEAIRP-1257"
    pub portal_reference: String,
    // The NCA's referralID (UUID), returned by the API; both identifiers are retained
    #[serde(default)]
    pub portal_reference_uuid: Option<String>,
    pub urgent: bool,
    pub unverified: bool,
    // Required for the service path; ignored for operator callers
    #[serde(default)]
    pub vault_token: Option<String>,
}

// Hand-written so the vault token (a live credential) never lands in a trace buffer
impl std::fmt::Debug for Args {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Args")
            .field("report_index", &self.report_index)
            .field("portal_reference", &self.portal_reference)
            .field("portal_reference_uuid", &self.portal_reference_uuid)
            .field("urgent", &self.urgent)
            .field("unverified", &self.unverified)
            .finish_non_exhaustive()
    }
}

pub type Response = UnitResult;
