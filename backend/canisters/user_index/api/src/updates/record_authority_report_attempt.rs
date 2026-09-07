use candid::CandidType;
use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use types::{BlobReference, Chat, MediaScanMatch, MessageId, MessageIndex, TimestampMillis, UserId};

use crate::resolve_moderation_report::ModerationVerdict;

// Called by the NCA reporting service (authority-reporter principal + a moderator's vault
// token) before it touches any evidence: registers the on-chain attempt marker - the
// crash-safety anchor that stops a mid-flight failure producing a duplicate CSEA report or a
// silently unfiled one - and returns the report data the submission is built from. One update
// call, so the marker and the data are consistent under consensus (a composite query could be
// answered by a single malicious replica with fabricated evidence).
#[derive(CandidType, Serialize, Deserialize)]
pub struct Args {
    pub vault_token: String,
}

// Hand-written so the token (a live credential) never lands in a trace buffer
impl std::fmt::Debug for Args {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Args").finish_non_exhaustive()
    }
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(Box<AuthorityReportData>),
    Error(OCError),
}

// Everything the user_index holds about the report, served as certified update-call state.
// The service cross-checks the identifying fields against the vault token's claims, so a
// forged response cannot substitute different evidence and a forged token cannot aim the
// service at a report the moderator never authorised.
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct AuthorityReportData {
    pub report_index: u64,
    pub sender: ReportedUserDetails,
    // Direct chats only: the recipient of a direct message is likely the child victim the NCA
    // exists to safeguard. Group members are thousands of uninvolved pseudonymous users and
    // are never named.
    pub recipient: Option<ReportedUserDetails>,
    pub chat: Chat,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_index: MessageIndex,
    pub message_id: MessageId,
    pub detection: AuthorityReportDetection,
    // When the platform first knew: the automated outcome timestamp, or the earliest report
    pub detected_at: TimestampMillis,
    // The register's urgent flag (the reviewer judged an imminent threat), echoed into the
    // filed record
    pub urgent: bool,
    pub verdict: VerdictDetails,
    pub flagged_categories: u32,
    pub auto_sanctioned: bool,
    pub contested: bool,
    pub content_excerpt: Option<String>,
    pub media_matches: Vec<MediaScanMatch>,
    pub files: Vec<BlobReference>,
    // For blocked-attempt reports: repeat attempts tallied onto this report
    pub repeat_attempts: Vec<TimestampMillis>,
    pub unrecorded_repeat_attempts: u32,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct ReportedUserDetails {
    pub user_id: UserId,
    pub username: String,
    pub display_name: Option<String>,
    pub date_created: TimestampMillis,
    pub suspended: bool,
    // Set when the account is suspended indefinitely (the CSAM auto-sanction): the NCA's
    // "account closed" fields
    pub suspension_reason: Option<String>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum AuthorityReportDetection {
    UserReport {
        // Drives the NCA's methodOfDetection: an employee moderating the platform vs a user
        reporters_include_platform_moderator: bool,
    },
    Proactive,
    BlockedAttempt {
        original_report_index: u64,
    },
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct VerdictDetails {
    pub verdict: ModerationVerdict,
    pub moderator: UserId,
    pub timestamp: TimestampMillis,
}
