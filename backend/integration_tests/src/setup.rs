use crate::client::{create_canister, install_canister};
use crate::rng::random_principal;
use crate::utils::{local_bin, tick_many};
use crate::{client, wasms, CanisterIds, TestEnv, NNS_GOVERNANCE_CANISTER_ID, NNS_INTERNET_IDENTITY_CANISTER_ID, T};
use candid::{CandidType, Principal};
use ic_ledger_types::{AccountIdentifier, BlockIndex, Tokens, DEFAULT_SUBACCOUNT};
use ic_test_state_machine_client::StateMachine;
use std::collections::{HashMap, HashSet};
use storage_index_canister::init::CyclesDispenserConfig;
use types::{CanisterId, Version};

pub fn setup_new_env() -> TestEnv {
    let mut file_path = local_bin();
    file_path.push("ic-test-state-machine");
    let mut env = StateMachine::new(file_path.to_str().unwrap(), false);
    let controller = random_principal();
    let canister_ids = install_canisters(&mut env, controller);

    TestEnv {
        env,
        canister_ids,
        controller,
    }
}

fn install_canisters(env: &mut StateMachine, controller: Principal) -> CanisterIds {
    let nns_canister_ids: Vec<_> = (0..10).map(|_| create_canister(env, controller)).collect();
    let icp_ledger_canister_id = nns_canister_ids[2];
    let cycles_minting_canister_id = nns_canister_ids[4];

    let user_index_canister_id = create_canister(env, controller);
    let group_index_canister_id = create_canister(env, controller);
    let notifications_index_canister_id = create_canister(env, controller);
    let online_users_canister_id = create_canister(env, controller);
    let proposals_bot_canister_id = create_canister(env, controller);
    let storage_index_canister_id = create_canister(env, controller);
    let cycles_dispenser_canister_id = create_canister(env, controller);
    let registry_canister_id = create_canister(env, controller);

    let local_user_index_canister_id = create_canister(env, user_index_canister_id);
    let local_group_index_canister_id = create_canister(env, group_index_canister_id);
    let notifications_canister_id = create_canister(env, notifications_index_canister_id);

    let community_canister_wasm = wasms::COMMUNITY.clone();
    let cycles_dispenser_canister_wasm = wasms::CYCLES_DISPENSER.clone();
    let cycles_minting_canister_wasm = wasms::CYCLES_MINTING_CANISTER.clone();
    let group_canister_wasm = wasms::GROUP.clone();
    let group_index_canister_wasm = wasms::GROUP_INDEX.clone();
    let icp_ledger_canister_wasm = wasms::ICP_LEDGER.clone();
    let local_group_index_canister_wasm = wasms::LOCAL_GROUP_INDEX.clone();
    let local_user_index_canister_wasm = wasms::LOCAL_USER_INDEX.clone();
    let notifications_canister_wasm = wasms::NOTIFICATIONS.clone();
    let notifications_index_canister_wasm = wasms::NOTIFICATIONS_INDEX.clone();
    let online_users_canister_wasm = wasms::ONLINE_USERS.clone();
    let proposals_bot_canister_wasm = wasms::PROPOSALS_BOT.clone();
    let registry_canister_wasm = wasms::REGISTRY.clone();
    let storage_bucket_canister_wasm = wasms::STORAGE_BUCKET.clone();
    let storage_index_canister_wasm = wasms::STORAGE_INDEX.clone();
    let user_canister_wasm = wasms::USER.clone();
    let user_index_canister_wasm = wasms::USER_INDEX.clone();

    let user_index_init_args = user_index_canister::init::Args {
        service_principals: vec![controller],
        user_canister_wasm,
        local_user_index_canister_wasm,
        group_index_canister_id,
        notifications_index_canister_id,
        cycles_dispenser_canister_id,
        storage_index_canister_id,
        proposals_bot_user_id: proposals_bot_canister_id.into(),
        internet_identity_canister_id: NNS_INTERNET_IDENTITY_CANISTER_ID,
        wasm_version: Version::min(),
        test_mode: true,
    };
    install_canister(
        env,
        controller,
        user_index_canister_id,
        user_index_canister_wasm,
        user_index_init_args,
    );

    let group_index_init_args = group_index_canister::init::Args {
        service_principals: vec![controller],
        group_canister_wasm,
        community_canister_wasm,
        local_group_index_canister_wasm,
        user_index_canister_id,
        cycles_dispenser_canister_id,
        proposals_bot_user_id: proposals_bot_canister_id.into(),
        wasm_version: Version::min(),
        test_mode: true,
    };
    install_canister(
        env,
        controller,
        group_index_canister_id,
        group_index_canister_wasm,
        group_index_init_args,
    );

    let notifications_index_init_args = notifications_index_canister::init::Args {
        service_principals: vec![controller],
        push_service_principals: vec![controller],
        user_index_canister_id,
        authorizers: vec![user_index_canister_id, group_index_canister_id],
        cycles_dispenser_canister_id,
        notifications_canister_wasm,
        wasm_version: Version::min(),
        test_mode: true,
    };
    install_canister(
        env,
        controller,
        notifications_index_canister_id,
        notifications_index_canister_wasm,
        notifications_index_init_args,
    );

    let online_users_init_args = online_users_canister::init::Args {
        user_index_canister_id,
        cycles_dispenser_canister_id,
        wasm_version: Version::min(),
        test_mode: true,
    };
    install_canister(
        env,
        controller,
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
        controller,
        proposals_bot_canister_id,
        proposals_bot_canister_wasm,
        proposals_bot_init_args,
    );

    let storage_index_init_args = storage_index_canister::init::Args {
        governance_principals: vec![controller],
        user_controllers: vec![user_index_canister_id, group_index_canister_id],
        bucket_canister_wasm: storage_bucket_canister_wasm,
        cycles_dispenser_config: CyclesDispenserConfig {
            canister_id: cycles_dispenser_canister_id,
            min_cycles_balance: 200 * T,
        },
        wasm_version: Version::min(),
        test_mode: true,
    };
    install_canister(
        env,
        controller,
        storage_index_canister_id,
        storage_index_canister_wasm,
        storage_index_init_args,
    );

    let cycles_dispenser_init_args = cycles_dispenser_canister::init::Args {
        governance_principals: vec![controller],
        canisters: vec![
            user_index_canister_id,
            group_index_canister_id,
            notifications_index_canister_id,
            local_user_index_canister_id,
            local_group_index_canister_id,
            notifications_canister_id,
            online_users_canister_id,
            proposals_bot_canister_id,
            storage_index_canister_id,
        ],
        max_top_up_amount: 20 * T,
        min_interval: 5 * 60 * 1000, // 5 minutes
        min_cycles_balance: 200 * T,
        icp_burn_amount_e8s: 1_000_000_000, // 10 ICP
        ledger_canister: icp_ledger_canister_id,
        cycles_minting_canister: cycles_minting_canister_id,
        wasm_version: Version::min(),
        test_mode: true,
    };
    install_canister(
        env,
        controller,
        cycles_dispenser_canister_id,
        cycles_dispenser_canister_wasm,
        cycles_dispenser_init_args,
    );

    let registry_init_args = registry_canister::init::Args {
        governance_principals: vec![controller],
        sns_wasm_canister_id: Principal::anonymous(),
        cycles_dispenser_canister_id,
        wasm_version: Version::min(),
        test_mode: true,
    };
    install_canister(
        env,
        controller,
        registry_canister_id,
        registry_canister_wasm,
        registry_init_args,
    );

    let add_local_group_index_canister_response = client::group_index::add_local_group_index_canister(
        env,
        controller,
        group_index_canister_id,
        &group_index_canister::add_local_group_index_canister::Args {
            canister_id: local_group_index_canister_id,
            local_user_index_canister_id,
            notifications_canister_id,
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
            notifications_canister_id,
        },
    );
    assert!(
        matches!(
            add_local_user_index_canister_response,
            user_index_canister::add_local_user_index_canister::Response::Success
        ),
        "{add_local_user_index_canister_response:?}"
    );

    let add_notifications_canister_response = client::notifications_index::add_notifications_canister(
        env,
        controller,
        notifications_index_canister_id,
        &notifications_index_canister::add_notifications_canister::Args {
            canister_id: notifications_canister_id,
            authorizers: vec![local_user_index_canister_id, local_group_index_canister_id],
        },
    );
    assert!(
        matches!(
            add_notifications_canister_response,
            notifications_index_canister::add_notifications_canister::Response::Success
        ),
        "{add_notifications_canister_response:?}"
    );

    let minting_account = AccountIdentifier::new(&controller, &DEFAULT_SUBACCOUNT);

    let icp_ledger_init_args = LedgerCanisterInitPayload {
        minting_account: minting_account.to_string(),
        initial_values: HashMap::new(),
        send_whitelist: HashSet::new(),
        transfer_fee: Some(Tokens::from_e8s(10_000)),
    };
    install_canister(
        env,
        controller,
        icp_ledger_canister_id,
        icp_ledger_canister_wasm,
        icp_ledger_init_args,
    );

    let cycles_minting_canister_init_args = CyclesMintingCanisterInitPayload {
        ledger_canister_id: icp_ledger_canister_id,
        governance_canister_id: CanisterId::anonymous(),
        minting_account_id: Some(minting_account.to_string()),
        last_purged_notification: Some(0),
    };
    install_canister(
        env,
        controller,
        cycles_minting_canister_id,
        cycles_minting_canister_wasm,
        cycles_minting_canister_init_args,
    );

    // Tick a load of times so that all of the child canisters have time to get installed
    tick_many(env, 30);

    CanisterIds {
        user_index: user_index_canister_id,
        group_index: group_index_canister_id,
        notifications_index: notifications_index_canister_id,
        local_user_index: local_user_index_canister_id,
        local_group_index: local_group_index_canister_id,
        notifications: notifications_canister_id,
        online_users: online_users_canister_id,
        proposals_bot: proposals_bot_canister_id,
        storage_index: storage_index_canister_id,
        cycles_dispenser: cycles_dispenser_canister_id,
        registry: registry_canister_id,
        icp_ledger: icp_ledger_canister_id,
        cycles_minting_canister: cycles_minting_canister_id,
    }
}

#[derive(CandidType)]
struct LedgerCanisterInitPayload {
    minting_account: String,
    initial_values: HashMap<String, Tokens>,
    send_whitelist: HashSet<CanisterId>,
    transfer_fee: Option<Tokens>,
}

#[derive(CandidType)]
struct CyclesMintingCanisterInitPayload {
    ledger_canister_id: CanisterId,
    governance_canister_id: CanisterId,
    minting_account_id: Option<String>,
    last_purged_notification: Option<BlockIndex>,
}
