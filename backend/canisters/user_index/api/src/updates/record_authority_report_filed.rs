use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::UnitResult;

// Records that an authority report (NCA CSEA-IRP) was filed for a detection - the filed-report
// register is the compliance evidence that reporting deadlines were met. An unverified filing
// (made before any human verdict, via the urgency valve) leaves the report's verdict open.
#[ts_export(user_index, record_authority_report_filed)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub report_index: u64,
    pub portal_reference: String,
    pub urgent: bool,
    pub unverified: bool,
}

pub type Response = UnitResult;
