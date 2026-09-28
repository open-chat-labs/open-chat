use crate::env::ENV;
use crate::utils::{metrics, now_millis, tick_many};
use crate::{CanisterIds, TestEnv, User, client, wasms};
use candid::Principal;
use constants::DAY_IN_MS;
use oc_error_codes::OCErrorCode;
use pocket_ic::PocketIc;
use std::collections::BTreeMap;
use std::ops::Deref;
use std::time::Duration;
use testing::rng::{random_from_u128, random_string};
use types::{BuildVersion, CanisterId, CanisterWasm, Chat, Document, Empty, MessageContent, OptionUpdate, UserId};
use user_index_canister::user_migration::UserMigrationStatus;

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
    tick_many(env, 10);

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
    tick_many(env, 30);

    let new_user_id = match user_migration_status(env, operator.principal, canister_ids.user_index, user1.user_id) {
        Some(UserMigrationStatus::Imported { new_user_id, .. }) => new_user_id,
        status => panic!("User not imported: {status:?}"),
    };
    assert_eq!(new_user_id.canister_id(), multi_user_canister);
    assert_eq!(metrics(env, multi_user_canister)["user_imports_in_progress"], 0);

    // The user is switched over to their new id, which they are found by from then on
    let current_user = client::user_index::happy_path::current_user(env, user1.principal, canister_ids.user_index);
    assert_eq!(current_user.user_id, new_user_id);
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

    // The user's old canister stays frozen
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
    tick_many(env, 10);

    assert_eq!(wasm_version(env, user.canister()), version);
    let started = started_migration(env, operator.principal, canister_ids.user_index, user.user_id);
    assert_eq!(started.wasm_version, version);

    // Releasing a new User wasm would break later tests which draw this env
    wrapper.discard();
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

pub(crate) struct StartedMigration {
    pub user_bytes: u64,
    pub wasm_version: BuildVersion,
}

pub(crate) fn user_migration_status(
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
pub(crate) fn wait_for_migration_attempts_to_run_out(env: &mut PocketIc) {
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

pub(crate) fn migrate_users(
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
