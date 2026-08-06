use crate::updates::{destroy_vault_evidence, set_internal_moderation_channel, set_openai_api_key, set_vault_reviewers};
use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;

// Dual authorization for the operator actions which are rare and irreversible in effect: a
// proposal by one platform operator only executes once a different operator confirms it.
// Everything else (verdicts, suspensions, flags, legal holds) stays single-actor-plus-log:
// those actions are frequent and correctable, and dual control there would only slow
// moderation down. See https://github.com/open-chat-labs/open-chat/issues/9136.
#[ts_export(user_index, propose_protected_action)]
#[derive(Serialize, Deserialize, Clone, Debug)]
pub enum ProtectedAction {
    DestroyVaultEvidence(destroy_vault_evidence::Args),
    SetVaultReviewers(set_vault_reviewers::Args),
    SetOpenAIApiKey(set_openai_api_key::Args),
    SetInternalModerationChannel(set_internal_moderation_channel::Args),
}

impl ProtectedAction {
    // At most one proposal per kind can be pending: proposing another supersedes it, so the
    // pending list always reflects the current intent rather than accumulating stale variants
    pub fn kind(&self) -> &'static str {
        match self {
            ProtectedAction::DestroyVaultEvidence(_) => "DestroyVaultEvidence",
            ProtectedAction::SetVaultReviewers(_) => "SetVaultReviewers",
            ProtectedAction::SetOpenAIApiKey(_) => "SetOpenAIApiKey",
            ProtectedAction::SetInternalModerationChannel(_) => "SetInternalModerationChannel",
        }
    }

    // Shown in the lifecycle log and moderation-channel notices. Never includes secrets.
    pub fn summary(&self) -> String {
        match self {
            ProtectedAction::DestroyVaultEvidence(args) => {
                format!(
                    "DestroyVaultEvidence(report #{}, ref: {})",
                    args.report_index, args.le_request_ref
                )
            }
            ProtectedAction::SetVaultReviewers(args) => {
                let ids: Vec<String> = args.user_ids.iter().map(|u| u.to_string()).collect();
                format!("SetVaultReviewers([{}])", ids.join(", "))
            }
            ProtectedAction::SetOpenAIApiKey(args) => {
                if args.api_key.is_some() {
                    "SetOpenAIApiKey(<redacted>)".to_string()
                } else {
                    "SetOpenAIApiKey(None)".to_string()
                }
            }
            ProtectedAction::SetInternalModerationChannel(args) => match &args.channel {
                Some(c) => format!("SetInternalModerationChannel({}/{})", c.community_id, c.channel_id),
                None => "SetInternalModerationChannel(None)".to_string(),
            },
        }
    }
}

#[ts_export(user_index, propose_protected_action)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub action: ProtectedAction,
}

#[ts_export(user_index, propose_protected_action)]
#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    Error(OCError),
}

#[ts_export(user_index, propose_protected_action)]
#[derive(Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub action_id: u64,
    // True when an identical action was already pending: nothing new was queued, and this is
    // the id of the existing proposal
    pub already_pending: bool,
}
