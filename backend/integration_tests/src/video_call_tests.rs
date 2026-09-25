use crate::env::{ENV, VIDEO_CALL_OPERATOR};
use crate::utils::{now_millis, tick_many};
use crate::{TestEnv, User, client};
use constants::HOUR_IN_MS;
use pocket_ic::PocketIc;
use std::ops::Deref;
use std::time::Duration;
use test_case::test_case;
use testing::rng::{random_from_u128, random_string};
use types::{Chat, ChatEvent, ChatId, MessageContent, OptionUpdate, UnitResult, UserId, VideoCallContent, VideoCallType};

#[test_case(true)]
#[test_case(false)]
fn start_join_end_video_call_in_direct_chat_succeeds(manually_end_video_call: bool) {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let user1 = client::register_diamond_user(env, canister_ids, *controller);
    let user2 = client::register_user(env, canister_ids);
    let message_id = random_from_u128();
    let max_duration = HOUR_IN_MS;

    client::user::happy_path::start_video_call(env, &user1, user2.user_id, message_id, Some(max_duration));

    tick_many(env, 3);

    let user1_chat = client::user::happy_path::initial_state(env, &user1)
        .direct_chats
        .summaries
        .into_iter()
        .find(|c| c.them == user2.user_id)
        .unwrap();
    assert_eq!(user1_chat.video_call_in_progress.unwrap().message_index, 0.into());
    assert_eq!(user1_chat.read_by_me_up_to, Some(0.into()));
    assert!(user1_chat.read_by_them_up_to.is_none());

    let chat1_event = client::user::happy_path::events_by_index(env, &user1, user2.user_id, vec![1.into()])
        .events
        .pop()
        .unwrap()
        .event;
    assert_is_video_message(chat1_event, |v| v.participants.len() == 1);

    let user2_chat = client::user::happy_path::initial_state(env, &user2)
        .direct_chats
        .summaries
        .into_iter()
        .find(|c| c.them == user1.user_id)
        .unwrap();
    assert_eq!(user2_chat.video_call_in_progress.unwrap().message_index, 0.into());
    assert_eq!(user2_chat.read_by_them_up_to, Some(0.into()));
    assert!(user2_chat.read_by_me_up_to.is_none());

    let chat2_event = client::user::happy_path::events_by_index(env, &user2, user1.user_id, vec![1.into()])
        .events
        .pop()
        .unwrap()
        .event;
    assert_is_video_message(chat2_event, |v| v.participants.len() == 1);

    client::user::happy_path::join_video_call(env, &user2, user1.user_id, message_id);

    env.tick();

    let chat1_event = client::user::happy_path::events_by_index(env, &user1, user2.user_id, vec![1.into()])
        .events
        .pop()
        .unwrap()
        .event;
    assert_is_video_message(chat1_event, |v| v.participants.len() == 2);

    let chat2_event = client::user::happy_path::events_by_index(env, &user2, user1.user_id, vec![1.into()])
        .events
        .pop()
        .unwrap()
        .event;
    assert_is_video_message(chat2_event, |v| v.participants.len() == 2);

    if manually_end_video_call {
        client::user::happy_path::end_video_call(env, user1.user_id, user2.user_id, message_id);
        client::user::happy_path::end_video_call(env, user2.user_id, user1.user_id, message_id);
    } else {
        env.advance_time(Duration::from_millis(max_duration));
        env.tick();
    }

    let user1_chat = client::user::happy_path::initial_state(env, &user1)
        .direct_chats
        .summaries
        .into_iter()
        .find(|c| c.them == user2.user_id)
        .unwrap();
    assert!(user1_chat.video_call_in_progress.is_none());

    let user2_chat = client::user::happy_path::initial_state(env, &user2)
        .direct_chats
        .summaries
        .into_iter()
        .find(|c| c.them == user1.user_id)
        .unwrap();
    assert!(user2_chat.video_call_in_progress.is_none());
}

#[test_case(true)]
#[test_case(false)]
fn start_join_end_video_call_in_group_chat_succeeds(manually_end_video_call: bool) {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let user1 = client::register_diamond_user(env, canister_ids, *controller);
    let user2 = client::register_user(env, canister_ids);
    let group = client::user::happy_path::create_group(env, &user1, random_string().as_str(), true, true);
    client::group::happy_path::join_group(env, user2.principal, group);

    let message_id = random_from_u128();
    let max_duration = HOUR_IN_MS;

    client::group::happy_path::start_video_call(env, &user1, group, message_id, Some(max_duration));

    let summary = client::group::happy_path::summary(env, user1.principal, group);
    assert!(summary.video_call_in_progress.is_some());

    let event = client::group::happy_path::events_by_index(env, &user1, group, vec![2.into()])
        .events
        .pop()
        .unwrap()
        .event;
    assert_is_video_message(event, |v| v.participants.len() == 1);

    client::group::happy_path::join_video_call(env, user2.principal, group, message_id);

    let event = client::group::happy_path::events_by_index(env, &user1, group, vec![2.into()])
        .events
        .pop()
        .unwrap()
        .event;
    assert_is_video_message(event, |v| v.participants.len() == 2);

    if manually_end_video_call {
        client::group::happy_path::end_video_call(env, group, message_id);
    } else {
        env.advance_time(Duration::from_millis(max_duration));
        env.tick();
    }

    let summary = client::group::happy_path::summary(env, user1.principal, group);
    assert!(summary.video_call_in_progress.is_none());
}

fn assert_is_video_message<F: FnOnce(&VideoCallContent) -> bool>(event: ChatEvent, predicate: F) {
    if let ChatEvent::Message(m) = &event
        && let MessageContent::VideoCall(v) = &m.content
    {
        if predicate(v) {
            return;
        } else {
            panic!("Event is a video call but does not satisfy predicate. Content: {v:?}");
        }
    }
    panic!("Event is not a video call. Event: {event:?}");
}

fn start_direct_call(
    env: &mut PocketIc,
    caller: &User,
    callee: UserId,
    call_type: VideoCallType,
    audio_only: Option<bool>,
) -> UnitResult {
    client::user::start_video_call_v2(
        env,
        VIDEO_CALL_OPERATOR,
        callee.canister_id(),
        &user_canister::start_video_call_v2::Args {
            user_id: callee,
            message_id: random_from_u128(),
            initiator: caller.user_id,
            initiator_username: caller.username(),
            initiator_display_name: None,
            initiator_avatar_id: None,
            max_duration: None,
            call_type,
            audio_only,
        },
    )
}

fn start_group_call(
    env: &mut PocketIc,
    caller: &User,
    group: ChatId,
    call_type: VideoCallType,
    audio_only: Option<bool>,
) -> UnitResult {
    client::group::start_video_call_v2(
        env,
        VIDEO_CALL_OPERATOR,
        group.into(),
        &group_canister::start_video_call_v2::Args {
            message_id: random_from_u128(),
            initiator: caller.user_id,
            initiator_username: caller.username(),
            initiator_display_name: None,
            max_duration: None,
            call_type,
            audio_only,
        },
    )
}

// #9455 invariant 1: a start request or a token request for a broadcast with `audio_only` is
// rejected, on the local user index and on the user, group and community canisters.
#[test]
fn invariant_1_audio_only_broadcast_is_rejected_everywhere() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let user1 = client::register_diamond_user(env, canister_ids, *controller);
    let user2 = client::register_user(env, canister_ids);
    let group = client::user::happy_path::create_group(env, &user1, random_string().as_str(), true, true);
    let community =
        client::user::happy_path::create_community(env, &user1, random_string().as_str(), true, vec![random_string()]);
    let channel = client::community::happy_path::create_channel(env, user1.principal, community, true, random_string());

    assert!(matches!(
        start_direct_call(env, &user1, user2.user_id, VideoCallType::Broadcast, Some(true)),
        UnitResult::Error(_)
    ));

    // the same group accepts a broadcast, so it is the pair that is refused
    assert!(matches!(
        start_group_call(env, &user1, group, VideoCallType::Broadcast, Some(true)),
        UnitResult::Error(_)
    ));
    assert!(matches!(
        start_group_call(env, &user1, group, VideoCallType::Broadcast, None),
        UnitResult::Success
    ));

    let start_channel_call = |env: &mut PocketIc, audio_only: Option<bool>| {
        client::community::start_video_call_v2(
            env,
            VIDEO_CALL_OPERATOR,
            community.into(),
            &community_canister::start_video_call_v2::Args {
                channel_id: channel,
                message_id: random_from_u128(),
                initiator: user1.user_id,
                initiator_username: user1.username(),
                initiator_display_name: None,
                max_duration: None,
                call_type: VideoCallType::Broadcast,
                audio_only,
            },
        )
    };
    assert!(matches!(start_channel_call(env, Some(true)), UnitResult::Error(_)));
    assert!(matches!(start_channel_call(env, None), UnitResult::Success));

    let request_token = |env: &mut PocketIc, audio_only: bool| {
        client::local_user_index::access_token_v2(
            env,
            user1.principal,
            canister_ids.local_user_index(env, group),
            &local_user_index_canister::access_token_v2::Args::StartVideoCall(
                local_user_index_canister::access_token_v2::StartVideoCallArgs {
                    chat: Chat::Group(group),
                    call_type: VideoCallType::Broadcast,
                    audio_only,
                },
            ),
        )
    };
    assert!(matches!(
        request_token(env, true),
        local_user_index_canister::access_token_v2::Response::NotAuthorized
    ));
    assert!(matches!(
        request_token(env, false),
        local_user_index_canister::access_token_v2::Response::Success(_)
    ));
}

// #9455 invariant 3: a call started as audio is reported as audio in the call message, in the
// chat summary's call in progress and in the caller's own copy of a direct call.
// #9455 invariant 4: a call started with no `audio_only` argument, which is what the video
// bridge in production sends, is a video call.
#[test_case(Some(true), true)]
#[test_case(Some(false), false)]
#[test_case(None, false)]
fn invariants_3_and_4_direct_call_reports_the_kind_it_was_started_as(audio_only: Option<bool>, expected: bool) {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let caller = client::register_diamond_user(env, canister_ids, *controller);
    let callee = client::register_user(env, canister_ids);

    // the chat has to exist before the call, or the updates answer reports it as a new chat
    // with a full summary and the call in progress update is never exercised
    client::user::happy_path::send_text_message(env, &caller, callee.user_id, random_string(), None);
    tick_many(env, 3);
    env.advance_time(Duration::from_secs(1));
    let before_call = now_millis(env) - 1;

    assert!(matches!(
        start_direct_call(env, &caller, callee.user_id, VideoCallType::Default, audio_only),
        UnitResult::Success
    ));

    tick_many(env, 3);

    // the callee's canister is told by the bridge, the caller's copy arrives user to user
    for (me, them) in [(&callee, caller.user_id), (&caller, callee.user_id)] {
        let chat = client::user::happy_path::initial_state(env, me)
            .direct_chats
            .summaries
            .into_iter()
            .find(|c| c.them == them)
            .unwrap();
        let in_progress = chat.video_call_in_progress.unwrap();
        assert_eq!(in_progress.audio_only, expected);
        assert_eq!(in_progress.call_type, VideoCallType::Default);

        let event = client::user::happy_path::events_by_index(env, me, them, vec![in_progress.event_index])
            .events
            .pop()
            .unwrap()
            .event;
        assert_is_video_message(event, |v| v.audio_only == expected && v.call_type == VideoCallType::Default);

        // after first load the website learns of a call from the updates answer, not the summary
        let updates = client::user::happy_path::updates(env, me, before_call).unwrap();
        let chat = updates
            .direct_chats
            .updated
            .into_iter()
            .find(|c| c.chat_id == them.into())
            .unwrap();
        let OptionUpdate::SetToSome(in_progress) = chat.video_call_in_progress else {
            panic!("expected the call in progress in the updates answer");
        };
        assert_eq!(in_progress.audio_only, expected);
    }
}

#[test_case(Some(true), true)]
#[test_case(None, false)]
fn invariants_3_and_4_group_call_reports_the_kind_it_was_started_as(audio_only: Option<bool>, expected: bool) {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let user1 = client::register_diamond_user(env, canister_ids, *controller);
    let group = client::user::happy_path::create_group(env, &user1, random_string().as_str(), false, true);
    let before_call = now_millis(env) - 1;

    assert!(matches!(
        start_group_call(env, &user1, group, VideoCallType::Default, audio_only),
        UnitResult::Success
    ));

    let in_progress = client::group::happy_path::summary(env, user1.principal, group)
        .video_call_in_progress
        .unwrap();
    assert_eq!(in_progress.audio_only, expected);
    assert_eq!(in_progress.call_type, VideoCallType::Default);

    let event = client::group::happy_path::events_by_index(env, &user1, group, vec![in_progress.event_index])
        .events
        .pop()
        .unwrap()
        .event;
    assert_is_video_message(event, |v| v.audio_only == expected && v.call_type == VideoCallType::Default);

    // after first load the website learns of a call from the updates answer, not the summary
    let updates = client::group::happy_path::summary_updates(env, user1.principal, group, before_call).unwrap();
    let OptionUpdate::SetToSome(in_progress) = updates.video_call_in_progress else {
        panic!("expected the call in progress in the updates answer");
    };
    assert_eq!(in_progress.audio_only, expected);
}

#[test_case(Some(true), true)]
#[test_case(None, false)]
fn invariants_3_and_4_channel_call_reports_the_kind_it_was_started_as(audio_only: Option<bool>, expected: bool) {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let user1 = client::register_diamond_user(env, canister_ids, *controller);
    let community =
        client::user::happy_path::create_community(env, &user1, random_string().as_str(), true, vec![random_string()]);
    let channel = client::community::happy_path::create_channel(env, user1.principal, community, false, random_string());

    let response = client::community::start_video_call_v2(
        env,
        VIDEO_CALL_OPERATOR,
        community.into(),
        &community_canister::start_video_call_v2::Args {
            channel_id: channel,
            message_id: random_from_u128(),
            initiator: user1.user_id,
            initiator_username: user1.username(),
            initiator_display_name: None,
            max_duration: None,
            call_type: VideoCallType::Default,
            audio_only,
        },
    );
    assert!(matches!(response, UnitResult::Success));

    let in_progress = client::community::happy_path::channel_summary(env, &user1, community, channel)
        .video_call_in_progress
        .unwrap();
    assert_eq!(in_progress.audio_only, expected);
    assert_eq!(in_progress.call_type, VideoCallType::Default);

    let event = client::community::happy_path::events_by_index(env, &user1, community, channel, vec![in_progress.event_index])
        .events
        .pop()
        .unwrap()
        .event;
    assert_is_video_message(event, |v| v.audio_only == expected && v.call_type == VideoCallType::Default);
}

// #9455 invariant 9: only a broadcast can start in a public group or in a public channel of a
// public community. An audio call is refused there exactly as a video call is.
#[test_case(None)]
#[test_case(Some(true))]
fn invariant_9_only_a_broadcast_starts_in_a_public_chat(audio_only: Option<bool>) {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let user1 = client::register_diamond_user(env, canister_ids, *controller);
    let group = client::user::happy_path::create_group(env, &user1, random_string().as_str(), true, true);
    let community =
        client::user::happy_path::create_community(env, &user1, random_string().as_str(), true, vec![random_string()]);
    let channel = client::community::happy_path::create_channel(env, user1.principal, community, true, random_string());

    assert!(matches!(
        start_group_call(env, &user1, group, VideoCallType::Default, audio_only),
        UnitResult::Error(_)
    ));

    let response = client::community::start_video_call_v2(
        env,
        VIDEO_CALL_OPERATOR,
        community.into(),
        &community_canister::start_video_call_v2::Args {
            channel_id: channel,
            message_id: random_from_u128(),
            initiator: user1.user_id,
            initiator_username: user1.username(),
            initiator_display_name: None,
            max_duration: None,
            call_type: VideoCallType::Default,
            audio_only,
        },
    );
    assert!(matches!(response, UnitResult::Error(_)));
}

// #9455 invariant 3, second sentence, and invariant 4: canisters upgrade over days, so every
// message that gained `audio_only` crosses between a canister on this release and one on the
// previous release, in both directions. The "previous" shapes below are frozen copies of the
// types as they were before audio calls. Do not update them when the real types change.
// #9559 invariant 17: the participant token the local user index signs for a decline or a
// native leave carries its own claim type, the caller and the chat, and is signed only for a
// member of the chat. The video bridge scopes on that claim type: a join token joins and
// nothing else, so a widening of the join token can never widen a decline or a leave.
#[test]
fn invariant_17_participant_token_names_the_caller_and_chat_under_its_own_claim_type() {
    use jwt_simple::algorithms::{ECDSAP256PublicKeyLike, ES256PublicKey};
    use serde::Deserialize;
    use types::{CLAIM_TYPE_VIDEO_CALL_PARTICIPANT, CanisterId};

    #[derive(Deserialize)]
    struct ParticipantTokenClaims {
        claim_type: String,
        user_id: UserId,
        chat_id: Chat,
        local_user_index: Option<CanisterId>,
    }

    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();
    env.set_time(std::time::SystemTime::now().into());

    let member = client::register_diamond_user(env, canister_ids, *controller);
    let outsider = client::register_user(env, canister_ids);
    let group = client::user::happy_path::create_group(env, &member, random_string().as_str(), true, true);
    tick_many(env, 3);

    let local_user_index = canister_ids.local_user_index(env, group);
    let args = local_user_index_canister::access_token_v2::Args::VideoCallParticipant(
        local_user_index_canister::access_token_v2::VideoCallParticipantArgs {
            chat: Chat::Group(group),
        },
    );

    let token = client::local_user_index::happy_path::access_token(env, &member, local_user_index, &args);
    let public_key =
        ES256PublicKey::from_pem(&client::user_index::happy_path::public_key(env, canister_ids.user_index)).unwrap();
    let claims: ParticipantTokenClaims = public_key.verify_token(&token, None).unwrap().custom;
    assert_eq!(claims.claim_type, CLAIM_TYPE_VIDEO_CALL_PARTICIPANT);
    assert_eq!(claims.user_id, member.user_id);
    assert_eq!(claims.chat_id, Chat::Group(group));
    assert_eq!(claims.local_user_index, Some(local_user_index));

    assert!(matches!(
        client::local_user_index::access_token_v2(env, outsider.principal, local_user_index, &args),
        local_user_index_canister::access_token_v2::Response::NotAuthorized
    ));
}

mod mixed_releases {
    use serde::{Deserialize, Serialize};
    use types::{Chat, MessageId, MessageIndex, Milliseconds, StartVideoCallClaims, UserId, VideoCallType};

    #[derive(Serialize, Deserialize)]
    struct PreviousUserToUserStartVideoCallArgs {
        message_id: MessageId,
        message_index: MessageIndex,
        max_duration: Option<Milliseconds>,
    }

    #[derive(Serialize, Deserialize)]
    struct PreviousStartVideoCallClaims {
        user_id: UserId,
        chat_id: Chat,
        call_type: VideoCallType,
        is_diamond: bool,
    }

    #[derive(Serialize, Deserialize)]
    struct PreviousCanIssueStartVideoCallArgs {
        call_type: VideoCallType,
        initiator: UserId,
        is_diamond: bool,
    }

    fn user_id() -> UserId {
        candid::Principal::from_slice(&[1]).into()
    }

    #[test]
    fn invariant_3_user_to_user_start_event_crosses_releases_both_ways() {
        // the callee's canister is on the previous release: the caller's copy is a video call
        let old = msgpack::serialize_then_unwrap(PreviousUserToUserStartVideoCallArgs {
            message_id: 1u64.into(),
            message_index: 2.into(),
            max_duration: None,
        });
        let decoded: user_canister::StartVideoCallArgs = msgpack::deserialize_then_unwrap(&old);
        assert!(!decoded.audio_only);

        // the caller's canister is on the previous release: it records a video call and nothing fails
        let new = msgpack::serialize_then_unwrap(user_canister::StartVideoCallArgs {
            message_id: 1u64.into(),
            message_index: 2.into(),
            max_duration: None,
            audio_only: true,
        });
        let decoded: PreviousUserToUserStartVideoCallArgs = msgpack::deserialize_then_unwrap(&new);
        assert_eq!(decoded.message_index, 2.into());
    }

    #[test]
    fn invariant_4_a_start_token_from_a_previous_local_user_index_is_a_video_call() {
        let old = serde_json::to_string(&PreviousStartVideoCallClaims {
            user_id: user_id(),
            chat_id: Chat::Direct(user_id().into()),
            call_type: VideoCallType::Default,
            is_diamond: false,
        })
        .unwrap();
        let decoded: StartVideoCallClaims = serde_json::from_str(&old).unwrap();
        assert!(!decoded.audio_only);
    }

    #[test]
    fn invariant_4_the_permission_check_crosses_releases_both_ways() {
        use types::c2c_can_issue_access_token::StartVideoCallArgs;

        let old = msgpack::serialize_then_unwrap(PreviousCanIssueStartVideoCallArgs {
            call_type: VideoCallType::Default,
            initiator: user_id(),
            is_diamond: false,
        });
        let decoded: StartVideoCallArgs = msgpack::deserialize_then_unwrap(&old);
        assert!(!decoded.audio_only);

        let new = msgpack::serialize_then_unwrap(StartVideoCallArgs {
            call_type: VideoCallType::Default,
            audio_only: true,
            initiator: user_id(),
            is_diamond: false,
        });
        let decoded: PreviousCanIssueStartVideoCallArgs = msgpack::deserialize_then_unwrap(&new);
        assert_eq!(decoded.call_type, VideoCallType::Default);
    }
}
