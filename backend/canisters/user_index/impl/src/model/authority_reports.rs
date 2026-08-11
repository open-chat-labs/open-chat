use serde::{Deserialize, Serialize};
use types::TimestampMillis;

// The filed-report register: which detections owe an authority report (NCA CSEA-IRP), and which
// have been filed with what portal reference. This is the compliance evidence for demonstrating
// that reporting deadlines were met (filing itself is a manual operator process initially).
#[derive(Serialize, Deserialize, Default)]
pub struct AuthorityReports {
    due: Vec<AuthorityReportDue>,
    filed: Vec<AuthorityReportFiled>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct AuthorityReportDue {
    pub report_index: u64,
    pub created: TimestampMillis,
    pub urgent: bool,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct AuthorityReportFiled {
    pub report_index: u64,
    pub filed_at: TimestampMillis,
    pub portal_reference: String,
    pub urgent: bool,
    // True if this was an honest-unverified filing made before any human verdict (the urgency
    // valve) - the report's verdict remains open
    pub unverified: bool,
}

impl AuthorityReports {
    pub fn push_due(&mut self, report_index: u64, urgent: bool, now: TimestampMillis) {
        if !self.due.iter().any(|d| d.report_index == report_index)
            && !self.filed.iter().any(|f| f.report_index == report_index)
        {
            self.due.push(AuthorityReportDue {
                report_index,
                created: now,
                urgent,
            });
        }
    }

    pub fn record_filed(
        &mut self,
        report_index: u64,
        portal_reference: String,
        urgent: bool,
        unverified: bool,
        now: TimestampMillis,
    ) {
        self.due.retain(|d| d.report_index != report_index);
        // Idempotent per report: a repeat filing (eg. a corrected portal reference) replaces
        // the existing row rather than appending a duplicate
        self.filed.retain(|f| f.report_index != report_index);
        self.filed.push(AuthorityReportFiled {
            report_index,
            filed_at: now,
            portal_reference,
            urgent,
            unverified,
        });
    }

    pub fn due(&self) -> &[AuthorityReportDue] {
        &self.due
    }

    pub fn filed(&self) -> &[AuthorityReportFiled] {
        &self.filed
    }

    pub fn metrics(&self) -> AuthorityReportMetrics {
        AuthorityReportMetrics {
            reports_due: self.due.len(),
            reports_filed: self.filed.len(),
        }
    }
}

#[derive(Serialize, Debug)]
pub struct AuthorityReportMetrics {
    pub reports_due: usize,
    pub reports_filed: usize,
}
