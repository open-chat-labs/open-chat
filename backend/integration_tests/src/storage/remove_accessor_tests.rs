use crate::env::ENV;
use crate::utils::{tick_many, wait_for_deleted_canister_to_be_uninstalled};
use crate::{CanisterIds, TestEnv, client};
use candid::Principal;
use pocket_ic::PocketIc;
use std::ops::Deref;
use storage_index_canister::add_or_update_users::UserConfig;
use testing::rng::{random_principal, random_string};
use types::{BlobReference, SuccessOnly};

#[test]
fn removing_an_accessor_removes_its_files_and_frees_their_allowance() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let user_id = add_uploader(env, canister_ids);
    let accessor = random_principal();

    let file = client::storage_index::happy_path::upload_file(env, user_id, canister_ids.storage_index, 500, vec![accessor]);

    tick_many(env, 10);

    let bytes_used = client::storage_index::happy_path::user(env, user_id, canister_ids.storage_index).bytes_used;
    assert_eq!(bytes_used, 500);

    let response = client::storage_index::remove_accessors(
        env,
        canister_ids.user_index,
        canister_ids.storage_index,
        &storage_index_canister::remove_accessors::Args {
            accessor_ids: vec![accessor],
        },
    );
    assert!(matches!(response, SuccessOnly::Success));

    wait_for_file_to_be_removed(env, user_id, &file);
    wait_for_bytes_used(env, user_id, canister_ids.storage_index, 0);
}

#[test]
fn deleting_a_group_removes_the_files_sent_in_it() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let user = client::register_diamond_user(env, canister_ids, *controller);
    let group_id = client::user::happy_path::create_group(env, &user, &random_string(), true, true);
    let uploader = add_uploader(env, canister_ids);

    let group_file =
        client::storage_index::happy_path::upload_file(env, uploader, canister_ids.storage_index, 100, vec![group_id.into()]);
    let other_file = client::storage_index::happy_path::upload_file(
        env,
        uploader,
        canister_ids.storage_index,
        200,
        vec![random_principal()],
    );
    wait_for_bytes_used(env, uploader, canister_ids.storage_index, 300);

    let response = client::user::delete_group(
        env,
        user.principal,
        user.canister(),
        &user_canister::delete_group::Args { chat_id: group_id },
    );
    assert!(
        matches!(response, user_canister::delete_group::Response::Success),
        "{response:?}"
    );

    wait_for_file_to_be_removed(env, uploader, &group_file);
    wait_for_bytes_used(env, uploader, canister_ids.storage_index, 200);
    assert!(client::storage_bucket::happy_path::file_exists(
        env,
        uploader,
        other_file.canister_id,
        other_file.blob_id
    ));
}

#[test]
fn deleting_a_community_removes_the_files_sent_in_it_and_in_the_groups_imported_into_it() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let user = client::register_diamond_user(env, canister_ids, *controller);
    let community_id = client::user::happy_path::create_community(env, &user, &random_string(), true, vec![random_string()]);
    let group_id = client::user::happy_path::create_group(env, &user, &random_string(), true, true);
    let uploader = add_uploader(env, canister_ids);

    let community_file = client::storage_index::happy_path::upload_file(
        env,
        uploader,
        canister_ids.storage_index,
        100,
        vec![community_id.into()],
    );
    let group_file =
        client::storage_index::happy_path::upload_file(env, uploader, canister_ids.storage_index, 200, vec![group_id.into()]);

    client::community::happy_path::import_group(env, user.principal, community_id, group_id);
    wait_for_deleted_canister_to_be_uninstalled(env, group_id.into());

    // The group lives on as one of the community's channels, so the files sent in it are kept
    tick_many(env, 20);
    assert!(client::storage_bucket::happy_path::file_exists(
        env,
        uploader,
        group_file.canister_id,
        group_file.blob_id
    ));

    let response = client::user::delete_community(
        env,
        user.principal,
        user.canister(),
        &user_canister::delete_community::Args { community_id },
    );
    assert!(
        matches!(response, user_canister::delete_community::Response::Success),
        "{response:?}"
    );

    wait_for_file_to_be_removed(env, uploader, &community_file);
    wait_for_file_to_be_removed(env, uploader, &group_file);
    wait_for_bytes_used(env, uploader, canister_ids.storage_index, 0);
}

fn add_uploader(env: &mut PocketIc, canister_ids: &CanisterIds) -> Principal {
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

fn wait_for_file_to_be_removed(env: &mut PocketIc, owner: Principal, file: &BlobReference) {
    for _ in 0..50 {
        if !client::storage_bucket::happy_path::file_exists(env, owner, file.canister_id, file.blob_id) {
            return;
        }
        env.tick();
    }
    panic!("File {} was not removed", file.blob_id);
}

fn wait_for_bytes_used(env: &mut PocketIc, user_id: Principal, storage_index: Principal, expected: u64) {
    let mut bytes_used = 0;
    for _ in 0..50 {
        bytes_used = client::storage_index::happy_path::user(env, user_id, storage_index).bytes_used;
        if bytes_used == expected {
            return;
        }
        env.tick();
    }
    panic!("Bytes used was {bytes_used}, expected {expected}");
}
