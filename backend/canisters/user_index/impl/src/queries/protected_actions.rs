use crate::guards::caller_is_platform_operator;
use crate::model::protected_actions::PENDING_PROTECTED_ACTION_TTL;
use crate::read_state;
use canister_api_macros::query;
use serde::Serialize;
use user_index_canister::protected_actions::{Response::*, *};

#[query(guard = "caller_is_platform_operator", msgpack = true)]
fn protected_actions(_args: Args) -> Response {
    read_state(|state| {
        // Pending entries expose the action SUMMARY, never the action itself, so secrets
        // (eg. the OpenAI key) stay out of this surface just as they stay out of the log
        #[derive(Serialize)]
        struct Pending {
            id: u64,
            summary: String,
            proposed_by: types::UserId,
            proposed_at: types::TimestampMillis,
            expires_at: types::TimestampMillis,
        }
        // Hashes are hex-encoded (as in the vault log) so an auditor can compare an entry
        // against the chain head published in the public metrics endpoint
        #[derive(Serialize)]
        struct LogEntry {
            index: u64,
            timestamp: types::TimestampMillis,
            hash: String,
            prev_hash: String,
            event: crate::model::protected_actions::ProtectedActionLogEvent,
        }
        #[derive(Serialize)]
        struct ProtectedActionsView {
            pending: Vec<Pending>,
            log: Vec<LogEntry>,
        }
        let view = ProtectedActionsView {
            pending: state
                .data
                .protected_actions
                .pending()
                .map(|p| Pending {
                    id: p.id,
                    summary: p.action.summary(),
                    proposed_by: p.proposed_by,
                    proposed_at: p.proposed_at,
                    expires_at: p.proposed_at.saturating_add(PENDING_PROTECTED_ACTION_TTL),
                })
                .collect(),
            log: state
                .data
                .protected_actions
                .log()
                .iter()
                .map(|e| LogEntry {
                    index: e.index,
                    timestamp: e.timestamp,
                    hash: hex::encode(crate::model::protected_actions::ProtectedActions::entry_hash(e)),
                    prev_hash: hex::encode(e.prev_hash),
                    event: e.event.clone(),
                })
                .collect(),
        };
        Success(SuccessResult {
            json: serde_json::to_string(&view).unwrap(),
        })
    })
}
