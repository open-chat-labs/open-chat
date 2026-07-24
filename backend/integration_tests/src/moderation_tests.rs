use crate::env::ENV;
use crate::utils::{now_millis, tick_many};
use crate::{CanisterIds, TestEnv, User, client};
use candid::Principal;
use pocket_ic::PocketIc;
use pocket_ic::common::rest::{CanisterHttpReply, CanisterHttpResponse, MockCanisterHttpResponse};
use serde_json::{Value, json};
use std::ops::Deref;
use std::time::Duration;
use testing::rng::{random_from_u128, random_string};
use types::{
    ChannelId, ChatEvent, ChatId, CommunityId, EventIndex, MessageContent, ModerationReportContent, ModerationReportStatus,
    SuspensionAction, UnitResult,
};
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
    let register = get_authority_reports(env, &test_data, canister_ids);
    assert_eq!(register["due"].as_array().unwrap().len(), 1);
    assert_eq!(register["due"][0]["report_index"], report_index);

    let record_response = client::user_index::record_authority_report_filed(
        env,
        test_data.moderator.principal,
        canister_ids.user_index,
        &user_index_canister::record_authority_report_filed::Args {
            report_index,
            portal_reference: "CSEA-IRP-TEST-0001".to_string(),
            urgent: false,
            unverified: false,
        },
    );
    assert!(matches!(record_response, UnitResult::Success));

    let register = get_authority_reports(env, &test_data, canister_ids);
    assert!(register["due"].as_array().unwrap().is_empty());
    assert_eq!(register["filed"][0]["portal_reference"], "CSEA-IRP-TEST-0001");
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
            let results: Vec<Value> = inputs
                .iter()
                .map(
                    |input| {
                        if input_matches(input) { json!({ "categories": categories }) } else { json!({ "categories": {} }) }
                    },
                )
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

fn get_authority_reports(env: &PocketIc, test_data: &TestData, canister_ids: &CanisterIds) -> Value {
    let user_index_canister::authority_reports::Response::Success(result) =
        client::user_index::authority_reports(env, test_data.moderator.principal, canister_ids.user_index, &types::Empty {});
    serde_json::from_str(&result.json).unwrap()
}

fn init_test_data(env: &mut PocketIc, canister_ids: &CanisterIds, controller: Principal) -> TestData {
    // The moderator doubles as the platform operator which configures the moderation channel
    // and the API key
    let moderator = client::register_diamond_user(env, canister_ids, controller);
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

    let moderation_community_id =
        client::user::happy_path::create_community(env, &moderator, &random_string(), false, vec![random_string()]);
    let moderation_channel_id = client::community::happy_path::create_channel(
        env,
        moderator.principal,
        moderation_community_id,
        false,
        random_string(),
    );

    client::user_index::set_internal_moderation_channel(
        env,
        moderator.principal,
        canister_ids.user_index,
        &user_index_canister::set_internal_moderation_channel::Args {
            channel: Some(InternalModerationChannel {
                community_id: moderation_community_id,
                channel_id: moderation_channel_id,
            }),
        },
    );
    client::user_index::set_openai_api_key(
        env,
        moderator.principal,
        canister_ids.user_index,
        &user_index_canister::set_openai_api_key::Args {
            api_key: Some("test-api-key".to_string()),
        },
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
    group_owner: User,
    sender: User,
    reporter: User,
    group_id: ChatId,
    moderation_community_id: CommunityId,
    moderation_channel_id: ChannelId,
}
