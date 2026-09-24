use crate::client::{register_user, register_user_and_include_auth};
use crate::env::ENV;
use crate::utils::tick_many;
use crate::{T, TestEnv, User, UserAuth, client};
use candid::Principal;
use oc_error_codes::OCErrorCode;
use std::ops::Deref;
use std::time::Duration;
use test_case::test_case;
use testing::rng::random_string;
use types::{Empty, Milliseconds};

#[test_case(0, true)]
#[test_case(299_999, true)]
#[test_case(300_001, false)]
fn delete_user_succeeds_if_signed_in_recently(delay: Milliseconds, should_delete_user: bool) {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let (user, user_auth) = register_user_and_include_auth(env, canister_ids);

    env.advance_time(Duration::from_millis(delay));

    let delete_user_response = client::identity::delete_user(
        env,
        user_auth.auth_principal(),
        canister_ids.identity,
        &identity_canister::delete_user::Args {
            public_key: user_auth.auth_public_key.clone(),
            delegation: user_auth.auth_delegation.clone(),
        },
    );

    if should_delete_user {
        assert!(
            matches!(delete_user_response, identity_canister::delete_user::Response::Success),
            "{delete_user_response:?}"
        );
    } else {
        assert!(matches!(
            delete_user_response,
            identity_canister::delete_user::Response::Error(e) if e.matches_code(OCErrorCode::DelegationTooOld)
        ));
    }

    tick_many(env, 5);

    let current_user_response = client::user_index::current_user(env, user.principal, canister_ids.user_index, &Empty {});

    if should_delete_user {
        assert!(matches!(
            current_user_response,
            user_index_canister::current_user::Response::UserNotFound
        ));
    } else {
        assert!(matches!(
            current_user_response,
            user_index_canister::current_user::Response::Success(_)
        ));
    }

    let canister_status = env.canister_status(user.canister(), Some(user.local_user_index)).unwrap();
    assert_eq!(canister_status.module_hash.is_none(), should_delete_user);

    if should_delete_user {
        // The uninstalled canister's cycles are sent to the CyclesDispenser
        wait_for_cycles_to_be_refunded(env, &user);
    }

    // The identity canister should no longer know the auth principal of a deleted user
    let check_auth_principal_response =
        client::identity::check_auth_principal_v2(env, user_auth.auth_principal(), canister_ids.identity, &Empty {});
    assert_eq!(
        matches!(
            check_auth_principal_response,
            identity_canister::check_auth_principal_v2::Response::NotFound
        ),
        should_delete_user
    );

    if should_delete_user {
        // Waiting for the refund advanced the clock significantly
        wrapper.discard();
    }
}

#[test]
fn cycles_of_users_deleted_previously_can_be_refunded_by_a_platform_operator() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let (user, user_auth) = register_user_and_include_auth(env, canister_ids);
    let operator = register_user(env, canister_ids);
    client::user_index::happy_path::add_platform_operator(env, *controller, canister_ids.user_index, operator.user_id);

    delete_user(env, &user_auth, canister_ids.identity);
    wait_for_cycles_to_be_refunded(env, &user);

    // Simulate a user deleted before cycles were refunded on deletion
    env.add_cycles(user.canister(), T);
    let refunded_before = cycles_refunded_metric(env, user.local_user_index);

    let response = client::user_index::refund_deleted_user_cycles(
        env,
        operator.principal,
        canister_ids.user_index,
        &user_index_canister::refund_deleted_user_cycles::Args {},
    );
    assert!(
        matches!(response, user_index_canister::refund_deleted_user_cycles::Response::Success(ref r) if r.canisters >= 1),
        "{response:?}"
    );

    wait_for_cycles_to_be_refunded(env, &user);
    let refunded = cycles_refunded_metric(env, user.local_user_index) - refunded_before;
    assert!(refunded > T - MAX_RESIDUAL_CYCLES, "{refunded}");

    // The refunder is uninstalled again afterwards
    let canister_status = env.canister_status(user.canister(), Some(user.local_user_index)).unwrap();
    assert!(canister_status.module_hash.is_none());

    wrapper.discard();
}

#[test]
fn cycles_of_users_deleted_previously_are_refunded_after_the_first_user_index_upgrade_only() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let (user, user_auth) = register_user_and_include_auth(env, canister_ids);

    delete_user(env, &user_auth, canister_ids.identity);
    wait_for_cycles_to_be_refunded(env, &user);

    // Simulate a user deleted before cycles were refunded on deletion
    env.add_cycles(user.canister(), T);
    let refunded_before = cycles_refunded_metric(env, user.local_user_index);

    upgrade_user_index(env, canister_ids);

    wait_for_cycles_to_be_refunded(env, &user);
    let refunded = cycles_refunded_metric(env, user.local_user_index) - refunded_before;
    assert!(refunded > T - MAX_RESIDUAL_CYCLES, "{refunded}");

    // Subsequent upgrades don't refund the cycles again
    env.add_cycles(user.canister(), T);
    let balance_before = env.cycle_balance(user.canister());

    upgrade_user_index(env, canister_ids);

    for _ in 0..10 {
        env.advance_time(Duration::from_secs(60));
        tick_many(env, 5);
    }
    assert!(balance_before - env.cycle_balance(user.canister()) < 1_000_000_000);

    wrapper.discard();
}

#[test]
fn cycles_refund_tops_up_canisters_with_too_few_cycles_to_install_code() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let (user, user_auth) = register_user_and_include_auth(env, canister_ids);
    let operator = register_user(env, canister_ids);
    client::user_index::happy_path::add_platform_operator(env, *controller, canister_ids.user_index, operator.user_id);

    delete_user(env, &user_auth, canister_ids.identity);
    wait_for_cycles_to_be_refunded(env, &user);

    // ~200B is worth refunding but not enough to run install_code
    env.add_cycles(user.canister(), 120_000_000_000);
    let balance_before = env.cycle_balance(user.canister());
    let refunded_before = cycles_refunded_metric(env, user.local_user_index);

    client::user_index::refund_deleted_user_cycles(
        env,
        operator.principal,
        canister_ids.user_index,
        &user_index_canister::refund_deleted_user_cycles::Args {},
    );
    wait_for_cycles_to_be_refunded(env, &user);

    // The top-up is refunded along with what the canister held
    let refunded = cycles_refunded_metric(env, user.local_user_index) - refunded_before;
    assert!(refunded > balance_before, "{refunded}");

    wrapper.discard();
}

#[test]
fn cycles_refund_resumes_after_the_local_user_index_is_upgraded_mid_way() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let (user, user_auth) = register_user_and_include_auth(env, canister_ids);
    let operator = register_user(env, canister_ids);
    client::user_index::happy_path::add_platform_operator(env, *controller, canister_ids.user_index, operator.user_id);

    delete_user(env, &user_auth, canister_ids.identity);
    wait_for_cycles_to_be_refunded(env, &user);

    env.add_cycles(user.canister(), T);
    client::user_index::refund_deleted_user_cycles(
        env,
        operator.principal,
        canister_ids.user_index,
        &user_index_canister::refund_deleted_user_cycles::Args {},
    );

    // Wait until the refunder has been installed but not yet uninstalled
    let mut refunder_installed = false;
    for _ in 0..100 {
        env.tick();
        let canister_status = env.canister_status(user.canister(), Some(user.local_user_index)).unwrap();
        if canister_status.module_hash.is_some() {
            refunder_installed = true;
            break;
        }
    }
    assert!(refunder_installed);

    // Upgrading the LocalUserIndex drops whatever it was in the middle of
    let wasm = crate::wasms::LOCAL_USER_INDEX.clone();
    let args = candid::encode_one(local_user_index_canister::post_upgrade::Args {
        wasm_version: wasm.version,
    })
    .unwrap();
    client::stop_canister(env, canister_ids.user_index, user.local_user_index);
    env.upgrade_canister(user.local_user_index, wasm.module.into(), args, Some(canister_ids.user_index))
        .unwrap();
    client::start_canister(env, canister_ids.user_index, user.local_user_index);

    // The canister is still queued, so the refund is picked up again and completed
    wait_for_cycles_to_be_refunded(env, &user);
    wait_for_refund_queue_to_empty(env, user.local_user_index);

    wrapper.discard();
}

#[test]
fn cycles_refund_leaves_a_canister_with_other_code_untouched() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let (user, user_auth) = register_user_and_include_auth(env, canister_ids);
    let operator = register_user(env, canister_ids);
    client::user_index::happy_path::add_platform_operator(env, *controller, canister_ids.user_index, operator.user_id);

    delete_user(env, &user_auth, canister_ids.identity);
    wait_for_cycles_to_be_refunded(env, &user);

    // The deleted user's canister somehow ends up with cycles and some other code on it
    env.add_cycles(user.canister(), T);
    let other_wasm = wat::parse_str("(module)").unwrap();
    env.install_canister(user.canister(), other_wasm, vec![], Some(user.local_user_index));
    let canister_status = env.canister_status(user.canister(), Some(user.local_user_index)).unwrap();
    let module_hash = canister_status.module_hash.unwrap();
    let balance_before = env.cycle_balance(user.canister());

    client::user_index::refund_deleted_user_cycles(
        env,
        operator.principal,
        canister_ids.user_index,
        &user_index_canister::refund_deleted_user_cycles::Args {},
    );
    wait_for_refund_queue_to_empty(env, user.local_user_index);

    // It is left exactly as it was
    let canister_status = env.canister_status(user.canister(), Some(user.local_user_index)).unwrap();
    assert_eq!(canister_status.module_hash.unwrap(), module_hash);
    assert!(balance_before - env.cycle_balance(user.canister()) < 1_000_000_000);

    wrapper.discard();
}

// See backend/canisters/cycles_refunder/README.md for why ~80B cycles can't be recovered
const MAX_RESIDUAL_CYCLES: u128 = 100_000_000_000;

fn cycles_refunded_metric(env: &pocket_ic::PocketIc, local_user_index: types::CanisterId) -> u128 {
    let metrics = crate::utils::metrics(env, local_user_index);
    metrics["cycles_refunded_from_deleted_users"].as_u64().unwrap().into()
}

fn upgrade_user_index(env: &mut pocket_ic::PocketIc, canister_ids: &crate::CanisterIds) {
    let wasm = crate::wasms::USER_INDEX.clone();
    let args = candid::encode_one(user_index_canister::post_upgrade::Args {
        wasm_version: wasm.version,
    })
    .unwrap();
    client::stop_canister(env, canister_ids.openchat_installer, canister_ids.user_index);
    env.upgrade_canister(
        canister_ids.user_index,
        wasm.module.into(),
        args,
        Some(canister_ids.openchat_installer),
    )
    .unwrap();
    client::start_canister(env, canister_ids.openchat_installer, canister_ids.user_index);
}

fn wait_for_refund_queue_to_empty(env: &mut pocket_ic::PocketIc, local_user_index: types::CanisterId) {
    for _ in 0..50 {
        let metrics = crate::utils::metrics(env, local_user_index);
        if metrics["cycles_refund_queue_length"] == 0 {
            return;
        }
        env.advance_time(Duration::from_secs(60));
        tick_many(env, 5);
    }
    panic!("Refund queue did not empty");
}

// Refunding takes a handful of rounds: canister_status, install_code, the refund call (which
// deposits into the CyclesDispenser via the management canister), then uninstall_code. The user
// canister was itself installed only moments ago though, so the IC's install_code rate limit
// applies and the LocalUserIndex has to retry after a delay, hence time is advanced too.
fn wait_for_cycles_to_be_refunded(env: &mut pocket_ic::PocketIc, user: &User) {
    for _ in 0..200 {
        // The balance drops once `refund` completes, and the refunder is uninstalled after that
        if env.cycle_balance(user.canister()) < MAX_RESIDUAL_CYCLES
            && env
                .canister_status(user.canister(), Some(user.local_user_index))
                .unwrap()
                .module_hash
                .is_none()
        {
            return;
        }
        env.advance_time(Duration::from_secs(60));
        tick_many(env, 5);
    }
    let metrics = crate::utils::metrics(env, user.local_user_index);
    let errors = client::http_request(
        env,
        candid::Principal::anonymous(),
        user.local_user_index,
        &types::HttpRequest {
            method: "GET".to_string(),
            url: "/errors".to_string(),
            headers: Vec::new(),
            body: Vec::new(),
        },
    );
    panic!(
        "Cycles not refunded, balance: {}, queue: {}, refunded: {}, errors: {}",
        env.cycle_balance(user.canister()),
        metrics["cycles_refund_queue_length"],
        metrics["cycles_refunded_from_deleted_users"],
        String::from_utf8_lossy(&errors.body)
    );
}

fn delete_user(env: &mut pocket_ic::PocketIc, user_auth: &UserAuth, identity_canister_id: types::CanisterId) {
    let response = client::identity::delete_user(
        env,
        user_auth.auth_principal(),
        identity_canister_id,
        &identity_canister::delete_user::Args {
            public_key: user_auth.auth_public_key.clone(),
            delegation: user_auth.auth_delegation.clone(),
        },
    );
    assert!(
        matches!(response, identity_canister::delete_user::Response::Success),
        "{response:?}"
    );
}

#[test]
fn deleted_user_removed_from_groups_and_communities() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let user1 = client::register_diamond_user(env, canister_ids, *controller);
    let (user2, user2_auth) = register_user_and_include_auth(env, canister_ids);

    let group_id = client::user::happy_path::create_group(env, &user1, &random_string(), true, true);
    let community_id = client::user::happy_path::create_community(env, &user1, &random_string(), true, vec![random_string()]);

    client::group::happy_path::join_group(env, user2.principal, group_id);
    client::community::happy_path::join_community(env, user2.principal, community_id);

    tick_many(env, 3);

    let group_summary = client::group::happy_path::selected_initial(env, user1.principal, group_id);
    let community_summary = client::community::happy_path::selected_initial(env, user1.principal, community_id);

    assert_eq!(group_summary.basic_members, vec![user2.user_id]);
    assert_eq!(community_summary.basic_members, vec![user2.user_id]);

    client::identity::happy_path::delete_user(env, &user2_auth, canister_ids.identity);

    tick_many(env, 20);

    let group_summary = client::group::happy_path::selected_initial(env, user1.principal, group_id);
    let community_summary = client::community::happy_path::selected_initial(env, user1.principal, community_id);

    assert!(group_summary.basic_members.is_empty());
    assert!(community_summary.basic_members.is_empty());
}

#[test]
fn deleted_user_removed_from_online_users_canister() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let (user, user_auth) = register_user_and_include_auth(env, canister_ids);

    env.tick();

    client::online_users::happy_path::mark_as_online(env, user.principal, canister_ids.online_users);

    assert_eq!(
        client::online_users::happy_path::last_online(env, vec![user.user_id], canister_ids.online_users).len(),
        1
    );

    client::identity::happy_path::delete_user(env, &user_auth, canister_ids.identity);

    tick_many(env, 3);

    assert!(client::online_users::happy_path::last_online(env, vec![user.user_id], canister_ids.online_users).is_empty(),);
}

#[test]
fn deleted_user_removed_from_storage_index_and_files_deleted() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let (user, user_auth) = register_user_and_include_auth(env, canister_ids);

    env.tick();

    let file =
        client::storage_index::happy_path::upload_file(env, user.principal, canister_ids.storage_index, 1000, Vec::new());

    assert!(client::storage_bucket::happy_path::file_exists(
        env,
        Principal::anonymous(),
        file.canister_id,
        file.blob_id
    ));

    client::identity::happy_path::delete_user(env, &user_auth, canister_ids.identity);

    tick_many(env, 3);

    let storage_user_response = client::storage_index::user(env, user.principal, canister_ids.storage_index, &Empty {});
    assert!(matches!(
        storage_user_response,
        storage_index_canister::user::Response::UserNotFound
    ));

    assert!(!client::storage_bucket::happy_path::file_exists(
        env,
        Principal::anonymous(),
        file.canister_id,
        file.blob_id
    ));
}
