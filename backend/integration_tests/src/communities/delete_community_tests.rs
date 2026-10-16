use crate::client::{start_canister, stop_canister};
use crate::communities::join_community_tests::wait_for_community_membership;
use crate::env::ENV;
use crate::utils::{tick_many, tick_until, wait_for_deleted_canister_to_be_uninstalled};
use crate::{CanisterIds, TestEnv, User, client};
use candid::Principal;
use pocket_ic::PocketIc;
use std::ops::Deref;
use std::time::Duration;
use test_case::test_case;
use testing::rng::random_string;
use types::{CanisterId, CommunityId};

#[test]
fn delete_community_succeeds() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        platform_operator,
    } = wrapper.env();

    let TestData { user1, community_id, .. } = init_test_data(env, canister_ids, *controller, *platform_operator);

    let delete_community_response = client::user::delete_community(
        env,
        user1.principal,
        user1.canister(),
        &multi_user_canister::delete_community::Args { community_id },
    );

    assert!(
        matches!(
            delete_community_response,
            multi_user_canister::delete_community::Response::Success
        ),
        "{delete_community_response:?}",
    );

    wait_for_deleted_canister_to_be_uninstalled(env, community_id.into());
}

// Members whose canisters are stopped when the community is deleted are told once they are running
// again
#[test]
fn user_canister_notified_of_community_deleted() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        platform_operator,
    } = wrapper.env();

    let TestData {
        user1,
        user2,
        user3,
        community_id,
    } = init_test_data(env, canister_ids, *controller, *platform_operator);

    stop_canister(env, user2.local_user_index, user2.canister());
    stop_canister(env, user3.local_user_index, user3.canister());

    let delete_community_response = client::user::delete_community(
        env,
        user1.principal,
        user1.canister(),
        &multi_user_canister::delete_community::Args { community_id },
    );

    assert!(
        matches!(
            delete_community_response,
            multi_user_canister::delete_community::Response::Success
        ),
        "{delete_community_response:?}",
    );

    env.tick();

    // The deleter's canister removed the community itself
    assert!(!holds_community(env, &user1, community_id));

    // The events for the stopped canisters are rejected and retried after a delay, so each member
    // is told once their canister is running again
    start_canister(env, user2.local_user_index, user2.canister());
    wait_for_community_deleted_notification(env, &user2, community_id);

    start_canister(env, user3.local_user_index, user3.canister());
    wait_for_community_deleted_notification(env, &user3, community_id);
}

#[test_case(true; "public")]
fn uninstalled_community_is_removed(is_public: bool) {
    use local_user_index_canister::group_and_community_summary_updates_v2 as summary_updates;

    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let owner = client::register_diamond_user(env, canister_ids, *controller);
    let name = random_string();
    let community_id = client::user::happy_path::create_community(env, &owner, &name, is_public, vec![random_string()]);
    let live_community_id =
        client::user::happy_path::create_community(env, &owner, &random_string(), is_public, vec![random_string()]);
    let local_user_index = canister_ids.local_user_index(env, community_id);
    let group_index = canister_ids.group_index;

    if is_public {
        assert!(is_listed(env, &owner, group_index, &name, community_id));
    }

    // This is the state the IC leaves a canister in once it has run out of cycles
    env.uninstall_canister(community_id.into(), Some(local_user_index)).unwrap();

    // The LocalUserIndex checks the status of each of its canisters weekly, a canister at a time.
    // A check already under way (this environment is shared with other tests) won't include the
    // community, in which case it is picked up by the following one.
    let mut deleted = false;
    'outer: for _ in 0..3 {
        env.advance_time(Duration::from_secs(8 * 24 * 60 * 60));
        for _ in 0..3000 {
            env.tick();
            if is_deleted(env, group_index, community_id) {
                deleted = true;
                break 'outer;
            }
        }
    }
    assert!(deleted, "The GroupIndex was not told that the community had been uninstalled");
    if is_public {
        assert!(!is_listed(env, &owner, group_index, &name, community_id));
    }

    // The LocalUserIndex stops tracking the community once the GroupIndex has answered. Reporting
    // it as not found is what has its members' apps drop it.
    tick_many(env, 5);
    let summary_updates::Response::Success(result) = client::local_user_index::group_and_community_summary_updates_v2(
        env,
        owner.principal,
        local_user_index,
        &summary_updates::Args {
            requests: vec![summary_updates::SummaryUpdatesArgs {
                canister_id: community_id.into(),
                is_community: true,
                invite_code: None,
                updates_since: None,
            }],
            max_c2c_calls: 10,
        },
    );
    assert_eq!(result.not_found, vec![CanisterId::from(community_id)]);

    // The canister is kept, since it may hold tokens which deleting it would strand
    assert!(env.canister_exists(community_id.into()));

    // A community whose canister still has its code is left alone
    assert!(!is_deleted(env, group_index, live_community_id));
}

fn init_test_data(
    env: &mut PocketIc,
    canister_ids: &CanisterIds,
    controller: Principal,
    platform_operator: Principal,
) -> TestData {
    let user1 = client::register_diamond_user(env, canister_ids, controller);
    // Each in a canister of their own, so that stopping it doesn't stop anyone else's
    let user2 = client::register_user_in_new_multi_user_canister(env, canister_ids, platform_operator);
    let user3 = client::register_user_in_new_multi_user_canister(env, canister_ids, platform_operator);

    let community_name = random_string();

    let community_id = client::user::happy_path::create_community(env, &user1, &community_name, false, vec![random_string()]);
    client::local_user_index::happy_path::add_users_to_community(
        env,
        &user1,
        canister_ids.local_user_index(env, community_id),
        community_id,
        vec![(user2.user_id, user2.principal), (user3.user_id, user3.principal)],
    );

    // The user canisters learn of the membership asynchronously (community -> local user index ->
    // user canister), and `user_canister_notified_of_community_deleted` stops user2 and user3
    // right after this returns. A join event which reaches a stopped canister is rejected and
    // only retried after a 10 second delay, which never elapses while the clock stands still, so
    // a user stopped before its join landed would never hold the community and the final
    // assertion (that user3 still has it) would fail. Wait for the memberships to land first.
    wait_for_community_membership(env, &user2, community_id);
    wait_for_community_membership(env, &user3, community_id);

    TestData {
        user1,
        user2,
        user3,
        community_id,
    }
}

struct TestData {
    user1: User,
    user2: User,
    user3: User,
    community_id: CommunityId,
}

// Ticks, moving time on so that the GroupIndex retries sending the event, until the user's canister
// no longer lists the community
fn wait_for_community_deleted_notification(env: &mut PocketIc, user: &User, community_id: CommunityId) {
    tick_until(env, |env| !holds_community(env, user, community_id));
}

fn holds_community(env: &PocketIc, user: &User, community_id: CommunityId) -> bool {
    client::user::happy_path::initial_state(env, user)
        .communities
        .summaries
        .iter()
        .any(|c| c.community_id == community_id)
}

// Whether searching the GroupIndex's public communities for `name` finds the community
fn is_listed(env: &PocketIc, user: &User, group_index: Principal, name: &str, community_id: CommunityId) -> bool {
    client::group_index::happy_path::explore_communities(env, user.principal, group_index, name)
        .iter()
        .any(|m| m.id == community_id)
}

// Whether the GroupIndex has recorded the community as deleted
fn is_deleted(env: &PocketIc, group_index: Principal, community_id: CommunityId) -> bool {
    let group_index_canister::active_groups::Response::Success(result) = client::group_index::active_groups(
        env,
        Principal::anonymous(),
        group_index,
        &group_index_canister::active_groups::Args {
            group_ids: Vec::new(),
            community_ids: vec![community_id],
            active_since: None,
        },
    );

    result.deleted_communities.iter().any(|c| c.id == community_id)
}
