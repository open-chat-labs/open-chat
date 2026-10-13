use crate::lifecycle::init_state;
use crate::memory::{get_stable_memory_map_memory, get_upgrades_memory};
use crate::model::moderation;
use crate::model::reported_messages::ReplaceOldUserIdsResult;
use crate::{Data, RuntimeState, mutate_state};
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use ic_cdk::post_upgrade;
use stable_memory::get_reader;
use tracing::{error, info};
use types::{TimestampMillis, UserId};
use user_index_canister::ChildCanisterType;
use user_index_canister::post_upgrade::Args;
use user_index_canister::resolve_moderation_report::ModerationVerdict;
use utils::cycles::init_cycles_dispenser_client;
use utils::env::canister::CanisterEnv;

#[post_upgrade]
#[trace]
fn post_upgrade(args: Args) {
    stable_memory_map::init(get_stable_memory_map_memory());

    let memory = get_upgrades_memory();
    let reader = get_reader(&memory);

    let (mut data, errors, logs, traces): (Data, Vec<LogEntry>, Vec<LogEntry>, Vec<LogEntry>) =
        msgpack::deserialize(reader).unwrap();

    // One-off: there are no User canisters left, so their wasm is no longer needed
    #[expect(deprecated)]
    let user_wasm_removed = data.child_canister_wasms.remove(ChildCanisterType::User);

    canister_logger::init_with_logs(data.test_mode, errors, logs, traces);

    let env = Box::new(CanisterEnv::new(data.rng_seed));
    init_cycles_dispenser_client(data.cycles_dispenser_canister_id, data.test_mode);
    init_state(env, data, args.wasm_version);

    // TODO remove after the release containing this has been deployed, and the jobs replacing old ids
    // in every chat (#9929, #9933) have completed
    mutate_state(replace_old_user_ids);

    let total_instructions = ic_cdk::api::call_context_instruction_counter();
    info!(version = %args.wasm_version, total_instructions, user_wasm_removed, "Post-upgrade complete");
}

// One-off: replaces the ids users had before being migrated to a MultiUser canister with their latest
// ids, in the reported messages and where users store them. Until then, a sanction against a report's
// sender named by their old id found no user, so was silently skipped. And a report made after its
// sender was migrated, but naming their old id, wasn't recorded against them, so is now.
fn replace_old_user_ids(state: &mut RuntimeState) -> ReplaceOldUserIdsSummary {
    let now = state.env.now();
    let reports = state
        .data
        .reported_messages
        .replace_old_user_ids(&state.data.migrated_user_ids);
    let mut reports_recorded_against_senders = 0;
    for (report_index, sender) in reports.senders_replaced.iter() {
        if state.data.users.add_reported_message_if_missing(*sender, *report_index) {
            reports_recorded_against_senders += 1;
        }
    }
    let (suspended_by_replaced, installed_by_replaced) = state.data.users.replace_old_user_ids(&state.data.migrated_user_ids);

    // Checked once the reports are recorded against their senders, since whether another report keeps
    // a sender sanctioned depends on them
    let sanctions_to_review = reports
        .senders_replaced
        .iter()
        .filter_map(|(report_index, sender)| sanction_to_review(*report_index, *sender, now, state))
        .collect();

    let summary = ReplaceOldUserIdsSummary {
        reports,
        reports_recorded_against_senders,
        sanctions_to_review,
        suspended_by_replaced,
        installed_by_replaced,
    };
    for s in summary.sanctions_to_review.iter() {
        error!(
            report_index = s.report_index,
            sender = %s.sender,
            verdict = ?s.verdict,
            suspended = s.suspended,
            "Sanction to review: the sender's suspension doesn't match a report which named them by their old id"
        );
    }
    info!(
        reports_updated = summary.reports.reports_updated,
        senders_replaced = summary.reports.senders_replaced.len(),
        reports_recorded_against_senders = summary.reports_recorded_against_senders,
        sanctions_to_review = summary.sanctions_to_review.len(),
        lookup_keys_replaced = summary.reports.lookup_keys_replaced,
        lookup_keys_merged = summary.reports.lookup_keys_merged,
        recent_reporters_replaced = summary.reports.recent_reporters_replaced,
        suspended_by_replaced = summary.suspended_by_replaced,
        installed_by_replaced = summary.installed_by_replaced,
        "Replaced old user ids with their latest"
    );
    summary
}

// A verdict recorded on a report after its sender was migrated, but naming their old id, found no user
// to suspend or unsuspend, so never took effect. Nor did an automated sanction applied to such a
// report. Returns the report if the sender's suspension doesn't match it, for a moderator to act on,
// since whether the sanction is still wanted is theirs to decide rather than this one-off's.
fn sanction_to_review(
    report_index: u64,
    sender: UserId,
    now: TimestampMillis,
    state: &RuntimeState,
) -> Option<SanctionToReview> {
    let report = state.data.reported_messages.get(report_index)?;
    // A sender who has since been deleted can't be sanctioned
    state.data.users.get_by_user_id(&sender)?;

    let verdict = report.human_verdict().map(|v| v.verdict);
    let suspended = moderation::is_suspended(sender, state);
    // The report's sanction stands, ie. it's upheld as CSAM, upheld within the last day, or awaiting a
    // verdict on an automated suspension, but the sender isn't suspended
    let should_be_suspended = !suspended && report.keeps_sender_sanctioned(now);
    // The report was dismissed, which reverses the suspension its automated sanction applied, but the
    // sender is still suspended by automation, with nothing else keeping them sanctioned
    let should_be_unsuspended = matches!(verdict, Some(ModerationVerdict::Dismissed))
        && report.machine_sanction_applied()
        && moderation::suspension_is_automated(sender, state)
        && !moderation::has_other_active_sanction(sender, report_index, now, state);

    (should_be_suspended || should_be_unsuspended).then_some(SanctionToReview {
        report_index,
        sender,
        verdict,
        suspended,
    })
}

#[derive(Debug, PartialEq, Eq)]
struct ReplaceOldUserIdsSummary {
    reports: ReplaceOldUserIdsResult,
    reports_recorded_against_senders: usize,
    sanctions_to_review: Vec<SanctionToReview>,
    suspended_by_replaced: usize,
    installed_by_replaced: usize,
}

#[derive(Debug, PartialEq, Eq)]
struct SanctionToReview {
    report_index: u64,
    sender: UserId,
    verdict: Option<ModerationVerdict>,
    suspended: bool,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::reported_messages::{
        AddReportArgs, AddReportResult, AutomatedOutcome, HumanVerdict, ModerationAction, RecordVerdictResult,
    };
    use crate::model::user::User;
    use candid::Principal;
    use constants::{DAY_IN_MS, OPENCHAT_BOT_USER_ID};
    use types::Chat;
    use utils::env::test::TestEnv;

    fn user_id(i: u8) -> UserId {
        Principal::from_slice(&[i]).into()
    }

    // The old and latest ids of the sender of the `i`th report
    fn sender_ids(i: u8) -> (UserId, UserId) {
        (user_id(10 + i), user_id(20 + i))
    }

    // Adds a report of a message sent by `sender`, sanctioned by automation, with the given verdict
    fn add_report(state: &mut RuntimeState, sender: UserId, verdict: Option<(ModerationVerdict, TimestampMillis)>) -> u64 {
        let reported_messages = &mut state.data.reported_messages;
        let message_index = (reported_messages.iter().count() as u32).into();
        let AddReportResult::New(report_index) = reported_messages.add_report(AddReportArgs {
            chat_id: Chat::Group(Principal::from_slice(&[100]).into()),
            thread_root_message_index: None,
            message_index,
            message_id: 1u64.into(),
            sender,
            reporter: user_id(1),
            already_deleted: false,
            csam: false,
            timestamp: 1,
        }) else {
            panic!("Expected a new report");
        };
        reported_messages.record_outcome(
            report_index,
            AutomatedOutcome {
                timestamp: 2,
                flagged_categories: 0,
                action: ModerationAction::AutoSanctioned,
                sanctioned: true,
                classification_failed: false,
                human_verdict: None,
            },
        );
        if let Some((verdict, timestamp)) = verdict {
            let result = reported_messages.record_human_verdict(
                report_index,
                HumanVerdict {
                    verdict,
                    moderator: user_id(2),
                    timestamp,
                },
            );
            assert!(matches!(result, RecordVerdictResult::Success(_)));
        }
        report_index
    }

    #[test]
    fn reports_are_recorded_against_their_senders_and_mismatched_sanctions_are_reported() {
        let env = TestEnv {
            now: 10 * DAY_IN_MS,
            ..Default::default()
        };
        let now = env.now;
        let mut state = RuntimeState::new(Box::new(env), Data::default());
        let (old_moderator, latest_moderator) = (user_id(3), user_id(4));
        state.data.migrated_user_ids.insert(old_moderator, latest_moderator);
        for i in 0..6 {
            let (old, latest) = sender_ids(i);
            state.data.migrated_user_ids.insert(old, latest);
            state.data.users.add_test_user(User {
                principal: Principal::from_slice(&[50 + i]),
                user_id: latest,
                username: format!("user{i}"),
                ..Default::default()
            });
        }
        let suspend = |state: &mut RuntimeState, i, suspended_by| {
            state
                .data
                .users
                .suspend_user(sender_ids(i).1, None, "reason".to_string(), suspended_by, 1);
        };

        // 0: dismissed, but the sender is still suspended by automation
        let dismissed = add_report(&mut state, sender_ids(0).0, Some((ModerationVerdict::Dismissed, now)));
        suspend(&mut state, 0, OPENCHAT_BOT_USER_ID);
        // 1: upheld as CSAM, but the sender isn't suspended
        let upheld_as_csam = add_report(&mut state, sender_ids(1).0, Some((ModerationVerdict::UpheldAsCsam, now)));
        // 2: upheld two days ago, so the sender's suspension for it is over
        add_report(
            &mut state,
            sender_ids(2).0,
            Some((ModerationVerdict::Upheld, now - 2 * DAY_IN_MS)),
        );
        // 3: awaiting a verdict, with the sender suspended, and already recorded against them
        let pending = add_report(&mut state, sender_ids(3).0, None);
        suspend(&mut state, 3, OPENCHAT_BOT_USER_ID);
        state.data.users.push_reported_message(sender_ids(3).1, pending);
        // 4: dismissed, with the sender suspended by a moderator, named by their old id
        add_report(&mut state, sender_ids(4).0, Some((ModerationVerdict::Dismissed, now)));
        suspend(&mut state, 4, old_moderator);
        // 5: dismissed, with the sender suspended by automation, but kept so by a later report
        let dismissed_but_kept = add_report(&mut state, sender_ids(5).0, Some((ModerationVerdict::Dismissed, now)));
        suspend(&mut state, 5, OPENCHAT_BOT_USER_ID);
        let later = add_report(&mut state, sender_ids(5).1, None);
        state.data.users.push_reported_message(sender_ids(5).1, later);

        let summary = replace_old_user_ids(&mut state);

        assert_eq!(
            summary,
            ReplaceOldUserIdsSummary {
                reports: ReplaceOldUserIdsResult {
                    reports_updated: 6,
                    senders_replaced: (0..6).map(|i| (i as u64, sender_ids(i).1)).collect(),
                    ..Default::default()
                },
                reports_recorded_against_senders: 5,
                sanctions_to_review: vec![
                    SanctionToReview {
                        report_index: dismissed,
                        sender: sender_ids(0).1,
                        verdict: Some(ModerationVerdict::Dismissed),
                        suspended: true,
                    },
                    SanctionToReview {
                        report_index: upheld_as_csam,
                        sender: sender_ids(1).1,
                        verdict: Some(ModerationVerdict::UpheldAsCsam),
                        suspended: false,
                    },
                ],
                suspended_by_replaced: 1,
                installed_by_replaced: 0,
            }
        );

        let reported_messages = |i| {
            state
                .data
                .users
                .get_by_user_id(&sender_ids(i).1)
                .unwrap()
                .reported_messages
                .clone()
        };
        assert_eq!(reported_messages(0), vec![dismissed]);
        // Already recorded, so not recorded again
        assert_eq!(reported_messages(3), vec![pending]);
        // Recorded in the order the reports were made
        assert_eq!(reported_messages(5), vec![dismissed_but_kept, later]);
    }
}
