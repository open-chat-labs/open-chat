//! Native call push contract, open-chat #9456. Each test names the invariant it pins.
use crate::client::{local_user_index, notifications_index, user_index};
use crate::env::{ENV, VIDEO_CALL_OPERATOR};
use crate::utils::tick_many;
use crate::{CanisterIds, TestEnv, User, client};
use candid::Principal;
use pocket_ic::PocketIc;
use std::collections::HashMap;
use std::ops::Deref;
use std::time::Duration;
use testing::rng::{random_from_u128, random_string};
use types::{CanisterId, ChatId, FcmToken, MessageId, Milliseconds, NotificationEnvelope, UnitResult, UserId, VideoCallType};

struct Push {
    recipients: Vec<UserId>,
    data: HashMap<String, String>,
}

// Notifications are read from the local user index of the canister that sent them, and a
// test's user, group and community canisters can sit on different subnets. A feed reads from
// every local user index involved.
struct Feed {
    luis: Vec<CanisterId>,
}

impl Feed {
    fn new(env: &PocketIc, canister_ids: &CanisterIds, canisters: &[CanisterId]) -> Feed {
        let mut luis = Vec::new();
        for c in canisters {
            let lui = canister_ids.local_user_index(env, *c);
            if !luis.contains(&lui) {
                luis.push(lui);
            }
        }
        Feed { luis }
    }

    fn enable_call_push(&self, env: &mut PocketIc, canister_ids: &CanisterIds, controller: Principal) {
        self.set_call_push(env, canister_ids, controller, true);
    }

    // Test envs are pooled and a switch flipped by one test stays flipped for the next, so a
    // test that needs a state sets it rather than assuming it
    fn set_call_push(&self, env: &mut PocketIc, canister_ids: &CanisterIds, controller: Principal, enabled: bool) {
        let operator = client::register_user(env, canister_ids);
        user_index::happy_path::add_platform_operator(env, controller, canister_ids.user_index, operator.user_id);
        tick_many(env, 3);
        for lui in &self.luis {
            let response = local_user_index::set_call_push_enabled(
                env,
                operator.principal,
                *lui,
                &local_user_index_canister::set_call_push_enabled::Args { enabled },
            );
            assert!(matches!(response, UnitResult::Success));
        }
    }

    fn snapshot(&self, env: &PocketIc, controller: Principal) -> Vec<u64> {
        self.luis
            .iter()
            .map(|lui| local_user_index::happy_path::latest_notification_index(env, controller, *lui))
            .collect()
    }

    fn pushes_since(&self, env: &mut PocketIc, controller: Principal, snapshot: &[u64]) -> Vec<Push> {
        tick_many(env, 3);
        self.luis
            .iter()
            .zip(snapshot)
            .flat_map(|(lui, index)| {
                client::local_user_index::happy_path::notifications(env, controller, *lui, index + 1)
                    .notifications
                    .into_iter()
                    .filter_map(|n| match n.value {
                        NotificationEnvelope::User(e) => Some(Push {
                            recipients: e.recipients,
                            data: e.fcm_data.map(|d| d.as_data()).unwrap_or_default(),
                        }),
                        NotificationEnvelope::Bot(_) => None,
                    })
            })
            .collect()
    }
}

fn pushes_for(pushes: &[Push], user: UserId) -> Vec<&Push> {
    pushes.iter().filter(|p| p.recipients.contains(&user)).collect()
}

fn dismissals_for(pushes: &[Push], user: UserId) -> Vec<&Push> {
    pushes_for(pushes, user)
        .into_iter()
        .filter(|p| p.data.get("type").is_some_and(|t| t == "call_dismissed"))
        .collect()
}

fn dismissal_kinds(pushes: &[Push], user: UserId) -> Vec<String> {
    dismissals_for(pushes, user)
        .iter()
        .map(|p| p.data["dismissalKind"].clone())
        .collect()
}

fn register_phone_user(env: &mut PocketIc, canister_ids: &CanisterIds) -> User {
    let user = client::register_user(env, canister_ids);
    add_phone(env, canister_ids, &user);
    user
}

// A caller who starts calls. Diamond, so the call lasts, and on a phone, so dismissals reach them.
fn register_phone_caller(env: &mut PocketIc, canister_ids: &CanisterIds, controller: Principal) -> User {
    let user = client::register_diamond_user(env, canister_ids, controller);
    add_phone(env, canister_ids, &user);
    user
}

fn add_phone(env: &mut PocketIc, canister_ids: &CanisterIds, user: &User) {
    let response = notifications_index::add_fcm_token(
        env,
        user.principal,
        canister_ids.notifications_index,
        &notifications_index_canister::add_fcm_token::Args {
            fcm_token: FcmToken(random_string()),
        },
    );
    assert!(matches!(response, UnitResult::Success));
}

fn register_web_user(env: &mut PocketIc, canister_ids: &CanisterIds) -> User {
    let user = client::register_user(env, canister_ids);
    notifications_index::happy_path::push_subscription(
        env,
        user.principal,
        canister_ids.notifications_index,
        random_string(),
        random_string(),
        format!("https://{}.example/", random_string()),
    );
    user
}

fn start_direct_call(env: &mut PocketIc, caller: &User, callee: UserId, audio_only: bool) -> MessageId {
    start_direct_call_lasting(env, caller, callee, audio_only, None)
}

fn start_direct_call_lasting(
    env: &mut PocketIc,
    caller: &User,
    callee: UserId,
    audio_only: bool,
    max_duration: Option<Milliseconds>,
) -> MessageId {
    let message_id = random_from_u128();
    let response = client::user::start_video_call_v2(
        env,
        VIDEO_CALL_OPERATOR,
        callee.canister_id(),
        &user_canister::start_video_call_v2::Args {
            user_id: callee,
            message_id,
            initiator: caller.user_id,
            initiator_username: caller.username(),
            initiator_display_name: None,
            initiator_avatar_id: None,
            max_duration,
            call_type: VideoCallType::Default,
            audio_only: Some(audio_only),
        },
    );
    assert!(matches!(response, UnitResult::Success));
    message_id
}

fn end_direct_call(env: &mut PocketIc, a: UserId, b: UserId, message_id: MessageId) {
    client::user::happy_path::end_video_call(env, a, b, message_id);
    client::user::happy_path::end_video_call(env, b, a, message_id);
}

fn start_group_call(env: &mut PocketIc, caller: &User, group: ChatId, call_type: VideoCallType) -> MessageId {
    let message_id = random_from_u128();
    let response = client::group::start_video_call_v2(
        env,
        VIDEO_CALL_OPERATOR,
        group.into(),
        &group_canister::start_video_call_v2::Args {
            message_id,
            initiator: caller.user_id,
            initiator_username: caller.username(),
            initiator_display_name: None,
            max_duration: None,
            call_type,
            audio_only: None,
        },
    );
    assert!(matches!(response, UnitResult::Success));
    message_id
}

// #9456 invariants 4, 5, 9 and 10 in a direct call: the ring push names the call, only the
// user who joined is told they answered, they are told again at the end, the caller who was in
// the call is never told it ended, and an ordinary message carries no call fields.
#[test]
fn invariants_4_5_9_10_direct_call_that_is_answered() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let caller = register_phone_caller(env, canister_ids, *controller);
    let callee = register_phone_user(env, canister_ids);
    let feed = Feed::new(env, canister_ids, &[caller.canister(), callee.canister()]);
    feed.enable_call_push(env, canister_ids, *controller);
    client::user::happy_path::send_text_message(env, &caller, callee.user_id, random_string(), None);
    tick_many(env, 3);

    let index = feed.snapshot(env, *controller);
    let message_id = start_direct_call(env, &caller, callee.user_id, true);
    let pushes = feed.pushes_since(env, *controller, &index);
    let ring = pushes_for(&pushes, callee.user_id);
    assert_eq!(ring.len(), 1);
    assert_eq!(ring[0].data["type"], "direct");
    assert_eq!(ring[0].data["callMessageId"], message_id.to_string());
    // and the caller's own phone is never rung for a call they started (invariant 14)
    assert!(pushes_for(&pushes, caller.user_id).is_empty());
    assert_eq!(ring[0].data["callType"], "default");
    assert_eq!(ring[0].data["callAudioOnly"], "true");
    assert!(ring[0].data.contains_key("callStarted"));

    // an ordinary message carries no call fields, switch on or not
    let index = feed.snapshot(env, *controller);
    client::user::happy_path::send_text_message(env, &caller, callee.user_id, random_string(), None);
    let pushes = feed.pushes_since(env, *controller, &index);
    let text = pushes_for(&pushes, callee.user_id);
    assert_eq!(text.len(), 1);
    assert!(!text[0].data.contains_key("callMessageId"));

    // the callee answers: their devices, and only theirs, are told
    let index = feed.snapshot(env, *controller);
    client::user::happy_path::join_video_call(env, &callee, caller.user_id, message_id);
    let pushes = feed.pushes_since(env, *controller, &index);
    assert_eq!(dismissal_kinds(&pushes, callee.user_id), vec!["answered_elsewhere"]);
    assert!(dismissals_for(&pushes, caller.user_id).is_empty());
    assert_eq!(dismissals_for(&pushes, callee.user_id)[0].recipients, vec![callee.user_id]);
    assert_eq!(
        dismissals_for(&pushes, callee.user_id)[0].data["callMessageId"],
        message_id.to_string()
    );

    // the call ends: both were in it, so both are told they answered and nobody is told it ended
    let index = feed.snapshot(env, *controller);
    end_direct_call(env, caller.user_id, callee.user_id, message_id);
    let pushes = feed.pushes_since(env, *controller, &index);
    assert_eq!(dismissal_kinds(&pushes, callee.user_id), vec!["answered_elsewhere"]);
    assert_eq!(dismissal_kinds(&pushes, caller.user_id), vec!["answered_elsewhere"]);
}

// #9456 invariant 4: a user who never joined is told the call ended
#[test]
fn invariant_4_direct_call_that_is_not_answered_ends_as_ended() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let caller = register_phone_caller(env, canister_ids, *controller);
    let callee = register_phone_user(env, canister_ids);
    let feed = Feed::new(env, canister_ids, &[caller.canister(), callee.canister()]);
    feed.enable_call_push(env, canister_ids, *controller);

    let message_id = start_direct_call(env, &caller, callee.user_id, false);
    tick_many(env, 3);

    let index = feed.snapshot(env, *controller);
    end_direct_call(env, caller.user_id, callee.user_id, message_id);
    let pushes = feed.pushes_since(env, *controller, &index);
    assert_eq!(dismissal_kinds(&pushes, callee.user_id), vec!["ended"]);
    assert_eq!(dismissal_kinds(&pushes, caller.user_id), vec!["answered_elsewhere"]);
}

// #9456 invariant 2: a user who has muted the chat receives no start push and no ended push
#[test]
fn invariant_2_a_muted_chat_never_pushes_a_call() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let caller = register_phone_caller(env, canister_ids, *controller);
    let callee = register_phone_user(env, canister_ids);
    let feed = Feed::new(env, canister_ids, &[caller.canister(), callee.canister()]);
    feed.enable_call_push(env, canister_ids, *controller);
    client::user::happy_path::send_text_message(env, &caller, callee.user_id, random_string(), None);
    tick_many(env, 3);
    client::user::mute_notifications(
        env,
        callee.principal,
        callee.user_id.canister_id(),
        &user_canister::mute_notifications::Args {
            chat_id: caller.user_id.into(),
        },
    );

    let index = feed.snapshot(env, *controller);
    let message_id = start_direct_call(env, &caller, callee.user_id, false);
    end_direct_call(env, caller.user_id, callee.user_id, message_id);
    let pushes = feed.pushes_since(env, *controller, &index);
    assert!(pushes_for(&pushes, callee.user_id).is_empty());
}

// #9456 invariant 3: with the switch off, which is the default, the FCM data for a call start
// is what it was before this work and no dismissal leaves the local user index
#[test]
fn invariant_3_switch_off_means_no_call_fields_and_no_dismissals() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let caller = register_phone_caller(env, canister_ids, *controller);
    let callee = register_phone_user(env, canister_ids);
    let feed = Feed::new(env, canister_ids, &[caller.canister(), callee.canister()]);
    feed.set_call_push(env, canister_ids, *controller, false);
    tick_many(env, 3);

    let index = feed.snapshot(env, *controller);
    let message_id = start_direct_call(env, &caller, callee.user_id, true);
    client::user::happy_path::join_video_call(env, &callee, caller.user_id, message_id);
    end_direct_call(env, caller.user_id, callee.user_id, message_id);
    let pushes = feed.pushes_since(env, *controller, &index);

    let ring = pushes_for(&pushes, callee.user_id);
    assert_eq!(ring.len(), 1);
    assert_eq!(ring[0].data["type"], "direct");
    assert_eq!(ring[0].data["messageType"], "VideoCall");
    assert!(!ring[0].data.contains_key("callMessageId"));
    assert!(
        pushes
            .iter()
            .all(|p| p.data.get("type").is_none_or(|t| t != "call_dismissed"))
    );
}

// #9456 invariant 6, the local user index half: a user with only a web push subscription gets
// the start push but no dismissal, because a dismissal has no web push form
#[test]
fn invariant_6_a_web_only_user_gets_no_dismissal() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let caller = register_phone_caller(env, canister_ids, *controller);
    let callee = register_web_user(env, canister_ids);
    let feed = Feed::new(env, canister_ids, &[caller.canister(), callee.canister()]);
    feed.enable_call_push(env, canister_ids, *controller);

    let index = feed.snapshot(env, *controller);
    let message_id = start_direct_call(env, &caller, callee.user_id, false);
    end_direct_call(env, caller.user_id, callee.user_id, message_id);
    let pushes = feed.pushes_since(env, *controller, &index);
    assert_eq!(pushes_for(&pushes, callee.user_id).len(), 1);
    assert!(dismissals_for(&pushes, callee.user_id).is_empty());
}

// #9456 invariant 1, the local user index half: a small private group rings, and a call in a
// public group, a broadcast, a channel or a private group of more than eight does not
#[test]
fn invariant_1_only_small_private_groups_ring() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let caller = register_phone_caller(env, canister_ids, *controller);
    let member = register_phone_user(env, canister_ids);
    let feed = Feed::new(env, canister_ids, &[caller.canister(), member.canister()]);
    feed.enable_call_push(env, canister_ids, *controller);

    let private_group = client::user::happy_path::create_group(env, &caller, &random_string(), false, true);
    client::local_user_index::happy_path::add_users_to_group(
        env,
        &caller,
        canister_ids.local_user_index(env, private_group),
        private_group,
        vec![(member.user_id, member.principal)],
    );
    let public_group = client::user::happy_path::create_group(env, &caller, &random_string(), true, true);
    client::group::happy_path::join_group(env, member.principal, public_group);
    let community = client::user::happy_path::create_community(env, &caller, &random_string(), true, vec![random_string()]);
    let channel = client::community::happy_path::create_channel(env, caller.principal, community, true, random_string());
    client::community::happy_path::join_channel(env, member.principal, community, channel);
    // joining a public group or channel mutes it by default, and a muted chat never pushes
    let response = client::group::toggle_mute_notifications(
        env,
        member.principal,
        public_group.into(),
        &group_canister::toggle_mute_notifications::Args {
            mute: Some(false),
            mute_at_everyone: None,
        },
    );
    assert!(matches!(response, UnitResult::Success));
    let response = client::community::toggle_mute_notifications(
        env,
        member.principal,
        community.into(),
        &community_canister::toggle_mute_notifications::Args {
            channel_id: Some(channel),
            mute: Some(false),
            mute_at_everyone: None,
        },
    );
    assert!(matches!(response, UnitResult::Success));
    tick_many(env, 3);

    let index = feed.snapshot(env, *controller);
    let small = start_group_call(env, &caller, private_group, VideoCallType::Default);
    let pushes = feed.pushes_since(env, *controller, &index);
    let ring = pushes_for(&pushes, member.user_id);
    assert_eq!(ring.len(), 1);
    assert_eq!(ring[0].data["callMessageId"], small.to_string());

    let index = feed.snapshot(env, *controller);
    start_group_call(env, &caller, public_group, VideoCallType::Broadcast);
    let response = client::community::start_video_call_v2(
        env,
        VIDEO_CALL_OPERATOR,
        community.into(),
        &community_canister::start_video_call_v2::Args {
            channel_id: channel,
            message_id: random_from_u128(),
            initiator: caller.user_id,
            initiator_username: caller.username(),
            initiator_display_name: None,
            max_duration: None,
            call_type: VideoCallType::Broadcast,
            audio_only: None,
        },
    );
    assert!(matches!(response, UnitResult::Success));
    let pushes = feed.pushes_since(env, *controller, &index);
    let others = pushes_for(&pushes, member.user_id);
    assert_eq!(others.len(), 2);
    assert!(others.iter().all(|p| !p.data.contains_key("callMessageId")));

    // nine members is one too many
    let more: Vec<_> = (0..7).map(|_| client::register_user(env, canister_ids)).collect();
    client::local_user_index::happy_path::add_users_to_group(
        env,
        &caller,
        canister_ids.local_user_index(env, private_group),
        private_group,
        more.iter().map(|u| (u.user_id, u.principal)).collect(),
    );
    // ending the call now that the group has nine members: the dismissal names nine, and the
    // policy applied to that drops it (invariant 12). Phones ring until their own timeout.
    let index = feed.snapshot(env, *controller);
    client::group::happy_path::end_video_call(env, private_group, small);
    let pushes = feed.pushes_since(env, *controller, &index);
    assert!(dismissals_for(&pushes, member.user_id).is_empty());
    assert!(dismissals_for(&pushes, caller.user_id).is_empty());

    let index = feed.snapshot(env, *controller);
    start_group_call(env, &caller, private_group, VideoCallType::Default);
    let pushes = feed.pushes_since(env, *controller, &index);
    let ring = pushes_for(&pushes, member.user_id);
    assert_eq!(ring.len(), 1);
    assert!(!ring[0].data.contains_key("callMessageId"));
}

// #9456 invariants 4 and 5 in a group: a joiner is told they answered, and told again at the
// end; a member who never joined is told the call ended; nobody who joined is told it ended
#[test]
fn invariants_4_5_group_call_dismissals_follow_who_joined() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let caller = register_phone_caller(env, canister_ids, *controller);
    let joiner = register_phone_user(env, canister_ids);
    let bystander = register_phone_user(env, canister_ids);
    let feed = Feed::new(
        env,
        canister_ids,
        &[caller.canister(), joiner.canister(), bystander.canister()],
    );
    feed.enable_call_push(env, canister_ids, *controller);

    let group = client::user::happy_path::create_group(env, &caller, &random_string(), false, true);
    client::local_user_index::happy_path::add_users_to_group(
        env,
        &caller,
        canister_ids.local_user_index(env, group),
        group,
        vec![(joiner.user_id, joiner.principal), (bystander.user_id, bystander.principal)],
    );
    tick_many(env, 3);

    let message_id = start_group_call(env, &caller, group, VideoCallType::Default);
    tick_many(env, 3);

    let index = feed.snapshot(env, *controller);
    client::group::happy_path::join_video_call(env, joiner.principal, group, message_id);
    let pushes = feed.pushes_since(env, *controller, &index);
    assert_eq!(dismissal_kinds(&pushes, joiner.user_id), vec!["answered_elsewhere"]);
    assert!(dismissals_for(&pushes, bystander.user_id).is_empty());

    let index = feed.snapshot(env, *controller);
    client::group::happy_path::end_video_call(env, group, message_id);
    let pushes = feed.pushes_since(env, *controller, &index);
    assert_eq!(dismissal_kinds(&pushes, joiner.user_id), vec!["answered_elsewhere"]);
    assert_eq!(dismissal_kinds(&pushes, caller.user_id), vec!["answered_elsewhere"]);
    assert_eq!(dismissal_kinds(&pushes, bystander.user_id), vec!["ended"]);
}

// #9456 invariant 15: a call that ends by its own timer dismisses exactly as one the bridge
// ends. This is the path that stops a phone ringing when the bridge has died.
#[test]
fn invariant_15_a_call_that_times_out_dismisses_the_same_as_one_that_is_ended() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let caller = register_phone_caller(env, canister_ids, *controller);
    let callee = register_phone_user(env, canister_ids);
    let feed = Feed::new(env, canister_ids, &[caller.canister(), callee.canister()]);
    feed.enable_call_push(env, canister_ids, *controller);

    let max_duration: Milliseconds = 60_000;
    start_direct_call_lasting(env, &caller, callee.user_id, false, Some(max_duration));
    tick_many(env, 3);

    let index = feed.snapshot(env, *controller);
    env.advance_time(Duration::from_millis(max_duration));
    let pushes = feed.pushes_since(env, *controller, &index);
    assert_eq!(dismissal_kinds(&pushes, callee.user_id), vec!["ended"]);
    assert_eq!(dismissal_kinds(&pushes, caller.user_id), vec!["answered_elsewhere"]);
}
