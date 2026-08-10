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

    let (total, entries) = state.data.vault.log_page(args.start, args.max.min(PAGE_MAX), args.file_id);
    Response::Success(SuccessResult {
        total,
        entries: entries
            .iter()
            .map(|e| VaultLogEntry {
                index: e.index,
                timestamp: e.timestamp,
                hash: hex::encode(crate::model::vault::Vault::entry_hash(e)),
                prev_hash: hex::encode(e.prev_hash),
                user_id: match &e.event {
                    VaultLogEvent::ViewedBy(_, _, user_id) => *user_id,
                    VaultLogEvent::UnquarantinedBy(_, moderator) => *moderator,
                    VaultLogEvent::VerdictAppliedBy(_, _, moderator) => *moderator,
                    VaultLogEvent::RetentionReanchoredBy(_, _, operator) => *operator,
                    VaultLogEvent::DestroyedBy(_, _, _, confirmed_by) => *confirmed_by,
                    _ => None,
                },
                event: match &e.event {
                    VaultLogEvent::Quarantined(file_id, report_index) => {
                        format!("Quarantined file {file_id} (report {report_index})")
                    }
                    VaultLogEvent::Unquarantined(file_id) => format!("Unquarantined file {file_id}"),
                    VaultLogEvent::VerdictApplied(file_id, retention_until) => {
                        format!(
                            "Verdict applied to file {file_id}, retained until {}",
                            format_ts(*retention_until)
                        )
                    }
                    VaultLogEvent::LegalHoldSet(file_id) => format!("Legal hold set on file {file_id}"),
                    VaultLogEvent::LegalHoldCleared(file_id) => format!("Legal hold cleared on file {file_id}"),
                    VaultLogEvent::LegalHoldSetUnder(file_id, reference) => {
                        format!("Legal hold set on file {file_id} under reference {reference}")
                    }
                    VaultLogEvent::LegalHoldClearedUnder(file_id, reference) => {
                        format!("Legal hold cleared on file {file_id} under reference {reference}")
                    }
                    VaultLogEvent::Destroyed(file_id, le_ref) => {
                        format!("Destroyed file {file_id} (law enforcement request {le_ref})")
                    }
                    VaultLogEvent::DestroyedBy(file_id, le_ref, proposed_by, confirmed_by) => {
                        let by = match (proposed_by, confirmed_by) {
                            (Some(p), Some(c)) => format!(", proposed by user {p}, confirmed by user {c}"),
                            _ => String::new(),
                        };
                        format!("Destroyed file {file_id} (law enforcement request {le_ref}{by})")
                    }
                    VaultLogEvent::RetentionExpired(file_id) => {
                        format!("Retention expired for file {file_id}, deleted")
                    }
                    VaultLogEvent::Viewed(file_id, principal) => {
                        format!("File {file_id} viewed by {principal}")
                    }
                    VaultLogEvent::ViewedBy(file_id, principal, user_id) => match user_id {
                        Some(user_id) => format!("File {file_id} viewed by user {user_id}"),
                        None => format!("File {file_id} viewed by {principal}"),
                    },
                    VaultLogEvent::UnquarantinedBy(file_id, moderator) => match moderator {
                        Some(moderator) => format!("Unquarantined file {file_id} (verdict by user {moderator})"),
                        None => format!("Unquarantined file {file_id}"),
                    },
                    VaultLogEvent::VerdictAppliedBy(file_id, retention_until, moderator) => {
                        let until = format_ts(*retention_until);
                        match moderator {
                            Some(moderator) => {
                                format!("Verdict applied to file {file_id} by user {moderator}, retained until {until}")
                            }
                            None => format!("Verdict applied to file {file_id}, retained until {until}"),
                        }
                    }
                    VaultLogEvent::RetentionReanchoredBy(file_id, retention_until, operator) => {
                        let until = format_ts(*retention_until);
                        match operator {
                            Some(operator) => format!(
                                "Retention re-anchored at filing for file {file_id} by user {operator}, retained until {until}"
                            ),
                            None => format!("Retention re-anchored at filing for file {file_id}, retained until {until}"),
                        }
                    }
                },
            })
            .collect(),
    })
}

// RFC 3339 UTC, the unambiguous form for an audit surface
fn format_ts(ts_millis: u64) -> String {
    time::OffsetDateTime::from_unix_timestamp_nanos((ts_millis as i128) * 1_000_000)
        .ok()
        .and_then(|dt| dt.format(&time::format_description::well_known::Rfc3339).ok())
        .unwrap_or_else(|| ts_millis.to_string())
}
