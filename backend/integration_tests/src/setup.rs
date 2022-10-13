use crate::client::{create_canister, install_canister};
use crate::{wasms, CanisterIds};
use candid::Principal;
use ic_state_machine_tests::StateMachine;
use types::{CanisterId, Version};

const NNS_GOVERNANCE_CANISTER_ID: CanisterId = Principal::from_slice(&[0, 0, 0, 0, 0, 0, 0, 1, 1, 1]);

pub fn setup_env(controller: Principal) -> (StateMachine, CanisterIds) {
    let mut env = StateMachine::new();
    let canister_ids = install_canisters(&mut env, controller);
    (env, canister_ids)
}

fn install_canisters(env: &mut StateMachine, principal: Principal) -> CanisterIds {
    println!("Creating canisters - Starting");

    let callback_canister_id = create_canister(env);
    let group_index_canister_id = create_canister(env);
    let notifications_canister_id = create_canister(env);
    let online_users_aggregator_canister_id = create_canister(env);
    let proposals_bot_canister_id = create_canister(env);
    let user_index_canister_id = create_canister(env);
    let open_storage_index_canister_id = create_canister(env);
    let ledger_canister_id = create_canister(env);

    println!("Creating canisters - Completed");

    let callback_canister_wasm = wasms::CALLBACK.clone();
    let group_canister_wasm = wasms::GROUP.clone();
    let group_index_canister_wasm = wasms::GROUP_INDEX.clone();
    let notifications_canister_wasm = wasms::NOTIFICATIONS.clone();
    let online_users_aggregator_canister_wasm = wasms::ONLINE_USERS_AGGREGATOR.clone();
    let proposals_bot_canister_wasm = wasms::PROPOSALS_BOT.clone();
    let user_canister_wasm = wasms::USER.clone();
    let user_index_canister_wasm = wasms::USER_INDEX.clone();

    println!("Installing canisters - Starting");
    println!("Installing user_index");

    let user_index_init_args = user_index_canister::init::Args {
        service_principals: vec![principal],
        sms_service_principals: vec![principal],
        user_canister_wasm,
        group_index_canister_id,
        notifications_canister_ids: vec![notifications_canister_id],
        online_users_aggregator_canister_id,
        callback_canister_id,
        open_storage_index_canister_id,
        ledger_canister_id,
        proposals_bot_user_id: proposals_bot_canister_id.into(),
        wasm_version: Version::min(),
        test_mode: true,
    };
    install_canister(env, user_index_canister_id, user_index_canister_wasm, user_index_init_args);

    println!("Installing group_index");

    let group_index_init_args = group_index_canister::init::Args {
        service_principals: vec![principal],
        group_canister_wasm,
        notifications_canister_ids: vec![notifications_canister_id],
        user_index_canister_id,
        callback_canister_id,
        wasm_version: Version::min(),
        test_mode: true,
    };
    install_canister(env, group_index_canister_id, group_index_canister_wasm, group_index_init_args);

    println!("Installing notifications");

    let notifications_init_args = notifications_canister::init::Args {
        push_service_principals: vec![principal],
        user_index_canister_id,
        wasm_version: Version::min(),
        test_mode: true,
    };
    install_canister(
        env,
        notifications_canister_id,
        notifications_canister_wasm,
        notifications_init_args,
    );

    println!("Installing online_users_aggregator");

    let online_users_aggregator_init_args = online_users_aggregator_canister::init::Args {
        user_index_canister_id,
        wasm_version: Version::min(),
        test_mode: true,
    };
    install_canister(
        env,
        online_users_aggregator_canister_id,
        online_users_aggregator_canister_wasm,
        online_users_aggregator_init_args,
    );

    println!("Installing callback");

    let callback_init_args = callback_canister::init::Args {
        wasm_version: Version::min(),
        test_mode: true,
    };
    install_canister(env, callback_canister_id, callback_canister_wasm, callback_init_args);

    println!("Installing proposals_bot");

    let proposals_bot_init_args = proposals_bot_canister::init::Args {
        service_owner_principals: vec![principal],
        user_index_canister_id,
        group_index_canister_id,
        nns_governance_canister_id: NNS_GOVERNANCE_CANISTER_ID,
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

    println!("Creating canisters - Completed");

    CanisterIds {
        user_index: user_index_canister_id,
        group_index: group_index_canister_id,
        notifications: notifications_canister_id,
        online_users_aggregator: online_users_aggregator_canister_id,
        callback: callback_canister_id,
        proposals_bot: proposals_bot_canister_id,
        open_storage_index: open_storage_index_canister_id,
        ledger: ledger_canister_id,
    }
}
