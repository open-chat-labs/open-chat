use types::{Empty, UnitResult};

// The GDPR Article 22 safeguard: a user sanctioned by an automated decision can contest it,
// which queues the report for priority human verdict. One active contest per report.
pub type Args = Empty;

pub type Response = UnitResult;
