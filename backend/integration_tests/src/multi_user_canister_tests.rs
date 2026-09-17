use crate::env::ENV;
use crate::utils::{metrics, tick_many};
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
    BuildVersion, CanisterId, CanisterWasm, ChatEvent, EventsResponse, MessageContent, MessageContentInitial, MessageId,
    TextContent, UpgradesFilter, UserId,
};

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
    // The rolling upgrade stops, upgrades then restarts the canister across several rounds
    tick_many(env, 20);

    assert_eq!(wasm_version(env, canister_id), new_version);
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
    tick_many(env, 20);
    assert_eq!(wasm_version(env, canister_id), BuildVersion::new(0, 0, 1));
    assert_eq!(user_count(env, canister_id), 2);
    assert!(matches!(bio(env, user_ids[1]), Ok(user_canister::bio::Response::Success(_))));
}

#[test]
fn users_in_the_same_multi_user_canister_share_one_copy_of_their_direct_chat() {
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

    // A's first message to B creates the chat for both of them, over a single core
    let message_id = random_from_u128();
    let sent = send_text_message(env, a_principal, canister_id, b, "hello", message_id);
    assert_eq!(sent.chat_id, b.into());
    assert_eq!(sent.message_index, 0.into());
    assert_eq!(direct_chat_cores(env, canister_id), 1);

    // B sees A's message without anything having been sent between canisters, and replies
    let reply = send_text_message(env, b_principal, canister_id, a, "hi", random_from_u128());
    assert_eq!(reply.chat_id, a.into());
    assert_eq!(reply.message_index, 1.into());
    assert_eq!(direct_chat_cores(env, canister_id), 1);

    // Both users read the same events, each from their own side of the chat
    let expected = vec![(a, "hello".to_string()), (b, "hi".to_string())];
    let a_events = events(env, a_principal, canister_id, a, b);
    let b_events = events(env, b_principal, canister_id, b, a);
    assert_eq!(messages(&a_events), expected);
    assert_eq!(messages(&b_events), expected);
    assert_eq!(a_events.latest_event_index, 2.into());
    assert_eq!(b_events.latest_event_index, 2.into());
    assert_eq!(a_events.chat_last_updated, b_events.chat_last_updated);

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

    // A chat with yourself has a single user
    let note = send_text_message(env, a_principal, canister_id, a, "note to self", random_from_u128());
    assert_eq!(note.chat_id, a.into());
    assert_eq!(note.message_index, 0.into());
    assert_eq!(direct_chat_cores(env, canister_id), 2);
    assert_eq!(
        messages(&events(env, a_principal, canister_id, a, a)),
        vec![(a, "note to self".to_string())]
    );
}

#[test]
fn a_user_who_deletes_a_shared_direct_chat_gets_it_back_without_the_old_events() {
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

    // A deletes their side of the chat. B still has theirs, so the core stays
    delete_direct_chat(env, a_principal, canister_id, b);
    assert_eq!(direct_chat_cores(env, canister_id), 1);
    let deleted = client::multi_user::events(env, a_principal, canister_id, &events_args(a, b));
    assert!(
        matches!(&deleted, user_canister::events::Response::Error(e) if e.matches_code(OCErrorCode::ChatNotFound)),
        "{deleted:?}"
    );
    assert_eq!(
        messages(&events(env, b_principal, canister_id, b, a)),
        vec![(a, "hello".to_string()), (b, "hi".to_string())]
    );

    // B's next message gives A the chat back, over the same core, but only from that message on
    let again = send_text_message(env, b_principal, canister_id, a, "still there?", random_from_u128());
    assert_eq!(again.message_index, 2.into());
    assert_eq!(direct_chat_cores(env, canister_id), 1);
    let a_events = events(env, a_principal, canister_id, a, b);
    assert_eq!(messages(&a_events), vec![(b, "still there?".to_string())]);
    assert_eq!(a_events.latest_event_index, 3.into());
    assert_eq!(messages(&events(env, b_principal, canister_id, b, a)).len(), 3);

    // Once both have deleted the chat the core goes too, and its stable memory entries with it
    delete_direct_chat(env, a_principal, canister_id, b);
    assert_eq!(direct_chat_cores(env, canister_id), 1);
    delete_direct_chat(env, b_principal, canister_id, a);
    assert_eq!(direct_chat_cores(env, canister_id), 0);
    assert!(stable_memory_keys_to_garbage_collect(env, canister_id) > 0);
    env.advance_time(Duration::from_secs(15));
    tick_many(env, 3);
    assert_eq!(stable_memory_keys_to_garbage_collect(env, canister_id), 0);

    // A fresh chat between them starts from scratch for both
    let fresh = send_text_message(env, a_principal, canister_id, b, "fresh start", random_from_u128());
    assert_eq!(fresh.message_index, 0.into());
    assert_eq!(direct_chat_cores(env, canister_id), 1);
    let expected = vec![(a, "fresh start".to_string())];
    assert_eq!(messages(&events(env, a_principal, canister_id, a, b)), expected);
    assert_eq!(messages(&events(env, b_principal, canister_id, b, a)), expected);
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

fn direct_chat_cores(env: &PocketIc, canister_id: CanisterId) -> u32 {
    serde_json::from_value(metrics(env, canister_id)["direct_chat_cores"].clone()).unwrap()
}

fn stable_memory_keys_to_garbage_collect(env: &PocketIc, canister_id: CanisterId) -> u32 {
    serde_json::from_value(metrics(env, canister_id)["stable_memory_keys_to_garbage_collect"].clone()).unwrap()
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

fn wasm_version(env: &PocketIc, canister_id: CanisterId) -> BuildVersion {
    serde_json::from_value(metrics(env, canister_id)["wasm_version"].clone()).unwrap()
}

fn multi_user_canisters(env: &PocketIc, user_index_canister_id: CanisterId) -> Vec<(CanisterId, CanisterId)> {
    serde_json::from_value(metrics(env, user_index_canister_id)["multi_user_canisters"].clone()).unwrap()
}
