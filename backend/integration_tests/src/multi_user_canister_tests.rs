use crate::chit_tests::DAY_ZERO;
use crate::env::ENV;
use crate::utils::{metrics, now_millis, tick_many, try_metrics};
use crate::{CanisterIds, TestEnv, client, wasms};
use candid::Principal;
use constants::{ICP_LEDGER_CANISTER_ID, ICP_SYMBOL, ICP_TRANSFER_FEE, OPENCHAT_BOT_USER_ID};
use oc_error_codes::OCErrorCode;
use pocket_ic::PocketIc;
use sha256::sha256;
use std::collections::{BTreeMap, BTreeSet};
use std::ops::Deref;
use std::time::Duration;
use testing::rng::{random_from_u128, random_principal, random_string};
use types::{
    Achievement, BotInitiator, BotPermissions, BuildVersion, CanisterId, CanisterWasm, ChannelId, ChannelLatestMessageIndex,
    Chat, ChatEvent, ChatId, ChatPermission, ChitEventType, CommunityId, CommunityImportedInto, CryptoContent,
    CryptoTransaction, DeletedCommunityInfo, DeletedGroupInfoInternal, DiamondMembershipPlanDuration, DirectChatSummary,
    DirectChatSummaryUpdates, Document, Empty, EventsResponse, IdempotentEnvelope, Message, MessageContent,
    MessageContentInitial, MessageId, MessageIndex, Milliseconds, OptionUpdate, PendingCryptoTransaction, PinNumberSettings,
    Reaction, ReferralStatus, TextContent, TimestampMillis, UnitResult, UpgradesFilter, UserId, icrc1, icrc2,
};
use user_canister::set_pin_number::PinNumberVerification;
use user_canister::{
    ChatInList, LocalUserIndexEvent, MessageActivity, MessageActivityEvent, NamedAccount, UserCanisterEvent,
    UserJoinedCommunityOrChannel, UserJoinedGroup, WalletConfig,
};

#[test]
fn local_user_index_identifies_user_and_multi_user_canisters() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let local_user_index = client::user_index::happy_path::user_registration_canister(env, canister_ids.user_index);
    let multi_user_canister =
        client::user_index::happy_path::create_multi_user_canister(env, *controller, canister_ids.user_index, local_user_index);
    let user = client::register_user(env, canister_ids);

    let is_user_or_multi_user_canister = |canister_id| {
        client::local_user_index::is_user_or_multi_user_canister(
            env,
            Principal::anonymous(),
            local_user_index,
            &local_user_index_canister::is_user_or_multi_user_canister::Args { canister_id },
        )
    };

    use local_user_index_canister::is_user_or_multi_user_canister::Response;
    assert_eq!(
        is_user_or_multi_user_canister(multi_user_canister),
        Response::MultiUserCanister
    );
    assert_eq!(is_user_or_multi_user_canister(user.canister()), Response::UserCanister);
    assert_eq!(is_user_or_multi_user_canister(canister_ids.user_index), Response::Neither);
}

#[test]
fn register_user_with_flag_places_user_in_multi_user_canister() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let local_user_index = client::user_index::happy_path::user_registration_canister(env, canister_ids.user_index);
    let user_counts_before = local_user_counts(env, local_user_index);

    let alice = client::register_user_in_multi_user_canister(env, canister_ids);
    assert_eq!(alice.local_user_index, local_user_index);

    // Alice is one of the LocalUserIndex's users, but isn't counted amongst its User canisters, so
    // she is skipped by User canister upgrades and top ups
    let (local_user_count, user_canister_count) = local_user_counts(env, local_user_index);
    assert_eq!(local_user_count, user_counts_before.0 + 1);
    assert_eq!(user_canister_count, user_counts_before.1);

    let bob = client::register_user_in_multi_user_canister(env, canister_ids);
    let charlie = client::register_user(env, canister_ids);

    // Alice and Bob are each held in a MultiUser canister on their LocalUserIndex (one is created
    // if it has none), whereas without the flag Charlie gets a User canister of their own
    for user in [&alice, &bob] {
        assert_ne!(user.user_id.index(), 0);
        let response = client::local_user_index::is_user_or_multi_user_canister(
            env,
            Principal::anonymous(),
            user.local_user_index,
            &local_user_index_canister::is_user_or_multi_user_canister::Args {
                canister_id: user.canister(),
            },
        );
        assert_eq!(
            response,
            local_user_index_canister::is_user_or_multi_user_canister::Response::MultiUserCanister
        );
    }
    assert_eq!(charlie.user_id.index(), 0);

    // The UserIndex has recorded their registrations
    for user in [&alice, &bob] {
        let current_user = client::user_index::happy_path::current_user(env, user.principal, canister_ids.user_index);
        assert_eq!(current_user.user_id, user.user_id);
        assert_eq!(current_user.username, user.username());
    }

    // And they can use their accounts. Bob may be in another canister, which the message reaches
    // asynchronously
    let sent = send_text_message(
        env,
        alice.principal,
        alice.canister(),
        bob.user_id,
        "hello",
        random_from_u128(),
    );
    assert_eq!(sent.chat_id, bob.user_id.into());
    tick_many(env, 5);
    let bob_events = events(env, bob.principal, bob.canister(), bob.user_id, alice.user_id);
    assert_eq!(messages(&bob_events), vec![(alice.user_id, "hello".to_string())]);
}

#[test]
fn create_then_upgrade_multi_user_canister() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let local_user_index = client::user_index::happy_path::user_registration_canister(env, canister_ids.user_index);

    let multi_user_canister_count_before = multi_user_canister_count(env, local_user_index);

    let canister_id =
        client::user_index::happy_path::create_multi_user_canister(env, *controller, canister_ids.user_index, local_user_index);

    let status = env.canister_status(canister_id, Some(local_user_index)).unwrap();
    assert_eq!(status.module_hash, Some(sha256(&wasms::MULTI_USER.module).to_vec()));
    assert_eq!(
        multi_user_canister_count(env, local_user_index),
        multi_user_canister_count_before + 1
    );
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
        let user_canister::bio::Response::Success(bio) = client::user::bio(
            env,
            Principal::anonymous(),
            canister_id,
            &user_canister::bio::Args { user_id },
        );
        bio
    };
    let bio_rejected = |env: &PocketIc, user_id: UserId| {
        is_query_rejected(
            env,
            Principal::anonymous(),
            canister_id,
            "bio",
            &user_canister::bio::Args { user_id },
        )
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
        assert!(bio(env, *user_id).is_empty());
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
    assert!(bio_rejected(env, UserId::new_indexed(canister_id, 3)));
    assert!(bio_rejected(env, UserId::new_indexed(canister_ids.user_index, 1)));
    assert!(bio_rejected(env, canister_id.into()));

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
    bio(env, user_ids[1]);
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

    let (a_principal, a) = create_user(env, canister_ids, local_user_index, canister_id);
    let (b_principal, b) = create_user(env, canister_ids, local_user_index, canister_id);

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

    let by_index = client::user::events_by_index(
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

    let window = client::user::events_window(
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
    let duplicate = client::multi_user::send_message(env, a_principal, canister_id, &send_message_args(b, "again", message_id));
    assert!(
        matches!(&duplicate, user_canister::send_message_v2::Response::Error(e) if e.matches_code(OCErrorCode::MessageIdAlreadyExists)),
        "{duplicate:?}"
    );

    // A message to a thread whose root does not exist is rejected rather than creating the thread
    let missing_thread = client::multi_user::send_message(
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

    // A recipient in another canister who isn't an OpenChat user is not found
    let elsewhere: UserId = random_principal().into();
    let unknown = client::multi_user::send_message(
        env,
        a_principal,
        canister_id,
        &send_message_args(elsewhere, "hello?", random_from_u128()),
    );
    assert!(
        matches!(&unknown, user_canister::send_message_v2::Response::Error(e) if e.matches_code(OCErrorCode::TargetUserNotFound)),
        "{unknown:?}"
    );

    // A user's chats can only be read as that user by the user themselves or the LocalUserIndex
    let as_b = client::user::events(env, b_principal, canister_id, &events_args(a, b));
    assert!(
        matches!(&as_b, user_canister::events::Response::Error(e) if e.matches_code(OCErrorCode::InitiatorNotAuthorized)),
        "{as_b:?}"
    );
    assert!(matches!(
        client::user::events(env, local_user_index, canister_id, &events_args(a, b)),
        user_canister::events::Response::Success(_)
    ));
    assert!(is_query_rejected(
        env,
        random_principal(),
        canister_id,
        "events",
        &events_args(a, b)
    ));

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

    let (a_principal, a) = create_user(env, canister_ids, local_user_index, canister_id);
    let (b_principal, b) = create_user(env, canister_ids, local_user_index, canister_id);

    send_text_message(env, a_principal, canister_id, b, "hello", random_from_u128());
    send_text_message(env, b_principal, canister_id, a, "hi", random_from_u128());

    // Deleting a chat the user doesn't have fails
    let missing = client::user::delete_direct_chat(
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
    let deleted = client::user::events(env, a_principal, canister_id, &events_args(a, b));
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

    let (a_principal, a) = create_user(env, canister_ids, local_user_index, canister_id);
    let (b_principal, b) = create_user(env, canister_ids, local_user_index, canister_id);
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
    let muted = client::user::mute_notifications(
        env,
        b_principal,
        canister_id,
        &user_canister::mute_notifications::Args { chat_id: a.into() },
    );
    assert!(matches!(muted, user_canister::mute_notifications::Response::Success));
    let pinned = client::user::pin_chat_v2(
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
    let archived = client::user::archive_unarchive_chats(
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
    let unmuted = client::user::unmute_notifications(
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
    let unpinned = client::user::unpin_chat_v2(
        env,
        b_principal,
        canister_id,
        &user_canister::unpin_chat_v2::Args {
            chat: ChatInList::Direct(a.into()),
        },
    );
    assert!(matches!(unpinned, user_canister::unpin_chat_v2::Response::Success));
    let nothing = client::user::archive_unarchive_chats(
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

    let (a_principal, a) = create_user(env, canister_ids, local_user_index, canister_id);
    let (b_principal, b) = create_user(env, canister_ids, local_user_index, canister_id);
    let (_, c) = create_user(env, canister_ids, local_user_index, canister_id);

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
    let response = client::user::set_profile_background(
        env,
        a_principal,
        canister_id,
        &user_canister::set_profile_background::Args {
            profile_background: Some(profile_background.clone()),
        },
    );
    assert!(matches!(response, user_canister::set_profile_background::Response::Success));
    let response = client::user::set_bio(
        env,
        a_principal,
        canister_id,
        &user_canister::set_bio::Args {
            text: "Hello".to_string(),
        },
    );
    assert!(matches!(response, user_canister::set_bio::Response::Success));

    let user_canister::public_profile::Response::Success(profile) = client::user::public_profile(
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
    let response = client::user::set_avatar(
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
        client::multi_user::send_message(env, a_principal, canister_id, &send_message_args(b, "hi", random_from_u128()));
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
    let response = client::user::unblock_user(
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
    let response = client::user::delete_direct_chat(env, a_principal, canister_id, &block_args);
    assert!(matches!(response, user_canister::delete_direct_chat::Response::Success));
    let response = client::user::delete_direct_chat(env, a_principal, canister_id, &block_args);
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
    let response = client::user::pin_chat_v2(
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
    let response = client::user::unpin_chat_v2(
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
        client::user::set_contact(
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
    let response = client::user::configure_wallet(
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
    let response = client::user::set_avatar(env, sender, canister_id, &user_canister::set_avatar::Args { avatar });
    assert!(
        matches!(response, user_canister::set_avatar::Response::Success),
        "{response:?}"
    );
}

fn block_user(env: &mut PocketIc, sender: Principal, canister_id: CanisterId, user_id: UserId) {
    let response = client::user::block_user(env, sender, canister_id, &user_canister::block_user::Args { user_id });
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
    let response = client::user::manage_favourite_chats(
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
        client::user::contacts(env, sender, canister_id, &user_canister::contacts::Args {});
    result.contacts.into_iter().map(|c| (c.user_id, c.nickname)).collect()
}

fn initial_state(env: &PocketIc, sender: Principal, canister_id: CanisterId) -> user_canister::initial_state::SuccessResult {
    let user_canister::initial_state::Response::Success(result) =
        client::user::initial_state(env, sender, canister_id, &user_canister::initial_state::Args {});
    result
}

fn updates(
    env: &PocketIc,
    sender: Principal,
    canister_id: CanisterId,
    updates_since: TimestampMillis,
) -> Option<user_canister::updates::SuccessResult> {
    match client::user::updates(env, sender, canister_id, &user_canister::updates::Args { updates_since }) {
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
    let user_canister::mark_read::Response::Success = client::user::mark_read(
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

// Registers a user via the LocalUserIndex, which puts them in its newest MultiUser canister, which
// must be `canister_id`
fn create_user(
    env: &mut PocketIc,
    canister_ids: &CanisterIds,
    local_user_index: CanisterId,
    canister_id: CanisterId,
) -> (Principal, UserId) {
    create_user_referred_by(env, canister_ids, local_user_index, canister_id, None)
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
    let response = client::multi_user::send_message(env, sender, canister_id, &send_message_args(recipient, text, message_id));
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
    match client::user::events(env, sender, canister_id, &events_args(user_id, them)) {
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
    let response = client::user::delete_direct_chat(env, sender, canister_id, &delete_direct_chat_args(them));
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

    let (a_principal, a) = create_user(env, canister_ids, local_user_index, canister_id);
    let (b_principal, b) = create_user(env, canister_ids, local_user_index, canister_id);

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
    client::multi_user::send_message(
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
    let not_sender = client::user::edit_message_v2(
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
    let undeleted = client::user::undelete_messages(
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
    let undeleted = client::user::undelete_messages(
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
    let hard_deleted = client::user::deleted_message(
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
    let by_index = client::user::messages_by_message_index(
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

    let (a_principal, a) = create_user(env, canister_ids, local_user_index, canister_id);
    let (b_principal, b) = create_user(env, canister_ids, local_user_index, canister_id);

    // A notification of each message, blocking, unblocking and setting a profile background
    send_text_message(env, a_principal, canister_id, b, "hello", random_from_u128());
    send_text_message(env, b_principal, canister_id, a, "hi", random_from_u128());
    block_user(env, a_principal, canister_id, b);
    unblock_user(env, a_principal, canister_id, b);
    let background = client::user::set_profile_background(
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

// The LocalUserIndex's count of all its users, and of those with a User canister of their own
fn local_user_counts(env: &PocketIc, local_user_index: CanisterId) -> (u64, u64) {
    let metrics = metrics(env, local_user_index);
    let local_user_count = serde_json::from_value(metrics["local_user_count"].clone()).unwrap();
    let user_versions: BTreeMap<String, u64> = serde_json::from_value(metrics["user_versions"].clone()).unwrap();
    (local_user_count, user_versions.values().sum())
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
    let response = client::user::unblock_user(env, sender, canister_id, &user_canister::unblock_user::Args { user_id });
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
    match client::user::events(env, sender, canister_id, &args) {
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
    let response = client::user::edit_message_v2(env, sender, canister_id, &args);
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
    let response = client::user::delete_messages(env, sender, canister_id, &args);
    assert!(matches!(response, UnitResult::Success), "{response:?}");
}

fn deleted_message(
    env: &PocketIc,
    sender: Principal,
    canister_id: CanisterId,
    user_id: UserId,
    message_id: MessageId,
) -> user_canister::deleted_message::Response {
    client::user::deleted_message(
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
        client::user::add_reaction(
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
        client::user::remove_reaction(
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

    let (a_principal, a) = create_user(env, canister_ids, local_user_index, canister_id);
    let (b_principal, b) = create_user(env, canister_ids, local_user_index, canister_id);
    let (_, c) = create_user(env, canister_ids, local_user_index, canister_id);

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

    let (a_principal, a) = create_user(env, canister_ids, local_user_index, canister_id);
    let (b_principal, b) = create_user(env, canister_ids, local_user_index, canister_id);

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

    let (a_principal, a) = create_user(env, canister_ids, local_user_index, canister_id);
    let (b_principal, b) = create_user(env, canister_ids, local_user_index, canister_id);

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
    let response = client::user::mark_message_activity_feed_read(
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
    client::user::search_messages(
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
    let response = client::user::update_chat_settings(
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
    let user_canister::message_activity_feed::Response::Success(result) = client::user::message_activity_feed(
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

    let (a_principal, _) = create_user(env, canister_ids, local_user_index, canister_id);
    let (b_principal, _) = create_user(env, canister_ids, local_user_index, canister_id);

    let user_canister::local_user_index::Response::Success(local_user_index_of_canister) =
        client::user::local_user_index(env, a_principal, canister_id, &Empty {});
    assert_eq!(local_user_index_of_canister, local_user_index);

    // Saved crypto accounts
    let named = |name: &str, account: Principal| NamedAccount {
        name: name.to_string(),
        account: account.to_string(),
    };
    let first = random_principal();
    let second = random_principal();
    assert!(matches!(
        client::user::save_crypto_account(env, a_principal, canister_id, &named("Savings", first)),
        UnitResult::Success
    ));
    let taken = client::user::save_crypto_account(env, a_principal, canister_id, &named("SAVINGS", second));
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
        client::user::delete_saved_crypto_account(
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
        client::user::add_hot_group_exclusions(
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

    let (a_principal, _) = create_user(env, canister_ids, local_user_index, canister_id);
    let (b_principal, _) = create_user(env, canister_ids, local_user_index, canister_id);
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
        client::user::saved_crypto_accounts(env, sender, canister_id, &Empty {});
    accounts
}

fn hot_group_exclusions(env: &PocketIc, sender: Principal, canister_id: CanisterId) -> Vec<ChatId> {
    let user_canister::hot_group_exclusions::Response::Success(exclusions) =
        client::user::hot_group_exclusions(env, sender, canister_id, &Empty {});
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
    client::user::set_pin_number(
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

    let (a_principal, _) = create_user(env, canister_ids, local_user_index, canister_id);
    let (b_principal, b) = create_user(env, canister_ids, local_user_index, canister_id);

    // Streaks count days from the start of 2024
    crate::chit_tests::ensure_time_at_least_day0(env);

    // The first claim starts a streak of 1 day, and a second claim on the same day is rejected
    let first_claim = claim_daily_chit(env, a_principal, canister_id);
    assert_eq!(first_claim.streak, 1);
    assert_eq!(first_claim.chit_earned, 200);
    assert_eq!(first_claim.chit_balance, 200);
    assert!(matches!(
        client::user::claim_daily_chit(
            env,
            a_principal,
            canister_id,
            &user_canister::claim_daily_chit::Args { utc_offset_mins: None },
        ),
        user_canister::claim_daily_chit::Response::AlreadyClaimed(next_claim) if next_claim == first_claim.next_claim
    ));

    // Setting a bio and sending a text message to another user earn achievements, once only
    for _ in 0..2 {
        let response = client::user::set_bio(
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
    let response = client::user::mark_achievements_seen(
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
    match client::user::claim_daily_chit(
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
    let user_canister::chit_events::Response::Success(result) = client::user::chit_events(
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

#[test]
fn message_reminders_are_sent_by_the_openchat_bot_to_the_user_who_set_them() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let local_user_index = client::user_index::happy_path::user_registration_canister(env, canister_ids.user_index);
    let canister_id =
        client::user_index::happy_path::create_multi_user_canister(env, *controller, canister_ids.user_index, local_user_index);

    let (a_principal, a) = create_user(env, canister_ids, local_user_index, canister_id);
    let (b_principal, b) = create_user(env, canister_ids, local_user_index, canister_id);

    let now = now_millis(env);
    let notes = random_string();
    let reminder1 = set_message_reminder(
        env,
        a_principal,
        canister_id,
        Chat::Direct(b.into()),
        Some(notes.clone()),
        now + 1000,
    );
    let reminder2 = set_message_reminder(env, a_principal, canister_id, Chat::Direct(b.into()), None, now + 1000);

    // Reminders can't be set for times which have passed
    let response = client::user::set_message_reminder_v2(
        env,
        a_principal,
        canister_id,
        &user_canister::set_message_reminder_v2::Args {
            chat: Chat::Direct(b.into()),
            thread_root_message_index: None,
            event_index: 10.into(),
            notes: None,
            remind_at: now,
        },
    );
    assert!(
        matches!(response, user_canister::set_message_reminder_v2::Response::Error(e) if e.matches_code(OCErrorCode::DateInThePast))
    );

    // Another user in the canister can't cancel a user's reminder, while the user can
    for (principal, reminder_id) in [(b_principal, reminder1), (a_principal, reminder2)] {
        let response = client::user::cancel_message_reminder(
            env,
            principal,
            canister_id,
            &user_canister::cancel_message_reminder::Args { reminder_id },
        );
        assert!(matches!(response, user_canister::cancel_message_reminder::Response::Success));
    }

    env.advance_time(Duration::from_millis(999));
    env.tick();
    assert_eq!(bot_messages(env, a_principal, canister_id, a).len(), 2);

    env.advance_time(Duration::from_millis(1));
    env.tick();

    // The OpenChat bot sent a message when each reminder was set, both of which are now hidden (the
    // first as its reminder has been sent and the second as its reminder was cancelled), followed by
    // the one reminder which wasn't cancelled
    let [created1, created2, reminder]: [Message; 3] = bot_messages(env, a_principal, canister_id, a).try_into().unwrap();
    for (message, reminder_id) in [(created1, reminder1), (created2, reminder2)] {
        assert_eq!(message.sender, OPENCHAT_BOT_USER_ID);
        let MessageContent::MessageReminderCreated(created) = message.content else {
            panic!("{:?}", message.content);
        };
        assert_eq!(created.reminder_id, reminder_id);
        assert!(created.hidden);
    }
    let MessageContent::MessageReminder(content) = reminder.content else {
        panic!("{:?}", reminder.content);
    };
    assert_eq!(content.reminder_id, reminder1);
    assert_eq!(content.notes, Some(notes));
    let replies_to = reminder.replies_to.unwrap();
    assert_eq!(replies_to.chat_if_other, Some((Chat::Direct(b.into()), None)));
    assert_eq!(replies_to.event_index, 10.into());

    // Setting a reminder earns an achievement
    let a_state = initial_state(env, a_principal, canister_id);
    assert!(
        a_state
            .achievements
            .iter()
            .any(|event| matches!(event.reason, types::ChitEventType::Achievement(Achievement::SentReminder)))
    );

    // The other user has no chat with the OpenChat bot
    assert!(initial_state(env, b_principal, canister_id).direct_chats.summaries.is_empty());
}

fn set_message_reminder(
    env: &mut PocketIc,
    sender: Principal,
    canister_id: CanisterId,
    chat: Chat,
    notes: Option<String>,
    remind_at: TimestampMillis,
) -> u64 {
    let response = client::user::set_message_reminder_v2(
        env,
        sender,
        canister_id,
        &user_canister::set_message_reminder_v2::Args {
            chat,
            thread_root_message_index: None,
            event_index: 10.into(),
            notes,
            remind_at,
        },
    );
    match response {
        user_canister::set_message_reminder_v2::Response::Success(reminder_id) => reminder_id,
        response => panic!("{response:?}"),
    }
}

// The messages in the chat with the OpenChat bot of the user with the given id
fn bot_messages(env: &PocketIc, sender: Principal, canister_id: CanisterId, user_id: UserId) -> Vec<Message> {
    events(env, sender, canister_id, user_id, OPENCHAT_BOT_USER_ID)
        .events
        .into_iter()
        .filter_map(|e| match e.event {
            ChatEvent::Message(m) => Some(*m),
            _ => None,
        })
        .collect()
}

#[test]
fn game_chit_and_suspension_are_applied_per_user() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let local_user_index = client::user_index::happy_path::user_registration_canister(env, canister_ids.user_index);
    let canister_id =
        client::user_index::happy_path::create_multi_user_canister(env, *controller, canister_ids.user_index, local_user_index);

    let (a_principal, a) = create_user(env, canister_ids, local_user_index, canister_id);
    let (b_principal, b) = create_user(env, canister_ids, local_user_index, canister_id);

    // A credit is applied once per key, and each user has their own keys
    for user_id in [a, b] {
        let result = game_chit(env, local_user_index, canister_id, user_id, "1:solve", 100).unwrap();
        assert_eq!(result.chit_balance, 100);
        assert_eq!(result.total_chit_earned, 100);
    }
    assert_game_chit_error(
        env,
        local_user_index,
        canister_id,
        a,
        "1:solve",
        100,
        OCErrorCode::AlreadyAdded,
    );

    // A debit the user can't afford is refused, without using up its key, while one they can
    // afford reduces their balance but not the total they have earned
    assert_game_chit_error(
        env,
        local_user_index,
        canister_id,
        a,
        "1:hint",
        -500,
        OCErrorCode::InsufficientFunds,
    );
    let result = game_chit(env, local_user_index, canister_id, a, "1:hint", -40).unwrap();
    assert_eq!(result.chit_balance, 60);
    assert_eq!(result.total_chit_earned, 100);
    assert_eq!(initial_state(env, a_principal, canister_id).chit_balance, 60);
    assert_eq!(initial_state(env, b_principal, canister_id).chit_balance, 100);
    let reasons: Vec<_> = chit_events(env, a_principal, canister_id)
        .events
        .into_iter()
        .map(|event| (event.amount, event.reason))
        .collect();
    assert!(matches!(
        reasons.as_slice(),
        [
            (100, types::ChitEventType::Game { .. }),
            (-40, types::ChitEventType::Game { .. })
        ]
    ));

    // Out of range amounts and users who aren't in the canister are refused
    assert_game_chit_error(
        env,
        local_user_index,
        canister_id,
        a,
        "2:solve",
        0,
        OCErrorCode::InvalidRequest,
    );
    let missing = UserId::new_indexed(canister_id, 1000);
    assert_game_chit_error(
        env,
        local_user_index,
        canister_id,
        missing,
        "1:solve",
        100,
        OCErrorCode::TargetUserNotFound,
    );

    // Only the LocalUserIndex may add game CHIT, and only the UserIndex may suspend users, who must
    // be in the canister
    let game_chit_args = user_canister::c2c_game_chit::Args {
        user_id: a,
        game_id: "light_up".to_string(),
        key: "3:solve".to_string(),
        amount: 100,
    };
    assert!(
        env.update_call(
            canister_id,
            a_principal,
            "c2c_game_chit",
            msgpack::serialize_then_unwrap(&game_chit_args)
        )
        .is_err()
    );
    for (sender, user_id) in [(local_user_index, a), (canister_ids.user_index, missing)] {
        let args = user_canister::c2c_set_user_suspended::Args {
            user_id,
            suspended: true,
        };
        assert!(
            env.update_call(
                canister_id,
                sender,
                "c2c_set_user_suspended",
                msgpack::serialize_then_unwrap(&args)
            )
            .is_err()
        );
    }
    assert!(!initial_state(env, a_principal, canister_id).suspended);

    // Suspending a user affects them alone, and a suspended user can't earn CHIT from games
    set_user_suspended(env, canister_ids.user_index, canister_id, a, true);
    assert!(initial_state(env, a_principal, canister_id).suspended);
    assert!(!initial_state(env, b_principal, canister_id).suspended);
    assert_game_chit_error(
        env,
        local_user_index,
        canister_id,
        a,
        "2:solve",
        100,
        OCErrorCode::InitiatorSuspended,
    );
    assert!(game_chit(env, local_user_index, canister_id, b, "2:solve", 100).is_ok());
    // And is told so before their input is checked, as in the User canister
    let set_bio_response = client::user::set_bio(
        env,
        a_principal,
        canister_id,
        &user_canister::set_bio::Args { text: "x".repeat(2001) },
    );
    assert!(matches!(set_bio_response, UnitResult::Error(e) if e.matches_code(OCErrorCode::InitiatorSuspended)));

    let since = now_millis(env);
    env.advance_time(Duration::from_millis(1));
    set_user_suspended(env, canister_ids.user_index, canister_id, a, false);
    assert_eq!(updates(env, a_principal, canister_id, since).unwrap().suspended, Some(false));
    assert!(game_chit(env, local_user_index, canister_id, a, "2:solve", 100).is_ok());
}

fn game_chit(
    env: &mut PocketIc,
    sender: Principal,
    canister_id: CanisterId,
    user_id: UserId,
    key: &str,
    amount: i32,
) -> Result<user_canister::c2c_game_chit::SuccessResult, oc_error_codes::OCError> {
    let response = client::user::c2c_game_chit(
        env,
        sender,
        canister_id,
        &user_canister::c2c_game_chit::Args {
            user_id,
            game_id: "light_up".to_string(),
            key: key.to_string(),
            amount,
        },
    );
    match response {
        user_canister::c2c_game_chit::Response::Success(result) => Ok(result),
        user_canister::c2c_game_chit::Response::Error(error) => Err(error),
    }
}

fn assert_game_chit_error(
    env: &mut PocketIc,
    sender: Principal,
    canister_id: CanisterId,
    user_id: UserId,
    key: &str,
    amount: i32,
    code: OCErrorCode,
) {
    let expected = code as u16;
    match game_chit(env, sender, canister_id, user_id, key, amount) {
        Err(error) if error.code() == expected => {}
        result => panic!("Expected error code {expected}, got {result:?}"),
    }
}

fn set_user_suspended(env: &mut PocketIc, sender: Principal, canister_id: CanisterId, user_id: UserId, suspended: bool) {
    let response = client::user::c2c_set_user_suspended(
        env,
        sender,
        canister_id,
        &user_canister::c2c_set_user_suspended::Args { user_id, suspended },
    );
    let user_canister::c2c_set_user_suspended::Response::Success(result) = response;
    assert!(result.groups.is_empty() && result.communities.is_empty());
}

// These tests relied on each user in a MultiUser canister having a subaccount of the canister as
// their wallet. Users now hold their own funds in their principal's account, so they are disabled
// until the canister is converted to use principals, when they can be adapted.
//
// #[test]
// fn approvals_are_granted_from_the_users_own_subaccount() {
//     const ONE_CHAT: u128 = 100_000_000;
//
//     let mut wrapper = ENV.deref().get();
//     let TestEnv {
//         env,
//         canister_ids,
//         controller,
//     } = wrapper.env();
//
//     let local_user_index = client::user_index::happy_path::user_registration_canister(env, canister_ids.user_index);
//     let canister_id =
//         client::user_index::happy_path::create_multi_user_canister(env, *controller, canister_ids.user_index, local_user_index);
//     let (a_principal, a) = create_user(env, canister_ids, local_user_index, canister_id);
//     let (_, b) = create_user(env, canister_ids, local_user_index, canister_id);
//
//     // Each user's funds are held in their own subaccount of the canister
//     client::ledger::happy_path::transfer(env, *controller, canister_ids.chat_ledger, a, 10 * ONE_CHAT);
//     client::ledger::happy_path::transfer(env, *controller, canister_ids.chat_ledger, b, 10 * ONE_CHAT);
//     let balance = |env: &PocketIc, user: UserId| client::ledger::happy_path::balance_of(env, canister_ids.chat_ledger, user);
//
//     let spender: types::icrc1::Account = random_principal().into();
//     let response = client::user::approve_transfer(
//         env,
//         a_principal,
//         canister_id,
//         &user_canister::approve_transfer::Args {
//             spender,
//             ledger_canister_id: canister_ids.chat_ledger,
//             amount: ONE_CHAT,
//             expires_in: None,
//             pin: None,
//         },
//     );
//     assert!(matches!(response, UnitResult::Success), "{response:?}");
//
//     // The ledger charges the approval's fee to the account it was granted from, so A paid and B
//     // didn't
//     assert!(balance(env, a) < 10 * ONE_CHAT);
//     assert_eq!(balance(env, b), 10 * ONE_CHAT);
// }
//
#[test]
fn streak_insurance_is_paid_for_and_used_per_user() {
    const ONE_CHAT: u128 = 100_000_000;
    const FEE: u128 = constants::CHAT_TRANSFER_FEE;

    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let local_user_index = client::user_index::happy_path::user_registration_canister(env, canister_ids.user_index);
    let canister_id =
        client::user_index::happy_path::create_multi_user_canister(env, *controller, canister_ids.user_index, local_user_index);

    let (a_principal, a) = create_user(env, canister_ids, local_user_index, canister_id);
    let (b_principal, b) = create_user(env, canister_ids, local_user_index, canister_id);

    crate::chit_tests::ensure_time_at_least_day0(env);

    // Each user holds their own funds in their own wallet
    let wallet_balance = 10 * ONE_CHAT;
    client::ledger::happy_path::transfer(env, *controller, canister_ids.chat_ledger, a_principal, wallet_balance);
    let balance =
        |env: &PocketIc, principal: Principal| client::ledger::happy_path::balance_of(env, canister_ids.chat_ledger, principal);
    // The allowance has to cover the transfer fee too, since that is charged to the `from` account
    let allowance = ONE_CHAT + FEE;
    let approve = |env: &mut PocketIc, from: Principal, spender: Principal| {
        client::ledger::happy_path::approve(
            env,
            from,
            canister_ids.chat_ledger,
            icrc_ledger_types::icrc1::account::Account {
                owner: canister_id,
                subaccount: Some(ledger_utils::spender_subaccount(spender)),
            },
            allowance,
        );
    };

    // Without a streak there is nothing to insure
    assert_pay_for_streak_insurance_error(env, b_principal, canister_id, 1, ONE_CHAT, None, OCErrorCode::NoActiveStreak);

    claim_daily_chit(env, a_principal, canister_id);

    assert_pay_for_streak_insurance_error(
        env,
        a_principal,
        canister_id,
        1,
        2 * ONE_CHAT,
        None,
        OCErrorCode::PriceMismatch,
    );
    // More days than can be insured at once are rejected before the price is checked
    assert_pay_for_streak_insurance_error(env, a_principal, canister_id, 31, ONE_CHAT, None, OCErrorCode::InvalidRequest);
    // Nor can a user pay from an account this canister holds
    assert_pay_for_streak_insurance_error(
        env,
        a_principal,
        canister_id,
        1,
        ONE_CHAT,
        Some(canister_id.into()),
        OCErrorCode::InvalidRequest,
    );

    // The payment is pulled from A's wallet via ICRC-2, which needs an approval made under A's own
    // spender subaccount. One made under another user's is no use.
    assert_pay_for_streak_insurance_error(
        env,
        a_principal,
        canister_id,
        1,
        ONE_CHAT,
        None,
        OCErrorCode::InsufficientAllowance,
    );
    approve(env, a_principal, b_principal);
    assert_pay_for_streak_insurance_error(
        env,
        a_principal,
        canister_id,
        1,
        ONE_CHAT,
        None,
        OCErrorCode::InsufficientAllowance,
    );
    approve(env, a_principal, a_principal);
    let response = pay_for_streak_insurance(env, a_principal, canister_id, 1, ONE_CHAT, None);
    assert!(
        matches!(response, user_canister::pay_for_streak_insurance::Response::Success),
        "{response:?}"
    );
    // A paid for both approvals and the insurance
    assert_eq!(balance(env, a_principal), wallet_balance - ONE_CHAT - 3 * FEE);
    assert_eq!(
        initial_state(env, a_principal, canister_id)
            .streak_insurance
            .map(|s| s.days_insured),
        Some(1)
    );
    assert!(initial_state(env, b_principal, canister_id).streak_insurance.is_none());

    // B pays from an external wallet, which must have approved the payment under B's own spender
    // subaccount, not another user's
    claim_daily_chit(env, b_principal, canister_id);
    let external_wallet = random_principal();
    client::ledger::happy_path::transfer(env, *controller, canister_ids.chat_ledger, external_wallet, wallet_balance);
    approve(env, external_wallet, a_principal);
    assert_pay_for_streak_insurance_error(
        env,
        b_principal,
        canister_id,
        1,
        ONE_CHAT,
        Some(external_wallet.into()),
        OCErrorCode::InsufficientAllowance,
    );
    approve(env, external_wallet, b_principal);
    let response = pay_for_streak_insurance(env, b_principal, canister_id, 1, ONE_CHAT, Some(external_wallet.into()));
    assert!(
        matches!(response, user_canister::pay_for_streak_insurance::Response::Success),
        "{response:?}"
    );
    assert_eq!(balance(env, external_wallet), wallet_balance - ONE_CHAT - 3 * FEE);

    // Missing a day uses up each user's day of insurance, keeping their streaks, B setting up their
    // job having left A's in place. The OpenChat bot tells each of them.
    env.advance_time(Duration::from_millis(2 * constants::DAY_IN_MS));
    env.tick();
    for (principal, user_id) in [(a_principal, a), (b_principal, b)] {
        let state = initial_state(env, principal, canister_id);
        assert_eq!(state.streak, 2);
        assert_eq!(state.streak_insurance.map(|s| (s.days_insured, s.days_missed)), Some((1, 1)));
        assert!(
            chit_events(env, principal, canister_id)
                .events
                .iter()
                .any(|e| matches!(e.reason, types::ChitEventType::StreakInsuranceClaim))
        );
        let messages = bot_messages(env, principal, canister_id, user_id);
        assert!(matches!(
            &messages.last().unwrap().content,
            MessageContent::Text(t) if t.text.contains("One day of streak insurance was just used up")
        ));
    }

    // Missing another day, with the insurance used up, loses each streak and resets the insurance
    env.advance_time(Duration::from_millis(2 * constants::DAY_IN_MS));
    env.tick();
    for principal in [a_principal, b_principal] {
        let state = initial_state(env, principal, canister_id);
        assert_eq!(state.streak, 0);
        assert!(state.streak_insurance.is_none());
    }
}

// The UserIndex charges a user in a MultiUser canister, as it does for Diamond membership, by having
// the canister pull the payment from the user's wallet via ICRC-2, against an approval made under the
// user's own spender subaccount
#[test]
fn users_are_charged_from_their_own_wallets() {
    const ONE_CHAT: u128 = 100_000_000;
    const FEE: u128 = constants::CHAT_TRANSFER_FEE;

    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let local_user_index = client::user_index::happy_path::user_registration_canister(env, canister_ids.user_index);
    let canister_id =
        client::user_index::happy_path::create_multi_user_canister(env, *controller, canister_ids.user_index, local_user_index);

    let (a_principal, a) = create_user(env, canister_ids, local_user_index, canister_id);
    let (b_principal, _) = create_user(env, canister_ids, local_user_index, canister_id);

    let wallet_balance = 10 * ONE_CHAT;
    client::ledger::happy_path::transfer(env, *controller, canister_ids.chat_ledger, a_principal, wallet_balance);
    let balance =
        |env: &PocketIc, principal: Principal| client::ledger::happy_path::balance_of(env, canister_ids.chat_ledger, principal);
    let approve = |env: &mut PocketIc, spender: Principal| {
        client::ledger::happy_path::approve(
            env,
            a_principal,
            canister_ids.chat_ledger,
            icrc_ledger_types::icrc1::account::Account {
                owner: canister_id,
                subaccount: Some(ledger_utils::spender_subaccount(spender)),
            },
            ONE_CHAT + FEE,
        );
    };
    let charge = |env: &mut PocketIc, user_id: UserId, from_account: Option<types::icrc1::Account>| {
        client::user::c2c_charge_user_account(
            env,
            canister_ids.user_index,
            canister_id,
            &user_canister::c2c_charge_user_account::Args {
                user_id,
                ledger_canister_id: canister_ids.chat_ledger,
                amount: types::nns::Tokens::from_e8s(ONE_CHAT as u64),
                from_account,
            },
        )
    };
    let is_insufficient_allowance = |response: &user_canister::c2c_charge_user_account::Response| {
        matches!(
            response,
            user_canister::c2c_charge_user_account::Response::TransferFromError(
                types::icrc2::TransferFromError::InsufficientAllowance { .. }
            )
        )
    };
    let is_error = |response: &user_canister::c2c_charge_user_account::Response, code: OCErrorCode| matches!(response, user_canister::c2c_charge_user_account::Response::Error(e) if e.matches_code(code));
    let user_index_balance = balance(env, canister_ids.user_index);

    // Neither a user the canister doesn't hold, nor an account the canister holds, can be charged
    let response = charge(env, UserId::new_indexed(canister_id, 999), None);
    assert!(is_error(&response, OCErrorCode::TargetUserNotFound), "{response:?}");
    let response = charge(env, a, Some(canister_id.into()));
    assert!(is_error(&response, OCErrorCode::InvalidRequest), "{response:?}");

    // Without an approval under A's own spender subaccount nothing can be pulled, and one made
    // under another user's is no use
    let response = charge(env, a, None);
    assert!(is_insufficient_allowance(&response), "{response:?}");
    approve(env, b_principal);
    let response = charge(env, a, None);
    assert!(is_insufficient_allowance(&response), "{response:?}");

    approve(env, a_principal);
    let response = charge(env, a, None);
    assert!(
        matches!(response, user_canister::c2c_charge_user_account::Response::Success(_)),
        "{response:?}"
    );

    // A paid for both approvals and the charge, which reached the UserIndex
    assert_eq!(balance(env, a_principal), wallet_balance - ONE_CHAT - 3 * FEE);
    assert_eq!(balance(env, canister_ids.user_index), user_index_balance + ONE_CHAT);
}

fn pay_for_streak_insurance(
    env: &mut PocketIc,
    sender: Principal,
    canister_id: CanisterId,
    additional_days: u8,
    expected_price: u128,
    from_account: Option<types::icrc1::Account>,
) -> user_canister::pay_for_streak_insurance::Response {
    client::user::pay_for_streak_insurance(
        env,
        sender,
        canister_id,
        &user_canister::pay_for_streak_insurance::Args {
            additional_days,
            expected_price,
            from_account,
            pin: None,
        },
    )
}

fn assert_pay_for_streak_insurance_error(
    env: &mut PocketIc,
    sender: Principal,
    canister_id: CanisterId,
    additional_days: u8,
    expected_price: u128,
    from_account: Option<types::icrc1::Account>,
    code: OCErrorCode,
) {
    let expected = code as u16;
    match pay_for_streak_insurance(env, sender, canister_id, additional_days, expected_price, from_account) {
        user_canister::pay_for_streak_insurance::Response::Error(error) => assert_eq!(error.code(), expected),
        response => panic!("{response:?}"),
    }
}

#[test]
fn groups_and_communities_joined_are_held_per_user_in_a_multi_user_canister() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let local_user_index = client::user_index::happy_path::user_registration_canister(env, canister_ids.user_index);
    let canister_id =
        client::user_index::happy_path::create_multi_user_canister(env, *controller, canister_ids.user_index, local_user_index);
    let (alice, alice_id) = create_user(env, canister_ids, local_user_index, canister_id);
    let (bob, bob_id) = create_user(env, canister_ids, local_user_index, canister_id);
    let group: ChatId = random_principal().into();
    let community: CommunityId = random_principal().into();
    let channels: [ChannelId; 2] = [1u32.into(), 2u32.into()];

    // The LocalUserIndex tells Bob he has joined a group and a community. Repeating an event has
    // no further effect.
    let joined_group = local_user_index_event(
        env,
        1,
        LocalUserIndexEvent::UserJoinedGroup(Box::new(UserJoinedGroup {
            chat_id: group,
            local_user_index_canister_id: local_user_index,
            latest_message_index: Some(4.into()),
            group_canister_timestamp: now_millis(env),
        })),
    );
    let joined_community = local_user_index_event(
        env,
        2,
        LocalUserIndexEvent::UserJoinedCommunityOrChannel(Box::new(UserJoinedCommunityOrChannel {
            community_id: community,
            local_user_index_canister_id: local_user_index,
            channels: channels
                .iter()
                .map(|channel_id| ChannelLatestMessageIndex {
                    channel_id: *channel_id,
                    latest_message_index: None,
                })
                .collect(),
            community_canister_timestamp: now_millis(env),
        })),
    );
    send_local_user_index_events(
        env,
        local_user_index,
        canister_id,
        bob_id,
        vec![joined_group.clone(), joined_community],
    );
    send_local_user_index_events(env, local_user_index, canister_id, bob_id, vec![joined_group]);

    let bobs_state = initial_state(env, bob, canister_id);
    assert_eq!(group_ids(&bobs_state), vec![group]);
    assert_eq!(bobs_state.group_chats.summaries[0].read_by_me_up_to, Some(4.into()));
    assert_eq!(community_ids(&bobs_state), vec![community]);
    assert_eq!(bobs_state.communities.summaries[0].channels.len(), 2);
    assert!(has_achievement(&bobs_state, Achievement::JoinedGroup));
    assert!(has_achievement(&bobs_state, Achievement::JoinedCommunity));
    let alices_state = initial_state(env, alice, canister_id);
    assert!(group_ids(&alices_state).is_empty() && community_ids(&alices_state).is_empty());

    // The LocalUserIndex and the UserIndex are told of Bob's groups and communities
    let response = client::user::c2c_groups_and_communities(
        env,
        local_user_index,
        canister_id,
        &user_canister::c2c_groups_and_communities::Args { user_id: bob_id },
    );
    assert_eq!((response.groups, response.communities), (vec![group], vec![community]));
    let user_canister::c2c_set_user_suspended::Response::Success(result) = client::user::c2c_set_user_suspended(
        env,
        canister_ids.user_index,
        canister_id,
        &user_canister::c2c_set_user_suspended::Args {
            user_id: bob_id,
            suspended: false,
        },
    );
    assert_eq!((result.groups, result.communities), (vec![group], vec![community]));

    // Bob pins the group and a channel, marks them read, and orders his communities
    let since = now_millis(env);
    env.advance_time(Duration::from_millis(1));
    for chat in [ChatInList::Group(group), ChatInList::Community(community, channels[0])] {
        let response = client::user::pin_chat_v2(env, bob, canister_id, &user_canister::pin_chat_v2::Args { chat });
        assert!(matches!(response, UnitResult::Success), "{response:?}");
    }
    let response = client::user::mark_read(
        env,
        bob,
        canister_id,
        &user_canister::mark_read::Args {
            messages_read: vec![user_canister::mark_read::ChatMessagesRead {
                chat_id: group,
                read_up_to: Some(6.into()),
                threads: Vec::new(),
                date_read_pinned: None,
            }],
            community_messages_read: vec![user_canister::mark_read::CommunityMessagesRead {
                community_id: community,
                channels_read: vec![user_canister::mark_read::ChannelMessagesRead {
                    channel_id: channels[1],
                    read_up_to: Some(2.into()),
                    threads: Vec::new(),
                    date_read_pinned: None,
                }],
            }],
        },
    );
    assert!(matches!(response, user_canister::mark_read::Response::Success));
    let response = client::user::set_community_indexes(
        env,
        bob,
        canister_id,
        &user_canister::set_community_indexes::Args {
            indexes: vec![(community, 3)],
        },
    );
    assert!(matches!(response, user_canister::set_community_indexes::Response::Success));

    let bobs_updates = updates(env, bob, canister_id, since).unwrap();
    assert_eq!(bobs_updates.pinned_chats, Some(vec![Chat::Group(group)]));
    assert_eq!(bobs_updates.group_chats.updated[0].read_by_me_up_to, Some(6.into()));
    let community_updates = &bobs_updates.communities.updated[0];
    assert_eq!(community_updates.index, Some(3));
    assert_eq!(community_updates.pinned, Some(vec![channels[0]]));
    let channel_read = community_updates
        .channels
        .iter()
        .find(|c| c.channel_id == channels[1])
        .unwrap();
    assert_eq!(channel_read.read_by_me_up_to, Some(2.into()));

    // Archiving the group also unpins it
    let response = client::user::archive_unarchive_chats(
        env,
        bob,
        canister_id,
        &user_canister::archive_unarchive_chats::Args {
            to_archive: vec![Chat::Group(group)],
            to_unarchive: Vec::new(),
        },
    );
    assert!(matches!(response, user_canister::archive_unarchive_chats::Response::Success));
    let bobs_state = initial_state(env, bob, canister_id);
    assert!(bobs_state.group_chats.summaries[0].archived);
    assert!(bobs_state.pinned_chats.is_empty());

    // Only a group Bob is in can send him events. Those from any other caller are dropped.
    let now = now_millis(env);
    let achievement_event = |id, achievement| user_canister::c2c_group_canister_v2::Args {
        events: vec![IdempotentEnvelope {
            created_at: now,
            idempotency_id: id,
            value: (bob_id, user_canister::GroupCanisterEvent::Achievement(achievement)),
        }],
    };
    client::user::c2c_group_canister_v2(
        env,
        random_principal(),
        canister_id,
        &achievement_event(1, Achievement::ReactedToMessage),
    );
    assert!(!has_achievement(
        &initial_state(env, bob, canister_id),
        Achievement::ReactedToMessage
    ));
    client::user::c2c_group_canister_v2(
        env,
        group.into(),
        canister_id,
        &achievement_event(2, Achievement::ReactedToMessage),
    );
    assert!(has_achievement(
        &initial_state(env, bob, canister_id),
        Achievement::ReactedToMessage
    ));

    // Bob marks a thread in the group read
    mark_thread_read(env, bob, canister_id, group, 1, 3);
    assert_eq!(threads_read(env, bob, canister_id, group), vec![(1.into(), 3.into())]);

    // When the group removes Bob, it is removed from his state and the OpenChat bot tells him
    let response = client::user::c2c_remove_from_group(
        env,
        group.into(),
        canister_id,
        &user_canister::c2c_remove_from_group::Args {
            user_id: bob_id,
            removed_by: alice_id,
            blocked: false,
            group_name: "Group".to_string(),
            public: true,
        },
    );
    assert!(matches!(response, user_canister::c2c_remove_from_group::Response::Success));
    assert!(group_ids(&initial_state(env, bob, canister_id)).is_empty());
    assert_eq!(
        updates(env, bob, canister_id, since).unwrap().group_chats.removed,
        vec![group]
    );
    assert_eq!(
        last_bot_message(env, bob, canister_id, bob_id),
        format!("You were removed from the public group \"Group\" by @UserId({alice_id})")
    );

    // Events the group had queued for Bob before removing him are dropped
    client::user::c2c_group_canister_v2(env, group.into(), canister_id, &achievement_event(3, Achievement::SentGiphy));
    assert!(!has_achievement(
        &initial_state(env, bob, canister_id),
        Achievement::SentGiphy
    ));

    // Bob rejoins straight away and marks a thread read, which isn't lost to the garbage collection
    // of the group's entries from when he was removed
    let rejoined = local_user_index_event(
        env,
        4,
        LocalUserIndexEvent::UserJoinedGroup(Box::new(UserJoinedGroup {
            chat_id: group,
            local_user_index_canister_id: local_user_index,
            latest_message_index: None,
            group_canister_timestamp: now_millis(env),
        })),
    );
    send_local_user_index_events(env, local_user_index, canister_id, bob_id, vec![rejoined]);
    assert!(threads_read(env, bob, canister_id, group).is_empty());
    mark_thread_read(env, bob, canister_id, group, 2, 5);
    env.advance_time(Duration::from_secs(60));
    tick_many(env, 5);
    assert_eq!(threads_read(env, bob, canister_id, group), vec![(2.into(), 5.into())]);
}

fn mark_thread_read(
    env: &mut PocketIc,
    sender: Principal,
    canister_id: CanisterId,
    group: ChatId,
    root_message_index: u32,
    read_up_to: u32,
) {
    let response = client::user::mark_read(
        env,
        sender,
        canister_id,
        &user_canister::mark_read::Args {
            messages_read: vec![user_canister::mark_read::ChatMessagesRead {
                chat_id: group,
                read_up_to: None,
                threads: vec![user_canister::mark_read::ThreadRead {
                    root_message_index: root_message_index.into(),
                    read_up_to: read_up_to.into(),
                }],
                date_read_pinned: None,
            }],
            community_messages_read: Vec::new(),
        },
    );
    assert!(matches!(response, user_canister::mark_read::Response::Success));
}

fn threads_read(
    env: &PocketIc,
    sender: Principal,
    canister_id: CanisterId,
    group: ChatId,
) -> Vec<(MessageIndex, MessageIndex)> {
    let mut threads: Vec<_> = initial_state(env, sender, canister_id)
        .group_chats
        .summaries
        .into_iter()
        .find(|g| g.chat_id == group)
        .map(|g| g.threads_read.into_iter().collect())
        .unwrap_or_default();
    threads.sort();
    threads
}

#[test]
fn deleted_groups_and_communities_are_removed_from_multi_user_canister_users() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let local_user_index = client::user_index::happy_path::user_registration_canister(env, canister_ids.user_index);
    let canister_id =
        client::user_index::happy_path::create_multi_user_canister(env, *controller, canister_ids.user_index, local_user_index);
    let (bob, bob_id) = create_user(env, canister_ids, local_user_index, canister_id);
    let deleted_by: UserId = random_principal().into();
    let [deleted_group, imported_group]: [ChatId; 2] = [random_principal().into(), random_principal().into()];
    let community: CommunityId = random_principal().into();

    let events = [deleted_group, imported_group]
        .into_iter()
        .enumerate()
        .map(|(i, chat_id)| {
            local_user_index_event(
                env,
                i as u64,
                LocalUserIndexEvent::UserJoinedGroup(Box::new(UserJoinedGroup {
                    chat_id,
                    local_user_index_canister_id: local_user_index,
                    latest_message_index: None,
                    group_canister_timestamp: now_millis(env),
                })),
            )
        })
        .collect();
    send_local_user_index_events(env, local_user_index, canister_id, bob_id, events);
    manage_favourite_chats(env, bob, canister_id, vec![Chat::Group(imported_group)], Vec::new());

    let now = now_millis(env);
    let group_deleted_args = |chat_id: ChatId, community_imported_into: Option<CommunityImportedInto>| {
        user_canister::c2c_notify_group_deleted::Args {
            user_id: bob_id,
            deleted_group: DeletedGroupInfoInternal {
                id: chat_id,
                timestamp: now,
                deleted_by,
                group_name: "Group".to_string(),
                name: "Group".to_string(),
                public: false,
                community_imported_into,
            },
        }
    };

    // Only the GroupIndex can say a group has been deleted
    assert!(is_rejected(
        env,
        random_principal(),
        canister_id,
        "c2c_notify_group_deleted",
        &group_deleted_args(deleted_group, None)
    ));

    client::user::c2c_notify_group_deleted(
        env,
        canister_ids.group_index,
        canister_id,
        &group_deleted_args(deleted_group, None),
    );
    assert_eq!(group_ids(&initial_state(env, bob, canister_id)), vec![imported_group]);
    assert_eq!(
        last_bot_message(env, bob, canister_id, bob_id),
        format!("The private group \"Group\" was deleted by @UserId({deleted_by})")
    );

    // A group imported into a community is replaced by its channel, which takes its place in the
    // user's favourites
    let channel_id: ChannelId = 7u32.into();
    client::user::c2c_notify_group_deleted(
        env,
        canister_ids.group_index,
        canister_id,
        &group_deleted_args(
            imported_group,
            Some(CommunityImportedInto {
                community_name: "Community".to_string(),
                community_id: community,
                local_user_index_canister_id: local_user_index,
                channel: ChannelLatestMessageIndex {
                    channel_id,
                    latest_message_index: None,
                },
                other_default_channels: Vec::new(),
            }),
        ),
    );
    let bobs_state = initial_state(env, bob, canister_id);
    assert!(group_ids(&bobs_state).is_empty());
    assert_eq!(community_ids(&bobs_state), vec![community]);
    assert!(
        bobs_state.communities.summaries[0]
            .channels
            .iter()
            .any(|c| c.channel_id == channel_id)
    );
    assert_eq!(bobs_state.favourite_chats.chats, vec![Chat::Channel(community, channel_id)]);
    assert!(last_bot_message(env, bob, canister_id, bob_id).contains("was deleted because it was imported into"));

    // Then the community is deleted
    client::user::c2c_notify_community_deleted(
        env,
        canister_ids.group_index,
        canister_id,
        &user_canister::c2c_notify_community_deleted::Args {
            user_id: bob_id,
            deleted_community: DeletedCommunityInfo {
                id: community,
                timestamp: now_millis(env),
                deleted_by,
                name: "Community".to_string(),
                public: true,
            },
        },
    );
    let bobs_state = initial_state(env, bob, canister_id);
    assert!(community_ids(&bobs_state).is_empty());
    assert!(bobs_state.favourite_chats.chats.is_empty());
    assert_eq!(
        last_bot_message(env, bob, canister_id, bob_id),
        format!("The public community \"Community\" was deleted by @UserId({deleted_by})")
    );
}

#[test]
fn creating_a_community_requires_diamond_membership_in_a_multi_user_canister() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let local_user_index = client::user_index::happy_path::user_registration_canister(env, canister_ids.user_index);
    let canister_id =
        client::user_index::happy_path::create_multi_user_canister(env, *controller, canister_ids.user_index, local_user_index);
    let (alice, alice_id) = create_user(env, canister_ids, local_user_index, canister_id);

    let create_community = |env: &mut PocketIc| {
        client::user::create_community(
            env,
            alice,
            canister_id,
            &user_canister::create_community::Args {
                is_public: false,
                name: random_string(),
                description: random_string(),
                avatar: None,
                banner: None,
                history_visible_to_new_joiners: false,
                permissions: None,
                rules: Default::default(),
                gate_config: None,
                default_channels: vec!["general".to_string()],
                default_channel_rules: None,
                primary_language: "en".to_string(),
            },
        )
    };

    let response = create_community(env);
    assert!(
        matches!(&response, user_canister::create_community::Response::Error(e) if e.matches_code(OCErrorCode::NotDiamondMember)),
        "{response:?}"
    );

    // Once Alice is a Diamond member the community is created, and she is its first member
    diamond_membership_payment_received(env, local_user_index, canister_id, alice_id);
    assert!(has_achievement(
        &initial_state(env, alice, canister_id),
        Achievement::UpgradedToDiamond
    ));
    let response = create_community(env);
    let user_canister::create_community::Response::Success(result) = response else {
        panic!("{response:?}");
    };
    assert!(community_ids(&initial_state(env, alice, canister_id)).contains(&result.community_id));
}

#[test]
fn local_user_index_events_update_the_state_each_user_holds() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let local_user_index = client::user_index::happy_path::user_registration_canister(env, canister_ids.user_index);
    let canister_id =
        client::user_index::happy_path::create_multi_user_canister(env, *controller, canister_ids.user_index, local_user_index);

    // Alice referred Bob, both in this canister, and Carol, a User canister user, referred Alice.
    // Bob's registration tells Alice he used her referral code
    let carol = client::register_user(env, canister_ids);
    let (alice, alice_id) = create_user_referred_by(env, canister_ids, local_user_index, canister_id, Some(carol.user_id));
    let (bob, bob_id) = create_user_referred_by(env, canister_ids, local_user_index, canister_id, Some(alice_id));
    let referred_elsewhere: UserId = random_principal().into();

    let events = vec![
        LocalUserIndexEvent::NotifyUniquePersonProof(Box::new(types::UniquePersonProof {
            timestamp: now_millis(env),
            provider: types::UniquePersonProofProvider::DecideAI,
        })),
        LocalUserIndexEvent::ReferredUserRegistered(Box::new(user_canister::ReferredUserRegistered {
            user_id: referred_elsewhere,
            username: "referred".to_string(),
        })),
        LocalUserIndexEvent::ExternalAchievementAwarded(Box::new(user_canister::ExternalAchievementAwarded {
            name: "Played a game".to_string(),
            chit_reward: 500,
        })),
        LocalUserIndexEvent::StorageUpgraded(Box::new(user_canister::StorageUpgraded {
            cost: types::nns::CryptoAmount {
                token_symbol: "ICP".to_string(),
                amount: types::nns::Tokens::from_e8s(100_000_000),
            },
            storage_added: 1024 * 1024 * 1024,
            new_storage_limit: 1024 * 1024 * 1024,
        })),
        LocalUserIndexEvent::OpenChatBotMessageV2(Box::new(user_canister::OpenChatBotMessageV2 {
            thread_root_message_id: None,
            content: MessageContentInitial::Text(TextContent {
                text: "A message from the bot".to_string(),
            }),
            mentioned: Vec::new(),
        })),
    ];
    let envelopes: Vec<_> = events
        .into_iter()
        .enumerate()
        .map(|(i, e)| local_user_index_event(env, i as u64 + 1, e))
        .collect();
    send_local_user_index_events(env, local_user_index, canister_id, alice_id, envelopes.clone());

    let alice_state = initial_state(env, alice, canister_id);
    assert!(alice_state.is_unique_person);
    assert_eq!(
        alice_state.referrals.iter().map(|r| r.user_id).collect::<BTreeSet<_>>(),
        BTreeSet::from([bob_id, referred_elsewhere])
    );
    assert!(has_achievement(&alice_state, Achievement::ProvedUniquePersonhood));
    assert!(
        alice_state
            .achievements
            .iter()
            .any(|e| matches!(&e.reason, ChitEventType::ExternalAchievement(name) if name == "Played a game"))
    );
    let profile = public_profile(env, alice, canister_id, alice_id);
    assert!(profile.is_premium);
    assert!(!profile.phone_is_verified);

    let texts = bot_message_texts(env, alice, canister_id, alice_id);
    assert!(
        texts.iter().any(|t| t.contains("registered with your referral code")),
        "{texts:?}"
    );
    assert!(
        texts.iter().any(|t| t.contains("You paid 1 ICP for 1 GB of storage")),
        "{texts:?}"
    );
    assert!(texts.iter().any(|t| t == "A message from the bot"), "{texts:?}");

    // Proving personhood told Carol, Alice's referrer in another canister, so she earned the CHIT
    tick_many(env, 5);
    let carol_state = client::user::happy_path::initial_state(env, &carol);
    assert_eq!(carol_state.referrals.len(), 1);
    assert_eq!(carol_state.referrals[0].user_id, alice_id);
    assert!(matches!(carol_state.referrals[0].status, ReferralStatus::UniquePerson));
    assert!(carol_state.chit_balance > 0);

    // The same events again are ignored, since each has already been processed
    send_local_user_index_events(env, local_user_index, canister_id, alice_id, envelopes);
    assert_eq!(bot_message_texts(env, alice, canister_id, alice_id), texts);
    assert_eq!(initial_state(env, alice, canister_id).chit_balance, alice_state.chit_balance);

    // Bob is untouched by any of it
    let bob_state = initial_state(env, bob, canister_id);
    assert!(!bob_state.is_unique_person);
    assert!(bob_state.referrals.is_empty());
    assert!(bob_state.chit_balance == 0);
    assert!(bob_state.direct_chats.summaries.is_empty());

    // A referred user in another canister reaching a status is sent as a `SetReferralStatus`
    // event from their canister, as the User canister sends it
    let response = client::user::c2c_user_canister_v2(
        env,
        carol.canister(),
        canister_id,
        &user_canister::c2c_user_canister_v2::Args {
            events: vec![IdempotentEnvelope {
                created_at: now_millis(env),
                idempotency_id: 1,
                value: user_canister::c2c_user_canister_v2::Event {
                    sender: carol.user_id,
                    recipient: alice_id,
                    event: UserCanisterEvent::SetReferralStatus(Box::new(ReferralStatus::Diamond)),
                },
            }],
        },
    );
    assert!(
        matches!(response, user_canister::c2c_user_canister_v2::Response::Success),
        "{response:?}"
    );
    let alice_state_after = initial_state(env, alice, canister_id);
    assert!(
        alice_state_after
            .referrals
            .iter()
            .any(|r| r.user_id == carol.user_id && matches!(r.status, ReferralStatus::Diamond)),
        "{:?}",
        alice_state_after.referrals
    );
    assert!(has_achievement(&alice_state_after, Achievement::Referred1stUser));
    assert!(alice_state_after.chit_balance > alice_state.chit_balance);
    let alice_state = alice_state_after;

    // Bob buying Diamond tells Alice, his referrer in this canister, so she earns the CHIT
    let now = now_millis(env);
    // Ids distinct from Alice's, since nothing advances the time between the calls
    let event = local_user_index_event(
        env,
        11,
        LocalUserIndexEvent::DiamondMembershipPaymentReceived(Box::new(user_canister::DiamondMembershipPaymentReceived {
            timestamp: now,
            expires_at: now + 365 * constants::DAY_IN_MS,
            ledger: Principal::anonymous(),
            token_symbol: "CHAT".to_string(),
            token: None,
            amount_e8s: 0,
            block_index: 0,
            duration: DiamondMembershipPlanDuration::Lifetime,
            recurring: false,
            send_bot_message: true,
        })),
    );
    send_local_user_index_events(env, local_user_index, canister_id, bob_id, vec![event]);

    let bob_state = initial_state(env, bob, canister_id);
    assert!(has_achievement(&bob_state, Achievement::UpgradedToDiamond));
    assert!(has_achievement(&bob_state, Achievement::UpgradedToGoldDiamond));
    assert!(
        bot_message_texts(env, bob, canister_id, bob_id)
            .iter()
            .any(|t| t == "Payment received for Diamond membership!")
    );
    let alice_state_after = initial_state(env, alice, canister_id);
    assert!(
        alice_state_after
            .referrals
            .iter()
            .any(|r| r.user_id == bob_id && matches!(r.status, ReferralStatus::LifetimeDiamond)),
        "{:?}",
        alice_state_after.referrals
    );
    assert!(alice_state_after.chit_balance > alice_state.chit_balance);

    // Confirming a phone number marks the user as verified
    let event = local_user_index_event(
        env,
        12,
        LocalUserIndexEvent::PhoneNumberConfirmed(Box::new(user_canister::PhoneNumberConfirmed {
            phone_number: types::PhoneNumber::new(44, "07887123456".to_string()),
            storage_added: 1024 * 1024 * 1024,
            new_storage_limit: 2 * 1024 * 1024 * 1024,
        })),
    );
    send_local_user_index_events(env, local_user_index, canister_id, bob_id, vec![event]);
    assert!(public_profile(env, bob, canister_id, bob_id).phone_is_verified);
    assert!(
        bot_message_texts(env, bob, canister_id, bob_id)
            .iter()
            .any(|t| t.contains("verifying ownership of your phone number"))
    );

    // Daily claims are counted from the start of 2024, so one can only be reinstated once the
    // time is past then
    crate::chit_tests::ensure_time_at_least_day0(env);
    let now = now_millis(env);
    let event = local_user_index_event(
        env,
        13,
        LocalUserIndexEvent::ReinstateMissedDailyClaims(vec![((now - DAY_ZERO) / constants::DAY_IN_MS) as u16]),
    );
    send_local_user_index_events(env, local_user_index, canister_id, bob_id, vec![event]);
    assert!(
        chit_events(env, bob, canister_id)
            .events
            .iter()
            .any(|e| matches!(e.reason, ChitEventType::DailyClaimReinstated))
    );
    assert!(
        bot_message_texts(env, bob, canister_id, bob_id)
            .iter()
            .any(|t| t.contains("1 missed daily claim has been reinstated"))
    );
}

fn create_user_referred_by(
    env: &mut PocketIc,
    canister_ids: &CanisterIds,
    local_user_index: CanisterId,
    canister_id: CanisterId,
    referred_by: Option<UserId>,
) -> (Principal, UserId) {
    let user = client::register_user_in_multi_user_canister_on(
        env,
        canister_ids,
        local_user_index,
        referred_by.map(|user_id| user_id.to_string()),
    );
    assert_eq!(
        user.canister(),
        canister_id,
        "User not registered in the expected MultiUser canister"
    );
    (user.principal, user.user_id)
}

fn public_profile(
    env: &PocketIc,
    sender: Principal,
    canister_id: CanisterId,
    user_id: UserId,
) -> user_canister::public_profile::PublicProfile {
    let user_canister::public_profile::Response::Success(profile) =
        client::user::public_profile(env, sender, canister_id, &user_canister::public_profile::Args { user_id });
    profile
}

fn bot_message_texts(env: &PocketIc, sender: Principal, canister_id: CanisterId, user_id: UserId) -> Vec<String> {
    bot_messages(env, sender, canister_id, user_id)
        .into_iter()
        .filter_map(|m| match m.content {
            MessageContent::Text(t) => Some(t.text),
            _ => None,
        })
        .collect()
}

#[test]
fn bots_are_installed_per_user() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let local_user_index = client::user_index::happy_path::user_registration_canister(env, canister_ids.user_index);
    let canister_id =
        client::user_index::happy_path::create_multi_user_canister(env, *controller, canister_ids.user_index, local_user_index);
    let (alice, alice_id) = create_user(env, canister_ids, local_user_index, canister_id);
    let (bob, bob_id) = create_user(env, canister_ids, local_user_index, canister_id);
    let bot_id: UserId = random_principal().into();
    let permissions = BotPermissions::from_chat_permission(ChatPermission::ReadSummary);

    let install = |env: &mut PocketIc, caller: UserId| {
        client::user::c2c_install_bot(
            env,
            local_user_index,
            canister_id,
            &types::c2c_install_bot::Args {
                bot_id,
                caller,
                granted_permissions: permissions.clone(),
                granted_autonomous_permissions: Some(permissions.clone()),
                default_subscriptions: None,
            },
        )
    };

    // Only the user themselves can install a bot for them
    let response = install(env, random_principal().into());
    assert!(
        matches!(&response, UnitResult::Error(e) if e.matches_code(OCErrorCode::InitiatorNotAuthorized)),
        "{response:?}"
    );

    let response = install(env, alice_id);
    assert!(matches!(response, UnitResult::Success), "{response:?}");
    let response = install(env, alice_id);
    assert!(
        matches!(&response, UnitResult::Error(e) if e.matches_code(OCErrorCode::AlreadyAdded)),
        "{response:?}"
    );

    // Alice has the bot and a chat with it; Bob has neither until he installs it too
    let alice_state = initial_state(env, alice, canister_id);
    assert_eq!(alice_state.bots.iter().map(|b| b.user_id).collect::<Vec<_>>(), vec![bot_id]);
    assert!(alice_state.direct_chats.summaries.iter().any(|c| c.them == bot_id));
    let bob_state = initial_state(env, bob, canister_id);
    assert!(bob_state.bots.is_empty());
    assert!(bob_state.direct_chats.summaries.is_empty());
    let response = install(env, bob_id);
    assert!(matches!(response, UnitResult::Success), "{response:?}");

    // The bot may read the summary of its chat with Alice, having been granted that permission
    let response = client::user::c2c_bot_chat_summary(
        env,
        local_user_index,
        canister_id,
        &user_canister::c2c_bot_chat_summary::Args {
            user_id: alice_id,
            bot_id,
            initiator: BotInitiator::Autonomous,
        },
    );
    assert!(
        matches!(response, user_canister::c2c_bot_chat_summary::Response::Success(_)),
        "{response:?}"
    );

    // Uninstalling removes the bot and the chat for Alice alone, once the chat's entries in stable
    // memory have been garbage collected
    let response = client::user::c2c_uninstall_bot(
        env,
        local_user_index,
        canister_id,
        &types::c2c_uninstall_bot::Args {
            bot_id,
            caller: alice_id,
        },
    );
    assert!(matches!(response, UnitResult::Success), "{response:?}");
    env.advance_time(Duration::from_secs(11));
    tick_many(env, 5);
    let alice_state = initial_state(env, alice, canister_id);
    assert!(alice_state.bots.is_empty());
    assert!(alice_state.direct_chats.summaries.is_empty());
    let bob_state = initial_state(env, bob, canister_id);
    assert_eq!(bob_state.bots.iter().map(|b| b.user_id).collect::<Vec<_>>(), vec![bot_id]);
    assert!(bob_state.direct_chats.summaries.iter().any(|c| c.them == bot_id));
    assert!(matches!(
        client::user::c2c_bot_chat_summary(
            env,
            local_user_index,
            canister_id,
            &user_canister::c2c_bot_chat_summary::Args {
                user_id: bob_id,
                bot_id,
                initiator: BotInitiator::Autonomous,
            },
        ),
        user_canister::c2c_bot_chat_summary::Response::Success(_)
    ));

    // A bot removed everywhere reaches each user as an event from the LocalUserIndex
    let event = local_user_index_event(env, 1, LocalUserIndexEvent::BotRemoved(bot_id));
    send_local_user_index_events(env, local_user_index, canister_id, bob_id, vec![event]);
    let bob_state = initial_state(env, bob, canister_id);
    assert!(bob_state.bots.is_empty());
    assert!(bob_state.direct_chats.summaries.is_empty());
}

#[test]
fn reporting_a_message_deletes_it_from_the_reporters_copy_only() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let local_user_index = client::user_index::happy_path::user_registration_canister(env, canister_ids.user_index);
    let canister_id =
        client::user_index::happy_path::create_multi_user_canister(env, *controller, canister_ids.user_index, local_user_index);
    let (alice, alice_id) = create_user(env, canister_ids, local_user_index, canister_id);
    let (bob, bob_id) = create_user(env, canister_ids, local_user_index, canister_id);

    let message_id = random_from_u128();
    let response = client::multi_user::send_message(env, bob, canister_id, &send_message_args(alice_id, "rude", message_id));
    assert!(
        matches!(response, user_canister::send_message_v2::Response::Success(_)),
        "{response:?}"
    );

    let response = client::user::report_message(
        env,
        alice,
        canister_id,
        &user_canister::report_message::Args {
            them: bob_id,
            thread_root_message_index: None,
            message_id,
            delete: true,
            csam: false,
        },
    );
    assert!(matches!(response, UnitResult::Success), "{response:?}");

    // The report is made as Alice, and deleting removes the message from her copy of the chat only
    assert!(
        events(env, alice, canister_id, alice_id, bob_id)
            .events
            .iter()
            .all(|e| !matches!(&e.event, ChatEvent::Message(m) if matches!(m.content, MessageContent::Text(_))))
    );
    assert_eq!(
        messages(&events(env, bob, canister_id, bob_id, alice_id)),
        vec![(bob_id, "rude".to_string())]
    );
}

#[test]
fn premium_items_are_paid_for_from_the_users_chit() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let local_user_index = client::user_index::happy_path::user_registration_canister(env, canister_ids.user_index);
    let canister_id =
        client::user_index::happy_path::create_multi_user_canister(env, *controller, canister_ids.user_index, local_user_index);
    let (alice, alice_id) = create_user(env, canister_ids, local_user_index, canister_id);

    // An external achievement gives Alice some CHIT to spend
    let event = local_user_index_event(
        env,
        1,
        LocalUserIndexEvent::ExternalAchievementAwarded(Box::new(user_canister::ExternalAchievementAwarded {
            name: "Played a game".to_string(),
            chit_reward: 1000,
        })),
    );
    send_local_user_index_events(env, local_user_index, canister_id, alice_id, vec![event]);
    assert_eq!(initial_state(env, alice, canister_id).chit_balance, 1000);

    let pay = |env: &mut PocketIc, item_id: u32, cost: u32| {
        client::user::c2c_pay_for_premium_item(
            env,
            local_user_index,
            canister_id,
            &user_canister::c2c_pay_for_premium_item::Args {
                user_id: alice_id,
                item_id,
                pay_in_chat: false,
                cost,
            },
        )
    };

    // Too expensive
    let response = pay(env, 1, 1001);
    assert!(
        matches!(&response, user_canister::c2c_pay_for_premium_item::Response::Error(e) if e.matches_code(OCErrorCode::InsufficientFunds)),
        "{response:?}"
    );

    // Bought, and reported in the user's state along with the CHIT spent
    let response = pay(env, 1, 400);
    assert!(
        matches!(&response, user_canister::c2c_pay_for_premium_item::Response::Success(r) if r.chit_balance == 600),
        "{response:?}"
    );
    let state = initial_state(env, alice, canister_id);
    assert_eq!(state.premium_items, vec![1]);
    assert_eq!(state.chit_balance, 600);
    assert!(
        chit_events(env, alice, canister_id)
            .events
            .iter()
            .any(|e| matches!(e.reason, ChitEventType::PurchasedPremiumItem(1)) && e.amount == -400)
    );

    // Only once
    let response = pay(env, 1, 400);
    assert!(
        matches!(&response, user_canister::c2c_pay_for_premium_item::Response::Error(e) if e.matches_code(OCErrorCode::AlreadyAdded)),
        "{response:?}"
    );

    // A user this canister doesn't hold
    let response = client::user::c2c_pay_for_premium_item(
        env,
        local_user_index,
        canister_id,
        &user_canister::c2c_pay_for_premium_item::Args {
            user_id: random_principal().into(),
            item_id: 2,
            pay_in_chat: false,
            cost: 1,
        },
    );
    assert!(
        matches!(&response, user_canister::c2c_pay_for_premium_item::Response::Error(e) if e.matches_code(OCErrorCode::TargetUserNotFound)),
        "{response:?}"
    );
}

fn local_user_index_event(
    env: &PocketIc,
    idempotency_id: u64,
    event: LocalUserIndexEvent,
) -> IdempotentEnvelope<LocalUserIndexEvent> {
    IdempotentEnvelope {
        created_at: now_millis(env),
        idempotency_id,
        value: event,
    }
}

fn send_local_user_index_events(
    env: &mut PocketIc,
    local_user_index: CanisterId,
    canister_id: CanisterId,
    user_id: UserId,
    events: Vec<IdempotentEnvelope<LocalUserIndexEvent>>,
) {
    let response = client::user::c2c_local_user_index_v2(
        env,
        local_user_index,
        canister_id,
        &user_canister::c2c_local_user_index_v2::Args {
            events: events.into_iter().map(|event| paired(user_id, event)).collect(),
        },
    );
    assert!(matches!(response, types::SuccessOnly::Success));
}

// Whether the canister rejects the query, eg. because the caller isn't one of its users
fn is_query_rejected<A: serde::Serialize>(
    env: &PocketIc,
    sender: Principal,
    canister_id: CanisterId,
    method_name: &str,
    args: &A,
) -> bool {
    env.query_call(
        canister_id,
        sender,
        &format!("{method_name}_msgpack"),
        msgpack::serialize_then_unwrap(args),
    )
    .is_err()
}

// Whether the canister rejects the call, eg. because the caller fails its guard
fn is_rejected<A: serde::Serialize>(
    env: &mut PocketIc,
    sender: Principal,
    canister_id: CanisterId,
    method_name: &str,
    args: &A,
) -> bool {
    env.update_call(
        canister_id,
        sender,
        &format!("{method_name}_msgpack"),
        msgpack::serialize_then_unwrap(args),
    )
    .is_err()
}

fn has_achievement(initial_state: &user_canister::initial_state::SuccessResult, achievement: Achievement) -> bool {
    initial_state
        .achievements
        .iter()
        .any(|e| matches!(&e.reason, ChitEventType::Achievement(a) if *a == achievement))
}

fn diamond_membership_payment_received(
    env: &mut PocketIc,
    local_user_index: CanisterId,
    canister_id: CanisterId,
    user_id: UserId,
) {
    let now = now_millis(env);
    let event = local_user_index_event(
        env,
        1,
        LocalUserIndexEvent::DiamondMembershipPaymentReceived(Box::new(user_canister::DiamondMembershipPaymentReceived {
            timestamp: now,
            expires_at: now + 30 * 24 * 60 * 60 * 1000,
            ledger: Principal::anonymous(),
            token_symbol: "CHAT".to_string(),
            token: None,
            amount_e8s: 0,
            block_index: 0,
            duration: DiamondMembershipPlanDuration::OneMonth,
            recurring: false,
            send_bot_message: false,
        })),
    );
    send_local_user_index_events(env, local_user_index, canister_id, user_id, vec![event]);
}

fn group_ids(initial_state: &user_canister::initial_state::SuccessResult) -> Vec<ChatId> {
    initial_state.group_chats.summaries.iter().map(|g| g.chat_id).collect()
}

fn community_ids(initial_state: &user_canister::initial_state::SuccessResult) -> Vec<CommunityId> {
    initial_state.communities.summaries.iter().map(|c| c.community_id).collect()
}

fn last_bot_message(env: &PocketIc, sender: Principal, canister_id: CanisterId, user_id: UserId) -> String {
    match bot_messages(env, sender, canister_id, user_id).pop().map(|m| m.content) {
        Some(MessageContent::Text(text)) => text.text,
        content => panic!("{content:?}"),
    }
}

#[test]
fn a_user_is_deleted_from_a_multi_user_canister_without_affecting_the_others() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let local_user_index = client::user_index::happy_path::user_registration_canister(env, canister_ids.user_index);
    let canister_id =
        client::user_index::happy_path::create_multi_user_canister(env, *controller, canister_ids.user_index, local_user_index);
    let (alice, alice_id) = create_user(env, canister_ids, local_user_index, canister_id);
    let (bob, bob_id) = create_user(env, canister_ids, local_user_index, canister_id);

    // Alice and Bob exchange messages, and each sets a reminder
    send_text_message(env, alice, canister_id, bob_id, "hello", random_from_u128());
    send_text_message(env, bob, canister_id, alice_id, "hi", random_from_u128());
    let remind_at = now_millis(env) + 60_000;
    set_message_reminder(env, alice, canister_id, Chat::Direct(bob_id.into()), None, remind_at);
    set_message_reminder(env, bob, canister_id, Chat::Direct(alice_id.into()), None, remind_at);
    let timer_jobs_before = timer_jobs(env, canister_id);

    // Only the LocalUserIndex can delete a user
    assert!(is_rejected(
        env,
        alice,
        canister_id,
        "c2c_delete_user",
        &multi_user_canister::c2c_delete_user::Args { user_id: alice_id }
    ));

    delete_user(env, local_user_index, canister_id, alice_id);

    // Alice is gone, along with her reminder, while Bob keeps his copy of their chat
    assert_eq!(user_count(env, canister_id), 1);
    assert!(is_query_rejected(
        env,
        alice,
        canister_id,
        "initial_state",
        &user_canister::initial_state::Args {}
    ));
    assert_eq!(timer_jobs(env, canister_id), timer_jobs_before - 1);
    assert_eq!(
        messages(&events(env, bob, canister_id, bob_id, alice_id)),
        vec![(alice_id, "hello".to_string()), (bob_id, "hi".to_string())]
    );

    // Her entries in stable memory are garbage collected
    assert_eq!(deleted_users_to_garbage_collect(env, canister_id), 1);
    env.advance_time(Duration::from_secs(20));
    tick_many(env, 5);
    assert_eq!(deleted_users_to_garbage_collect(env, canister_id), 0);
    assert_eq!(
        messages(&events(env, bob, canister_id, bob_id, alice_id)),
        vec![(alice_id, "hello".to_string()), (bob_id, "hi".to_string())]
    );

    // Deleting her again (eg. when the LocalUserIndex retries) succeeds without effect, and she is
    // in no groups or communities, which the LocalUserIndex looks up first
    let response = client::user::c2c_groups_and_communities(
        env,
        local_user_index,
        canister_id,
        &user_canister::c2c_groups_and_communities::Args { user_id: alice_id },
    );
    assert!(response.groups.is_empty() && response.communities.is_empty());
    delete_user(env, local_user_index, canister_id, alice_id);
    assert_eq!(user_count(env, canister_id), 1);

    // Her principal can register again, as a new user with a new index
    let response = client::multi_user::c2c_create_user(
        env,
        local_user_index,
        canister_id,
        &multi_user_canister::c2c_create_user::Args {
            principal: alice,
            username: random_string(),
            referred_by: None,
        },
    );
    let multi_user_canister::c2c_create_user::Response::Success(new_alice_id) = response else {
        panic!("{response:?}");
    };
    assert_eq!(new_alice_id.index(), 3);
    assert!(initial_state(env, alice, canister_id).direct_chats.summaries.is_empty());
}

fn delete_user(env: &mut PocketIc, local_user_index: CanisterId, canister_id: CanisterId, user_id: UserId) {
    let response = client::multi_user::c2c_delete_user(
        env,
        local_user_index,
        canister_id,
        &multi_user_canister::c2c_delete_user::Args { user_id },
    );
    assert!(matches!(response, types::SuccessOnly::Success));
}

fn deleted_users_to_garbage_collect(env: &PocketIc, canister_id: CanisterId) -> u32 {
    serde_json::from_value(metrics(env, canister_id)["deleted_users_to_garbage_collect"].clone()).unwrap()
}

#[test]
fn v2_events_are_applied_to_the_user_each_is_paired_with() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let local_user_index = client::user_index::happy_path::user_registration_canister(env, canister_ids.user_index);
    let canister_id =
        client::user_index::happy_path::create_multi_user_canister(env, *controller, canister_ids.user_index, local_user_index);
    let (alice, alice_id) = create_user(env, canister_ids, local_user_index, canister_id);
    let (bob, bob_id) = create_user(env, canister_ids, local_user_index, canister_id);
    let [group1, group2, group3]: [ChatId; 3] = [
        random_principal().into(),
        random_principal().into(),
        random_principal().into(),
    ];
    let community: CommunityId = random_principal().into();

    let joined_group = |env: &PocketIc, id: u64, chat_id: ChatId| {
        local_user_index_event(
            env,
            id,
            LocalUserIndexEvent::UserJoinedGroup(Box::new(UserJoinedGroup {
                chat_id,
                local_user_index_canister_id: local_user_index,
                latest_message_index: None,
                group_canister_timestamp: now_millis(env),
            })),
        )
    };

    // One call from the LocalUserIndex carries events for both users, interleaved, plus one for a
    // user who isn't in this canister, which is dropped
    let response = client::user::c2c_local_user_index_v2(
        env,
        local_user_index,
        canister_id,
        &user_canister::c2c_local_user_index_v2::Args {
            events: vec![
                paired(alice_id, joined_group(env, 1, group1)),
                paired(bob_id, joined_group(env, 2, group2)),
                paired(UserId::new_indexed(canister_id, 99), joined_group(env, 3, group3)),
                paired(alice_id, joined_group(env, 4, group3)),
                paired(
                    bob_id,
                    local_user_index_event(
                        env,
                        5,
                        LocalUserIndexEvent::UserJoinedCommunityOrChannel(Box::new(UserJoinedCommunityOrChannel {
                            community_id: community,
                            local_user_index_canister_id: local_user_index,
                            channels: Vec::new(),
                            community_canister_timestamp: now_millis(env),
                        })),
                    ),
                ),
            ],
        },
    );
    assert!(matches!(response, types::SuccessOnly::Success));

    let mut alices_groups = group_ids(&initial_state(env, alice, canister_id));
    alices_groups.sort();
    let mut expected = vec![group1, group3];
    expected.sort();
    assert_eq!(alices_groups, expected);
    let bobs_state = initial_state(env, bob, canister_id);
    assert_eq!(group_ids(&bobs_state), vec![group2]);
    assert_eq!(community_ids(&bobs_state), vec![community]);

    // A group's events only reach the users who are in it
    let now = now_millis(env);
    let achievement = |id| IdempotentEnvelope {
        created_at: now,
        idempotency_id: id,
        value: user_canister::GroupCanisterEvent::Achievement(Achievement::ReactedToMessage),
    };
    client::user::c2c_group_canister_v2(
        env,
        group2.into(),
        canister_id,
        &user_canister::c2c_group_canister_v2::Args {
            events: vec![paired(alice_id, achievement(1)), paired(bob_id, achievement(2))],
        },
    );
    assert!(!has_achievement(
        &initial_state(env, alice, canister_id),
        Achievement::ReactedToMessage
    ));
    assert!(has_achievement(
        &initial_state(env, bob, canister_id),
        Achievement::ReactedToMessage
    ));

    // Likewise for a community's
    let community_achievement = |id| IdempotentEnvelope {
        created_at: now,
        idempotency_id: id,
        value: user_canister::CommunityCanisterEvent::Achievement(Achievement::SentGiphy),
    };
    client::user::c2c_community_canister_v2(
        env,
        community.into(),
        canister_id,
        &user_canister::c2c_community_canister_v2::Args {
            events: vec![
                paired(alice_id, community_achievement(1)),
                paired(bob_id, community_achievement(2)),
            ],
        },
    );
    assert!(!has_achievement(
        &initial_state(env, alice, canister_id),
        Achievement::SentGiphy
    ));
    assert!(has_achievement(&initial_state(env, bob, canister_id), Achievement::SentGiphy));

    // Events are idempotent: an event already applied isn't applied again, nor is one older than
    // the latest applied from the same sender
    let group4: ChatId = random_principal().into();
    let group5: ChatId = random_principal().into();
    let now = now_millis(env);
    let joined_at = |id: u64, created_at: TimestampMillis, chat_id: ChatId| IdempotentEnvelope {
        created_at,
        idempotency_id: id,
        value: LocalUserIndexEvent::UserJoinedGroup(Box::new(UserJoinedGroup {
            chat_id,
            local_user_index_canister_id: local_user_index,
            latest_message_index: None,
            group_canister_timestamp: now,
        })),
    };
    send_local_user_index_events(env, local_user_index, canister_id, bob_id, vec![joined_at(10, now, group4)]);
    let response = client::user::c2c_local_user_index_v2(
        env,
        local_user_index,
        canister_id,
        &user_canister::c2c_local_user_index_v2::Args {
            events: vec![
                paired(bob_id, joined_at(10, now, group4)),
                paired(bob_id, joined_at(11, now - 1, group5)),
            ],
        },
    );
    assert!(matches!(response, types::SuccessOnly::Success));
    let mut bobs_groups = group_ids(&initial_state(env, bob, canister_id));
    bobs_groups.sort();
    let mut expected = vec![group2, group4];
    expected.sort();
    assert_eq!(bobs_groups, expected);
}

// Pairs an event with the user it is for, as the v2 endpoints take them
fn paired<E>(user_id: UserId, event: IdempotentEnvelope<E>) -> IdempotentEnvelope<(UserId, E)> {
    IdempotentEnvelope {
        created_at: event.created_at,
        idempotency_id: event.idempotency_id,
        value: (user_id, event.value),
    }
}

#[test]
fn events_from_users_in_other_canisters_are_applied_to_their_chats() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let local_user_index = client::user_index::happy_path::user_registration_canister(env, canister_ids.user_index);
    let canister_id =
        client::user_index::happy_path::create_multi_user_canister(env, *controller, canister_ids.user_index, local_user_index);
    let alice = client::register_user(env, canister_ids);
    let (bob, bob_id) = create_user(env, canister_ids, local_user_index, canister_id);
    let mut next_id = 0;
    let mut send = |env: &mut PocketIc, caller: Principal, sender: UserId, event: UserCanisterEvent| {
        next_id += 1;
        let response = client::user::c2c_user_canister_v2(
            env,
            caller,
            canister_id,
            &user_canister::c2c_user_canister_v2::Args {
                events: vec![IdempotentEnvelope {
                    created_at: now_millis(env),
                    idempotency_id: next_id,
                    value: user_canister::c2c_user_canister_v2::Event {
                        sender,
                        recipient: bob_id,
                        event,
                    },
                }],
            },
        );
        assert!(matches!(response, types::SuccessOnly::Success));
    };
    let send_text = |message_id: MessageId, sender_message_index: u32, text: &str| {
        UserCanisterEvent::SendMessages(Box::new(user_canister::SendMessagesArgs {
            messages: vec![user_canister::SendMessageArgs {
                thread_root_message_id: None,
                message_id,
                sender_message_index: sender_message_index.into(),
                content: chat_events::MessageContentInternal::Text(chat_events::TextContentInternal { text: text.to_string() }),
                replies_to: None,
                forwarding: false,
                block_level_markdown: false,
                message_filter_failed: None,
                og_previews: Vec::new(),
            }],
            sender_name: "alice".to_string(),
            sender_display_name: None,
            sender_avatar_id: None,
        }))
    };
    let chat = |env: &PocketIc| events(env, bob, canister_id, bob_id, alice.user_id);

    // Alice, a user in a User canister, messages Bob, creating his copy of their chat
    let message_id: MessageId = random_from_u128();
    send(env, alice.canister(), alice.user_id, send_text(message_id, 0, "hello"));
    assert_eq!(messages(&chat(env)), vec![(alice.user_id, "hello".to_string())]);
    assert!(has_achievement(
        &initial_state(env, bob, canister_id),
        Achievement::ReceivedDirectMessage
    ));

    // She edits it, reacts to it, marks Bob's messages read and sets the chat's time to live
    send(
        env,
        alice.canister(),
        alice.user_id,
        UserCanisterEvent::EditMessage(Box::new(user_canister::EditMessageArgs {
            thread_root_message_id: None,
            message_id,
            content: MessageContent::Text(TextContent {
                text: "edited".to_string(),
            }),
            block_level_markdown: None,
            og_previews: Vec::new(),
        })),
    );
    assert_eq!(messages(&chat(env)), vec![(alice.user_id, "edited".to_string())]);

    send(
        env,
        alice.canister(),
        alice.user_id,
        UserCanisterEvent::ToggleReaction(Box::new(user_canister::ToggleReactionArgs {
            thread_root_message_id: None,
            message_id,
            reaction: Reaction::new("👍".to_string()),
            added: true,
            username: "alice".to_string(),
            display_name: None,
            user_avatar_id: None,
        })),
    );
    assert_eq!(message(&chat(env), message_id).reactions.len(), 1);

    send(
        env,
        alice.canister(),
        alice.user_id,
        UserCanisterEvent::MarkMessagesRead(user_canister::MarkMessagesReadArgs { read_up_to: 0.into() }),
    );
    // Set after the chat was created, otherwise the two timestamps tie
    env.advance_time(Duration::from_millis(1));
    send(
        env,
        alice.canister(),
        alice.user_id,
        UserCanisterEvent::SetEventsTtl(Box::new(user_canister::SetEventsTtl {
            events_ttl: Some(3_600_000),
            timestamp: now_millis(env),
        })),
    );
    let summary = single_direct_chat_summary(initial_state(env, bob, canister_id));
    assert_eq!(summary.read_by_them_up_to, Some(0.into()));
    assert_eq!(summary.events_ttl, Some(3_600_000));

    // She deletes the message, then undeletes it
    let delete_args = || {
        Box::new(user_canister::DeleteUndeleteMessagesArgs {
            thread_root_message_id: None,
            message_ids: vec![message_id],
        })
    };
    send(
        env,
        alice.canister(),
        alice.user_id,
        UserCanisterEvent::DeleteMessages(delete_args()),
    );
    assert!(matches!(message(&chat(env), message_id).content, MessageContent::Deleted(_)));
    send(
        env,
        alice.canister(),
        alice.user_id,
        UserCanisterEvent::UndeleteMessages(delete_args()),
    );
    assert_eq!(messages(&chat(env)), vec![(alice.user_id, "edited".to_string())]);

    // A canister can't send events from a user it doesn't hold, and a canister which isn't an
    // OpenChat user can't send any
    send(
        env,
        random_principal(),
        alice.user_id,
        send_text(random_from_u128(), 1, "not from alice"),
    );
    let impostor = CanisterId::from_text("rrkah-fqaaa-aaaaa-aaaaq-cai").unwrap();
    send(
        env,
        impostor,
        impostor.into(),
        send_text(random_from_u128(), 0, "from nobody"),
    );
    assert_eq!(messages(&chat(env)), vec![(alice.user_id, "edited".to_string())]);
    assert!(
        initial_state(env, bob, canister_id)
            .direct_chats
            .summaries
            .iter()
            .all(|c| c.them == alice.user_id)
    );

    // A retried event isn't applied twice
    let retried = IdempotentEnvelope {
        created_at: now_millis(env),
        idempotency_id: 1_000,
        value: user_canister::c2c_user_canister_v2::Event {
            sender: alice.user_id,
            recipient: bob_id,
            event: send_text(random_from_u128(), 1, "once"),
        },
    };
    for _ in 0..2 {
        client::user::c2c_user_canister_v2(
            env,
            alice.canister(),
            canister_id,
            &user_canister::c2c_user_canister_v2::Args {
                events: vec![retried.clone()],
            },
        );
    }
    assert_eq!(
        messages(&chat(env)),
        vec![(alice.user_id, "edited".to_string()), (alice.user_id, "once".to_string())]
    );

    // An event for a user who isn't in this canister is dropped
    let response = client::user::c2c_user_canister_v2(
        env,
        alice.canister(),
        canister_id,
        &user_canister::c2c_user_canister_v2::Args {
            events: vec![IdempotentEnvelope {
                created_at: now_millis(env),
                idempotency_id: 1_001,
                value: user_canister::c2c_user_canister_v2::Event {
                    sender: alice.user_id,
                    recipient: UserId::new_indexed(canister_id, 99),
                    event: send_text(random_from_u128(), 2, "nobody"),
                },
            }],
        },
    );
    assert!(matches!(response, types::SuccessOnly::Success));

    // Once Bob blocks Alice her messages and edits no longer reach him
    block_user(env, bob, canister_id, alice.user_id);
    send(
        env,
        alice.canister(),
        alice.user_id,
        send_text(random_from_u128(), 3, "blocked"),
    );
    send(
        env,
        alice.canister(),
        alice.user_id,
        UserCanisterEvent::EditMessage(Box::new(user_canister::EditMessageArgs {
            thread_root_message_id: None,
            message_id,
            content: MessageContent::Text(TextContent {
                text: "edited while blocked".to_string(),
            }),
            block_level_markdown: None,
            og_previews: Vec::new(),
        })),
    );
    assert_eq!(
        messages(&chat(env)),
        vec![(alice.user_id, "edited".to_string()), (alice.user_id, "once".to_string())]
    );

    // Nor can she change the chat's TTL, and a blocked user Bob has no chat with can't create one
    let dave = client::register_user(env, canister_ids);
    block_user(env, bob, canister_id, dave.user_id);
    env.advance_time(Duration::from_millis(1));
    for blocked in [&alice, &dave] {
        send(
            env,
            blocked.canister(),
            blocked.user_id,
            UserCanisterEvent::SetEventsTtl(Box::new(user_canister::SetEventsTtl {
                events_ttl: Some(60_000),
                timestamp: now_millis(env),
            })),
        );
    }
    let summary = single_direct_chat_summary(initial_state(env, bob, canister_id));
    assert_eq!(summary.them, alice.user_id);
    assert_eq!(summary.events_ttl, Some(3_600_000));
}

#[test]
fn events_for_users_in_other_canisters_are_sent_to_their_canisters() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let local_user_index = client::user_index::happy_path::user_registration_canister(env, canister_ids.user_index);
    let canister_id =
        client::user_index::happy_path::create_multi_user_canister(env, *controller, canister_ids.user_index, local_user_index);
    let alice = client::register_user(env, canister_ids);
    let (bob, bob_id) = create_user(env, canister_ids, local_user_index, canister_id);

    // A recipient in another canister is looked up in the LocalUserIndex
    let unknown: UserId = CanisterId::from_text("rrkah-fqaaa-aaaaa-aaaaq-cai").unwrap().into();
    let response = client::multi_user::send_message(
        env,
        bob,
        canister_id,
        &send_message_args(unknown, "hello", random_from_u128()),
    );
    assert!(
        matches!(&response, user_canister::send_message_v2::Response::Error(e) if e.matches_code(OCErrorCode::TargetUserNotFound)),
        "{response:?}"
    );

    // So is a user in another canister whom Bob sets a time to live for before they have a chat,
    // which creates the chat. The principal a user signs in with isn't their user id.
    let carol = client::register_user(env, canister_ids);
    update_chat_settings(env, bob, canister_id, carol.user_id, OptionUpdate::SetToSome(60_000));
    assert!(
        initial_state(env, bob, canister_id)
            .direct_chats
            .summaries
            .iter()
            .any(|c| c.them == carol.user_id && c.events_ttl == Some(60_000))
    );
    for them in [unknown, carol.principal.into()] {
        let response = client::user::update_chat_settings(
            env,
            bob,
            canister_id,
            &user_canister::update_chat_settings::Args {
                user_id: them,
                events_ttl: OptionUpdate::SetToSome(60_000),
            },
        );
        assert!(
            matches!(&response, UnitResult::Error(e) if e.matches_code(OCErrorCode::TargetUserNotFound)),
            "{response:?}"
        );
    }
    let response = client::multi_user::send_message(
        env,
        bob,
        canister_id,
        &send_message_args(carol.principal.into(), "hello", random_from_u128()),
    );
    assert!(
        matches!(&response, user_canister::send_message_v2::Response::Error(e) if e.matches_code(OCErrorCode::TargetUserNotFound)),
        "{response:?}"
    );

    // Bob messages Alice, a user in a User canister, then edits, reacts to, deletes and undeletes
    // the message and sets the chat's time to live, each of which is held in his copy of the chat
    // and sent to Alice's canister
    let message_id: MessageId = random_from_u128();
    send_text_message(env, bob, canister_id, alice.user_id, "hello", message_id);
    edit_message(env, bob, canister_id, alice.user_id, None, message_id, "edited");
    toggle_reaction(
        env,
        bob,
        canister_id,
        alice.user_id,
        None,
        message_id,
        &Reaction::new("👍".to_string()),
        true,
    );
    delete_messages(env, bob, canister_id, alice.user_id, None, vec![message_id]);
    let response = client::user::undelete_messages(
        env,
        bob,
        canister_id,
        &user_canister::undelete_messages::Args {
            user_id: alice.user_id,
            thread_root_message_index: None,
            message_ids: vec![message_id],
        },
    );
    assert!(matches!(response, user_canister::undelete_messages::Response::Success(_)));
    update_chat_settings(env, bob, canister_id, alice.user_id, OptionUpdate::SetToSome(3_600_000));

    let bobs_chat = events(env, bob, canister_id, bob_id, alice.user_id);
    assert_eq!(messages(&bobs_chat), vec![(bob_id, "edited".to_string())]);
    assert_eq!(message(&bobs_chat, message_id).reactions.len(), 1);
    assert!(
        initial_state(env, bob, canister_id)
            .direct_chats
            .summaries
            .iter()
            .any(|c| c.them == alice.user_id && c.events_ttl == Some(3_600_000))
    );

    // The events are sent: a call which failed in a way which may succeed later would leave them
    // queued to be retried
    tick_many(env, 10);
    assert_eq!(queued_user_canister_events(env, canister_id), 0);

    // Alice's canister accepts Bob, whom it has no chat with yet, since the UserIndex confirms the
    // caller is a MultiUser canister, which only sends on behalf of the users it holds. Her copy of
    // the chat has his message, edited, undeleted and with his reaction, and the time to live.
    let alices_chat = client::user::happy_path::initial_state(env, &alice)
        .direct_chats
        .summaries
        .into_iter()
        .find(|c| c.them == bob_id)
        .expect("Alice has no chat with Bob");
    assert_eq!(alices_chat.events_ttl, Some(3_600_000));
    let alices_events = client::user::happy_path::events(env, &alice, bob_id, 0.into(), true, 10, 10);
    assert_eq!(messages(&alices_events), vec![(bob_id, "edited".to_string())]);
    assert_eq!(message(&alices_events, message_id).reactions.len(), 1);

    // A canister which isn't a User or MultiUser canister can't send as one of its "users"
    let impostor = CanisterId::from_text("rrkah-fqaaa-aaaaa-aaaaq-cai").unwrap();
    let response = client::user::c2c_user_canister_v2(
        env,
        impostor,
        canister_id,
        &user_canister::c2c_user_canister_v2::Args {
            events: vec![IdempotentEnvelope {
                created_at: now_millis(env),
                idempotency_id: 1,
                value: user_canister::c2c_user_canister_v2::Event {
                    sender: UserId::new_indexed(impostor, 1),
                    recipient: bob_id,
                    event: UserCanisterEvent::SetEventsTtl(Box::new(user_canister::SetEventsTtl {
                        events_ttl: Some(1),
                        timestamp: now_millis(env),
                    })),
                },
            }],
        },
    );
    assert!(matches!(response, types::SuccessOnly::Success));
    assert!(
        initial_state(env, bob, canister_id)
            .direct_chats
            .summaries
            .iter()
            .all(|c| c.them != UserId::new_indexed(impostor, 1))
    );

    // Nor can a canister whose user id is its canister id but which is a bot rather than a user
    let response = client::user::c2c_user_canister_v2(
        env,
        canister_ids.proposals_bot,
        canister_id,
        &user_canister::c2c_user_canister_v2::Args {
            events: vec![IdempotentEnvelope {
                created_at: now_millis(env),
                idempotency_id: 1,
                value: user_canister::c2c_user_canister_v2::Event {
                    sender: canister_ids.proposals_bot.into(),
                    recipient: bob_id,
                    event: UserCanisterEvent::SetEventsTtl(Box::new(user_canister::SetEventsTtl {
                        events_ttl: Some(1),
                        timestamp: now_millis(env),
                    })),
                },
            }],
        },
    );
    assert!(matches!(response, types::SuccessOnly::Success));
    assert!(
        initial_state(env, bob, canister_id)
            .direct_chats
            .summaries
            .iter()
            .all(|c| c.them != UserId::from(canister_ids.proposals_bot))
    );
}

fn queued_user_canister_events(env: &PocketIc, canister_id: CanisterId) -> u32 {
    serde_json::from_value(metrics(env, canister_id)["queued_user_canister_events"].clone()).unwrap()
}

#[test]
fn a_multi_user_canister_is_verified_once_then_trusted_for_any_of_its_users() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let local_user_index = client::user_index::happy_path::user_registration_canister(env, canister_ids.user_index);
    // Users are registered in the newest MultiUser canister, so each canister is filled before the
    // next is created
    let first =
        client::user_index::happy_path::create_multi_user_canister(env, *controller, canister_ids.user_index, local_user_index);
    let (_, alice_id) = create_user(env, canister_ids, local_user_index, first);
    let (_, bob_id) = create_user(env, canister_ids, local_user_index, first);
    let second =
        client::user_index::happy_path::create_multi_user_canister(env, *controller, canister_ids.user_index, local_user_index);
    tick_many(env, 5);
    let (carol, carol_id) = create_user(env, canister_ids, local_user_index, second);

    let message_from = |env: &PocketIc, id: u64, sender: UserId, text: &str| IdempotentEnvelope {
        created_at: now_millis(env),
        idempotency_id: id,
        value: user_canister::c2c_user_canister_v2::Event {
            sender,
            recipient: carol_id,
            event: UserCanisterEvent::SendMessages(Box::new(user_canister::SendMessagesArgs {
                messages: vec![user_canister::SendMessageArgs {
                    thread_root_message_id: None,
                    message_id: random_from_u128(),
                    sender_message_index: 0.into(),
                    content: chat_events::MessageContentInternal::Text(chat_events::TextContentInternal {
                        text: text.to_string(),
                    }),
                    replies_to: None,
                    forwarding: false,
                    block_level_markdown: false,
                    message_filter_failed: None,
                    og_previews: Vec::new(),
                }],
                sender_name: "sender".to_string(),
                sender_display_name: None,
                sender_avatar_id: None,
            })),
        },
    };

    // The second MultiUser canister confirms the first with the UserIndex, then caches it, so that
    // any of its users can message Carol, but it can't send as its own canister id
    assert_eq!(known_multi_user_canisters(env, second), 0);
    let first_batch = vec![
        message_from(env, 1, alice_id, "from alice"),
        message_from(env, 2, bob_id, "from bob"),
        message_from(env, 3, first.into(), "from the canister"),
    ];
    let response = client::user::c2c_user_canister_v2(
        env,
        first,
        second,
        &user_canister::c2c_user_canister_v2::Args { events: first_batch },
    );
    assert!(matches!(response, types::SuccessOnly::Success));
    assert_eq!(known_multi_user_canisters(env, second), 1);
    assert_eq!(
        messages(&events(env, carol, second, carol_id, alice_id)),
        vec![(alice_id, "from alice".to_string())]
    );
    assert_eq!(
        messages(&events(env, carol, second, carol_id, bob_id)),
        vec![(bob_id, "from bob".to_string())]
    );
    assert_eq!(initial_state(env, carol, second).direct_chats.summaries.len(), 2);

    // Once Carol blocks Bob his messages are skipped, while Alice's still arrive
    block_user(env, carol, second, bob_id);
    let response = client::user::c2c_user_canister_v2(
        env,
        first,
        second,
        &user_canister::c2c_user_canister_v2::Args {
            events: vec![
                message_from(env, 4, bob_id, "blocked"),
                message_from(env, 5, alice_id, "again"),
            ],
        },
    );
    assert!(matches!(response, types::SuccessOnly::Success));
    assert_eq!(
        messages(&events(env, carol, second, carol_id, alice_id)),
        vec![(alice_id, "from alice".to_string()), (alice_id, "again".to_string())]
    );
    assert_eq!(
        messages(&events(env, carol, second, carol_id, bob_id)),
        vec![(bob_id, "from bob".to_string())]
    );
}

fn known_multi_user_canisters(env: &PocketIc, canister_id: CanisterId) -> u32 {
    serde_json::from_value(metrics(env, canister_id)["known_multi_user_canisters"].clone()).unwrap()
}

fn multi_user_canister_count(env: &PocketIc, local_user_index: CanisterId) -> u64 {
    serde_json::from_value(metrics(env, local_user_index)["multi_user_canister_count"].clone()).unwrap()
}

// Users hold their own funds in their own wallets, so crypto is sent via ICRC2, pulled from the
// sender's wallet against an approval made under their own spender subaccount, to either a user in
// the same canister, whose wallet is under their principal, or one in a User canister, whose wallet
// is under their user id. An ICRC1 transfer would be made from the canister's own account, so is
// refused.
#[test]
fn users_send_crypto_from_their_own_wallets() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let local_user_index = client::user_index::happy_path::user_registration_canister(env, canister_ids.user_index);
    let canister_id =
        client::user_index::happy_path::create_multi_user_canister(env, *controller, canister_ids.user_index, local_user_index);

    let (a_principal, a) = create_user(env, canister_ids, local_user_index, canister_id);
    let (b_principal, b) = create_user(env, canister_ids, local_user_index, canister_id);
    let carol = client::register_user(env, canister_ids);

    let amount = 1_000_000;
    client::ledger::happy_path::transfer(env, *controller, canister_ids.icp_ledger, a_principal, 1_000_000_000);
    client::ledger::happy_path::approve(
        env,
        a_principal,
        canister_ids.icp_ledger,
        icrc_ledger_types::icrc1::account::Account {
            owner: canister_id,
            subaccount: Some(ledger_utils::spender_subaccount(a_principal)),
        },
        2 * (amount + ICP_TRANSFER_FEE),
    );

    let send_crypto = |env: &mut PocketIc, recipient: UserId, transfer: PendingCryptoTransaction| {
        client::multi_user::send_message(
            env,
            a_principal,
            canister_id,
            &user_canister::send_message_v2::Args {
                content: MessageContentInitial::Crypto(CryptoContent {
                    recipient,
                    transfer: CryptoTransaction::Pending(transfer),
                    caption: None,
                }),
                ..send_message_args(recipient, "", random_from_u128())
            },
        )
    };
    let icrc2_transfer = |env: &PocketIc, to: icrc1::Account| {
        PendingCryptoTransaction::ICRC2(icrc2::PendingCryptoTransaction {
            ledger: ICP_LEDGER_CANISTER_ID,
            token_symbol: ICP_SYMBOL.to_string(),
            amount,
            from: a_principal.into(),
            to,
            fee: ICP_TRANSFER_FEE,
            memo: None,
            created: now_millis(env) * 1_000_000,
        })
    };

    // To B, in the same canister
    let transfer = icrc2_transfer(env, b_principal.into());
    let response = send_crypto(env, b, transfer);
    assert!(
        matches!(response, user_canister::send_message_v2::Response::TransferSuccessV2(_)),
        "{response:?}"
    );
    assert_eq!(
        client::ledger::happy_path::balance_of(env, canister_ids.icp_ledger, b_principal),
        amount
    );
    assert!(matches!(
        events(env, b_principal, canister_id, b, a).events.last().unwrap().event,
        ChatEvent::Message(ref m) if matches!(m.content, MessageContent::Crypto(_))
    ));

    // To Carol, in a User canister
    let transfer = icrc2_transfer(env, icrc1::Account::legacy_for_user(carol.user_id));
    let response = send_crypto(env, carol.user_id, transfer);
    assert!(
        matches!(response, user_canister::send_message_v2::Response::TransferSuccessV2(_)),
        "{response:?}"
    );
    assert_eq!(
        client::ledger::happy_path::balance_of(env, canister_ids.icp_ledger, carol.user_id),
        amount
    );

    // An ICRC1 transfer, which only the account's owner can make
    let transfer = PendingCryptoTransaction::ICRC1(icrc1::PendingCryptoTransaction {
        ledger: ICP_LEDGER_CANISTER_ID,
        token_symbol: ICP_SYMBOL.to_string(),
        amount,
        to: b_principal.into(),
        fee: ICP_TRANSFER_FEE,
        memo: None,
        created: now_millis(env) * 1_000_000,
    });
    let response = send_crypto(env, b, transfer);
    assert!(
        matches!(&response, user_canister::send_message_v2::Response::Error(e) if e.matches_code(OCErrorCode::InvalidRequest)),
        "{response:?}"
    );

    let a_balance = client::ledger::happy_path::balance_of(env, canister_ids.icp_ledger, a_principal);

    // To B, but addressed to B's user id, which isn't where B holds their funds
    let transfer = icrc2_transfer(env, icrc1::Account::legacy_for_user(b));
    let response = send_crypto(env, b, transfer);
    assert!(
        matches!(&response, user_canister::send_message_v2::Response::Error(e) if e.matches_code(OCErrorCode::RecipientMismatch)),
        "{response:?}"
    );

    // In a thread which doesn't exist, which is refused before any funds are moved
    let transfer = icrc2_transfer(env, b_principal.into());
    let response = client::multi_user::send_message(
        env,
        a_principal,
        canister_id,
        &user_canister::send_message_v2::Args {
            thread_root_message_index: Some(99.into()),
            content: MessageContentInitial::Crypto(CryptoContent {
                recipient: b,
                transfer: CryptoTransaction::Pending(transfer),
                caption: None,
            }),
            ..send_message_args(b, "", random_from_u128())
        },
    );
    assert!(
        matches!(&response, user_canister::send_message_v2::Response::Error(e) if e.matches_code(OCErrorCode::ThreadNotFound)),
        "{response:?}"
    );
    assert_eq!(
        client::ledger::happy_path::balance_of(env, canister_ids.icp_ledger, a_principal),
        a_balance
    );

    // A can't spend an approval B made for themselves, even to pay B
    client::ledger::happy_path::approve(
        env,
        b_principal,
        canister_ids.icp_ledger,
        icrc_ledger_types::icrc1::account::Account {
            owner: canister_id,
            subaccount: Some(ledger_utils::spender_subaccount(b_principal)),
        },
        amount + ICP_TRANSFER_FEE,
    );
    let b_balance = client::ledger::happy_path::balance_of(env, canister_ids.icp_ledger, b_principal);
    let transfer = PendingCryptoTransaction::ICRC2(icrc2::PendingCryptoTransaction {
        ledger: ICP_LEDGER_CANISTER_ID,
        token_symbol: ICP_SYMBOL.to_string(),
        amount,
        from: b_principal.into(),
        to: b_principal.into(),
        fee: ICP_TRANSFER_FEE,
        memo: None,
        created: now_millis(env) * 1_000_000,
    });
    let response = send_crypto(env, b, transfer);
    assert!(
        matches!(&response, user_canister::send_message_v2::Response::Error(e) if e.matches_code(OCErrorCode::InsufficientAllowance)),
        "{response:?}"
    );
    assert_eq!(
        client::ledger::happy_path::balance_of(env, canister_ids.icp_ledger, b_principal),
        b_balance
    );
}

#[test]
fn tips_are_paid_from_the_tippers_own_wallet() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let local_user_index = client::user_index::happy_path::user_registration_canister(env, canister_ids.user_index);
    let canister_id =
        client::user_index::happy_path::create_multi_user_canister(env, *controller, canister_ids.user_index, local_user_index);
    let (alice, alice_id) = create_user(env, local_user_index, canister_id);
    let (bob, bob_id) = create_user(env, local_user_index, canister_id);
    let carol = client::register_user(env, canister_ids);

    let tip = 1_0000_0000;
    let ledger = canister_ids.icp_ledger;
    // Alice holds her funds in her own wallet, and approves this canister to pull them under her own
    // spender subaccount. Carol's are in her User canister's account.
    client::ledger::happy_path::transfer(env, *controller, ledger, alice, 10 * tip);
    client::ledger::happy_path::approve(
        env,
        alice,
        ledger,
        icrc_ledger_types::icrc1::account::Account {
            owner: canister_id,
            subaccount: Some(ledger_utils::spender_subaccount(alice)),
        },
        5 * (tip + ICP_TRANSFER_FEE),
    );
    client::ledger::happy_path::transfer(env, *controller, ledger, carol.user_id, 10 * tip);
    tick_many(env, 3);

    let tip_args = |chat: Chat, recipient: UserId, message_id| user_canister::tip_message::Args {
        chat,
        recipient,
        thread_root_message_index: None,
        message_id,
        ledger,
        token_symbol: ICP_SYMBOL.to_string(),
        amount: tip,
        fee: ICP_TRANSFER_FEE,
        decimals: 8,
        from_account: None,
        pin: None,
    };
    let alice_tips = |env: &mut PocketIc, recipient: UserId, message_id| {
        client::user::tip_message(
            env,
            alice,
            canister_id,
            &tip_args(Chat::Direct(recipient.into()), recipient, message_id),
        )
    };
    let tips_on = |message: Message| message.tips.iter().cloned().collect::<Vec<_>>();
    let tipped_by = |user_id: UserId| vec![(ledger, vec![(user_id, tip)])];

    // Alice tips Bob's message. Both are in this canister, so both copies of the chat are updated
    // directly, and the tip goes from Alice's wallet to Bob's.
    let message_id = random_from_u128();
    send_text_message(env, bob, canister_id, alice_id, "tip me", message_id);
    let response = alice_tips(env, bob_id, message_id);
    assert!(
        matches!(response, user_canister::tip_message::Response::Success),
        "{response:?}"
    );
    assert_eq!(
        tips_on(message(&events(env, alice, canister_id, alice_id, bob_id), message_id)),
        tipped_by(alice_id)
    );
    assert_eq!(
        tips_on(message(&events(env, bob, canister_id, bob_id, alice_id), message_id)),
        tipped_by(alice_id)
    );
    assert!(has_achievement(
        &initial_state(env, alice, canister_id),
        Achievement::TippedMessage
    ));
    assert!(has_achievement(
        &initial_state(env, bob, canister_id),
        Achievement::HadMessageTipped
    ));
    assert_eq!(client::ledger::happy_path::balance_of(env, ledger, bob), tip);

    // Alice tips Carol's message, into Carol's wallet, and Carol's canister is told
    send_text_message(env, alice, canister_id, carol.user_id, "hello", random_from_u128());
    tick_many(env, 3);
    let message_id = random_from_u128();
    client::user::happy_path::send_text_message(env, &carol, alice_id, "tip me too", Some(message_id));
    tick_many(env, 3);
    let response = alice_tips(env, carol.user_id, message_id);
    assert!(
        matches!(response, user_canister::tip_message::Response::Success),
        "{response:?}"
    );
    tick_many(env, 3);
    let carols_events = client::user::happy_path::events(env, &carol, alice_id, 0.into(), true, 10, 10);
    assert_eq!(tips_on(message(&carols_events, message_id)), tipped_by(alice_id));
    assert_eq!(client::ledger::happy_path::balance_of(env, ledger, carol.user_id), 11 * tip);

    // Carol tips Alice's message, and her canister tells this one. (Sent here as Carol's canister
    // would, since Carol's canister can't yet look up the wallet of a user created directly in this
    // canister, as this test's users are.)
    let message_id = random_from_u128();
    send_text_message(env, alice, canister_id, carol.user_id, "tip me back", message_id);
    tick_many(env, 3);
    let response = client::multi_user::c2c_user_canister_v2(
        env,
        carol.canister(),
        canister_id,
        &user_canister::c2c_user_canister_v2::Args {
            events: vec![IdempotentEnvelope {
                created_at: now_millis(env),
                idempotency_id: 1,
                value: user_canister::c2c_user_canister_v2::Event {
                    sender: carol.user_id,
                    recipient: alice_id,
                    event: UserCanisterEvent::TipMessage(Box::new(user_canister::TipMessageArgs {
                        thread_root_message_id: None,
                        message_id,
                        ledger,
                        token_symbol: ICP_SYMBOL.to_string(),
                        amount: tip,
                        decimals: 8,
                        username: carol.username(),
                        display_name: None,
                        user_avatar_id: None,
                    })),
                },
            }],
        },
    );
    assert!(matches!(response, types::SuccessOnly::Success));
    assert_eq!(
        tips_on(message(&events(env, alice, canister_id, alice_id, carol.user_id), message_id)),
        tipped_by(carol.user_id)
    );
    assert!(has_achievement(
        &initial_state(env, alice, canister_id),
        Achievement::HadMessageTipped
    ));

    // A tip can't be to oneself, must be on a message of the recipient's in a chat with them, can't
    // spend another user's approval, and in a group is given via the group; none of these move any
    // funds
    let alices_balance = client::ledger::happy_path::balance_of(env, ledger, alice);
    // Two tips, each with its transfer fee, and the fee for the approval
    assert_eq!(alices_balance, 10 * tip - 2 * (tip + ICP_TRANSFER_FEE) - ICP_TRANSFER_FEE);
    // A message of Alice's to Bob, for Bob to try tipping from Alice's wallet
    let alices_message_to_bob = random_from_u128();
    send_text_message(
        env,
        alice,
        canister_id,
        bob_id,
        "don't tip me from my wallet",
        alices_message_to_bob,
    );
    let refused = [
        (alice_tips(env, alice_id, message_id), OCErrorCode::CannotTipSelf),
        // A message which isn't there, or isn't the recipient's
        (alice_tips(env, bob_id, random_from_u128()), OCErrorCode::MessageNotFound),
        (
            client::user::tip_message(
                env,
                alice,
                canister_id,
                &tip_args(Chat::Direct(bob_id.into()), carol.user_id, message_id),
            ),
            OCErrorCode::RecipientMismatch,
        ),
        // Bob can't spend the approval Alice made for herself
        (
            client::user::tip_message(
                env,
                bob,
                canister_id,
                &user_canister::tip_message::Args {
                    from_account: Some(alice.into()),
                    ..tip_args(Chat::Direct(alice_id.into()), alice_id, alices_message_to_bob)
                },
            ),
            OCErrorCode::InsufficientAllowance,
        ),
        (
            client::user::tip_message(
                env,
                bob,
                canister_id,
                &tip_args(Chat::Direct(carol.user_id.into()), carol.user_id, message_id),
            ),
            OCErrorCode::ChatNotFound,
        ),
        (
            client::user::tip_message(
                env,
                alice,
                canister_id,
                &tip_args(Chat::Group(canister_ids.user_index.into()), bob_id, message_id),
            ),
            OCErrorCode::InvalidRequest,
        ),
    ];
    for (response, code) in refused {
        assert!(
            matches!(&response, user_canister::tip_message::Response::Error(e) if e.matches_code(code)),
            "{response:?}"
        );
    }
    assert_eq!(client::ledger::happy_path::balance_of(env, ledger, alice), alices_balance);
}
