use crate::env::ENV;
use crate::utils::{metrics, now_millis, tick_many, try_metrics};
use crate::{TestEnv, client, wasms};
use candid::Principal;
use oc_error_codes::OCErrorCode;
use pocket_ic::PocketIc;
use sha256::sha256;
use std::collections::BTreeMap;
use std::ops::Deref;
use std::time::Duration;
use testing::rng::{random_from_u128, random_principal, random_string};
use types::{
    Achievement, BuildVersion, CanisterId, CanisterWasm, Chat, ChatEvent, ChatId, DirectChatSummary, DirectChatSummaryUpdates,
    Document, Empty, EventsResponse, Message, MessageContent, MessageContentInitial, MessageId, MessageIndex, Milliseconds,
    OptionUpdate, PinNumberSettings, Reaction, TextContent, TimestampMillis, UnitResult, UpgradesFilter, UserId,
};
use user_canister::set_pin_number::PinNumberVerification;
use user_canister::{ChatInList, MessageActivity, MessageActivityEvent, NamedAccount, WalletConfig};

#[test]
fn create_then_upgrade_multi_user_canister() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let local_user_index = client::user_index::happy_path::user_registration_canister(env, canister_ids.user_index);

    let canister_id =
        client::user_index::happy_path::create_multi_user_canister(env, *controller, canister_ids.user_index, local_user_index);

    let status = env.canister_status(canister_id, Some(local_user_index)).unwrap();
    assert_eq!(status.module_hash, Some(sha256(&wasms::MULTI_USER.module).to_vec()));
    assert_eq!(wasm_version(env, canister_id), BuildVersion::min());
    assert_stable_memory_maps_initialised(env, canister_id);

    // The canister id -> LocalUserIndex mapping reaches the UserIndex over the idempotent event
    // queue rather than in the reply, so it takes a few rounds to arrive
    tick_many(env, 5);
    assert!(
        multi_user_canisters(env, canister_ids.user_index).contains(&(canister_id, local_user_index)),
        "MultiUser canister not registered against its LocalUserIndex"
    );

    let new_version = BuildVersion::new(0, 0, 1);
    client::user_index::happy_path::upgrade_multi_user_canister_wasm(
        env,
        *controller,
        canister_ids.user_index,
        CanisterWasm {
            version: new_version,
            module: wasms::MULTI_USER.module.clone(),
        },
    );
    wait_for_upgrade(env, canister_id, new_version);
    assert_stable_memory_maps_initialised(env, canister_id);
}

#[test]
fn users_created_in_multi_user_canister_are_addressed_by_indexed_user_id() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let local_user_index = client::user_index::happy_path::user_registration_canister(env, canister_ids.user_index);
    let canister_id =
        client::user_index::happy_path::create_multi_user_canister(env, *controller, canister_ids.user_index, local_user_index);

    let create_user = |env: &mut PocketIc, principal: Principal| {
        client::multi_user::c2c_create_user(
            env,
            local_user_index,
            canister_id,
            &multi_user_canister::c2c_create_user::Args {
                principal,
                username: random_string(),
                referred_by: None,
            },
        )
    };
    let bio = |env: &PocketIc, user_id: UserId| {
        env.query_call(
            canister_id,
            Principal::anonymous(),
            "bio_msgpack",
            msgpack::serialize_then_unwrap(user_canister::bio::Args { user_id }),
        )
        .map(|bytes| msgpack::deserialize_then_unwrap::<user_canister::bio::Response>(&bytes))
    };

    // Each user's id carries this canister's id plus their index, starting from 1
    let principals = [random_principal(), random_principal()];
    let user_ids: Vec<UserId> = principals
        .iter()
        .map(|principal| match create_user(env, *principal) {
            multi_user_canister::c2c_create_user::Response::Success(user_id) => user_id,
            response => panic!("{response:?}"),
        })
        .collect();
    for (i, user_id) in user_ids.iter().enumerate() {
        assert_eq!(user_id.canister_id(), canister_id);
        assert_eq!(user_id.index() as usize, i + 1);
        assert!(matches!(bio(env, *user_id), Ok(user_canister::bio::Response::Success(text)) if text.is_empty()));
    }
    assert_eq!(user_count(env, canister_id), 2);

    // A principal can only be registered once
    let duplicate = create_user(env, principals[0]);
    assert!(
        matches!(&duplicate, multi_user_canister::c2c_create_user::Response::Error(e) if e.matches_code(OCErrorCode::AlreadyRegistered)),
        "{duplicate:?}"
    );
    assert_eq!(user_count(env, canister_id), 2);

    // An index this canister has not assigned, another canister's user, or an id which carries no
    // index (so maps to index 0) is rejected
    assert!(bio(env, UserId::new_indexed(canister_id, 3)).is_err());
    assert!(bio(env, UserId::new_indexed(canister_ids.user_index, 1)).is_err());
    assert!(bio(env, canister_id.into()).is_err());

    // The users survive an upgrade
    client::user_index::happy_path::upgrade_multi_user_canister_wasm(
        env,
        *controller,
        canister_ids.user_index,
        CanisterWasm {
            version: BuildVersion::new(0, 0, 1),
            module: wasms::MULTI_USER.module.clone(),
        },
    );
    wait_for_upgrade(env, canister_id, BuildVersion::new(0, 0, 1));
    assert_eq!(user_count(env, canister_id), 2);
    assert!(matches!(bio(env, user_ids[1]), Ok(user_canister::bio::Response::Success(_))));
}

#[test]
fn users_in_the_same_multi_user_canister_each_hold_a_copy_of_their_direct_chat() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let local_user_index = client::user_index::happy_path::user_registration_canister(env, canister_ids.user_index);
    let canister_id =
        client::user_index::happy_path::create_multi_user_canister(env, *controller, canister_ids.user_index, local_user_index);

    let (a_principal, a) = create_user(env, local_user_index, canister_id);
    let (b_principal, b) = create_user(env, local_user_index, canister_id);

    // A's first message to B creates the chat for both of them, each with their own copy of it
    let message_id = random_from_u128();
    let sent = send_text_message(env, a_principal, canister_id, b, "hello", message_id);
    assert_eq!(sent.chat_id, b.into());
    assert_eq!(sent.message_index, 0.into());

    // B's copy has A's message without anything having been sent between canisters, and B replies
    let reply = send_text_message(env, b_principal, canister_id, a, "hi", random_from_u128());
    assert_eq!(reply.chat_id, a.into());
    assert_eq!(reply.message_index, 1.into());

    // Both copies hold the same messages
    let expected = vec![(a, "hello".to_string()), (b, "hi".to_string())];
    let a_events = events(env, a_principal, canister_id, a, b);
    let b_events = events(env, b_principal, canister_id, b, a);
    assert_eq!(messages(&a_events), expected);
    assert_eq!(messages(&b_events), expected);
    assert_eq!(a_events.latest_event_index, 2.into());
    assert_eq!(b_events.latest_event_index, 2.into());

    let by_index = client::multi_user::events_by_index(
        env,
        b_principal,
        canister_id,
        &user_canister::events_by_index::Args {
            user_id: b,
            them: a,
            thread_root_message_index: None,
            events: vec![2.into()],
            latest_known_update: None,
        },
    );
    let user_canister::events_by_index::Response::Success(by_index) = by_index else {
        panic!("{by_index:?}");
    };
    assert_eq!(messages(&by_index), vec![(b, "hi".to_string())]);

    let window = client::multi_user::events_window(
        env,
        a_principal,
        canister_id,
        &user_canister::events_window::Args {
            user_id: a,
            them: b,
            thread_root_message_index: None,
            mid_point: 0.into(),
            max_messages: 10,
            max_events: 10,
            latest_known_update: None,
        },
    );
    let user_canister::events_window::Response::Success(window) = window else {
        panic!("{window:?}");
    };
    assert_eq!(messages(&window), expected);

    // A message id can only be used once in a chat
    let duplicate =
        client::multi_user::send_message_v2(env, a_principal, canister_id, &send_message_args(b, "again", message_id));
    assert!(
        matches!(&duplicate, user_canister::send_message_v2::Response::Error(e) if e.matches_code(OCErrorCode::MessageIdAlreadyExists)),
        "{duplicate:?}"
    );

    // A message to a thread whose root does not exist is rejected rather than creating the thread
    let missing_thread = client::multi_user::send_message_v2(
        env,
        a_principal,
        canister_id,
        &user_canister::send_message_v2::Args {
            thread_root_message_index: Some(100.into()),
            ..send_message_args(b, "in a thread", random_from_u128())
        },
    );
    assert!(
        matches!(&missing_thread, user_canister::send_message_v2::Response::Error(e) if e.matches_code(OCErrorCode::ThreadNotFound)),
        "{missing_thread:?}"
    );

    // A recipient in another canister is not supported yet, but is an error rather than a trap
    let elsewhere: UserId = random_principal().into();
    let unsupported = client::multi_user::send_message_v2(
        env,
        a_principal,
        canister_id,
        &send_message_args(elsewhere, "hello?", random_from_u128()),
    );
    assert!(
        matches!(&unsupported, user_canister::send_message_v2::Response::Error(e) if e.matches_code(OCErrorCode::InvalidRequest)),
        "{unsupported:?}"
    );

    // A user's chats can only be read as that user by the user themselves or the LocalUserIndex
    let as_b = client::multi_user::events(env, b_principal, canister_id, &events_args(a, b));
    assert!(
        matches!(&as_b, user_canister::events::Response::Error(e) if e.matches_code(OCErrorCode::InitiatorNotAuthorized)),
        "{as_b:?}"
    );
    assert!(matches!(
        client::multi_user::events(env, local_user_index, canister_id, &events_args(a, b)),
        user_canister::events::Response::Success(_)
    ));
    assert!(
        env.query_call(
            canister_id,
            random_principal(),
            "events_msgpack",
            msgpack::serialize_then_unwrap(events_args(a, b)),
        )
        .is_err()
    );

    // A chat with yourself has a single copy
    let note = send_text_message(env, a_principal, canister_id, a, "note to self", random_from_u128());
    assert_eq!(note.chat_id, a.into());
    assert_eq!(note.message_index, 0.into());
    assert_eq!(
        messages(&events(env, a_principal, canister_id, a, a)),
        vec![(a, "note to self".to_string())]
    );
}

#[test]
fn a_user_who_deletes_a_direct_chat_gets_a_fresh_copy_when_messaged_again() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let local_user_index = client::user_index::happy_path::user_registration_canister(env, canister_ids.user_index);
    let canister_id =
        client::user_index::happy_path::create_multi_user_canister(env, *controller, canister_ids.user_index, local_user_index);

    let (a_principal, a) = create_user(env, local_user_index, canister_id);
    let (b_principal, b) = create_user(env, local_user_index, canister_id);

    send_text_message(env, a_principal, canister_id, b, "hello", random_from_u128());
    send_text_message(env, b_principal, canister_id, a, "hi", random_from_u128());

    // Deleting a chat the user doesn't have fails
    let missing = client::multi_user::delete_direct_chat(
        env,
        a_principal,
        canister_id,
        &delete_direct_chat_args(local_user_index.into()),
    );
    assert!(
        matches!(&missing, user_canister::delete_direct_chat::Response::Error(e) if e.matches_code(OCErrorCode::ChatNotFound)),
        "{missing:?}"
    );

    // A deletes their copy of the chat, whose stable memory entries are garbage collected without
    // touching B's copy
    delete_direct_chat(env, a_principal, canister_id, b);
    let deleted = client::multi_user::events(env, a_principal, canister_id, &events_args(a, b));
    assert!(
        matches!(&deleted, user_canister::events::Response::Error(e) if e.matches_code(OCErrorCode::ChatNotFound)),
        "{deleted:?}"
    );
    assert!(stable_memory_keys_to_garbage_collect(env, canister_id) > 0);
    env.advance_time(Duration::from_secs(15));
    tick_many(env, 3);
    assert_eq!(stable_memory_keys_to_garbage_collect(env, canister_id), 0);
    assert_eq!(
        messages(&events(env, b_principal, canister_id, b, a)),
        vec![(a, "hello".to_string()), (b, "hi".to_string())]
    );

    // B's next message gives A a fresh copy of the chat holding only that message, whose index
    // differs between the two copies
    let again = send_text_message(env, b_principal, canister_id, a, "still there?", random_from_u128());
    assert_eq!(again.message_index, 2.into());
    let a_events = events(env, a_principal, canister_id, a, b);
    assert_eq!(messages(&a_events), vec![(b, "still there?".to_string())]);
    assert_eq!(a_events.latest_event_index, 1.into());
    assert_eq!(messages(&events(env, b_principal, canister_id, b, a)).len(), 3);

    // A reading the message in their copy is seen by B at the index it has in theirs
    mark_read(env, a_principal, canister_id, b, 0.into());
    let b_summary = single_direct_chat_summary(initial_state(env, b_principal, canister_id));
    assert_eq!(b_summary.read_by_them_up_to, Some(2.into()));

    // Once both have deleted the chat, a fresh one between them starts from scratch for both
    delete_direct_chat(env, a_principal, canister_id, b);
    delete_direct_chat(env, b_principal, canister_id, a);
    let fresh = send_text_message(env, a_principal, canister_id, b, "fresh start", random_from_u128());
    assert_eq!(fresh.message_index, 0.into());
    let expected = vec![(a, "fresh start".to_string())];
    assert_eq!(messages(&events(env, a_principal, canister_id, a, b)), expected);
    assert_eq!(messages(&events(env, b_principal, canister_id, b, a)), expected);
}

#[test]
fn initial_state_and_updates_track_a_users_direct_chats() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let local_user_index = client::user_index::happy_path::user_registration_canister(env, canister_ids.user_index);
    let canister_id =
        client::user_index::happy_path::create_multi_user_canister(env, *controller, canister_ids.user_index, local_user_index);

    let (a_principal, a) = create_user(env, local_user_index, canister_id);
    let (b_principal, b) = create_user(env, local_user_index, canister_id);
    let a_chat = Chat::Direct(a.into());

    // A new user has no chats and nothing else yet
    let initial = initial_state(env, a_principal, canister_id);
    assert!(initial.direct_chats.summaries.is_empty());
    assert!(initial.pinned_chats.is_empty());
    assert!(!initial.suspended);
    assert_eq!(initial.local_user_index_canister_id, local_user_index);
    assert!(updates(env, a_principal, canister_id, initial.timestamp).is_none());

    // A's message to B shows up in both of their chat lists, read by A but not yet by B
    let before_message = initial.timestamp;
    env.advance_time(Duration::from_secs(1));
    let sent = send_text_message(env, a_principal, canister_id, b, "hello", random_from_u128());
    let a_summary = single_direct_chat_summary(initial_state(env, a_principal, canister_id));
    assert_eq!(a_summary.them, b);
    assert_eq!(a_summary.latest_event_index, sent.event_index);
    assert_eq!(a_summary.latest_message_index, Some(0.into()));
    assert_eq!(a_summary.read_by_me_up_to, Some(0.into()));
    assert_eq!(a_summary.read_by_them_up_to, None);
    assert!(a_summary.date_created >= before_message);
    let b_summary = single_direct_chat_summary(initial_state(env, b_principal, canister_id));
    assert_eq!(b_summary.them, a);
    assert_eq!(b_summary.read_by_me_up_to, None);
    assert_eq!(b_summary.read_by_them_up_to, Some(0.into()));
    assert_eq!(b_summary.latest_message.as_ref().map(|m| m.event.sender), Some(a));

    // A chat created since `updates_since` is reported as added, then nothing is until it changes
    let b_updates = updates(env, b_principal, canister_id, before_message).unwrap();
    assert_eq!(b_updates.direct_chats.added.len(), 1);
    assert_eq!(b_updates.direct_chats.added[0].them, a);
    assert!(b_updates.direct_chats.updated.is_empty());
    let after_message = b_updates.timestamp;
    assert!(updates(env, b_principal, canister_id, after_message).is_none());

    // B reading the message is passed on to A's copy of the chat, where A sees it as read by B
    env.advance_time(Duration::from_secs(1));
    mark_read(env, b_principal, canister_id, a, 0.into());
    let b_updates = single_direct_chat_update(updates(env, b_principal, canister_id, after_message).unwrap());
    assert_eq!(b_updates.chat_id, a.into());
    assert_eq!(b_updates.read_by_me_up_to, Some(0.into()));
    assert_eq!(b_updates.read_by_them_up_to, None);
    let a_updates = updates(env, a_principal, canister_id, after_message).unwrap();
    let after_read = a_updates.timestamp;
    let a_chat_updates = single_direct_chat_update(a_updates);
    assert_eq!(a_chat_updates.chat_id, b.into());
    assert_eq!(a_chat_updates.read_by_me_up_to, None);
    assert_eq!(a_chat_updates.read_by_them_up_to, Some(0.into()));

    // Reading further than the latest message is ignored rather than capped
    mark_read(env, b_principal, canister_id, a, 5.into());
    assert!(updates(env, b_principal, canister_id, after_read).is_none());

    // Muting, pinning and archiving are B's alone, and archiving a chat also unpins it
    env.advance_time(Duration::from_secs(1));
    let muted = client::multi_user::mute_notifications(
        env,
        b_principal,
        canister_id,
        &user_canister::mute_notifications::Args { chat_id: a.into() },
    );
    assert!(matches!(muted, user_canister::mute_notifications::Response::Success));
    let pinned = client::multi_user::pin_chat_v2(
        env,
        b_principal,
        canister_id,
        &user_canister::pin_chat_v2::Args {
            chat: ChatInList::Direct(a.into()),
        },
    );
    assert!(matches!(pinned, user_canister::pin_chat_v2::Response::Success), "{pinned:?}");
    let b_updates = updates(env, b_principal, canister_id, after_read).unwrap();
    let after_pin = b_updates.timestamp;
    assert_eq!(b_updates.pinned_chats, Some(vec![a_chat]));
    assert_eq!(single_direct_chat_update(b_updates).notifications_muted, Some(true));
    assert!(updates(env, a_principal, canister_id, after_read).is_none());
    assert_eq!(initial_state(env, b_principal, canister_id).pinned_chats, vec![a_chat]);

    env.advance_time(Duration::from_secs(1));
    let archived = client::multi_user::archive_unarchive_chats(
        env,
        b_principal,
        canister_id,
        &user_canister::archive_unarchive_chats::Args {
            to_archive: vec![a_chat, Chat::Direct(local_user_index.into())],
            to_unarchive: Vec::new(),
        },
    );
    assert!(
        matches!(&archived, user_canister::archive_unarchive_chats::Response::PartialSuccess(r) if r.chats_not_found == vec![Chat::Direct(local_user_index.into())]),
        "{archived:?}"
    );
    let unmuted = client::multi_user::unmute_notifications(
        env,
        b_principal,
        canister_id,
        &user_canister::mute_notifications::Args { chat_id: a.into() },
    );
    assert!(matches!(unmuted, user_canister::unmute_notifications::Response::Success));
    let b_updates = updates(env, b_principal, canister_id, after_pin).unwrap();
    let after_archive = b_updates.timestamp;
    assert_eq!(b_updates.pinned_chats, Some(Vec::new()));
    let b_chat_updates = single_direct_chat_update(b_updates);
    assert_eq!(b_chat_updates.archived, Some(true));
    assert_eq!(b_chat_updates.notifications_muted, Some(false));
    let b_summary = single_direct_chat_summary(initial_state(env, b_principal, canister_id));
    assert!(b_summary.archived);
    assert!(!b_summary.notifications_muted);

    // Unpinning a chat which isn't pinned, or archiving nothing which exists, changes nothing
    let unpinned = client::multi_user::unpin_chat_v2(
        env,
        b_principal,
        canister_id,
        &user_canister::unpin_chat_v2::Args {
            chat: ChatInList::Direct(a.into()),
        },
    );
    assert!(matches!(unpinned, user_canister::unpin_chat_v2::Response::Success));
    let nothing = client::multi_user::archive_unarchive_chats(
        env,
        b_principal,
        canister_id,
        &user_canister::archive_unarchive_chats::Args {
            to_archive: Vec::new(),
            to_unarchive: vec![Chat::Direct(local_user_index.into())],
        },
    );
    assert!(
        matches!(&nothing, user_canister::archive_unarchive_chats::Response::Error(e) if e.matches_code(OCErrorCode::NoChange)),
        "{nothing:?}"
    );
    assert!(updates(env, b_principal, canister_id, after_archive).is_none());

    // A deleting the chat is reported to A as removed
    env.advance_time(Duration::from_secs(1));
    delete_direct_chat(env, a_principal, canister_id, b);
    let a_updates = updates(env, a_principal, canister_id, after_archive).unwrap();
    assert_eq!(a_updates.direct_chats.removed, vec![b.into()]);
    assert!(a_updates.direct_chats.added.is_empty() && a_updates.direct_chats.updated.is_empty());
    assert!(initial_state(env, a_principal, canister_id).direct_chats.summaries.is_empty());
    assert!(updates(env, b_principal, canister_id, after_archive).is_none());

    // The chat comes back as added when B messages A again, as a fresh copy holding only the new
    // message, which is unread
    env.advance_time(Duration::from_secs(1));
    send_text_message(env, b_principal, canister_id, a, "still there?", random_from_u128());
    let a_updates = updates(env, a_principal, canister_id, after_archive).unwrap();
    assert_eq!(a_updates.direct_chats.removed, vec![b.into()]);
    assert_eq!(a_updates.direct_chats.added.len(), 1);
    assert_eq!(a_updates.direct_chats.added[0].read_by_me_up_to, None);
    assert_eq!(a_updates.direct_chats.added[0].latest_message_index, Some(0.into()));
}

#[test]
fn initial_state_and_updates_track_a_users_profile_blocked_users_favourites_and_wallet() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let local_user_index = client::user_index::happy_path::user_registration_canister(env, canister_ids.user_index);
    let canister_id =
        client::user_index::happy_path::create_multi_user_canister(env, *controller, canister_ids.user_index, local_user_index);

    let (a_principal, a) = create_user(env, local_user_index, canister_id);
    let (b_principal, b) = create_user(env, local_user_index, canister_id);
    let (_, c) = create_user(env, local_user_index, canister_id);

    let initial = initial_state(env, a_principal, canister_id);
    assert_eq!(initial.avatar_id, None);
    assert!(initial.blocked_users.is_empty());
    assert!(initial.favourite_chats.chats.is_empty());
    assert!(initial.favourite_chats.pinned.is_empty());
    assert!(matches!(initial.wallet_config, WalletConfig::Auto(_)));
    let start = initial.timestamp;

    // A's avatar, profile background and bio are visible to B through `public_profile`, and the
    // avatar id is reported through `updates`
    env.advance_time(Duration::from_secs(1));
    let avatar = document(100);
    let profile_background = document(200);
    set_avatar(env, a_principal, canister_id, Some(avatar.clone()));
    let response = client::multi_user::set_profile_background(
        env,
        a_principal,
        canister_id,
        &user_canister::set_profile_background::Args {
            profile_background: Some(profile_background.clone()),
        },
    );
    assert!(matches!(response, user_canister::set_profile_background::Response::Success));
    let response = client::multi_user::set_bio(
        env,
        a_principal,
        canister_id,
        &user_canister::set_bio::Args {
            text: "Hello".to_string(),
        },
    );
    assert!(matches!(response, user_canister::set_bio::Response::Success));

    let user_canister::public_profile::Response::Success(profile) = client::multi_user::public_profile(
        env,
        b_principal,
        canister_id,
        &user_canister::public_profile::Args { user_id: a },
    );
    assert_eq!(profile.avatar_id, Some(avatar.id));
    assert_eq!(profile.profile_background_id, Some(profile_background.id));
    assert_eq!(profile.bio, "Hello");
    assert!(profile.created <= start);
    let a_updates = updates(env, a_principal, canister_id, start).unwrap();
    let after_profile = a_updates.timestamp;
    assert_eq!(a_updates.avatar_id, OptionUpdate::SetToSome(avatar.id));
    assert_eq!(initial_state(env, a_principal, canister_id).avatar_id, Some(avatar.id));
    assert!(updates(env, b_principal, canister_id, start).is_none());

    // An oversized avatar is rejected, and removing the avatar is reported too
    env.advance_time(Duration::from_secs(1));
    let response = client::multi_user::set_avatar(
        env,
        a_principal,
        canister_id,
        &user_canister::set_avatar::Args {
            avatar: Some(document(1024 * 800 + 1)),
        },
    );
    assert!(
        matches!(&response, user_canister::set_avatar::Response::Error(e) if e.matches_code(OCErrorCode::AvatarTooBig)),
        "{response:?}"
    );
    assert!(updates(env, a_principal, canister_id, after_profile).is_none());
    set_avatar(env, a_principal, canister_id, None);
    let a_updates = updates(env, a_principal, canister_id, after_profile).unwrap();
    let after_avatar_removed = a_updates.timestamp;
    assert_eq!(a_updates.avatar_id, OptionUpdate::SetToNone);

    // Blocking B stops A messaging B, and is reported to A alone. A message from B goes into B's
    // copy of the chat but is dropped rather than delivered to A, as it is between User canisters.
    env.advance_time(Duration::from_secs(1));
    block_user(env, a_principal, canister_id, b);
    block_user(env, a_principal, canister_id, b);
    let a_updates = updates(env, a_principal, canister_id, after_avatar_removed).unwrap();
    let after_block = a_updates.timestamp;
    assert_eq!(a_updates.blocked_users, Some(vec![b]));
    assert_eq!(initial_state(env, a_principal, canister_id).blocked_users, vec![b]);
    assert!(updates(env, b_principal, canister_id, start).is_none());
    let response =
        client::multi_user::send_message_v2(env, a_principal, canister_id, &send_message_args(b, "hi", random_from_u128()));
    assert!(
        matches!(&response, user_canister::send_message_v2::Response::Error(e) if e.matches_code(OCErrorCode::TargetUserBlocked)),
        "{response:?}"
    );
    send_text_message(env, b_principal, canister_id, a, "hi", random_from_u128());
    assert_eq!(
        messages(&events(env, b_principal, canister_id, b, a)),
        vec![(b, "hi".to_string())]
    );
    assert!(initial_state(env, a_principal, canister_id).direct_chats.summaries.is_empty());
    assert!(updates(env, a_principal, canister_id, after_block).is_none());

    // Unblocking B is reported as the list of blocked users being empty, and A messaging B gives A
    // a copy of the chat without the message dropped while B was blocked
    env.advance_time(Duration::from_secs(1));
    let response = client::multi_user::unblock_user(
        env,
        a_principal,
        canister_id,
        &user_canister::unblock_user::Args { user_id: b },
    );
    assert!(matches!(response, user_canister::unblock_user::Response::Success));
    let a_updates = updates(env, a_principal, canister_id, after_block).unwrap();
    let after_unblock = a_updates.timestamp;
    assert_eq!(a_updates.blocked_users, Some(Vec::new()));
    send_text_message(env, a_principal, canister_id, b, "hi", random_from_u128());
    assert_eq!(
        messages(&events(env, a_principal, canister_id, a, b)),
        vec![(a, "hi".to_string())]
    );
    assert_eq!(
        messages(&events(env, b_principal, canister_id, b, a)),
        vec![(b, "hi".to_string()), (a, "hi".to_string())]
    );

    // Deleting a chat can block the other user at the same time, but not if there is no chat
    env.advance_time(Duration::from_secs(1));
    send_text_message(env, a_principal, canister_id, c, "hi", random_from_u128());
    let block_args = user_canister::delete_direct_chat::Args {
        user_id: c,
        block_user: true,
    };
    let response = client::multi_user::delete_direct_chat(env, a_principal, canister_id, &block_args);
    assert!(matches!(response, user_canister::delete_direct_chat::Response::Success));
    let response = client::multi_user::delete_direct_chat(env, a_principal, canister_id, &block_args);
    assert!(
        matches!(&response, user_canister::delete_direct_chat::Response::Error(e) if e.matches_code(OCErrorCode::ChatNotFound)),
        "{response:?}"
    );
    let a_updates = updates(env, a_principal, canister_id, after_unblock).unwrap();
    let after_delete = a_updates.timestamp;
    assert_eq!(a_updates.blocked_users, Some(vec![c]));
    assert_eq!(a_updates.direct_chats.removed, vec![c.into()]);

    // Favourite chats are added most recent first, and pinned favourites are reported separately
    // from the pinned direct chats
    env.advance_time(Duration::from_secs(1));
    let b_chat = Chat::Direct(b.into());
    let c_chat = Chat::Direct(c.into());
    manage_favourite_chats(env, a_principal, canister_id, vec![b_chat, c_chat], Vec::new());
    let a_updates = updates(env, a_principal, canister_id, after_delete).unwrap();
    let after_favourites = a_updates.timestamp;
    assert_eq!(a_updates.favourite_chats.chats, Some(vec![c_chat, b_chat]));
    assert_eq!(a_updates.favourite_chats.pinned, None);

    env.advance_time(Duration::from_secs(1));
    let response = client::multi_user::pin_chat_v2(
        env,
        a_principal,
        canister_id,
        &user_canister::pin_chat_v2::Args {
            chat: ChatInList::Favourite(b_chat),
        },
    );
    assert!(matches!(response, user_canister::pin_chat_v2::Response::Success));
    let a_updates = updates(env, a_principal, canister_id, after_favourites).unwrap();
    let after_pin = a_updates.timestamp;
    assert_eq!(a_updates.favourite_chats.chats, None);
    assert_eq!(a_updates.favourite_chats.pinned, Some(vec![b_chat]));
    assert_eq!(a_updates.pinned_chats, None);
    let initial = initial_state(env, a_principal, canister_id);
    assert_eq!(initial.favourite_chats.chats, vec![c_chat, b_chat]);
    assert_eq!(initial.favourite_chats.pinned, vec![b_chat]);
    assert!(initial.pinned_chats.is_empty());

    env.advance_time(Duration::from_secs(1));
    let response = client::multi_user::unpin_chat_v2(
        env,
        a_principal,
        canister_id,
        &user_canister::unpin_chat_v2::Args {
            chat: ChatInList::Favourite(b_chat),
        },
    );
    assert!(matches!(response, user_canister::unpin_chat_v2::Response::Success));
    manage_favourite_chats(env, a_principal, canister_id, Vec::new(), vec![c_chat]);
    let a_updates = updates(env, a_principal, canister_id, after_pin).unwrap();
    let after_unpin = a_updates.timestamp;
    assert_eq!(a_updates.favourite_chats.chats, Some(vec![b_chat]));
    assert_eq!(a_updates.favourite_chats.pinned, Some(Vec::new()));

    // Contacts are A's alone, and setting one to what it already is changes nothing
    let set_contact = |env: &mut PocketIc, nickname: OptionUpdate<String>| {
        client::multi_user::set_contact(
            env,
            a_principal,
            canister_id,
            &user_canister::set_contact::Args {
                contact: user_canister::set_contact::OptionalContact { user_id: b, nickname },
            },
        )
    };
    let response = set_contact(env, OptionUpdate::SetToSome("Bee".to_string()));
    assert!(
        matches!(response, user_canister::set_contact::Response::Success),
        "{response:?}"
    );
    let response = set_contact(env, OptionUpdate::NoChange);
    assert!(
        matches!(&response, user_canister::set_contact::Response::Error(e) if e.matches_code(OCErrorCode::NoChange)),
        "{response:?}"
    );
    let response = set_contact(env, OptionUpdate::SetToSome("B".to_string()));
    assert!(
        matches!(&response, user_canister::set_contact::Response::Error(e) if e.matches_code(OCErrorCode::NameTooShort)),
        "{response:?}"
    );
    assert_eq!(contacts(env, a_principal, canister_id), vec![(b, Some("Bee".to_string()))]);
    assert!(contacts(env, b_principal, canister_id).is_empty());
    let response = set_contact(env, OptionUpdate::SetToNone);
    assert!(
        matches!(response, user_canister::set_contact::Response::Success),
        "{response:?}"
    );
    assert!(contacts(env, a_principal, canister_id).is_empty());
    assert!(updates(env, a_principal, canister_id, after_unpin).is_none());

    // The wallet config is reported once changed
    env.advance_time(Duration::from_secs(1));
    let response = client::multi_user::configure_wallet(
        env,
        a_principal,
        canister_id,
        &user_canister::configure_wallet::Args {
            config: WalletConfig::Manual(user_canister::ManualWallet {
                tokens: vec![canister_ids.icp_ledger],
            }),
        },
    );
    assert!(matches!(response, user_canister::configure_wallet::Response::Success));
    let a_updates = updates(env, a_principal, canister_id, after_unpin).unwrap();
    assert!(
        matches!(&a_updates.wallet_config, Some(WalletConfig::Manual(w)) if w.tokens == vec![canister_ids.icp_ledger]),
        "{:?}",
        a_updates.wallet_config
    );
    assert!(matches!(
        initial_state(env, a_principal, canister_id).wallet_config,
        WalletConfig::Manual(_)
    ));
    assert!(updates(env, a_principal, canister_id, a_updates.timestamp).is_none());
}

fn document(len: usize) -> Document {
    Document {
        id: random_from_u128(),
        mime_type: "image/png".to_string(),
        data: (0..len).map(|i| i as u8).collect(),
    }
}

fn set_avatar(env: &mut PocketIc, sender: Principal, canister_id: CanisterId, avatar: Option<Document>) {
    let response = client::multi_user::set_avatar(env, sender, canister_id, &user_canister::set_avatar::Args { avatar });
    assert!(
        matches!(response, user_canister::set_avatar::Response::Success),
        "{response:?}"
    );
}

fn block_user(env: &mut PocketIc, sender: Principal, canister_id: CanisterId, user_id: UserId) {
    let response = client::multi_user::block_user(env, sender, canister_id, &user_canister::block_user::Args { user_id });
    assert!(
        matches!(response, user_canister::block_user::Response::Success),
        "{response:?}"
    );
}

fn manage_favourite_chats(
    env: &mut PocketIc,
    sender: Principal,
    canister_id: CanisterId,
    to_add: Vec<Chat>,
    to_remove: Vec<Chat>,
) {
    let response = client::multi_user::manage_favourite_chats(
        env,
        sender,
        canister_id,
        &user_canister::manage_favourite_chats::Args { to_add, to_remove },
    );
    assert!(
        matches!(response, user_canister::manage_favourite_chats::Response::Success),
        "{response:?}"
    );
}

// The user id and nickname of each contact
fn contacts(env: &PocketIc, sender: Principal, canister_id: CanisterId) -> Vec<(UserId, Option<String>)> {
    let user_canister::contacts::Response::Success(result) =
        client::multi_user::contacts(env, sender, canister_id, &user_canister::contacts::Args {});
    result.contacts.into_iter().map(|c| (c.user_id, c.nickname)).collect()
}

fn initial_state(env: &PocketIc, sender: Principal, canister_id: CanisterId) -> user_canister::initial_state::SuccessResult {
    let user_canister::initial_state::Response::Success(result) =
        client::multi_user::initial_state(env, sender, canister_id, &user_canister::initial_state::Args {});
    result
}

fn updates(
    env: &PocketIc,
    sender: Principal,
    canister_id: CanisterId,
    updates_since: TimestampMillis,
) -> Option<user_canister::updates::SuccessResult> {
    match client::multi_user::updates(env, sender, canister_id, &user_canister::updates::Args { updates_since }) {
        user_canister::updates::Response::Success(result) => Some(result),
        user_canister::updates::Response::SuccessNoUpdates => None,
    }
}

fn single_direct_chat_summary(initial_state: user_canister::initial_state::SuccessResult) -> DirectChatSummary {
    let Ok([summary]) = <[DirectChatSummary; 1]>::try_from(initial_state.direct_chats.summaries) else {
        panic!("Expected a single direct chat");
    };
    summary
}

fn single_direct_chat_update(updates: user_canister::updates::SuccessResult) -> DirectChatSummaryUpdates {
    assert!(updates.direct_chats.added.is_empty(), "{:?}", updates.direct_chats);
    let Ok([update]) = <[DirectChatSummaryUpdates; 1]>::try_from(updates.direct_chats.updated) else {
        panic!("Expected a single direct chat update");
    };
    update
}

fn mark_read(env: &mut PocketIc, sender: Principal, canister_id: CanisterId, them: UserId, read_up_to: MessageIndex) {
    let user_canister::mark_read::Response::Success = client::multi_user::mark_read(
        env,
        sender,
        canister_id,
        &user_canister::mark_read::Args {
            messages_read: vec![user_canister::mark_read::ChatMessagesRead {
                chat_id: them.into(),
                read_up_to: Some(read_up_to),
                threads: Vec::new(),
                date_read_pinned: None,
            }],
            community_messages_read: Vec::new(),
        },
    );
}

fn create_user(env: &mut PocketIc, local_user_index: CanisterId, canister_id: CanisterId) -> (Principal, UserId) {
    let principal = random_principal();
    let response = client::multi_user::c2c_create_user(
        env,
        local_user_index,
        canister_id,
        &multi_user_canister::c2c_create_user::Args {
            principal,
            username: random_string(),
            referred_by: None,
        },
    );
    match response {
        multi_user_canister::c2c_create_user::Response::Success(user_id) => (principal, user_id),
        response => panic!("{response:?}"),
    }
}

fn send_message_args(recipient: UserId, text: &str, message_id: MessageId) -> user_canister::send_message_v2::Args {
    user_canister::send_message_v2::Args {
        recipient,
        thread_root_message_index: None,
        message_id,
        content: MessageContentInitial::Text(TextContent { text: text.to_string() }),
        replies_to: None,
        forwarding: false,
        block_level_markdown: false,
        message_filter_failed: None,
        pin: None,
        og_previews: Vec::new(),
    }
}

fn send_text_message(
    env: &mut PocketIc,
    sender: Principal,
    canister_id: CanisterId,
    recipient: UserId,
    text: &str,
    message_id: MessageId,
) -> user_canister::send_message_v2::SuccessResult {
    let response =
        client::multi_user::send_message_v2(env, sender, canister_id, &send_message_args(recipient, text, message_id));
    match response {
        user_canister::send_message_v2::Response::Success(result) => result,
        response => panic!("{response:?}"),
    }
}

fn events_args(user_id: UserId, them: UserId) -> user_canister::events::Args {
    user_canister::events::Args {
        user_id,
        them,
        thread_root_message_index: None,
        start_index: 0.into(),
        ascending: true,
        max_messages: 50,
        max_events: 50,
        latest_known_update: None,
    }
}

fn events(env: &PocketIc, sender: Principal, canister_id: CanisterId, user_id: UserId, them: UserId) -> EventsResponse {
    match client::multi_user::events(env, sender, canister_id, &events_args(user_id, them)) {
        user_canister::events::Response::Success(response) => response,
        response => panic!("{response:?}"),
    }
}

// The sender and text of each text message in the response, in order
fn messages(response: &EventsResponse) -> Vec<(UserId, String)> {
    response
        .events
        .iter()
        .filter_map(|e| match &e.event {
            ChatEvent::Message(m) => match &m.content {
                MessageContent::Text(t) => Some((m.sender, t.text.clone())),
                _ => None,
            },
            _ => None,
        })
        .collect()
}

fn delete_direct_chat_args(user_id: UserId) -> user_canister::delete_direct_chat::Args {
    user_canister::delete_direct_chat::Args {
        user_id,
        block_user: false,
    }
}

fn delete_direct_chat(env: &mut PocketIc, sender: Principal, canister_id: CanisterId, them: UserId) {
    let response = client::multi_user::delete_direct_chat(env, sender, canister_id, &delete_direct_chat_args(them));
    assert!(
        matches!(response, user_canister::delete_direct_chat::Response::Success),
        "{response:?}"
    );
}

fn stable_memory_keys_to_garbage_collect(env: &PocketIc, canister_id: CanisterId) -> u32 {
    serde_json::from_value(metrics(env, canister_id)["stable_memory_keys_to_garbage_collect"].clone()).unwrap()
}

#[test]
fn edits_deletions_and_reactions_reach_both_copies_of_a_direct_chat() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let local_user_index = client::user_index::happy_path::user_registration_canister(env, canister_ids.user_index);
    let canister_id =
        client::user_index::happy_path::create_multi_user_canister(env, *controller, canister_ids.user_index, local_user_index);

    let (a_principal, a) = create_user(env, local_user_index, canister_id);
    let (b_principal, b) = create_user(env, local_user_index, canister_id);

    let hello_id = random_from_u128();
    send_text_message(env, a_principal, canister_id, b, "hello", hello_id);

    // A message B doesn't receive, because B has blocked A, leaves the message indexes of the two
    // copies of the chat out of step, so that threads must be matched up between them by id
    block_user(env, b_principal, canister_id, a);
    send_text_message(env, a_principal, canister_id, b, "unseen", random_from_u128());
    unblock_user(env, b_principal, canister_id, a);

    let root_id = random_from_u128();
    let root = send_text_message(env, a_principal, canister_id, b, "root", root_id);
    assert_eq!(root.message_index, 2.into());
    let a_root = Some(2.into());
    let b_root = Some(1.into());

    let reply_id = random_from_u128();
    client::multi_user::send_message_v2(
        env,
        a_principal,
        canister_id,
        &user_canister::send_message_v2::Args {
            thread_root_message_index: a_root,
            ..send_message_args(b, "reply", reply_id)
        },
    );
    assert_eq!(
        messages(&thread_events(env, b_principal, canister_id, b, a, b_root)),
        vec![(a, "reply".to_string())]
    );

    // A's edits, in the main chat and in the thread, reach B's copy
    edit_message(env, a_principal, canister_id, b, None, root_id, "root edited");
    edit_message(env, a_principal, canister_id, b, a_root, reply_id, "reply edited");
    for (principal, me, them) in [(a_principal, a, b), (b_principal, b, a)] {
        let main = events(env, principal, canister_id, me, them);
        assert!(messages(&main).contains(&(a, "root edited".to_string())));
        assert!(message(&main, root_id).edited);
    }
    assert_eq!(
        messages(&thread_events(env, b_principal, canister_id, b, a, b_root)),
        vec![(a, "reply edited".to_string())]
    );

    // A message can only be edited by its sender
    let not_sender = client::multi_user::edit_message_v2(
        env,
        b_principal,
        canister_id,
        &edit_message_args(a, None, hello_id, "hijacked"),
    );
    assert!(matches!(not_sender, types::UnitResult::Error(_)), "{not_sender:?}");

    // B's reactions, in the main chat and in the thread, reach A's copy, as does their removal
    let reaction = Reaction::new("👍".to_string());
    toggle_reaction(env, b_principal, canister_id, a, None, root_id, &reaction, true);
    toggle_reaction(env, b_principal, canister_id, a, b_root, reply_id, &reaction, true);
    for (principal, me, them, thread_root) in [(a_principal, a, b, a_root), (b_principal, b, a, b_root)] {
        let main = events(env, principal, canister_id, me, them);
        assert_eq!(message(&main, root_id).reactions, vec![(reaction.clone(), vec![b])]);
        let thread = thread_events(env, principal, canister_id, me, them, thread_root);
        assert_eq!(message(&thread, reply_id).reactions, vec![(reaction.clone(), vec![b])]);
    }
    toggle_reaction(env, b_principal, canister_id, a, None, root_id, &reaction, false);
    for (principal, me, them) in [(a_principal, a, b), (b_principal, b, a)] {
        assert!(
            message(&events(env, principal, canister_id, me, them), root_id)
                .reactions
                .is_empty()
        );
    }

    // A's deletions, in the main chat and in the thread, reach B's copy. A can still see what they
    // deleted, but B can't.
    delete_messages(env, a_principal, canister_id, b, None, vec![hello_id]);
    delete_messages(env, a_principal, canister_id, b, a_root, vec![reply_id]);
    for (principal, me, them, thread_root) in [(a_principal, a, b, a_root), (b_principal, b, a, b_root)] {
        let main = events(env, principal, canister_id, me, them);
        assert!(matches!(message(&main, hello_id).content, MessageContent::Deleted(_)));
        let thread = thread_events(env, principal, canister_id, me, them, thread_root);
        assert!(matches!(message(&thread, reply_id).content, MessageContent::Deleted(_)));
    }
    assert!(matches!(
        deleted_message(env, a_principal, canister_id, b, hello_id),
        user_canister::deleted_message::Response::Success(r) if matches!(&r.content, MessageContent::Text(t) if t.text == "hello")
    ));
    let not_deleter = deleted_message(env, b_principal, canister_id, a, hello_id);
    assert!(
        matches!(&not_deleter, user_canister::deleted_message::Response::Error(e) if e.matches_code(OCErrorCode::InitiatorNotAuthorized)),
        "{not_deleter:?}"
    );

    // Undeleting the message restores it in both copies
    let undeleted = client::multi_user::undelete_messages(
        env,
        a_principal,
        canister_id,
        &user_canister::undelete_messages::Args {
            user_id: b,
            thread_root_message_index: None,
            message_ids: vec![hello_id],
        },
    );
    let user_canister::undelete_messages::Response::Success(undeleted) = undeleted else {
        panic!("{undeleted:?}");
    };
    assert_eq!(undeleted.messages.len(), 1);
    assert_eq!(undeleted.messages[0].message_id, hello_id);

    // Deleting the message again gives the full 5 minutes to undelete it, since undeleting it
    // cancelled the removal of its content queued by the first deletion
    env.advance_time(Duration::from_secs(3 * 60));
    delete_messages(env, a_principal, canister_id, b, None, vec![hello_id]);
    env.advance_time(Duration::from_secs(3 * 60));
    tick_many(env, 3);
    assert!(matches!(
        deleted_message(env, a_principal, canister_id, b, hello_id),
        user_canister::deleted_message::Response::Success(r) if matches!(&r.content, MessageContent::Text(t) if t.text == "hello")
    ));
    let undeleted = client::multi_user::undelete_messages(
        env,
        a_principal,
        canister_id,
        &user_canister::undelete_messages::Args {
            user_id: b,
            thread_root_message_index: None,
            message_ids: vec![hello_id],
        },
    );
    assert!(
        matches!(&undeleted, user_canister::undelete_messages::Response::Success(r) if r.messages.len() == 1),
        "{undeleted:?}"
    );

    // B deleting A's message only removes it from B's copy
    delete_messages(env, b_principal, canister_id, a, None, vec![root_id]);
    assert!(matches!(
        message(&events(env, b_principal, canister_id, b, a), root_id).content,
        MessageContent::Deleted(_)
    ));
    assert!(matches!(
        message(&events(env, a_principal, canister_id, a, b), root_id).content,
        MessageContent::Text(_)
    ));

    // Once the deleted messages can no longer be undeleted their content is removed, from both
    // copies, while the message which was undeleted is untouched
    // Only the job for B's deletion of A's message is left, since the jobs for the thread reply
    // have run and cancelling jobs also clears out those which have run
    assert_eq!(timer_jobs(env, canister_id), 1);
    env.advance_time(Duration::from_secs(5 * 60));
    tick_many(env, 3);
    for (principal, me, them) in [(a_principal, a, b), (b_principal, b, a)] {
        assert!(messages(&events(env, principal, canister_id, me, them)).contains(&(a, "hello".to_string())));
    }
    let hard_deleted = client::multi_user::deleted_message(
        env,
        b_principal,
        canister_id,
        &user_canister::deleted_message::Args {
            user_id: a,
            message_id: root_id,
        },
    );
    assert!(
        matches!(&hard_deleted, user_canister::deleted_message::Response::Error(e) if e.matches_code(OCErrorCode::MessageHardDeleted)),
        "{hard_deleted:?}"
    );

    // Messages can be looked up by their index in the caller's copy
    let by_index = client::multi_user::messages_by_message_index(
        env,
        b_principal,
        canister_id,
        &user_canister::messages_by_message_index::Args {
            user_id: a,
            thread_root_message_index: None,
            messages: vec![0.into(), 1.into(), 5.into()],
            latest_known_update: None,
        },
    );
    let user_canister::messages_by_message_index::Response::Success(by_index) = by_index else {
        panic!("{by_index:?}");
    };
    let ids: Vec<_> = by_index.messages.iter().map(|m| m.event.message_id).collect();
    assert_eq!(ids, vec![hello_id, root_id]);

    // While B has blocked A, A's changes don't reach B's copy
    block_user(env, b_principal, canister_id, a);
    edit_message(env, a_principal, canister_id, b, None, hello_id, "hello edited");
    assert!(messages(&events(env, a_principal, canister_id, a, b)).contains(&(a, "hello edited".to_string())));
    assert!(messages(&events(env, b_principal, canister_id, b, a)).contains(&(a, "hello".to_string())));
}

// The LocalUserIndex only keeps a notification for a user with a push subscription, which a user in
// a MultiUser canister can't yet have as the UserIndex isn't told of them, so this checks that the
// events are sent rather than what the LocalUserIndex does with them
#[test]
fn events_for_the_local_user_index_are_sent_from_a_multi_user_canister() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let local_user_index = client::user_index::happy_path::user_registration_canister(env, canister_ids.user_index);
    let canister_id =
        client::user_index::happy_path::create_multi_user_canister(env, *controller, canister_ids.user_index, local_user_index);

    let (a_principal, a) = create_user(env, local_user_index, canister_id);
    let (b_principal, b) = create_user(env, local_user_index, canister_id);

    // A notification of each message, blocking, unblocking and setting a profile background
    send_text_message(env, a_principal, canister_id, b, "hello", random_from_u128());
    send_text_message(env, b_principal, canister_id, a, "hi", random_from_u128());
    block_user(env, a_principal, canister_id, b);
    unblock_user(env, a_principal, canister_id, b);
    let background = client::multi_user::set_profile_background(
        env,
        a_principal,
        canister_id,
        &user_canister::set_profile_background::Args {
            profile_background: Some(document(100)),
        },
    );
    assert!(matches!(background, user_canister::set_profile_background::Response::Success));

    tick_many(env, 3);
    assert_eq!(queued_local_user_index_events(env, canister_id), 0);
}

fn queued_local_user_index_events(env: &PocketIc, canister_id: CanisterId) -> u32 {
    serde_json::from_value(metrics(env, canister_id)["queued_local_user_index_events"].clone()).unwrap()
}

#[test]
fn upgrade_filter_naming_unknown_canister_is_rejected() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    // An `include` filter naming a canister the UserIndex has no mapping for must be rejected. If
    // it were dropped the upgrade would report success having pushed the wasm to nobody
    let response = client::user_index::happy_path::upgrade_multi_user_canister_wasm_with_filter(
        env,
        *controller,
        canister_ids.user_index,
        CanisterWasm {
            version: BuildVersion::new(0, 0, 2),
            module: wasms::MULTI_USER.module.clone(),
        },
        Some(UpgradesFilter {
            include: [Principal::from_slice(&[1, 2, 3])].into_iter().collect(),
            ..Default::default()
        }),
    );

    assert!(
        matches!(
            response,
            user_index_canister::upgrade_multi_user_canister_wasm::Response::InternalError(_)
        ),
        "{response:?}"
    );
}

#[test]
fn multi_user_canisters_enabled_flag_fans_out_to_local_user_indexes() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let local_user_index = client::user_index::happy_path::user_registration_canister(env, canister_ids.user_index);

    assert!(!multi_user_canisters_enabled(env, canister_ids.user_index));
    assert!(!multi_user_canisters_enabled(env, local_user_index));

    client::user_index::happy_path::set_multi_user_canisters_enabled(env, *controller, canister_ids.user_index, true);

    // The UserIndex records it immediately, the LocalUserIndex receives it over the event queue
    assert!(multi_user_canisters_enabled(env, canister_ids.user_index));
    tick_many(env, 5);
    assert!(multi_user_canisters_enabled(env, local_user_index));

    client::user_index::happy_path::set_multi_user_canisters_enabled(env, *controller, canister_ids.user_index, false);
    tick_many(env, 5);

    assert!(!multi_user_canisters_enabled(env, canister_ids.user_index));
    assert!(!multi_user_canisters_enabled(env, local_user_index));
}

fn multi_user_canisters_enabled(env: &PocketIc, canister_id: CanisterId) -> bool {
    serde_json::from_value(metrics(env, canister_id)["multi_user_canisters_enabled"].clone()).unwrap()
}

// Creating a map writes its header, so each map's memory is non-empty once it has been initialised
fn assert_stable_memory_maps_initialised(env: &PocketIc, canister_id: CanisterId) {
    let stable_memory_sizes: BTreeMap<u8, u64> =
        serde_json::from_value(metrics(env, canister_id)["stable_memory_sizes"].clone()).unwrap();

    for memory_id in [1, 2] {
        assert!(
            stable_memory_sizes.get(&memory_id).is_some_and(|size| *size > 0),
            "Stable memory map {memory_id} not initialised: {stable_memory_sizes:?}"
        );
    }
}

fn user_count(env: &PocketIc, canister_id: CanisterId) -> u32 {
    serde_json::from_value(metrics(env, canister_id)["user_count"].clone()).unwrap()
}

// Ticks until the canister is running the given version. The rolling upgrade stops, upgrades then
// restarts each MultiUser canister in turn, and the environment holds those of every test which has
// run in it, so how many rounds it takes varies.
fn wait_for_upgrade(env: &mut PocketIc, canister_id: CanisterId, version: BuildVersion) {
    for _ in 0..200 {
        let current: Option<BuildVersion> =
            try_metrics(env, canister_id).and_then(|m| serde_json::from_value(m["wasm_version"].clone()).ok());
        if current == Some(version) {
            return;
        }
        env.tick();
    }
    panic!("MultiUser canister {canister_id} was not upgraded to {version:?}");
}

fn wasm_version(env: &PocketIc, canister_id: CanisterId) -> BuildVersion {
    serde_json::from_value(metrics(env, canister_id)["wasm_version"].clone()).unwrap()
}

fn multi_user_canisters(env: &PocketIc, user_index_canister_id: CanisterId) -> Vec<(CanisterId, CanisterId)> {
    serde_json::from_value(metrics(env, user_index_canister_id)["multi_user_canisters"].clone()).unwrap()
}

fn unblock_user(env: &mut PocketIc, sender: Principal, canister_id: CanisterId, user_id: UserId) {
    let response = client::multi_user::unblock_user(env, sender, canister_id, &user_canister::unblock_user::Args { user_id });
    assert!(
        matches!(response, user_canister::unblock_user::Response::Success),
        "{response:?}"
    );
}

fn thread_events(
    env: &PocketIc,
    sender: Principal,
    canister_id: CanisterId,
    user_id: UserId,
    them: UserId,
    thread_root_message_index: Option<MessageIndex>,
) -> EventsResponse {
    let args = user_canister::events::Args {
        thread_root_message_index,
        ..events_args(user_id, them)
    };
    match client::multi_user::events(env, sender, canister_id, &args) {
        user_canister::events::Response::Success(response) => response,
        response => panic!("{response:?}"),
    }
}

// The message with the given id in the response
fn message(response: &EventsResponse, message_id: MessageId) -> Message {
    response
        .events
        .iter()
        .find_map(|e| match &e.event {
            ChatEvent::Message(m) if m.message_id == message_id => Some(m.deref().clone()),
            _ => None,
        })
        .unwrap_or_else(|| panic!("Message {message_id:?} not found"))
}

fn edit_message_args(
    user_id: UserId,
    thread_root_message_index: Option<MessageIndex>,
    message_id: MessageId,
    text: &str,
) -> user_canister::edit_message_v2::Args {
    user_canister::edit_message_v2::Args {
        user_id,
        thread_root_message_index,
        message_id,
        content: MessageContentInitial::Text(TextContent { text: text.to_string() }),
        block_level_markdown: None,
        og_previews: Vec::new(),
    }
}

fn edit_message(
    env: &mut PocketIc,
    sender: Principal,
    canister_id: CanisterId,
    user_id: UserId,
    thread_root_message_index: Option<MessageIndex>,
    message_id: MessageId,
    text: &str,
) {
    let args = edit_message_args(user_id, thread_root_message_index, message_id, text);
    let response = client::multi_user::edit_message_v2(env, sender, canister_id, &args);
    assert!(matches!(response, UnitResult::Success), "{response:?}");
}

fn delete_messages(
    env: &mut PocketIc,
    sender: Principal,
    canister_id: CanisterId,
    user_id: UserId,
    thread_root_message_index: Option<MessageIndex>,
    message_ids: Vec<MessageId>,
) {
    let args = user_canister::delete_messages::Args {
        user_id,
        thread_root_message_index,
        message_ids,
    };
    let response = client::multi_user::delete_messages(env, sender, canister_id, &args);
    assert!(matches!(response, UnitResult::Success), "{response:?}");
}

fn deleted_message(
    env: &PocketIc,
    sender: Principal,
    canister_id: CanisterId,
    user_id: UserId,
    message_id: MessageId,
) -> user_canister::deleted_message::Response {
    client::multi_user::deleted_message(
        env,
        sender,
        canister_id,
        &user_canister::deleted_message::Args { user_id, message_id },
    )
}

#[expect(clippy::too_many_arguments)]
fn toggle_reaction(
    env: &mut PocketIc,
    sender: Principal,
    canister_id: CanisterId,
    user_id: UserId,
    thread_root_message_index: Option<MessageIndex>,
    message_id: MessageId,
    reaction: &Reaction,
    added: bool,
) {
    let response = if added {
        client::multi_user::add_reaction(
            env,
            sender,
            canister_id,
            &user_canister::add_reaction::Args {
                user_id,
                thread_root_message_index,
                message_id,
                reaction: reaction.clone(),
            },
        )
    } else {
        client::multi_user::remove_reaction(
            env,
            sender,
            canister_id,
            &user_canister::remove_reaction::Args {
                user_id,
                thread_root_message_index,
                message_id,
                reaction: reaction.clone(),
            },
        )
    };
    assert!(matches!(response, UnitResult::Success), "{response:?}");
}

fn timer_jobs(env: &PocketIc, canister_id: CanisterId) -> u32 {
    serde_json::from_value(metrics(env, canister_id)["timer_jobs"].clone()).unwrap()
}

#[test]
fn search_messages_finds_matching_messages_in_a_direct_chat() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let local_user_index = client::user_index::happy_path::user_registration_canister(env, canister_ids.user_index);
    let canister_id =
        client::user_index::happy_path::create_multi_user_canister(env, *controller, canister_ids.user_index, local_user_index);

    let (a_principal, a) = create_user(env, local_user_index, canister_id);
    let (b_principal, b) = create_user(env, local_user_index, canister_id);
    let (_, c) = create_user(env, local_user_index, canister_id);

    send_text_message(env, a_principal, canister_id, b, "the quick brown fox", random_from_u128());
    send_text_message(env, a_principal, canister_id, b, "jumps over", random_from_u128());
    send_text_message(env, b_principal, canister_id, a, "a lazy fox", random_from_u128());

    // Each user searches their own copy of the chat, whose message indexes are their own
    let matches = |principal, them, term: &str| match search_messages(env, principal, canister_id, them, term) {
        user_canister::search_messages::Response::Success(result) => {
            let mut indexes: Vec<_> = result.matches.into_iter().map(|m| u32::from(m.message_index)).collect();
            indexes.sort();
            indexes
        }
        response => panic!("{response:?}"),
    };
    assert_eq!(matches(a_principal, b, "fox"), vec![0, 2]);
    assert_eq!(matches(b_principal, a, "jumps"), vec![1]);
    assert!(matches(b_principal, a, "wolf").is_empty());

    for (them, term, code) in [
        (b, "ox".to_string(), OCErrorCode::TermTooShort),
        (b, "x".repeat(259), OCErrorCode::TermTooLong),
        (c, "fox".to_string(), OCErrorCode::ChatNotFound),
    ] {
        let response = search_messages(env, a_principal, canister_id, them, &term);
        assert!(
            matches!(&response, user_canister::search_messages::Response::Error(e) if e.matches_code(code)),
            "{response:?}"
        );
    }
}

#[test]
fn disappearing_messages_expire_from_both_copies_of_a_direct_chat() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let local_user_index = client::user_index::happy_path::user_registration_canister(env, canister_ids.user_index);
    let canister_id =
        client::user_index::happy_path::create_multi_user_canister(env, *controller, canister_ids.user_index, local_user_index);

    let (a_principal, a) = create_user(env, local_user_index, canister_id);
    let (b_principal, b) = create_user(env, local_user_index, canister_id);

    send_text_message(env, a_principal, canister_id, b, "kept", random_from_u128());

    // A sets a time to live on the chat, which reaches B's copy
    let ttl = 60_000;
    update_chat_settings(env, a_principal, canister_id, b, OptionUpdate::SetToSome(ttl));
    for principal in [a_principal, b_principal] {
        assert_eq!(
            single_direct_chat_summary(initial_state(env, principal, canister_id)).events_ttl,
            Some(ttl)
        );
    }

    // A message sent now expires from both copies of the chat, each of which queues a job to remove
    // it, while the message sent before the time to live was set is kept
    let timer_jobs_before = timer_jobs(env, canister_id);
    let expiring = send_text_message(env, a_principal, canister_id, b, "expiring", random_from_u128());
    assert!(expiring.expires_at.is_some());
    assert_eq!(timer_jobs(env, canister_id), timer_jobs_before + 2);
    for (principal, me, them) in [(a_principal, a, b), (b_principal, b, a)] {
        assert_eq!(
            messages(&events(env, principal, canister_id, me, them)),
            vec![(a, "kept".to_string()), (a, "expiring".to_string())]
        );
    }

    env.advance_time(Duration::from_millis(ttl + 1));
    tick_many(env, 3);
    for (principal, me, them) in [(a_principal, a, b), (b_principal, b, a)] {
        assert_eq!(
            messages(&events(env, principal, canister_id, me, them)),
            vec![(a, "kept".to_string())]
        );
    }

    // B removes the time to live, which reaches A's copy, so messages no longer expire
    update_chat_settings(env, b_principal, canister_id, a, OptionUpdate::SetToNone);
    for principal in [a_principal, b_principal] {
        assert_eq!(
            single_direct_chat_summary(initial_state(env, principal, canister_id)).events_ttl,
            None
        );
    }
    let lasting = send_text_message(env, b_principal, canister_id, a, "lasting", random_from_u128());
    assert!(lasting.expires_at.is_none());
}

#[test]
fn reactions_to_a_users_messages_appear_in_their_message_activity_feed() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let local_user_index = client::user_index::happy_path::user_registration_canister(env, canister_ids.user_index);
    let canister_id =
        client::user_index::happy_path::create_multi_user_canister(env, *controller, canister_ids.user_index, local_user_index);

    let (a_principal, a) = create_user(env, local_user_index, canister_id);
    let (b_principal, b) = create_user(env, local_user_index, canister_id);

    let a_message_id = random_from_u128();
    send_text_message(env, a_principal, canister_id, b, "from a", a_message_id);
    let b_message_id = random_from_u128();
    send_text_message(env, b_principal, canister_id, a, "from b", b_message_id);
    let start = now_millis(env);
    env.advance_time(Duration::from_millis(1));

    // B reacting to A's message is activity for A, while B reacting to their own message is not
    let reaction = Reaction::new("👍".to_string());
    toggle_reaction(env, b_principal, canister_id, a, None, a_message_id, &reaction, true);
    toggle_reaction(env, b_principal, canister_id, a, None, b_message_id, &reaction, true);

    let feed = message_activity_feed(env, a_principal, canister_id, 0);
    assert_eq!(feed.total, 1);
    let [event] = <[MessageActivityEvent; 1]>::try_from(feed.events).unwrap();
    assert_eq!(event.chat, Chat::Direct(b.into()));
    assert_eq!(event.message_id, a_message_id);
    assert_eq!(event.message_index, 0.into());
    assert_eq!(event.activity, MessageActivity::Reaction);
    assert_eq!(event.user_id, Some(b));
    assert_eq!(message_activity_feed(env, b_principal, canister_id, 0).total, 0);

    let summary = initial_state(env, a_principal, canister_id).message_activity_summary;
    assert_eq!(summary.unread_count, 1);
    assert_eq!(summary.latest_event_timestamp, event.timestamp);
    let summary = updates(env, a_principal, canister_id, start)
        .and_then(|u| u.message_activity_summary)
        .expect("Expected the message activity summary to have been updated");
    assert_eq!(summary.unread_count, 1);

    // Marking the feed read clears the unread count
    let response = client::multi_user::mark_message_activity_feed_read(
        env,
        a_principal,
        canister_id,
        &user_canister::mark_message_activity_feed_read::Args {
            read_up_to: event.timestamp,
        },
    );
    assert!(matches!(
        response,
        user_canister::mark_message_activity_feed_read::Response::Success
    ));
    let summary = initial_state(env, a_principal, canister_id).message_activity_summary;
    assert_eq!(summary.read_up_to, event.timestamp);
    assert_eq!(summary.unread_count, 0);

    // A reaction from a user A has blocked reaches neither A's copy of the chat nor A's feed
    block_user(env, a_principal, canister_id, b);
    toggle_reaction(
        env,
        b_principal,
        canister_id,
        a,
        None,
        a_message_id,
        &Reaction::new("🎉".to_string()),
        true,
    );
    assert_eq!(message_activity_feed(env, a_principal, canister_id, 0).total, 1);
}

fn search_messages(
    env: &PocketIc,
    sender: Principal,
    canister_id: CanisterId,
    user_id: UserId,
    search_term: &str,
) -> user_canister::search_messages::Response {
    client::multi_user::search_messages(
        env,
        sender,
        canister_id,
        &user_canister::search_messages::Args {
            user_id,
            search_term: search_term.to_string(),
            max_results: 10,
        },
    )
}

fn update_chat_settings(
    env: &mut PocketIc,
    sender: Principal,
    canister_id: CanisterId,
    user_id: UserId,
    events_ttl: OptionUpdate<Milliseconds>,
) {
    let response = client::multi_user::update_chat_settings(
        env,
        sender,
        canister_id,
        &user_canister::update_chat_settings::Args { user_id, events_ttl },
    );
    assert!(matches!(response, UnitResult::Success), "{response:?}");
}

fn message_activity_feed(
    env: &PocketIc,
    sender: Principal,
    canister_id: CanisterId,
    since: TimestampMillis,
) -> user_canister::message_activity_feed::SuccessResult {
    let user_canister::message_activity_feed::Response::Success(result) = client::multi_user::message_activity_feed(
        env,
        sender,
        canister_id,
        &user_canister::message_activity_feed::Args { since },
    );
    result
}

#[test]
fn saved_crypto_accounts_and_hot_group_exclusions_are_held_per_user() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let local_user_index = client::user_index::happy_path::user_registration_canister(env, canister_ids.user_index);
    let canister_id =
        client::user_index::happy_path::create_multi_user_canister(env, *controller, canister_ids.user_index, local_user_index);

    let (a_principal, _) = create_user(env, local_user_index, canister_id);
    let (b_principal, _) = create_user(env, local_user_index, canister_id);

    let user_canister::local_user_index::Response::Success(local_user_index_of_canister) =
        client::multi_user::local_user_index(env, a_principal, canister_id, &Empty {});
    assert_eq!(local_user_index_of_canister, local_user_index);

    // Saved crypto accounts
    let named = |name: &str, account: Principal| NamedAccount {
        name: name.to_string(),
        account: account.to_string(),
    };
    let first = random_principal();
    let second = random_principal();
    assert!(matches!(
        client::multi_user::save_crypto_account(env, a_principal, canister_id, &named("Savings", first)),
        UnitResult::Success
    ));
    let taken = client::multi_user::save_crypto_account(env, a_principal, canister_id, &named("SAVINGS", second));
    assert!(
        matches!(&taken, UnitResult::Error(e) if e.matches_code(OCErrorCode::NameTaken)),
        "{taken:?}"
    );
    assert_eq!(
        saved_crypto_accounts(env, a_principal, canister_id),
        vec![named("Savings", first)]
    );
    assert!(saved_crypto_accounts(env, b_principal, canister_id).is_empty());

    assert!(matches!(
        client::multi_user::delete_saved_crypto_account(
            env,
            a_principal,
            canister_id,
            &user_canister::delete_saved_crypto_account::Args {
                name: "savings".to_string()
            },
        ),
        UnitResult::Success
    ));
    assert!(saved_crypto_accounts(env, a_principal, canister_id).is_empty());

    // Hot group exclusions, which expire after the duration given
    let group: ChatId = random_principal().into();
    let expiring_group: ChatId = random_principal().into();
    for (groups, duration) in [(vec![group], None), (vec![expiring_group], Some(1000))] {
        client::multi_user::add_hot_group_exclusions(
            env,
            a_principal,
            canister_id,
            &user_canister::add_hot_group_exclusions::Args { groups, duration },
        );
    }
    let mut exclusions = hot_group_exclusions(env, a_principal, canister_id);
    exclusions.sort();
    let mut expected = vec![group, expiring_group];
    expected.sort();
    assert_eq!(exclusions, expected);
    assert!(hot_group_exclusions(env, b_principal, canister_id).is_empty());

    env.advance_time(Duration::from_millis(1001));
    env.tick();
    assert_eq!(hot_group_exclusions(env, a_principal, canister_id), vec![group]);
}

#[test]
fn pin_number_is_set_verified_and_reported() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let local_user_index = client::user_index::happy_path::user_registration_canister(env, canister_ids.user_index);
    let canister_id =
        client::user_index::happy_path::create_multi_user_canister(env, *controller, canister_ids.user_index, local_user_index);

    let (a_principal, _) = create_user(env, local_user_index, canister_id);
    let (b_principal, _) = create_user(env, local_user_index, canister_id);
    assert!(initial_state(env, a_principal, canister_id).pin_number_settings.is_none());

    // No verification is needed to set the first PIN, which must be of a valid length
    let too_short = set_pin_number(env, a_principal, canister_id, Some("123"), PinNumberVerification::None);
    assert!(
        matches!(&too_short, UnitResult::Error(e) if e.matches_code(OCErrorCode::PinTooShort)),
        "{too_short:?}"
    );
    let start = now_millis(env);
    env.advance_time(Duration::from_millis(1));
    let response = set_pin_number(env, a_principal, canister_id, Some("1234"), PinNumberVerification::None);
    assert!(matches!(response, UnitResult::Success), "{response:?}");

    let settings = initial_state(env, a_principal, canister_id).pin_number_settings.unwrap();
    assert_eq!(settings.length, 4);
    assert!(matches!(
        updates(env, a_principal, canister_id, start).map(|u| u.pin_number_settings),
        Some(OptionUpdate::SetToSome(PinNumberSettings { length: 4, .. }))
    ));
    assert!(initial_state(env, b_principal, canister_id).pin_number_settings.is_none());

    // Changing it then needs the current PIN
    let unverified = set_pin_number(env, a_principal, canister_id, Some("5678"), PinNumberVerification::None);
    assert!(
        matches!(&unverified, UnitResult::Error(e) if e.matches_code(OCErrorCode::PinRequired)),
        "{unverified:?}"
    );
    let incorrect = set_pin_number(env, a_principal, canister_id, Some("5678"), pin("0000"));
    assert!(
        matches!(&incorrect, UnitResult::Error(e) if e.matches_code(OCErrorCode::PinIncorrect)),
        "{incorrect:?}"
    );
    let response = set_pin_number(env, a_principal, canister_id, Some("56789"), pin("1234"));
    assert!(matches!(response, UnitResult::Success), "{response:?}");
    assert_eq!(
        initial_state(env, a_principal, canister_id)
            .pin_number_settings
            .unwrap()
            .length,
        5
    );

    // Removing it clears the settings
    let after_change = now_millis(env);
    env.advance_time(Duration::from_millis(1));
    let response = set_pin_number(env, a_principal, canister_id, None, pin("56789"));
    assert!(matches!(response, UnitResult::Success), "{response:?}");
    assert!(initial_state(env, a_principal, canister_id).pin_number_settings.is_none());
    assert!(matches!(
        updates(env, a_principal, canister_id, after_change).map(|u| u.pin_number_settings),
        Some(OptionUpdate::SetToNone)
    ));
}

fn saved_crypto_accounts(env: &PocketIc, sender: Principal, canister_id: CanisterId) -> Vec<NamedAccount> {
    let user_canister::saved_crypto_accounts::Response::Success(accounts) =
        client::multi_user::saved_crypto_accounts(env, sender, canister_id, &Empty {});
    accounts
}

fn hot_group_exclusions(env: &PocketIc, sender: Principal, canister_id: CanisterId) -> Vec<ChatId> {
    let user_canister::hot_group_exclusions::Response::Success(exclusions) =
        client::multi_user::hot_group_exclusions(env, sender, canister_id, &Empty {});
    exclusions
}

fn pin(value: &str) -> PinNumberVerification {
    PinNumberVerification::PIN(value.to_string().into())
}

fn set_pin_number(
    env: &mut PocketIc,
    sender: Principal,
    canister_id: CanisterId,
    new: Option<&str>,
    verification: PinNumberVerification,
) -> UnitResult {
    client::multi_user::set_pin_number(
        env,
        sender,
        canister_id,
        &user_canister::set_pin_number::Args {
            new: new.map(|p| p.to_string().into()),
            verification,
        },
    )
}

#[test]
fn chit_streaks_and_achievements_are_held_per_user_in_a_multi_user_canister() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let local_user_index = client::user_index::happy_path::user_registration_canister(env, canister_ids.user_index);
    let canister_id =
        client::user_index::happy_path::create_multi_user_canister(env, *controller, canister_ids.user_index, local_user_index);

    let (a_principal, _) = create_user(env, local_user_index, canister_id);
    let (b_principal, b) = create_user(env, local_user_index, canister_id);

    // Streaks count days from the start of 2024
    crate::chit_tests::ensure_time_at_least_day0(env);

    // The first claim starts a streak of 1 day, and a second claim on the same day is rejected
    let first_claim = claim_daily_chit(env, a_principal, canister_id);
    assert_eq!(first_claim.streak, 1);
    assert_eq!(first_claim.chit_earned, 200);
    assert_eq!(first_claim.chit_balance, 200);
    assert!(matches!(
        client::multi_user::claim_daily_chit(
            env,
            a_principal,
            canister_id,
            &user_canister::claim_daily_chit::Args { utc_offset_mins: None },
        ),
        user_canister::claim_daily_chit::Response::AlreadyClaimed(next_claim) if next_claim == first_claim.next_claim
    ));

    // Setting a bio and sending a text message to another user earn achievements, once only
    for _ in 0..2 {
        let response = client::multi_user::set_bio(
            env,
            a_principal,
            canister_id,
            &user_canister::set_bio::Args { text: "bio".to_string() },
        );
        assert!(matches!(response, user_canister::set_bio::Response::Success));
        send_text_message(env, a_principal, canister_id, b, "hello", random_from_u128());
    }

    let expected_achievements = [Achievement::SentDirectMessage, Achievement::SentText, Achievement::SetBio];
    let expected_balance = 200 + expected_achievements.iter().map(|a| a.chit_reward() as i32).sum::<i32>();
    let a_state = initial_state(env, a_principal, canister_id);
    assert_eq!(a_state.chit_balance, expected_balance);
    assert_eq!(a_state.total_chit_earned, expected_balance);
    assert_eq!(a_state.streak, 1);
    assert_eq!(a_state.max_streak, 1);
    assert_eq!(a_state.next_daily_claim, first_claim.next_claim);
    let mut achievements: Vec<_> = a_state
        .achievements
        .iter()
        .filter_map(|event| match event.reason {
            types::ChitEventType::Achievement(achievement) => Some(achievement),
            _ => None,
        })
        .collect();
    achievements.sort_by_key(|achievement| format!("{achievement:?}"));
    assert_eq!(achievements, expected_achievements);

    // The daily claim and one event per achievement
    let a_chit_events = chit_events(env, a_principal, canister_id);
    assert_eq!(a_chit_events.total, 4);

    // The other user, in the same canister, has none of it
    let b_state = initial_state(env, b_principal, canister_id);
    assert_eq!(b_state.chit_balance, 0);
    assert_eq!(b_state.streak, 0);
    assert!(b_state.achievements.is_empty());
    assert_eq!(chit_events(env, b_principal, canister_id).total, 0);

    // Claiming on the next day extends the streak
    env.advance_time(Duration::from_millis(
        first_claim.next_claim.saturating_sub(now_millis(env)) + 1,
    ));
    let second_claim = claim_daily_chit(env, a_principal, canister_id);
    assert_eq!(second_claim.streak, 2);
    assert_eq!(second_claim.chit_balance, expected_balance + 200);

    // Marking the achievements as seen shows up in the user's updates
    let before_marking = now_millis(env);
    env.advance_time(Duration::from_millis(1));
    let last_seen = now_millis(env);
    let response = client::multi_user::mark_achievements_seen(
        env,
        a_principal,
        canister_id,
        &user_canister::mark_achievements_seen::Args { last_seen },
    );
    assert!(matches!(response, user_canister::mark_achievements_seen::Response::Success));
    let a_updates = updates(env, a_principal, canister_id, before_marking).expect("Expected updates");
    assert_eq!(a_updates.achievements_last_seen, Some(last_seen));
    assert_eq!(a_updates.streak, 2);
    assert_eq!(initial_state(env, a_principal, canister_id).achievements_last_seen, last_seen);

    // The CHIT updates for the LocalUserIndex are all sent
    tick_many(env, 3);
    assert_eq!(queued_local_user_index_events(env, canister_id), 0);
}

fn claim_daily_chit(
    env: &mut PocketIc,
    sender: Principal,
    canister_id: CanisterId,
) -> user_canister::claim_daily_chit::SuccessResult {
    match client::multi_user::claim_daily_chit(
        env,
        sender,
        canister_id,
        &user_canister::claim_daily_chit::Args { utc_offset_mins: None },
    ) {
        user_canister::claim_daily_chit::Response::Success(result) => result,
        response => panic!("'claim_daily_chit' error: {response:?}"),
    }
}

fn chit_events(env: &PocketIc, sender: Principal, canister_id: CanisterId) -> user_canister::chit_events::SuccessResult {
    let user_canister::chit_events::Response::Success(result) = client::multi_user::chit_events(
        env,
        sender,
        canister_id,
        &user_canister::chit_events::Args {
            from: None,
            to: None,
            skip: None,
            max: 100,
            ascending: true,
        },
    );
    result
}
