use crate::env::ENV;
use crate::setup::install_icrc_ledger;
use crate::utils::{chat_token_info, icp_token_info, metrics, now_millis, tick_many};
use crate::{CanisterIds, TestEnv, User, client, wasms};
use candid::{CandidType, Nat, Principal};
use constants::{DAY_IN_MS, HOUR_IN_MS, MINUTE_IN_MS, OPENCHAT_BOT_USER_ID};
use ic_stable_structures::memory_manager::MemoryId;
use local_user_index_canister::move_funds_from_old_canister::{MoveFundsResult, Response as MoveFundsResponse};
use oc_error_codes::OCErrorCode;
use pocket_ic::PocketIc;
use stable_memory_map::KeyType;
use std::collections::BTreeMap;
use std::ops::Deref;
use std::time::Duration;
use test_case::test_case;
use testing::rng::{random_from_u128, random_principal, random_string};
use types::{
    BotDefinition, BotInstallationLocation, BotPermissions, BuildVersion, CanisterId, CanisterWasm, Chat, ChatId,
    CommunityRole, DiamondMembershipPlanDuration, Document, Empty, IdempotentEnvelope, MessageContent, MessageContentInitial,
    MessageIndex, OptionUpdate, P2PSwapContentInitial, ReferralStatus, UserId,
};
use user_canister::UserCanisterEvent;
use user_index_canister::user_migration::UserMigrationStatus;

const CALL_RELAY_WASM: &[u8] = include_bytes!("../../canisters/call_relay/call_relay.wasm");

#[test]
fn users_with_a_p2p_swap_are_not_migrated_until_an_hour_after_it_expires() {
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

    let operator = platform_operator(env, canister_ids, *controller);
    migrate_users(
        env,
        operator.principal,
        canister_ids.user_index,
        vec![user1.user_id, user2.user_id],
        Some(multi_user_canister(1)),
    );
    wait_for_migration_attempts_to_run_out(env);

    // Neither the user who created the swap nor the one who accepted it is migrated while it may still
    // pay out or refund to their canister, even though it has been settled
    for user in [&user1, &user2] {
        let status = user_migration_status(env, operator.principal, canister_ids.user_index, user.user_id);
        assert!(
            matches!(status, Some(UserMigrationStatus::Failed { ref error, .. })
                if error.matches_code(OCErrorCode::NotReadyForMigration)
                    && error.message() == Some("User has a P2P swap which hasn't yet expired")),
            "{status:?}"
        );
    }

    // An hour after the swap has expired, both are migrated
    env.advance_time(Duration::from_millis(2 * HOUR_IN_MS));
    migrate_users(
        env,
        operator.principal,
        canister_ids.user_index,
        vec![user1.user_id, user2.user_id],
        Some(multi_user_canister(1)),
    );
    tick_many(env, 10);

    for user in [&user1, &user2] {
        started_migration(env, operator.principal, canister_ids.user_index, user.user_id);
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
    let operator = platform_operator(env, canister_ids, *controller);
    migrate_users(
        env,
        operator.principal,
        canister_ids.user_index,
        vec![user1.user_id],
        Some(canister_ids.user_index),
    );
    tick_many(env, 10);
    let started = started_migration(env, operator.principal, canister_ids.user_index, user1.user_id);

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
    start_migration(env, canister_ids, *controller, &user1, multi_user_canister(1));

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

    let operator = platform_operator(env, canister_ids, *controller);
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

    start_migration(env, canister_ids, *controller, &user1, multi_user_canister(1));
    // A cancellation of a migration to another MultiUser canister is rejected
    let response = client::user_index::cancel_user_migration(
        env,
        operator.principal,
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

    cancel_user_migration(
        env,
        operator.principal,
        canister_ids.user_index,
        &user1,
        multi_user_canister(1),
    );

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
    cancel_user_migration(
        env,
        operator.principal,
        canister_ids.user_index,
        &user1,
        multi_user_canister(1),
    );

    // And the migration can be started again, to another MultiUser canister
    start_migration(env, canister_ids, *controller, &user1, multi_user_canister(2));
}

#[test]
fn cancelled_migration_is_never_imported() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let operator = platform_operator(env, canister_ids, *controller);
    let local_user_index = client::user_index::happy_path::user_registration_canister(env, canister_ids.user_index);
    let multi_user_canister =
        client::user_index::happy_path::create_multi_user_canister(env, *controller, canister_ids, local_user_index);
    let user = client::register_user(env, canister_ids);

    // The MultiUser canister is stopped, so it can't start importing the user
    env.stop_canister(multi_user_canister, Some(local_user_index)).unwrap();
    migrate_users(
        env,
        operator.principal,
        canister_ids.user_index,
        vec![user.user_id],
        Some(multi_user_canister),
    );
    tick_many(env, 10);
    assert!(matches!(
        user_migration_status(env, operator.principal, canister_ids.user_index, user.user_id),
        Some(UserMigrationStatus::Started { .. })
    ));

    // Nor can it be made to abandon the import, so the migration isn't cancelled
    let cancel = |env: &mut PocketIc| {
        client::user_index::cancel_user_migration(
            env,
            operator.principal,
            canister_ids.user_index,
            &user_index_canister::cancel_user_migration::Args {
                user_id: user.user_id,
                multi_user_canister_id: multi_user_canister,
            },
        )
    };
    let response = cancel(env);
    assert!(
        matches!(response, user_index_canister::cancel_user_migration::Response::Error(_)),
        "{response:?}"
    );
    assert!(
        env.update_call(
            user.canister(),
            user.principal,
            "set_bio_msgpack",
            msgpack::serialize_then_unwrap(&user_canister::set_bio::Args { text: random_string() }),
        )
        .is_err()
    );

    env.start_canister(multi_user_canister, Some(local_user_index)).unwrap();
    let response = cancel(env);
    assert!(
        matches!(response, user_index_canister::cancel_user_migration::Response::Success),
        "{response:?}"
    );
    assert_eq!(
        user_migration_status(env, operator.principal, canister_ids.user_index, user.user_id),
        None
    );

    // The LocalUserIndex tries again to have the MultiUser canister import the user, which it refuses
    for _ in 0..3 {
        env.advance_time(Duration::from_secs(31));
        tick_many(env, 5);
    }
    assert_eq!(metrics(env, multi_user_canister)["user_imports_in_progress"], 0);
    assert_eq!(
        user_migration_status(env, operator.principal, canister_ids.user_index, user.user_id),
        None
    );

    // Migrating the user again to the same MultiUser canister imports them, even though they haven't
    // changed, since the new migration is told apart from the cancelled one
    migrate_users(
        env,
        operator.principal,
        canister_ids.user_index,
        vec![user.user_id],
        Some(multi_user_canister),
    );
    wait_for_import(env, operator.principal, canister_ids.user_index, user.user_id);
}

#[test]
fn stalled_migration_is_cancelled() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let operator = platform_operator(env, canister_ids, *controller);
    let user = client::register_user(env, canister_ids);

    // Migrated to a canister which doesn't import users, so the migration makes no more progress
    start_migration(env, canister_ids, *controller, &user, multi_user_canister(1));
    env.advance_time(Duration::from_millis(30 * MINUTE_IN_MS));
    tick_many(env, 5);
    assert!(matches!(
        user_migration_status(env, operator.principal, canister_ids.user_index, user.user_id),
        Some(UserMigrationStatus::Started { .. })
    ));

    env.advance_time(Duration::from_millis(40 * MINUTE_IN_MS));
    tick_many(env, 10);

    let status = user_migration_status(env, operator.principal, canister_ids.user_index, user.user_id);
    assert!(
        matches!(status, Some(UserMigrationStatus::Failed { ref error, .. }) if error.matches_code(OCErrorCode::UserMigrationStalled)),
        "{status:?}"
    );
    // The canister is no longer frozen, so its owner can change it again
    let response = client::user::set_bio(
        env,
        user.principal,
        user.canister(),
        &user_canister::set_bio::Args { text: random_string() },
    );
    assert!(matches!(response, types::UnitResult::Success), "{response:?}");
}

#[test]
fn migration_which_fails_to_start_is_tracked_until_cancelled() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let operator = platform_operator(env, canister_ids, *controller);
    let user = client::register_user(env, canister_ids);

    // The user's canister is stopped, so every call to start the migration fails, as would one whose
    // reply was lost after it had frozen the canister
    env.stop_canister(user.canister(), Some(user.local_user_index)).unwrap();
    migrate_users(
        env,
        operator.principal,
        canister_ids.user_index,
        vec![user.user_id],
        Some(multi_user_canister(1)),
    );
    for _ in 0..25 {
        env.advance_time(Duration::from_secs(31));
        tick_many(env, 3);
    }

    // The migration can't be cancelled while the canister can't be reached, so it isn't recorded as
    // having failed, but is kept track of
    assert!(matches!(
        user_migration_status(env, operator.principal, canister_ids.user_index, user.user_id),
        Some(UserMigrationStatus::Requested { .. })
    ));

    // Once the canister can be reached, the migration is cancelled when it stalls
    env.start_canister(user.canister(), Some(user.local_user_index)).unwrap();
    env.advance_time(Duration::from_millis(HOUR_IN_MS));
    tick_many(env, 10);
    let status = user_migration_status(env, operator.principal, canister_ids.user_index, user.user_id);
    assert!(
        matches!(status, Some(UserMigrationStatus::Failed { ref error, .. }) if error.matches_code(OCErrorCode::UserMigrationStalled)),
        "{status:?}"
    );
    let response = client::user::set_bio(
        env,
        user.principal,
        user.canister(),
        &user_canister::set_bio::Args { text: random_string() },
    );
    assert!(matches!(response, types::UnitResult::Success), "{response:?}");
}

#[test]
fn migrate_users_starts_migrating_each_user_to_a_multi_user_canister() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let operator = platform_operator(env, canister_ids, *controller);
    let local_user_index = client::user_index::happy_path::user_registration_canister(env, canister_ids.user_index);
    client::user_index::happy_path::create_multi_user_canister(env, *controller, canister_ids, local_user_index);
    let user = client::register_user(env, canister_ids);
    let before = user_migration_metrics(env, canister_ids.user_index);

    let queued = migrate_users(env, operator.principal, canister_ids.user_index, vec![user.user_id], None);
    assert_eq!(queued, vec![user.user_id]);
    // The user's canister was only just created, so may take a dozen rounds to handle its first message
    tick_until(env, |env| {
        user_migration_metrics(env, canister_ids.user_index).started_or_imported() > before.started_or_imported()
    });

    let after = user_migration_metrics(env, canister_ids.user_index);
    assert_eq!(after.started_or_imported(), before.started_or_imported() + 1);
    assert_eq!(after.failed, before.failed);

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

    // A user already being migrated isn't queued again
    assert!(migrate_users(env, operator.principal, canister_ids.user_index, vec![user.user_id], None).is_empty());
}

#[test]
fn migrated_user_is_imported_into_the_multi_user_canister() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let operator = platform_operator(env, canister_ids, *controller);
    let local_user_index = client::user_index::happy_path::user_registration_canister(env, canister_ids.user_index);
    let multi_user_canister =
        client::user_index::happy_path::create_multi_user_canister(env, *controller, canister_ids, local_user_index);
    let (user1, user1_auth) = client::register_user_and_include_auth(env, canister_ids);
    let user2 = client::register_diamond_user(env, canister_ids, *controller);
    let group_id = client::user::happy_path::create_group(env, &user2, &random_string(), true, true);
    client::group::happy_path::join_group(env, user1.principal, group_id);
    // Messages to another user and to themselves, and an avatar and profile background large enough
    // that the stable memory map entries are pulled in more than one page
    for _ in 0..40 {
        client::user::happy_path::send_text_message(env, &user1, user2.user_id, "x".repeat(5000), None);
    }
    let message_to_user2 = random_string();
    client::user::happy_path::send_text_message(env, &user1, user2.user_id, message_to_user2.clone(), None);
    let message_to_self = random_string();
    client::user::happy_path::send_text_message(env, &user1, user1.user_id, message_to_self.clone(), None);
    let avatar = document(800 * 1024);
    let avatar_id = avatar.id;
    client::user::happy_path::set_avatar(env, &user1, Some(avatar));
    client::user::happy_path::set_profile_background(
        env,
        &user1,
        &user_canister::set_profile_background::Args {
            profile_background: Some(document(1024 * 1024)),
        },
    );
    tick_many(env, 3);

    migrate_users(
        env,
        operator.principal,
        canister_ids.user_index,
        vec![user1.user_id],
        Some(multi_user_canister),
    );
    let new_user_id = wait_for_import(env, operator.principal, canister_ids.user_index, user1.user_id);
    assert_eq!(new_user_id.canister_id(), multi_user_canister);
    assert_eq!(metrics(env, multi_user_canister)["user_imports_in_progress"], 0);

    // The user is switched over to their new id, which they are found by from then on
    let current_user = client::user_index::happy_path::current_user(env, user1.principal, canister_ids.user_index);
    assert_eq!(current_user.user_id, new_user_id);
    assert_eq!(current_user.previous_user_ids, vec![user1.user_id]);
    let summary = client::user_index::happy_path::user(env, canister_ids.user_index, user1.user_id);
    assert_eq!(summary.user_id, new_user_id);
    assert_eq!(summary.previous_user_ids, vec![user1.user_id]);
    let identity_canister::check_auth_principal_v2::Response::Success(auth) =
        client::identity::check_auth_principal_v2(env, user1_auth.auth_principal(), canister_ids.identity, &Empty {})
    else {
        panic!("Auth principal not found");
    };
    assert_eq!(auth.user_id, Some(new_user_id));
    // As they are by their groups, once each has been told
    tick_many(env, 10);
    let members = client::group::happy_path::selected_initial(env, user2.principal, group_id).basic_members;
    assert!(members.contains(&new_user_id));
    assert!(!members.contains(&user1.user_id));

    // The user's old canister no longer serves them
    assert!(
        env.update_call(
            user1.canister(),
            user1.principal,
            "set_bio_msgpack",
            msgpack::serialize_then_unwrap(&user_canister::set_bio::Args { text: random_string() }),
        )
        .is_err()
    );
    // And the migration can no longer be cancelled
    let response = client::user_index::cancel_user_migration(
        env,
        operator.principal,
        canister_ids.user_index,
        &user_index_canister::cancel_user_migration::Args {
            user_id: user1.user_id,
            multi_user_canister_id: multi_user_canister,
        },
    );
    assert!(
        matches!(response, user_index_canister::cancel_user_migration::Response::Error(ref e) if e.matches_code(OCErrorCode::InvalidRequest)),
        "{response:?}"
    );

    // The user, now held by the MultiUser canister, has their chats and avatar, with their chat with
    // themselves under their new id
    let user_canister::initial_state::Response::Success(state) = client::user::initial_state(
        env,
        user1.principal,
        multi_user_canister,
        &user_canister::initial_state::Args {},
    );
    assert_eq!(state.avatar_id, Some(avatar_id));
    let latest_message = |them: UserId| {
        let chat = state
            .direct_chats
            .summaries
            .iter()
            .find(|c| c.them == them)
            .unwrap_or_else(|| panic!("No chat with {them}"));
        match &chat.latest_message.as_ref().unwrap().event.content {
            MessageContent::Text(text) => text.text.clone(),
            content => panic!("Unexpected content: {content:?}"),
        }
    };
    assert_eq!(latest_message(user2.user_id), message_to_user2);
    assert_eq!(latest_message(new_user_id), message_to_self);
    assert!(!state.direct_chats.summaries.iter().any(|c| c.them == user1.user_id));
    // And the OpenChat bot has told them of their new wallet address, which is their principal
    let migrated_message = latest_message(OPENCHAT_BOT_USER_ID);
    assert!(
        migrated_message.contains(&format!("\n\n{}\n\n", user1.principal)),
        "{migrated_message}"
    );

    // The old canister is uninstalled and its cycles are refunded
    crate::delete_user_tests::wait_for_cycles_to_be_refunded(env, &user1);
    assert_eq!(metrics(env, user1.local_user_index)["users_to_close_out_pending"], 0);

    // Messages sent to the user's old id are sent on to their new id
    let message_to_old_id = random_string();
    client::user::happy_path::send_text_message(env, &user2, user1.user_id, message_to_old_id.clone(), None);
    tick_many(env, 10);
    let user_canister::initial_state::Response::Success(state) = client::user::initial_state(
        env,
        user1.principal,
        multi_user_canister,
        &user_canister::initial_state::Args {},
    );
    let chat = state.direct_chats.summaries.iter().find(|c| c.them == user2.user_id).unwrap();
    match &chat.latest_message.as_ref().unwrap().event.content {
        MessageContent::Text(text) => assert_eq!(text.text, message_to_old_id),
        content => panic!("Unexpected content: {content:?}"),
    }
}

#[test]
fn migrated_user_moves_the_funds_held_by_their_old_canister_to_their_wallet() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let operator = platform_operator(env, canister_ids, *controller);
    let local_user_index = client::user_index::happy_path::user_registration_canister(env, canister_ids.user_index);
    let multi_user_canister =
        client::user_index::happy_path::create_multi_user_canister(env, *controller, canister_ids, local_user_index);
    let user = client::register_user(env, canister_ids);
    let other_user = client::register_user(env, canister_ids);
    // Ledgers of this test's own, known to the Registry, with fees of 10_000. The test env's ICP
    // ledger isn't used, since the Registry marks it as uninstalled, having been set up before it.
    let abc_ledger = install_registered_ledger(env, canister_ids, *controller, "ABC");
    let def_ledger = install_registered_ledger(env, canister_ids, *controller, "DEF");
    let ghi_ledger = install_registered_ledger(env, canister_ids, *controller, "GHI");
    let xyz_ledger = install_registered_ledger(env, canister_ids, *controller, "XYZ");
    let balance = 1_000_000_000;
    client::ledger::happy_path::transfer(env, *controller, abc_ledger, user.user_id, balance);
    client::ledger::happy_path::transfer(env, *controller, def_ledger, user.user_id, balance);
    // Too little GHI to be worth moving, since it doesn't exceed the fee
    client::ledger::happy_path::transfer(env, *controller, ghi_ledger, user.user_id, 10_000);
    // Enough XYZ to be worth moving at the Registry's fee, but not once its fee is raised
    client::ledger::happy_path::transfer(env, *controller, xyz_ledger, user.user_id, 15_000);

    migrate_users(
        env,
        operator.principal,
        canister_ids.user_index,
        vec![user.user_id],
        Some(multi_user_canister),
    );
    wait_for_import(env, operator.principal, canister_ids.user_index, user.user_id);

    // Once the old canister is uninstalled its cycles are refunded, so it has to be topped up for
    // the relay to be installed on it
    crate::delete_user_tests::wait_for_cycles_to_be_refunded(env, &user);

    // The LocalUserIndexes refresh the tokens from the Registry daily, after which the fees of ABC
    // and XYZ are raised, leaving the LocalUserIndexes with the old ones
    env.advance_time(Duration::from_secs(25 * 60 * 60));
    tick_many(env, 10);
    set_ledger_fee(env, *controller, abc_ledger, 20_000);
    set_ledger_fee(env, *controller, xyz_ledger, 20_000);

    // The UserIndex is not a ledger known to the Registry, so fails, but doesn't stop the funds on
    // the others moving
    let args = local_user_index_canister::move_funds_from_old_canister::Args {
        old_user_id: user.user_id,
        ledgers: vec![abc_ledger, def_ledger, ghi_ledger, xyz_ledger, canister_ids.user_index],
    };
    let move_funds = |env: &mut PocketIc, sender: Principal, local_user_index: CanisterId| {
        client::local_user_index::move_funds_from_old_canister(env, sender, local_user_index, &args)
    };
    let is_error = |response: &MoveFundsResponse, code: OCErrorCode| matches!(response, MoveFundsResponse::Error(error) if error.matches_code(code));

    // Only the user can move their funds
    let response = move_funds(env, other_user.principal, user.local_user_index);
    assert!(is_error(&response, OCErrorCode::InitiatorNotAuthorized), "{response:?}");

    // And only through the LocalUserIndex which controls their old canister
    let other_local_user_index = canister_ids
        .subnets
        .iter()
        .map(|s| s.local_user_index)
        .find(|c| *c != user.local_user_index)
        .unwrap();
    let response = move_funds(env, user.principal, other_local_user_index);
    assert!(is_error(&response, OCErrorCode::CanisterNotFound), "{response:?}");

    // As if an earlier move had failed to uninstall the relay, which the next move carries on with
    install_call_relay(env, &user);

    // Of two calls at once, whichever comes second is turned away while the other is in progress
    let responses: Vec<MoveFundsResponse> = [0, 1]
        .map(|_| {
            env.submit_call(
                user.local_user_index,
                user.principal,
                "move_funds_from_old_canister_msgpack",
                msgpack::serialize_then_unwrap(&args),
            )
            .unwrap()
        })
        .into_iter()
        .map(|id| msgpack::deserialize_then_unwrap(&env.await_call(id).unwrap()))
        .collect();
    let (moved, turned_away): (Vec<_>, Vec<_>) = responses
        .into_iter()
        .partition(|r| matches!(r, MoveFundsResponse::Success(_)));
    assert!(
        turned_away.iter().all(|r| is_error(r, OCErrorCode::AlreadyInProgress)),
        "{turned_away:?}"
    );

    let [MoveFundsResponse::Success(outcomes)] = <[_; 1]>::try_from(moved).unwrap() else {
        unreachable!();
    };
    assert_eq!(outcomes.len(), 5);
    for outcome in outcomes {
        match outcome.result {
            // Moved having been retried with the ledger's new fee
            MoveFundsResult::Moved { amount, fee, .. } if outcome.ledger == abc_ledger => {
                assert_eq!(fee, 20_000);
                assert_eq!(amount, balance - fee);
            }
            MoveFundsResult::Moved { amount, fee, .. } if outcome.ledger == def_ledger => {
                assert_eq!(fee, 10_000);
                assert_eq!(amount, balance - fee);
            }
            // XYZ having been tried at the Registry's fee, then found to have too little at the
            // ledger's new one
            MoveFundsResult::NothingToMove if outcome.ledger == ghi_ledger || outcome.ledger == xyz_ledger => {}
            MoveFundsResult::Failed(error)
                if outcome.ledger == canister_ids.user_index && error.matches_code(OCErrorCode::LedgerNotFound) => {}
            result => panic!("Unexpected result for {}: {result:?}", outcome.ledger),
        }
    }
    let balance_of = |env: &PocketIc, ledger: CanisterId, principal: Principal| {
        client::ledger::happy_path::balance_of(env, ledger, principal)
    };
    assert_eq!(balance_of(env, abc_ledger, user.canister()), 0);
    assert_eq!(balance_of(env, abc_ledger, user.principal), balance - 20_000);
    assert_eq!(balance_of(env, def_ledger, user.canister()), 0);
    assert_eq!(balance_of(env, def_ledger, user.principal), balance - 10_000);
    assert_eq!(balance_of(env, xyz_ledger, user.canister()), 15_000);

    // The relay is uninstalled and the old canister's cycles refunded again, during which moves
    // are turned away
    crate::delete_user_tests::wait_for_cycles_to_be_refunded(env, &user);

    // Once moved there is nothing left to move. XYZ is left out from here on, since its balance
    // still exceeds the fee the LocalUserIndex has for it, so a transfer would be tried each time.
    let settled_args = local_user_index_canister::move_funds_from_old_canister::Args {
        old_user_id: user.user_id,
        ledgers: vec![abc_ledger, def_ledger, ghi_ledger],
    };
    let move_settled_funds = |env: &mut PocketIc| {
        client::local_user_index::move_funds_from_old_canister(env, user.principal, user.local_user_index, &settled_args)
    };
    let MoveFundsResponse::Success(outcomes) = move_settled_funds(env) else {
        panic!("Funds not checked");
    };
    assert!(outcomes.iter().all(|o| matches!(o.result, MoveFundsResult::NothingToMove)));

    // A relay left installed by an earlier move is uninstalled by the cycles refund job, even if
    // there is nothing to move
    install_call_relay(env, &user);
    let response = move_settled_funds(env);
    assert!(matches!(response, MoveFundsResponse::Success(_)), "{response:?}");
    crate::delete_user_tests::wait_for_cycles_to_be_refunded(env, &user);

    // Having advanced the clock by a day
    wrapper.discard();
}

// Installs an ICRC ledger with a fee of 10_000, and adds its token to the Registry
fn install_registered_ledger(
    env: &mut PocketIc,
    canister_ids: &CanisterIds,
    controller: Principal,
    symbol: &str,
) -> CanisterId {
    let ledger = install_icrc_ledger(
        env,
        controller,
        format!("{symbol} Token"),
        symbol.to_string(),
        10_000,
        None,
        Vec::new(),
    );
    let response = client::registry::add_token(
        env,
        controller,
        canister_ids.registry,
        &registry_canister::add_token::Args {
            ledger_canister_id: ledger,
            payer: None,
            info_url: "info".to_string(),
            transaction_url_format: "format".to_string(),
            one_sec_enabled: None,
        },
    );
    assert!(matches!(response, types::UnitResult::Success), "{response:?}");
    ledger
}

// Changes the ledger's fee by upgrading it
fn set_ledger_fee(env: &mut PocketIc, controller: Principal, ledger: CanisterId, fee: u64) {
    #[derive(CandidType)]
    enum LedgerArgument {
        Upgrade(Option<UpgradeArgs>),
    }

    #[derive(CandidType)]
    struct UpgradeArgs {
        transfer_fee: Option<Nat>,
    }

    let args = candid::encode_one(LedgerArgument::Upgrade(Some(UpgradeArgs {
        transfer_fee: Some(fee.into()),
    })))
    .unwrap();
    env.upgrade_canister(ledger, wasms::ICRC_LEDGER.module.clone().into(), args, Some(controller))
        .unwrap();
}

// Installs the call relay on the user's old canister, as the LocalUserIndex which controls it,
// having first topped it up with enough cycles to do so
fn install_call_relay(env: &mut PocketIc, user: &User) {
    env.add_cycles(user.canister(), 1_000_000_000_000);
    env.install_canister(
        user.canister(),
        CALL_RELAY_WASM.to_vec(),
        Vec::new(),
        Some(user.local_user_index),
    );
}

#[test]
fn notifications_index_knows_migrated_user_by_their_new_id() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let operator = platform_operator(env, canister_ids, *controller);
    let local_user_index = client::user_index::happy_path::user_registration_canister(env, canister_ids.user_index);
    let multi_user_canister =
        client::user_index::happy_path::create_multi_user_canister(env, *controller, canister_ids, local_user_index);
    let user1 = client::register_user(env, canister_ids);
    let user2 = client::register_user(env, canister_ids);

    // Subscribing to notifications has the NotificationsIndex cache the user's id
    let endpoint = random_string();
    client::notifications_index::happy_path::push_subscription(
        env,
        user1.principal,
        canister_ids.notifications_index,
        "auth",
        "p256dh",
        &endpoint,
    );
    assert!(client::notifications_index::happy_path::subscription_exists(
        env,
        user1.principal,
        canister_ids.notifications_index,
        &endpoint
    ));

    migrate_users(
        env,
        operator.principal,
        canister_ids.user_index,
        vec![user1.user_id],
        Some(multi_user_canister),
    );
    let new_user_id = wait_for_import(env, operator.principal, canister_ids.user_index, user1.user_id);

    // The NotificationsIndex now knows the user by their new id, so the subscription held under their
    // old id is no longer theirs
    assert!(!client::notifications_index::happy_path::subscription_exists(
        env,
        user1.principal,
        canister_ids.notifications_index,
        &endpoint
    ));

    // Once pushed again, the subscription is held under their new id, so they are notified of messages
    // sent to them
    client::notifications_index::happy_path::push_subscription(
        env,
        user1.principal,
        canister_ids.notifications_index,
        "auth",
        "p256dh",
        &endpoint,
    );
    tick_many(env, 3);
    let latest_notification_index =
        client::local_user_index::happy_path::latest_notification_index(env, *controller, local_user_index);
    client::user::happy_path::send_text_message(env, &user2, new_user_id, random_string(), None);
    tick_many(env, 3);
    let notifications =
        client::local_user_index::happy_path::notifications(env, *controller, local_user_index, latest_notification_index + 1);
    assert_eq!(notifications.notifications.len(), 1);
    assert!(notifications.subscriptions.contains_key(&new_user_id));
}

#[test]
fn blocked_user_pairs_are_moved_onto_a_migrated_users_new_id() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let operator = platform_operator(env, canister_ids, *controller);
    let local_user_index = client::user_index::happy_path::user_registration_canister(env, canister_ids.user_index);
    let multi_user_canister =
        client::user_index::happy_path::create_multi_user_canister(env, *controller, canister_ids, local_user_index);
    let user1 = client::register_user(env, canister_ids);
    let user2 = client::register_user(env, canister_ids);
    let user3 = client::register_user(env, canister_ids);
    // A private group, since members who join a public group have its notifications muted
    let group_id = client::user::happy_path::create_group(env, &user1, &random_string(), false, false);
    let group_local_user_index = canister_ids.local_user_index(env, group_id);
    client::local_user_index::happy_path::add_users_to_group(
        env,
        &user1,
        group_local_user_index,
        group_id,
        vec![(user2.user_id, user2.principal), (user3.user_id, user3.principal)],
    );
    // user2 blocks user1, who blocks user3
    client::user::happy_path::block_user(env, &user2, user1.user_id);
    client::user::happy_path::block_user(env, &user1, user3.user_id);
    subscribe_to_notifications(env, canister_ids, &user2);
    tick_many(env, 10);

    migrate_users(
        env,
        operator.principal,
        canister_ids.user_index,
        vec![user1.user_id],
        Some(multi_user_canister),
    );
    let new_user_id = wait_for_import(env, operator.principal, canister_ids.user_index, user1.user_id);
    // Having not subscribed until now, the user's subscription is held under their new id
    subscribe_to_notifications(env, canister_ids, &user1);
    tick_many(env, 10);

    // user2 isn't notified of a message from user1, now under their new id
    let recipients = group_message_notification_recipients(env, *controller, group_local_user_index, &user1, group_id);
    assert!(recipients.is_empty(), "{recipients:?}");
    // Nor is user1, under their new id, notified of a message from user3, while user2 is
    let recipients = group_message_notification_recipients(env, *controller, group_local_user_index, &user3, group_id);
    assert!(!recipients.contains(&new_user_id));
    assert_eq!(recipients, vec![user2.user_id]);

    // Once user2 unblocks user1, by the new id their canister now holds, they are notified again
    client::user::happy_path::unblock_user(env, &user2, new_user_id);
    tick_many(env, 10);
    let recipients = group_message_notification_recipients(env, *controller, group_local_user_index, &user1, group_id);
    assert_eq!(recipients, vec![user2.user_id]);
}

// A removal is sent to the user's canister via the group's or community's queue of events for users,
// so one made while they're being migrated, while their old canister is frozen, reaches them in their
// new one rather than being dropped
#[test_case(false; "group")]
#[test_case(true; "community")]
fn user_removed_while_being_migrated_is_removed_in_their_new_canister(community: bool) {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let operator = platform_operator(env, canister_ids, *controller);
    let local_user_index = client::user_index::happy_path::user_registration_canister(env, canister_ids.user_index);
    let multi_user_canister =
        client::user_index::happy_path::create_multi_user_canister(env, *controller, canister_ids, local_user_index);
    let owner = client::register_diamond_user(env, canister_ids, *controller);
    let user = client::register_user(env, canister_ids);
    let chat: CanisterId = if community {
        let community_id =
            client::user::happy_path::create_community(env, &owner, &random_string(), true, vec![random_string()]);
        client::community::happy_path::join_community(env, user.principal, community_id);
        community_id.into()
    } else {
        let group_id = client::user::happy_path::create_group(env, &owner, &random_string(), true, true);
        client::group::happy_path::join_group(env, user.principal, group_id);
        group_id.into()
    };
    tick_many(env, 5);

    migrate_users(
        env,
        operator.principal,
        canister_ids.user_index,
        vec![user.user_id],
        Some(multi_user_canister),
    );
    tick_until(env, |env| {
        matches!(
            user_migration_status(env, operator.principal, canister_ids.user_index, user.user_id),
            Some(UserMigrationStatus::Started { .. })
        )
    });

    // The user is removed while their old canister is frozen
    if community {
        let response = client::community::remove_member(
            env,
            owner.principal,
            chat,
            &community_canister::remove_member::Args { user_id: user.user_id },
        );
        assert!(
            matches!(response, community_canister::remove_member::Response::Success),
            "{response:?}"
        );
    } else {
        let response = client::group::remove_participant(
            env,
            owner.principal,
            chat,
            &group_canister::remove_participant::Args { user_id: user.user_id },
        );
        assert!(
            matches!(response, group_canister::remove_participant::Response::Success),
            "{response:?}"
        );
    }
    let new_user_id = wait_for_import(env, operator.principal, canister_ids.user_index, user.user_id);

    // The group or community retries the removal until the old canister is gone, then sends it on
    let user = User {
        user_id: new_user_id,
        local_user_index,
        ..user
    };
    let still_member = |env: &PocketIc| {
        let state = client::user::happy_path::initial_state(env, &user);
        state
            .group_chats
            .summaries
            .iter()
            .any(|g| CanisterId::from(g.chat_id) == chat)
            || state
                .communities
                .summaries
                .iter()
                .any(|c| CanisterId::from(c.community_id) == chat)
    };
    for _ in 0..20 {
        if !still_member(env) {
            break;
        }
        env.advance_time(Duration::from_secs(60));
        tick_many(env, 5);
    }
    assert!(
        !still_member(env),
        "The user is still in the {}",
        if community { "community" } else { "group" }
    );
}

// A user who joins a group or community while being migrated is added to it under their old id, after
// their old canister was exported, so it isn't among those the migration tells of their new id. The
// LocalUserIndex the join went via tells it instead, once it hears of the migration.
#[test_case(false; "group")]
#[test_case(true; "community")]
fn user_who_joins_while_being_migrated_is_held_under_their_new_id(community: bool) {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let operator = platform_operator(env, canister_ids, *controller);
    let local_user_index = client::user_index::happy_path::user_registration_canister(env, canister_ids.user_index);
    let multi_user_canister =
        client::user_index::happy_path::create_multi_user_canister(env, *controller, canister_ids, local_user_index);
    let owner = client::register_diamond_user(env, canister_ids, *controller);
    let user = client::register_user(env, canister_ids);
    let chat: CanisterId = if community {
        client::user::happy_path::create_community(env, &owner, &random_string(), true, vec![random_string()]).into()
    } else {
        client::user::happy_path::create_group(env, &owner, &random_string(), true, true).into()
    };
    tick_many(env, 5);

    migrate_users(
        env,
        operator.principal,
        canister_ids.user_index,
        vec![user.user_id],
        Some(multi_user_canister),
    );
    tick_until(env, |env| {
        matches!(
            user_migration_status(env, operator.principal, canister_ids.user_index, user.user_id),
            Some(UserMigrationStatus::Started { .. })
        )
    });

    // The user joins while their old canister is frozen
    if community {
        client::community::happy_path::join_community(env, user.principal, chat.into());
    } else {
        client::group::happy_path::join_group(env, user.principal, chat.into());
    }
    let new_user_id = wait_for_import(env, operator.principal, canister_ids.user_index, user.user_id);

    let members = |env: &PocketIc| -> Vec<UserId> {
        if community {
            let response = client::community::happy_path::selected_initial(env, owner.principal, chat.into());
            response
                .members
                .iter()
                .map(|m| m.user_id)
                .chain(response.basic_members)
                .collect()
        } else {
            let response = client::group::happy_path::selected_initial(env, owner.principal, chat.into());
            response
                .participants
                .iter()
                .map(|m| m.user_id)
                .chain(response.basic_members)
                .collect()
        }
    };
    // The user's new canister lists it too, the join having been sent on to it
    let old_user_id = user.user_id;
    let new_user = User {
        user_id: new_user_id,
        local_user_index,
        ..user
    };
    let listed = |env: &PocketIc| {
        let state = client::user::happy_path::initial_state(env, &new_user);
        state
            .group_chats
            .summaries
            .iter()
            .any(|g| CanisterId::from(g.chat_id) == chat)
            || state
                .communities
                .summaries
                .iter()
                .any(|c| CanisterId::from(c.community_id) == chat)
    };
    for _ in 0..20 {
        if members(env).contains(&new_user_id) && listed(env) {
            break;
        }
        env.advance_time(Duration::from_secs(60));
        tick_many(env, 5);
    }
    let members = members(env);
    assert!(members.contains(&new_user_id), "{members:?}");
    assert!(!members.contains(&old_user_id), "{members:?}");
    assert!(listed(env));
}

// A member of a group imported into a community while they're being migrated is copied into it under
// the id the group held them by. The group is deleted once imported, so the migration's notice to it is
// dropped. Instead the import gets each member's latest id from the community's LocalUserIndex and
// moves them onto it, or the LocalUserIndex tells the community once the migration completes. A user
// who's already an admin of the community, which is told of the migration, keeps their membership and
// role, and only the channel is moved.
#[test_case(false; "not_in_the_community")]
#[test_case(true; "already_an_admin_of_the_community")]
fn member_of_a_group_imported_while_being_migrated_is_held_under_their_new_id(in_community: bool) {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let operator = platform_operator(env, canister_ids, *controller);
    let local_user_index = client::user_index::happy_path::user_registration_canister(env, canister_ids.user_index);
    let multi_user_canister =
        client::user_index::happy_path::create_multi_user_canister(env, *controller, canister_ids, local_user_index);
    let owner = client::register_diamond_user(env, canister_ids, *controller);
    let user = client::register_user(env, canister_ids);
    let group_id = client::user::happy_path::create_group(env, &owner, &random_string(), true, true);
    client::group::happy_path::join_group(env, user.principal, group_id);
    let community_id = client::user::happy_path::create_community(env, &owner, &random_string(), true, vec![random_string()]);
    if in_community {
        client::community::happy_path::join_community(env, user.principal, community_id);
        client::community::happy_path::change_role(env, owner.principal, community_id, user.user_id, CommunityRole::Admin);
    }
    tick_many(env, 5);

    migrate_users(
        env,
        operator.principal,
        canister_ids.user_index,
        vec![user.user_id],
        Some(multi_user_canister),
    );
    tick_until(env, |env| {
        matches!(
            user_migration_status(env, operator.principal, canister_ids.user_index, user.user_id),
            Some(UserMigrationStatus::Started { .. })
        )
    });

    // The group is imported while the user's old canister is frozen
    let channel_id = client::community::happy_path::import_group(env, owner.principal, community_id, group_id).channel_id;
    let new_user_id = wait_for_import(env, operator.principal, canister_ids.user_index, user.user_id);

    let community_members = |env: &PocketIc| {
        let response = client::community::happy_path::selected_initial(env, owner.principal, community_id);
        let roles: Vec<(UserId, CommunityRole)> = response.members.iter().map(|m| (m.user_id, m.role)).collect();
        (roles, response.basic_members)
    };
    // Empty until the import has completed, before which the channel isn't found
    let channel_members = |env: &PocketIc| -> Vec<UserId> {
        match client::community::selected_channel_initial(
            env,
            owner.principal,
            community_id.into(),
            &community_canister::selected_channel_initial::Args {
                channel_id,
                max_members: None,
            },
        ) {
            community_canister::selected_channel_initial::Response::Success(response) => response
                .members
                .iter()
                .map(|m| m.user_id)
                .chain(response.basic_members)
                .collect(),
            _ => Vec::new(),
        }
    };
    let old_user_id = user.user_id;
    let new_user = User {
        user_id: new_user_id,
        local_user_index,
        ..user
    };
    let held_under_new_id = |env: &PocketIc| {
        let (roles, basic_members) = community_members(env);
        let in_community = roles.iter().any(|(u, _)| *u == new_user_id) || basic_members.contains(&new_user_id);
        let listed = client::user::happy_path::initial_state(env, &new_user)
            .communities
            .summaries
            .iter()
            .any(|c| c.community_id == community_id);
        in_community && channel_members(env).contains(&new_user_id) && listed
    };
    for _ in 0..20 {
        if held_under_new_id(env) {
            break;
        }
        env.advance_time(Duration::from_secs(60));
        tick_many(env, 5);
    }
    assert!(held_under_new_id(env));

    let (roles, basic_members) = community_members(env);
    assert!(!roles.iter().any(|(u, _)| *u == old_user_id) && !basic_members.contains(&old_user_id));
    assert!(!channel_members(env).contains(&old_user_id));
    if in_community {
        assert!(roles.contains(&(new_user_id, CommunityRole::Admin)), "{roles:?}");
    }
}

#[test]
fn users_with_a_direct_chat_with_or_a_block_of_a_migrated_user_hold_it_under_their_new_id() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let operator = platform_operator(env, canister_ids, *controller);
    let local_user_index = client::user_index::happy_path::user_registration_canister(env, canister_ids.user_index);
    let multi_user_canister =
        client::user_index::happy_path::create_multi_user_canister(env, *controller, canister_ids, local_user_index);
    let user1 = client::register_user(env, canister_ids);
    // user2 and user3 have direct chats with user1, user2 in a canister of their own and user3 in a
    // MultiUser canister, while user4 has blocked user1, with whom they have no chat
    let user2 = client::register_user(env, canister_ids);
    let user3 = client::register_user_in_multi_user_canister(env, canister_ids);
    let user4 = client::register_user(env, canister_ids);
    client::user::happy_path::send_text_message(env, &user2, user1.user_id, random_string(), None);
    client::user::happy_path::send_text_message(env, &user1, user2.user_id, random_string(), None);
    client::user::happy_path::send_text_message(env, &user3, user1.user_id, random_string(), None);
    client::user::happy_path::block_user(env, &user4, user1.user_id);
    // user5, held by a LocalUserIndex other than user2's, has a direct chat with user1, which user1
    // has deleted
    let user2_subnet = env.get_subnet(user2.canister()).unwrap();
    let other_subnet = canister_ids
        .subnets
        .iter()
        .map(|s| s.subnet_id)
        .find(|s| *s != user2_subnet)
        .unwrap();
    let user5 = client::register_user_on_subnet(env, canister_ids, other_subnet);
    assert_ne!(user5.local_user_index, user2.local_user_index);
    client::user::happy_path::send_text_message(env, &user5, user1.user_id, random_string(), None);
    tick_many(env, 10);
    let response = client::user::delete_direct_chat(
        env,
        user1.principal,
        user1.canister(),
        &user_canister::delete_direct_chat::Args {
            user_id: user5.user_id,
            block_user: false,
        },
    );
    assert!(
        matches!(response, user_canister::delete_direct_chat::Response::Success),
        "{response:?}"
    );
    tick_many(env, 10);
    let before_migration = now_millis(env);
    env.advance_time(Duration::from_millis(1));

    migrate_users(
        env,
        operator.principal,
        canister_ids.user_index,
        vec![user1.user_id],
        Some(multi_user_canister),
    );
    // The migration is retried until user1's canister has garbage collected the chat they deleted
    let new_user_id = wait_for_import(env, operator.principal, canister_ids.user_index, user1.user_id);
    tick_many(env, 10);

    // Each peer has a single chat with user1, now under their new id, with its history. Their
    // clients are told the chat under the old id was removed and sent it under the new one.
    for (peer, message_count) in [(&user2, 2), (&user3, 1), (&user5, 1)] {
        let state = client::user::happy_path::initial_state(env, peer);
        let chats: Vec<_> = state
            .direct_chats
            .summaries
            .iter()
            .filter(|c| c.them == new_user_id || c.them == user1.user_id)
            .collect();
        assert_eq!(chats.len(), 1, "{chats:?}");
        assert_eq!(chats[0].them, new_user_id);
        assert_eq!(chats[0].latest_message_index, Some((message_count - 1).into()));

        let updates = client::user::happy_path::updates(env, peer, before_migration)
            .unwrap_or_else(|| panic!("No updates for {}", peer.user_id));
        assert!(updates.direct_chats.removed.contains(&user1.user_id.into()));
        assert!(updates.direct_chats.added.iter().any(|c| c.them == new_user_id));
    }
    // user4 has blocked user1 under their new id
    let state = client::user::happy_path::initial_state(env, &user4);
    assert!(state.blocked_users.contains(&new_user_id));
    assert!(!state.blocked_users.contains(&user1.user_id));

    // A message from user1 under their new id is added to the same chat, while user4 doesn't get one
    let user1 = User {
        user_id: new_user_id,
        local_user_index,
        ..user1
    };
    let message = random_string();
    client::user::happy_path::send_text_message(env, &user1, user2.user_id, message.clone(), None);
    client::user::happy_path::send_text_message(env, &user1, user4.user_id, random_string(), None);
    tick_many(env, 10);
    let state = client::user::happy_path::initial_state(env, &user2);
    let chats: Vec<_> = state
        .direct_chats
        .summaries
        .iter()
        .filter(|c| c.them == new_user_id || c.them == user1.user_id)
        .collect();
    assert_eq!(chats.len(), 1, "{chats:?}");
    assert_eq!(chats[0].latest_message_index, Some(2.into()));
    match &chats[0].latest_message.as_ref().unwrap().event.content {
        MessageContent::Text(text) => assert_eq!(text.text, message),
        content => panic!("Unexpected content: {content:?}"),
    }
    let state = client::user::happy_path::initial_state(env, &user4);
    assert!(state.direct_chats.summaries.iter().all(|c| c.them != new_user_id));
}

// The id the user holds their one direct chat with the migrated user under
// Each user's canister is frozen while they are being migrated, so neither hears of the other's new
// id then, and is told once they are switched over themselves
#[test]
fn direct_chat_between_users_migrated_together_is_held_under_their_new_ids() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let operator = platform_operator(env, canister_ids, *controller);
    let local_user_index = client::user_index::happy_path::user_registration_canister(env, canister_ids.user_index);
    let multi_user_canister =
        client::user_index::happy_path::create_multi_user_canister(env, *controller, canister_ids, local_user_index);
    let user1 = client::register_user(env, canister_ids);
    let user2 = client::register_user(env, canister_ids);
    client::user::happy_path::send_text_message(env, &user1, user2.user_id, random_string(), None);
    client::user::happy_path::send_text_message(env, &user2, user1.user_id, random_string(), None);
    tick_many(env, 10);

    migrate_users(
        env,
        operator.principal,
        canister_ids.user_index,
        vec![user1.user_id, user2.user_id],
        Some(multi_user_canister),
    );
    tick_many(env, 40);
    let new_user_id = |user: &User| match user_migration_status(env, operator.principal, canister_ids.user_index, user.user_id)
    {
        Some(UserMigrationStatus::Imported { new_user_id, .. }) => new_user_id,
        status => panic!("User not imported: {status:?}"),
    };
    let (new_user_id1, new_user_id2) = (new_user_id(&user1), new_user_id(&user2));
    tick_many(env, 10);

    let old_user_ids = [user1.user_id, user2.user_id];
    let user1 = User {
        user_id: new_user_id1,
        local_user_index,
        ..user1
    };
    let user2 = User {
        user_id: new_user_id2,
        local_user_index,
        ..user2
    };
    for (user, other) in [(&user1, new_user_id2), (&user2, new_user_id1)] {
        let state = client::user::happy_path::initial_state(env, user);
        let chats: Vec<_> = state
            .direct_chats
            .summaries
            .iter()
            .filter(|c| c.them == other || old_user_ids.contains(&c.them))
            .collect();
        assert_eq!(chats.len(), 1, "{chats:?}");
        assert_eq!(chats[0].them, other);
        assert_eq!(chats[0].latest_message_index, Some(1.into()));
    }
}

// An event from a user migrated to a MultiUser canister names the ids they had before, so that the
// recipient moves what it holds under them first, even if the notice of the migration hasn't
// reached it yet. The recipients are in a MultiUser canister, since a User canister doesn't take
// calls to its `c2c` methods from outside, and both kinds share the code which moves them.
#[test]
fn events_from_a_migrated_user_move_what_is_held_under_their_previous_ids() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    // user1 is held under the new id below, and has a chat with user2 under their old id, while
    // user3 has blocked them under it
    let user1 = client::register_user(env, canister_ids);
    let user2 = client::register_user_in_multi_user_canister(env, canister_ids);
    let user3 =
        client::register_user_in_multi_user_canister_on(env, canister_ids, user2.local_user_index, user2.canister(), None);
    client::user::happy_path::send_text_message(env, &user1, user2.user_id, random_string(), None);
    client::user::happy_path::block_user(env, &user3, user1.user_id);
    tick_many(env, 10);
    let local_user_index = client::user_index::happy_path::user_registration_canister(env, canister_ids.user_index);
    let multi_user_canister =
        client::user_index::happy_path::create_multi_user_canister(env, *controller, canister_ids, local_user_index);
    assert_ne!(multi_user_canister, user2.canister());
    // A user in another MultiUser canister plays user1 under their new id. Each LocalUserIndex hears
    // of a MultiUser canister on another once a user registers in it.
    let new_user_id =
        client::register_user_in_multi_user_canister_on(env, canister_ids, local_user_index, multi_user_canister, None).user_id;
    tick_many(env, 10);

    let mark_read = || UserCanisterEvent::MarkMessagesRead(user_canister::MarkMessagesReadArgs { read_up_to: 0.into() });
    let message = || {
        UserCanisterEvent::SendMessages(Box::new(user_canister::SendMessagesArgs {
            messages: vec![user_canister::SendMessageArgs {
                thread_root_message_id: None,
                message_id: random_from_u128(),
                sender_message_index: 0.into(),
                content: chat_events::MessageContentInternal::Text(chat_events::TextContentInternal { text: random_string() }),
                replies_to: None,
                forwarding: false,
                block_level_markdown: false,
                message_filter_failed: None,
                og_previews: Vec::new(),
            }],
            sender_name: random_string(),
            sender_display_name: None,
            sender_avatar_id: None,
        }))
    };
    let send = |env: &mut PocketIc,
                caller: CanisterId,
                sender: UserId,
                recipient: &User,
                event: UserCanisterEvent,
                previous: Vec<UserId>| {
        // An event from a caller no later than the latest taken from it is ignored
        env.advance_time(Duration::from_millis(1));
        let response = client::user::c2c_user_canister_v2(
            env,
            caller,
            recipient.canister(),
            &user_canister::c2c_user_canister_v2::Args {
                events: vec![IdempotentEnvelope {
                    created_at: now_millis(env),
                    idempotency_id: rand::random(),
                    value: user_canister::c2c_user_canister_v2::Event {
                        sender,
                        recipient: recipient.user_id,
                        event,
                        sender_previous_user_ids: previous,
                    },
                }],
            },
        );
        assert!(
            matches!(response, user_canister::c2c_user_canister_v2::Response::Success),
            "{response:?}"
        );
    };
    send(
        env,
        multi_user_canister,
        new_user_id,
        &user2,
        mark_read(),
        vec![user1.user_id],
    );
    send(env, multi_user_canister, new_user_id, &user3, message(), vec![user1.user_id]);

    // user2's chat is now under the new id, and has the event applied to it
    let state = client::user::happy_path::initial_state(env, &user2);
    let chats: Vec<_> = state
        .direct_chats
        .summaries
        .iter()
        .filter(|c| c.them == new_user_id || c.them == user1.user_id)
        .collect();
    assert_eq!(chats.len(), 1, "{chats:?}");
    assert_eq!(chats[0].them, new_user_id);
    assert_eq!(chats[0].read_by_them_up_to, Some(0.into()));

    // user3's block is now of the new id, and was moved before the block was checked, so the message
    // was dropped rather than starting a chat
    let state = client::user::happy_path::initial_state(env, &user3);
    assert!(state.blocked_users.contains(&new_user_id));
    assert!(!state.blocked_users.contains(&user1.user_id));
    assert!(state.direct_chats.summaries.iter().all(|c| c.them != new_user_id));

    // Previous ids from a User canister are ignored, so user2's chat isn't moved onto user4
    let user4 = client::register_user(env, canister_ids);
    send(env, user4.canister(), user4.user_id, &user2, mark_read(), vec![new_user_id]);
    let state = client::user::happy_path::initial_state(env, &user2);
    assert!(state.direct_chats.summaries.iter().any(|c| c.them == new_user_id));
    assert!(state.direct_chats.summaries.iter().all(|c| c.them != user4.user_id));
}

// A user's first message to someone being migrated doesn't reach the export of their state, so they
// aren't told of the new id when the migration completes. Instead their canister moves its chat on
// finding the old canister gone and sending the message on to the new id.
#[test_case(false; "sender in a User canister")]
#[test_case(true; "sender in a MultiUser canister")]
fn first_message_to_a_user_being_migrated_is_held_under_their_new_id(sender_in_multi_user_canister: bool) {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let operator = platform_operator(env, canister_ids, *controller);
    let local_user_index = client::user_index::happy_path::user_registration_canister(env, canister_ids.user_index);
    let multi_user_canister =
        client::user_index::happy_path::create_multi_user_canister(env, *controller, canister_ids, local_user_index);
    let user1 = client::register_user(env, canister_ids);
    let user2 = if sender_in_multi_user_canister {
        client::register_user_in_multi_user_canister(env, canister_ids)
    } else {
        client::register_user(env, canister_ids)
    };
    tick_many(env, 5);

    // Wait until user1's canister has started migrating them, so is frozen, with their state taken
    migrate_users(
        env,
        operator.principal,
        canister_ids.user_index,
        vec![user1.user_id],
        Some(multi_user_canister),
    );
    for i in 0.. {
        env.tick();
        match user_migration_status(env, operator.principal, canister_ids.user_index, user1.user_id) {
            Some(UserMigrationStatus::Started { .. }) => break,
            Some(UserMigrationStatus::Imported { .. }) => panic!("Imported before the message could be sent"),
            status => assert!(i < 30, "Migration not started: {status:?}"),
        }
    }
    let message = random_string();
    client::user::happy_path::send_text_message(env, &user2, user1.user_id, message.clone(), None);
    let new_user_id = wait_for_import(env, operator.principal, canister_ids.user_index, user1.user_id);

    let old_user_id = user1.user_id;
    let user1 = User {
        user_id: new_user_id,
        local_user_index,
        ..user1
    };
    // user2's canister retries the message until user1's old canister has gone, then sends it on
    let mut chat = None;
    for _ in 0..20 {
        env.advance_time(Duration::from_secs(60));
        tick_many(env, 10);
        chat = client::user::happy_path::initial_state(env, &user1)
            .direct_chats
            .summaries
            .into_iter()
            .find(|c| c.them == user2.user_id);
        if chat.is_some() {
            break;
        }
    }
    let chat = chat.expect("user1 didn't get the message");
    match &chat.latest_message.as_ref().unwrap().event.content {
        MessageContent::Text(text) => assert_eq!(text.text, message),
        content => panic!("Unexpected content: {content:?}"),
    }

    // user2's chat moved onto the new id when the message was sent on, before user1 replies
    let chats_with_user1 = |env: &PocketIc| {
        client::user::happy_path::initial_state(env, &user2)
            .direct_chats
            .summaries
            .into_iter()
            .filter(|c| c.them == new_user_id || c.them == old_user_id)
            .collect::<Vec<_>>()
    };
    let chats = chats_with_user1(env);
    assert_eq!(chats.len(), 1, "{chats:?}");
    assert_eq!(chats[0].them, new_user_id);

    client::user::happy_path::send_text_message(env, &user1, user2.user_id, random_string(), None);
    tick_many(env, 10);
    let chats = chats_with_user1(env);
    assert_eq!(chats.len(), 1, "{chats:?}");
    assert_eq!(chats[0].latest_message_index, Some(1.into()));
}

// As above, but user1 replies under their new id before user2's canister has sent its message on and
// found them migrated, so it is the reply, naming user1's previous id, which moves user2's chat
#[test]
fn reply_naming_the_senders_previous_id_is_added_to_the_chat_under_it() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let operator = platform_operator(env, canister_ids, *controller);
    let local_user_index = client::user_index::happy_path::user_registration_canister(env, canister_ids.user_index);
    let multi_user_canister =
        client::user_index::happy_path::create_multi_user_canister(env, *controller, canister_ids, local_user_index);
    let user1 = client::register_user(env, canister_ids);
    let user2 = client::register_user(env, canister_ids);
    tick_many(env, 5);

    migrate_users(
        env,
        operator.principal,
        canister_ids.user_index,
        vec![user1.user_id],
        Some(multi_user_canister),
    );
    for i in 0.. {
        env.tick();
        match user_migration_status(env, operator.principal, canister_ids.user_index, user1.user_id) {
            Some(UserMigrationStatus::Started { .. }) => break,
            Some(UserMigrationStatus::Imported { .. }) => panic!("Imported before the message could be sent"),
            status => assert!(i < 30, "Migration not started: {status:?}"),
        }
    }
    client::user::happy_path::send_text_message(env, &user2, user1.user_id, random_string(), None);
    let new_user_id = wait_for_import(env, operator.principal, canister_ids.user_index, user1.user_id);

    let old_user_id = user1.user_id;
    let chats_with_user1 = |env: &PocketIc| {
        client::user::happy_path::initial_state(env, &user2)
            .direct_chats
            .summaries
            .into_iter()
            .filter(|c| c.them == new_user_id || c.them == old_user_id)
            .collect::<Vec<_>>()
    };
    // user2's canister is yet to retry its message, so still holds the chat under the old id
    let chats = chats_with_user1(env);
    assert_eq!(chats.len(), 1, "{chats:?}");
    assert_eq!(chats[0].them, old_user_id);

    let user1 = User {
        user_id: new_user_id,
        local_user_index,
        ..user1
    };
    client::user::happy_path::send_text_message(env, &user1, user2.user_id, random_string(), None);
    tick_many(env, 10);

    let chats = chats_with_user1(env);
    assert_eq!(chats.len(), 1, "{chats:?}");
    assert_eq!(chats[0].them, new_user_id);
    assert_eq!(chats[0].latest_message_index, Some(1.into()));
}

#[test]
fn migrated_user_is_not_rewarded_again_to_their_referrer() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let operator = platform_operator(env, canister_ids, *controller);
    let local_user_index = client::user_index::happy_path::user_registration_canister(env, canister_ids.user_index);
    let multi_user_canister =
        client::user_index::happy_path::create_multi_user_canister(env, *controller, canister_ids, local_user_index);
    let referrer = client::register_user(env, canister_ids);
    let user = client::register_user_with_referrer(env, canister_ids, Some(referrer.user_id.to_string()));
    client::upgrade_user(
        &user,
        env,
        canister_ids,
        *controller,
        DiamondMembershipPlanDuration::OneMonth,
        false,
    );
    tick_many(env, 3);
    let chit_balance = client::user::happy_path::initial_state(env, &referrer).chit_balance;

    migrate_users(
        env,
        operator.principal,
        canister_ids.user_index,
        vec![user.user_id],
        Some(multi_user_canister),
    );
    wait_for_import(env, operator.principal, canister_ids.user_index, user.user_id);

    // The user now pays from their own wallet, having approved their MultiUser canister to charge it
    let icp = canister_ids.icp_ledger;
    client::ledger::happy_path::transfer(env, *controller, icp, user.principal, 1_000_000_000);
    client::ledger::happy_path::approve(
        env,
        user.principal,
        icp,
        icrc_ledger_types::icrc1::account::Account {
            owner: multi_user_canister,
            subaccount: Some(ledger_utils::spender_subaccount(user.principal)),
        },
        900_000_000,
    );
    let pay = |env: &mut PocketIc, duration| {
        client::user_index::happy_path::pay_for_diamond_membership(
            env,
            user.principal,
            canister_ids.user_index,
            duration,
            false,
            false,
        );
        tick_many(env, 10);
        client::user::happy_path::initial_state(env, &referrer)
    };

    // Paying for Diamond again under their new id earns their referrer nothing more
    let referrer_state = pay(env, DiamondMembershipPlanDuration::OneMonth);
    assert_eq!(referrer_state.chit_balance, chit_balance);
    assert_eq!(referrer_state.referrals.len(), 1);
    assert_eq!(referrer_state.referrals[0].user_id, user.user_id);

    // While upgrading to Lifetime Diamond earns them the difference, on the referral under the user's
    // old id
    let referrer_state = pay(env, DiamondMembershipPlanDuration::Lifetime);
    assert_eq!(
        referrer_state.chit_balance as u32,
        chit_balance as u32 + ReferralStatus::LifetimeDiamond.chit_reward() - ReferralStatus::Diamond.chit_reward()
    );
    assert_eq!(referrer_state.referrals.len(), 1);
    assert_eq!(referrer_state.referrals[0].user_id, user.user_id);
    assert!(matches!(referrer_state.referrals[0].status, ReferralStatus::LifetimeDiamond));
}

#[test_case(true; "held_by_the_same_local_user_index")]
#[test_case(false; "held_by_another_local_user_index")]
fn events_for_a_user_being_migrated_reach_them_in_their_new_canister_in_order(same_local_user_index: bool) {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let operator = platform_operator(env, canister_ids, *controller);
    let local_user_index = client::user_index::happy_path::user_registration_canister(env, canister_ids.user_index);
    let multi_user_canister =
        client::user_index::happy_path::create_multi_user_canister(env, *controller, canister_ids, local_user_index);
    // The user's old canister is held by the same LocalUserIndex as the MultiUser canister, or by another
    let subnet = canister_ids
        .subnets
        .iter()
        .find(|s| (s.local_user_index == local_user_index) == same_local_user_index)
        .unwrap()
        .subnet_id;
    let user1 = client::register_user_on_subnet(env, canister_ids, subnet);
    let user2 = client::register_diamond_user(env, canister_ids, *controller);
    let group_id = client::user::happy_path::create_group(env, &user2, &random_string(), true, true);
    tick_many(env, 3);

    // The MultiUser canister is stopped, so it can't import the user, who stays frozen in their old
    // canister
    env.stop_canister(multi_user_canister, Some(local_user_index)).unwrap();
    migrate_users(
        env,
        operator.principal,
        canister_ids.user_index,
        vec![user1.user_id],
        Some(multi_user_canister),
    );
    tick_until(env, |env| {
        matches!(
            user_migration_status(env, operator.principal, canister_ids.user_index, user1.user_id),
            Some(UserMigrationStatus::Started { .. })
        )
    });

    // Meanwhile the LocalUserIndex has events for the user, which their frozen canister can't take.
    // They're invited to and join a group, and change their display name twice.
    client::local_user_index::happy_path::add_users_to_group(
        env,
        &user2,
        client::group::happy_path::local_user_index(env, group_id),
        group_id,
        vec![(user1.user_id, user1.principal)],
    );
    for display_name in ["First name", "Second name"] {
        client::user_index::happy_path::set_display_name(
            env,
            user1.principal,
            canister_ids.user_index,
            Some(display_name.to_string()),
        );
    }
    tick_many(env, 5);

    // Once the MultiUser canister is started again, the user is imported and switched over
    env.start_canister(multi_user_canister, Some(local_user_index)).unwrap();
    let new_user_id = wait_for_import(env, operator.principal, canister_ids.user_index, user1.user_id);

    // And the events reach them there, in order
    tick_until(env, |env| {
        let user_canister::initial_state::Response::Success(state) = client::user::initial_state(
            env,
            user1.principal,
            multi_user_canister,
            &user_canister::initial_state::Args {},
        );
        let user_canister::public_profile::Response::Success(profile) = client::user::public_profile(
            env,
            user1.principal,
            multi_user_canister,
            &user_canister::public_profile::Args { user_id: new_user_id },
        );
        state.group_chats.summaries.iter().any(|g| g.chat_id == group_id)
            && profile.display_name.as_deref() == Some("Second name")
    });
}

#[test]
fn bot_installed_in_a_users_direct_chats_before_they_migrate_is_uninstalled_from_their_new_canister() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let operator = platform_operator(env, canister_ids, *controller);
    let local_user_index = client::user_index::happy_path::user_registration_canister(env, canister_ids.user_index);
    let multi_user_canister =
        client::user_index::happy_path::create_multi_user_canister(env, *controller, canister_ids, local_user_index);
    // The user's old canister is held by another LocalUserIndex than the MultiUser canister
    let subnet = canister_ids
        .subnets
        .iter()
        .find(|s| s.local_user_index != local_user_index)
        .unwrap()
        .subnet_id;
    let user = client::register_user_on_subnet(env, canister_ids, subnet);
    let bot_owner = client::register_user(env, canister_ids);

    // The user installs a bot in their direct chats, which the UserIndex records under their old id
    let response = client::user_index::register_bot(
        env,
        bot_owner.principal,
        canister_ids.user_index,
        &user_index_canister::register_bot::Args {
            principal: random_principal(),
            name: random_string(),
            avatar: None,
            endpoint: "https://my.bot.xyz/".to_string(),
            definition: BotDefinition {
                description: random_string(),
                commands: Vec::new(),
                autonomous_config: None,
                default_subscriptions: None,
                data_encoding: None,
                restricted_locations: None,
            },
            permitted_install_location: Some(BotInstallationLocation::User(user.user_id.into())),
        },
    );
    let user_index_canister::register_bot::Response::Success(bot) = response else {
        panic!("'register_bot' error: {response:?}");
    };
    tick_many(env, 3);
    client::local_user_index::happy_path::install_bot(
        env,
        user.principal,
        user.local_user_index,
        BotInstallationLocation::User(user.user_id.into()),
        bot.bot_id,
        BotPermissions::text_only(),
        None,
    );
    tick_many(env, 3);

    migrate_users(
        env,
        operator.principal,
        canister_ids.user_index,
        vec![user.user_id],
        Some(multi_user_canister),
    );
    wait_for_import(env, operator.principal, canister_ids.user_index, user.user_id);
    let bots = |env: &PocketIc| {
        let user_canister::initial_state::Response::Success(state) = client::user::initial_state(
            env,
            user.principal,
            multi_user_canister,
            &user_canister::initial_state::Args {},
        );
        state.bots.into_iter().map(|b| b.user_id).collect::<Vec<_>>()
    };
    assert_eq!(bots(env), vec![bot.bot_id]);

    // Once the bot is removed, it's uninstalled from the user's new canister
    client::user_index::happy_path::remove_bot(env, bot_owner.principal, canister_ids.user_index, bot.bot_id);
    tick_until(env, |env| bots(env).is_empty());
}

#[test_case(true; "registered_with_the_same_local_user_index")]
#[test_case(false; "registered_with_another_local_user_index")]
fn user_referred_by_a_migrated_users_old_id_is_sent_to_their_new_canister(same_local_user_index: bool) {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let operator = platform_operator(env, canister_ids, *controller);
    let local_user_index = client::user_index::happy_path::user_registration_canister(env, canister_ids.user_index);
    let multi_user_canister =
        client::user_index::happy_path::create_multi_user_canister(env, *controller, canister_ids, local_user_index);
    let referrer = client::register_user(env, canister_ids);

    migrate_users(
        env,
        operator.principal,
        canister_ids.user_index,
        vec![referrer.user_id],
        Some(multi_user_canister),
    );
    wait_for_import(env, operator.principal, canister_ids.user_index, referrer.user_id);

    // A user registers with a referral link naming the referrer by their old id, with the
    // LocalUserIndex holding the referrer's new id, or with another
    let registered_with = canister_ids
        .subnets
        .iter()
        .map(|s| s.local_user_index)
        .find(|c| (*c == local_user_index) == same_local_user_index)
        .unwrap();
    let user = client::register_user_with_referrer_on(env, canister_ids, registered_with, Some(referrer.user_id.to_string()));

    // The referral reaches the referrer in their MultiUser canister
    tick_until(env, |env| {
        let user_canister::initial_state::Response::Success(state) = client::user::initial_state(
            env,
            referrer.principal,
            multi_user_canister,
            &user_canister::initial_state::Args {},
        );
        state.referrals.iter().any(|r| r.user_id == user.user_id)
    });
}

#[test]
fn suspended_user_is_migrated() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let operator = platform_operator(env, canister_ids, *controller);
    let moderator = client::register_diamond_user(env, canister_ids, *controller);
    client::user_index::add_platform_moderator(
        env,
        *controller,
        canister_ids.user_index,
        &user_index_canister::add_platform_moderator::Args {
            user_id: moderator.user_id,
        },
    );
    let user = client::register_user(env, canister_ids);

    let response = client::user_index::suspend_user(
        env,
        moderator.principal,
        canister_ids.user_index,
        &user_index_canister::suspend_user::Args {
            user_id: user.user_id,
            duration: None,
            reason: random_string(),
        },
    );
    assert!(
        matches!(response, user_index_canister::suspend_user::Response::Success),
        "{response:?}"
    );
    tick_many(env, 5);

    // The suspension is part of the user's state, so is carried over with them
    let queued = migrate_users(
        env,
        operator.principal,
        canister_ids.user_index,
        vec![user.user_id],
        Some(multi_user_canister(1)),
    );
    assert_eq!(queued, vec![user.user_id]);
    tick_many(env, 10);

    started_migration(env, operator.principal, canister_ids.user_index, user.user_id);
}

#[test]
fn migration_is_retried_until_the_user_canister_is_ready() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let operator = platform_operator(env, canister_ids, *controller);
    let local_user_index = client::user_index::happy_path::user_registration_canister(env, canister_ids.user_index);
    client::user_index::happy_path::create_multi_user_canister(env, *controller, canister_ids, local_user_index);
    let user1 = client::register_user(env, canister_ids);
    let user2 = client::register_user(env, canister_ids);

    // A pending message reminder means the canister isn't ready to be migrated until it fires
    set_message_reminder(env, &user1, &user2, 60_000);
    let before = user_migration_metrics(env, canister_ids.user_index);

    migrate_users(env, operator.principal, canister_ids.user_index, vec![user1.user_id], None);
    tick_many(env, 10);

    let metrics = user_migration_metrics(env, canister_ids.user_index);
    assert_eq!(metrics.started_or_imported(), before.started_or_imported());
    assert_eq!(metrics.failed, before.failed);

    for _ in 0..5 {
        env.advance_time(Duration::from_secs(31));
        tick_many(env, 5);
    }

    let metrics = user_migration_metrics(env, canister_ids.user_index);
    assert_eq!(metrics.started_or_imported(), before.started_or_imported() + 1);
    assert_eq!(metrics.failed, before.failed);
}

#[test]
fn user_whose_canister_is_never_ready_fails_to_start_migrating() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let operator = platform_operator(env, canister_ids, *controller);
    let local_user_index = client::user_index::happy_path::user_registration_canister(env, canister_ids.user_index);
    client::user_index::happy_path::create_multi_user_canister(env, *controller, canister_ids, local_user_index);
    let user1 = client::register_user(env, canister_ids);
    let user2 = client::register_user(env, canister_ids);

    set_message_reminder(env, &user1, &user2, DAY_IN_MS);
    let before = user_migration_metrics(env, canister_ids.user_index);

    migrate_users(env, operator.principal, canister_ids.user_index, vec![user1.user_id], None);

    wait_for_migration_attempts_to_run_out(env);

    let after = user_migration_metrics(env, canister_ids.user_index);
    assert_eq!(after.started, before.started);
    assert_eq!(after.failed, before.failed + 1);
    let not_ready = |m: &UserMigrationMetrics| {
        m.failed_by_error_code
            .get(&(OCErrorCode::NotReadyForMigration as u16))
            .copied()
            .unwrap_or_default()
    };
    assert_eq!(not_ready(&after), not_ready(&before) + 1);

    // The canister isn't frozen, so its owner can still change it
    let response = client::user::set_bio(
        env,
        user1.principal,
        user1.canister(),
        &user_canister::set_bio::Args { text: random_string() },
    );
    assert!(matches!(response, types::UnitResult::Success), "{response:?}");

    // A user who failed to be migrated can be queued again by naming them
    assert_eq!(
        migrate_users(env, operator.principal, canister_ids.user_index, vec![user1.user_id], None),
        vec![user1.user_id]
    );
}

#[test]
fn user_canister_is_upgraded_to_the_latest_wasm_before_migrating() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let operator = platform_operator(env, canister_ids, *controller);
    let local_user_index = client::user_index::happy_path::user_registration_canister(env, canister_ids.user_index);
    client::user_index::happy_path::create_multi_user_canister(env, *controller, canister_ids, local_user_index);
    let user = client::register_user(env, canister_ids);

    // Stop User canisters being upgraded as usual, then release a new User wasm
    let response = client::user_index::set_user_upgrade_concurrency(
        env,
        operator.principal,
        canister_ids.user_index,
        &user_index_canister::set_user_upgrade_concurrency::Args { value: 0 },
    );
    assert!(matches!(response, types::SuccessOnly::Success), "{response:?}");
    tick_many(env, 5);

    let version = BuildVersion::new(0, 0, 1);
    client::user_index::happy_path::upgrade_user_canister_wasm(
        env,
        *controller,
        canister_ids.user_index,
        CanisterWasm {
            version,
            module: wasms::USER.module.clone(),
        },
    );
    tick_many(env, 10);
    assert_ne!(wasm_version(env, user.canister()), version);

    // Migrated to a canister which doesn't import users, so that the migration stays started
    migrate_users(
        env,
        operator.principal,
        canister_ids.user_index,
        vec![user.user_id],
        Some(multi_user_canister(1)),
    );
    // The canister may not be ready to migrate straight after being upgraded, in which case starting
    // the migration is retried 30s later
    for _ in 0..3 {
        tick_many(env, 5);
        env.advance_time(Duration::from_secs(31));
    }
    tick_many(env, 5);

    assert_eq!(wasm_version(env, user.canister()), version);
    let started = started_migration(env, operator.principal, canister_ids.user_index, user.user_id);
    assert_eq!(started.wasm_version, version);

    // Releasing a new User wasm would break later tests which draw this env
    wrapper.discard();
}

#[test]
fn online_users_knows_migrated_user_by_their_new_id() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let operator = platform_operator(env, canister_ids, *controller);
    let local_user_index = client::user_index::happy_path::user_registration_canister(env, canister_ids.user_index);
    let multi_user_canister =
        client::user_index::happy_path::create_multi_user_canister(env, *controller, canister_ids, local_user_index);
    let user = client::register_user(env, canister_ids);

    // Marking the user as online has the OnlineUsers canister cache their id
    client::online_users::happy_path::mark_as_online(env, user.principal, canister_ids.online_users);

    migrate_users(
        env,
        operator.principal,
        canister_ids.user_index,
        vec![user.user_id],
        Some(multi_user_canister),
    );
    let new_user_id = wait_for_import(env, operator.principal, canister_ids.user_index, user.user_id);

    // The user's last online date has moved from their old id to their new one
    let last_online = |env: &PocketIc, user_id: UserId| {
        client::online_users::happy_path::last_online(env, vec![user_id], canister_ids.online_users)
            .first()
            .map(|u| u.duration_since_last_online)
    };
    assert!(last_online(env, new_user_id).is_some());
    assert!(last_online(env, user.user_id).is_none());

    // The user is marked as online under their new id, carrying on from the minutes online recorded
    // under their old id. The month may have ended in the meantime, so both months are counted.
    env.advance_time(Duration::from_secs(60));
    let online_users_canister::mark_as_online::Response::SuccessV2(result) =
        client::online_users::mark_as_online(env, user.principal, canister_ids.online_users, &Empty {})
    else {
        panic!("Failed to mark user as online");
    };
    assert_eq!(result.minutes_online + result.minutes_online_last_month, 2);
    assert_eq!(last_online(env, new_user_id), Some(0));
    assert!(last_online(env, user.user_id).is_none());
}

// Users reach a MultiUser canister with their direct chats on the heap or already in stable memory,
// depending on the versions of the canisters involved. Going through the release order (the
// MultiUser canister first, then the User canisters), this checks each user ends up with every chat
// in stable memory and still working: one imported by the MultiUser canister in production, whose
// chats are moved when it's upgraded, one exported by the User canister in production after that,
// whose chats are moved as they're imported, and one exported by the new User canister.
#[test]
fn migrated_users_direct_chats_end_up_in_stable_memory() {
    // Installing the prod wasms would downgrade the canisters of any other test drawing a pooled env
    let mut wrapper = ENV.deref().create_new();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let prod_version = BuildVersion::new(0, 0, 1);
    let new_version = BuildVersion::new(0, 0, 2);
    client::user_index::happy_path::upgrade_user_canister_wasm(
        env,
        *controller,
        canister_ids.user_index,
        CanisterWasm {
            version: prod_version,
            module: wasms::USER_PROD.module.clone(),
        },
    );
    client::user_index::happy_path::upgrade_multi_user_canister_wasm(
        env,
        *controller,
        canister_ids.user_index,
        CanisterWasm {
            version: prod_version,
            module: wasms::MULTI_USER_PROD.module.clone(),
        },
    );
    tick_many(env, 3);

    let operator = platform_operator(env, canister_ids, *controller);
    let local_user_index = client::user_index::happy_path::user_registration_canister(env, canister_ids.user_index);
    let multi_user_canister =
        client::user_index::happy_path::create_multi_user_canister(env, *controller, canister_ids, local_user_index);
    assert_eq!(wasm_version(env, multi_user_canister), prod_version);

    // Each user to be migrated has a chat with each of two users who stay in User canisters, one of
    // which has disappearing messages
    let partners: Vec<_> = (0..2).map(|_| client::register_user(env, canister_ids)).collect();
    let users: Vec<_> = (0..3).map(|_| client::register_user(env, canister_ids)).collect();
    let mut disappearing_messages = Vec::new();
    for user in users.iter() {
        assert_eq!(wasm_version(env, user.canister()), prod_version);
        client::user::happy_path::update_chat_settings(
            env,
            user,
            &user_canister::update_chat_settings::Args {
                user_id: partners[1].user_id,
                events_ttl: OptionUpdate::SetToSome(DAY_IN_MS),
            },
        );
        for i in 0..3 {
            client::user::happy_path::send_text_message(env, user, partners[0].user_id, format!("to partner {i}"), None);
            client::user::happy_path::send_text_message(env, &partners[0], user.user_id, format!("from partner {i}"), None);
        }
        let message = client::user::happy_path::send_text_message(env, user, partners[1].user_id, random_string(), None);
        disappearing_messages.push(message.event_index);
    }
    tick_many(env, 5);
    let snapshots: Vec<_> = users.iter().map(|user| direct_chats_with(env, user, &partners)).collect();

    // The MultiUser canister in production imports the first user's chats onto the heap
    let migrated_0 = migrate(env, canister_ids, &operator, &users[0], multi_user_canister);
    assert_eq!(direct_chats_in_stable_memory(env, multi_user_canister, &migrated_0), 0);

    // Once upgraded, it moves them into stable memory
    client::user_index::happy_path::upgrade_multi_user_canister_wasm(
        env,
        *controller,
        canister_ids.user_index,
        CanisterWasm {
            version: new_version,
            module: wasms::MULTI_USER.module.clone(),
        },
    );
    tick_until(env, |env| wasm_version(env, multi_user_canister) == new_version);
    assert_chats_in_stable_memory(env, multi_user_canister, &migrated_0, &partners, &snapshots[0]);

    // A user exported by the User canister in production has their chats moved as they're imported
    let migrated_1 = migrate(env, canister_ids, &operator, &users[1], multi_user_canister);
    assert_chats_in_stable_memory(env, multi_user_canister, &migrated_1, &partners, &snapshots[1]);

    // A user exported by the new User canister brings their chats with them in stable memory, where
    // the upgrade moved them
    client::user_index::happy_path::upgrade_user_canister_wasm(
        env,
        *controller,
        canister_ids.user_index,
        CanisterWasm {
            version: new_version,
            module: wasms::USER.module.clone(),
        },
    );
    tick_until(env, |env| wasm_version(env, users[2].canister()) == new_version);
    let migrated_2 = migrate(env, canister_ids, &operator, &users[2], multi_user_canister);
    assert_chats_in_stable_memory(env, multi_user_canister, &migrated_2, &partners, &snapshots[2]);

    // Every user's chats still work: messages are sent and received, and disappear when they expire
    let migrated = [migrated_0, migrated_1, migrated_2];
    for user in migrated.iter() {
        client::user::happy_path::send_text_message(env, user, partners[0].user_id, "sent after", None);
        client::user::happy_path::send_text_message(env, &partners[0], user.user_id, "received after", None);
    }
    tick_many(env, 10);
    for user in migrated.iter() {
        let latest_message = direct_chats_with(env, user, &partners)[0].2.clone();
        assert_eq!(latest_message, "received after");
        let partners_latest_message = direct_chats_with(env, &partners[0], std::slice::from_ref(user))[0].2.clone();
        assert_eq!(partners_latest_message, "received after");
    }

    env.advance_time(Duration::from_millis(2 * DAY_IN_MS));
    tick_many(env, 5);
    for (user, event_index) in migrated.iter().zip(disappearing_messages) {
        let response = client::user::happy_path::events_by_index(env, user, partners[1].user_id, vec![event_index]);
        assert!(response.events.is_empty(), "{response:?}");
        assert!(!response.expired_event_ranges.is_empty());
    }

    // Releasing the prod wasms would break later tests which draw this env
    wrapper.discard();
}

// Migrates the user to the MultiUser canister, returning them under their new id
fn migrate(env: &mut PocketIc, canister_ids: &CanisterIds, operator: &User, user: &User, target: CanisterId) -> User {
    migrate_users(
        env,
        operator.principal,
        canister_ids.user_index,
        vec![user.user_id],
        Some(target),
    );
    let new_user_id = wait_for_import(env, operator.principal, canister_ids.user_index, user.user_id);
    User {
        principal: user.principal,
        user_id: new_user_id,
        public_key: user.public_key.clone(),
        local_user_index: user.local_user_index,
    }
}

// The user's direct chats with each of the given users, as the other user, the index of the latest
// message and its text
fn direct_chats_with(env: &PocketIc, user: &User, others: &[User]) -> Vec<(UserId, MessageIndex, String)> {
    let state = client::user::happy_path::initial_state(env, user);
    others
        .iter()
        .map(|other| {
            let chat = state
                .direct_chats
                .summaries
                .iter()
                .find(|c| c.them == other.user_id)
                .unwrap_or_else(|| panic!("No chat with {}", other.user_id));
            let latest_message = chat.latest_message.as_ref().unwrap();
            let text = match &latest_message.event.content {
                MessageContent::Text(text) => text.text.clone(),
                content => panic!("Unexpected content: {content:?}"),
            };
            (other.user_id, latest_message.event.message_index, text)
        })
        .collect()
}

// Checks that every one of the user's direct chats is in the MultiUser canister's stable memory, and
// that their chats with the given users are as they were before they were migrated
fn assert_chats_in_stable_memory(
    env: &PocketIc,
    multi_user_canister: CanisterId,
    user: &User,
    partners: &[User],
    snapshot: &[(UserId, MessageIndex, String)],
) {
    let chat_count = client::user::happy_path::initial_state(env, user)
        .direct_chats
        .summaries
        .len();
    assert!(chat_count > partners.len());
    assert_eq!(direct_chats_in_stable_memory(env, multi_user_canister, user), chat_count);
    assert_eq!(direct_chats_with(env, user, partners), snapshot);
}

// The number of the user's direct chats stored whole in the MultiUser canister's stable memory map
fn direct_chats_in_stable_memory(env: &PocketIc, multi_user_canister: CanisterId, user: &User) -> usize {
    let scope = user.user_id.index().to_be_bytes();
    crate::stable_memory::get_stable_memory_map(env, multi_user_canister, MemoryId::new(1))
        .keys()
        .filter(|key| key.len() > 2 && key[..2] == scope && key[2] == KeyType::DirectChat as u8)
        .count()
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

// A stand-in MultiUser canister id. The UserIndex only tells real MultiUser canisters to import
// users, so migrations to these stay started.
fn multi_user_canister(i: u8) -> CanisterId {
    Principal::from_slice(&[0, 0, 0, 0, 0, 0, 0, i, 1, 1])
}

#[derive(serde::Deserialize)]
struct UserMigrationMetrics {
    started: usize,
    imported: usize,
    failed: usize,
    failed_by_error_code: BTreeMap<u16, usize>,
}

impl UserMigrationMetrics {
    // Migrations which have started, including those whose user has since been imported
    fn started_or_imported(&self) -> usize {
        self.started + self.imported
    }
}

fn user_migration_metrics(env: &PocketIc, user_index: CanisterId) -> UserMigrationMetrics {
    serde_json::from_value(metrics(env, user_index)["user_migrations"].clone()).unwrap()
}

fn wasm_version(env: &PocketIc, canister_id: CanisterId) -> BuildVersion {
    serde_json::from_value(metrics(env, canister_id)["wasm_version"].clone()).unwrap()
}

// Starts migrating the user to the given canister, which the UserIndex doesn't check is a MultiUser
// canister in test mode
fn start_migration(env: &mut PocketIc, canister_ids: &CanisterIds, controller: Principal, user: &User, target: CanisterId) {
    let operator = platform_operator(env, canister_ids, controller);
    migrate_users(
        env,
        operator.principal,
        canister_ids.user_index,
        vec![user.user_id],
        Some(target),
    );
    tick_many(env, 10);
    let started = started_migration(env, operator.principal, canister_ids.user_index, user.user_id);
    assert!(started.user_bytes > 0);
}

struct StartedMigration {
    user_bytes: u64,
    wasm_version: BuildVersion,
}

fn user_migration_status(
    env: &PocketIc,
    sender: Principal,
    user_index: CanisterId,
    user_id: UserId,
) -> Option<UserMigrationStatus> {
    match client::user_index::user_migration(
        env,
        sender,
        user_index,
        &user_index_canister::user_migration::Args { user_id },
    ) {
        user_index_canister::user_migration::Response::Success(status) => Some(status),
        user_index_canister::user_migration::Response::NotFound => None,
    }
}

fn started_migration(env: &PocketIc, sender: Principal, user_index: CanisterId, user_id: UserId) -> StartedMigration {
    match user_migration_status(env, sender, user_index, user_id) {
        Some(UserMigrationStatus::Started {
            user_bytes,
            wasm_version,
            ..
        }) => StartedMigration {
            user_bytes,
            wasm_version,
        },
        status => panic!("Migration not started: {status:?}"),
    }
}

// A canister which isn't ready is retried by the LocalUserIndex until its attempts run out
// Waits until the user has been imported into the MultiUser canister they're being migrated to.
// Returns their new id.
fn wait_for_import(env: &mut PocketIc, sender: Principal, user_index: CanisterId, user_id: UserId) -> UserId {
    tick_until(env, |env| {
        matches!(
            user_migration_status(env, sender, user_index, user_id),
            Some(UserMigrationStatus::Imported { .. })
        )
    });
    match user_migration_status(env, sender, user_index, user_id) {
        Some(UserMigrationStatus::Imported { new_user_id, .. }) => new_user_id,
        status => panic!("User not imported: {status:?}"),
    }
}

// Ticks, moving time on a second at a time so that jobs retrying after a delay run, until
// `condition` holds. Fails if it doesn't within a generous number of rounds.
fn tick_until(env: &mut PocketIc, condition: impl Fn(&PocketIc) -> bool) {
    for _ in 0..100 {
        if condition(env) {
            return;
        }
        env.advance_time(Duration::from_secs(1));
        env.tick();
    }
    assert!(condition(env), "Condition not met");
}

fn wait_for_migration_attempts_to_run_out(env: &mut PocketIc) {
    for _ in 0..25 {
        env.advance_time(Duration::from_secs(31));
        tick_many(env, 3);
    }
}

// Registers a platform operator, and raises the migration concurrency so that migrations left
// running by earlier tests in the env don't hold up those started here
fn platform_operator(env: &mut PocketIc, canister_ids: &CanisterIds, controller: Principal) -> User {
    let operator = client::register_user(env, canister_ids);
    client::user_index::happy_path::add_platform_operator(env, controller, canister_ids.user_index, operator.user_id);

    let response = client::user_index::set_user_migration_concurrency(
        env,
        operator.principal,
        canister_ids.user_index,
        &user_index_canister::set_user_migration_concurrency::Args { value: 1000 },
    );
    assert!(matches!(response, types::SuccessOnly::Success), "{response:?}");
    operator
}

fn migrate_users(
    env: &mut PocketIc,
    sender: Principal,
    user_index: CanisterId,
    user_ids: Vec<UserId>,
    multi_user_canister_id: Option<CanisterId>,
) -> Vec<UserId> {
    let response = client::user_index::migrate_users(
        env,
        sender,
        user_index,
        &user_index_canister::migrate_users::Args {
            users: user_index_canister::migrate_users::UsersToMigrate::Specific(user_ids),
            multi_user_canister_id,
        },
    );
    match response {
        user_index_canister::migrate_users::Response::Success(result) => result.queued,
        response => panic!("'migrate_users' error: {response:?}"),
    }
}

fn subscribe_to_notifications(env: &mut PocketIc, canister_ids: &CanisterIds, user: &User) {
    client::notifications_index::happy_path::push_subscription(
        env,
        user.principal,
        canister_ids.notifications_index,
        random_string(),
        random_string(),
        format!("https://{}.com/", random_string()),
    );
}

// Sends a message to the group, returning the users its notification is pushed to
fn group_message_notification_recipients(
    env: &mut PocketIc,
    controller: Principal,
    local_user_index: CanisterId,
    sender: &User,
    group_id: ChatId,
) -> Vec<UserId> {
    let from_index = client::local_user_index::happy_path::latest_notification_index(env, controller, local_user_index) + 1;
    client::group::happy_path::send_text_message(env, sender, group_id, None, random_string(), None);
    tick_many(env, 3);
    client::local_user_index::happy_path::notifications(env, controller, local_user_index, from_index)
        .subscriptions
        .into_keys()
        .collect()
}

fn set_message_reminder(env: &mut PocketIc, user: &User, other_user: &User, remind_in: u64) {
    client::user::set_message_reminder_v2(
        env,
        user.principal,
        user.canister(),
        &user_canister::set_message_reminder_v2::Args {
            chat: Chat::Direct(other_user.user_id.into()),
            thread_root_message_index: None,
            event_index: 10.into(),
            notes: None,
            remind_at: now_millis(env) + remind_in,
        },
    );
}
