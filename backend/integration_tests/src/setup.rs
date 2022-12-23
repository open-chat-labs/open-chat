use crate::client::{create_canister, install_canister};
use crate::rng::random_principal;
use crate::{client, wasms, CanisterIds};
use candid::Principal;
use ic_state_machine_tests::StateMachine;
use lazy_static::lazy_static;
use std::sync::Mutex;
use types::{CanisterId, Version};

const NNS_GOVERNANCE_CANISTER_ID: CanisterId = Principal::from_slice(&[0, 0, 0, 0, 0, 0, 0, 1, 1, 1]);

lazy_static! {
    static ref ENV: Mutex<Vec<TestEnv>> = Mutex::default();
}

pub struct TestEnv {
    pub env: StateMachine,
    pub canister_ids: CanisterIds,
    pub controller: Principal,
}

pub fn setup_env() -> TestEnv {
    if let Some(env) = try_take_existing_env() {
        return env;
    }
    setup_fresh_env()
}

pub fn setup_fresh_env() -> TestEnv {
    let mut env = StateMachine::new();
    let controller = random_principal();
    let canister_ids = install_canisters(&mut env, controller);

    TestEnv {
        env,
        canister_ids,
        controller,
    }
}

pub fn return_env(env: TestEnv) {
    if let Ok(mut e) = ENV.try_lock() {
        e.push(env);
    }
}

fn try_take_existing_env() -> Option<TestEnv> {
    ENV.try_lock().ok().and_then(|mut e| e.pop())
}

fn install_canisters(env: &mut StateMachine, controller: Principal) -> CanisterIds {
    let group_index_canister_id = create_canister(env, None);
    let notifications_canister_id = create_canister(env, None);
    let online_users_canister_id = create_canister(env, None);
    let proposals_bot_canister_id = create_canister(env, None);
    let user_index_canister_id = create_canister(env, None);
    let cycles_dispenser_canister_id = create_canister(env, None);
    let open_storage_index_canister_id = create_canister(env, None);
    let ledger_canister_id = create_canister(env, None);
    let local_group_index_canister_id = create_canister(env, Some(vec![group_index_canister_id]));
    let local_user_index_canister_id = create_canister(env, Some(vec![user_index_canister_id]));

    let group_canister_wasm = wasms::GROUP.clone();
    let local_group_index_canister_wasm = wasms::LOCAL_GROUP_INDEX.clone();
    let group_index_canister_wasm = wasms::GROUP_INDEX.clone();
    let notifications_canister_wasm = wasms::NOTIFICATIONS.clone();
    let online_users_canister_wasm = wasms::ONLINE_USERS.clone();
    let proposals_bot_canister_wasm = wasms::PROPOSALS_BOT.clone();
    let user_canister_wasm = wasms::USER.clone();
    let local_user_index_canister_wasm = wasms::LOCAL_USER_INDEX.clone();
    let user_index_canister_wasm = wasms::USER_INDEX.clone();

    let user_index_init_args = user_index_canister::init::Args {
        service_principals: vec![controller],
        sms_service_principals: vec![controller],
        user_canister_wasm,
        local_user_index_canister_wasm,
        group_index_canister_id,
        notifications_canister_ids: vec![notifications_canister_id],
        cycles_dispenser_canister_id,
        open_storage_index_canister_id,
        ledger_canister_id,
        proposals_bot_user_id: proposals_bot_canister_id.into(),
        wasm_version: Version::min(),
        test_mode: true,
    };
    install_canister(env, user_index_canister_id, user_index_canister_wasm, user_index_init_args);

    let group_index_init_args = group_index_canister::init::Args {
        service_principals: vec![controller],
        group_canister_wasm,
        local_group_index_canister_wasm,
        notifications_canister_ids: vec![notifications_canister_id],
        user_index_canister_id,
        cycles_dispenser_canister_id,
        ledger_canister_id,
        wasm_version: Version::min(),
        test_mode: true,
    };
    install_canister(env, group_index_canister_id, group_index_canister_wasm, group_index_init_args);

    let notifications_init_args = notifications_canister::init::Args {
        push_service_principals: vec![controller],
        user_index_canister_id,
        cycles_dispenser_canister_id,
        wasm_version: Version::min(),
        test_mode: true,
    };
    install_canister(
        env,
        notifications_canister_id,
        notifications_canister_wasm,
        notifications_init_args,
    );

    let online_users_init_args = online_users_canister::init::Args {
        user_index_canister_id,
        cycles_dispenser_canister_id,
        wasm_version: Version::min(),
        test_mode: true,
    };
    install_canister(
        env,
        online_users_canister_id,
        online_users_canister_wasm,
        online_users_init_args,
    );

    let proposals_bot_init_args = proposals_bot_canister::init::Args {
        service_owner_principals: vec![controller],
        user_index_canister_id,
        group_index_canister_id,
        nns_governance_canister_id: NNS_GOVERNANCE_CANISTER_ID,
        cycles_dispenser_canister_id,
        wasm_version: Version::min(),
        test_mode: true,
    };
    install_canister(
        env,
        proposals_bot_canister_id,
        proposals_bot_canister_wasm,
        proposals_bot_init_args,
    );

    // let open_storage_index_canister_wasm = get_open_storage_canister_wasm(OpenStorageCanisterName::Index, version);
    // let open_storage_index_init_args = OpenStorageInitArgs {
    //     service_principals: vec![principal, canister_ids.user_index, canister_ids.group_index],
    //     bucket_canister_wasm: get_open_storage_canister_wasm(OpenStorageCanisterName::Bucket, version),
    //     wasm_version: version,
    //     test_mode,
    // };

    let add_local_group_index_canister_response = client::group_index::add_local_group_index_canister(
        env,
        controller,
        group_index_canister_id,
        &group_index_canister::add_local_group_index_canister::Args {
            canister_id: local_group_index_canister_id,
        },
    );
    assert!(
        matches!(
            add_local_group_index_canister_response,
            group_index_canister::add_local_group_index_canister::Response::Success
        ),
        "{add_local_group_index_canister_response:?}"
    );

    let add_local_user_index_canister_response = client::user_index::add_local_user_index_canister(
        env,
        controller,
        user_index_canister_id,
        &user_index_canister::add_local_user_index_canister::Args {
            canister_id: local_user_index_canister_id,
        },
    );
    assert!(
        matches!(
            add_local_user_index_canister_response,
            user_index_canister::add_local_user_index_canister::Response::Success
        ),
        "{add_local_user_index_canister_response:?}"
    );

    CanisterIds {
        user_index: user_index_canister_id,
        group_index: group_index_canister_id,
        notifications: notifications_canister_id,
        online_users: online_users_canister_id,
        proposals_bot: proposals_bot_canister_id,
        open_storage_index: open_storage_index_canister_id,
        ledger: ledger_canister_id,
    }
}
