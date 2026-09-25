use crate::env::ENV;
use crate::utils::{chat_token_info, icp_token_info, now_millis, tick_many};
use crate::{TestEnv, User, client};
use candid::Principal;
use constants::HOUR_IN_MS;
use oc_error_codes::OCErrorCode;
use pocket_ic::PocketIc;
use std::ops::Deref;
use std::time::Duration;
use testing::rng::{random_from_u128, random_string};
use types::{CanisterId, Chat, Document, MessageContentInitial, OptionUpdate, P2PSwapContentInitial};
use user_index_canister::start_user_migration::{Response, SuccessResult};

#[test]
fn start_user_migration_freezes_the_user_canister() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let user = client::register_user(env, canister_ids);

    let first = start_user_migration(env, *controller, canister_ids.user_index, &user, multi_user_canister(1));
    assert!(first.user_bytes > 0);

    // The canister is frozen, so its owner can't change it
    assert!(
        env.update_call(
            user.canister(),
            user.principal,
            "set_bio_msgpack",
            msgpack::serialize_then_unwrap(&user_canister::set_bio::Args { text: random_string() }),
        )
        .is_err()
    );

    // A repeated call returns the same size, since the user can't have changed
    let second = start_user_migration(env, *controller, canister_ids.user_index, &user, multi_user_canister(1));
    assert_eq!(first.user_bytes, second.user_bytes);
    assert_eq!(first.wasm_version, second.wasm_version);

    // A migration to another MultiUser canister can't start
    let response = client::user_index::start_user_migration(
        env,
        *controller,
        canister_ids.user_index,
        &user_index_canister::start_user_migration::Args {
            user_id: user.user_id,
            multi_user_canister_id: multi_user_canister(2),
        },
    );
    assert!(
        matches!(response, Response::Error(ref e) if e.matches_code(OCErrorCode::AlreadyInProgress)),
        "{response:?}"
    );
}

#[test]
fn user_with_a_message_reminder_is_not_ready_for_migration() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let user1 = client::register_user(env, canister_ids);
    let user2 = client::register_user(env, canister_ids);

    client::user::set_message_reminder_v2(
        env,
        user1.principal,
        user1.canister(),
        &user_canister::set_message_reminder_v2::Args {
            chat: Chat::Direct(user2.user_id.into()),
            thread_root_message_index: None,
            event_index: 10.into(),
            notes: None,
            remind_at: now_millis(env) + 60_000,
        },
    );

    let response = client::user_index::start_user_migration(
        env,
        *controller,
        canister_ids.user_index,
        &user_index_canister::start_user_migration::Args {
            user_id: user1.user_id,
            multi_user_canister_id: multi_user_canister(1),
        },
    );
    assert!(
        matches!(response, Response::Error(ref e) if e.matches_code(OCErrorCode::NotReadyForMigration)),
        "{response:?}"
    );

    // The canister isn't frozen, so its owner can still change it
    let response = client::user::set_bio(
        env,
        user1.principal,
        user1.canister(),
        &user_canister::set_bio::Args { text: random_string() },
    );
    assert!(matches!(response, types::UnitResult::Success), "{response:?}");
}

#[test]
fn users_with_a_p2p_swap_are_not_ready_for_migration() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let user1 = client::register_diamond_user(env, canister_ids, *controller);
    let user2 = client::register_user(env, canister_ids);

    let group_id = client::user::happy_path::create_group(env, &user1, &random_string(), true, true);
    client::group::happy_path::join_group(env, user2.principal, group_id);

    client::ledger::happy_path::transfer(env, *controller, canister_ids.icp_ledger, user1.user_id, 1_100_000_000);
    client::ledger::happy_path::transfer(env, *controller, canister_ids.chat_ledger, user2.user_id, 11_000_000_000);

    let message_id = random_from_u128();
    let response = client::user::send_message_with_transfer_to_group(
        env,
        user1.principal,
        user1.canister(),
        &user_canister::send_message_with_transfer_to_group::Args {
            group_id,
            thread_root_message_index: None,
            message_id,
            content: MessageContentInitial::P2PSwap(P2PSwapContentInitial {
                token0: icp_token_info(),
                token0_amount: 1_000_000_000,
                token1: chat_token_info(),
                token1_amount: 10_000_000_000,
                expires_in: HOUR_IN_MS,
                caption: None,
                from_account: None,
            }),
            sender_name: user1.username(),
            sender_display_name: None,
            replies_to: None,
            mentioned: Vec::new(),
            block_level_markdown: false,
            rules_accepted: None,
            message_filter_failed: None,
            pin: None,
            og_previews: Vec::new(),
        },
    );
    assert!(
        matches!(
            response,
            user_canister::send_message_with_transfer_to_group::Response::Success(_)
        ),
        "{response:?}"
    );

    let response = client::group::accept_p2p_swap(
        env,
        user2.principal,
        group_id.into(),
        &group_canister::accept_p2p_swap::Args {
            thread_root_message_index: None,
            message_id,
            pin: None,
            new_achievement: false,
            from_account: None,
        },
    );
    assert!(
        matches!(response, group_canister::accept_p2p_swap::Response::Success(_)),
        "{response:?}"
    );

    tick_many(env, 10);

    // Neither the user who created the swap nor the one who accepted it can be migrated, even once it
    // has been settled
    for user in [&user1, &user2] {
        let response = try_start_user_migration(env, *controller, canister_ids.user_index, user, multi_user_canister(1));
        assert!(
            matches!(response, Response::Error(ref e) if e.matches_code(OCErrorCode::NotReadyForMigration)
                && e.message() == Some("User has P2P swaps")),
            "{response:?}"
        );
    }
}

#[test]
fn migrating_user_is_exported() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let user1 = client::register_user(env, canister_ids);
    let user2 = client::register_user(env, canister_ids);
    // Together with the avatar and profile background below, these take up more than one page of
    // stable memory entries
    for _ in 0..40 {
        client::user::happy_path::send_text_message(env, &user1, user2.user_id, "x".repeat(5000), None);
    }
    client::user::happy_path::set_avatar(env, &user1, Some(document(800 * 1024)));
    client::user::happy_path::set_profile_background(
        env,
        &user1,
        &user_canister::set_profile_background::Args {
            profile_background: Some(document(1024 * 1024)),
        },
    );
    tick_many(env, 3);

    // The UserIndex stands in for the MultiUser canister, which pulls the export
    let started = start_user_migration(env, *controller, canister_ids.user_index, &user1, canister_ids.user_index);

    let response = client::user_index::export_migrating_user(
        env,
        *controller,
        canister_ids.user_index,
        &user_index_canister::export_migrating_user::Args { user_id: user1.user_id },
    );
    let user_index_canister::export_migrating_user::Response::Success(exported) = response else {
        panic!("'export_migrating_user' error: {response:?}");
    };

    assert_eq!(exported.user_bytes, started.user_bytes);
    // The avatar and profile background, and the direct chat's events and their indexes, among others
    assert!(exported.stable_memory_entries > 2);
    assert!(exported.stable_memory_bytes > 19 * 102 * 1024);
}

#[test]
fn only_the_multi_user_canister_being_migrated_to_can_export() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    // One user is being migrated to another MultiUser canister, and the other isn't being migrated
    let user1 = client::register_user(env, canister_ids);
    let user2 = client::register_user(env, canister_ids);
    start_user_migration(env, *controller, canister_ids.user_index, &user1, multi_user_canister(1));

    for user in [&user1, &user2] {
        let response = client::user_index::export_migrating_user(
            env,
            *controller,
            canister_ids.user_index,
            &user_index_canister::export_migrating_user::Args { user_id: user.user_id },
        );
        assert!(
            matches!(
                response,
                user_index_canister::export_migrating_user::Response::Error(ref e)
                    if e.matches_code(OCErrorCode::C2CError)
                        && e.message().is_some_and(|m| m.contains("not the MultiUser canister the user is being migrated to"))
            ),
            "{response:?}"
        );
    }
}

#[test]
fn cancelling_a_migration_unfreezes_the_user_canister() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let user1 = client::register_user(env, canister_ids);
    let user2 = client::register_user(env, canister_ids);

    // A disappearing message, whose timer job is cancelled when the migration starts
    client::user::happy_path::update_chat_settings(
        env,
        &user1,
        &user_canister::update_chat_settings::Args {
            user_id: user2.user_id,
            events_ttl: OptionUpdate::SetToSome(60_000),
        },
    );
    let message = client::user::happy_path::send_text_message(env, &user1, user2.user_id, random_string(), None);
    tick_many(env, 3);

    start_user_migration(env, *controller, canister_ids.user_index, &user1, multi_user_canister(1));
    // A cancellation of a migration to another MultiUser canister is rejected
    let response = client::user_index::cancel_user_migration(
        env,
        *controller,
        canister_ids.user_index,
        &user_index_canister::cancel_user_migration::Args {
            user_id: user1.user_id,
            multi_user_canister_id: multi_user_canister(2),
        },
    );
    assert!(
        matches!(response, user_index_canister::cancel_user_migration::Response::Error(ref e) if e.matches_code(OCErrorCode::AlreadyInProgress)),
        "{response:?}"
    );

    cancel_user_migration(env, *controller, canister_ids.user_index, &user1, multi_user_canister(1));

    // The canister is no longer frozen, so its owner can change it again
    let response = client::user::set_bio(
        env,
        user1.principal,
        user1.canister(),
        &user_canister::set_bio::Args { text: random_string() },
    );
    assert!(matches!(response, types::UnitResult::Success), "{response:?}");

    // The timer job removing the expired message was scheduled again
    env.advance_time(Duration::from_millis(60_000));
    tick_many(env, 3);
    assert!(
        client::user::happy_path::events_by_index(env, &user1, user2.user_id, vec![message.event_index])
            .events
            .is_empty()
    );

    // Cancelling again succeeds, since there is nothing left to cancel
    cancel_user_migration(env, *controller, canister_ids.user_index, &user1, multi_user_canister(1));

    // And the migration can be started again, to another MultiUser canister
    start_user_migration(env, *controller, canister_ids.user_index, &user1, multi_user_canister(2));
}

fn start_user_migration(
    env: &mut PocketIc,
    sender: Principal,
    user_index: CanisterId,
    user: &User,
    multi_user_canister_id: CanisterId,
) -> SuccessResult {
    match try_start_user_migration(env, sender, user_index, user, multi_user_canister_id) {
        Response::Success(result) => result,
        response => panic!("'start_user_migration' error: {response:?}"),
    }
}

fn try_start_user_migration(
    env: &mut PocketIc,
    controller: Principal,
    user_index_canister_id: CanisterId,
    user: &User,
    multi_user_canister_id: CanisterId,
) -> Response {
    client::user_index::start_user_migration(
        env,
        controller,
        user_index_canister_id,
        &user_index_canister::start_user_migration::Args {
            user_id: user.user_id,
            multi_user_canister_id,
        },
    )
}

fn cancel_user_migration(
    env: &mut PocketIc,
    sender: Principal,
    user_index: CanisterId,
    user: &User,
    multi_user_canister_id: CanisterId,
) {
    let response = client::user_index::cancel_user_migration(
        env,
        sender,
        user_index,
        &user_index_canister::cancel_user_migration::Args {
            user_id: user.user_id,
            multi_user_canister_id,
        },
    );
    assert!(
        matches!(response, user_index_canister::cancel_user_migration::Response::Success),
        "'cancel_user_migration' error: {response:?}"
    );
}

fn document(len: usize) -> Document {
    Document {
        id: random_from_u128(),
        mime_type: "image/png".to_string(),
        data: (0..len).map(|i| i as u8).collect(),
    }
}

// The id isn't checked, since the MultiUser canister does nothing with the migration yet
fn multi_user_canister(i: u8) -> CanisterId {
    Principal::from_slice(&[0, 0, 0, 0, 0, 0, 0, i, 1, 1])
}
