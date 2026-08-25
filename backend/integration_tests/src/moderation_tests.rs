use crate::client::{start_canister, stop_canister};
use crate::env::ENV;
use crate::utils::{now_millis, tick_many};
use crate::{CanisterIds, TestEnv, User, client};
use candid::Principal;
use constants::DAY_IN_MS;
use constants::OPENCHAT_BOT_USER_ID;
use pocket_ic::PocketIc;
use pocket_ic::common::rest::{CanisterHttpReply, CanisterHttpResponse, MockCanisterHttpResponse};
use serde_json::{Value, json};
use std::ops::Deref;
use std::time::Duration;
use testing::rng::{random_from_u128, random_principal, random_string};
use types::{
    BlobReference, ChannelId, ChatEvent, ChatId, CommunityId, EventIndex, FileContent, ImageContent, MediaScanBlobOutcome,
    MediaScanConfig, MediaScanMatch, MediaScanProvider, MediaScanVerdict, MessageContent, MessageContentInitial,
    ModerationReportContent, ModerationReportStatus, SuspensionAction, ThumbnailData, UnitResult,
};
use user_index_canister::propose_protected_action::ProtectedAction;
use user_index_canister::resolve_moderation_report::ModerationVerdict;
use user_index_canister::set_internal_moderation_channel::InternalModerationChannel;
use user_index_canister::users::UserGroup;

// All message content in these tests is benign placeholder text. The classification outcome is
// dictated entirely by the mocked moderation API responses below - the real API is never called
// and nothing resembling abusive content exists anywhere in these tests.
//
// Each test appends a random suffix to this text so that its own classify requests can be told
// apart from stale ones: test envs are pooled, so an env which previously ran a moderation test
// still has the API key configured, and a later test which sends a public message and advances
// time can leave a classify outcall pending (or a message queued in the broker) which then
// surfaces during whichever moderation test draws that env next.
const TEST_MESSAGE_TEXT: &str = "an entirely ordinary test message";
const CSAM_CATEGORY: &str = "sexual/minors";

#[test]
fn csam_pipeline_detection_triggers_auto_sanction() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let test_data = init_test_data(env, canister_ids, *controller);

    let message_id = random_from_u128();
    let message_text = format!("{TEST_MESSAGE_TEXT} {}", random_string());
    client::group::happy_path::send_text_message(
        env,
        &test_data.sender,
        test_data.group_id,
        None,
        &message_text,
        Some(message_id),
    );

    // The classify request reaches the local index broker via the event sync queue, then the
    // broker classifies on a 10s timer
    tick_many(env, 3);
    env.advance_time(Duration::from_secs(10));
    let handled = mock_moderation_outcalls(env, &message_text, &[CSAM_CATEGORY], 1);
    assert_eq!(handled, 1);

    // Flags route back to the group, which escalates to user_index (via group_index), which
    // deletes the message, suspends the sender and posts an alert to the moderation channel
    tick_many(env, 10);

    let message_content = get_message_content(env, &test_data.group_owner, test_data.group_id, message_id);
    assert!(matches!(message_content, MessageContent::Deleted(_)), "{message_content:?}");

    let sender_state = client::user_index::happy_path::current_user(env, test_data.sender.principal, canister_ids.user_index);
    let suspension_details = sender_state.suspension_details.expect("sender should be suspended");
    assert!(matches!(suspension_details.action, SuspensionAction::Delete(_)));

    let reports = get_moderation_reports(env, &test_data);
    assert_eq!(reports.len(), 1);
    let report = &reports[0];
    assert_eq!(report.sender, test_data.sender.user_id);
    assert!(report.auto_sanctioned);
    assert!(report.reporters.is_empty());
    // Proactive detections now create a resolvable report so the auto-sanction can be
    // reviewed, contested, or reversed
    let report_index = report.report_index.expect("proactive detection should carry a report index");

    // While quarantined, the soft-deleted content is viewable by no one - not even the group
    // owner who could normally view messages deleted by moderation
    let deleted_message_response = client::group::deleted_message(
        env,
        test_data.group_owner.principal,
        test_data.group_id.into(),
        &group_canister::deleted_message::Args {
            thread_root_message_index: None,
            message_id,
        },
    );
    assert!(
        matches!(deleted_message_response, group_canister::deleted_message::Response::Error(_)),
        "{deleted_message_response:?}"
    );

    // The sanctioned sender contests the automated decision (the Art 22 safeguard)
    let contest_response = client::user_index::contest_moderation_sanction(
        env,
        test_data.sender.principal,
        canister_ids.user_index,
        &types::Empty {},
    );
    assert!(matches!(contest_response, UnitResult::Success), "{contest_response:?}");

    // A second contest of the same sanction is rejected
    let second_contest = client::user_index::contest_moderation_sanction(
        env,
        test_data.sender.principal,
        canister_ids.user_index,
        &types::Empty {},
    );
    assert!(matches!(second_contest, UnitResult::Error(_)));

    // A Dismissed verdict reverses the sanction: the sender is unsuspended and the report is
    // resolved. (Message restoration is asserted once the chat-canister receivers land.)
    let resolve_response = client::user_index::resolve_moderation_report(
        env,
        test_data.moderator.principal,
        canister_ids.user_index,
        &user_index_canister::resolve_moderation_report::Args {
            report_index,
            verdict: ModerationVerdict::Dismissed,
            urgent: None,
        },
    );
    assert!(matches!(resolve_response, UnitResult::Success), "{resolve_response:?}");
    tick_many(env, 10);

    let sender_state = client::user_index::happy_path::current_user(env, test_data.sender.principal, canister_ids.user_index);
    assert!(sender_state.suspension_details.is_none(), "sender should be unsuspended");

    // The false positive is fully reversed: the message is restored for everyone
    let message_content = get_message_content(env, &test_data.group_owner, test_data.group_id, message_id);
    assert!(matches!(message_content, MessageContent::Text(_)), "{message_content:?}");

    let reports = get_moderation_reports(env, &test_data);
    assert!(matches!(reports[0].status, ModerationReportStatus::Dismissed(_)));
}

#[test]
fn report_then_upheld_as_csam_verdict_applies_sanction() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let test_data = init_test_data(env, canister_ids, *controller);

    let message_id = random_from_u128();
    let message_text = format!("{TEST_MESSAGE_TEXT} {}", random_string());
    client::group::happy_path::send_text_message(
        env,
        &test_data.sender,
        test_data.group_id,
        None,
        &message_text,
        Some(message_id),
    );
    tick_many(env, 3);

    // The report triggers a classification from user_index, and the pipeline classifies the
    // message independently via the broker - answer both with a clean classification so that
    // the report escalates for human review
    let report_response = client::group::report_message(
        env,
        test_data.reporter.principal,
        test_data.group_id.into(),
        &group_canister::report_message::Args {
            thread_root_message_index: None,
            message_id,
            delete: false,
            csam: false,
        },
    );
    assert!(matches!(report_response, UnitResult::Success));

    tick_many(env, 3);
    env.advance_time(Duration::from_secs(10));
    mock_moderation_outcalls(env, &message_text, &[], 2);
    tick_many(env, 10);

    let reports = get_moderation_reports(env, &test_data);
    assert_eq!(reports.len(), 1);
    let report = &reports[0];
    assert!(matches!(report.status, ModerationReportStatus::Pending));
    assert!(!report.auto_sanctioned);
    assert_eq!(report.reporters, vec![test_data.reporter.user_id]);
    let report_index = report.report_index.expect("reported message should carry a report index");

    // The message is untouched while the report is pending
    let message_content = get_message_content(env, &test_data.group_owner, test_data.group_id, message_id);
    assert!(matches!(message_content, MessageContent::Text(_)));

    let before_verdict = now_millis(env);
    // The users query filter is strictly `date_updated > updated_since` and PocketIC time is
    // frozen between ticks, so move the clock past the captured timestamp
    env.advance_time(Duration::from_millis(100));

    let resolve_response = client::user_index::resolve_moderation_report(
        env,
        test_data.moderator.principal,
        canister_ids.user_index,
        &user_index_canister::resolve_moderation_report::Args {
            report_index,
            verdict: ModerationVerdict::UpheldAsCsam,
            urgent: Some(false),
        },
    );
    assert!(matches!(resolve_response, UnitResult::Success));
    tick_many(env, 10);

    let message_content = get_message_content(env, &test_data.group_owner, test_data.group_id, message_id);
    assert!(matches!(message_content, MessageContent::Deleted(_)), "{message_content:?}");

    let sender_state = client::user_index::happy_path::current_user(env, test_data.sender.principal, canister_ids.user_index);
    let suspension_details = sender_state.suspension_details.expect("sender should be suspended");
    assert!(matches!(suspension_details.action, SuspensionAction::Delete(_)));

    // The suspended flag must reach clients which were already tracking the user - this is the
    // date_updated regression: the users query only returns a stable summary if the user's
    // date_updated has moved past updated_since
    let user_index_canister::users::Response::Success(users_result) = client::user_index::users(
        env,
        Principal::anonymous(),
        canister_ids.user_index,
        &user_index_canister::users::Args {
            user_groups: vec![UserGroup {
                users: vec![test_data.sender.user_id],
                updated_since: before_verdict,
            }],
            users_suspended_since: None,
        },
    );
    let summary = users_result
        .users
        .iter()
        .find(|u| u.user_id == test_data.sender.user_id)
        .expect("suspended user should be returned to clients already tracking them");
    assert!(summary.stable.as_ref().expect("stable summary should be returned").suspended);

    // The alert message in the moderation channel shows the verdict
    let reports = get_moderation_reports(env, &test_data);
    assert!(matches!(reports[0].status, ModerationReportStatus::UpheldAsCsam(_)));

    // Double resolution is rejected
    let second_resolve = client::user_index::resolve_moderation_report(
        env,
        test_data.moderator.principal,
        canister_ids.user_index,
        &user_index_canister::resolve_moderation_report::Args {
            report_index,
            verdict: ModerationVerdict::Dismissed,
            urgent: None,
        },
    );
    assert!(matches!(second_resolve, UnitResult::Error(_)));

    // The upheld verdict locked the content behind the quarantine read-gate: even the sender
    // can no longer retrieve it via the deleted_message escape hatch
    let deleted_message_response = client::group::deleted_message(
        env,
        test_data.sender.principal,
        test_data.group_id.into(),
        &group_canister::deleted_message::Args {
            thread_root_message_index: None,
            message_id,
        },
    );
    assert!(
        matches!(deleted_message_response, group_canister::deleted_message::Response::Error(_)),
        "{deleted_message_response:?}"
    );

    // The upheld CSAM verdict put an authority report on the due register; the operator files
    // it (manually, via the portal) and records the filing reference
    // Filter by report index: the register is global state, and a pooled env may hold due
    // rows left behind by other moderation tests
    let register = get_authority_reports(env, &test_data, canister_ids);
    let due_rows: Vec<_> = register["due"]
        .as_array()
        .unwrap()
        .iter()
        .filter(|r| r["report_index"] == report_index)
        .collect();
    assert_eq!(due_rows.len(), 1);

    // The alert card carries the filing obligation: Due after the verdict...
    let reports = get_moderation_reports(env, &test_data);
    let report = reports.iter().find(|r| r.report_index == Some(report_index)).unwrap();
    assert!(
        matches!(
            report.authority_report,
            Some(types::AuthorityReportState::Due { urgent: false })
        ),
        "{:?}",
        report.authority_report
    );

    let record_response = client::user_index::record_authority_report_filed(
        env,
        test_data.moderator.principal,
        canister_ids.user_index,
        &user_index_canister::record_authority_report_filed::Args {
            report_index,
            portal_reference: "CSEA-IRP-TEST-0001".to_string(),
            urgent: false,
            unverified: false,
            portal_reference_uuid: None,
            vault_token: None,
        },
    );
    assert!(matches!(record_response, UnitResult::Success));
    tick_many(env, 5);

    // ...and Filed once the portal reference is recorded
    let reports = get_moderation_reports(env, &test_data);
    let report = reports.iter().find(|r| r.report_index == Some(report_index)).unwrap();
    assert!(
        matches!(
            &report.authority_report,
            Some(types::AuthorityReportState::Filed { portal_reference }) if portal_reference == "CSEA-IRP-TEST-0001"
        ),
        "{:?}",
        report.authority_report
    );

    let register = get_authority_reports(env, &test_data, canister_ids);
    assert!(
        !register["due"]
            .as_array()
            .unwrap()
            .iter()
            .any(|r| r["report_index"] == report_index)
    );
    let filed_row = register["filed"]
        .as_array()
        .unwrap()
        .iter()
        .find(|f| f["report_index"] == report_index)
        .expect("filed row should exist");
    assert_eq!(filed_row["portal_reference"], "CSEA-IRP-TEST-0001");

    // Refiling (eg. a corrected portal reference) replaces the row rather than duplicating it
    let refile = client::user_index::record_authority_report_filed(
        env,
        test_data.moderator.principal,
        canister_ids.user_index,
        &user_index_canister::record_authority_report_filed::Args {
            report_index,
            portal_reference: "CSEA-IRP-TEST-0001-CORRECTED".to_string(),
            urgent: false,
            unverified: false,
            portal_reference_uuid: None,
            vault_token: None,
        },
    );
    assert!(matches!(refile, UnitResult::Success));
    let register = get_authority_reports(env, &test_data, canister_ids);
    let filed = register["filed"].as_array().unwrap();
    let rows: Vec<_> = filed.iter().filter(|f| f["report_index"] == report_index).collect();
    assert_eq!(rows.len(), 1);
    assert_eq!(rows[0]["portal_reference"], "CSEA-IRP-TEST-0001-CORRECTED");
}

#[test]
fn repeat_reports_of_same_message_attach_to_a_single_report() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let test_data = init_test_data(env, canister_ids, *controller);

    let reporter2 = client::register_user(env, canister_ids);
    let reporter3 = client::register_user(env, canister_ids);
    for user in [&reporter2, &reporter3] {
        client::local_user_index::happy_path::join_group(
            env,
            user.principal,
            canister_ids.local_user_index(env, test_data.group_id),
            test_data.group_id,
        );
    }

    let message_id = random_from_u128();
    let message_text = format!("{TEST_MESSAGE_TEXT} {}", random_string());
    client::group::happy_path::send_text_message(
        env,
        &test_data.sender,
        test_data.group_id,
        None,
        &message_text,
        Some(message_id),
    );
    tick_many(env, 3);

    let report = |env: &mut PocketIc, principal| {
        client::group::report_message(
            env,
            principal,
            test_data.group_id.into(),
            &group_canister::report_message::Args {
                thread_root_message_index: None,
                message_id,
                delete: false,
                csam: false,
            },
        )
    };

    // First report creates the pending report and triggers classification (the broker also
    // classifies the message independently)
    assert!(matches!(report(env, test_data.reporter.principal), UnitResult::Success));
    tick_many(env, 3);
    env.advance_time(Duration::from_secs(10));
    mock_moderation_outcalls(env, &message_text, &[], 2);
    tick_many(env, 10);

    // Second and third reports attach to the existing report. Before the add_report lookup fix
    // the second report corrupted the lookup index and the third one panicked (or mutated an
    // unrelated report)
    assert!(matches!(report(env, reporter2.principal), UnitResult::Success));
    tick_many(env, 3);
    assert!(matches!(report(env, reporter3.principal), UnitResult::Success));
    tick_many(env, 3);

    // Reporting the same message twice from the same user is rejected
    assert!(matches!(report(env, reporter2.principal), UnitResult::Error(_)));

    // Only a single alert message exists in the moderation channel
    let reports = get_moderation_reports(env, &test_data);
    assert_eq!(reports.len(), 1);
    assert_eq!(reports[0].reporters, vec![test_data.reporter.user_id]);
}

#[test]
fn escalated_media_report_upheld_as_csam_vaults_evidence() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let test_data = init_test_data(env, canister_ids, *controller);

    // The moderator (also the platform operator) is designated as a vault reviewer; the
    // principal set syncs user_index -> storage_index -> buckets
    client::user_index::happy_path::execute_protected_action(
        env,
        test_data.moderator.principal,
        test_data.operator2.principal,
        canister_ids.user_index,
        ProtectedAction::SetVaultReviewers(user_index_canister::set_vault_reviewers::Args {
            user_ids: vec![test_data.moderator.user_id],
        }),
    );
    tick_many(env, 5);

    // A file message with no caption has an empty moderation input, so the report escalates
    // for human review without any classifier call - exercising the escalated-media branch
    // (quarantine and verdict must arrive at the bucket as one ordered message)
    let file_size = 1000u32;
    let blob_reference = client::storage_index::happy_path::upload_file(
        env,
        test_data.sender.principal,
        canister_ids.storage_index,
        file_size,
        vec![test_data.sender.canister()],
    );
    let message_id = random_from_u128();
    let send_response = client::group::send_message_v2(
        env,
        test_data.sender.principal,
        test_data.group_id.into(),
        &group_canister::send_message_v2::Args {
            thread_root_message_index: None,
            message_id,
            content: MessageContentInitial::File(FileContent {
                name: random_string(),
                caption: None,
                mime_type: "application/octet-stream".to_string(),
                file_size,
                blob_reference: Some(blob_reference.clone()),
            }),
            sender_name: test_data.sender.username(),
            sender_display_name: None,
            replies_to: None,
            mentioned: Vec::new(),
            forwarding: false,
            block_level_markdown: false,
            rules_accepted: None,
            message_filter_failed: None,
            new_achievement: false,
            og_previews: Vec::new(),
        },
    );
    assert!(
        matches!(send_response, group_canister::send_message_v2::Response::Success(_)),
        "{send_response:?}"
    );
    tick_many(env, 3);

    let report_response = client::group::report_message(
        env,
        test_data.reporter.principal,
        test_data.group_id.into(),
        &group_canister::report_message::Args {
            thread_root_message_index: None,
            message_id,
            delete: false,
            csam: false,
        },
    );
    assert!(matches!(report_response, UnitResult::Success));
    tick_many(env, 10);

    let reports = get_moderation_reports(env, &test_data);
    assert_eq!(reports.len(), 1);
    assert!(matches!(reports[0].status, ModerationReportStatus::Pending));
    // The alert carries the blob references even while the report is merely escalated, so the
    // moderator can review private-chat media they cannot view in place (fetched from the
    // ordinary blob url pre-verdict; via the vault once quarantined)
    assert_eq!(reports[0].blob_references, vec![blob_reference.clone()]);
    let report_index = reports[0].report_index.expect("report should carry an index");

    // Upheld as CSAM with the imminent-threat flag: quarantine + retention verdict travel to
    // the bucket in order, the content locks behind the read-gate, and an urgent authority
    // report becomes due
    let resolve_response = client::user_index::resolve_moderation_report(
        env,
        test_data.moderator.principal,
        canister_ids.user_index,
        &user_index_canister::resolve_moderation_report::Args {
            report_index,
            verdict: ModerationVerdict::UpheldAsCsam,
            urgent: Some(true),
        },
    );
    assert!(matches!(resolve_response, UnitResult::Success));
    tick_many(env, 15);

    let deleted_message_response = client::group::deleted_message(
        env,
        test_data.sender.principal,
        test_data.group_id.into(),
        &group_canister::deleted_message::Args {
            thread_root_message_index: None,
            message_id,
        },
    );
    assert!(
        matches!(deleted_message_response, group_canister::deleted_message::Response::Error(_)),
        "{deleted_message_response:?}"
    );

    let register = get_authority_reports(env, &test_data, canister_ids);
    let due_row = register["due"]
        .as_array()
        .unwrap()
        .iter()
        .find(|r| r["report_index"] == report_index)
        .expect("due row should exist");
    assert_eq!(due_row["urgent"], true);

    // The designated reviewer can fetch the quarantined blob from the vault (the logged
    // review act); anyone else is refused
    let chunk_response = client::storage_bucket::vault_file_chunk(
        env,
        test_data.moderator.principal,
        blob_reference.canister_id,
        &storage_bucket_canister::vault_file_chunk::Args {
            file_id: blob_reference.blob_id,
            chunk_index: 0,
            vault_token: None,
        },
    );
    let storage_bucket_canister::vault_file_chunk::Response::Success(chunk) = chunk_response else {
        panic!("reviewer should be able to fetch the vaulted blob: {chunk_response:?}");
    };
    assert_eq!(chunk.total_size, file_size as u64);
    assert_eq!(chunk.bytes.len(), file_size as usize);

    let unauthorized = client::storage_bucket::vault_file_chunk(
        env,
        test_data.sender.principal,
        blob_reference.canister_id,
        &storage_bucket_canister::vault_file_chunk::Args {
            file_id: blob_reference.blob_id,
            chunk_index: 0,
            vault_token: None,
        },
    );
    assert!(matches!(
        unauthorized,
        storage_bucket_canister::vault_file_chunk::Response::NotAuthorized
    ));

    // The storage index lists the bucket for the vault-log audit view
    let storage_index_canister::vault_buckets::Response::Success(buckets) = client::storage_index::vault_buckets(
        env,
        test_data.moderator.principal,
        canister_ids.storage_index,
        &types::Empty {},
    );
    assert!(buckets.buckets.contains(&blob_reference.canister_id));

    // The vault access log is the complete attributed chain of custody: quarantined (with the
    // report linkage), viewed by the reviewer, verdict applied by the moderator - and it is
    // readable by the designated reviewer only
    let storage_bucket_canister::vault_log::Response::Success(log) = client::storage_bucket::vault_log(
        env,
        test_data.moderator.principal,
        blob_reference.canister_id,
        &storage_bucket_canister::vault_log::Args {
            start: 0,
            max: 100,
            file_id: Some(blob_reference.blob_id),
        },
    ) else {
        panic!("reviewer should be able to read the vault log");
    };
    assert!(log.total >= 3, "{:?}", log.entries);
    let events: Vec<&str> = log.entries.iter().map(|e| e.event.as_str()).collect();
    assert!(
        events[0].starts_with(&format!("Quarantined file {}", blob_reference.blob_id)),
        "{events:?}"
    );
    assert!(
        log.entries
            .iter()
            .any(|e| e.event.contains("viewed by user") && e.user_id == Some(test_data.moderator.user_id)),
        "{events:?}"
    );
    assert!(
        log.entries
            .iter()
            .any(|e| e.event.starts_with("Verdict applied") && e.user_id == Some(test_data.moderator.user_id)),
        "{events:?}"
    );
    // Entries chain: each prev_hash is non-trivial after the first
    assert!(log.entries.iter().skip(1).all(|e| e.prev_hash.chars().any(|c| c != '0')));

    let not_a_reviewer = client::storage_bucket::vault_log(
        env,
        test_data.sender.principal,
        blob_reference.canister_id,
        &storage_bucket_canister::vault_log::Args {
            start: 0,
            max: 100,
            file_id: None,
        },
    );
    assert!(matches!(
        not_a_reviewer,
        storage_bucket_canister::vault_log::Response::NotAuthorized
    ));
}

#[test]
fn proactive_detection_upheld_downgrades_suspension() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let test_data = init_test_data(env, canister_ids, *controller);

    let message_id = random_from_u128();
    let message_text = format!("{TEST_MESSAGE_TEXT} {}", random_string());
    client::group::happy_path::send_text_message(
        env,
        &test_data.sender,
        test_data.group_id,
        None,
        &message_text,
        Some(message_id),
    );
    tick_many(env, 3);
    env.advance_time(Duration::from_secs(10));
    mock_moderation_outcalls(env, &message_text, &[CSAM_CATEGORY], 1);
    tick_many(env, 10);

    let reports = get_moderation_reports(env, &test_data);
    let report_index = reports[0].report_index.expect("proactive detection should carry an index");

    // Upheld (a rules violation but not CSAM): the indefinite suspension downgrades to the
    // standard severity, and the content is permanently removed
    let resolve_response = client::user_index::resolve_moderation_report(
        env,
        test_data.moderator.principal,
        canister_ids.user_index,
        &user_index_canister::resolve_moderation_report::Args {
            report_index,
            verdict: ModerationVerdict::Upheld,
            urgent: None,
        },
    );
    assert!(matches!(resolve_response, UnitResult::Success));
    tick_many(env, 10);

    let sender_state = client::user_index::happy_path::current_user(env, test_data.sender.principal, canister_ids.user_index);
    let suspension_details = sender_state.suspension_details.expect("sender should remain suspended");
    assert!(
        matches!(suspension_details.action, SuspensionAction::Unsuspend(_)),
        "suspension should be downgraded to a timed one: {:?}",
        suspension_details.action
    );

    let deleted_message_response = client::group::deleted_message(
        env,
        test_data.sender.principal,
        test_data.group_id.into(),
        &group_canister::deleted_message::Args {
            thread_root_message_index: None,
            message_id,
        },
    );
    assert!(
        matches!(deleted_message_response, group_canister::deleted_message::Response::Error(_)),
        "{deleted_message_response:?}"
    );

    let reports = get_moderation_reports(env, &test_data);
    assert!(matches!(reports[0].status, ModerationReportStatus::Upheld(_)));
}

#[test]
fn moderation_referral_creates_report_and_upheld_verdict_sanctions() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let test_data = init_test_data(env, canister_ids, *controller);

    // Configure the classifier to refer high-scoring `sexual` hits for human review
    let config_response = client::user_index::set_moderation_referral_config(
        env,
        test_data.moderator.principal,
        canister_ids.user_index,
        &user_index_canister::set_moderation_referral_config::Args {
            config: Some(types::ModerationReferralConfig {
                categories: vec![types::ModerationReferralCategory {
                    category: types::ModerationCategories::SEXUAL.bits(),
                    score_threshold: 0.9,
                }],
            }),
        },
    );
    assert!(matches!(config_response, UnitResult::Success), "{config_response:?}");
    tick_many(env, 5);

    // The config is observable: operators can see what is actually set
    let user_index_canister::moderation_config::Response::Success(config) =
        client::user_index::moderation_config(env, test_data.moderator.principal, canister_ids.user_index, &types::Empty {});
    assert!(config.openai_api_key_set);
    assert!(config.internal_moderation_channel.is_some());
    let referral = config.moderation_referral_config.expect("referral config should be set");
    assert_eq!(referral.categories.len(), 1);
    assert_eq!(referral.categories[0].category, types::ModerationCategories::SEXUAL.bits());

    let message_id = random_from_u128();
    let message_text = format!("{TEST_MESSAGE_TEXT} {}", random_string());
    client::group::happy_path::send_text_message(
        env,
        &test_data.sender,
        test_data.group_id,
        None,
        &message_text,
        Some(message_id),
    );
    tick_many(env, 3);
    env.advance_time(Duration::from_secs(10));
    let handled = mock_moderation_outcalls(env, &message_text, &["sexual"], 1);
    assert_eq!(handled, 1);
    tick_many(env, 10);

    // A referral creates a report and alerts the moderators, but takes no action: the message
    // stays live and the sender is untouched
    let message_content = get_message_content(env, &test_data.group_owner, test_data.group_id, message_id);
    assert!(matches!(message_content, MessageContent::Text(_)), "{message_content:?}");

    let sender_state = client::user_index::happy_path::current_user(env, test_data.sender.principal, canister_ids.user_index);
    assert!(sender_state.suspension_details.is_none());

    let reports = get_moderation_reports(env, &test_data);
    let report = reports
        .iter()
        .find(|r| r.sender == test_data.sender.user_id && matches!(r.status, ModerationReportStatus::Pending))
        .expect("referral should create a pending report");
    assert!(!report.auto_sanctioned);
    assert!(report.reporters.is_empty());
    let report_index = report.report_index.expect("referral should carry a report index");

    // A human upholds the referral: the message is deleted and the sender receives the
    // standard (timed) suspension
    let resolve_response = client::user_index::resolve_moderation_report(
        env,
        test_data.moderator.principal,
        canister_ids.user_index,
        &user_index_canister::resolve_moderation_report::Args {
            report_index,
            verdict: ModerationVerdict::Upheld,
            urgent: None,
        },
    );
    assert!(matches!(resolve_response, UnitResult::Success), "{resolve_response:?}");
    tick_many(env, 10);

    let message_content = get_message_content(env, &test_data.group_owner, test_data.group_id, message_id);
    assert!(matches!(message_content, MessageContent::Deleted(_)), "{message_content:?}");

    let sender_state = client::user_index::happy_path::current_user(env, test_data.sender.principal, canister_ids.user_index);
    let suspension_details = sender_state.suspension_details.expect("sender should be suspended");
    assert!(
        matches!(suspension_details.action, SuspensionAction::Unsuspend(_)),
        "{:?}",
        suspension_details.action
    );

    let reports = get_moderation_reports(env, &test_data);
    let report = reports.iter().find(|r| r.report_index == Some(report_index)).unwrap();
    assert!(matches!(report.status, ModerationReportStatus::Upheld(_)));
}

#[test]
fn csam_asserted_report_applies_auto_sanction_and_dismissal_reverses() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let test_data = init_test_data(env, canister_ids, *controller);

    let message_id = random_from_u128();
    let message_text = format!("{TEST_MESSAGE_TEXT} {}", random_string());
    client::group::happy_path::send_text_message(
        env,
        &test_data.sender,
        test_data.group_id,
        None,
        &message_text,
        Some(message_id),
    );
    tick_many(env, 3);

    // The reporter asserts CSAM: quarantine + deletion apply immediately, but the suspension
    // waits for the human verdict - a reporter is not a trusted classifier, and immediate
    // suspension would let any account grind others offline with false assertions
    let report_response = client::group::report_message(
        env,
        test_data.reporter.principal,
        test_data.group_id.into(),
        &group_canister::report_message::Args {
            thread_root_message_index: None,
            message_id,
            delete: false,
            csam: true,
        },
    );
    assert!(matches!(report_response, UnitResult::Success));
    tick_many(env, 10);

    let message_content = get_message_content(env, &test_data.group_owner, test_data.group_id, message_id);
    assert!(matches!(message_content, MessageContent::Deleted(_)), "{message_content:?}");

    let sender_state = client::user_index::happy_path::current_user(env, test_data.sender.principal, canister_ids.user_index);
    assert!(
        sender_state.suspension_details.is_none(),
        "suspension should await the verdict"
    );

    // The alert reflects an auto-sanctioned report raised by a user (not the pipeline)
    let reports = get_moderation_reports(env, &test_data);
    let report = reports
        .iter()
        .find(|r| r.sender == test_data.sender.user_id && r.reporters.contains(&test_data.reporter.user_id))
        .expect("report should exist");
    assert!(report.auto_sanctioned);
    assert!(matches!(report.status, ModerationReportStatus::Pending));
    let report_index = report.report_index.expect("report should carry an index");

    // The quarantine read-gate holds even though this was reporter-asserted rather than
    // classifier-detected
    let deleted_message_response = client::group::deleted_message(
        env,
        test_data.sender.principal,
        test_data.group_id.into(),
        &group_canister::deleted_message::Args {
            thread_root_message_index: None,
            message_id,
        },
    );
    assert!(
        matches!(deleted_message_response, group_canister::deleted_message::Response::Error(_)),
        "{deleted_message_response:?}"
    );

    // A moderator dismisses the false report: full reversal
    let resolve_response = client::user_index::resolve_moderation_report(
        env,
        test_data.moderator.principal,
        canister_ids.user_index,
        &user_index_canister::resolve_moderation_report::Args {
            report_index,
            verdict: ModerationVerdict::Dismissed,
            urgent: None,
        },
    );
    assert!(matches!(resolve_response, UnitResult::Success), "{resolve_response:?}");
    tick_many(env, 10);

    let sender_state = client::user_index::happy_path::current_user(env, test_data.sender.principal, canister_ids.user_index);
    assert!(sender_state.suspension_details.is_none(), "sender should be unsuspended");

    let message_content = get_message_content(env, &test_data.group_owner, test_data.group_id, message_id);
    assert!(matches!(message_content, MessageContent::Text(_)), "{message_content:?}");
}

#[test]
fn csam_asserted_media_report_quarantines_immediately() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let test_data = init_test_data(env, canister_ids, *controller);

    client::user_index::happy_path::execute_protected_action(
        env,
        test_data.moderator.principal,
        test_data.operator2.principal,
        canister_ids.user_index,
        ProtectedAction::SetVaultReviewers(user_index_canister::set_vault_reviewers::Args {
            user_ids: vec![test_data.moderator.user_id],
        }),
    );
    tick_many(env, 5);

    let file_size = 1000u32;
    let blob_reference = client::storage_index::happy_path::upload_file(
        env,
        test_data.sender.principal,
        canister_ids.storage_index,
        file_size,
        vec![test_data.sender.canister()],
    );
    let message_id = random_from_u128();
    let send_response = client::group::send_message_v2(
        env,
        test_data.sender.principal,
        test_data.group_id.into(),
        &group_canister::send_message_v2::Args {
            thread_root_message_index: None,
            message_id,
            content: MessageContentInitial::File(FileContent {
                name: random_string(),
                caption: None,
                mime_type: "application/octet-stream".to_string(),
                file_size,
                blob_reference: Some(blob_reference.clone()),
            }),
            sender_name: test_data.sender.username(),
            sender_display_name: None,
            replies_to: None,
            mentioned: Vec::new(),
            forwarding: false,
            block_level_markdown: false,
            rules_accepted: None,
            message_filter_failed: None,
            new_achievement: false,
            og_previews: Vec::new(),
        },
    );
    assert!(
        matches!(send_response, group_canister::send_message_v2::Response::Success(_)),
        "{send_response:?}"
    );
    tick_many(env, 3);

    // A CSAM-asserted report: the auto-sanction applies immediately with no classifier call -
    // media quarantined in the vault, message deleted and read-gated, sender suspended
    let report_response = client::group::report_message(
        env,
        test_data.reporter.principal,
        test_data.group_id.into(),
        &group_canister::report_message::Args {
            thread_root_message_index: None,
            message_id,
            delete: false,
            csam: true,
        },
    );
    assert!(matches!(report_response, UnitResult::Success));
    tick_many(env, 10);

    let sender_state = client::user_index::happy_path::current_user(env, test_data.sender.principal, canister_ids.user_index);
    assert!(
        sender_state.suspension_details.is_none(),
        "suspension should await the verdict"
    );

    // The vault holds the media: the reviewer can fetch it, nobody else can
    let chunk_response = client::storage_bucket::vault_file_chunk(
        env,
        test_data.moderator.principal,
        blob_reference.canister_id,
        &storage_bucket_canister::vault_file_chunk::Args {
            file_id: blob_reference.blob_id,
            chunk_index: 0,
            vault_token: None,
        },
    );
    assert!(
        matches!(
            chunk_response,
            storage_bucket_canister::vault_file_chunk::Response::Success(_)
        ),
        "{chunk_response:?}"
    );

    // The alert is auto-sanctioned with the media attached for vault review
    let reports = get_moderation_reports(env, &test_data);
    let report = reports
        .iter()
        .find(|r| r.reporters.contains(&test_data.reporter.user_id))
        .expect("report should exist");
    assert!(report.auto_sanctioned);
    assert_eq!(report.blob_references, vec![blob_reference.clone()]);
    assert!(matches!(report.status, ModerationReportStatus::Pending));
    let report_index = report.report_index.expect("report should carry an index");

    // The urgency valve: an honest-unverified filing before any verdict re-anchors the vault
    // retention clock but does NOT resolve the record - the log must show a re-anchor by the
    // operator, not a second verdict
    let file_unverified = client::user_index::record_authority_report_filed(
        env,
        test_data.moderator.principal,
        canister_ids.user_index,
        &user_index_canister::record_authority_report_filed::Args {
            report_index,
            portal_reference: "CSEA-IRP-TEST-VALVE-0001".to_string(),
            urgent: true,
            unverified: true,
            portal_reference_uuid: None,
            vault_token: None,
        },
    );
    assert!(matches!(file_unverified, UnitResult::Success));
    tick_many(env, 10);

    let vault_log = |env: &mut PocketIc| {
        let storage_bucket_canister::vault_log::Response::Success(log) = client::storage_bucket::vault_log(
            env,
            test_data.moderator.principal,
            blob_reference.canister_id,
            &storage_bucket_canister::vault_log::Args {
                start: 0,
                max: 100,
                file_id: Some(blob_reference.blob_id),
            },
        ) else {
            panic!("reviewer should be able to read the vault log");
        };
        log
    };
    let log = vault_log(env);
    assert!(
        log.entries
            .iter()
            .any(|e| e.event.starts_with("Retention re-anchored") && e.user_id == Some(test_data.moderator.user_id)),
        "{:?}",
        log.entries
    );
    assert!(
        !log.entries.iter().any(|e| e.event.starts_with("Verdict applied")),
        "an unverified filing must not appear in the chain as a verdict: {:?}",
        log.entries
    );

    // The UpheldAsCsam verdict is what applies the (indefinite) suspension for a
    // reporter-asserted sanction
    let resolve_response = client::user_index::resolve_moderation_report(
        env,
        test_data.moderator.principal,
        canister_ids.user_index,
        &user_index_canister::resolve_moderation_report::Args {
            report_index,
            verdict: ModerationVerdict::UpheldAsCsam,
            urgent: None,
        },
    );
    assert!(matches!(resolve_response, UnitResult::Success), "{resolve_response:?}");
    tick_many(env, 10);

    let sender_state = client::user_index::happy_path::current_user(env, test_data.sender.principal, canister_ids.user_index);
    let suspension_details = sender_state
        .suspension_details
        .expect("sender should be suspended by the verdict");
    assert!(matches!(suspension_details.action, SuspensionAction::Delete(_)));

    // The verdict resolves the record: exactly one verdict entry in the chain, attributed to
    // the moderator, alongside the earlier re-anchor
    let log = vault_log(env);
    let verdicts: Vec<_> = log
        .entries
        .iter()
        .filter(|e| e.event.starts_with("Verdict applied"))
        .collect();
    assert_eq!(verdicts.len(), 1, "{:?}", log.entries);
    assert_eq!(verdicts[0].user_id, Some(test_data.moderator.user_id));
}

#[test]
fn shared_blob_evidence_survives_dismissal_of_a_sibling_report() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let test_data = init_test_data(env, canister_ids, *controller);

    client::user_index::happy_path::execute_protected_action(
        env,
        test_data.moderator.principal,
        test_data.operator2.principal,
        canister_ids.user_index,
        ProtectedAction::SetVaultReviewers(user_index_canister::set_vault_reviewers::Args {
            user_ids: vec![test_data.moderator.user_id],
        }),
    );
    tick_many(env, 5);

    // The same blob carried by two messages: one vault record, two evidence claims
    let file_size = 1000u32;
    let blob_reference = client::storage_index::happy_path::upload_file(
        env,
        test_data.sender.principal,
        canister_ids.storage_index,
        file_size,
        vec![test_data.sender.canister()],
    );
    let mut message_ids = Vec::new();
    for _ in 0..2 {
        let message_id = random_from_u128();
        let send_response = client::group::send_message_v2(
            env,
            test_data.sender.principal,
            test_data.group_id.into(),
            &group_canister::send_message_v2::Args {
                thread_root_message_index: None,
                message_id,
                content: MessageContentInitial::File(FileContent {
                    name: random_string(),
                    caption: None,
                    mime_type: "application/octet-stream".to_string(),
                    file_size,
                    blob_reference: Some(blob_reference.clone()),
                }),
                sender_name: test_data.sender.username(),
                sender_display_name: None,
                replies_to: None,
                mentioned: Vec::new(),
                forwarding: false,
                block_level_markdown: false,
                rules_accepted: None,
                message_filter_failed: None,
                new_achievement: false,
                og_previews: Vec::new(),
            },
        );
        assert!(
            matches!(send_response, group_canister::send_message_v2::Response::Success(_)),
            "{send_response:?}"
        );
        message_ids.push(message_id);
    }
    tick_many(env, 3);

    // Both messages CSAM-reported: two reports, each holding the single vaulted blob
    for message_id in &message_ids {
        let report_response = client::group::report_message(
            env,
            test_data.reporter.principal,
            test_data.group_id.into(),
            &group_canister::report_message::Args {
                thread_root_message_index: None,
                message_id: *message_id,
                delete: false,
                csam: true,
            },
        );
        assert!(matches!(report_response, UnitResult::Success));
        tick_many(env, 10);
    }

    let fetch_chunk = |env: &mut PocketIc| {
        client::storage_bucket::vault_file_chunk(
            env,
            test_data.moderator.principal,
            blob_reference.canister_id,
            &storage_bucket_canister::vault_file_chunk::Args {
                file_id: blob_reference.blob_id,
                chunk_index: 0,
                vault_token: None,
            },
        )
    };
    assert!(matches!(
        fetch_chunk(env),
        storage_bucket_canister::vault_file_chunk::Response::Success(_)
    ));

    let reports = get_moderation_reports(env, &test_data);
    let report_index_for = |reports: &[ModerationReportContent], message_id| {
        reports
            .iter()
            .find(|r| r.message_id == message_id)
            .and_then(|r| r.report_index)
            .expect("report should exist with an index")
    };
    let first_report = report_index_for(&reports, message_ids[0]);
    let second_report = report_index_for(&reports, message_ids[1]);
    assert_ne!(first_report, second_report);

    // Dismissing the first report must NOT release the evidence: the second report (which
    // could yet be upheld) still holds the blob. Without per-report claims, a duplicate
    // report's dismissal would destroy the evidence of a still-open case.
    let dismiss = client::user_index::resolve_moderation_report(
        env,
        test_data.moderator.principal,
        canister_ids.user_index,
        &user_index_canister::resolve_moderation_report::Args {
            report_index: first_report,
            verdict: ModerationVerdict::Dismissed,
            urgent: None,
        },
    );
    assert!(matches!(dismiss, UnitResult::Success), "{dismiss:?}");
    tick_many(env, 10);
    assert!(matches!(
        fetch_chunk(env),
        storage_bucket_canister::vault_file_chunk::Response::Success(_)
    ));

    // The surviving report can still be upheld and the retention clock applied
    let uphold = client::user_index::resolve_moderation_report(
        env,
        test_data.moderator.principal,
        canister_ids.user_index,
        &user_index_canister::resolve_moderation_report::Args {
            report_index: second_report,
            verdict: ModerationVerdict::UpheldAsCsam,
            urgent: None,
        },
    );
    assert!(matches!(uphold, UnitResult::Success), "{uphold:?}");
    tick_many(env, 10);
    assert!(matches!(
        fetch_chunk(env),
        storage_bucket_canister::vault_file_chunk::Response::Success(_)
    ));
}

#[test]
fn media_report_dismissal_releases_the_vault() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let test_data = init_test_data(env, canister_ids, *controller);

    client::user_index::happy_path::execute_protected_action(
        env,
        test_data.moderator.principal,
        test_data.operator2.principal,
        canister_ids.user_index,
        ProtectedAction::SetVaultReviewers(user_index_canister::set_vault_reviewers::Args {
            user_ids: vec![test_data.moderator.user_id],
        }),
    );
    tick_many(env, 5);

    let file_size = 1000u32;
    let blob_reference = client::storage_index::happy_path::upload_file(
        env,
        test_data.sender.principal,
        canister_ids.storage_index,
        file_size,
        vec![test_data.sender.canister()],
    );
    let message_id = random_from_u128();
    let send_response = client::group::send_message_v2(
        env,
        test_data.sender.principal,
        test_data.group_id.into(),
        &group_canister::send_message_v2::Args {
            thread_root_message_index: None,
            message_id,
            content: MessageContentInitial::File(FileContent {
                name: random_string(),
                caption: None,
                mime_type: "application/octet-stream".to_string(),
                file_size,
                blob_reference: Some(blob_reference.clone()),
            }),
            sender_name: test_data.sender.username(),
            sender_display_name: None,
            replies_to: None,
            mentioned: Vec::new(),
            forwarding: false,
            block_level_markdown: false,
            rules_accepted: None,
            message_filter_failed: None,
            new_achievement: false,
            og_previews: Vec::new(),
        },
    );
    assert!(matches!(send_response, group_canister::send_message_v2::Response::Success(_)));
    tick_many(env, 3);

    let report_response = client::group::report_message(
        env,
        test_data.reporter.principal,
        test_data.group_id.into(),
        &group_canister::report_message::Args {
            thread_root_message_index: None,
            message_id,
            delete: false,
            csam: true,
        },
    );
    assert!(matches!(report_response, UnitResult::Success));
    tick_many(env, 10);

    let fetch_chunk = |env: &mut PocketIc| {
        client::storage_bucket::vault_file_chunk(
            env,
            test_data.moderator.principal,
            blob_reference.canister_id,
            &storage_bucket_canister::vault_file_chunk::Args {
                file_id: blob_reference.blob_id,
                chunk_index: 0,
                vault_token: None,
            },
        )
    };
    assert!(matches!(
        fetch_chunk(env),
        storage_bucket_canister::vault_file_chunk::Response::Success(_)
    ));

    let reports = get_moderation_reports(env, &test_data);
    let report_index = reports
        .iter()
        .find(|r| r.message_id == message_id)
        .and_then(|r| r.report_index)
        .expect("report should exist with an index");

    // The false allegation is dismissed: the full reversal chain must run - message restored,
    // flags cleared, and the vault releases the blob so it is publicly served again
    let dismiss = client::user_index::resolve_moderation_report(
        env,
        test_data.moderator.principal,
        canister_ids.user_index,
        &user_index_canister::resolve_moderation_report::Args {
            report_index,
            verdict: ModerationVerdict::Dismissed,
            urgent: None,
        },
    );
    assert!(matches!(dismiss, UnitResult::Success), "{dismiss:?}");
    tick_many(env, 10);

    // The vault record is gone...
    assert!(matches!(
        fetch_chunk(env),
        storage_bucket_canister::vault_file_chunk::Response::NotFound
    ));
    // ...the blob is publicly served again...
    assert!(client::storage_bucket::happy_path::file_exists(
        env,
        test_data.sender.principal,
        blob_reference.canister_id,
        blob_reference.blob_id,
    ));
    // ...and the message is restored (no longer deleted)
    let message_content = get_message_content(env, &test_data.group_owner, test_data.group_id, message_id);
    assert!(matches!(message_content, MessageContent::File(_)), "{message_content:?}");
}

#[test]
fn timed_suspension_expiry_never_lifts_a_later_csam_suspension() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let test_data = init_test_data(env, canister_ids, *controller);

    // The sender posts the message which the pipeline will flag, before any suspension: a
    // suspended user cannot send
    let message_id = random_from_u128();
    let message_text = format!("{TEST_MESSAGE_TEXT} {}", random_string());
    client::group::happy_path::send_text_message(
        env,
        &test_data.sender,
        test_data.group_id,
        None,
        &message_text,
        Some(message_id),
    );
    tick_many(env, 3);

    // They are then suspended for a day for something unrelated...
    let suspend_response = client::user_index::suspend_user(
        env,
        test_data.moderator.principal,
        canister_ids.user_index,
        &user_index_canister::suspend_user::Args {
            user_id: test_data.sender.user_id,
            duration: Some(DAY_IN_MS),
            reason: "Unrelated violation".to_string(),
        },
    );
    assert!(
        matches!(suspend_response, user_index_canister::suspend_user::Response::Success),
        "{suspend_response:?}"
    );
    tick_many(env, 5);

    // ...and only then does the classification land, replacing it with an indefinite one
    env.advance_time(Duration::from_secs(10));
    mock_moderation_outcalls(env, &message_text, &[CSAM_CATEGORY], 1);
    tick_many(env, 10);

    let sender_state = client::user_index::happy_path::current_user(env, test_data.sender.principal, canister_ids.user_index);
    let suspension_details = sender_state.suspension_details.expect("sender should be suspended");
    assert!(matches!(suspension_details.action, SuspensionAction::Delete(_)));

    // The first suspension's expiry falls due. It must NOT lift the CSAM suspension which
    // replaced it - the unsuspend job only expires the suspension it was scheduled for.
    env.advance_time(Duration::from_millis(DAY_IN_MS + 1));
    tick_many(env, 10);

    let sender_state = client::user_index::happy_path::current_user(env, test_data.sender.principal, canister_ids.user_index);
    let suspension_details = sender_state
        .suspension_details
        .expect("the CSAM suspension must survive the earlier suspension's expiry");
    assert!(
        matches!(suspension_details.action, SuspensionAction::Delete(_)),
        "{:?}",
        suspension_details.action
    );

    // A day was added to the clock: this env must not go back to the pool
    wrapper.discard();
}

#[test]
fn a_moderator_can_resolve_their_own_csam_assertion_only_by_upholding_it_as_csam() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let test_data = init_test_data(env, canister_ids, *controller);

    // The moderator is the one who spots the content and asserts it is CSAM. With a single
    // available reviewer that is the normal case, not an edge case
    client::local_user_index::happy_path::join_group(
        env,
        test_data.moderator.principal,
        canister_ids.local_user_index(env, test_data.group_id),
        test_data.group_id,
    );
    let message_id = random_from_u128();
    let message_text = format!("{TEST_MESSAGE_TEXT} {}", random_string());
    client::group::happy_path::send_text_message(
        env,
        &test_data.sender,
        test_data.group_id,
        None,
        &message_text,
        Some(message_id),
    );
    tick_many(env, 3);

    client::group::report_message(
        env,
        test_data.moderator.principal,
        test_data.group_id.into(),
        &group_canister::report_message::Args {
            thread_root_message_index: None,
            message_id,
            delete: false,
            csam: true,
        },
    );
    tick_many(env, 10);

    let reports = get_moderation_reports(env, &test_data);
    let report_index = reports
        .iter()
        .find(|r| r.sender == test_data.sender.user_id)
        .and_then(|r| r.report_index)
        .expect("the assertion should have created a report");

    let resolve = |env: &mut PocketIc, verdict: ModerationVerdict| {
        client::user_index::resolve_moderation_report(
            env,
            test_data.moderator.principal,
            canister_ids.user_index,
            &user_index_canister::resolve_moderation_report::Args {
                report_index,
                verdict,
                urgent: None,
            },
        )
    };

    // Dismissing your own assertion is self-exoneration: it is the act which would otherwise
    // record a false report against you
    let response = resolve(env, ModerationVerdict::Dismissed);
    assert!(matches!(response, UnitResult::Error(_)), "{response:?}");

    // Downgrading it to an ordinary violation is the burial path: it would close the case
    // forever (making the false-report record unreachable), release the vaulted evidence and
    // skip the authority report, while still punishing the sender
    let response = resolve(env, ModerationVerdict::Upheld);
    assert!(matches!(response, UnitResult::Error(_)), "{response:?}");

    // Upholding it AS CSAM is allowed: the maximum-scrutiny path, which nothing can be buried
    // by taking. Barring this deadlocked a lone reviewer, who is obliged to act on what they
    // found but could neither close the case nor reach the authority-report step
    let response = resolve(env, ModerationVerdict::UpheldAsCsam);
    assert!(matches!(response, UnitResult::Success), "{response:?}");
    tick_many(env, 5);

    let reports = get_moderation_reports(env, &test_data);
    let report = reports.iter().find(|r| r.report_index == Some(report_index)).unwrap();
    assert!(
        !matches!(report.status, ModerationReportStatus::Pending),
        "{:?}",
        report.status
    );
}

#[test]
fn moderator_cannot_resolve_a_report_against_their_own_message() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let test_data = init_test_data(env, canister_ids, *controller);

    // The moderator joins the group and posts a message, which another user reports. The
    // classification comes back clean, so the report escalates for human review and nothing is
    // done to the account - the moderator is simply the sender of a reported message.
    client::local_user_index::happy_path::join_group(
        env,
        test_data.moderator.principal,
        canister_ids.local_user_index(env, test_data.group_id),
        test_data.group_id,
    );
    let message_id = random_from_u128();
    let message_text = format!("{TEST_MESSAGE_TEXT} {}", random_string());
    client::group::happy_path::send_text_message(
        env,
        &test_data.moderator,
        test_data.group_id,
        None,
        &message_text,
        Some(message_id),
    );
    tick_many(env, 3);

    let report_response = client::group::report_message(
        env,
        test_data.reporter.principal,
        test_data.group_id.into(),
        &group_canister::report_message::Args {
            thread_root_message_index: None,
            message_id,
            delete: false,
            csam: false,
        },
    );
    assert!(matches!(report_response, UnitResult::Success));
    tick_many(env, 3);
    env.advance_time(Duration::from_secs(10));
    mock_moderation_outcalls(env, &message_text, &[], 2);
    tick_many(env, 10);

    let reports = get_moderation_reports(env, &test_data);
    let report = reports
        .iter()
        .find(|r| r.sender == test_data.moderator.user_id)
        .expect("the moderator's message should have been reported");
    let report_index = report.report_index.expect("report should carry an index");

    // Ruling on a case you are the subject of is refused: dismissing it would clear your own
    // strike, restore your own content and release the vault
    let resolve_response = client::user_index::resolve_moderation_report(
        env,
        test_data.moderator.principal,
        canister_ids.user_index,
        &user_index_canister::resolve_moderation_report::Args {
            report_index,
            verdict: ModerationVerdict::Dismissed,
            urgent: None,
        },
    );
    assert!(matches!(resolve_response, UnitResult::Error(_)), "{resolve_response:?}");

    // Every OTHER surface which acts on a report must refuse them too. The verdict is only one
    // of the levers: dual authorization is a two-person rule, not a conflict-of-interest rule,
    // so being the report's subject has to be checked wherever the report is acted on.

    // Recording the authority report as filed would satisfy the due queue and suppress the
    // statutory filing about themselves
    let filed_response = client::user_index::record_authority_report_filed(
        env,
        test_data.moderator.principal,
        canister_ids.user_index,
        &user_index_canister::record_authority_report_filed::Args {
            report_index,
            portal_reference: "SELF-FILED-1".to_string(),
            urgent: false,
            unverified: false,
            portal_reference_uuid: None,
            vault_token: None,
        },
    );
    assert!(matches!(filed_response, UnitResult::Error(_)), "{filed_response:?}");

    // Changing the legal hold would let them steer their own evidence towards expiry
    let hold_response = client::user_index::set_vault_legal_hold(
        env,
        test_data.moderator.principal,
        canister_ids.user_index,
        &user_index_canister::set_vault_legal_hold::Args {
            report_index,
            legal_hold: true,
            reference: "PRESERVATION-SELF".to_string(),
        },
    );
    assert!(matches!(hold_response, UnitResult::Error(_)), "{hold_response:?}");

    // Destruction is dual authorized, but a second operator's confirmation is not a substitute
    // for not being the party: the proposal is refused at proposal time
    let destroy_response = client::user_index::propose_protected_action(
        env,
        test_data.moderator.principal,
        canister_ids.user_index,
        &user_index_canister::propose_protected_action::Args {
            action: ProtectedAction::DestroyVaultEvidence(user_index_canister::destroy_vault_evidence::Args {
                report_index,
                le_request_ref: "DESTROY-SELF".to_string(),
            }),
        },
    );
    assert!(
        matches!(
            destroy_response,
            user_index_canister::propose_protected_action::Response::Error(_)
        ),
        "{destroy_response:?}"
    );

    // ...and the report stays open for someone else to decide
    let reports = get_moderation_reports(env, &test_data);
    let report = reports.iter().find(|r| r.report_index == Some(report_index)).unwrap();
    assert!(
        matches!(report.status, ModerationReportStatus::Pending),
        "{:?}",
        report.status
    );
}

#[test]
fn a_moderator_cannot_unsuspend_themselves() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let test_data = init_test_data(env, canister_ids, *controller);

    // Suspending is moderator-gated, so the second actor needs that role as well
    client::user_index::add_platform_moderator(
        env,
        *controller,
        canister_ids.user_index,
        &user_index_canister::add_platform_moderator::Args {
            user_id: test_data.operator2.user_id,
        },
    );
    tick_many(env, 3);

    // A suspended account holds no moderator authority at all: the self-unsuspension this
    // test originally guarded against is now refused at ingress (inspect_message), which
    // surfaces as a panic in the test client. The self-check in unsuspend_user remains as
    // defence in depth.
    let suspend_response = client::user_index::suspend_user(
        env,
        test_data.operator2.principal,
        canister_ids.user_index,
        &user_index_canister::suspend_user::Args {
            user_id: test_data.moderator.user_id,
            duration: Some(DAY_IN_MS),
            reason: "Upheld violation".to_string(),
        },
    );
    assert!(
        matches!(suspend_response, user_index_canister::suspend_user::Response::Success),
        "{suspend_response:?}"
    );
    tick_many(env, 5);

    {
        let principal = test_data.moderator.principal;
        let user_id = test_data.moderator.user_id;
        let user_index = canister_ids.user_index;
        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            client::user_index::unsuspend_user(
                env,
                principal,
                user_index,
                &user_index_canister::unsuspend_user::Args { user_id },
            )
        }));
        let refused = match result {
            Err(_) => true,
            Ok(user_index_canister::unsuspend_user::Response::Error(_)) => true,
            Ok(_) => false,
        };
        assert!(refused, "a suspended moderator must not be able to unsuspend themselves");
    }

    // Another moderator can, which is what keeps a genuine mistake correctable
    let response = client::user_index::unsuspend_user(
        env,
        test_data.operator2.principal,
        canister_ids.user_index,
        &user_index_canister::unsuspend_user::Args {
            user_id: test_data.moderator.user_id,
        },
    );
    assert!(
        matches!(response, user_index_canister::unsuspend_user::Response::Success),
        "{response:?}"
    );
}

#[test]
fn upheld_verdict_does_not_downgrade_while_another_sanction_stands() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let test_data = init_test_data(env, canister_ids, *controller);

    // Two separate CSAM detections against the same sender, each auto-sanctioning indefinitely.
    // Both messages are sent before either classification lands: the first sanction suspends
    // the sender, and a suspended user cannot send. They share a random token so that a single
    // mocked response flags both - the broker batches pending messages into one classify
    // request, whose `input` array carries them together.
    let token = random_string();
    let message_text = format!("{TEST_MESSAGE_TEXT} {token}");
    let message_ids: Vec<_> = (0..2)
        .map(|_| {
            let message_id = random_from_u128();
            client::group::happy_path::send_text_message(
                env,
                &test_data.sender,
                test_data.group_id,
                None,
                &message_text,
                Some(message_id),
            );
            message_id
        })
        .collect();
    tick_many(env, 3);
    env.advance_time(Duration::from_secs(10));
    mock_moderation_outcalls(env, &token, &[CSAM_CATEGORY], 1);
    // Drain a straggler if the two were classified in separate requests rather than batched
    tick_many(env, 3);
    env.advance_time(Duration::from_secs(10));
    mock_moderation_outcalls(env, &token, &[CSAM_CATEGORY], 0);
    tick_many(env, 10);

    let reports = get_moderation_reports(env, &test_data);
    let report_indexes: Vec<u64> = message_ids
        .iter()
        .map(|message_id| {
            reports
                .iter()
                .find(|r| r.message_id == *message_id)
                .and_then(|r| r.report_index)
                .expect("detection should create a report with an index")
        })
        .collect();

    // Upholding one as a non-CSAM violation must not downgrade the indefinite suspension while
    // the other, still unresolved, CSAM sanction stands
    let resolve_response = client::user_index::resolve_moderation_report(
        env,
        test_data.moderator.principal,
        canister_ids.user_index,
        &user_index_canister::resolve_moderation_report::Args {
            report_index: report_indexes[0],
            verdict: ModerationVerdict::Upheld,
            urgent: None,
        },
    );
    assert!(matches!(resolve_response, UnitResult::Success), "{resolve_response:?}");
    tick_many(env, 10);

    let sender_state = client::user_index::happy_path::current_user(env, test_data.sender.principal, canister_ids.user_index);
    let suspension_details = sender_state.suspension_details.expect("sender should remain suspended");
    assert!(
        matches!(suspension_details.action, SuspensionAction::Delete(_)),
        "the suspension must stay indefinite: {:?}",
        suspension_details.action
    );

    // Resolving the second report as a non-CSAM violation too: nothing is left standing, so the
    // downgrade to the standard severity now applies
    let resolve_response = client::user_index::resolve_moderation_report(
        env,
        test_data.moderator.principal,
        canister_ids.user_index,
        &user_index_canister::resolve_moderation_report::Args {
            report_index: report_indexes[1],
            verdict: ModerationVerdict::Upheld,
            urgent: None,
        },
    );
    assert!(matches!(resolve_response, UnitResult::Success), "{resolve_response:?}");
    tick_many(env, 10);

    let sender_state = client::user_index::happy_path::current_user(env, test_data.sender.principal, canister_ids.user_index);
    let suspension_details = sender_state.suspension_details.expect("sender should remain suspended");
    assert!(
        matches!(suspension_details.action, SuspensionAction::Unsuspend(_)),
        "{:?}",
        suspension_details.action
    );
}

#[test]
fn accept_terms_records_version_and_never_downgrades() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let test_data = init_test_data(env, canister_ids, *controller);

    // Registration itself records acceptance (the signup flow presents the terms), so a
    // brand-new user never sees the terms-updated notice
    let state = client::user_index::happy_path::current_user(env, test_data.reporter.principal, canister_ids.user_index);
    assert_eq!(state.accepted_terms_version, state.current_terms_version);

    // Acceptance is clamped to the canister's current terms version: a client cannot
    // pre-accept future terms and suppress every future notice
    let accept = client::user_index::accept_terms(
        env,
        test_data.sender.principal,
        canister_ids.user_index,
        &user_index_canister::accept_terms::Args { version: u32::MAX },
    );
    assert!(matches!(accept, UnitResult::Success));

    let state = client::user_index::happy_path::current_user(env, test_data.sender.principal, canister_ids.user_index);
    assert_eq!(state.accepted_terms_version, state.current_terms_version);
    assert!(state.current_terms_version >= 1);

    // An out-of-date client cannot roll the accepted version back
    let downgrade = client::user_index::accept_terms(
        env,
        test_data.sender.principal,
        canister_ids.user_index,
        &user_index_canister::accept_terms::Args { version: 0 },
    );
    assert!(matches!(downgrade, UnitResult::Success));
    let state = client::user_index::happy_path::current_user(env, test_data.sender.principal, canister_ids.user_index);
    assert_eq!(state.accepted_terms_version, state.current_terms_version);
}

// Waits for pending moderation API outcalls and answers each one. Only inputs containing
// `target_text` are classified with `flagged_categories` (empty = clean); every other input is
// classified clean. The test envs are pooled, so requests for messages sent by earlier tests on
// the same env can still be pending - those must be drained (a clean classification has no side
// effects) but must not be counted or flagged, otherwise eg. a stale message flagged as CSAM
// posts a second alert into the moderation channel. Returns the number of requests which
// included `target_text`, once `expected_calls` such requests have been answered and none
// remain pending, or after a bounded number of ticks.
fn mock_moderation_outcalls(
    env: &mut PocketIc,
    target_text: &str,
    flagged_categories: &[&str],
    expected_calls: usize,
) -> usize {
    let mut handled = 0;

    for _ in 0..100 {
        let requests = env.get_canister_http();

        if requests.is_empty() {
            if handled >= expected_calls {
                break;
            }
            env.advance_time(Duration::from_secs(1));
            env.tick();
            continue;
        }

        for request in requests {
            // Stale requests from other tests may not even be text classifications (eg. image
            // inputs), so parse leniently and answer anything unrecognized clean
            let body: Value = serde_json::from_slice(&request.body).unwrap_or_default();
            let inputs = body["input"].as_array().cloned().unwrap_or_default();
            let input_matches = |input: &Value| input.as_str().is_some_and(|text| text.contains(target_text));
            let request_matches = inputs.iter().any(input_matches);

            if request_matches {
                assert_eq!(body["model"], "omni-moderation-latest");
            }

            let categories: serde_json::Map<String, Value> = flagged_categories
                .iter()
                .map(|category| (category.to_string(), Value::Bool(true)))
                .collect();
            let category_scores: serde_json::Map<String, Value> = flagged_categories
                .iter()
                .map(|category| (category.to_string(), json!(0.97)))
                .collect();
            let results: Vec<Value> = inputs
                .iter()
                .map(|input| {
                    if input_matches(input) {
                        json!({ "categories": categories, "category_scores": category_scores })
                    } else {
                        json!({ "categories": {} })
                    }
                })
                .collect();
            let response_body = serde_json::to_vec(&json!({ "results": results })).unwrap();

            env.mock_canister_http_response(MockCanisterHttpResponse {
                subnet_id: request.subnet_id,
                request_id: request.request_id,
                response: CanisterHttpResponse::CanisterHttpReply(CanisterHttpReply {
                    status: 200,
                    headers: Vec::new(),
                    body: response_body,
                }),
                additional_responses: Vec::new(),
            });

            if request_matches {
                handled += 1;
            }
        }

        env.tick();
    }

    handled
}

#[test]
fn media_scan_match_triggers_auto_sanction() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let test_data = init_test_data(env, canister_ids, *controller);

    let scanner = random_principal();
    client::user_index::happy_path::execute_protected_action(
        env,
        test_data.moderator.principal,
        test_data.operator2.principal,
        canister_ids.user_index,
        ProtectedAction::SetMediaScanConfig(user_index_canister::set_media_scan_config::Args {
            config: MediaScanConfig {
                enabled: true,
                scanners: vec![scanner],
            },
        }),
    );
    client::user_index::happy_path::execute_protected_action(
        env,
        test_data.moderator.principal,
        test_data.operator2.principal,
        canister_ids.user_index,
        ProtectedAction::SetVaultReviewers(user_index_canister::set_vault_reviewers::Args {
            user_ids: vec![test_data.moderator.user_id],
        }),
    );
    tick_many(env, 5);

    // A caption-less image: `moderation_input` is empty for it (no text), so this is the exact
    // case the media enqueue must catch as a sibling of the classification gate rather than
    // nested inside it
    let blob_reference = client::storage_index::happy_path::upload_file(
        env,
        test_data.sender.principal,
        canister_ids.storage_index,
        1000,
        vec![test_data.sender.canister()],
    );
    let message_id = random_from_u128();
    send_image_message(env, &test_data.sender, test_data.group_id, message_id, blob_reference.clone());
    tick_many(env, 3);

    // The scan job reaches the local index via the event sync queue; the worker polls for it
    let local_user_index = canister_ids.local_user_index(env, test_data.group_id);
    let local_user_index_canister::media_scan_jobs::Response::Success(jobs_result) = client::local_user_index::media_scan_jobs(
        env,
        scanner,
        local_user_index,
        &local_user_index_canister::media_scan_jobs::Args { from_job_index: 0 },
    );
    let job = jobs_result
        .jobs
        .iter()
        .find(|j| j.request.message_id == message_id)
        .expect("a scan job should be queued for the image message");
    assert_eq!(job.request.blobs.len(), 1);
    assert_eq!(job.request.blobs[0].blob_reference.blob_id, blob_reference.blob_id);
    assert_eq!(job.request.blobs[0].mime_type, "image/jpeg");

    // The worker reports a match against the known-CSAM hash list. The escalation is the same
    // as classifier-detected CSAM: message deleted and read-gated, blobs quarantined in the
    // vault, sender suspended, resolvable report + alert posted
    let submit_response = client::local_user_index::submit_media_scan_verdicts(
        env,
        scanner,
        local_user_index,
        &local_user_index_canister::submit_media_scan_verdicts::Args {
            verdicts: vec![MediaScanVerdict {
                job_index: job.job_index,
                message_id,
                outcomes: vec![MediaScanBlobOutcome::Match(MediaScanMatch {
                    provider: MediaScanProvider::PhotoDna,
                    blob_id: blob_reference.blob_id,
                    source: "Test".to_string(),
                    violations: vec!["A1".to_string()],
                    match_distance: 181,
                    match_id: Some("7469692".to_string()),
                    hash: Some("dGVzdC1waG90b2RuYS1oYXNo".to_string()),
                })],
            }],
            up_to_job_index: job.job_index,
        },
    );
    assert!(matches!(
        submit_response,
        local_user_index_canister::submit_media_scan_verdicts::Response::Success
    ));
    tick_many(env, 10);

    let message_content = get_message_content(env, &test_data.group_owner, test_data.group_id, message_id);
    assert!(matches!(message_content, MessageContent::Deleted(_)), "{message_content:?}");

    let sender_state = client::user_index::happy_path::current_user(env, test_data.sender.principal, canister_ids.user_index);
    let suspension_details = sender_state.suspension_details.expect("sender should be suspended");
    assert!(matches!(suspension_details.action, SuspensionAction::Delete(_)));

    let reports = get_moderation_reports(env, &test_data);
    let report = reports
        .iter()
        .find(|r| r.sender == test_data.sender.user_id)
        .expect("the match should create a moderation report");
    assert!(report.auto_sanctioned);
    assert!(report.reporters.is_empty());
    let report_index = report.report_index.expect("proactive detection should carry a report index");
    // The report carries the hash-match provenance: which provider matched, and the provider's
    // record id for the authority report
    assert_eq!(report.media_matches.len(), 1);
    assert_eq!(report.media_matches[0].match_id.as_deref(), Some("7469692"));
    assert_eq!(report.media_matches[0].blob_id, blob_reference.blob_id);

    // The quarantine read-gate holds: not even the group owner can view the deleted content
    let deleted_message_response = client::group::deleted_message(
        env,
        test_data.group_owner.principal,
        test_data.group_id.into(),
        &group_canister::deleted_message::Args {
            thread_root_message_index: None,
            message_id,
        },
    );
    assert!(
        matches!(deleted_message_response, group_canister::deleted_message::Response::Error(_)),
        "{deleted_message_response:?}"
    );

    // The media is vaulted: the designated reviewer can fetch it
    let chunk_response = client::storage_bucket::vault_file_chunk(
        env,
        test_data.moderator.principal,
        blob_reference.canister_id,
        &storage_bucket_canister::vault_file_chunk::Args {
            file_id: blob_reference.blob_id,
            chunk_index: 0,
            vault_token: None,
        },
    );
    assert!(
        matches!(
            chunk_response,
            storage_bucket_canister::vault_file_chunk::Response::Success(_)
        ),
        "{chunk_response:?}"
    );

    // A Dismissed verdict reverses the takedown in full: the sender is unsuspended and the
    // image message is restored for everyone
    let resolve_response = client::user_index::resolve_moderation_report(
        env,
        test_data.moderator.principal,
        canister_ids.user_index,
        &user_index_canister::resolve_moderation_report::Args {
            report_index,
            verdict: ModerationVerdict::Dismissed,
            urgent: None,
        },
    );
    assert!(matches!(resolve_response, UnitResult::Success), "{resolve_response:?}");
    tick_many(env, 10);

    let sender_state = client::user_index::happy_path::current_user(env, test_data.sender.principal, canister_ids.user_index);
    assert!(sender_state.suspension_details.is_none(), "sender should be unsuspended");

    let message_content = get_message_content(env, &test_data.group_owner, test_data.group_id, message_id);
    assert!(matches!(message_content, MessageContent::Image(_)), "{message_content:?}");
}

#[test]
fn media_scan_scope_and_kill_switch() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let test_data = init_test_data(env, canister_ids, *controller);

    let scanner = random_principal();

    // Disabled: requests are dropped at the local index rather than queued. Scanners are
    // still registered so the log can be inspected while disabled.
    client::user_index::happy_path::execute_protected_action(
        env,
        test_data.moderator.principal,
        test_data.operator2.principal,
        canister_ids.user_index,
        ProtectedAction::SetMediaScanConfig(user_index_canister::set_media_scan_config::Args {
            config: MediaScanConfig {
                enabled: false,
                scanners: vec![scanner],
            },
        }),
    );
    tick_many(env, 5);

    let local_user_index = canister_ids.local_user_index(env, test_data.group_id);
    let blob_while_disabled = client::storage_index::happy_path::upload_file(
        env,
        test_data.sender.principal,
        canister_ids.storage_index,
        1000,
        vec![test_data.sender.canister()],
    );
    let message_while_disabled = random_from_u128();
    send_image_message(
        env,
        &test_data.sender,
        test_data.group_id,
        message_while_disabled,
        blob_while_disabled,
    );
    tick_many(env, 3);

    let local_user_index_canister::media_scan_jobs::Response::Success(jobs_result) = client::local_user_index::media_scan_jobs(
        env,
        scanner,
        local_user_index,
        &local_user_index_canister::media_scan_jobs::Args { from_job_index: 0 },
    );
    assert!(
        !jobs_result
            .jobs
            .iter()
            .any(|j| j.request.message_id == message_while_disabled),
        "no job should be queued while media scanning is disabled"
    );

    client::user_index::happy_path::execute_protected_action(
        env,
        test_data.moderator.principal,
        test_data.operator2.principal,
        canister_ids.user_index,
        ProtectedAction::SetMediaScanConfig(user_index_canister::set_media_scan_config::Args {
            config: MediaScanConfig {
                enabled: true,
                scanners: vec![scanner],
            },
        }),
    );
    tick_many(env, 5);

    // Media in a private group must never enter the queue: the gate is at the enqueue site
    let private_group_id = client::user::happy_path::create_group(env, &test_data.group_owner, &random_string(), false, true);
    let private_blob = client::storage_index::happy_path::upload_file(
        env,
        test_data.group_owner.principal,
        canister_ids.storage_index,
        1000,
        vec![test_data.group_owner.canister()],
    );
    let private_message_id = random_from_u128();
    send_image_message(
        env,
        &test_data.group_owner,
        private_group_id,
        private_message_id,
        private_blob,
    );

    let public_blob = client::storage_index::happy_path::upload_file(
        env,
        test_data.sender.principal,
        canister_ids.storage_index,
        1000,
        vec![test_data.sender.canister()],
    );
    let public_message_id = random_from_u128();
    send_image_message(env, &test_data.sender, test_data.group_id, public_message_id, public_blob);
    tick_many(env, 3);

    let private_local_user_index = canister_ids.local_user_index(env, private_group_id);
    let local_user_index_canister::media_scan_jobs::Response::Success(private_jobs) = client::local_user_index::media_scan_jobs(
        env,
        scanner,
        private_local_user_index,
        &local_user_index_canister::media_scan_jobs::Args { from_job_index: 0 },
    );
    assert!(
        !private_jobs.jobs.iter().any(|j| j.request.message_id == private_message_id),
        "media in a private group must never be queued for scanning"
    );

    let local_user_index_canister::media_scan_jobs::Response::Success(jobs_result) = client::local_user_index::media_scan_jobs(
        env,
        scanner,
        local_user_index,
        &local_user_index_canister::media_scan_jobs::Args { from_job_index: 0 },
    );
    let job = jobs_result
        .jobs
        .iter()
        .find(|j| j.request.message_id == public_message_id)
        .expect("a scan job should be queued for the public image message");

    // A clean verdict acks the job and takes no action against the message or the sender
    let submit_response = client::local_user_index::submit_media_scan_verdicts(
        env,
        scanner,
        local_user_index,
        &local_user_index_canister::submit_media_scan_verdicts::Args {
            verdicts: vec![MediaScanVerdict {
                job_index: job.job_index,
                message_id: public_message_id,
                outcomes: vec![MediaScanBlobOutcome::Clean],
            }],
            up_to_job_index: job.job_index,
        },
    );
    assert!(matches!(
        submit_response,
        local_user_index_canister::submit_media_scan_verdicts::Response::Success
    ));
    tick_many(env, 10);

    let message_content = get_message_content(env, &test_data.group_owner, test_data.group_id, public_message_id);
    assert!(matches!(message_content, MessageContent::Image(_)), "{message_content:?}");
    let sender_state = client::user_index::happy_path::current_user(env, test_data.sender.principal, canister_ids.user_index);
    assert!(sender_state.suspension_details.is_none(), "a clean verdict must not sanction");

    // The watermark pruned the acked job
    let local_user_index_canister::media_scan_jobs::Response::Success(jobs_after) = client::local_user_index::media_scan_jobs(
        env,
        scanner,
        local_user_index,
        &local_user_index_canister::media_scan_jobs::Args { from_job_index: 0 },
    );
    assert!(
        !jobs_after.jobs.iter().any(|j| j.job_index <= job.job_index),
        "acked jobs should be pruned from the log"
    );
}

// ---------------------------------------------------------------------------
// Blocked re-post attempts
// (backend/docs/moderation-state-machine-invariants.md: I3, I6, I8, I9, I13, I14, I16)
// ---------------------------------------------------------------------------

// Configures media scanning + vault reviewers, uploads `file` as the sender, posts it to the
// public group and submits a scanner match verdict, producing a PENDING hash-match report
// with the blob quarantined. Returns the report index.
fn establish_pending_hash_match_report(
    env: &mut PocketIc,
    canister_ids: &CanisterIds,
    test_data: &TestData,
    scanner: Principal,
    file: &[u8],
) -> u64 {
    establish_pending_hash_match_report_from(env, canister_ids, test_data, scanner, file, None).1
}

// As above, but posting as `poster` (default: the sender); returns the blob reference too
fn establish_pending_hash_match_report_from(
    env: &mut PocketIc,
    canister_ids: &CanisterIds,
    test_data: &TestData,
    scanner: Principal,
    file: &[u8],
    poster: Option<&User>,
) -> (BlobReference, u64) {
    client::user_index::happy_path::execute_protected_action(
        env,
        test_data.moderator.principal,
        test_data.operator2.principal,
        canister_ids.user_index,
        ProtectedAction::SetMediaScanConfig(user_index_canister::set_media_scan_config::Args {
            config: MediaScanConfig {
                enabled: true,
                scanners: vec![scanner],
            },
        }),
    );
    client::user_index::happy_path::execute_protected_action(
        env,
        test_data.moderator.principal,
        test_data.operator2.principal,
        canister_ids.user_index,
        ProtectedAction::SetVaultReviewers(user_index_canister::set_vault_reviewers::Args {
            user_ids: vec![test_data.moderator.user_id],
        }),
    );
    tick_many(env, 5);

    let poster = poster.unwrap_or(&test_data.sender);
    let bucket = client::storage_index::happy_path::allocated_bucket(env, poster.principal, canister_ids.storage_index, file);
    client::storage_bucket::happy_path::upload_file(
        env,
        poster.principal,
        bucket.canister_id,
        bucket.file_id,
        file.to_vec(),
        vec![poster.canister()],
        None,
    );
    let blob_reference = BlobReference {
        canister_id: bucket.canister_id,
        blob_id: bucket.file_id,
    };
    let message_id = random_from_u128();
    send_image_message(env, poster, test_data.group_id, message_id, blob_reference.clone());
    tick_many(env, 3);

    let local_user_index = canister_ids.local_user_index(env, test_data.group_id);
    let local_user_index_canister::media_scan_jobs::Response::Success(jobs_result) = client::local_user_index::media_scan_jobs(
        env,
        scanner,
        local_user_index,
        &local_user_index_canister::media_scan_jobs::Args { from_job_index: 0 },
    );
    let job = jobs_result
        .jobs
        .iter()
        .find(|j| j.request.message_id == message_id)
        .expect("a scan job should be queued for the image message");
    client::local_user_index::submit_media_scan_verdicts(
        env,
        scanner,
        local_user_index,
        &local_user_index_canister::submit_media_scan_verdicts::Args {
            verdicts: vec![MediaScanVerdict {
                job_index: job.job_index,
                message_id,
                outcomes: vec![MediaScanBlobOutcome::Match(MediaScanMatch {
                    provider: MediaScanProvider::PhotoDna,
                    blob_id: blob_reference.blob_id,
                    source: "Test".to_string(),
                    violations: vec!["A1".to_string()],
                    match_distance: 181,
                    match_id: Some("7469692".to_string()),
                    hash: Some("dGVzdC1waG90b2RuYS1oYXNo".to_string()),
                })],
            }],
            up_to_job_index: job.job_index,
        },
    );
    tick_many(env, 10);

    let report_index = get_moderation_reports(env, test_data)
        .iter()
        .find(|r| r.sender == poster.user_id && !r.is_blocked_attempt)
        .and_then(|r| r.report_index)
        .expect("the match should create a moderation report");
    (blob_reference, report_index)
}

// Attempts to upload `file` as `uploader`, asserting the bucket refuses it (I13), then ticks
// so the blocked-attempt event reaches the user_index
fn attempt_blocked_upload(env: &mut PocketIc, canister_ids: &CanisterIds, uploader: &User, file: &[u8]) {
    upload_expecting(env, canister_ids, uploader, file, |r| {
        matches!(r, storage_bucket_canister::upload_chunk_v2::Response::Blocked)
    });
}

// Uploads `file` (single chunk) as `uploader` with a random file_id_seed - as the real client
// sends - and asserts the response. The seed matters: the file id derives from it, and the
// bucket's retry dedup is keyed per (uploader, file id), so a fresh seed models a fresh human
// attempt while a reused id models a client retry.
fn upload_expecting(
    env: &mut PocketIc,
    canister_ids: &CanisterIds,
    uploader: &User,
    file: &[u8],
    expected: fn(&storage_bucket_canister::upload_chunk_v2::Response) -> bool,
) {
    use utils::hasher::hash_bytes;
    upload_declaring_hash_expecting(env, canister_ids, uploader, file, hash_bytes(file), expected);
}

fn upload_declaring_hash_expecting(
    env: &mut PocketIc,
    canister_ids: &CanisterIds,
    uploader: &User,
    file: &[u8],
    declared_hash: [u8; 32],
    expected: fn(&storage_bucket_canister::upload_chunk_v2::Response) -> bool,
) {
    let storage_index_canister::allocated_bucket_v2::Response::Success(bucket) = client::storage_index::allocated_bucket_v2(
        env,
        uploader.principal,
        canister_ids.storage_index,
        &storage_index_canister::allocated_bucket_v2::Args {
            file_hash: declared_hash,
            file_size: file.len() as u64,
            file_id_seed: Some(random_from_u128()),
        },
    ) else {
        panic!("allocation should succeed");
    };
    let response = client::storage_bucket::upload_chunk_v2(
        env,
        uploader.principal,
        bucket.canister_id,
        &storage_bucket_canister::upload_chunk_v2::Args {
            file_id: bucket.file_id,
            hash: declared_hash,
            mime_type: "image/jpeg".to_string(),
            accessors: vec![uploader.canister()],
            chunk_index: 0,
            chunk_size: file.len() as u32,
            total_size: file.len() as u64,
            bytes: file.to_vec(),
            expiry: None,
        },
    );
    assert!(expected(&response), "{response:?}");
    tick_many(env, 10);
}

fn random_file() -> Vec<u8> {
    // Random content so pooled test envs never collide on vault/denylist state from an
    // earlier test run of the same bytes
    random_from_u128::<u128>().to_be_bytes().repeat(64).to_vec()
}

fn attempt_reports_for(env: &PocketIc, test_data: &TestData, attempter: &User) -> Vec<ModerationReportContent> {
    get_moderation_reports(env, test_data)
        .into_iter()
        .filter(|r| r.sender == attempter.user_id && r.is_blocked_attempt)
        .collect()
}

fn moderation_notices(env: &PocketIc, test_data: &TestData) -> Vec<String> {
    let events = client::community::happy_path::events(
        env,
        &test_data.moderator,
        test_data.moderation_community_id,
        test_data.moderation_channel_id,
        EventIndex::from(0),
        true,
        100,
        200,
    );
    events
        .events
        .into_iter()
        .filter_map(|e| if let ChatEvent::Message(m) = e.event { Some(*m) } else { None })
        .filter_map(|m| if let MessageContent::Text(t) = m.content { Some(t.text) } else { None })
        .collect()
}

fn authority_due_indexes(env: &PocketIc, test_data: &TestData, canister_ids: &CanisterIds) -> Vec<u64> {
    get_authority_reports(env, test_data, canister_ids)["due"]
        .as_array()
        .map(|rows| rows.iter().filter_map(|r| r["report_index"].as_u64()).collect())
        .unwrap_or_default()
}

// I13/I14 (block + visible report), I8 (not directly resolvable), I3 (dismissal of the
// original lifts the attempter's provisional sanction)
#[test]
fn blocked_reupload_of_pending_content_reports_and_dismissal_reverses() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let test_data = init_test_data(env, canister_ids, *controller);
    let file = random_file();
    let original_report_index = establish_pending_hash_match_report(env, canister_ids, &test_data, random_principal(), &file);

    // The reporter user doubles as the attempter: re-uploading the quarantined bytes is
    // refused at the bucket and they are provisionally suspended
    attempt_blocked_upload(env, canister_ids, &test_data.reporter, &file);

    let attempter_state =
        client::user_index::happy_path::current_user(env, test_data.reporter.principal, canister_ids.user_index);
    assert!(attempter_state.suspension_details.is_some(), "attempter should be suspended");

    let attempt_reports = attempt_reports_for(env, &test_data, &test_data.reporter);
    assert_eq!(attempt_reports.len(), 1, "the blocked attempt should create its own report");
    let attempt_report = &attempt_reports[0];
    let attempt_report_index = attempt_report.report_index.expect("attempt report should carry an index");
    assert!(
        matches!(attempt_report.status, ModerationReportStatus::Pending),
        "{:?}",
        attempt_report.status
    );
    assert!(
        attempt_report
            .content_excerpt
            .as_deref()
            .is_some_and(|e| e.contains("quarantined pending review")),
        "{:?}",
        attempt_report.content_excerpt
    );
    // Pre-verdict: nothing is NCA-due yet (I16)
    assert!(!authority_due_indexes(env, &test_data, canister_ids).contains(&attempt_report_index));

    // I8: an attempt report is never resolved directly - it mirrors its original
    let resolve_response = client::user_index::resolve_moderation_report(
        env,
        test_data.moderator.principal,
        canister_ids.user_index,
        &user_index_canister::resolve_moderation_report::Args {
            report_index: attempt_report_index,
            verdict: ModerationVerdict::Dismissed,
            urgent: None,
        },
    );
    assert!(matches!(resolve_response, UnitResult::Error(_)), "{resolve_response:?}");

    // Dismissing the ORIGINAL lifts everything: sender unsuspended, attempter unsuspended
    // (the exact path that was a dead branch before I3 was written down), attempt card
    // resolved as Dismissed
    let resolve_response = client::user_index::resolve_moderation_report(
        env,
        test_data.moderator.principal,
        canister_ids.user_index,
        &user_index_canister::resolve_moderation_report::Args {
            report_index: original_report_index,
            verdict: ModerationVerdict::Dismissed,
            urgent: None,
        },
    );
    assert!(matches!(resolve_response, UnitResult::Success), "{resolve_response:?}");
    tick_many(env, 10);

    let sender_state = client::user_index::happy_path::current_user(env, test_data.sender.principal, canister_ids.user_index);
    assert!(sender_state.suspension_details.is_none(), "sender should be unsuspended");
    let attempter_state =
        client::user_index::happy_path::current_user(env, test_data.reporter.principal, canister_ids.user_index);
    assert!(
        attempter_state.suspension_details.is_none(),
        "attempter should be unsuspended"
    );

    let attempt_reports = attempt_reports_for(env, &test_data, &test_data.reporter);
    assert!(
        matches!(attempt_reports[0].status, ModerationReportStatus::Dismissed(_)),
        "{:?}",
        attempt_reports[0].status
    );

    // I12: dismissal never arms the denylist and releases the pin, so the same bytes upload
    // freely again
    upload_expecting(env, canister_ids, &test_data.reporter, &file, |r| {
        matches!(r, storage_bucket_canister::upload_chunk_v2::Response::Success)
    });
}

// I8b: evidence-affecting entry points reject attempt report indexes - the attempt report
// aliases the original's blob references with a different sender and a virgin
// release_pending, so every guard would read the wrong report
#[test]
fn vault_ops_reject_attempt_report_indexes() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let test_data = init_test_data(env, canister_ids, *controller);
    let file = random_file();
    establish_pending_hash_match_report(env, canister_ids, &test_data, random_principal(), &file);
    attempt_blocked_upload(env, canister_ids, &test_data.reporter, &file);
    let attempt_report_index = attempt_reports_for(env, &test_data, &test_data.reporter)[0]
        .report_index
        .expect("attempt report index");

    let hold_response = client::user_index::set_vault_legal_hold(
        env,
        test_data.moderator.principal,
        canister_ids.user_index,
        &user_index_canister::set_vault_legal_hold::Args {
            report_index: attempt_report_index,
            legal_hold: true,
            reference: "TEST-REF-1".to_string(),
        },
    );
    assert!(matches!(hold_response, UnitResult::Error(_)), "{hold_response:?}");

    let destroy_response = client::user_index::propose_protected_action(
        env,
        test_data.moderator.principal,
        canister_ids.user_index,
        &user_index_canister::propose_protected_action::Args {
            action: ProtectedAction::DestroyVaultEvidence(user_index_canister::destroy_vault_evidence::Args {
                report_index: attempt_report_index,
                le_request_ref: "TEST-REF-2".to_string(),
            }),
        },
    );
    assert!(
        matches!(
            destroy_response,
            user_index_canister::propose_protected_action::Response::Error(_)
        ),
        "{destroy_response:?}"
    );
}

// I16 (uphold mirrors to attempt reports and registers each as NCA-due) and I9 (an attempt
// against already-adjudicated content is born resolved with its own register entry)
#[test]
fn upheld_original_registers_attempts_and_post_verdict_attempts_born_resolved() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let test_data = init_test_data(env, canister_ids, *controller);
    let file = random_file();
    let original_report_index = establish_pending_hash_match_report(env, canister_ids, &test_data, random_principal(), &file);

    attempt_blocked_upload(env, canister_ids, &test_data.reporter, &file);
    let attempt_report_index = attempt_reports_for(env, &test_data, &test_data.reporter)[0]
        .report_index
        .expect("attempt report should carry an index");

    let resolve_response = client::user_index::resolve_moderation_report(
        env,
        test_data.moderator.principal,
        canister_ids.user_index,
        &user_index_canister::resolve_moderation_report::Args {
            report_index: original_report_index,
            verdict: ModerationVerdict::UpheldAsCsam,
            urgent: Some(false),
        },
    );
    assert!(matches!(resolve_response, UnitResult::Success), "{resolve_response:?}");
    tick_many(env, 10);

    // The mirror resolves the attempt report and registers it as its own NCA entry
    let due = authority_due_indexes(env, &test_data, canister_ids);
    assert!(due.contains(&original_report_index), "{due:?}");
    assert!(due.contains(&attempt_report_index), "{due:?}");
    let attempt_reports = attempt_reports_for(env, &test_data, &test_data.reporter);
    assert!(
        matches!(attempt_reports[0].status, ModerationReportStatus::UpheldAsCsam(_)),
        "{:?}",
        attempt_reports[0].status
    );
    let attempter_state =
        client::user_index::happy_path::current_user(env, test_data.reporter.principal, canister_ids.user_index);
    assert!(
        attempter_state.suspension_details.is_some(),
        "attempter remains suspended after uphold"
    );

    // A fresh attempt on the now-adjudicated content: refused at the (denylisted) bucket,
    // report born resolved with its own immediate register entry
    attempt_blocked_upload(env, canister_ids, &test_data.group_owner, &file);

    let born_resolved = attempt_reports_for(env, &test_data, &test_data.group_owner);
    assert_eq!(born_resolved.len(), 1);
    let born_index = born_resolved[0].report_index.expect("born-resolved attempt report index");
    assert!(
        matches!(born_resolved[0].status, ModerationReportStatus::UpheldAsCsam(_)),
        "{:?}",
        born_resolved[0].status
    );
    assert!(authority_due_indexes(env, &test_data, canister_ids).contains(&born_index));
    let attempter_state =
        client::user_index::happy_path::current_user(env, test_data.group_owner.principal, canister_ids.user_index);
    assert!(
        attempter_state.suspension_details.is_some(),
        "post-verdict attempter should be suspended"
    );
}

// I6: a retry inside the window tallies (visible as a notice, no new report); a fresh attempt
// outside the window is a fresh offence with its own report
#[test]
fn repeat_attempts_tally_inside_window_and_report_outside_it() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let test_data = init_test_data(env, canister_ids, *controller);
    let file = random_file();
    establish_pending_hash_match_report(env, canister_ids, &test_data, random_principal(), &file);

    attempt_blocked_upload(env, canister_ids, &test_data.reporter, &file);
    assert_eq!(attempt_reports_for(env, &test_data, &test_data.reporter).len(), 1);

    // Same attempter again immediately: inside the retry window, so no new report - but the
    // attempt is still visible as a channel notice (I14)
    attempt_blocked_upload(env, canister_ids, &test_data.reporter, &file);
    assert_eq!(
        attempt_reports_for(env, &test_data, &test_data.reporter).len(),
        1,
        "a retry inside the window must not create a second report"
    );
    assert!(
        moderation_notices(env, &test_data)
            .iter()
            .any(|t| t.contains("Repeat attempt")),
        "the tallied retry must be visible as a notice"
    );

    // Outside the retry window the same act is a fresh offence with its own report
    env.advance_time(Duration::from_secs(11 * 60));
    tick_many(env, 3);
    attempt_blocked_upload(env, canister_ids, &test_data.reporter, &file);
    assert_eq!(
        attempt_reports_for(env, &test_data, &test_data.reporter).len(),
        2,
        "an attempt outside the retry window is a fresh offence record"
    );

    // The window is FIXED from the latest report's creation, not sliding from the last
    // tallied attempt: paced attempts cannot stay inside it forever (I6)
    env.advance_time(Duration::from_secs(9 * 60));
    tick_many(env, 2);
    attempt_blocked_upload(env, canister_ids, &test_data.reporter, &file);
    assert_eq!(
        attempt_reports_for(env, &test_data, &test_data.reporter).len(),
        2,
        "9 minutes after the latest report is inside its window: tallied"
    );
    env.advance_time(Duration::from_secs(9 * 60));
    tick_many(env, 2);
    attempt_blocked_upload(env, canister_ids, &test_data.reporter, &file);
    assert_eq!(
        attempt_reports_for(env, &test_data, &test_data.reporter).len(),
        3,
        "18 minutes after the latest report is outside its FIXED window even though only 9 minutes passed since the last tallied attempt"
    );

    // 29 minutes were added to the clock: this env must not go back to the pool
    wrapper.discard();
}

// I15: the declared-hash gate cannot be bypassed in either direction - declaring the
// quarantined hash with different bytes is refused outright, and declaring a fake hash for
// the quarantined bytes fails the completion check so the file never exists
#[test]
fn spoofed_hashes_cannot_bypass_the_upload_gate() {
    use utils::hasher::hash_bytes;

    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let test_data = init_test_data(env, canister_ids, *controller);
    let file = random_file();
    establish_pending_hash_match_report(env, canister_ids, &test_data, random_principal(), &file);

    // Different bytes declaring the quarantined hash: refused before any byte is stored
    let other_file = random_file();
    upload_declaring_hash_expecting(env, canister_ids, &test_data.reporter, &other_file, hash_bytes(&file), |r| {
        matches!(r, storage_bucket_canister::upload_chunk_v2::Response::Blocked)
    });

    // The quarantined bytes declaring an innocent hash: accepted past the gate but the
    // completion check rejects the lie, so no file (and no reference) ever exists
    upload_declaring_hash_expecting(env, canister_ids, &test_data.reporter, &file, hash_bytes(&other_file), |r| {
        matches!(r, storage_bucket_canister::upload_chunk_v2::Response::HashMismatch)
    });
}

// I17: the moderation flag word merges across the racing detectors - a clean text
// classification landing after a scan match must not unlock hash-matched content, and
// classifier-set bits survive a scan match on the same message
#[test]
fn flag_word_merges_across_detector_race() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let test_data = init_test_data(env, canister_ids, *controller);
    let scanner = random_principal();
    let file = random_file();

    // A captioned image queues BOTH pipelines: the text classify outcall is left pending
    // while the scan match lands first
    let caption = format!("{TEST_MESSAGE_TEXT} {}", random_string());
    let message_id = {
        // establish_pending_hash_match_report posts caption-less; inline the captioned variant
        client::user_index::happy_path::execute_protected_action(
            env,
            test_data.moderator.principal,
            test_data.operator2.principal,
            canister_ids.user_index,
            ProtectedAction::SetMediaScanConfig(user_index_canister::set_media_scan_config::Args {
                config: MediaScanConfig {
                    enabled: true,
                    scanners: vec![scanner],
                },
            }),
        );
        client::user_index::happy_path::execute_protected_action(
            env,
            test_data.moderator.principal,
            test_data.operator2.principal,
            canister_ids.user_index,
            ProtectedAction::SetVaultReviewers(user_index_canister::set_vault_reviewers::Args {
                user_ids: vec![test_data.moderator.user_id],
            }),
        );
        tick_many(env, 5);
        let bucket = client::storage_index::happy_path::allocated_bucket(
            env,
            test_data.sender.principal,
            canister_ids.storage_index,
            &file,
        );
        client::storage_bucket::happy_path::upload_file(
            env,
            test_data.sender.principal,
            bucket.canister_id,
            bucket.file_id,
            file.clone(),
            vec![test_data.sender.canister()],
            None,
        );
        let blob_reference = BlobReference {
            canister_id: bucket.canister_id,
            blob_id: bucket.file_id,
        };
        let message_id = random_from_u128();
        send_captioned_image_message(
            env,
            &test_data.sender,
            test_data.group_id,
            message_id,
            blob_reference.clone(),
            &caption,
        );
        tick_many(env, 3);

        let local_user_index = canister_ids.local_user_index(env, test_data.group_id);
        let local_user_index_canister::media_scan_jobs::Response::Success(jobs_result) =
            client::local_user_index::media_scan_jobs(
                env,
                scanner,
                local_user_index,
                &local_user_index_canister::media_scan_jobs::Args { from_job_index: 0 },
            );
        let job = jobs_result
            .jobs
            .iter()
            .find(|j| j.request.message_id == message_id)
            .expect("a scan job should be queued");
        client::local_user_index::submit_media_scan_verdicts(
            env,
            scanner,
            local_user_index,
            &local_user_index_canister::submit_media_scan_verdicts::Args {
                verdicts: vec![MediaScanVerdict {
                    job_index: job.job_index,
                    message_id,
                    outcomes: vec![MediaScanBlobOutcome::Match(MediaScanMatch {
                        provider: MediaScanProvider::PhotoDna,
                        blob_id: blob_reference.blob_id,
                        source: "Test".to_string(),
                        violations: vec!["A1".to_string()],
                        match_distance: 181,
                        match_id: None,
                        hash: None,
                    })],
                }],
                up_to_job_index: job.job_index,
            },
        );
        tick_many(env, 10);

        // Scan escalation applied: message deleted + read-gated
        let deleted = client::group::deleted_message(
            env,
            test_data.group_owner.principal,
            test_data.group_id.into(),
            &group_canister::deleted_message::Args {
                thread_root_message_index: None,
                message_id,
            },
        );
        assert!(
            matches!(deleted, group_canister::deleted_message::Response::Error(_)),
            "{deleted:?}"
        );
        message_id
    };

    // Now the racing CLEAN classification lands - it must not unlock the content
    env.advance_time(Duration::from_secs(10));
    mock_moderation_outcalls(env, &caption, &[], 1);
    tick_many(env, 10);

    let events = client::group::happy_path::events(
        env,
        &test_data.group_owner,
        test_data.group_id,
        EventIndex::from(0),
        true,
        100,
        200,
    );
    let message = events
        .events
        .into_iter()
        .filter_map(|e| if let ChatEvent::Message(m) = e.event { Some(*m) } else { None })
        .find(|m| m.message_id == message_id)
        .expect("message should exist");
    assert!(matches!(message.content, MessageContent::Deleted(_)), "{:?}", message.content);
    assert_ne!(
        message.moderation_flags & 2,
        0,
        "the scan-set CSAM flag must survive a clean classification"
    );
    let still_gated = client::group::deleted_message(
        env,
        test_data.group_owner.principal,
        test_data.group_id.into(),
        &group_canister::deleted_message::Args {
            thread_root_message_index: None,
            message_id,
        },
    );
    assert!(
        matches!(still_gated, group_canister::deleted_message::Response::Error(_)),
        "{still_gated:?}"
    );
}

// I18/I19/I20: a redelivered verdict is a no-op, and an over-claiming ack cannot prune jobs
// which never received a verdict
#[test]
fn verdict_redelivery_noops_and_ack_is_clamped() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let test_data = init_test_data(env, canister_ids, *controller);
    let scanner = random_principal();
    let file = random_file();
    establish_pending_hash_match_report(env, canister_ids, &test_data, scanner, &file);
    let local_user_index = canister_ids.local_user_index(env, test_data.group_id);

    // Redelivery: the job was pruned by the first submission, so the duplicate is ignored and
    // no second report or sanction appears
    let reports_before = get_moderation_reports(env, &test_data).len();
    let local_user_index_canister::media_scan_jobs::Response::Success(latest) = client::local_user_index::media_scan_jobs(
        env,
        scanner,
        local_user_index,
        &local_user_index_canister::media_scan_jobs::Args { from_job_index: 0 },
    );
    client::local_user_index::submit_media_scan_verdicts(
        env,
        scanner,
        local_user_index,
        &local_user_index_canister::submit_media_scan_verdicts::Args {
            verdicts: vec![MediaScanVerdict {
                job_index: 1,
                message_id: random_from_u128(),
                outcomes: vec![MediaScanBlobOutcome::Clean],
            }],
            up_to_job_index: latest.latest_job_index,
        },
    );
    tick_many(env, 5);
    assert_eq!(get_moderation_reports(env, &test_data).len(), reports_before);

    // Ack clamp: two new jobs (posted by the group owner - the original sender is suspended
    // by the auto-sanction); a verdict for only the first, acking beyond the second, must
    // not prune the second
    for _ in 0..2 {
        let f = random_file();
        let bucket = client::storage_index::happy_path::allocated_bucket(
            env,
            test_data.group_owner.principal,
            canister_ids.storage_index,
            &f,
        );
        client::storage_bucket::happy_path::upload_file(
            env,
            test_data.group_owner.principal,
            bucket.canister_id,
            bucket.file_id,
            f.to_vec(),
            vec![test_data.group_owner.canister()],
            None,
        );
        send_image_message(
            env,
            &test_data.group_owner,
            test_data.group_id,
            random_from_u128(),
            BlobReference {
                canister_id: bucket.canister_id,
                blob_id: bucket.file_id,
            },
        );
    }
    tick_many(env, 5);
    let local_user_index_canister::media_scan_jobs::Response::Success(jobs) = client::local_user_index::media_scan_jobs(
        env,
        scanner,
        local_user_index,
        &local_user_index_canister::media_scan_jobs::Args { from_job_index: 0 },
    );
    assert!(jobs.jobs.len() >= 2, "two fresh jobs expected, got {}", jobs.jobs.len());
    let first = &jobs.jobs[jobs.jobs.len() - 2];
    let second_index = jobs.jobs.last().unwrap().job_index;
    client::local_user_index::submit_media_scan_verdicts(
        env,
        scanner,
        local_user_index,
        &local_user_index_canister::submit_media_scan_verdicts::Args {
            verdicts: vec![MediaScanVerdict {
                job_index: first.job_index,
                message_id: first.request.message_id,
                outcomes: vec![MediaScanBlobOutcome::Clean],
            }],
            // Over-claim: ack everything including the job we never scanned
            up_to_job_index: second_index,
        },
    );
    let local_user_index_canister::media_scan_jobs::Response::Success(remaining) = client::local_user_index::media_scan_jobs(
        env,
        scanner,
        local_user_index,
        &local_user_index_canister::media_scan_jobs::Args { from_job_index: 0 },
    );
    assert!(
        remaining.jobs.iter().any(|j| j.job_index == second_index),
        "the unscanned job must survive an over-claiming ack"
    );
}

// I20: a stalled pipeline (jobs queued, no verdicts) raises a moderation-channel alert, and
// the first verdict after it posts the all-clear
#[test]
fn stalled_scan_pipeline_alerts_and_recovers() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let test_data = init_test_data(env, canister_ids, *controller);
    let scanner = random_principal();
    client::user_index::happy_path::execute_protected_action(
        env,
        test_data.moderator.principal,
        test_data.operator2.principal,
        canister_ids.user_index,
        ProtectedAction::SetMediaScanConfig(user_index_canister::set_media_scan_config::Args {
            config: MediaScanConfig {
                enabled: true,
                scanners: vec![scanner],
            },
        }),
    );
    tick_many(env, 5);

    let file = random_file();
    let bucket =
        client::storage_index::happy_path::allocated_bucket(env, test_data.sender.principal, canister_ids.storage_index, &file);
    client::storage_bucket::happy_path::upload_file(
        env,
        test_data.sender.principal,
        bucket.canister_id,
        bucket.file_id,
        file.clone(),
        vec![test_data.sender.canister()],
        None,
    );
    let message_id = random_from_u128();
    send_image_message(
        env,
        &test_data.sender,
        test_data.group_id,
        message_id,
        BlobReference {
            canister_id: bucket.canister_id,
            blob_id: bucket.file_id,
        },
    );
    tick_many(env, 3);

    // No worker consumes the job: past the stall threshold the local index raises the alarm
    env.advance_time(Duration::from_secs(31 * 60));
    tick_many(env, 10);
    assert!(
        moderation_notices(env, &test_data)
            .iter()
            .any(|t| t.contains("Media scan pipeline stalled")),
        "a stalled pipeline must alert the moderation channel"
    );

    // The first verdict afterwards posts the all-clear
    let local_user_index = canister_ids.local_user_index(env, test_data.group_id);
    let local_user_index_canister::media_scan_jobs::Response::Success(jobs) = client::local_user_index::media_scan_jobs(
        env,
        scanner,
        local_user_index,
        &local_user_index_canister::media_scan_jobs::Args { from_job_index: 0 },
    );
    let job = jobs
        .jobs
        .iter()
        .find(|j| j.request.message_id == message_id)
        .expect("the stalled job should still be queued");
    client::local_user_index::submit_media_scan_verdicts(
        env,
        scanner,
        local_user_index,
        &local_user_index_canister::submit_media_scan_verdicts::Args {
            verdicts: vec![MediaScanVerdict {
                job_index: job.job_index,
                message_id,
                outcomes: vec![MediaScanBlobOutcome::Clean],
            }],
            up_to_job_index: job.job_index,
        },
    );
    tick_many(env, 10);
    assert!(
        moderation_notices(env, &test_data)
            .iter()
            .any(|t| t.contains("Media scan pipeline recovered")),
        "recovery must post the all-clear"
    );

    // 31 minutes were added to the clock: this env must not go back to the pool
    wrapper.discard();
}

// I3 (an unrelated report's dismissal never lifts an attempt sanction) and the full lifecycle
// closure: only the linked report's dismissal does
#[test]
fn unrelated_dismissal_never_lifts_an_attempt_sanction() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let test_data = init_test_data(env, canister_ids, *controller);

    // The attempter first earns their own unrelated CSAM report (classifier-detected text)
    let unrelated_message_id = random_from_u128();
    let unrelated_text = format!("{TEST_MESSAGE_TEXT} {}", random_string());
    client::group::happy_path::send_text_message(
        env,
        &test_data.reporter,
        test_data.group_id,
        None,
        &unrelated_text,
        Some(unrelated_message_id),
    );
    tick_many(env, 3);
    env.advance_time(Duration::from_secs(10));
    mock_moderation_outcalls(env, &unrelated_text, &[CSAM_CATEGORY], 1);
    tick_many(env, 10);
    let unrelated_report_index = get_moderation_reports(env, &test_data)
        .iter()
        .find(|r| r.sender == test_data.reporter.user_id)
        .and_then(|r| r.report_index)
        .expect("the classifier detection should create a report");

    // Then a blocked attempt on someone else's pending content
    let file = random_file();
    let original_report_index = establish_pending_hash_match_report(env, canister_ids, &test_data, random_principal(), &file);
    attempt_blocked_upload(env, canister_ids, &test_data.reporter, &file);

    // Dismissing the UNRELATED report must not lift the attempt sanction
    let resolve_response = client::user_index::resolve_moderation_report(
        env,
        test_data.moderator.principal,
        canister_ids.user_index,
        &user_index_canister::resolve_moderation_report::Args {
            report_index: unrelated_report_index,
            verdict: ModerationVerdict::Dismissed,
            urgent: None,
        },
    );
    assert!(matches!(resolve_response, UnitResult::Success), "{resolve_response:?}");
    tick_many(env, 10);
    let attempter_state =
        client::user_index::happy_path::current_user(env, test_data.reporter.principal, canister_ids.user_index);
    assert!(
        attempter_state.suspension_details.is_some(),
        "an unrelated dismissal must not lift the attempt sanction"
    );

    // The attempter can contest the automated sanction (Article 22). The contest must fall
    // through to the hash-match sanction path (the attempt report is not contestable as a
    // report - I8a): the moderator notice is posted with pre-verdict wording, and the
    // attempt card stays out of the Contested state
    let contest_response = client::user_index::contest_moderation_sanction(
        env,
        test_data.reporter.principal,
        canister_ids.user_index,
        &types::Empty {},
    );
    assert!(matches!(contest_response, UnitResult::Success), "{contest_response:?}");
    tick_many(env, 5);
    assert!(
        moderation_notices(env, &test_data)
            .iter()
            .any(|t| t.contains("Human review requested") && t.contains("quarantined pending review")),
        "the contest must post the moderator notice via the sanction path"
    );
    assert!(
        attempt_reports_for(env, &test_data, &test_data.reporter)
            .iter()
            .all(|r| !matches!(r.status, ModerationReportStatus::Contested)),
        "an attempt report must never enter the Contested state"
    );

    // A repeat attempt re-records the sanction; the standing contest must survive it
    attempt_blocked_upload(env, canister_ids, &test_data.reporter, &file);
    let second_contest = client::user_index::contest_moderation_sanction(
        env,
        test_data.reporter.principal,
        canister_ids.user_index,
        &types::Empty {},
    );
    assert!(
        matches!(second_contest, UnitResult::Error(_)),
        "the preserved contest must make a second contest a no-op: {second_contest:?}"
    );
    tick_many(env, 3);
    assert_eq!(
        moderation_notices(env, &test_data)
            .iter()
            .filter(|t| t.contains("Human review requested"))
            .count(),
        1,
        "a standing contest must not mint further notices via the last-resort path"
    );

    // Only the LINKED report's dismissal lifts it
    let resolve_response = client::user_index::resolve_moderation_report(
        env,
        test_data.moderator.principal,
        canister_ids.user_index,
        &user_index_canister::resolve_moderation_report::Args {
            report_index: original_report_index,
            verdict: ModerationVerdict::Dismissed,
            urgent: None,
        },
    );
    assert!(matches!(resolve_response, UnitResult::Success), "{resolve_response:?}");
    tick_many(env, 10);
    let attempter_state =
        client::user_index::happy_path::current_user(env, test_data.reporter.principal, canister_ids.user_index);
    assert!(
        attempter_state.suspension_details.is_none(),
        "the linked report's dismissal lifts the attempt sanction"
    );
}

// I13 (provenance): a pin created by an unverified reporter assertion blocks third-party
// re-uploads WITHOUT sanctioning or reporting them - the assertion does not suspend the
// reported sender, so it must not suspend anyone else either
#[test]
fn reporter_asserted_pin_blocks_without_sanction() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let test_data = init_test_data(env, canister_ids, *controller);
    let file = random_file();

    // The sender posts an image; the reporter asserts CSAM against it: protective quarantine
    // pins the blob but deliberately does not suspend the sender
    let bucket =
        client::storage_index::happy_path::allocated_bucket(env, test_data.sender.principal, canister_ids.storage_index, &file);
    client::storage_bucket::happy_path::upload_file(
        env,
        test_data.sender.principal,
        bucket.canister_id,
        bucket.file_id,
        file.clone(),
        vec![test_data.sender.canister()],
        None,
    );
    let message_id = random_from_u128();
    send_image_message(
        env,
        &test_data.sender,
        test_data.group_id,
        message_id,
        BlobReference {
            canister_id: bucket.canister_id,
            blob_id: bucket.file_id,
        },
    );
    tick_many(env, 3);
    client::group::report_message(
        env,
        test_data.reporter.principal,
        test_data.group_id.into(),
        &group_canister::report_message::Args {
            thread_root_message_index: None,
            message_id,
            delete: false,
            csam: true,
        },
    );
    tick_many(env, 10);

    // A third party re-uploads the same bytes: blocked, but neither sanctioned nor reported
    attempt_blocked_upload(env, canister_ids, &test_data.group_owner, &file);

    let attempter_state =
        client::user_index::happy_path::current_user(env, test_data.group_owner.principal, canister_ids.user_index);
    assert!(
        attempter_state.suspension_details.is_none(),
        "a reporter-asserted pin must not suspend third parties"
    );
    assert!(
        attempt_reports_for(env, &test_data, &test_data.group_owner).is_empty(),
        "no attempt report may anchor to an unverified assertion"
    );
    assert!(
        moderation_notices(env, &test_data)
            .iter()
            .any(|t| t.contains("No sanction was applied")),
        "the blocked attempt must still be visible as a notice"
    );
}

// I9 (repeats): a tallied repeat derives its consequences from the attempt report's state -
// after the original is upheld, the repeat notice says so and no duplicate report appears
#[test]
fn repeat_after_uphold_is_state_derived() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let test_data = init_test_data(env, canister_ids, *controller);
    let file = random_file();
    let original_report_index = establish_pending_hash_match_report(env, canister_ids, &test_data, random_principal(), &file);

    attempt_blocked_upload(env, canister_ids, &test_data.reporter, &file);
    assert_eq!(attempt_reports_for(env, &test_data, &test_data.reporter).len(), 1);

    let resolve_response = client::user_index::resolve_moderation_report(
        env,
        test_data.moderator.principal,
        canister_ids.user_index,
        &user_index_canister::resolve_moderation_report::Args {
            report_index: original_report_index,
            verdict: ModerationVerdict::UpheldAsCsam,
            urgent: Some(false),
        },
    );
    assert!(matches!(resolve_response, UnitResult::Success), "{resolve_response:?}");
    tick_many(env, 10);

    // Within the retry window: tallied onto the (now resolved) attempt report, with the
    // notice reflecting the CURRENT adjudication state, and the attempter stays suspended
    attempt_blocked_upload(env, canister_ids, &test_data.reporter, &file);
    assert_eq!(
        attempt_reports_for(env, &test_data, &test_data.reporter).len(),
        1,
        "a repeat must not mint a second report"
    );
    assert!(
        moderation_notices(env, &test_data)
            .iter()
            .any(|t| t.contains("Repeat attempt") && t.contains("upheld as CSAM")),
        "the repeat notice must reflect the resolved state"
    );
    let attempter_state =
        client::user_index::happy_path::current_user(env, test_data.reporter.principal, canister_ids.user_index);
    assert!(
        attempter_state.suspension_details.is_some(),
        "the verdict-backed sanction stands"
    );
}

// I1/I2: the single-slot sanction record can be overwritten by a second attempt; resolving
// every linked report must still fully unsuspend, in either order
#[test]
fn overwritten_sanction_record_never_strands_the_attempter() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let test_data = init_test_data(env, canister_ids, *controller);
    let scanner = random_principal();
    let file1 = random_file();
    let file2 = random_file();
    let (_, r1) = establish_pending_hash_match_report_from(env, canister_ids, &test_data, scanner, &file1, None);
    let (_, r2) =
        establish_pending_hash_match_report_from(env, canister_ids, &test_data, scanner, &file2, Some(&test_data.group_owner));

    // Two attempts by the same user against different pending reports: the second overwrites
    // the sanction record's report linkage
    attempt_blocked_upload(env, canister_ids, &test_data.reporter, &file1);
    attempt_blocked_upload(env, canister_ids, &test_data.reporter, &file2);
    assert_eq!(attempt_reports_for(env, &test_data, &test_data.reporter).len(), 2);

    // Dismissing the SECOND (the one the record points at) must keep the attempter suspended:
    // the first attempt report is still pending
    let resolve_response = client::user_index::resolve_moderation_report(
        env,
        test_data.moderator.principal,
        canister_ids.user_index,
        &user_index_canister::resolve_moderation_report::Args {
            report_index: r2,
            verdict: ModerationVerdict::Dismissed,
            urgent: None,
        },
    );
    assert!(matches!(resolve_response, UnitResult::Success), "{resolve_response:?}");
    tick_many(env, 10);
    let attempter_state =
        client::user_index::happy_path::current_user(env, test_data.reporter.principal, canister_ids.user_index);
    assert!(
        attempter_state.suspension_details.is_some(),
        "the still-pending first attempt report must keep the attempter suspended"
    );

    // I8a last resort: the sanction record is gone (cleared with R2) but the user is still
    // suspended by the pending first attempt report - the contest must still land and post
    // the moderator notice
    let contest_response = client::user_index::contest_moderation_sanction(
        env,
        test_data.reporter.principal,
        canister_ids.user_index,
        &types::Empty {},
    );
    assert!(matches!(contest_response, UnitResult::Success), "{contest_response:?}");
    tick_many(env, 5);
    assert!(
        moderation_notices(env, &test_data)
            .iter()
            .any(|t| t.contains("Human review requested") && t.contains("attempt report #")),
        "the last-resort contest must post the moderator notice"
    );

    // Dismissing the FIRST - whose record pointer was overwritten - must now fully unsuspend:
    // the cleared/overwritten record is not a precondition for the reversal
    let resolve_response = client::user_index::resolve_moderation_report(
        env,
        test_data.moderator.principal,
        canister_ids.user_index,
        &user_index_canister::resolve_moderation_report::Args {
            report_index: r1,
            verdict: ModerationVerdict::Dismissed,
            urgent: None,
        },
    );
    assert!(matches!(resolve_response, UnitResult::Success), "{resolve_response:?}");
    tick_many(env, 10);
    let attempter_state =
        client::user_index::happy_path::current_user(env, test_data.reporter.principal, canister_ids.user_index);
    assert!(
        attempter_state.suspension_details.is_none(),
        "every linked report is resolved: the attempter must be unsuspended"
    );
}

// I14/I16 (forward dedupe): a forward's file id is stable, so the pre-verdict sighting must
// not suppress the visibility of the deliberate post-verdict forward of the same file
#[test]
fn post_verdict_forward_is_still_reported() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let test_data = init_test_data(env, canister_ids, *controller);
    let file = random_file();

    // The reporter uploads their OWN copy of the bytes first: dedup shares the blob, and
    // their file id is one the vault never tracks - the sighting-clearing must still find it
    let reporter_bucket = client::storage_index::happy_path::allocated_bucket(
        env,
        test_data.reporter.principal,
        canister_ids.storage_index,
        &file,
    );
    client::storage_bucket::happy_path::upload_file(
        env,
        test_data.reporter.principal,
        reporter_bucket.canister_id,
        reporter_bucket.file_id,
        file.clone(),
        vec![test_data.reporter.canister()],
        None,
    );

    let (_, original_report_index) =
        establish_pending_hash_match_report_from(env, canister_ids, &test_data, random_principal(), &file, None);

    // Pre-verdict forward of the dedup-shared copy: blocked and reported as an attempt
    let forward_response = client::storage_bucket::forward_file(
        env,
        test_data.reporter.principal,
        reporter_bucket.canister_id,
        &storage_bucket_canister::forward_file::Args {
            file_id: reporter_bucket.file_id,
            accessors: vec![test_data.reporter.canister()],
        },
    );
    assert!(
        matches!(forward_response, storage_bucket_canister::forward_file::Response::Blocked),
        "{forward_response:?}"
    );
    tick_many(env, 10);
    assert_eq!(attempt_reports_for(env, &test_data, &test_data.reporter).len(), 1);

    let resolve_response = client::user_index::resolve_moderation_report(
        env,
        test_data.moderator.principal,
        canister_ids.user_index,
        &user_index_canister::resolve_moderation_report::Args {
            report_index: original_report_index,
            verdict: ModerationVerdict::UpheldAsCsam,
            urgent: Some(false),
        },
    );
    assert!(matches!(resolve_response, UnitResult::Success), "{resolve_response:?}");
    tick_many(env, 10);
    let notices_before = moderation_notices(env, &test_data)
        .iter()
        .filter(|t| t.contains("Repeat attempt"))
        .count();

    // Post-verdict forward of the SAME dedup-shared file id: the denylist transition cleared
    // the sighting (via the Files model - the vault never saw this id), so this deliberate
    // offence is visible (tallied with the resolved state), not silent
    let forward_response = client::storage_bucket::forward_file(
        env,
        test_data.reporter.principal,
        reporter_bucket.canister_id,
        &storage_bucket_canister::forward_file::Args {
            file_id: reporter_bucket.file_id,
            accessors: vec![test_data.reporter.canister()],
        },
    );
    assert!(
        matches!(forward_response, storage_bucket_canister::forward_file::Response::Blocked),
        "{forward_response:?}"
    );
    tick_many(env, 10);
    let notices_after = moderation_notices(env, &test_data)
        .iter()
        .filter(|t| t.contains("Repeat attempt"))
        .count();
    assert!(
        notices_after > notices_before,
        "the post-verdict forward must be visible, not silenced by the pre-verdict sighting"
    );
}

// I13 (machine-backed predicate): a machine detection which collapsed into an existing user
// report leaves detection == UserReport but applied a real suspension - attempts on its pin
// must still be sanctioned and reported
#[test]
fn machine_detection_in_user_report_still_sanctions_attempts() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let test_data = init_test_data(env, canister_ids, *controller);
    let scanner = random_principal();
    let file = random_file();

    // Configure scanning, post the image, then have the reporter file a PLAIN report (no
    // assertion) BEFORE the scan verdict arrives: the detection then collapses into the
    // existing user report
    client::user_index::happy_path::execute_protected_action(
        env,
        test_data.moderator.principal,
        test_data.operator2.principal,
        canister_ids.user_index,
        ProtectedAction::SetMediaScanConfig(user_index_canister::set_media_scan_config::Args {
            config: MediaScanConfig {
                enabled: true,
                scanners: vec![scanner],
            },
        }),
    );
    client::user_index::happy_path::execute_protected_action(
        env,
        test_data.moderator.principal,
        test_data.operator2.principal,
        canister_ids.user_index,
        ProtectedAction::SetVaultReviewers(user_index_canister::set_vault_reviewers::Args {
            user_ids: vec![test_data.moderator.user_id],
        }),
    );
    tick_many(env, 5);

    let bucket =
        client::storage_index::happy_path::allocated_bucket(env, test_data.sender.principal, canister_ids.storage_index, &file);
    client::storage_bucket::happy_path::upload_file(
        env,
        test_data.sender.principal,
        bucket.canister_id,
        bucket.file_id,
        file.clone(),
        vec![test_data.sender.canister()],
        None,
    );
    let blob_reference = BlobReference {
        canister_id: bucket.canister_id,
        blob_id: bucket.file_id,
    };
    let message_id = random_from_u128();
    // Captioned: the report's classification then needs the (deliberately unmocked) API
    // call, so the report's outcome stays open for the scan detection to collapse into. A
    // caption-less image is "classified" empty immediately, which would record an outcome
    // first and make the detection a no-op per I18.
    let caption = format!("{TEST_MESSAGE_TEXT} {}", random_string());
    send_captioned_image_message(
        env,
        &test_data.sender,
        test_data.group_id,
        message_id,
        blob_reference.clone(),
        &caption,
    );
    tick_many(env, 3);

    client::group::report_message(
        env,
        test_data.reporter.principal,
        test_data.group_id.into(),
        &group_canister::report_message::Args {
            thread_root_message_index: None,
            message_id,
            delete: false,
            csam: false,
        },
    );
    tick_many(env, 5);

    let local_user_index = canister_ids.local_user_index(env, test_data.group_id);
    let local_user_index_canister::media_scan_jobs::Response::Success(jobs_result) = client::local_user_index::media_scan_jobs(
        env,
        scanner,
        local_user_index,
        &local_user_index_canister::media_scan_jobs::Args { from_job_index: 0 },
    );
    let job = jobs_result
        .jobs
        .iter()
        .find(|j| j.request.message_id == message_id)
        .expect("scan job");
    client::local_user_index::submit_media_scan_verdicts(
        env,
        scanner,
        local_user_index,
        &local_user_index_canister::submit_media_scan_verdicts::Args {
            verdicts: vec![MediaScanVerdict {
                job_index: job.job_index,
                message_id,
                outcomes: vec![MediaScanBlobOutcome::Match(MediaScanMatch {
                    provider: MediaScanProvider::PhotoDna,
                    blob_id: blob_reference.blob_id,
                    source: "Test".to_string(),
                    violations: vec!["A1".to_string()],
                    match_distance: 181,
                    match_id: None,
                    hash: None,
                })],
            }],
            up_to_job_index: job.job_index,
        },
    );
    tick_many(env, 10);

    // The machine detection collapsed into the user report and suspended the sender
    let sender_state = client::user_index::happy_path::current_user(env, test_data.sender.principal, canister_ids.user_index);
    assert!(
        sender_state.suspension_details.is_some(),
        "the machine detection should suspend the sender"
    );

    // A third-party attempt on the pin must be sanctioned and reported, despite the anchor's
    // detection source reading UserReport
    attempt_blocked_upload(env, canister_ids, &test_data.group_owner, &file);
    let attempter_state =
        client::user_index::happy_path::current_user(env, test_data.group_owner.principal, canister_ids.user_index);
    assert!(
        attempter_state.suspension_details.is_some(),
        "a machine-backed pin must sanction attempts even inside a user report"
    );
    assert_eq!(attempt_reports_for(env, &test_data, &test_data.group_owner).len(), 1);
}

// I14 (throttle): repeated unsanctioned attempts against an assertion pin produce one notice
// inside the throttle window, not one per attempt
#[test]
fn unsanctioned_attempt_notices_are_throttled() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let test_data = init_test_data(env, canister_ids, *controller);
    let file = random_file();

    let bucket =
        client::storage_index::happy_path::allocated_bucket(env, test_data.sender.principal, canister_ids.storage_index, &file);
    client::storage_bucket::happy_path::upload_file(
        env,
        test_data.sender.principal,
        bucket.canister_id,
        bucket.file_id,
        file.clone(),
        vec![test_data.sender.canister()],
        None,
    );
    let message_id = random_from_u128();
    send_image_message(
        env,
        &test_data.sender,
        test_data.group_id,
        message_id,
        BlobReference {
            canister_id: bucket.canister_id,
            blob_id: bucket.file_id,
        },
    );
    tick_many(env, 3);
    client::group::report_message(
        env,
        test_data.reporter.principal,
        test_data.group_id.into(),
        &group_canister::report_message::Args {
            thread_root_message_index: None,
            message_id,
            delete: false,
            csam: true,
        },
    );
    tick_many(env, 10);

    for _ in 0..3 {
        attempt_blocked_upload(env, canister_ids, &test_data.group_owner, &file);
    }
    let notices = moderation_notices(env, &test_data)
        .iter()
        .filter(|t| t.contains("Blocked re-post of content under review"))
        .count();
    assert_eq!(notices, 1, "one notice inside the throttle window, however many attempts");
    let attempter_state =
        client::user_index::happy_path::current_user(env, test_data.group_owner.principal, canister_ids.user_index);
    assert!(attempter_state.suspension_details.is_none());

    // A DIFFERENT offender's first attempt gets its own named notice: the throttle is per
    // (report, offender), so one offender's flood cannot hide another (I14)
    attempt_blocked_upload(env, canister_ids, &test_data.moderator, &file);
    let notices = moderation_notices(env, &test_data)
        .iter()
        .filter(|t| t.contains("Blocked re-post of content under review"))
        .count();
    assert_eq!(notices, 2, "each offender gets a named notice");
}

// I10 (strikes): attempt reports never count towards the repeat-offender escalation - an
// Upheld (not CSAM) original downgrades the attempter to the standard one-day severity even
// after several attempt reports
#[test]
fn attempt_reports_never_escalate_an_upheld_downgrade() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let test_data = init_test_data(env, canister_ids, *controller);
    let file = random_file();
    let original_report_index = establish_pending_hash_match_report(env, canister_ids, &test_data, random_principal(), &file);

    // Three attempt reports for the same content (outside the retry window each time)
    attempt_blocked_upload(env, canister_ids, &test_data.reporter, &file);
    for _ in 0..2 {
        env.advance_time(Duration::from_secs(11 * 60));
        tick_many(env, 2);
        attempt_blocked_upload(env, canister_ids, &test_data.reporter, &file);
    }
    assert_eq!(attempt_reports_for(env, &test_data, &test_data.reporter).len(), 3);

    let resolve_response = client::user_index::resolve_moderation_report(
        env,
        test_data.moderator.principal,
        canister_ids.user_index,
        &user_index_canister::resolve_moderation_report::Args {
            report_index: original_report_index,
            verdict: ModerationVerdict::Upheld,
            urgent: None,
        },
    );
    assert!(matches!(resolve_response, UnitResult::Success), "{resolve_response:?}");
    tick_many(env, 10);

    let attempter_state =
        client::user_index::happy_path::current_user(env, test_data.reporter.principal, canister_ids.user_index);
    let suspension_details = attempter_state
        .suspension_details
        .expect("the downgraded standard suspension should be in force");
    assert!(
        matches!(suspension_details.action, SuspensionAction::Unsuspend(_)),
        "attempt reports must not escalate the downgrade to indefinite: {:?}",
        suspension_details.action
    );

    // 22 minutes were added to the clock: this env must not go back to the pool
    wrapper.discard();
}

// I1a: a manual moderator suspension is invisible to the sanction machinery and must
// survive the dismissal of any report - including via the attempt-report mirror
#[test]
fn dismissal_never_lifts_a_manual_suspension() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let test_data = init_test_data(env, canister_ids, *controller);
    let file = random_file();
    let original_report_index = establish_pending_hash_match_report(env, canister_ids, &test_data, random_principal(), &file);

    // A moderator manually suspends the (future) attempter for something unrelated
    let suspend_response = client::user_index::suspend_user(
        env,
        test_data.moderator.principal,
        canister_ids.user_index,
        &user_index_canister::suspend_user::Args {
            user_id: test_data.reporter.user_id,
            duration: None,
            reason: "unrelated harassment".to_string(),
        },
    );
    assert!(
        matches!(suspend_response, user_index_canister::suspend_user::Response::Success),
        "{suspend_response:?}"
    );
    tick_many(env, 5);

    // The suspended user can still hit the storage path (documented weakness) and records an
    // attempt; the original's dismissal must NOT lift the manual suspension
    attempt_blocked_upload(env, canister_ids, &test_data.reporter, &file);
    let resolve_response = client::user_index::resolve_moderation_report(
        env,
        test_data.moderator.principal,
        canister_ids.user_index,
        &user_index_canister::resolve_moderation_report::Args {
            report_index: original_report_index,
            verdict: ModerationVerdict::Dismissed,
            urgent: None,
        },
    );
    assert!(matches!(resolve_response, UnitResult::Success), "{resolve_response:?}");
    tick_many(env, 10);

    let attempter_state =
        client::user_index::happy_path::current_user(env, test_data.reporter.principal, canister_ids.user_index);
    let suspension_details = attempter_state
        .suspension_details
        .expect("the manual suspension must survive the dismissal");
    assert_eq!(suspension_details.reason, "unrelated harassment");
}

// I1a: an Upheld (not CSAM) verdict must not downgrade a manual moderator suspension to
// the 1-day bot suspension
#[test]
fn upheld_never_downgrades_a_manual_suspension() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let test_data = init_test_data(env, canister_ids, *controller);
    let file = random_file();
    let original_report_index = establish_pending_hash_match_report(env, canister_ids, &test_data, random_principal(), &file);

    let suspend_response = client::user_index::suspend_user(
        env,
        test_data.moderator.principal,
        canister_ids.user_index,
        &user_index_canister::suspend_user::Args {
            user_id: test_data.reporter.user_id,
            duration: None,
            reason: "unrelated harassment".to_string(),
        },
    );
    assert!(
        matches!(suspend_response, user_index_canister::suspend_user::Response::Success),
        "{suspend_response:?}"
    );
    tick_many(env, 5);

    attempt_blocked_upload(env, canister_ids, &test_data.reporter, &file);
    let resolve_response = client::user_index::resolve_moderation_report(
        env,
        test_data.moderator.principal,
        canister_ids.user_index,
        &user_index_canister::resolve_moderation_report::Args {
            report_index: original_report_index,
            verdict: ModerationVerdict::Upheld,
            urgent: None,
        },
    );
    assert!(matches!(resolve_response, UnitResult::Success), "{resolve_response:?}");
    tick_many(env, 10);

    let attempter_state =
        client::user_index::happy_path::current_user(env, test_data.reporter.principal, canister_ids.user_index);
    let suspension_details = attempter_state
        .suspension_details
        .expect("the manual suspension must survive the Upheld mirror");
    assert_eq!(
        suspension_details.reason, "unrelated harassment",
        "the manual suspension must not be replaced or downgraded"
    );
}

// I1a, the other half of the rule: automation may STRICTLY ESCALATE. A timed manual
// suspension must not shield a user from the indefinite CSAM sanction - only a lateral or
// weakening replacement is forbidden. Without this the offender is free when the day expires.
#[test]
fn attempt_escalates_a_timed_manual_suspension_to_indefinite() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let test_data = init_test_data(env, canister_ids, *controller);
    let file = random_file();
    establish_pending_hash_match_report(env, canister_ids, &test_data, random_principal(), &file);

    // A moderator suspends the (future) attempter for a DAY, for something unrelated
    let suspend_response = client::user_index::suspend_user(
        env,
        test_data.moderator.principal,
        canister_ids.user_index,
        &user_index_canister::suspend_user::Args {
            user_id: test_data.reporter.user_id,
            duration: Some(DAY_IN_MS),
            reason: "unrelated harassment".to_string(),
        },
    );
    assert!(
        matches!(suspend_response, user_index_canister::suspend_user::Response::Success),
        "{suspend_response:?}"
    );
    tick_many(env, 5);

    let before = client::user_index::happy_path::current_user(env, test_data.reporter.principal, canister_ids.user_index)
        .suspension_details
        .expect("the manual suspension must be in force");
    assert!(
        matches!(before.action, SuspensionAction::Unsuspend(_)),
        "the manual suspension should be timed: {:?}",
        before.action
    );

    attempt_blocked_upload(env, canister_ids, &test_data.reporter, &file);
    tick_many(env, 10);

    let after = client::user_index::happy_path::current_user(env, test_data.reporter.principal, canister_ids.user_index)
        .suspension_details
        .expect("the attempter must still be suspended");
    assert!(
        matches!(after.action, SuspensionAction::Delete(_)),
        "the timed manual suspension must have been escalated to an indefinite one: {:?}",
        after.action
    );
    assert_eq!(
        after.reason, "Content you attempted to post matches content under review as suspected child sexual abuse material",
        "the escalated suspension must carry the pre-verdict (suspected, not confirmed) reason - I21"
    );
    assert_eq!(
        after.suspended_by, OPENCHAT_BOT_USER_ID,
        "the escalated suspension is the automated one"
    );
}

// I14 (refused-upload file ids): a pre-verdict sighting must not silence the deliberate
// post-verdict re-upload of the SAME file id - sightings self-describe their hash and are
// cleared on the denylist transition
#[test]
fn post_verdict_reupload_of_same_file_id_is_still_reported() {
    use utils::hasher::hash_bytes;

    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let test_data = init_test_data(env, canister_ids, *controller);
    let file = random_file();
    let original_report_index = establish_pending_hash_match_report(env, canister_ids, &test_data, random_principal(), &file);

    // Allocate ONCE and keep the file id: the retry after the verdict reuses it exactly
    let storage_index_canister::allocated_bucket_v2::Response::Success(bucket) = client::storage_index::allocated_bucket_v2(
        env,
        test_data.reporter.principal,
        canister_ids.storage_index,
        &storage_index_canister::allocated_bucket_v2::Args {
            file_hash: hash_bytes(&file),
            file_size: file.len() as u64,
            file_id_seed: Some(random_from_u128()),
        },
    ) else {
        panic!("allocation should succeed");
    };
    let upload = |env: &mut PocketIc| {
        client::storage_bucket::upload_chunk_v2(
            env,
            test_data.reporter.principal,
            bucket.canister_id,
            &storage_bucket_canister::upload_chunk_v2::Args {
                file_id: bucket.file_id,
                hash: hash_bytes(&file),
                mime_type: "image/jpeg".to_string(),
                accessors: vec![test_data.reporter.canister()],
                chunk_index: 0,
                chunk_size: file.len() as u32,
                total_size: file.len() as u64,
                bytes: file.clone(),
                expiry: None,
            },
        )
    };
    let response = upload(env);
    assert!(
        matches!(response, storage_bucket_canister::upload_chunk_v2::Response::Blocked),
        "{response:?}"
    );
    tick_many(env, 10);
    assert_eq!(attempt_reports_for(env, &test_data, &test_data.reporter).len(), 1);

    let resolve_response = client::user_index::resolve_moderation_report(
        env,
        test_data.moderator.principal,
        canister_ids.user_index,
        &user_index_canister::resolve_moderation_report::Args {
            report_index: original_report_index,
            verdict: ModerationVerdict::UpheldAsCsam,
            urgent: Some(false),
        },
    );
    assert!(matches!(resolve_response, UnitResult::Success), "{resolve_response:?}");
    tick_many(env, 10);

    // The SAME file id again, now against the denylist: must be visible, not silenced by the
    // pre-verdict sighting
    let response = upload(env);
    assert!(
        matches!(response, storage_bucket_canister::upload_chunk_v2::Response::Blocked),
        "{response:?}"
    );
    tick_many(env, 10);
    assert!(
        moderation_notices(env, &test_data)
            .iter()
            .any(|t| t.contains("Repeat attempt") && t.contains("upheld as CSAM")),
        "the post-verdict re-upload of the same file id must be reported"
    );
}

// I1a in the primitives, sender side: dismissing the machine report must not lift a manual
// suspension a moderator placed on the SENDER after detection (rounds 8-9: the attempter arm
// was guarded, the sender arm was not - the guard now lives in unsuspend_sender itself)
#[test]
fn sender_dismissal_never_lifts_a_manual_suspension() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let test_data = init_test_data(env, canister_ids, *controller);
    let file = random_file();
    let report_index = establish_pending_hash_match_report(env, canister_ids, &test_data, random_principal(), &file);

    // Replace the automated suspension with a manual one for something unrelated
    client::user_index::unsuspend_user(
        env,
        test_data.moderator.principal,
        canister_ids.user_index,
        &user_index_canister::unsuspend_user::Args {
            user_id: test_data.sender.user_id,
        },
    );
    tick_many(env, 5);
    let suspend_response = client::user_index::suspend_user(
        env,
        test_data.moderator.principal,
        canister_ids.user_index,
        &user_index_canister::suspend_user::Args {
            user_id: test_data.sender.user_id,
            duration: None,
            reason: "unrelated harassment".to_string(),
        },
    );
    assert!(
        matches!(suspend_response, user_index_canister::suspend_user::Response::Success),
        "{suspend_response:?}"
    );
    tick_many(env, 5);

    let resolve_response = client::user_index::resolve_moderation_report(
        env,
        test_data.moderator.principal,
        canister_ids.user_index,
        &user_index_canister::resolve_moderation_report::Args {
            report_index,
            verdict: ModerationVerdict::Dismissed,
            urgent: None,
        },
    );
    assert!(matches!(resolve_response, UnitResult::Success), "{resolve_response:?}");
    tick_many(env, 10);

    let sender_state = client::user_index::happy_path::current_user(env, test_data.sender.principal, canister_ids.user_index);
    let suspension_details = sender_state
        .suspension_details
        .expect("the manual suspension on the sender must survive the dismissal");
    assert_eq!(suspension_details.reason, "unrelated harassment");
}

// I1a in the primitives, sender side: an Upheld (not CSAM) verdict must not downgrade a
// manual indefinite suspension on the SENDER to the 1-day bot suspension
#[test]
fn sender_upheld_never_downgrades_a_manual_suspension() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let test_data = init_test_data(env, canister_ids, *controller);
    let file = random_file();
    let report_index = establish_pending_hash_match_report(env, canister_ids, &test_data, random_principal(), &file);

    client::user_index::unsuspend_user(
        env,
        test_data.moderator.principal,
        canister_ids.user_index,
        &user_index_canister::unsuspend_user::Args {
            user_id: test_data.sender.user_id,
        },
    );
    tick_many(env, 5);
    let suspend_response = client::user_index::suspend_user(
        env,
        test_data.moderator.principal,
        canister_ids.user_index,
        &user_index_canister::suspend_user::Args {
            user_id: test_data.sender.user_id,
            duration: None,
            reason: "unrelated harassment".to_string(),
        },
    );
    assert!(
        matches!(suspend_response, user_index_canister::suspend_user::Response::Success),
        "{suspend_response:?}"
    );
    tick_many(env, 5);

    let resolve_response = client::user_index::resolve_moderation_report(
        env,
        test_data.moderator.principal,
        canister_ids.user_index,
        &user_index_canister::resolve_moderation_report::Args {
            report_index,
            verdict: ModerationVerdict::Upheld,
            urgent: None,
        },
    );
    assert!(matches!(resolve_response, UnitResult::Success), "{resolve_response:?}");
    tick_many(env, 10);

    let sender_state = client::user_index::happy_path::current_user(env, test_data.sender.principal, canister_ids.user_index);
    let suspension_details = sender_state
        .suspension_details
        .expect("the manual suspension on the sender must survive the upheld verdict");
    assert_eq!(
        suspension_details.reason, "unrelated harassment",
        "the downgrade must not replace the manual suspension"
    );
}

// I8a: a suspended attempter whose attempt reports are ALL resolved (and whose sanction
// record was cleared by an unrelated dismissal) must still have a working contest channel
#[test]
fn resolved_attempt_reports_remain_contestable() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let test_data = init_test_data(env, canister_ids, *controller);
    let scanner = random_principal();
    let file1 = random_file();
    let file2 = random_file();
    let (_, r1) = establish_pending_hash_match_report_from(env, canister_ids, &test_data, scanner, &file1, None);
    let (_, r2) =
        establish_pending_hash_match_report_from(env, canister_ids, &test_data, scanner, &file2, Some(&test_data.group_owner));

    attempt_blocked_upload(env, canister_ids, &test_data.reporter, &file1);
    attempt_blocked_upload(env, canister_ids, &test_data.reporter, &file2);
    assert_eq!(attempt_reports_for(env, &test_data, &test_data.reporter).len(), 2);

    // Upholding R1 as CSAM resolves its attempt report and hardens the attempter's suspension
    let resolve_response = client::user_index::resolve_moderation_report(
        env,
        test_data.moderator.principal,
        canister_ids.user_index,
        &user_index_canister::resolve_moderation_report::Args {
            report_index: r1,
            verdict: ModerationVerdict::UpheldAsCsam,
            urgent: None,
        },
    );
    assert!(matches!(resolve_response, UnitResult::Success), "{resolve_response:?}");
    tick_many(env, 10);

    // Dismissing R2 resolves the second attempt report and clears the sanction record (which
    // pointed at R2), but the upheld first attempt keeps the user suspended
    let resolve_response = client::user_index::resolve_moderation_report(
        env,
        test_data.moderator.principal,
        canister_ids.user_index,
        &user_index_canister::resolve_moderation_report::Args {
            report_index: r2,
            verdict: ModerationVerdict::Dismissed,
            urgent: None,
        },
    );
    assert!(matches!(resolve_response, UnitResult::Success), "{resolve_response:?}");
    tick_many(env, 10);

    let attempter_state =
        client::user_index::happy_path::current_user(env, test_data.reporter.principal, canister_ids.user_index);
    assert!(
        attempter_state.suspension_details.is_some(),
        "the upheld attempt must keep the attempter suspended"
    );

    // Every report is resolved and the record is gone - the contest must still land
    let contest_response = client::user_index::contest_moderation_sanction(
        env,
        test_data.reporter.principal,
        canister_ids.user_index,
        &types::Empty {},
    );
    assert!(matches!(contest_response, UnitResult::Success), "{contest_response:?}");
    tick_many(env, 5);
    assert!(
        moderation_notices(env, &test_data)
            .iter()
            .any(|t| t.contains("Human review requested") && t.contains("attribution")),
        "the resolved-attempt contest must post the attribution-focused moderator notice"
    );
}

// I14: releasing ONE claim while siblings retain the pin is a hash transition too - the
// sightings anchored to the released report must clear so the next attempt re-reports
// against a remaining claim instead of being silenced as a repeat
#[test]
fn claim_release_with_retained_pin_clears_sightings() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let test_data = init_test_data(env, canister_ids, *controller);
    let scanner = random_principal();
    let file = random_file();

    // Two independent uploads of the same bytes BEFORE any verdict (once the first verdict
    // lands, the pin refuses further uploads of the hash): dedup shares the blob and the
    // vault ends up holding two claims on the one hash
    client::user_index::happy_path::execute_protected_action(
        env,
        test_data.moderator.principal,
        test_data.operator2.principal,
        canister_ids.user_index,
        ProtectedAction::SetMediaScanConfig(user_index_canister::set_media_scan_config::Args {
            config: MediaScanConfig {
                enabled: true,
                scanners: vec![scanner],
            },
        }),
    );
    client::user_index::happy_path::execute_protected_action(
        env,
        test_data.moderator.principal,
        test_data.operator2.principal,
        canister_ids.user_index,
        ProtectedAction::SetVaultReviewers(user_index_canister::set_vault_reviewers::Args {
            user_ids: vec![test_data.moderator.user_id],
        }),
    );
    tick_many(env, 5);

    let mut message_ids = Vec::new();
    let mut blob_ids = Vec::new();
    for poster in [&test_data.sender, &test_data.group_owner] {
        let bucket =
            client::storage_index::happy_path::allocated_bucket(env, poster.principal, canister_ids.storage_index, &file);
        client::storage_bucket::happy_path::upload_file(
            env,
            poster.principal,
            bucket.canister_id,
            bucket.file_id,
            file.to_vec(),
            vec![poster.canister()],
            None,
        );
        let message_id = random_from_u128();
        send_image_message(
            env,
            poster,
            test_data.group_id,
            message_id,
            BlobReference {
                canister_id: bucket.canister_id,
                blob_id: bucket.file_id,
            },
        );
        message_ids.push(message_id);
        blob_ids.push(bucket.file_id);
        tick_many(env, 3);
    }

    let local_user_index = canister_ids.local_user_index(env, test_data.group_id);
    let local_user_index_canister::media_scan_jobs::Response::Success(jobs_result) = client::local_user_index::media_scan_jobs(
        env,
        scanner,
        local_user_index,
        &local_user_index_canister::media_scan_jobs::Args { from_job_index: 0 },
    );
    let verdicts: Vec<_> = message_ids
        .iter()
        .zip(blob_ids.iter())
        .map(|(message_id, blob_id)| {
            let job = jobs_result
                .jobs
                .iter()
                .find(|j| j.request.message_id == *message_id)
                .expect("a scan job should be queued for each image message");
            MediaScanVerdict {
                job_index: job.job_index,
                message_id: *message_id,
                outcomes: vec![MediaScanBlobOutcome::Match(MediaScanMatch {
                    provider: MediaScanProvider::PhotoDna,
                    blob_id: *blob_id,
                    source: "Test".to_string(),
                    violations: vec!["A1".to_string()],
                    match_distance: 181,
                    match_id: Some("7469692".to_string()),
                    hash: Some("dGVzdC1waG90b2RuYS1oYXNo".to_string()),
                })],
            }
        })
        .collect();
    let up_to_job_index = verdicts.iter().map(|v| v.job_index).max().unwrap();
    let submit_response = client::local_user_index::submit_media_scan_verdicts(
        env,
        scanner,
        local_user_index,
        &local_user_index_canister::submit_media_scan_verdicts::Args {
            verdicts,
            up_to_job_index,
        },
    );
    assert!(matches!(
        submit_response,
        local_user_index_canister::submit_media_scan_verdicts::Response::Success
    ));
    tick_many(env, 10);

    let reports = get_moderation_reports(env, &test_data);
    let report_for = |user_id| {
        reports
            .iter()
            .find(|r| r.sender == user_id && !r.is_blocked_attempt)
            .and_then(|r| r.report_index)
            .expect("each poster's match should create a moderation report")
    };
    let r1 = report_for(test_data.sender.user_id);
    let r2 = report_for(test_data.group_owner.user_id);
    assert_ne!(r1, r2);

    // An attempt lands against the first-arrived claim
    attempt_blocked_upload(env, canister_ids, &test_data.reporter, &file);
    let attempts = attempt_reports_for(env, &test_data, &test_data.reporter);
    assert_eq!(attempts.len(), 1);

    // Dismissing R1 releases its claim but R2 retains the pin
    let resolve_response = client::user_index::resolve_moderation_report(
        env,
        test_data.moderator.principal,
        canister_ids.user_index,
        &user_index_canister::resolve_moderation_report::Args {
            report_index: r1,
            verdict: ModerationVerdict::Dismissed,
            urgent: None,
        },
    );
    assert!(matches!(resolve_response, UnitResult::Success), "{resolve_response:?}");
    tick_many(env, 10);

    // The next attempt must produce a NEW attempt report anchored to the remaining claim,
    // not vanish into the stale sighting's repeat tally
    attempt_blocked_upload(env, canister_ids, &test_data.reporter, &file);
    let attempts = attempt_reports_for(env, &test_data, &test_data.reporter);
    assert_eq!(
        attempts.len(),
        2,
        "the attempt after the partial release must re-report against the remaining claim"
    );
}

// I1b: the detection suspension commits only after a c2c round trip (retried while the
// user canister is stopped); an Upheld verdict landing in that gap must not be overwritten
// back to indefinite when the stale detection job finally commits
#[test]
fn in_flight_detection_suspension_never_overwrites_an_upheld_downgrade() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let test_data = init_test_data(env, canister_ids, *controller);

    let message_id = random_from_u128();
    let message_text = format!("{TEST_MESSAGE_TEXT} {}", random_string());
    client::group::happy_path::send_text_message(
        env,
        &test_data.sender,
        test_data.group_id,
        None,
        &message_text,
        Some(message_id),
    );
    tick_many(env, 3);

    // Stop the sender's user canister so the detection suspension cannot commit and sits in
    // its retry loop
    stop_canister(env, test_data.sender.local_user_index, test_data.sender.canister());

    env.advance_time(Duration::from_secs(10));
    mock_moderation_outcalls(env, &message_text, &[CSAM_CATEGORY], 1);
    tick_many(env, 10);

    let reports = get_moderation_reports(env, &test_data);
    let report_index = reports[0].report_index.expect("proactive detection should carry an index");

    // The verdict lands while the detection suspension is still in flight
    let resolve_response = client::user_index::resolve_moderation_report(
        env,
        test_data.moderator.principal,
        canister_ids.user_index,
        &user_index_canister::resolve_moderation_report::Args {
            report_index,
            verdict: ModerationVerdict::Upheld,
            urgent: None,
        },
    );
    assert!(matches!(resolve_response, UnitResult::Success), "{resolve_response:?}");
    tick_many(env, 5);

    // Let both the stale detection job and the downgrade retry against the running canister
    start_canister(env, test_data.sender.local_user_index, test_data.sender.canister());
    for _ in 0..12 {
        env.advance_time(Duration::from_secs(31));
        tick_many(env, 5);
    }

    let sender_state = client::user_index::happy_path::current_user(env, test_data.sender.principal, canister_ids.user_index);
    let suspension_details = sender_state.suspension_details.expect("sender should remain suspended");
    assert!(
        matches!(suspension_details.action, SuspensionAction::Unsuspend(_)),
        "the stale detection suspension must not overwrite the downgrade: {:?}",
        suspension_details.action
    );
    wrapper.discard();
}

// I1b: a Dismissed verdict landing while the detection suspension is in flight must leave
// the user unsuspended - the stale job must not suspend a user whose report was cleared
#[test]
fn in_flight_detection_suspension_never_lands_after_a_dismissal() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let test_data = init_test_data(env, canister_ids, *controller);

    let message_id = random_from_u128();
    let message_text = format!("{TEST_MESSAGE_TEXT} {}", random_string());
    client::group::happy_path::send_text_message(
        env,
        &test_data.sender,
        test_data.group_id,
        None,
        &message_text,
        Some(message_id),
    );
    tick_many(env, 3);

    stop_canister(env, test_data.sender.local_user_index, test_data.sender.canister());

    env.advance_time(Duration::from_secs(10));
    mock_moderation_outcalls(env, &message_text, &[CSAM_CATEGORY], 1);
    tick_many(env, 10);

    let reports = get_moderation_reports(env, &test_data);
    let report_index = reports[0].report_index.expect("proactive detection should carry an index");

    let resolve_response = client::user_index::resolve_moderation_report(
        env,
        test_data.moderator.principal,
        canister_ids.user_index,
        &user_index_canister::resolve_moderation_report::Args {
            report_index,
            verdict: ModerationVerdict::Dismissed,
            urgent: None,
        },
    );
    assert!(matches!(resolve_response, UnitResult::Success), "{resolve_response:?}");
    tick_many(env, 5);

    start_canister(env, test_data.sender.local_user_index, test_data.sender.canister());
    for _ in 0..12 {
        env.advance_time(Duration::from_secs(31));
        tick_many(env, 5);
    }

    let sender_state = client::user_index::happy_path::current_user(env, test_data.sender.principal, canister_ids.user_index);
    assert!(
        sender_state.suspension_details.is_none(),
        "the stale detection suspension must not land after the dismissal: {:?}",
        sender_state.suspension_details
    );
    wrapper.discard();
}

fn send_captioned_image_message(
    env: &mut PocketIc,
    sender: &User,
    group_id: ChatId,
    message_id: types::MessageId,
    blob: BlobReference,
    caption: &str,
) {
    let send_response = client::group::send_message_v2(
        env,
        sender.principal,
        group_id.into(),
        &group_canister::send_message_v2::Args {
            thread_root_message_index: None,
            message_id,
            content: MessageContentInitial::Image(ImageContent {
                width: 100,
                height: 100,
                thumbnail_data: ThumbnailData("data:image/jpeg;base64,".to_string()),
                caption: Some(caption.to_string()),
                mime_type: "image/jpeg".to_string(),
                blob_reference: Some(blob),
            }),
            sender_name: sender.username(),
            sender_display_name: None,
            replies_to: None,
            mentioned: Vec::new(),
            forwarding: false,
            block_level_markdown: false,
            rules_accepted: None,
            message_filter_failed: None,
            new_achievement: false,
            og_previews: Vec::new(),
        },
    );
    assert!(
        matches!(send_response, group_canister::send_message_v2::Response::Success(_)),
        "{send_response:?}"
    );
}

fn send_image_message(env: &mut PocketIc, sender: &User, group_id: ChatId, message_id: types::MessageId, blob: BlobReference) {
    let send_response = client::group::send_message_v2(
        env,
        sender.principal,
        group_id.into(),
        &group_canister::send_message_v2::Args {
            thread_root_message_index: None,
            message_id,
            content: MessageContentInitial::Image(ImageContent {
                width: 100,
                height: 100,
                thumbnail_data: ThumbnailData("data:image/jpeg;base64,".to_string()),
                caption: None,
                mime_type: "image/jpeg".to_string(),
                blob_reference: Some(blob),
            }),
            sender_name: sender.username(),
            sender_display_name: None,
            replies_to: None,
            mentioned: Vec::new(),
            forwarding: false,
            block_level_markdown: false,
            rules_accepted: None,
            message_filter_failed: None,
            new_achievement: false,
            og_previews: Vec::new(),
        },
    );
    assert!(
        matches!(send_response, group_canister::send_message_v2::Response::Success(_)),
        "{send_response:?}"
    );
}

fn get_message_content(env: &PocketIc, reader: &User, group_id: ChatId, message_id: types::MessageId) -> MessageContent {
    let events = client::group::happy_path::events(env, reader, group_id, EventIndex::from(0), true, 100, 200);
    events
        .events
        .into_iter()
        .filter_map(|e| if let ChatEvent::Message(m) = e.event { Some(*m) } else { None })
        .find(|m| m.message_id == message_id)
        .expect("message should exist")
        .content
}

fn get_moderation_reports(env: &PocketIc, test_data: &TestData) -> Vec<ModerationReportContent> {
    let events = client::community::happy_path::events(
        env,
        &test_data.moderator,
        test_data.moderation_community_id,
        test_data.moderation_channel_id,
        EventIndex::from(0),
        true,
        100,
        200,
    );
    events
        .events
        .into_iter()
        .filter_map(|e| if let ChatEvent::Message(m) = e.event { Some(*m) } else { None })
        .filter_map(
            |m| {
                if let MessageContent::ModerationReport(report) = m.content { Some(report) } else { None }
            },
        )
        .collect()
}

#[test]
fn protected_action_cannot_be_confirmed_by_its_proposer() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let test_data = init_test_data(env, canister_ids, *controller);

    let response = client::user_index::propose_protected_action(
        env,
        test_data.moderator.principal,
        canister_ids.user_index,
        &user_index_canister::propose_protected_action::Args {
            action: ProtectedAction::SetVaultReviewers(user_index_canister::set_vault_reviewers::Args {
                user_ids: vec![test_data.moderator.user_id],
            }),
        },
    );
    let user_index_canister::propose_protected_action::Response::Success(result) = response else {
        panic!("'propose_protected_action' error: {response:?}");
    };

    // The proposer confirming their own proposal is the whole thing dual auth prevents
    let response = client::user_index::confirm_protected_action(
        env,
        test_data.moderator.principal,
        canister_ids.user_index,
        &user_index_canister::confirm_protected_action::Args {
            action_id: result.action_id,
        },
    );
    assert!(
        matches!(response, user_index_canister::confirm_protected_action::Response::Error(_)),
        "{response:?}"
    );

    // ... and the proposal survives, so a genuine second operator can still confirm it
    let response = client::user_index::confirm_protected_action(
        env,
        test_data.operator2.principal,
        canister_ids.user_index,
        &user_index_canister::confirm_protected_action::Args {
            action_id: result.action_id,
        },
    );
    assert!(
        matches!(response, user_index_canister::confirm_protected_action::Response::Success),
        "{response:?}"
    );
}

#[test]
fn legal_hold_blocks_destruction_of_vaulted_evidence() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let test_data = init_test_data(env, canister_ids, *controller);

    // A file message with no caption escalates for human review without a classifier call,
    // giving us a report which holds vaulted evidence
    let file_size = 1000u32;
    let blob_reference = client::storage_index::happy_path::upload_file(
        env,
        test_data.sender.principal,
        canister_ids.storage_index,
        file_size,
        vec![test_data.sender.canister()],
    );
    let message_id = random_from_u128();
    client::group::send_message_v2(
        env,
        test_data.sender.principal,
        test_data.group_id.into(),
        &group_canister::send_message_v2::Args {
            thread_root_message_index: None,
            message_id,
            content: MessageContentInitial::File(FileContent {
                name: random_string(),
                caption: None,
                mime_type: "application/octet-stream".to_string(),
                file_size,
                blob_reference: Some(blob_reference.clone()),
            }),
            sender_name: test_data.sender.username(),
            sender_display_name: None,
            replies_to: None,
            mentioned: Vec::new(),
            forwarding: false,
            block_level_markdown: false,
            rules_accepted: None,
            message_filter_failed: None,
            new_achievement: false,
            og_previews: Vec::new(),
        },
    );
    tick_many(env, 3);

    client::group::report_message(
        env,
        test_data.reporter.principal,
        test_data.group_id.into(),
        &group_canister::report_message::Args {
            thread_root_message_index: None,
            message_id,
            delete: false,
            csam: false,
        },
    );
    tick_many(env, 10);

    let reports = get_moderation_reports(env, &test_data);
    let report_index = reports[0].report_index.expect("report should carry an index");

    client::user_index::set_vault_legal_hold(
        env,
        test_data.moderator.principal,
        canister_ids.user_index,
        &user_index_canister::set_vault_legal_hold::Args {
            report_index,
            legal_hold: true,
            reference: "PRESERVATION-1".to_string(),
        },
    );

    // The proposal must be refused outright. Destruction used to override the hold, so once
    // the bucket started refusing it, moderators would have been told the evidence was
    // destroyed while it was in fact still vaulted
    let destroy = |le_ref: &str| user_index_canister::propose_protected_action::Args {
        action: ProtectedAction::DestroyVaultEvidence(user_index_canister::destroy_vault_evidence::Args {
            report_index,
            le_request_ref: le_ref.to_string(),
        }),
    };

    let response = client::user_index::propose_protected_action(
        env,
        test_data.moderator.principal,
        canister_ids.user_index,
        &destroy("DESTROY-1"),
    );
    assert!(
        matches!(response, user_index_canister::propose_protected_action::Response::Error(_)),
        "{response:?}"
    );

    // Clearing the hold - a separate, separately logged act - unblocks it
    client::user_index::set_vault_legal_hold(
        env,
        test_data.moderator.principal,
        canister_ids.user_index,
        &user_index_canister::set_vault_legal_hold::Args {
            report_index,
            legal_hold: false,
            reference: "PRESERVATION-1".to_string(),
        },
    );

    let response = client::user_index::propose_protected_action(
        env,
        test_data.moderator.principal,
        canister_ids.user_index,
        &destroy("DESTROY-1"),
    );
    assert!(
        matches!(response, user_index_canister::propose_protected_action::Response::Success(_)),
        "{response:?}"
    );
}

#[test]
fn clearing_a_hold_which_would_release_evidence_requires_two_operators() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let test_data = init_test_data(env, canister_ids, *controller);

    // A CSAM-asserted media report quarantines the evidence immediately, so a later dismissal
    // asks for it to be released - the state in which clearing a hold destroys evidence
    let file_size = 1000u32;
    let blob_reference = client::storage_index::happy_path::upload_file(
        env,
        test_data.sender.principal,
        canister_ids.storage_index,
        file_size,
        vec![test_data.sender.canister()],
    );
    let message_id = random_from_u128();
    client::group::send_message_v2(
        env,
        test_data.sender.principal,
        test_data.group_id.into(),
        &group_canister::send_message_v2::Args {
            thread_root_message_index: None,
            message_id,
            content: MessageContentInitial::File(FileContent {
                name: random_string(),
                caption: None,
                mime_type: "application/octet-stream".to_string(),
                file_size,
                blob_reference: Some(blob_reference.clone()),
            }),
            sender_name: test_data.sender.username(),
            sender_display_name: None,
            replies_to: None,
            mentioned: Vec::new(),
            forwarding: false,
            block_level_markdown: false,
            rules_accepted: None,
            message_filter_failed: None,
            new_achievement: false,
            og_previews: Vec::new(),
        },
    );
    tick_many(env, 3);

    client::group::report_message(
        env,
        test_data.reporter.principal,
        test_data.group_id.into(),
        &group_canister::report_message::Args {
            thread_root_message_index: None,
            message_id,
            delete: false,
            csam: true,
        },
    );
    tick_many(env, 10);

    let reports = get_moderation_reports(env, &test_data);
    let report_index = reports[0].report_index.expect("report should carry an index");

    let set_hold = |env: &mut PocketIc, legal_hold: bool| {
        client::user_index::set_vault_legal_hold(
            env,
            test_data.moderator.principal,
            canister_ids.user_index,
            &user_index_canister::set_vault_legal_hold::Args {
                report_index,
                legal_hold,
                reference: "PRESERVATION-1".to_string(),
            },
        )
    };

    assert!(matches!(set_hold(env, true), UnitResult::Success));

    // Dismissing the report asks for the evidence to be released; the hold defers it
    client::user_index::resolve_moderation_report(
        env,
        test_data.moderator.principal,
        canister_ids.user_index,
        &user_index_canister::resolve_moderation_report::Args {
            report_index,
            verdict: ModerationVerdict::Dismissed,
            urgent: None,
        },
    );
    tick_many(env, 5);

    // Clearing the hold now would PERFORM that release, destroying the evidence, so a single
    // operator can no longer do it directly - otherwise it would be a way around the dual
    // authorization on destruction
    assert!(matches!(set_hold(env, false), UnitResult::Error(_)));

    // It goes through propose/confirm like any other irreversible action
    let response = client::user_index::propose_protected_action(
        env,
        test_data.moderator.principal,
        canister_ids.user_index,
        &user_index_canister::propose_protected_action::Args {
            action: ProtectedAction::SetVaultLegalHold(user_index_canister::set_vault_legal_hold::Args {
                report_index,
                legal_hold: false,
                reference: "PRESERVATION-1".to_string(),
            }),
        },
    );
    let user_index_canister::propose_protected_action::Response::Success(result) = response else {
        panic!("'propose_protected_action' error: {response:?}");
    };

    let response = client::user_index::confirm_protected_action(
        env,
        test_data.operator2.principal,
        canister_ids.user_index,
        &user_index_canister::confirm_protected_action::Args {
            action_id: result.action_id,
        },
    );
    assert!(
        matches!(response, user_index_canister::confirm_protected_action::Response::Success),
        "{response:?}"
    );
    tick_many(env, 5);

    // Setting a hold, and clearing one with nothing pending, stay single-actor
    assert!(matches!(set_hold(env, true), UnitResult::Success));
    assert!(matches!(set_hold(env, false), UnitResult::Success));
}

#[test]
fn a_holds_protection_extends_to_sibling_reports_sharing_the_blob() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let test_data = init_test_data(env, canister_ids, *controller);

    client::user_index::happy_path::execute_protected_action(
        env,
        test_data.moderator.principal,
        test_data.operator2.principal,
        canister_ids.user_index,
        ProtectedAction::SetVaultReviewers(user_index_canister::set_vault_reviewers::Args {
            user_ids: vec![test_data.moderator.user_id],
        }),
    );
    tick_many(env, 5);

    // The same blob carried by two messages, each CSAM-reported: one vault record (where the
    // hold lives), two reports (where the user_index tracks it). The hold checks must span
    // that mismatch or a sibling report becomes a way around them.
    let file_size = 1000u32;
    let blob_reference = client::storage_index::happy_path::upload_file(
        env,
        test_data.sender.principal,
        canister_ids.storage_index,
        file_size,
        vec![test_data.sender.canister()],
    );
    let mut message_ids = Vec::new();
    for _ in 0..2 {
        let message_id = random_from_u128();
        let send_response = client::group::send_message_v2(
            env,
            test_data.sender.principal,
            test_data.group_id.into(),
            &group_canister::send_message_v2::Args {
                thread_root_message_index: None,
                message_id,
                content: MessageContentInitial::File(FileContent {
                    name: random_string(),
                    caption: None,
                    mime_type: "application/octet-stream".to_string(),
                    file_size,
                    blob_reference: Some(blob_reference.clone()),
                }),
                sender_name: test_data.sender.username(),
                sender_display_name: None,
                replies_to: None,
                mentioned: Vec::new(),
                forwarding: false,
                block_level_markdown: false,
                rules_accepted: None,
                message_filter_failed: None,
                new_achievement: false,
                og_previews: Vec::new(),
            },
        );
        assert!(
            matches!(send_response, group_canister::send_message_v2::Response::Success(_)),
            "{send_response:?}"
        );
        message_ids.push(message_id);
    }
    tick_many(env, 3);

    for message_id in &message_ids {
        let report_response = client::group::report_message(
            env,
            test_data.reporter.principal,
            test_data.group_id.into(),
            &group_canister::report_message::Args {
                thread_root_message_index: None,
                message_id: *message_id,
                delete: false,
                csam: true,
            },
        );
        assert!(matches!(report_response, UnitResult::Success));
        tick_many(env, 10);
    }

    let reports = get_moderation_reports(env, &test_data);
    let report_index_for = |reports: &[ModerationReportContent], message_id| {
        reports
            .iter()
            .find(|r| r.message_id == message_id)
            .and_then(|r| r.report_index)
            .expect("report should exist with an index")
    };
    let held_report = report_index_for(&reports, message_ids[0]);
    let sibling_report = report_index_for(&reports, message_ids[1]);
    assert_ne!(held_report, sibling_report);

    let dismiss = |env: &mut PocketIc, report_index: u64| {
        client::user_index::resolve_moderation_report(
            env,
            test_data.moderator.principal,
            canister_ids.user_index,
            &user_index_canister::resolve_moderation_report::Args {
                report_index,
                verdict: ModerationVerdict::Dismissed,
                urgent: None,
            },
        )
    };

    // The first report is dismissed BEFORE any hold exists: its evidence claim is released,
    // but the record survives on the sibling's claim, so nothing is deferred and nothing is
    // marked release-pending anywhere
    let response = dismiss(env, held_report);
    assert!(matches!(response, UnitResult::Success), "{response:?}");
    tick_many(env, 10);

    // The preservation request arrives afterwards (law enforcement does not track internal
    // verdicts) and is applied via the already-dismissed report
    let hold_response = client::user_index::set_vault_legal_hold(
        env,
        test_data.moderator.principal,
        canister_ids.user_index,
        &user_index_canister::set_vault_legal_hold::Args {
            report_index: held_report,
            legal_hold: true,
            reference: "PRESERVATION-1".to_string(),
        },
    );
    assert!(matches!(hold_response, UnitResult::Success), "{hold_response:?}");

    // Destruction proposed via the SIBLING report must be refused: the bucket's hold is on
    // the blob record, so it would refuse the destruction there, after the confirm alert had
    // already reported it done
    let destroy_response = client::user_index::propose_protected_action(
        env,
        test_data.moderator.principal,
        canister_ids.user_index,
        &user_index_canister::propose_protected_action::Args {
            action: ProtectedAction::DestroyVaultEvidence(user_index_canister::destroy_vault_evidence::Args {
                report_index: sibling_report,
                le_request_ref: "DESTROY-1".to_string(),
            }),
        },
    );
    assert!(
        matches!(
            destroy_response,
            user_index_canister::propose_protected_action::Response::Error(_)
        ),
        "{destroy_response:?}"
    );

    // Dismissing the sibling releases the LAST evidence claim, so the bucket wants to release
    // the record physically and the hold defers it. The release was requested via a report
    // which holds no hold itself - the case a per-report check misses
    let response = dismiss(env, sibling_report);
    assert!(matches!(response, UnitResult::Success), "{response:?}");
    tick_many(env, 10);

    // The hold defers the release: the evidence must still be vaulted
    let fetch_chunk = |env: &mut PocketIc| {
        client::storage_bucket::vault_file_chunk(
            env,
            test_data.moderator.principal,
            blob_reference.canister_id,
            &storage_bucket_canister::vault_file_chunk::Args {
                file_id: blob_reference.blob_id,
                chunk_index: 0,
                vault_token: None,
            },
        )
    };
    assert!(matches!(
        fetch_chunk(env),
        storage_bucket_canister::vault_file_chunk::Response::Success(_)
    ));

    // Clearing the hold would perform that deferred release, so a single operator must be
    // refused even though the release was requested via the sibling report - this was the
    // shared-blob route around the dual authorization on destruction
    let clear_response = client::user_index::set_vault_legal_hold(
        env,
        test_data.moderator.principal,
        canister_ids.user_index,
        &user_index_canister::set_vault_legal_hold::Args {
            report_index: held_report,
            legal_hold: false,
            reference: "PRESERVATION-1".to_string(),
        },
    );
    assert!(matches!(clear_response, UnitResult::Error(_)), "{clear_response:?}");
    assert!(matches!(
        fetch_chunk(env),
        storage_bucket_canister::vault_file_chunk::Response::Success(_)
    ));

    // Two operators can clear it, which performs the deferred release
    client::user_index::happy_path::execute_protected_action(
        env,
        test_data.moderator.principal,
        test_data.operator2.principal,
        canister_ids.user_index,
        ProtectedAction::SetVaultLegalHold(user_index_canister::set_vault_legal_hold::Args {
            report_index: held_report,
            legal_hold: false,
            reference: "PRESERVATION-1".to_string(),
        }),
    );
    tick_many(env, 5);
    assert!(
        !matches!(
            fetch_chunk(env),
            storage_bucket_canister::vault_file_chunk::Response::Success(_)
        ),
        "the deferred release should have been performed when the hold was cleared"
    );
}

#[test]
fn protected_action_alerts_reach_operators_without_a_moderation_channel() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let test_data = init_test_data(env, canister_ids, *controller);

    // Unset the moderation channel, which is where alerts used to go. Setting the channel is
    // itself a protected action, so if alerts depended on it they would be invisible exactly
    // when the platform is least configured - and unmissable alerts are what makes "anyone can
    // reject a proposal" a real defence
    client::user_index::happy_path::execute_protected_action(
        env,
        test_data.moderator.principal,
        test_data.operator2.principal,
        canister_ids.user_index,
        ProtectedAction::SetInternalModerationChannel(user_index_canister::set_internal_moderation_channel::Args {
            channel: None,
        }),
    );
    tick_many(env, 5);

    let events_before = client::user::happy_path::events(
        env,
        &test_data.operator2,
        OPENCHAT_BOT_USER_ID,
        EventIndex::default(),
        true,
        1000,
        1000,
    )
    .events
    .len();

    let response = client::user_index::propose_protected_action(
        env,
        test_data.moderator.principal,
        canister_ids.user_index,
        &user_index_canister::propose_protected_action::Args {
            action: ProtectedAction::SetVaultReviewers(user_index_canister::set_vault_reviewers::Args {
                user_ids: vec![test_data.moderator.user_id],
            }),
        },
    );
    assert!(
        matches!(response, user_index_canister::propose_protected_action::Response::Success(_)),
        "{response:?}"
    );
    tick_many(env, 10);

    // The OTHER operator - the one who has to confirm or reject - is told directly
    let events = client::user::happy_path::events(
        env,
        &test_data.operator2,
        OPENCHAT_BOT_USER_ID,
        EventIndex::default(),
        true,
        1000,
        1000,
    )
    .events;
    assert!(events.len() > events_before, "expected a new OpenChat bot message");

    let alerted = events.iter().any(|e| match &e.event {
        ChatEvent::Message(m) => match &m.content {
            MessageContent::Text(t) => t.text.contains("Protected action") && t.text.contains("proposed"),
            _ => false,
        },
        _ => false,
    });
    assert!(alerted, "the proposal alert did not reach the operator");
}

#[test]
fn invalid_protected_actions_are_rejected_at_proposal_time() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let test_data = init_test_data(env, canister_ids, *controller);

    let propose = |env: &mut PocketIc, action: ProtectedAction| {
        client::user_index::propose_protected_action(
            env,
            test_data.moderator.principal,
            canister_ids.user_index,
            &user_index_canister::propose_protected_action::Args { action },
        )
    };

    // A blank API key is a mistake, not an instruction to switch detection off
    let response = propose(
        env,
        ProtectedAction::SetOpenAIApiKey(user_index_canister::set_openai_api_key::Args {
            api_key: Some("   ".to_string()),
        }),
    );
    assert!(
        matches!(response, user_index_canister::propose_protected_action::Response::Error(_)),
        "{response:?}"
    );

    // A reviewer who is not a platform moderator can never be applied, so the proposal must
    // not be queued in the first place
    let response = propose(
        env,
        ProtectedAction::SetVaultReviewers(user_index_canister::set_vault_reviewers::Args {
            user_ids: vec![test_data.sender.user_id],
        }),
    );
    assert!(
        matches!(response, user_index_canister::propose_protected_action::Response::Error(_)),
        "{response:?}"
    );

    // Destroying evidence for a report which does not exist
    let response = propose(
        env,
        ProtectedAction::DestroyVaultEvidence(user_index_canister::destroy_vault_evidence::Args {
            report_index: 9999,
            le_request_ref: "REF-1".to_string(),
        }),
    );
    assert!(
        matches!(response, user_index_canister::propose_protected_action::Response::Error(_)),
        "{response:?}"
    );

    // A hold with no reference
    let response = propose(
        env,
        ProtectedAction::SetVaultLegalHold(user_index_canister::set_vault_legal_hold::Args {
            report_index: 0,
            legal_hold: true,
            reference: "  ".to_string(),
        }),
    );
    assert!(
        matches!(response, user_index_canister::propose_protected_action::Response::Error(_)),
        "{response:?}"
    );

    // Nothing invalid made it into the queue
    let user_index_canister::protected_actions::Response::Success(result) =
        client::user_index::protected_actions(env, test_data.moderator.principal, canister_ids.user_index, &types::Empty {});
    let view: Value = serde_json::from_str(&result.json).unwrap();
    assert!(view["pending"].as_array().unwrap().is_empty(), "{}", result.json);
}

#[test]
fn a_second_proposal_of_the_same_kind_supersedes_the_first() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let test_data = init_test_data(env, canister_ids, *controller);

    let propose = |env: &mut PocketIc, key: &str| {
        let response = client::user_index::propose_protected_action(
            env,
            test_data.moderator.principal,
            canister_ids.user_index,
            &user_index_canister::propose_protected_action::Args {
                action: ProtectedAction::SetOpenAIApiKey(user_index_canister::set_openai_api_key::Args {
                    api_key: Some(key.to_string()),
                }),
            },
        );
        let user_index_canister::propose_protected_action::Response::Success(result) = response else {
            panic!("'propose_protected_action' error: {response:?}");
        };
        result
    };

    let first = propose(env, "key-one");
    assert!(!first.already_pending);

    // Re-proposing the identical action is idempotent - a double click must not queue a
    // second copy
    let repeat = propose(env, "key-one");
    assert!(repeat.already_pending);
    assert_eq!(repeat.action_id, first.action_id);

    // A different key of the same kind supersedes it, taking a new id
    let second = propose(env, "key-two");
    assert!(!second.already_pending);
    assert_ne!(second.action_id, first.action_id);

    // Confirming the superseded id fails, so a stale screen cannot apply the swapped payload
    let response = client::user_index::confirm_protected_action(
        env,
        test_data.operator2.principal,
        canister_ids.user_index,
        &user_index_canister::confirm_protected_action::Args {
            action_id: first.action_id,
        },
    );
    assert!(
        matches!(response, user_index_canister::confirm_protected_action::Response::Error(_)),
        "{response:?}"
    );

    // The surviving proposal still confirms normally
    let response = client::user_index::confirm_protected_action(
        env,
        test_data.operator2.principal,
        canister_ids.user_index,
        &user_index_canister::confirm_protected_action::Args {
            action_id: second.action_id,
        },
    );
    assert!(
        matches!(response, user_index_canister::confirm_protected_action::Response::Success),
        "{response:?}"
    );
}

#[test]
fn cancelled_protected_action_cannot_be_confirmed() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let test_data = init_test_data(env, canister_ids, *controller);

    let response = client::user_index::propose_protected_action(
        env,
        test_data.moderator.principal,
        canister_ids.user_index,
        &user_index_canister::propose_protected_action::Args {
            action: ProtectedAction::SetOpenAIApiKey(user_index_canister::set_openai_api_key::Args {
                api_key: Some("should-never-be-applied".to_string()),
            }),
        },
    );
    let user_index_canister::propose_protected_action::Response::Success(result) = response else {
        panic!("'propose_protected_action' error: {response:?}");
    };

    // Anyone can cancel - this is how a proposal made with a compromised key gets killed
    let response = client::user_index::cancel_protected_action(
        env,
        test_data.operator2.principal,
        canister_ids.user_index,
        &user_index_canister::cancel_protected_action::Args {
            action_id: result.action_id,
        },
    );
    assert!(
        matches!(response, user_index_canister::cancel_protected_action::Response::Success),
        "{response:?}"
    );

    let response = client::user_index::confirm_protected_action(
        env,
        test_data.operator2.principal,
        canister_ids.user_index,
        &user_index_canister::confirm_protected_action::Args {
            action_id: result.action_id,
        },
    );
    assert!(
        matches!(response, user_index_canister::confirm_protected_action::Response::Error(_)),
        "{response:?}"
    );
}

#[test]
fn protected_action_log_chains_and_omits_secrets() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let test_data = init_test_data(env, canister_ids, *controller);

    // init_test_data already executed two protected actions, one carrying the API key
    let user_index_canister::protected_actions::Response::Success(result) =
        client::user_index::protected_actions(env, test_data.moderator.principal, canister_ids.user_index, &types::Empty {});

    assert!(!result.json.contains("test-api-key"), "the API key must never enter the log");

    let view: Value = serde_json::from_str(&result.json).unwrap();
    let log = view["log"].as_array().unwrap();
    assert!(log.len() >= 4, "expected propose+confirm for both config actions: {log:?}");

    // Entry 0 opens the chain with the zero hash, and every later entry chains to its
    // predecessor - the property an auditor checks against the chain head in public metrics
    assert_eq!(log[0]["prev_hash"].as_str().unwrap(), "0".repeat(64));
    for pair in log.windows(2) {
        assert_eq!(pair[1]["prev_hash"], pair[0]["hash"]);
    }
}

// Plain-text notices (OC bot messages) posted into the internal moderation channel
fn get_moderation_notices(env: &PocketIc, test_data: &TestData) -> Vec<String> {
    let events = client::community::happy_path::events(
        env,
        &test_data.moderator,
        test_data.moderation_community_id,
        test_data.moderation_channel_id,
        EventIndex::from(0),
        true,
        100,
        200,
    );
    events
        .events
        .into_iter()
        .filter_map(|e| if let ChatEvent::Message(m) = e.event { Some(*m) } else { None })
        .filter_map(|m| if let MessageContent::Text(t) = m.content { Some(t.text) } else { None })
        .collect()
}

fn get_authority_reports(env: &PocketIc, test_data: &TestData, canister_ids: &CanisterIds) -> Value {
    let user_index_canister::authority_reports::Response::Success(result) =
        client::user_index::authority_reports(env, test_data.moderator.principal, canister_ids.user_index, &types::Empty {});
    serde_json::from_str(&result.json).unwrap()
}

fn init_test_data(env: &mut PocketIc, canister_ids: &CanisterIds, controller: Principal) -> TestData {
    // The moderator doubles as the platform operator which configures the moderation channel
    // and the API key
    let moderator = client::register_diamond_user(env, canister_ids, controller);
    let operator2 = client::register_diamond_user(env, canister_ids, controller);
    let group_owner = client::register_diamond_user(env, canister_ids, controller);
    let sender = client::register_user(env, canister_ids);
    let reporter = client::register_user(env, canister_ids);

    client::user_index::add_platform_moderator(
        env,
        controller,
        canister_ids.user_index,
        &user_index_canister::add_platform_moderator::Args {
            user_id: moderator.user_id,
        },
    );
    client::user_index::add_platform_operator(
        env,
        controller,
        canister_ids.user_index,
        &user_index_canister::add_platform_operator::Args {
            user_id: moderator.user_id,
        },
    );
    client::user_index::add_platform_operator(
        env,
        controller,
        canister_ids.user_index,
        &user_index_canister::add_platform_operator::Args {
            user_id: operator2.user_id,
        },
    );

    let moderation_community_id =
        client::user::happy_path::create_community(env, &moderator, &random_string(), false, vec![random_string()]);
    let moderation_channel_id = client::community::happy_path::create_channel(
        env,
        moderator.principal,
        moderation_community_id,
        false,
        random_string(),
    );

    client::user_index::happy_path::execute_protected_action(
        env,
        moderator.principal,
        operator2.principal,
        canister_ids.user_index,
        ProtectedAction::SetInternalModerationChannel(user_index_canister::set_internal_moderation_channel::Args {
            channel: Some(InternalModerationChannel {
                community_id: moderation_community_id,
                channel_id: moderation_channel_id,
            }),
        }),
    );
    client::user_index::happy_path::execute_protected_action(
        env,
        moderator.principal,
        operator2.principal,
        canister_ids.user_index,
        ProtectedAction::SetOpenAIApiKey(user_index_canister::set_openai_api_key::Args {
            api_key: Some("test-api-key".to_string()),
        }),
    );

    let group_id = client::user::happy_path::create_group(env, &group_owner, &random_string(), true, true);
    for user in [&sender, &reporter] {
        client::local_user_index::happy_path::join_group(
            env,
            user.principal,
            canister_ids.local_user_index(env, group_id),
            group_id,
        );
    }

    // Let the config + API key propagate to the local user indexes
    tick_many(env, 5);

    TestData {
        moderator,
        operator2,
        group_owner,
        sender,
        reporter,
        group_id,
        moderation_community_id,
        moderation_channel_id,
    }
}

struct TestData {
    moderator: User,
    // A second platform operator: the dual-authorized actions (#9136) need a confirmer who is
    // not the proposer
    operator2: User,
    group_owner: User,
    sender: User,
    reporter: User,
    group_id: ChatId,
    moderation_community_id: CommunityId,
    moderation_channel_id: ChannelId,
}

// ---------------------------------------------------------------------------------------------
// Automated NCA filing (the nca_reporter service path): a moderator opens a report-scoped
// filing window by minting a signed token pair; the service - authenticating with its
// registered principal AND the moderator's token - registers the on-chain attempt marker,
// exports the vaulted evidence, and records the filing. Here the "service" is simulated by
// calling with its principal directly.
// ---------------------------------------------------------------------------------------------

struct AutomatedFilingSetup {
    report_index: u64,
    blob_reference: BlobReference,
    service_principal: Principal,
}

// Designates the moderator as a vault reviewer, registers a service principal as the
// authority reporter, and produces an UpheldAsCsam report holding vaulted evidence
fn setup_automated_filing(env: &mut PocketIc, canister_ids: &CanisterIds, test_data: &TestData) -> AutomatedFilingSetup {
    client::user_index::happy_path::execute_protected_action(
        env,
        test_data.moderator.principal,
        test_data.operator2.principal,
        canister_ids.user_index,
        ProtectedAction::SetVaultReviewers(user_index_canister::set_vault_reviewers::Args {
            user_ids: vec![test_data.moderator.user_id],
        }),
    );
    let service_principal = random_principal();
    client::user_index::happy_path::execute_protected_action(
        env,
        test_data.moderator.principal,
        test_data.operator2.principal,
        canister_ids.user_index,
        ProtectedAction::SetAuthorityReporter(user_index_canister::set_authority_reporter::Args {
            principal: Some(service_principal),
        }),
    );
    // The reviewer set, the reporter principal and the OC public key all sync
    // user_index -> storage_index -> buckets
    tick_many(env, 10);

    let file_size = 1000u32;
    let blob_reference = client::storage_index::happy_path::upload_file(
        env,
        test_data.sender.principal,
        canister_ids.storage_index,
        file_size,
        vec![test_data.sender.canister()],
    );
    let message_id = random_from_u128();
    client::group::send_message_v2(
        env,
        test_data.sender.principal,
        test_data.group_id.into(),
        &group_canister::send_message_v2::Args {
            thread_root_message_index: None,
            message_id,
            content: MessageContentInitial::File(FileContent {
                name: random_string(),
                caption: None,
                mime_type: "application/octet-stream".to_string(),
                file_size,
                blob_reference: Some(blob_reference.clone()),
            }),
            sender_name: test_data.sender.username(),
            sender_display_name: None,
            replies_to: None,
            mentioned: Vec::new(),
            forwarding: false,
            block_level_markdown: false,
            rules_accepted: None,
            message_filter_failed: None,
            new_achievement: false,
            og_previews: Vec::new(),
        },
    );
    tick_many(env, 3);
    let report_response = client::group::report_message(
        env,
        test_data.reporter.principal,
        test_data.group_id.into(),
        &group_canister::report_message::Args {
            thread_root_message_index: None,
            message_id,
            delete: false,
            csam: false,
        },
    );
    assert!(matches!(report_response, UnitResult::Success));
    tick_many(env, 10);

    let reports = get_moderation_reports(env, test_data);
    let report_index = reports
        .iter()
        .filter_map(|r| r.report_index)
        .max()
        .expect("report should carry an index");
    let resolve_response = client::user_index::resolve_moderation_report(
        env,
        test_data.moderator.principal,
        canister_ids.user_index,
        &user_index_canister::resolve_moderation_report::Args {
            report_index,
            verdict: ModerationVerdict::UpheldAsCsam,
            urgent: None,
        },
    );
    assert!(matches!(resolve_response, UnitResult::Success));
    tick_many(env, 15);

    AutomatedFilingSetup {
        report_index,
        blob_reference,
        service_principal,
    }
}

fn mint_filing_tokens(
    env: &mut PocketIc,
    canister_ids: &CanisterIds,
    test_data: &TestData,
    report_index: u64,
) -> user_index_canister::authority_report_token::Response {
    client::user_index::authority_report_token(
        env,
        test_data.moderator.principal,
        canister_ids.user_index,
        &user_index_canister::authority_report_token::Args {
            report_index,
            priority: types::NcaPriority::P2,
            reporter: user_index_canister::authority_report_token::ReporterContact {
                first_name: "Jo".to_string(),
                last_name: "Bloggs".to_string(),
                phone: "7700900000".to_string(),
                country_calling_code: "+44".to_string(),
                email: "jo@example.com".to_string(),
            },
            ooh_call_acknowledged: true,
        },
    )
}

#[test]
fn automated_authority_filing_files_and_records_the_reference() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let test_data = init_test_data(env, canister_ids, *controller);
    let setup = setup_automated_filing(env, canister_ids, &test_data);

    // The moderator opens the filing window
    let user_index_canister::authority_report_token::Response::Success(tokens) =
        mint_filing_tokens(env, canister_ids, &test_data, setup.report_index)
    else {
        panic!("token minting should succeed");
    };

    // A random principal presenting the token is refused at ingress (inspect_message): the
    // export needs the registered service principal AND the moderator's token, not either
    // alone. The rejection surfaces as a panic in the test client.
    {
        let stranger = random_principal();
        let vault_token = tokens.vault_token.clone();
        let user_index = canister_ids.user_index;
        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            client::user_index::record_authority_report_attempt(
                env,
                stranger,
                user_index,
                &user_index_canister::record_authority_report_attempt::Args { vault_token },
            )
        }));
        assert!(result.is_err(), "a stranger's attempt should be rejected at ingress");
    }

    // The service registers the attempt marker and receives the certified report data
    let attempt_response = client::user_index::record_authority_report_attempt(
        env,
        setup.service_principal,
        canister_ids.user_index,
        &user_index_canister::record_authority_report_attempt::Args {
            vault_token: tokens.vault_token.clone(),
        },
    );
    let user_index_canister::record_authority_report_attempt::Response::Success(data) = attempt_response else {
        panic!("attempt should be recorded: {attempt_response:?}");
    };
    assert_eq!(data.report_index, setup.report_index);
    assert_eq!(data.sender.user_id, test_data.sender.user_id);
    assert_eq!(data.files, vec![setup.blob_reference.clone()]);
    assert!(matches!(
        data.verdict.verdict,
        user_index_canister::resolve_moderation_report::ModerationVerdict::UpheldAsCsam
    ));
    assert!(matches!(
        data.detection,
        user_index_canister::record_authority_report_attempt::AuthorityReportDetection::UserReport { .. }
    ));

    // While the attempt is open: no second attempt, and no fresh token can be minted (D6)
    let second_attempt = client::user_index::record_authority_report_attempt(
        env,
        setup.service_principal,
        canister_ids.user_index,
        &user_index_canister::record_authority_report_attempt::Args {
            vault_token: tokens.vault_token.clone(),
        },
    );
    assert!(matches!(
        second_attempt,
        user_index_canister::record_authority_report_attempt::Response::Error(_)
    ));
    assert!(matches!(
        mint_filing_tokens(env, canister_ids, &test_data, setup.report_index),
        user_index_canister::authority_report_token::Response::Error(_)
    ));

    // The alert card shows the filing in flight
    tick_many(env, 5);
    let reports = get_moderation_reports(env, &test_data);
    let report = reports.iter().find(|r| r.report_index == Some(setup.report_index)).unwrap();
    assert!(
        matches!(report.authority_report, Some(types::AuthorityReportState::Attempting { .. })),
        "{:?}",
        report.authority_report
    );

    // The service (and only the service-with-token) can export the evidence
    let no_token = client::storage_bucket::vault_file_chunk(
        env,
        setup.service_principal,
        setup.blob_reference.canister_id,
        &storage_bucket_canister::vault_file_chunk::Args {
            file_id: setup.blob_reference.blob_id,
            chunk_index: 0,
            vault_token: None,
        },
    );
    assert!(matches!(
        no_token,
        storage_bucket_canister::vault_file_chunk::Response::NotAuthorized
    ));
    let chunk_response = client::storage_bucket::vault_file_chunk(
        env,
        setup.service_principal,
        setup.blob_reference.canister_id,
        &storage_bucket_canister::vault_file_chunk::Args {
            file_id: setup.blob_reference.blob_id,
            chunk_index: 0,
            vault_token: Some(tokens.vault_token.clone()),
        },
    );
    let storage_bucket_canister::vault_file_chunk::Response::Success(chunk) = chunk_response else {
        panic!("service export should succeed: {chunk_response:?}");
    };
    assert_eq!(chunk.total_size, 1000);

    // The export is a distinct chain-of-custody act, attributed to the moderator
    let storage_bucket_canister::vault_log::Response::Success(log) = client::storage_bucket::vault_log(
        env,
        test_data.moderator.principal,
        setup.blob_reference.canister_id,
        &storage_bucket_canister::vault_log::Args {
            start: 0,
            max: 100,
            file_id: Some(setup.blob_reference.blob_id),
        },
    ) else {
        panic!("reviewer should be able to read the vault log");
    };
    let export_entry = log
        .entries
        .iter()
        .find(|e| e.event.contains("exported to the authority reporting service"))
        .expect("export should be logged distinctly from viewing");
    assert_eq!(export_entry.user_id, Some(test_data.moderator.user_id));

    // The service records the filing (with both NCA references); the attempt marker is
    // consumed and the register + card flip to filed
    let filed_response = client::user_index::record_authority_report_filed(
        env,
        setup.service_principal,
        canister_ids.user_index,
        &user_index_canister::record_authority_report_filed::Args {
            report_index: setup.report_index,
            portal_reference: "SR-CSEAIRP-1257".to_string(),
            portal_reference_uuid: Some("65a20929-523a-455b-b159-e484d39dc49d".to_string()),
            urgent: false,
            unverified: false,
            vault_token: Some(tokens.vault_token.clone()),
        },
    );
    assert!(matches!(filed_response, UnitResult::Success), "{filed_response:?}");
    tick_many(env, 5);

    let register = get_authority_reports(env, &test_data, canister_ids);
    assert!(
        !register["due"]
            .as_array()
            .unwrap()
            .iter()
            .any(|r| r["report_index"] == setup.report_index)
    );
    assert!(register["attempts"].as_array().unwrap().is_empty());
    let filed_row = register["filed"]
        .as_array()
        .unwrap()
        .iter()
        .find(|r| r["report_index"] == setup.report_index)
        .expect("filed row should exist");
    assert_eq!(filed_row["portal_reference"], "SR-CSEAIRP-1257");
    assert_eq!(filed_row["portal_reference_uuid"], "65a20929-523a-455b-b159-e484d39dc49d");
    // The compliance record shows the out-of-hours call obligation was acknowledged
    assert_eq!(filed_row["ooh_call_acknowledged"], true);

    let reports = get_moderation_reports(env, &test_data);
    let report = reports.iter().find(|r| r.report_index == Some(setup.report_index)).unwrap();
    assert!(
        matches!(
            &report.authority_report,
            Some(types::AuthorityReportState::Filed { portal_reference }) if portal_reference == "SR-CSEAIRP-1257"
        ),
        "{:?}",
        report.authority_report
    );
}

#[test]
fn automated_filing_failure_clears_the_attempt_and_surfaces_the_contingency() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let test_data = init_test_data(env, canister_ids, *controller);
    let setup = setup_automated_filing(env, canister_ids, &test_data);

    let user_index_canister::authority_report_token::Response::Success(tokens) =
        mint_filing_tokens(env, canister_ids, &test_data, setup.report_index)
    else {
        panic!("token minting should succeed");
    };
    let attempt_response = client::user_index::record_authority_report_attempt(
        env,
        setup.service_principal,
        canister_ids.user_index,
        &user_index_canister::record_authority_report_attempt::Args {
            vault_token: tokens.vault_token.clone(),
        },
    );
    assert!(matches!(
        attempt_response,
        user_index_canister::record_authority_report_attempt::Response::Success(_)
    ));

    // The portal is down: the service clears the marker, classifying the failure. The report
    // must return to due (never silently unfiled), carrying the failure for the checklist.
    let clear_response = client::user_index::clear_authority_report_attempt(
        env,
        setup.service_principal,
        canister_ids.user_index,
        &user_index_canister::clear_authority_report_attempt::Args {
            report_index: setup.report_index,
            vault_token: Some(tokens.vault_token.clone()),
            failure: Some(
                user_index_canister::clear_authority_report_attempt::AuthorityReportFailure::Contingency {
                    error: "503 from the portal after 4 attempts".to_string(),
                },
            ),
        },
    );
    assert!(matches!(clear_response, UnitResult::Success), "{clear_response:?}");
    tick_many(env, 5);

    let register = get_authority_reports(env, &test_data, canister_ids);
    assert!(register["attempts"].as_array().unwrap().is_empty());
    let due_row = register["due"]
        .as_array()
        .unwrap()
        .iter()
        .find(|r| r["report_index"] == setup.report_index)
        .expect("the report must stay due until genuinely filed");
    assert!(
        due_row["last_failure"]["failure"]["Contingency"]["error"]
            .as_str()
            .unwrap()
            .contains("503")
    );

    // The card drives the moderator to the contingency checklist
    let reports = get_moderation_reports(env, &test_data);
    let report = reports.iter().find(|r| r.report_index == Some(setup.report_index)).unwrap();
    assert!(
        matches!(
            report.authority_report,
            Some(types::AuthorityReportState::ContingencyRequired { .. })
        ),
        "{:?}",
        report.authority_report
    );

    // ... and the portal-outage notice landed in the moderation channel
    let notices = get_moderation_notices(env, &test_data);
    assert!(
        notices
            .iter()
            .any(|n| n.contains("Automated NCA filing for report #") && n.contains("failed: 503")),
        "{notices:?}"
    );

    // A fresh filing window can now be opened for the retry
    assert!(matches!(
        mint_filing_tokens(env, canister_ids, &test_data, setup.report_index),
        user_index_canister::authority_report_token::Response::Success(_)
    ));
}

// ---------------------------------------------------------------------------------------------
// A suspended account must hold NO authority while the sanction stands, whatever roles it has:
// operator surfaces (dual-auth confirms), moderator surfaces (verdicts, suspensions), and the
// vault reviewer allowlist on the storage buckets must all stop honouring it - and come back
// when the suspension lifts.
// ---------------------------------------------------------------------------------------------
#[test]
fn suspended_account_loses_all_privileged_authority() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let test_data = init_test_data(env, canister_ids, *controller);
    let setup = setup_automated_filing(env, canister_ids, &test_data);

    // operator2 needs the moderator role to wield suspend/unsuspend in this test
    client::user_index::add_platform_moderator(
        env,
        *controller,
        canister_ids.user_index,
        &user_index_canister::add_platform_moderator::Args {
            user_id: test_data.operator2.user_id,
        },
    );
    tick_many(env, 3);

    // Reviewer access works before the suspension (chunk 0 of the vaulted blob)
    let chunk = client::storage_bucket::vault_file_chunk(
        env,
        test_data.moderator.principal,
        setup.blob_reference.canister_id,
        &storage_bucket_canister::vault_file_chunk::Args {
            file_id: setup.blob_reference.blob_id,
            chunk_index: 0,
            vault_token: None,
        },
    );
    assert!(matches!(
        chunk,
        storage_bucket_canister::vault_file_chunk::Response::Success(_)
    ));

    // A pending protected action proposed by operator2, awaiting the moderator's confirm
    let response = client::user_index::propose_protected_action(
        env,
        test_data.operator2.principal,
        canister_ids.user_index,
        &user_index_canister::propose_protected_action::Args {
            action: ProtectedAction::SetVaultReviewers(user_index_canister::set_vault_reviewers::Args {
                user_ids: vec![test_data.moderator.user_id],
            }),
        },
    );
    let user_index_canister::propose_protected_action::Response::Success(proposed) = response else {
        panic!("{response:?}");
    };

    // Suspend the moderator (who is also operator + vault reviewer)
    let suspend_response = client::user_index::suspend_user(
        env,
        test_data.operator2.principal,
        canister_ids.user_index,
        &user_index_canister::suspend_user::Args {
            user_id: test_data.moderator.user_id,
            duration: None,
            reason: "test".to_string(),
        },
    );
    assert!(matches!(
        suspend_response,
        user_index_canister::suspend_user::Response::Success
    ));
    tick_many(env, 10);

    // Operator surface: confirming a dual-auth action is refused at ingress
    {
        let principal = test_data.moderator.principal;
        let user_index = canister_ids.user_index;
        let action_id = proposed.action_id;
        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            client::user_index::confirm_protected_action(
                env,
                principal,
                user_index,
                &user_index_canister::confirm_protected_action::Args { action_id },
            )
        }));
        assert!(result.is_err(), "a suspended operator must not confirm protected actions");
    }

    // Moderator surface: returning verdicts is refused at ingress
    {
        let principal = test_data.moderator.principal;
        let user_index = canister_ids.user_index;
        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            client::user_index::resolve_moderation_report(
                env,
                principal,
                user_index,
                &user_index_canister::resolve_moderation_report::Args {
                    report_index: setup.report_index,
                    verdict: ModerationVerdict::Dismissed,
                    urgent: None,
                },
            )
        }));
        assert!(result.is_err(), "a suspended moderator must not return verdicts");
    }

    // Vault surface: the bucket allowlist was resynced without the suspended reviewer
    let chunk = client::storage_bucket::vault_file_chunk(
        env,
        test_data.moderator.principal,
        setup.blob_reference.canister_id,
        &storage_bucket_canister::vault_file_chunk::Args {
            file_id: setup.blob_reference.blob_id,
            chunk_index: 0,
            vault_token: None,
        },
    );
    assert!(
        matches!(chunk, storage_bucket_canister::vault_file_chunk::Response::NotAuthorized),
        "a suspended reviewer must not read quarantined material: {chunk:?}"
    );

    // Filing surface: no filing window can be opened by a suspended reviewer (refused at
    // ingress by inspect_message, which surfaces as a panic in the test client)
    {
        let report_index = setup.report_index;
        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            mint_filing_tokens(env, canister_ids, &test_data, report_index)
        }));
        let refused = match result {
            Err(_) => true,
            Ok(user_index_canister::authority_report_token::Response::Error(_)) => true,
            Ok(_) => false,
        };
        assert!(refused, "a suspended reviewer must not open a filing window");
    }

    // Unsuspension restores exactly what the account still holds
    let unsuspend_response = client::user_index::unsuspend_user(
        env,
        test_data.operator2.principal,
        canister_ids.user_index,
        &user_index_canister::unsuspend_user::Args {
            user_id: test_data.moderator.user_id,
        },
    );
    assert!(matches!(
        unsuspend_response,
        user_index_canister::unsuspend_user::Response::Success
    ));
    tick_many(env, 10);

    let chunk = client::storage_bucket::vault_file_chunk(
        env,
        test_data.moderator.principal,
        setup.blob_reference.canister_id,
        &storage_bucket_canister::vault_file_chunk::Args {
            file_id: setup.blob_reference.blob_id,
            chunk_index: 0,
            vault_token: None,
        },
    );
    assert!(
        matches!(chunk, storage_bucket_canister::vault_file_chunk::Response::Success(_)),
        "unsuspension must restore reviewer access: {chunk:?}"
    );
    let confirm = client::user_index::confirm_protected_action(
        env,
        test_data.moderator.principal,
        canister_ids.user_index,
        &user_index_canister::confirm_protected_action::Args {
            action_id: proposed.action_id,
        },
    );
    assert!(
        matches!(confirm, user_index_canister::confirm_protected_action::Response::Success),
        "{confirm:?}"
    );
}
