use serde::{Deserialize, Serialize};
use types::{TimestampMillis, UserId};
use user_index_canister::clear_authority_report_attempt::AuthorityReportFailure;

// The filed-report register: which detections owe an authority report (NCA CSEA-IRP), which
// have an automated filing attempt in flight, and which have been filed with what portal
// reference. This is the compliance evidence for demonstrating that reporting deadlines were
// met. Filing happens via the automated NCA reporting service or by hand; the attempt marker
// is the crash-safety anchor for the automated path (D6): while one is open no new filing
// token can be minted, so a crash between the NCA POST and the on-chain record can never
// produce a duplicate CSEA report, and the report stays loudly visible rather than silently
// unfiled.
#[derive(Serialize, Deserialize, Default)]
pub struct AuthorityReports {
    due: Vec<AuthorityReportDue>,
    #[serde(default)]
    attempts: Vec<AuthorityReportAttempt>,
    filed: Vec<AuthorityReportFiled>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct AuthorityReportDue {
    pub report_index: u64,
    pub created: TimestampMillis,
    pub urgent: bool,
    // The most recent automated filing failure, shown on the report card and driving the
    // manual fallback checklist
    #[serde(default)]
    pub last_failure: Option<AuthorityReportFailureRecord>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct AuthorityReportFailureRecord {
    pub failure: AuthorityReportFailure,
    pub timestamp: TimestampMillis,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct AuthorityReportAttempt {
    pub report_index: u64,
    // Ties the attempt to the token pair which opened it; the filing (or clear) must present
    // a token carrying the same nonce
    pub nonce: u128,
    pub started_at: TimestampMillis,
    // The moderator whose token opened the window (from the token claims)
    pub started_by: UserId,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct AuthorityReportFiled {
    pub report_index: u64,
    pub filed_at: TimestampMillis,
    pub portal_reference: String,
    // The NCA's referralID (UUID) alongside the friendly reference, when filed via the API
    #[serde(default)]
    pub portal_reference_uuid: Option<String>,
    pub urgent: bool,
    // True if this was an honest-unverified filing made before any human verdict (the urgency
    // valve) - the report's verdict remains open
    pub unverified: bool,
    // Carried from the filing token: the compliance record shows the out-of-hours call
    // obligation was surfaced and acknowledged (it is a promise, not proof of the call)
    #[serde(default)]
    pub ooh_call_acknowledged: bool,
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
                last_failure: None,
            });
        }
    }

    pub fn is_due(&self, report_index: u64) -> bool {
        self.due.iter().any(|d| d.report_index == report_index)
    }

    pub fn due_entry(&self, report_index: u64) -> Option<&AuthorityReportDue> {
        self.due.iter().find(|d| d.report_index == report_index)
    }

    pub fn attempt(&self, report_index: u64) -> Option<&AuthorityReportAttempt> {
        self.attempts.iter().find(|a| a.report_index == report_index)
    }

    // Opens the filing-attempt marker. Refused if the report is not due or an attempt is
    // already open (the token minting refuses too, but the marker is the last line: two
    // markers would mean two filings could race).
    pub fn record_attempt(&mut self, report_index: u64, nonce: u128, started_by: UserId, now: TimestampMillis) -> bool {
        if !self.is_due(report_index) || self.attempt(report_index).is_some() {
            return false;
        }
        self.attempts.push(AuthorityReportAttempt {
            report_index,
            nonce,
            started_at: now,
            started_by,
        });
        true
    }

    // Clears an open attempt so the report can be retried, recording why it failed (if the
    // failure is known - an operator reconciling an orphaned marker clears without one)
    pub fn clear_attempt(&mut self, report_index: u64, failure: Option<AuthorityReportFailure>, now: TimestampMillis) -> bool {
        let len_before = self.attempts.len();
        self.attempts.retain(|a| a.report_index != report_index);
        let cleared = self.attempts.len() != len_before;
        if cleared && let Some(failure) = failure {
            if let Some(due) = self.due.iter_mut().find(|d| d.report_index == report_index) {
                due.last_failure = Some(AuthorityReportFailureRecord { failure, timestamp: now });
            }
        }
        cleared
    }

    pub fn record_filed(
        &mut self,
        report_index: u64,
        portal_reference: String,
        portal_reference_uuid: Option<String>,
        urgent: bool,
        unverified: bool,
        ooh_call_acknowledged: bool,
        now: TimestampMillis,
    ) {
        self.due.retain(|d| d.report_index != report_index);
        // The filing consumes any open attempt marker
        self.attempts.retain(|a| a.report_index != report_index);
        // Idempotent per report: a repeat filing (eg. a corrected portal reference) replaces
        // the existing row rather than appending a duplicate
        self.filed.retain(|f| f.report_index != report_index);
        self.filed.push(AuthorityReportFiled {
            report_index,
            filed_at: now,
            portal_reference,
            portal_reference_uuid,
            urgent,
            unverified,
            ooh_call_acknowledged,
        });
    }

    pub fn due(&self) -> &[AuthorityReportDue] {
        &self.due
    }

    pub fn attempts(&self) -> &[AuthorityReportAttempt] {
        &self.attempts
    }

    pub fn filed(&self) -> &[AuthorityReportFiled] {
        &self.filed
    }

    pub fn metrics(&self) -> AuthorityReportMetrics {
        AuthorityReportMetrics {
            reports_due: self.due.len(),
            reports_filed: self.filed.len(),
            attempts_open: self.attempts.len(),
            oldest_open_attempt_at: self.attempts.iter().map(|a| a.started_at).min(),
        }
    }
}

#[derive(Serialize, Debug)]
pub struct AuthorityReportMetrics {
    pub reports_due: usize,
    pub reports_filed: usize,
    // Open attempt markers: normally zero or transiently one - a lingering marker means a
    // crashed filing awaiting reconciliation, which must be loudly visible
    pub attempts_open: usize,
    pub oldest_open_attempt_at: Option<TimestampMillis>,
}
