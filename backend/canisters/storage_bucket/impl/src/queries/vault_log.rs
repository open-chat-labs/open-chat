use crate::model::vault::VaultLogEvent;
use crate::{RuntimeState, read_state};
use canister_api_macros::query;
use storage_bucket_canister::vault_log::*;

const PAGE_MAX: u32 = 200;

#[query(candid = true, msgpack = true)]
fn vault_log(args: Args) -> Response {
    read_state(|state| vault_log_impl(args, state))
}

fn vault_log_impl(args: Args, state: &RuntimeState) -> Response {
    if !state.data.vault.is_reviewer(&state.env.caller()) {
        return Response::NotAuthorized;
    }

    let (total, entries) = state.data.vault.log_page(args.start, args.max.min(PAGE_MAX));
    Response::Success(SuccessResult {
        total,
        entries: entries
            .iter()
            .map(|e| VaultLogEntry {
                index: e.index,
                timestamp: e.timestamp,
                prev_hash: hex::encode(e.prev_hash),
                event: match &e.event {
                    VaultLogEvent::Quarantined(file_id, report_index) => {
                        format!("Quarantined file {file_id} (report {report_index})")
                    }
                    VaultLogEvent::Unquarantined(file_id) => format!("Unquarantined file {file_id}"),
                    VaultLogEvent::VerdictApplied(file_id, retention_until) => {
                        format!("Verdict applied to file {file_id}, retained until {retention_until}")
                    }
                    VaultLogEvent::LegalHoldSet(file_id) => format!("Legal hold set on file {file_id}"),
                    VaultLogEvent::LegalHoldCleared(file_id) => format!("Legal hold cleared on file {file_id}"),
                    VaultLogEvent::Destroyed(file_id, le_ref) => {
                        format!("Destroyed file {file_id} (law enforcement request {le_ref})")
                    }
                    VaultLogEvent::RetentionExpired(file_id) => {
                        format!("Retention expired for file {file_id}, deleted")
                    }
                    VaultLogEvent::Viewed(file_id, principal) => {
                        format!("File {file_id} viewed by {principal}")
                    }
                },
            })
            .collect(),
    })
}
