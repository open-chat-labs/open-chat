use candid::Principal;
use canister_agent_utils::{build_ic_agent, get_canister_wasm, install_wasm, set_controllers, CanisterIds, CanisterName};
use ic_agent::identity::BasicIdentity;
use ic_agent::{Agent, Identity};
use ic_utils::interfaces::ManagementCanister;
use types::{CanisterWasm, Cycles, Version};

const T: Cycles = 1_000_000_000_000;

pub async fn install_service_canisters(identity: BasicIdentity, url: String, canister_ids: CanisterIds, test_mode: bool) {
    let principal = identity.sender().unwrap();
    let agent = build_ic_agent(url, identity).await;
    let management_canister = ManagementCanister::create(&agent);

    install_service_canisters_impl(principal, &canister_ids, &agent, &management_canister, test_mode).await;
}

async fn install_service_canisters_impl(
    principal: Principal,
    canister_ids: &CanisterIds,
    agent: &Agent,
    management_canister: &ManagementCanister<'_>,
    test_mode: bool,
) {
    let controllers = vec![principal];
    futures::future::join_all(vec![
        set_controllers(management_canister, &canister_ids.user_index, controllers.clone()),
        set_controllers(management_canister, &canister_ids.group_index, controllers.clone()),
        set_controllers(management_canister, &canister_ids.notifications_index, controllers.clone()),
        set_controllers(management_canister, &canister_ids.online_users, controllers.clone()),
        set_controllers(management_canister, &canister_ids.proposals_bot, controllers.clone()),
        set_controllers(management_canister, &canister_ids.storage_index, controllers.clone()),
        set_controllers(management_canister, &canister_ids.cycles_dispenser, controllers.clone()),
        set_controllers(management_canister, &canister_ids.market_maker, controllers),
        set_controllers(
            management_canister,
            &canister_ids.local_user_index,
            vec![canister_ids.user_index],
        ),
        set_controllers(
            management_canister,
            &canister_ids.local_group_index,
            vec![canister_ids.group_index],
        ),
        set_controllers(
            management_canister,
            &canister_ids.notifications,
            vec![canister_ids.notifications_index],
        ),
    ])
    .await;

    let version = Version::min();

    let user_index_canister_wasm = get_canister_wasm(CanisterName::UserIndex, version);
    let user_index_init_args = user_index_canister::init::Args {
        service_principals: vec![principal],
        user_canister_wasm: CanisterWasm::default(),
        local_user_index_canister_wasm: CanisterWasm::default(),
        group_index_canister_id: canister_ids.group_index,
        notifications_index_canister_id: canister_ids.notifications_index,
        storage_index_canister_id: canister_ids.storage_index,
        proposals_bot_user_id: canister_ids.proposals_bot.into(),
        cycles_dispenser_canister_id: canister_ids.cycles_dispenser,
        wasm_version: version,
        test_mode,
    };

    let group_index_canister_wasm = get_canister_wasm(CanisterName::GroupIndex, version);
    let group_index_init_args = group_index_canister::init::Args {
        service_principals: vec![principal],
        group_canister_wasm: CanisterWasm::default(),
        local_group_index_canister_wasm: CanisterWasm::default(),
        user_index_canister_id: canister_ids.user_index,
        cycles_dispenser_canister_id: canister_ids.cycles_dispenser,
        proposals_bot_user_id: canister_ids.proposals_bot.into(),
        wasm_version: version,
        test_mode,
    };

    let notifications_index_canister_wasm = get_canister_wasm(CanisterName::NotificationsIndex, version);
    let notifications_index_init_args = notifications_index_canister::init::Args {
        service_principals: vec![principal],
        push_service_principals: vec![principal],
        user_index_canister_id: canister_ids.user_index,
        authorizers: vec![canister_ids.user_index, canister_ids.group_index],
        cycles_dispenser_canister_id: canister_ids.cycles_dispenser,
        notifications_canister_wasm: CanisterWasm::default(),
        wasm_version: version,
        test_mode,
    };

    let online_users_canister_wasm = get_canister_wasm(CanisterName::OnlineUsers, version);
    let online_users_init_args = online_users_canister::init::Args {
        user_index_canister_id: canister_ids.user_index,
        cycles_dispenser_canister_id: canister_ids.cycles_dispenser,
        wasm_version: version,
        test_mode,
    };

    let proposals_bot_canister_wasm = get_canister_wasm(CanisterName::ProposalsBot, version);
    let proposals_bot_init_args = proposals_bot_canister::init::Args {
        service_owner_principals: vec![principal],
        user_index_canister_id: canister_ids.user_index,
        group_index_canister_id: canister_ids.group_index,
        nns_governance_canister_id: canister_ids.nns_governance,
        cycles_dispenser_canister_id: canister_ids.cycles_dispenser,
        wasm_version: version,
        test_mode,
    };

    let storage_index_canister_wasm = get_canister_wasm(CanisterName::StorageIndex, version);
    let storage_index_init_args = storage_index_canister::init::Args {
        governance_principals: vec![principal],
        user_controllers: vec![canister_ids.user_index, canister_ids.group_index],
        bucket_canister_wasm: get_canister_wasm(CanisterName::StorageBucket, version),
        cycles_dispenser_config: storage_index_canister::init::CyclesDispenserConfig {
            canister_id: canister_ids.cycles_dispenser,
            min_cycles_balance: 200 * T,
        },
        wasm_version: version,
        test_mode,
    };

    let cycles_dispenser_canister_wasm = get_canister_wasm(CanisterName::CyclesDispenser, version);
    let cycles_dispenser_init_args = cycles_dispenser_canister::init::Args {
        governance_principals: vec![principal],
        canisters: vec![
            canister_ids.user_index,
            canister_ids.group_index,
            canister_ids.notifications_index,
            canister_ids.local_user_index,
            canister_ids.local_group_index,
            canister_ids.notifications,
            canister_ids.online_users,
            canister_ids.proposals_bot,
            canister_ids.storage_index,
        ],
        max_top_up_amount: 20 * T,
        min_interval: 5 * 60 * 1000, // 5 minutes
        min_cycles_balance: 200 * T,
        icp_burn_amount_e8s: 1_000_000_000, // 10 ICP
        ledger_canister: canister_ids.nns_ledger,
        cycles_minting_canister: canister_ids.nns_cmc,
        wasm_version: version,
        test_mode,
    };

    let market_maker_canister_wasm = get_canister_wasm(CanisterName::MarketMaker, version);
    let market_maker_init_args = market_maker_canister::init::Args {
        user_index_canister_id: canister_ids.user_index,
        cycles_dispenser_canister_id: canister_ids.cycles_dispenser,
        icp_ledger_canister_id: canister_ids.nns_ledger,
        chat_ledger_canister_id: canister_ids.nns_ledger, // TODO This should be the CHAT ledger
        wasm_version: version,
        test_mode,
    };

    futures::future::join5(
        install_wasm(
            management_canister,
            &canister_ids.user_index,
            &user_index_canister_wasm.module,
            user_index_init_args,
        ),
        install_wasm(
            management_canister,
            &canister_ids.group_index,
            &group_index_canister_wasm.module,
            group_index_init_args,
        ),
        install_wasm(
            management_canister,
            &canister_ids.notifications_index,
            &notifications_index_canister_wasm.module,
            notifications_index_init_args,
        ),
        install_wasm(
            management_canister,
            &canister_ids.online_users,
            &online_users_canister_wasm.module,
            online_users_init_args,
        ),
        install_wasm(
            management_canister,
            &canister_ids.proposals_bot,
            &proposals_bot_canister_wasm.module,
            proposals_bot_init_args,
        ),
    )
    .await;

    futures::future::join3(
        install_wasm(
            management_canister,
            &canister_ids.storage_index,
            &storage_index_canister_wasm.module,
            storage_index_init_args,
        ),
        install_wasm(
            management_canister,
            &canister_ids.cycles_dispenser,
            &cycles_dispenser_canister_wasm.module,
            cycles_dispenser_init_args,
        ),
        install_wasm(
            management_canister,
            &canister_ids.market_maker,
            &market_maker_canister_wasm.module,
            market_maker_init_args,
        ),
    )
    .await;

    let user_canister_wasm = get_canister_wasm(CanisterName::User, version);
    let group_canister_wasm = get_canister_wasm(CanisterName::Group, version);
    let local_group_index_canister_wasm = get_canister_wasm(CanisterName::LocalGroupIndex, version);
    let local_user_index_canister_wasm = get_canister_wasm(CanisterName::LocalUserIndex, version);
    let notifications_canister_wasm = get_canister_wasm(CanisterName::Notifications, version);

    futures::future::try_join5(
        user_index_canister_client::upgrade_local_user_index_canister_wasm(
            agent,
            &canister_ids.user_index,
            &user_index_canister::upgrade_local_user_index_canister_wasm::Args {
                wasm: local_user_index_canister_wasm,
                filter: None,
                use_for_new_canisters: None,
            },
        ),
        user_index_canister_client::upgrade_user_canister_wasm(
            agent,
            &canister_ids.user_index,
            &user_index_canister::upgrade_user_canister_wasm::Args {
                wasm: user_canister_wasm,
                filter: None,
                use_for_new_canisters: None,
            },
        ),
        group_index_canister_client::upgrade_local_group_index_canister_wasm(
            agent,
            &canister_ids.group_index,
            &group_index_canister::upgrade_local_group_index_canister_wasm::Args {
                wasm: local_group_index_canister_wasm,
                filter: None,
                use_for_new_canisters: None,
            },
        ),
        group_index_canister_client::upgrade_group_canister_wasm(
            agent,
            &canister_ids.group_index,
            &group_index_canister::upgrade_group_canister_wasm::Args {
                wasm: group_canister_wasm,
                filter: None,
                use_for_new_canisters: None,
            },
        ),
        notifications_index_canister_client::upgrade_notifications_canister_wasm(
            agent,
            &canister_ids.notifications_index,
            &notifications_index_canister::upgrade_notifications_canister_wasm::Args {
                wasm: notifications_canister_wasm,
                filter: None,
                use_for_new_canisters: None,
            },
        ),
    )
    .await
    .unwrap();

    let add_local_group_index_canister_response = group_index_canister_client::add_local_group_index_canister(
        agent,
        &canister_ids.group_index,
        &group_index_canister::add_local_group_index_canister::Args {
            canister_id: canister_ids.local_group_index,
            local_user_index_canister_id: canister_ids.local_user_index,
            notifications_canister_id: canister_ids.notifications,
        },
    )
    .await
    .unwrap();

    if !matches!(
        add_local_group_index_canister_response,
        group_index_canister::add_local_group_index_canister::Response::Success
    ) {
        panic!("{add_local_group_index_canister_response:?}");
    }

    let add_local_user_index_canister_response = user_index_canister_client::add_local_user_index_canister(
        agent,
        &canister_ids.user_index,
        &user_index_canister::add_local_user_index_canister::Args {
            canister_id: canister_ids.local_user_index,
            notifications_canister_id: canister_ids.notifications,
        },
    )
    .await
    .unwrap();

    if !matches!(
        add_local_user_index_canister_response,
        user_index_canister::add_local_user_index_canister::Response::Success
    ) {
        panic!("{add_local_user_index_canister_response:?}");
    }

    let add_notifications_canister_response = notifications_index_canister_client::add_notifications_canister(
        agent,
        &canister_ids.notifications_index,
        &notifications_index_canister::add_notifications_canister::Args {
            canister_id: canister_ids.notifications,
            authorizers: vec![canister_ids.local_user_index, canister_ids.local_group_index],
        },
    )
    .await
    .unwrap();

    if !matches!(
        add_notifications_canister_response,
        notifications_index_canister::add_notifications_canister::Response::Success
    ) {
        panic!("{add_notifications_canister_response:?}");
    }

    println!("Canister wasms installed");
}
