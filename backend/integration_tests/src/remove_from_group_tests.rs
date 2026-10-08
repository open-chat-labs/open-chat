use crate::client::{start_canister, stop_canister};
use crate::env::ENV;
use crate::utils::tick_many;
use crate::{CanisterIds, TestEnv, User, client};
use candid::Principal;
use constants::OPENCHAT_BOT_USER_ID;
use oc_error_codes::OCErrorCode;
use pocket_ic::PocketIc;
use std::ops::Deref;
use std::time::Duration;
use test_case::test_case;
use testing::rng::random_string;
use types::{ChatEvent, ChatId, EventIndex, MessageContent};

#[test_case(true)]
#[test_case(false)]
fn remove_group_member_succeeds(user_joins_group: bool) {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let TestData { user1, user2, group_id } = init_test_data(env, canister_ids, *controller, false, user_joins_group);

    let remove_member_response = client::group::remove_participant(
        env,
        user1.principal,
        group_id.into(),
        &group_canister::remove_participant::Args { user_id: user2.user_id },
    );

    assert!(matches!(
        remove_member_response,
        group_canister::remove_participant::Response::Success
    ));

    let response = client::group::happy_path::selected_initial(env, user1.principal, group_id);
    assert!(!response.invited_users.contains(&user2.user_id));
    assert!(!response.participants.iter().any(|m| m.user_id == user2.user_id));

    if user_joins_group {
        // The user's canister is told, so no longer lists the group
        tick_many(env, 3);
        let initial_state = client::user::happy_path::initial_state(env, &user2);
        assert!(!initial_state.group_chats.summaries.iter().any(|g| g.chat_id == group_id));
    }
}

// The direct call to the user's canister is retried for about 21 minutes. A canister unreachable for
// longer is still told, via the group's queue of events for users.
#[test]
fn removal_reaches_a_user_canister_unreachable_for_longer_than_the_direct_call_is_retried() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let TestData { user1, user2, group_id } = init_test_data(env, canister_ids, *controller, false, true);

    stop_canister(env, user2.local_user_index, user2.canister());

    let remove_member_response = client::group::remove_participant(
        env,
        user1.principal,
        group_id.into(),
        &group_canister::remove_participant::Args { user_id: user2.user_id },
    );
    assert!(matches!(
        remove_member_response,
        group_canister::remove_participant::Response::Success
    ));

    // The direct call makes 50 retries, each a second further apart than the last, so one per minute
    // here, with enough rounds each minute for a call to another subnet to complete
    for _ in 0..60 {
        env.advance_time(Duration::from_secs(60));
        tick_many(env, 10);
    }

    start_canister(env, user2.local_user_index, user2.canister());

    let mut removed = false;
    for _ in 0..10 {
        env.advance_time(Duration::from_secs(60));
        tick_many(env, 3);
        let initial_state = client::user::happy_path::initial_state(env, &user2);
        if !initial_state.group_chats.summaries.iter().any(|g| g.chat_id == group_id) {
            removed = true;
            break;
        }
    }
    assert!(removed);
    assert_eq!(removed_messages(env, &user2), 1);
}

// The messages from the OpenChat bot telling the user they were removed from a group
fn removed_messages(env: &PocketIc, user: &User) -> usize {
    client::user::happy_path::events(env, user, OPENCHAT_BOT_USER_ID, EventIndex::default(), true, 1000, 1000)
        .events
        .iter()
        .filter(|event| {
            matches!(&event.event, ChatEvent::Message(m)
                if matches!(&m.content, MessageContent::Text(content) if content.text.starts_with("You were removed from")))
        })
        .count()
}

#[test]
fn block_user_who_is_no_longer_group_member_succeeds() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let TestData { user1, user2, group_id } = init_test_data(env, canister_ids, *controller, true, true);

    client::user::happy_path::leave_group(env, &user2, group_id);

    let block_user_response = client::group::block_user(
        env,
        user1.principal,
        group_id.into(),
        &group_canister::block_user::Args { user_id: user2.user_id },
    );

    assert!(matches!(block_user_response, group_canister::block_user::Response::Success));

    let blocked_users = client::group::happy_path::selected_initial(env, user1.principal, group_id).blocked_users;

    assert!(blocked_users.contains(&user2.user_id));

    let join_group_response = client::local_user_index::join_group(
        env,
        user2.principal,
        canister_ids.local_user_index(env, group_id),
        &local_user_index_canister::join_group::Args {
            chat_id: group_id,
            invite_code: None,
            verified_credential_args: None,
            composite_gate_index: None,
        },
    );

    assert!(matches!(
        join_group_response,
        local_user_index_canister::join_group::Response::Error(e) if e.matches_code(OCErrorCode::InitiatorBlocked)
    ));
}

fn init_test_data(
    env: &mut PocketIc,
    canister_ids: &CanisterIds,
    controller: Principal,
    public: bool,
    user_joins_group: bool,
) -> TestData {
    let user1 = client::register_diamond_user(env, canister_ids, controller);
    let user2 = client::register_user(env, canister_ids);

    let group_name = random_string();

    let group_id = client::user::happy_path::create_group(env, &user1, &group_name, public, true);

    if !public {
        client::local_user_index::happy_path::invite_users_to_group(
            env,
            &user1,
            canister_ids.local_user_index(env, group_id),
            group_id,
            vec![user2.user_id],
        );
    }

    if user_joins_group {
        client::group::happy_path::join_group(env, user2.principal, group_id);
    }

    tick_many(env, 3);

    TestData { user1, user2, group_id }
}

struct TestData {
    user1: User,
    user2: User,
    group_id: ChatId,
}
