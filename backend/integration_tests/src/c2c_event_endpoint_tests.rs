//! Every canister takes another canister's events at an endpoint named `c2c_<caller>`. These check
//! the endpoints added under that name ahead of their callers switching over to them, each by
//! sending one event as the caller and reading its effect back. The LocalUserIndex relays some of
//! its groups' and communities' events on to the GroupIndex and UserIndex, so those are sent as
//! the group or community and their effect read from the index. The DailyPuzzle canister refuses
//! every `c2c_` call made by ingress, so its endpoint is covered once its caller switches over.
use crate::env::ENV;
use crate::utils::{now_millis, tick_until};
use crate::{CanisterIds, TestEnv, User, client};
use candid::Principal;
use constants::{HOUR_IN_MS, OPENCHAT_BOT_USER_ID};
use pocket_ic::PocketIc;
use rand::random;
use std::ops::Deref;
use std::time::Duration;
use storage_index_canister::add_or_update_users::UserConfig;
use testing::rng::{random_from_principal, random_internet_identity_principal, random_principal, random_string};
use types::{
    ChannelLatestMessageIndex, ChatEvent, ChatId, Empty, EventIndex, IdempotentEnvelope, MessageContent, SuccessOnly,
    TimestampMillis, UserId,
};

#[test]
fn local_user_index_takes_user_index_events() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let local_user_index = canister_ids.subnets[0].local_user_index;
    let old_user_id: UserId = random_from_principal();
    let new_user_id: UserId = random_from_principal();

    let response = client::local_user_index::c2c_user_index(
        env,
        canister_ids.user_index,
        local_user_index,
        &local_user_index_canister::c2c_user_index::Args {
            events: vec![envelope(
                env,
                local_user_index_canister::UserIndexEvent::UserIdMigrated(local_user_index_canister::UserIdMigrated {
                    old_user_id,
                    new_user_id,
                }),
            )],
        },
    );
    assert!(matches!(response, SuccessOnly::Success));

    let local_user_index_canister::migrated_user_ids::Response::Success(migrated) = client::local_user_index::migrated_user_ids(
        env,
        Principal::anonymous(),
        local_user_index,
        &local_user_index_canister::migrated_user_ids::Args {
            user_ids: vec![old_user_id],
        },
    );
    assert_eq!(migrated.get(&old_user_id), Some(&new_user_id));
}

#[test]
fn group_index_takes_local_index_events() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let user = client::register_diamond_user(env, canister_ids, *controller);
    let name = random_string();
    let community_id = client::user::happy_path::create_community(env, &user, &name, true, vec![random_string()]);
    assert!(
        !client::group_index::happy_path::explore_communities(env, user.principal, canister_ids.group_index, &name).is_empty()
    );

    // Reported uninstalled by the LocalUserIndex holding it, the community is removed from the index
    let local_user_index = canister_ids.local_user_index(env, types::CanisterId::from(community_id));
    let response = client::group_index::c2c_local_index(
        env,
        local_user_index,
        canister_ids.group_index,
        &group_index_canister::c2c_local_index::Args {
            events: vec![envelope(
                env,
                group_index_canister::LocalIndexEvent::CommunityUninstalled(community_id),
            )],
        },
    );
    assert!(matches!(response, SuccessOnly::Success));
    assert!(
        client::group_index::happy_path::explore_communities(env, user.principal, canister_ids.group_index, &name).is_empty()
    );
}

#[test]
fn local_user_index_relays_group_activity_to_the_group_index() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let user = client::register_diamond_user(env, canister_ids, *controller);
    let group_id = client::user::happy_path::create_group(env, &user, &random_string(), false, true);

    // A new group counts as active for a while, so wait for that to lapse
    env.advance_time(Duration::from_millis(HOUR_IN_MS));
    env.tick();
    let now = now_millis(env);
    assert!(
        !active_groups(env, canister_ids, group_id, now)
            .active_groups
            .contains(&group_id)
    );

    // Sent by the group, which its LocalUserIndex relays to the GroupIndex naming the group
    let local_user_index = canister_ids.local_user_index(env, group_id);
    let response = client::local_user_index::c2c_group(
        env,
        group_id.into(),
        local_user_index,
        &local_user_index_canister::c2c_group::Args {
            events: vec![envelope(
                env,
                local_user_index_canister::GroupOrCommunityEvent::GroupActive(local_user_index_canister::GroupActive {
                    duration: HOUR_IN_MS,
                    public_group_activity: None,
                }),
            )],
        },
    );
    assert!(matches!(response, SuccessOnly::Success));

    tick_until(env, |env| {
        active_groups(env, canister_ids, group_id, now)
            .active_groups
            .contains(&group_id)
    });
}

#[test]
fn local_user_index_relays_a_completed_group_import_to_the_group_index() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let user = client::register_diamond_user(env, canister_ids, *controller);
    let community_name = random_string();
    let community_id = client::user::happy_path::create_community(env, &user, &community_name, false, vec![random_string()]);
    let group_name = random_string();
    let group_id = client::user::happy_path::create_group(env, &user, &group_name, false, true);

    // Sent by the community once the group lives on as one of its channels, on which the
    // GroupIndex deletes the group
    let local_user_index = canister_ids.local_user_index(env, community_id);
    let response = client::local_user_index::c2c_community(
        env,
        community_id.into(),
        local_user_index,
        &local_user_index_canister::c2c_community::Args {
            events: vec![envelope(
                env,
                local_user_index_canister::GroupOrCommunityEvent::GroupImportComplete(Box::new(
                    local_user_index_canister::GroupImportComplete {
                        community_name,
                        channel: ChannelLatestMessageIndex {
                            channel_id: 1u32.into(),
                            latest_message_index: None,
                        },
                        group_id,
                        group_name,
                        members: vec![user.user_id],
                        other_public_channels: Vec::new(),
                        mark_active_duration: HOUR_IN_MS,
                        public_community_activity: None,
                    },
                )),
            )],
        },
    );
    assert!(matches!(response, SuccessOnly::Success));

    tick_until(env, |env| {
        active_groups(env, canister_ids, group_id, now_millis(env))
            .deleted_groups
            .iter()
            .any(|g| g.id == group_id)
    });
}

#[test]
fn user_index_takes_translations_events() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let user = client::register_user(env, canister_ids);
    let text = random_string();

    let response = client::user_index::c2c_translations(
        env,
        canister_ids.translations,
        canister_ids.user_index,
        &user_index_canister::c2c_translations::Args {
            events: vec![envelope(
                env,
                user_index_canister::TranslationsEvent::SendOpenChatBotMessage(user_index_canister::OpenChatBotMessage {
                    recipient: user.user_id,
                    text: text.clone(),
                }),
            )],
        },
    );
    assert!(matches!(response, SuccessOnly::Success));

    // The message reaches the user from the OpenChat bot via their LocalUserIndex
    tick_until(env, |env| has_openchat_bot_message(env, &user, &text));
}

#[test]
fn identity_takes_user_index_events() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let (auth_principal, public_key) = random_internet_identity_principal();
    let session_key = random::<[u8; 32]>().to_vec();
    let created = client::identity::happy_path::create_identity(
        env,
        auth_principal,
        canister_ids.identity,
        public_key,
        session_key,
        true,
    );
    let oc_principal = Principal::self_authenticating(created.user_key);
    let user_id: UserId = random_from_principal();

    let response = client::identity::c2c_user_index(
        env,
        canister_ids.user_index,
        canister_ids.identity,
        &identity_canister::c2c_user_index::Args {
            events: vec![envelope(
                env,
                identity_canister::UserIndexEvent::SetUserIdentity(identity_canister::UserIdentity {
                    principal: oc_principal,
                    user_id: Some(user_id),
                    email: None,
                }),
            )],
        },
    );
    assert!(matches!(response, SuccessOnly::Success));

    let response = client::identity::check_auth_principal_v2(env, auth_principal, canister_ids.identity, &Empty {});
    let identity_canister::check_auth_principal_v2::Response::Success(result) = response else {
        panic!("Auth principal not found");
    };
    assert_eq!(result.user_id, Some(user_id));
}

#[test]
fn storage_index_takes_user_index_events() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let user_id = random_principal();

    let response = client::storage_index::c2c_user_index(
        env,
        canister_ids.user_index,
        canister_ids.storage_index,
        &storage_index_canister::c2c_user_index::Args {
            events: vec![envelope(
                env,
                storage_index_canister::UserIndexEvent::AddOrUpdateUser(UserConfig {
                    user_id,
                    byte_limit: 12345,
                }),
            )],
        },
    );
    assert!(matches!(response, SuccessOnly::Success));
    assert_eq!(
        client::storage_index::happy_path::user(env, user_id, canister_ids.storage_index).byte_limit,
        12345
    );

    let response = client::storage_index::c2c_user_index(
        env,
        canister_ids.user_index,
        canister_ids.storage_index,
        &storage_index_canister::c2c_user_index::Args {
            events: vec![envelope(env, storage_index_canister::UserIndexEvent::RemoveUser(user_id))],
        },
    );
    assert!(matches!(response, SuccessOnly::Success));
    let response = client::storage_index::user(
        env,
        user_id,
        canister_ids.storage_index,
        &storage_index_canister::user::Args {},
    );
    assert!(
        matches!(response, storage_index_canister::user::Response::UserNotFound),
        "{response:?}"
    );
}

#[test]
fn storage_index_takes_group_index_events() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let user_id = add_uploader(env, canister_ids);
    let accessor = random_principal();
    let file = client::storage_index::happy_path::upload_file(env, user_id, canister_ids.storage_index, 500, vec![accessor]);
    assert!(client::storage_bucket::happy_path::file_exists(
        env,
        user_id,
        file.canister_id,
        file.blob_id
    ));

    let response = client::storage_index::c2c_group_index(
        env,
        canister_ids.group_index,
        canister_ids.storage_index,
        &storage_index_canister::c2c_group_index::Args {
            events: vec![envelope(
                env,
                storage_index_canister::GroupIndexEvent::RemoveAccessor(accessor),
            )],
        },
    );
    assert!(matches!(response, SuccessOnly::Success));

    tick_until(env, |env| {
        !client::storage_bucket::happy_path::file_exists(env, user_id, file.canister_id, file.blob_id)
    });
}

#[test]
fn storage_bucket_takes_storage_index_events() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let user_id = add_uploader(env, canister_ids);
    let file = client::storage_index::happy_path::upload_file(env, user_id, canister_ids.storage_index, 500, Vec::new());
    tick_until(env, |env| {
        client::storage_index::happy_path::user(env, user_id, canister_ids.storage_index).bytes_used == 500
    });

    let response = client::storage_bucket::c2c_storage_index(
        env,
        canister_ids.storage_index,
        file.canister_id,
        &storage_bucket_canister::c2c_storage_index::Args {
            events: vec![envelope(
                env,
                storage_bucket_canister::StorageIndexEvent::FileToRemove(file.blob_id),
            )],
        },
    );
    assert!(matches!(response, SuccessOnly::Success));
    assert!(!client::storage_bucket::happy_path::file_exists(
        env,
        user_id,
        file.canister_id,
        file.blob_id
    ));

    // The bucket tells the index of the removal through its own events rather than in the response
    tick_until(env, |env| {
        client::storage_index::happy_path::user(env, user_id, canister_ids.storage_index).bytes_used == 0
    });
}

fn active_groups(
    env: &PocketIc,
    canister_ids: &CanisterIds,
    group_id: ChatId,
    active_since: TimestampMillis,
) -> group_index_canister::active_groups::SuccessResult {
    let group_index_canister::active_groups::Response::Success(result) = client::group_index::active_groups(
        env,
        Principal::anonymous(),
        canister_ids.group_index,
        &group_index_canister::active_groups::Args {
            group_ids: vec![group_id],
            community_ids: Vec::new(),
            active_since: Some(active_since),
        },
    );
    result
}

fn has_openchat_bot_message(env: &PocketIc, user: &User, text: &str) -> bool {
    let response = client::user::events(
        env,
        user.principal,
        user.canister(),
        &multi_user_canister::events::Args {
            user_id: user.user_id,
            them: OPENCHAT_BOT_USER_ID,
            thread_root_message_index: None,
            start_index: EventIndex::default(),
            ascending: true,
            max_messages: 1000,
            max_events: 1000,
            latest_known_update: None,
        },
    );
    let multi_user_canister::events::Response::Success(result) = response else {
        return false;
    };
    result.events.iter().any(|e| {
        matches!(&e.event, ChatEvent::Message(m)
            if matches!(&m.content, MessageContent::Text(content) if content.text == text))
    })
}

// Stamped with the current time, since a receiver drops an event older than the latest it has had
// from the same sender
fn envelope<T>(env: &pocket_ic::PocketIc, value: T) -> IdempotentEnvelope<T> {
    IdempotentEnvelope {
        created_at: now_millis(env),
        idempotency_id: random(),
        value,
    }
}

fn add_uploader(env: &mut pocket_ic::PocketIc, canister_ids: &crate::CanisterIds) -> Principal {
    let user_id = random_principal();
    client::storage_index::happy_path::add_or_update_users(
        env,
        canister_ids.user_index,
        canister_ids.storage_index,
        vec![UserConfig {
            user_id,
            byte_limit: 1000,
        }],
    );
    user_id
}
