use crate::env::ENV;
use crate::setup::install_icrc_ledger;
use crate::upgrade_from_prod_tests::try_wasm_version;
use crate::utils::{chat_token_info, icp_token_info, metrics, now_millis, tick_many};
use crate::{CanisterIds, TestEnv, User, client, wasms};
use candid::{CandidType, Nat, Principal};
use constants::{DAY_IN_MS, HOUR_IN_MS, ICP_SYMBOL, ICP_TRANSFER_FEE, MINUTE_IN_MS, OPENCHAT_BOT_USER_ID};
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
    AutonomousConfig, BotChatContext, BotDefinition, BotInstallationLocation, BotMessageContent, BotPermissions, BuildVersion,
    CLAIM_TYPE_START_VIDEO_CALL, CanisterId, CanisterWasm, ChannelId, Chat, ChatEvent, ChatId, CommunityId, CommunityRole,
    DiamondMembershipPlanDuration, Document, Empty, EventIndex, EventsResponse, FcmToken, FileContent, IdempotentEnvelope,
    MessageContent, MessageContentInitial, MessageIndex, NotificationSubscription, OptionUpdate, P2PSwapContentInitial,
    PendingCryptoTransaction, ReferralStatus, StartVideoCallClaims, SubscriptionInfo, SubscriptionKeys, TextContent,
    UnitResult, UserId, VideoCallType, icrc1, icrc2,
};
use user_canister::{MessageActivity, UserCanisterEvent};
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
fn users_with_a_cancelled_p2p_swap_in_a_direct_chat_are_migrated_an_hour_after_it_is_cancelled() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let user1 = client::register_diamond_user(env, canister_ids, *controller);
    let user2 = client::register_user(env, canister_ids);

    client::ledger::happy_path::transfer(env, *controller, canister_ids.chat_ledger, user1.user_id, 11_000_000_000);

    let message_id = random_from_u128();
    let response = client::user::send_message_v2(
        env,
        user1.principal,
        user1.canister(),
        &user_canister::send_message_v2::Args {
            recipient: user2.user_id,
            thread_root_message_index: None,
            message_id,
            content: MessageContentInitial::P2PSwap(P2PSwapContentInitial {
                token0: chat_token_info(),
                token0_amount: 10_000_000_000,
                token1: icp_token_info(),
                token1_amount: 1_000_000_000,
                expires_in: DAY_IN_MS,
                caption: None,
                from_account: None,
            }),
            replies_to: None,
            forwarding: false,
            block_level_markdown: false,
            message_filter_failed: None,
            pin: None,
            og_previews: Vec::new(),
        },
    );
    assert!(
        matches!(response, user_canister::send_message_v2::Response::TransferSuccessV2(_)),
        "{response:?}"
    );
    crate::utils::wait_for_direct_chat(env, &user2, user1.user_id);

    let response = client::user::cancel_p2p_swap(
        env,
        user1.principal,
        user1.canister(),
        &user_canister::cancel_p2p_swap::Args {
            user_id: user2.user_id,
            message_id,
        },
    );
    assert!(
        matches!(response, user_canister::cancel_p2p_swap::Response::Success),
        "{response:?}"
    );
    tick_many(env, 10);

    // Once the swap has ended, neither the job to mark it expired nor the offerer's record of it holds
    // up migrating either user until the day it was set to expire
    env.advance_time(Duration::from_millis(2 * HOUR_IN_MS));
    let operator = platform_operator(env, canister_ids, *controller);
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
    // And a message reminder, whose timer job is handed over along with the user
    let reminder = set_message_reminder(env, &user1, &user2, 30_000);
    tick_many(env, 3);

    start_migration(env, canister_ids, *controller, &user1, multi_user_canister(1));
    // The reminder isn't sent while the user is being migrated
    env.advance_time(Duration::from_millis(30_000));
    tick_many(env, 3);
    assert!(reminders_sent(env, user1.principal, user1.canister(), user1.user_id).is_empty());

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
    // As was the reminder, which fell due while the user was being migrated
    assert_eq!(
        reminders_sent(env, user1.principal, user1.canister(), user1.user_id),
        vec![reminder]
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
    // Waits for the migration to start rather than for a fixed number of rounds. The newly registered
    // user's canister may not be ready to be migrated yet, eg. while the events from its welcome
    // messages are still to be sent to the LocalUserIndex, in which case the LocalUserIndex tries
    // again 30 seconds later. And a new canister's first message is sometimes only handled a dozen or
    // so rounds later.
    tick_until(env, |env| {
        !matches!(
            user_migration_status(env, operator.principal, canister_ids.user_index, user.user_id),
            None | Some(UserMigrationStatus::Queued | UserMigrationStatus::Requested { .. })
        )
    });
    started_migration(env, operator.principal, canister_ids.user_index, user.user_id);

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
fn migrated_users_message_reminders_are_sent_from_their_new_canister() {
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

    // Reminders due once the user has been imported, one of which they cancel in their new canister
    let reminder = set_message_reminder(env, &user1, &user2, HOUR_IN_MS);
    let cancelled_reminder = set_message_reminder(env, &user1, &user2, HOUR_IN_MS);

    migrate_users(
        env,
        operator.principal,
        canister_ids.user_index,
        vec![user1.user_id],
        Some(multi_user_canister),
    );
    let new_user_id = wait_for_import(env, operator.principal, canister_ids.user_index, user1.user_id);
    assert_eq!(new_user_id.canister_id(), multi_user_canister);

    let response = client::user::cancel_message_reminder(
        env,
        user1.principal,
        multi_user_canister,
        &user_canister::cancel_message_reminder::Args {
            reminder_id: cancelled_reminder,
        },
    );
    assert!(matches!(response, types::SuccessOnly::Success), "{response:?}");
    assert!(reminders_sent(env, user1.principal, multi_user_canister, new_user_id).is_empty());

    env.advance_time(Duration::from_millis(HOUR_IN_MS));
    tick_until(env, |env| {
        !reminders_sent(env, user1.principal, multi_user_canister, new_user_id).is_empty()
    });
    tick_many(env, 3);
    assert_eq!(
        reminders_sent(env, user1.principal, multi_user_canister, new_user_id),
        vec![reminder]
    );
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
    let endpoint1 = random_string();
    client::notifications_index::happy_path::push_subscription(
        env,
        user1.principal,
        canister_ids.notifications_index,
        "auth",
        "p256dh",
        &endpoint1,
    );

    let new_user1 = migrate(env, canister_ids, &operator, &user1, multi_user_canister);
    wait_until_local_user_index_knows_of_migration(env, local_user_index, &user1, new_user1.user_id);
    tick_many(env, 5);

    // A subscription pushed once the NotificationsIndex has been told of the migration is held under
    // the user's new id, so they are notified on that device of messages sent to them
    let endpoint2 = random_string();
    client::notifications_index::happy_path::push_subscription(
        env,
        user1.principal,
        canister_ids.notifications_index,
        "auth",
        "p256dh",
        &endpoint2,
    );
    tick_many(env, 3);
    let latest_notification_index =
        client::local_user_index::happy_path::latest_notification_index(env, *controller, local_user_index);
    client::user::happy_path::send_text_message(env, &user2, new_user1.user_id, random_string(), None);
    tick_many(env, 3);
    let notifications =
        client::local_user_index::happy_path::notifications(env, *controller, local_user_index, latest_notification_index + 1);
    assert_eq!(notifications.notifications.len(), 1);
    assert!(
        notifications.subscriptions[&new_user1.user_id]
            .iter()
            .any(|s| matches!(s, NotificationSubscription::WebPush(s) if s.endpoint == endpoint2)),
        "{:?}",
        notifications.subscriptions
    );

    // Knowing the user by their new id, the NotificationsIndex also holds the subscription pushed
    // before they were migrated under it
    assert!(client::notifications_index::happy_path::subscription_exists(
        env,
        user1.principal,
        canister_ids.notifications_index,
        &endpoint1
    ));
}

// Devices the user subscribed before being migrated go on being notified, under their new id, without
// the user reopening OpenChat on them to subscribe again
#[test]
fn user_subscribed_before_being_migrated_is_notified_under_their_new_id() {
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

    // A browser subscribed to web push and a phone registered for FCM pushes
    let subscription = SubscriptionInfo {
        endpoint: format!("https://{}.com/", random_string()),
        keys: SubscriptionKeys {
            p256dh: random_string(),
            auth: random_string(),
        },
    };
    client::notifications_index::happy_path::push_subscription(
        env,
        user1.principal,
        canister_ids.notifications_index,
        &subscription.keys.auth,
        &subscription.keys.p256dh,
        &subscription.endpoint,
    );
    let fcm_token = FcmToken(random_string());
    client::notifications_index::happy_path::add_fcm_token(
        env,
        user1.principal,
        canister_ids.notifications_index,
        fcm_token.clone(),
    );
    tick_many(env, 3);

    let new_user1 = migrate(env, canister_ids, &operator, &user1, multi_user_canister);
    wait_until_local_user_index_knows_of_migration(env, local_user_index, &user1, new_user1.user_id);

    let latest_notification_index =
        client::local_user_index::happy_path::latest_notification_index(env, *controller, local_user_index);
    client::user::happy_path::send_text_message(env, &user2, new_user1.user_id, random_string(), None);
    tick_many(env, 3);
    let notifications =
        client::local_user_index::happy_path::notifications(env, *controller, local_user_index, latest_notification_index + 1);
    assert_eq!(notifications.notifications.len(), 1);
    assert_eq!(
        notifications.subscriptions.get(&new_user1.user_id),
        Some(&vec![
            NotificationSubscription::WebPush(subscription),
            NotificationSubscription::FcmPush(fcm_token)
        ]),
        "{:?}",
        notifications.subscriptions
    );
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
fn bot_installed_in_a_users_direct_chats_before_they_migrate_reaches_them_via_the_gateway_it_is_told_of() {
    use types::{
        AutonomousConfig, BotChatContext, BotDataEncoding, BotEvent, BotEventWrapper, BotLifecycleEvent, BotMessageContent,
        NotificationEnvelope, TextContent,
    };
    use user_index_canister::bot_installation_events::BotInstallationEvent;

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
    // The user's old canister is held by another LocalUserIndex than the MultiUser canister, which only
    // takes calls from its own LocalUserIndex
    let subnet = canister_ids
        .subnets
        .iter()
        .find(|s| s.local_user_index != local_user_index)
        .unwrap()
        .subnet_id;
    let user = client::register_user_on_subnet(env, canister_ids, subnet);
    let bot_owner = client::register_user(env, canister_ids);

    // The user installs a bot in their direct chats, which may send text messages autonomously, and
    // which only its owner may install anywhere else
    let bot_principal = random_principal();
    let response = client::user_index::register_bot(
        env,
        bot_owner.principal,
        canister_ids.user_index,
        &user_index_canister::register_bot::Args {
            principal: bot_principal,
            name: random_string(),
            avatar: None,
            endpoint: "https://my.bot.xyz/".to_string(),
            definition: BotDefinition {
                description: random_string(),
                commands: Vec::new(),
                autonomous_config: Some(AutonomousConfig {
                    permissions: BotPermissions::text_only(),
                }),
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
        Some(BotPermissions::text_only()),
    );
    tick_many(env, 3);

    let installation_events = |env: &PocketIc| {
        let response = client::user_index::bot_installation_events(
            env,
            bot_principal,
            canister_ids.user_index,
            &user_index_canister::bot_installation_events::Args { from: 0, size: 100 },
        );
        let user_index_canister::bot_installation_events::Response::Success(result) = response else {
            panic!("'bot_installation_events' error: {response:?}");
        };
        result.events
    };
    assert_eq!(installation_events(env).len(), 1);
    let controller = *controller;
    let notification_index = client::local_user_index::happy_path::latest_notification_index(env, controller, local_user_index);
    // The lifecycle events the MultiUser canister's LocalUserIndex has sent the bot since the user was
    // migrated, with the gateway each names
    let lifecycle_events = |env: &PocketIc| {
        client::local_user_index::happy_path::notifications(env, controller, local_user_index, notification_index + 1)
            .notifications
            .into_iter()
            .filter_map(|n| match n.value {
                NotificationEnvelope::Bot(n) if n.recipients.contains_key(&bot.bot_id) => Some(n),
                _ => None,
            })
            .filter_map(|n| {
                let wrapper: BotEventWrapper = msgpack::deserialize_then_unwrap(&n.event_map[&BotDataEncoding::MsgPack].data);
                match wrapper.event {
                    BotEvent::Lifecycle(event) => Some((wrapper.api_gateway, event)),
                    _ => None,
                }
            })
            .collect::<Vec<_>>()
    };

    let new_user = migrate(env, canister_ids, &operator, &user, multi_user_canister);
    let old_location = BotInstallationLocation::User(user.user_id.into());
    let new_location = BotInstallationLocation::User(new_user.user_id.into());

    // The UserIndex records that the bot is installed in the user's direct chats under their new id
    // instead, with the MultiUser canister's LocalUserIndex as its gateway
    tick_until(env, |env| installation_events(env).len() == 3);
    let events = installation_events(env);
    assert!(
        matches!(&events[1], BotInstallationEvent::Uninstalled(e) if e.location == old_location),
        "{events:?}"
    );
    let BotInstallationEvent::Installed(installed) = &events[2] else {
        panic!("{events:?}");
    };
    assert_eq!(installed.location, new_location);
    assert_eq!(installed.api_gateway, local_user_index);
    assert_eq!(installed.granted_autonomous_permissions, BotPermissions::text_only());

    // And that LocalUserIndex tells the bot, as it would of an install
    tick_until(env, |env| {
        let events = lifecycle_events(env);
        events
            .iter()
            .any(|(_, e)| matches!(e, BotLifecycleEvent::Uninstalled(u) if u.location == old_location))
            && events.iter().any(|(gateway, e)| {
                *gateway == local_user_index && matches!(e, BotLifecycleEvent::Installed(i) if i.location == new_location)
            })
    });

    // So the bot reaches the user in their new canister via that gateway
    let BotInstallationLocation::User(chat_id) = installed.location else {
        panic!("{installed:?}");
    };
    let text = random_string();
    let response = client::local_user_index::bot_send_message(
        env,
        bot_principal,
        installed.api_gateway,
        &local_user_index_canister::bot_send_message::Args {
            chat_context: BotChatContext::Autonomous(Chat::Direct(chat_id)),
            thread: None,
            message_id: None,
            replies_to: None,
            content: BotMessageContent::Text(TextContent { text: text.clone() }),
            block_level_markdown: false,
            finalised: true,
            og_previews: None,
        },
    );
    assert!(
        matches!(response, local_user_index_canister::bot_send_message::Response::Success(_)),
        "{response:?}"
    );
    let user_canister::initial_state::Response::Success(state) = client::user::initial_state(
        env,
        new_user.principal,
        multi_user_canister,
        &user_canister::initial_state::Args {},
    );
    let chat = state.direct_chats.summaries.iter().find(|c| c.them == bot.bot_id).unwrap();
    assert!(matches!(&chat.latest_message.as_ref().unwrap().event.content, MessageContent::Text(t) if t.text == text));

    // And the user may still uninstall and reinstall it, being permitted to by their new id
    client::local_user_index::happy_path::uninstall_bot(env, user.principal, local_user_index, new_location, bot.bot_id);
    client::local_user_index::happy_path::install_bot(
        env,
        user.principal,
        local_user_index,
        new_location,
        bot.bot_id,
        BotPermissions::text_only(),
        Some(BotPermissions::text_only()),
    );
}

#[test]
fn bot_registered_privately_by_a_user_before_they_migrate_can_be_installed_by_them() {
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
    let owner = client::register_user(env, canister_ids);
    let (bot_id, _) = client::user_index::happy_path::register_bot(
        env,
        owner.principal,
        canister_ids.user_index,
        random_string(),
        "https://my.bot.xyz/".to_string(),
        BotDefinition {
            description: random_string(),
            commands: Vec::new(),
            autonomous_config: None,
            default_subscriptions: None,
            data_encoding: None,
            restricted_locations: None,
        },
    );

    // Each LocalUserIndex knows the bot's owner by the id they had when registering it
    let new_owner = migrate(env, canister_ids, &operator, &owner, multi_user_canister);
    // The UserIndex tells the LocalUserIndex of the owner's new id once they've been imported, which
    // can take some rounds to arrive
    tick_until(env, |env| {
        client::local_user_index::happy_path::latest_user_id(env, owner.principal, local_user_index, owner.user_id)
            == new_owner.user_id
    });

    client::local_user_index::happy_path::install_bot(
        env,
        new_owner.principal,
        local_user_index,
        BotInstallationLocation::User(new_owner.user_id.into()),
        bot_id,
        BotPermissions::text_only(),
        None,
    );
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

#[test_case(true; "migrated_to_the_same_local_user_index")]
#[test_case(false; "migrated_to_another_local_user_index")]
fn bot_acting_autonomously_in_a_migrated_users_direct_chat_by_their_old_id(same_local_user_index: bool) {
    use local_user_index_canister::chat_events::{EventsPageArgs, EventsSelectionCriteria};

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
    // The user's old canister is held by the same LocalUserIndex as the MultiUser canister, or by
    // another, which the bot keeps calling, since it was installed via it
    let subnet = canister_ids
        .subnets
        .iter()
        .find(|s| (s.local_user_index == local_user_index) == same_local_user_index)
        .unwrap()
        .subnet_id;
    let user = client::register_user_on_subnet(env, canister_ids, subnet);
    let other_user = client::register_user(env, canister_ids);

    // The user installs a bot in their direct chats which may send text messages autonomously
    let (bot_id, bot_principal) = client::user_index::happy_path::register_bot(
        env,
        user.principal,
        canister_ids.user_index,
        random_string(),
        "https://my.bot.xyz/".to_string(),
        BotDefinition {
            description: random_string(),
            commands: Vec::new(),
            autonomous_config: Some(AutonomousConfig {
                permissions: BotPermissions::text_only(),
            }),
            default_subscriptions: None,
            data_encoding: None,
            restricted_locations: None,
        },
    );
    client::local_user_index::happy_path::install_bot(
        env,
        user.principal,
        user.local_user_index,
        BotInstallationLocation::User(user.user_id.into()),
        bot_id,
        BotPermissions::text_only(),
        Some(BotPermissions::text_only()),
    );
    tick_many(env, 3);

    let new_user = migrate(env, canister_ids, &operator, &user, multi_user_canister);
    crate::delete_user_tests::wait_for_cycles_to_be_refunded(env, &user);

    // The bot still knows the user by their old id, and calls the LocalUserIndex it was installed via
    let text = random_string();
    let send_message = |env: &mut PocketIc| {
        client::local_user_index::bot_send_message(
            env,
            bot_principal,
            user.local_user_index,
            &local_user_index_canister::bot_send_message::Args {
                chat_context: BotChatContext::Autonomous(Chat::Direct(user.user_id.into())),
                thread: None,
                message_id: None,
                replies_to: None,
                content: BotMessageContent::Text(TextContent { text: text.clone() }),
                block_level_markdown: false,
                finalised: true,
                og_previews: None,
            },
        )
    };
    let chat_events = |env: &mut PocketIc| {
        client::local_user_index::bot_chat_events(
            env,
            bot_principal,
            user.local_user_index,
            &local_user_index_canister::bot_chat_events::Args {
                chat_context: BotChatContext::Autonomous(Chat::Direct(user.user_id.into())),
                thread: None,
                events: EventsSelectionCriteria::Page(EventsPageArgs {
                    start_index: 0.into(),
                    ascending: true,
                    max_messages: 10,
                    max_events: 10,
                }),
            },
        )
    };
    // As may another user starting a video call with them, from a client which still knows them by it
    let video_call_token = |env: &mut PocketIc| {
        client::local_user_index::access_token_v2(
            env,
            other_user.principal,
            user.local_user_index,
            &local_user_index_canister::access_token_v2::Args::StartVideoCall(
                local_user_index_canister::access_token_v2::StartVideoCallArgs {
                    chat: Chat::Direct(user.user_id.into()),
                    call_type: VideoCallType::Default,
                    audio_only: false,
                },
            ),
        )
    };

    if !same_local_user_index {
        // The user's new canister is on another subnet, which that LocalUserIndex can't reach, so
        // each is told the user has moved, and their new id, rather than the call being sent
        let errors = [
            match send_message(env) {
                local_user_index_canister::bot_send_message::Response::Error(error) => error,
                response => panic!("{response:?}"),
            },
            match chat_events(env) {
                local_user_index_canister::bot_chat_events::Response::Error(error) => error,
                response => panic!("{response:?}"),
            },
            match video_call_token(env) {
                local_user_index_canister::access_token_v2::Response::Error(error) => error,
                response => panic!("{response:?}"),
            },
        ];
        for error in errors {
            assert!(error.matches_code(OCErrorCode::UserMovedToNewSubnet), "{error:?}");
            assert_eq!(error.message(), Some(new_user.user_id.to_string().as_str()));
        }
        return;
    }

    // Otherwise the LocalUserIndex sends the bot's message on to the user's new canister
    let response = send_message(env);
    assert!(
        matches!(response, local_user_index_canister::bot_send_message::Response::Success(_)),
        "{response:?}"
    );
    let user_canister::initial_state::Response::Success(state) = client::user::initial_state(
        env,
        new_user.principal,
        multi_user_canister,
        &user_canister::initial_state::Args {},
    );
    let chat = state.direct_chats.summaries.iter().find(|c| c.them == bot_id).unwrap();
    assert!(matches!(&chat.latest_message.as_ref().unwrap().event.content, MessageContent::Text(t) if t.text == text));

    // And the bot reads the chat back by their old id
    let response = chat_events(env);
    let local_user_index_canister::bot_chat_events::Response::Success(result) = &response else {
        panic!("{response:?}");
    };
    assert!(
        result.events.iter().any(
            |e| matches!(&e.event, ChatEvent::Message(m) if m.sender == bot_id && m.content.text() == Some(text.as_str()))
        ),
        "{result:?}"
    );

    // A video call to the user by their old id is checked against their new canister too, and the
    // token names them by their new id, since the video bridge starts the call in that chat
    let response = video_call_token(env);
    let local_user_index_canister::access_token_v2::Response::Success(token) = response else {
        panic!("{response:?}");
    };
    let public_key = client::user_index::happy_path::public_key(env, canister_ids.user_index);
    let claims: jwt::Claims<StartVideoCallClaims> =
        jwt::verify_and_decode(&token, &public_key, CLAIM_TYPE_START_VIDEO_CALL).unwrap();
    assert_eq!(claims.custom().chat_id, Chat::Direct(new_user.user_id.into()));
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

    // An event queued for another user means the canister isn't ready to be migrated until it has
    // been delivered
    queue_event_for_stopped_user(env, &user1, &user2);
    let before = user_migration_metrics(env, canister_ids.user_index);

    migrate_users(env, operator.principal, canister_ids.user_index, vec![user1.user_id], None);
    tick_many(env, 10);

    let metrics = user_migration_metrics(env, canister_ids.user_index);
    assert_eq!(metrics.started_or_imported(), before.started_or_imported());
    assert_eq!(metrics.failed, before.failed);

    client::start_canister(env, user2.local_user_index, user2.canister());
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

    queue_event_for_stopped_user(env, &user1, &user2);
    let before = user_migration_metrics(env, canister_ids.user_index);

    migrate_users(env, operator.principal, canister_ids.user_index, vec![user1.user_id], None);

    wait_for_migration_attempts_to_run_out(env);
    client::start_canister(env, user2.local_user_index, user2.canister());

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

#[test]
fn migrated_user_who_has_forgotten_their_pin_resets_it_by_signing_in_again() {
    use user_canister::set_pin_number::{Args, PinNumberVerification};

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
    let (user, user_auth) = client::register_user_and_include_auth(env, canister_ids);
    client::user::happy_path::set_pin_number(env, &user, None, Some("1234".to_string()));

    let user = migrate(env, canister_ids, &operator, &user, multi_user_canister);
    let pin_number_settings = |env: &PocketIc| client::user::happy_path::initial_state(env, &user).pin_number_settings;
    assert_eq!(pin_number_settings(env).unwrap().length, 4);

    // Failed attempts lock the PIN, as they may for a user who has forgotten it
    for _ in 0..3 {
        client::user::set_pin_number(
            env,
            user.principal,
            user.canister(),
            &Args {
                new: None,
                verification: PinNumberVerification::PIN("0000".to_string().into()),
            },
        );
    }
    assert!(pin_number_settings(env).unwrap().attempts_blocked_until.is_some());

    // Signing in again replaces the PIN, and lifts the lock
    let session_key = rand::random::<[u8; 32]>().to_vec();
    let proof_jwt =
        client::identity::happy_path::prepare_delegation(env, user_auth.auth_principal(), canister_ids.identity, session_key)
            .proof_jwt;
    let response = client::user::set_pin_number(
        env,
        user.principal,
        user.canister(),
        &Args {
            new: Some("56789".to_string().into()),
            verification: PinNumberVerification::Reauthenticated(proof_jwt),
        },
    );
    assert!(
        matches!(response, user_canister::set_pin_number::Response::Success),
        "{response:?}"
    );
    let settings = pin_number_settings(env).unwrap();
    assert_eq!(settings.length, 5);
    assert!(settings.attempts_blocked_until.is_none());
}

// Users reach a MultiUser canister with their direct chats, groups and communities on the heap or
// already in stable memory, depending on the version of the User canister which exports them. This
// checks each user ends up with all of them in stable memory and still working: one exported by the
// User canister in production, whose chats are moved as they're imported, and one exported by the
// new User canister.
#[test]
fn migrated_users_chats_end_up_in_stable_memory() {
    // Installing the prod wasm would downgrade the User canisters of any other test drawing a pooled
    // env
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
    tick_many(env, 3);

    let operator = platform_operator(env, canister_ids, *controller);
    let local_user_index = client::user_index::happy_path::user_registration_canister(env, canister_ids.user_index);
    let multi_user_canister =
        client::user_index::happy_path::create_multi_user_canister(env, *controller, canister_ids, local_user_index);

    // Each user to be migrated has a chat with each of two users who stay in User canisters, one of
    // which has disappearing messages
    let partners: Vec<_> = (0..2).map(|_| client::register_user(env, canister_ids)).collect();
    let users: Vec<_> = (0..2).map(|_| client::register_user(env, canister_ids)).collect();
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

    // Each is also in a group and a community, having read some of each
    let owner = client::register_diamond_user(env, canister_ids, *controller);
    let group_id = client::user::happy_path::create_group(env, &owner, &random_string(), true, true);
    let community_id =
        client::user::happy_path::create_community(env, &owner, &random_string(), true, vec![random_string(), random_string()]);
    let mut channel_ids = Vec::new();
    for user in users.iter() {
        client::group::happy_path::join_group(env, user.principal, group_id);
        let community = client::community::happy_path::join_community(env, user.principal, community_id);
        channel_ids = community.channels.iter().map(|c| c.channel_id).collect();
    }
    assert_eq!(channel_ids.len(), 2);
    tick_many(env, 5);
    for (i, user) in users.iter().enumerate() {
        mark_group_and_channel_read(env, user, group_id, community_id, channel_ids[0], i as u32 + 1);
    }
    tick_many(env, 5);
    let snapshots: Vec<_> = users.iter().map(|user| snapshot(env, user, &partners)).collect();
    for snapshot in snapshots.iter() {
        assert_eq!(snapshot.groups.len(), 1);
        assert_eq!(snapshot.communities.len(), 1);
    }

    // A user exported by the User canister in production has their chats moved as they're imported.
    // Once a User canister which keeps them in stable memory is in production, this step repeats the
    // next one, and the MultiUser canister's import of chats from the heap can be removed.
    let migrated_0 = migrate(env, canister_ids, &operator, &users[0], multi_user_canister);
    assert_chats_in_stable_memory(env, multi_user_canister, &migrated_0, &partners, &snapshots[0]);

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
    tick_until(env, |env| try_wasm_version(env, users[1].canister()) == Some(new_version));
    let migrated_1 = migrate(env, canister_ids, &operator, &users[1], multi_user_canister);
    assert_chats_in_stable_memory(env, multi_user_canister, &migrated_1, &partners, &snapshots[1]);

    // Every user's chats still work: messages are sent and received, and disappear when they expire
    let migrated = [migrated_0, migrated_1];
    let latest_message =
        |env: &PocketIc, user: &User, them: &User| snapshot(env, user, std::slice::from_ref(them)).direct_chats[0].2.clone();
    for user in migrated.iter() {
        client::user::happy_path::send_text_message(env, user, partners[0].user_id, "sent after", None);
    }
    tick_many(env, 10);
    for user in migrated.iter() {
        assert_eq!(latest_message(env, user, &partners[0]), "sent after");
        assert_eq!(latest_message(env, &partners[0], user), "sent after");
        client::user::happy_path::send_text_message(env, &partners[0], user.user_id, "received after", None);
    }
    tick_many(env, 10);
    for user in migrated.iter() {
        assert_eq!(latest_message(env, user, &partners[0]), "received after");
        assert_eq!(latest_message(env, &partners[0], user), "received after");
    }

    env.advance_time(Duration::from_millis(2 * DAY_IN_MS));
    tick_many(env, 5);
    for (user, event_index) in migrated.iter().zip(disappearing_messages) {
        let response = client::user::happy_path::events_by_index(env, user, partners[1].user_id, vec![event_index]);
        assert!(response.events.is_empty(), "{response:?}");
        assert!(!response.expired_event_ranges.is_empty());
    }

    // Their groups and communities can still be read further, and leaving them removes them from
    // stable memory. The direct chats aren't included, since one now has no messages left.
    for user in migrated.iter() {
        mark_group_and_channel_read(env, user, group_id, community_id, channel_ids[0], 10);
        let after = snapshot(env, user, &[]);
        assert_eq!(after.groups, vec![(group_id, Some(10.into()))]);
        assert!(after.communities[0].1.contains(&(channel_ids[0], Some(10.into()))));

        client::user::happy_path::leave_group(env, user, group_id);
        client::user::happy_path::leave_community(env, user, community_id);
        assert_eq!(count_in_stable_memory(env, multi_user_canister, user, KeyType::GroupChat), 0);
        assert_eq!(count_in_stable_memory(env, multi_user_canister, user, KeyType::Community), 0);
        let after = snapshot(env, user, &[]);
        assert!(after.groups.is_empty() && after.communities.is_empty());
    }

    // Releasing the prod wasm would break later tests which draw this env
    wrapper.discard();
}

// Migrates the user to the MultiUser canister, returning them under their new id
pub(crate) fn migrate(
    env: &mut PocketIc,
    canister_ids: &CanisterIds,
    operator: &User,
    user: &User,
    target: CanisterId,
) -> User {
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

// How far the user has read each of a community's channels
type ChannelsRead = Vec<(ChannelId, Option<MessageIndex>)>;

#[derive(Debug, PartialEq, Eq)]
struct ChatsSnapshot {
    // The user's direct chats with each of the given users, as the other user, the index of the
    // latest message and its text
    direct_chats: Vec<(UserId, MessageIndex, String)>,
    // The groups the user is in, and how far they've read each
    groups: Vec<(ChatId, Option<MessageIndex>)>,
    // The communities the user is in, and how far they've read each of their channels
    communities: Vec<(CommunityId, ChannelsRead)>,
}

fn snapshot(env: &PocketIc, user: &User, others: &[User]) -> ChatsSnapshot {
    let state = client::user::happy_path::initial_state(env, user);
    let direct_chats = others
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
        .collect();
    let mut groups: Vec<_> = state
        .group_chats
        .summaries
        .iter()
        .map(|g| (g.chat_id, g.read_by_me_up_to))
        .collect();
    groups.sort();
    let mut communities: Vec<_> = state
        .communities
        .summaries
        .iter()
        .map(|c| {
            let mut channels: Vec<_> = c.channels.iter().map(|ch| (ch.channel_id, ch.read_by_me_up_to)).collect();
            channels.sort();
            (c.community_id, channels)
        })
        .collect();
    communities.sort();
    ChatsSnapshot {
        direct_chats,
        groups,
        communities,
    }
}

pub(crate) fn mark_group_and_channel_read(
    env: &mut PocketIc,
    user: &User,
    group_id: ChatId,
    community_id: CommunityId,
    channel_id: ChannelId,
    read_up_to: u32,
) {
    client::user::happy_path::mark_read(
        env,
        user,
        vec![user_canister::mark_read::ChatMessagesRead {
            chat_id: group_id,
            read_up_to: Some(read_up_to.into()),
            threads: Vec::new(),
            date_read_pinned: None,
        }],
        vec![user_canister::mark_read::CommunityMessagesRead {
            community_id,
            channels_read: vec![user_canister::mark_read::ChannelMessagesRead {
                channel_id,
                read_up_to: Some(read_up_to.into()),
                threads: Vec::new(),
                date_read_pinned: None,
            }],
        }],
    );
}

// Checks that every one of the user's direct chats, groups and communities is in the MultiUser
// canister's stable memory, and that they are as they were before the user was migrated
fn assert_chats_in_stable_memory(
    env: &PocketIc,
    multi_user_canister: CanisterId,
    user: &User,
    partners: &[User],
    expected: &ChatsSnapshot,
) {
    let direct_chat_count = client::user::happy_path::initial_state(env, user)
        .direct_chats
        .summaries
        .len();
    assert!(direct_chat_count > partners.len());
    assert_eq!(
        count_in_stable_memory(env, multi_user_canister, user, KeyType::DirectChat),
        direct_chat_count
    );
    assert_eq!(
        count_in_stable_memory(env, multi_user_canister, user, KeyType::GroupChat),
        expected.groups.len()
    );
    assert_eq!(
        count_in_stable_memory(env, multi_user_canister, user, KeyType::Community),
        expected.communities.len()
    );
    assert_eq!(&snapshot(env, user, partners), expected);
}

// The number of the user's entries of the given key type in the MultiUser canister's stable memory map
fn count_in_stable_memory(env: &PocketIc, multi_user_canister: CanisterId, user: &User, key_type: KeyType) -> usize {
    let scope = user.user_id.index().to_be_bytes();
    crate::stable_memory::get_stable_memory_map(env, multi_user_canister, MemoryId::new(1))
        .keys()
        .filter(|key| key.len() > 2 && key[..2] == scope && key[2] == key_type as u8)
        .count()
}

// A migrated user's messages sent before their migration keep the id they were sent under, while
// the group or community holds the user as a member under their new id. Reactions, quote replies
// and poll votes on those messages still reach the user, in their new canister.
#[test_case(false; "group")]
#[test_case(true; "channel")]
fn activity_on_messages_sent_before_their_sender_was_migrated_reaches_them(in_community: bool) {
    use std::collections::HashMap;
    use types::{GroupReplyContext, MessageId, PollConfig, PollContent, PollVotes, TextContent, TotalVotes};
    use user_canister::MessageActivity;

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
    // A Diamond member, so that they can create a public group or community for the others to join
    let owner = client::register_diamond_user(env, canister_ids, *controller);
    let sender = client::register_user(env, canister_ids);
    let other = client::register_user(env, canister_ids);

    let message_id = random_from_u128();
    let poll_message_id = random_from_u128();
    let poll = MessageContentInitial::Poll(PollContent {
        config: PollConfig {
            text: None,
            options: vec!["a".to_string(), "b".to_string()],
            end_date: None,
            anonymous: false,
            show_votes_before_end_date: true,
            allow_multiple_votes_per_user: false,
            allow_user_to_change_vote: false,
        },
        votes: PollVotes {
            total: TotalVotes::Visible(HashMap::new()),
            user: Vec::new(),
        },
        ended: false,
    });
    let (chat, event_index, poll_message_index) = if in_community {
        let community_id =
            client::user::happy_path::create_community(env, &owner, &random_string(), true, vec![random_string()]);
        let channel_id =
            client::community::happy_path::create_channel(env, owner.principal, community_id, true, random_string());
        for user in [&sender, &other] {
            client::community::happy_path::join_community(env, user.principal, community_id);
            client::community::happy_path::join_channel(env, user.principal, community_id, channel_id);
        }
        let result = client::community::happy_path::send_text_message(
            env,
            &sender,
            community_id,
            channel_id,
            None,
            random_string(),
            Some(message_id),
        );
        let poll = client::community::happy_path::send_message(
            env,
            &sender,
            community_id,
            channel_id,
            None,
            poll,
            None,
            Some(poll_message_id),
        );
        (
            Chat::Channel(community_id, channel_id),
            result.event_index,
            poll.message_index,
        )
    } else {
        let group_id = client::user::happy_path::create_group(env, &owner, &random_string(), true, true);
        for user in [&sender, &other] {
            client::group::happy_path::join_group(env, user.principal, group_id);
        }
        let result =
            client::group::happy_path::send_text_message(env, &sender, group_id, None, random_string(), Some(message_id));
        let poll = client::group::happy_path::send_message(env, &sender, group_id, None, poll, None, Some(poll_message_id));
        (Chat::Group(group_id), result.event_index, poll.message_index)
    };

    let migrated = migrate(env, canister_ids, &operator, &sender, multi_user_canister);
    let new_user_id = migrated.user_id;
    tick_until(env, |env| is_member(env, &owner, chat, new_user_id));

    let reply_message_id = random_from_u128();
    let reply = MessageContentInitial::Text(TextContent { text: random_string() });
    let replies_to = Some(GroupReplyContext { event_index });
    match chat {
        Chat::Group(group_id) => {
            client::group::happy_path::add_reaction(env, &other, group_id, "👍", message_id);
            client::group::happy_path::send_message(env, &other, group_id, None, reply, replies_to, Some(reply_message_id));
            client::group::happy_path::register_poll_vote(env, &other, group_id, poll_message_index, 0);
        }
        Chat::Channel(community_id, channel_id) => {
            client::community::happy_path::add_reaction(env, &other, community_id, channel_id, "👍", message_id);
            client::community::happy_path::send_message(
                env,
                &other,
                community_id,
                channel_id,
                None,
                reply,
                replies_to,
                Some(reply_message_id),
            );
            client::community::happy_path::register_poll_vote(env, &other, community_id, channel_id, poll_message_index, 0);
        }
        Chat::Direct(_) => unreachable!(),
    }

    // The quote reply's activity is on the reply, which quotes the message
    tick_until(env, |env| {
        let events = client::user::happy_path::message_activity_feed(env, &migrated, 0).events;
        let has =
            |id: MessageId, activity: MessageActivity| events.iter().any(|e| e.message_id == id && e.activity == activity);
        has(message_id, MessageActivity::Reaction)
            && has(reply_message_id, MessageActivity::QuoteReply)
            && has(poll_message_id, MessageActivity::PollVote)
    });
}

// A prize sent before its sender was migrated is refunded, whichever way it ends, to the wallet
// the sender now holds their funds in, their principal's account, rather than to their old
// canister's account
#[test_case(1; "prize_expires")]
#[test_case(2; "message_deleted")]
#[test_case(3; "message_disappears")]
fn unclaimed_prize_sent_before_its_sender_was_migrated_is_refunded_to_their_new_wallet(case: u32) {
    use constants::{ICP_SYMBOL, ICP_TRANSFER_FEE, PRIZE_FEE_PERCENT};
    use types::{CryptoTransaction, MultiUserChat, PendingCryptoTransaction, PrizeContentInitial, icrc1};

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
    // A Diamond member, so that they can create a public group for the claimant to join
    let sender = client::register_diamond_user(env, canister_ids, *controller);
    let claimant = client::register_user(env, canister_ids);
    let group_id = client::user::happy_path::create_group(env, &sender, &random_string(), true, true);
    if case == 3 {
        client::group::happy_path::update_group(
            env,
            sender.principal,
            group_id,
            &group_canister::update_group_v2::Args {
                events_ttl: OptionUpdate::SetToSome(5 * MINUTE_IN_MS),
                ..Default::default()
            },
        );
    }
    client::group::happy_path::join_group(env, claimant.principal, group_id);

    let ledger = canister_ids.icp_ledger;
    client::ledger::happy_path::transfer(env, *controller, ledger, sender.user_id, 1_000_000_000);
    let prizes = vec![100000, 200000];
    let fee = ICP_TRANSFER_FEE;
    let total = prizes.iter().sum::<u128>();
    let amount = total + (fee * prizes.len() as u128) + (total * PRIZE_FEE_PERCENT as u128 / 100);
    let message_id = random_from_u128();
    let response = client::user::send_message_with_transfer_to_group(
        env,
        sender.principal,
        sender.canister(),
        &user_canister::send_message_with_transfer_to_group::Args {
            group_id,
            thread_root_message_index: None,
            message_id,
            content: MessageContentInitial::Prize(PrizeContentInitial {
                prizes_v2: prizes,
                transfer: CryptoTransaction::Pending(PendingCryptoTransaction::ICRC1(icrc1::PendingCryptoTransaction {
                    ledger,
                    token_symbol: ICP_SYMBOL.to_string(),
                    amount,
                    to: CanisterId::from(group_id).into(),
                    fee,
                    memo: None,
                    created: now_millis(env) * 1_000_000,
                })),
                end_date: now_millis(env) + HOUR_IN_MS,
                caption: None,
                diamond_only: false,
                lifetime_diamond_only: false,
                unique_person_only: false,
                streak_only: 0,
                requires_captcha: false,
                min_chit_earned: 0,
            }),
            sender_name: sender.username(),
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
    client::local_user_index::happy_path::claim_prize(
        env,
        claimant.principal,
        canister_ids.local_user_index(env, group_id),
        MultiUserChat::Group(group_id),
        message_id,
        None,
    );

    let migrated = migrate(env, canister_ids, &operator, &sender, multi_user_canister);
    tick_until(env, |env| is_member(env, &claimant, Chat::Group(group_id), migrated.user_id));
    let old_wallet_balance = client::ledger::happy_path::balance_of(env, ledger, sender.user_id);
    let new_wallet_balance = client::ledger::happy_path::balance_of(env, ledger, sender.principal);

    let ends_in = match case {
        1 => HOUR_IN_MS,
        2 => {
            client::group::happy_path::delete_messages(env, migrated.principal, group_id, None, vec![message_id]);
            5 * MINUTE_IN_MS
        }
        3 => 5 * MINUTE_IN_MS,
        _ => unreachable!(),
    };
    env.advance_time(Duration::from_millis(ends_in));

    // The unclaimed prize of 100000, its share of the fee and its transfer fee, less the refund's fee
    tick_until(env, |env| {
        client::ledger::happy_path::balance_of(env, ledger, sender.principal) == new_wallet_balance + 105000
    });
    assert_eq!(
        client::ledger::happy_path::balance_of(env, ledger, sender.user_id),
        old_wallet_balance
    );
}

// Whether the chat holds the user as a member, as seen by `viewer`
fn is_member(env: &PocketIc, viewer: &User, chat: Chat, user_id: UserId) -> bool {
    match chat {
        Chat::Group(group_id) => {
            let response = client::group::happy_path::selected_initial(env, viewer.principal, group_id);
            response.participants.iter().any(|m| m.user_id == user_id) || response.basic_members.contains(&user_id)
        }
        Chat::Channel(community_id, channel_id) => {
            let response = client::community::happy_path::selected_channel_initial(env, viewer, community_id, channel_id);
            response.members.iter().any(|m| m.user_id == user_id) || response.basic_members.contains(&user_id)
        }
        Chat::Direct(_) => unreachable!(),
    }
}

#[test]
fn migrated_user_deletes_the_files_of_a_message_they_sent_before_being_migrated() {
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

    // A direct message's file names the canisters holding its users as accessors, which for users in
    // canisters of their own are their ids
    let file = client::storage_index::happy_path::upload_file(
        env,
        user1.principal,
        canister_ids.storage_index,
        100,
        vec![user1.user_id.as_principal(), user2.user_id.as_principal()],
    );
    let accessors_replaced = |env: &PocketIc| metrics(env, file.canister_id)["accessors_replaced"].as_u64().unwrap();
    let accessors_replaced_before = accessors_replaced(env);
    let message_id = random_from_u128();
    client::user::happy_path::send_message(
        env,
        &user1,
        user2.user_id,
        None,
        MessageContentInitial::File(FileContent {
            name: random_string(),
            caption: None,
            mime_type: "application/pdf".to_string(),
            file_size: 100,
            blob_reference: Some(file.clone()),
        }),
        None,
        Some(message_id),
    );

    migrate_users(
        env,
        operator.principal,
        canister_ids.user_index,
        vec![user1.user_id],
        Some(multi_user_canister),
    );
    let new_user_id = wait_for_import(env, operator.principal, canister_ids.user_index, user1.user_id);

    // The bucket holding the file is told of the migration by way of the StorageIndex, and replaces the
    // user's old id with their new one among the file's accessors
    tick_until(env, |env| accessors_replaced(env) > accessors_replaced_before);

    // Only the sender's copy of a deleted message deletes its files, which here is in the MultiUser
    // canister
    let response = client::user::delete_messages(
        env,
        user1.principal,
        new_user_id.canister_id(),
        &user_canister::delete_messages::Args {
            user_id: user2.user_id,
            thread_root_message_index: None,
            message_ids: vec![message_id],
        },
    );
    assert!(matches!(response, types::UnitResult::Success), "{response:?}");

    // Once the message can no longer be undeleted, its content is removed and its file deleted
    env.advance_time(Duration::from_secs(5 * 60));
    tick_until(env, |env| {
        !client::storage_bucket::happy_path::file_exists(env, user1.principal, file.canister_id, file.blob_id)
    });
}

#[derive(Clone, Copy)]
enum TippedIn {
    DirectChat,
    Group,
    Channel,
}

// A migrated user's messages from before their migration keep the id they were sent under, while
// clients know the user only by their new id, so a tip on one is to their new id. It is paid into
// the wallet they now hold their funds in, recorded on the message, and reaches them in their new
// canister.
#[test_case(TippedIn::DirectChat, false; "direct_chat_tipped_from_a_user_canister")]
#[test_case(TippedIn::DirectChat, true; "direct_chat_tipped_from_a_multi_user_canister")]
#[test_case(TippedIn::Group, false; "group_tipped_from_a_user_canister")]
#[test_case(TippedIn::Group, true; "group_tipped_from_a_multi_user_canister")]
#[test_case(TippedIn::Channel, false; "channel_tipped_from_a_user_canister")]
#[test_case(TippedIn::Channel, true; "channel_tipped_from_a_multi_user_canister")]
fn message_sent_before_its_sender_was_migrated_can_be_tipped(tipped_in: TippedIn, tipper_in_multi_user_canister: bool) {
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
    // A Diamond member, so that they can create a public group or community for the others to join
    let owner = client::register_diamond_user(env, canister_ids, *controller);
    let sender = client::register_user(env, canister_ids);
    let tipper = if tipper_in_multi_user_canister {
        // In a MultiUser canister other than the one the sender is migrated into, so that it hears of
        // the migration from the LocalUserIndex, and a tip in a direct chat reaches the sender's new
        // canister from another canister
        let tippers_canister =
            client::user_index::happy_path::create_multi_user_canister(env, *controller, canister_ids, local_user_index);
        client::register_user_in_multi_user_canister_on(env, canister_ids, local_user_index, tippers_canister, None)
    } else {
        client::register_user(env, canister_ids)
    };
    let ledger = canister_ids.icp_ledger;
    let tip = 1_0000_0000;

    let has_direct_chat_with = |env: &PocketIc, them: UserId| {
        client::user::happy_path::initial_state(env, &tipper)
            .direct_chats
            .summaries
            .iter()
            .any(|c| c.them == them)
    };
    let message_id = random_from_u128();
    let chat = match tipped_in {
        TippedIn::DirectChat => {
            client::user::happy_path::send_text_message(env, &sender, tipper.user_id, random_string(), Some(message_id));
            tick_until(env, |env| has_direct_chat_with(env, sender.user_id));
            Chat::Direct(sender.user_id.into())
        }
        TippedIn::Group => {
            let group_id = client::user::happy_path::create_group(env, &owner, &random_string(), true, true);
            for user in [&sender, &tipper] {
                client::group::happy_path::join_group(env, user.principal, group_id);
            }
            client::group::happy_path::send_text_message(env, &sender, group_id, None, random_string(), Some(message_id));
            Chat::Group(group_id)
        }
        TippedIn::Channel => {
            let community_id =
                client::user::happy_path::create_community(env, &owner, &random_string(), true, vec![random_string()]);
            let channel_id =
                client::community::happy_path::create_channel(env, owner.principal, community_id, true, random_string());
            for user in [&sender, &tipper] {
                client::community::happy_path::join_community(env, user.principal, community_id);
                client::community::happy_path::join_channel(env, user.principal, community_id, channel_id);
            }
            client::community::happy_path::send_text_message(
                env,
                &sender,
                community_id,
                channel_id,
                None,
                random_string(),
                Some(message_id),
            );
            Chat::Channel(community_id, channel_id)
        }
    };

    let migrated = migrate(env, canister_ids, &operator, &sender, multi_user_canister);
    let new_user_id = migrated.user_id;
    assert_ne!(migrated.canister(), tipper.canister());

    // Wait until the chat holds the sender under their new id, as the tipper's client knows them
    let chat = match chat {
        Chat::Direct(_) => Chat::Direct(new_user_id.into()),
        chat => chat,
    };
    tick_until(env, |env| match chat {
        Chat::Direct(_) => has_direct_chat_with(env, new_user_id),
        Chat::Group(group_id) => {
            let response = client::group::happy_path::selected_initial(env, owner.principal, group_id);
            response.participants.iter().any(|m| m.user_id == new_user_id) || response.basic_members.contains(&new_user_id)
        }
        Chat::Channel(community_id, channel_id) => {
            let response = client::community::happy_path::selected_channel_initial(env, &owner, community_id, channel_id);
            response.members.iter().any(|m| m.user_id == new_user_id) || response.basic_members.contains(&new_user_id)
        }
    });

    // A User canister tips from its own account. A user in a MultiUser canister tips from their own
    // wallet, approving the canister which makes the transfer to pull the tip from it: their
    // MultiUser canister in a direct chat, and otherwise the group or community.
    if tipper_in_multi_user_canister {
        client::ledger::happy_path::transfer(env, *controller, ledger, tipper.principal, 10 * tip);
        let spender = match chat {
            Chat::Direct(_) => tipper.canister(),
            chat => chat.canister_id(),
        };
        client::ledger::happy_path::approve(
            env,
            tipper.principal,
            ledger,
            icrc_ledger_types::icrc1::account::Account {
                owner: spender,
                subaccount: Some(ledger_utils::spender_subaccount(tipper.principal)),
            },
            tip + ICP_TRANSFER_FEE,
        );
    } else {
        client::ledger::happy_path::transfer(env, *controller, ledger, tipper.user_id, 10 * tip);
    }
    let senders_balance = client::ledger::happy_path::balance_of(env, ledger, sender.principal);

    if tipper_in_multi_user_canister && !matches!(chat, Chat::Direct(_)) {
        // The client addresses the transfer to the account of the sender's new id, which the group or
        // community sends to their wallet instead
        let transfer = PendingCryptoTransaction::ICRC2(icrc2::PendingCryptoTransaction {
            ledger,
            token_symbol: ICP_SYMBOL.to_string(),
            amount: tip,
            from: tipper.principal.into(),
            to: icrc1::Account::legacy_for_user(new_user_id),
            fee: ICP_TRANSFER_FEE,
            memo: None,
            created: now_millis(env) * 1_000_000,
        });
        let response = match chat {
            Chat::Group(group_id) => client::group::tip_message(
                env,
                tipper.principal,
                group_id.into(),
                &group_canister::tip_message::Args {
                    thread_root_message_index: None,
                    message_id,
                    transfer,
                    decimals: 8,
                    username: tipper.username(),
                    display_name: None,
                    new_achievement: false,
                },
            ),
            Chat::Channel(community_id, channel_id) => client::community::tip_message(
                env,
                tipper.principal,
                community_id.into(),
                &community_canister::tip_message::Args {
                    channel_id,
                    thread_root_message_index: None,
                    message_id,
                    transfer,
                    decimals: 8,
                    username: tipper.username(),
                    display_name: None,
                    new_achievement: false,
                },
            ),
            Chat::Direct(_) => unreachable!(),
        };
        assert!(matches!(response, UnitResult::Success), "{response:?}");
    } else {
        let response = client::user::tip_message(
            env,
            tipper.principal,
            tipper.canister(),
            &user_canister::tip_message::Args {
                chat,
                recipient: new_user_id,
                thread_root_message_index: None,
                message_id,
                ledger,
                token_symbol: ICP_SYMBOL.to_string(),
                amount: tip,
                fee: ICP_TRANSFER_FEE,
                decimals: 8,
                from_account: None,
                pin: None,
            },
        );
        assert!(
            matches!(response, user_canister::tip_message::Response::Success),
            "{response:?}"
        );
    }

    // The tip is paid into the sender's wallet, the account of their principal
    assert_eq!(
        client::ledger::happy_path::balance_of(env, ledger, sender.principal),
        senders_balance + tip
    );

    // It is recorded on the message, in both copies of a direct chat
    let tips_on = |events: EventsResponse| {
        events
            .events
            .into_iter()
            .find_map(|e| match e.event {
                ChatEvent::Message(m) if m.message_id == message_id => Some(m.tips.iter().cloned().collect::<Vec<_>>()),
                _ => None,
            })
            .expect("Message not found")
    };
    let tipped = vec![(ledger, vec![(tipper.user_id, tip)])];
    match chat {
        Chat::Direct(_) => {
            let events = client::user::happy_path::events(env, &tipper, new_user_id, 0.into(), true, 10, 10);
            assert_eq!(tips_on(events), tipped);
            tick_until(env, |env| {
                tips_on(client::user::happy_path::events(
                    env,
                    &migrated,
                    tipper.user_id,
                    0.into(),
                    true,
                    10,
                    10,
                )) == tipped
            });
        }
        Chat::Group(group_id) => {
            let events = client::group::happy_path::events(env, &owner, group_id, 0.into(), true, 10, 10);
            assert_eq!(tips_on(events), tipped);
        }
        Chat::Channel(community_id, channel_id) => {
            let events = client::community::happy_path::events(env, &owner, community_id, channel_id, 0.into(), true, 10, 10);
            assert_eq!(tips_on(events), tipped);
        }
    }

    // And the sender hears of it in their new canister
    tick_until(env, |env| {
        client::user::happy_path::message_activity_feed(env, &migrated, 0)
            .events
            .iter()
            .any(|e| e.message_id == message_id && matches!(e.activity, MessageActivity::Tip))
    });
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
pub(crate) fn platform_operator(env: &mut PocketIc, canister_ids: &CanisterIds, controller: Principal) -> User {
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

// The UserIndex tells each LocalUserIndex of a migration once the user has been imported, which can
// take some rounds to arrive. The LocalUserIndex moves the user's subscriptions onto their new id when
// told.
fn wait_until_local_user_index_knows_of_migration(
    env: &mut PocketIc,
    local_user_index: CanisterId,
    user: &User,
    new_user_id: UserId,
) {
    tick_until(env, |env| {
        client::local_user_index::happy_path::latest_user_id(env, user.principal, local_user_index, user.user_id) == new_user_id
    });
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

// Sets a reminder about a message in the user's chat with the other user, returning its id
fn set_message_reminder(env: &mut PocketIc, user: &User, other_user: &User, remind_in: u64) -> u64 {
    let response = client::user::set_message_reminder_v2(
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
    match response {
        user_canister::set_message_reminder_v2::Response::Success(reminder_id) => reminder_id,
        response => panic!("'set_message_reminder_v2' error: {response:?}"),
    }
}

// The ids of the reminders the OpenChat bot has sent the user, as held by the given canister
fn reminders_sent(env: &PocketIc, principal: Principal, canister_id: CanisterId, user_id: UserId) -> Vec<u64> {
    let response = client::user::events(
        env,
        principal,
        canister_id,
        &user_canister::events::Args {
            user_id,
            them: OPENCHAT_BOT_USER_ID,
            thread_root_message_index: None,
            start_index: EventIndex::default(),
            ascending: true,
            max_messages: 1000,
            max_events: 1000,
            latest_known_update: None,
        },
    );
    let user_canister::events::Response::Success(result) = response else {
        panic!("'events' error: {response:?}");
    };
    result
        .events
        .into_iter()
        .filter_map(|event| match event.event {
            ChatEvent::Message(message) => match message.content {
                MessageContent::MessageReminder(reminder) => Some(reminder.reminder_id),
                _ => None,
            },
            _ => None,
        })
        .collect()
}

// Leaves an event for user2 queued in user1's canister, by stopping user2's canister before user1
// reacts to a message in their chat. The event is retried until user2's canister is started again,
// and until it has been delivered, user1's canister isn't ready to be migrated.
fn queue_event_for_stopped_user(env: &mut PocketIc, user1: &User, user2: &User) {
    let message_id = random_from_u128();
    client::user::happy_path::send_text_message(env, user1, user2.user_id, random_string(), Some(message_id));
    tick_many(env, 10);
    client::stop_canister(env, user2.local_user_index, user2.canister());
    client::user::happy_path::add_reaction(env, user1, user2.user_id, "1", message_id);
}
