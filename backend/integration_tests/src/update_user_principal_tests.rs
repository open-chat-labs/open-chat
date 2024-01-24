use crate::env::ENV;
use crate::rng::{random_string, random_user_principal};
use crate::utils::tick_many;
use crate::{client, CanisterIds, TestEnv, User};
use candid::Principal;
use pocket_ic::PocketIc;
use std::ops::Deref;
use types::{ChatId, CommunityId};

#[test]
fn principal_update_propagates_to_all_relevant_canisters() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let TestData {
        mut user,
        group_id,
        community_id,
    } = init_test_data(env, canister_ids, *controller);

    let file_bytes = random_string().into_bytes();
    let allocated_bucket_response =
        client::storage_index::happy_path::allocated_bucket(env, user.principal, canister_ids.storage_index, &file_bytes);

    client::storage_bucket::happy_path::upload_file(
        env,
        user.principal,
        allocated_bucket_response.canister_id,
        allocated_bucket_response.file_id,
        file_bytes,
        None,
    );

    let (new_principal, _) = random_user_principal();

    client::identity::update_user_principal(
        env,
        *controller,
        canister_ids.identity,
        &identity_canister::update_user_principal::Args {
            old_principal: user.principal,
            new_principal,
        },
    );

    user.principal = new_principal;

    tick_many(env, 5);

    client::user_index::happy_path::current_user(env, user.principal, canister_ids.user_index);
    client::user::happy_path::initial_state(env, &user);
    client::group::happy_path::summary(env, &user, group_id);
    client::community::happy_path::summary(env, &user, community_id);
    client::notifications_index::happy_path::subscription_exists(
        env,
        new_principal,
        canister_ids.notifications_index,
        "p256dh",
    );
    client::storage_index::happy_path::user(env, new_principal, canister_ids.storage_index);
    assert!(
        client::storage_bucket::happy_path::file_info(
            env,
            new_principal,
            allocated_bucket_response.canister_id,
            allocated_bucket_response.file_id
        )
        .is_owner
    );
}

fn init_test_data(env: &mut PocketIc, canister_ids: &CanisterIds, controller: Principal) -> TestData {
    let user = client::register_diamond_user(env, canister_ids, controller);

    let group_id = client::user::happy_path::create_group(env, &user, &random_string(), false, true);
    let community_id = client::user::happy_path::create_community(env, &user, &random_string(), false, vec![random_string()]);

    client::notifications_index::happy_path::push_subscription(
        env,
        user.principal,
        canister_ids.notifications_index,
        "auth",
        "p256dh",
        "endpoint",
    );

    env.tick();

    TestData {
        user,
        group_id,
        community_id,
    }
}

struct TestData {
    user: User,
    group_id: ChatId,
    community_id: CommunityId,
}
