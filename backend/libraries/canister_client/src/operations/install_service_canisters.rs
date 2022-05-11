use crate::utils::{
    build_ic_agent, build_management_canister, create_empty_canister, get_canister_wasm, install_wasm, set_controllers,
};
use crate::{CanisterIds, CanisterName};
use candid::Principal;
use ic_agent::identity::BasicIdentity;
use ic_agent::Identity;
use ic_utils::interfaces::ManagementCanister;
use ic_utils::Canister;
use types::Version;

pub async fn create_and_install_service_canisters(identity: BasicIdentity, url: String, test_mode: bool) -> CanisterIds {
    let principal = identity.sender().unwrap();
    let agent = build_ic_agent(url, identity).await;
    let management_canister = build_management_canister(&agent);

    // futures::future::joinN is only defined for N <= 5
    let (
        root_canister_id,
        user_index_canister_id,
        group_index_canister_id,
        notifications_canister_id,
        online_users_aggregator_canister_id,
    ) = futures::future::join5(
        create_empty_canister(&management_canister),
        create_empty_canister(&management_canister),
        create_empty_canister(&management_canister),
        create_empty_canister(&management_canister),
        create_empty_canister(&management_canister),
    )
    .await;

    let (callback_canister_id, open_storage_index_canister_id, transaction_notifier_canister_id, ledger_canister_id) =
        futures::future::join4(
            create_empty_canister(&management_canister),
            create_empty_canister(&management_canister),
            create_empty_canister(&management_canister),
            create_empty_canister(&management_canister),
        )
        .await;

    println!("root canister id: {root_canister_id}");
    println!("user_index canister id: {user_index_canister_id}");
    println!("group_index canister id: {group_index_canister_id}");
    println!("notifications canister id: {notifications_canister_id}");
    println!("users online aggregator canister id: {online_users_aggregator_canister_id}");
    println!("callback canister id: {callback_canister_id}");
    println!("open_storage_index canister id: {open_storage_index_canister_id}");
    println!("transaction_notifier canister id: {transaction_notifier_canister_id}");
    println!("ledger canister id: {ledger_canister_id}");

    let canister_ids = CanisterIds {
        root: root_canister_id,
        user_index: user_index_canister_id,
        group_index: group_index_canister_id,
        notifications: notifications_canister_id,
        online_users_aggregator: online_users_aggregator_canister_id,
        callback: callback_canister_id,
        open_storage_index: open_storage_index_canister_id,
        transaction_notifier: transaction_notifier_canister_id,
        ledger: ledger_canister_id,
    };

    install_service_canisters_impl(principal, &canister_ids, &management_canister, test_mode).await;

    canister_ids
}

pub async fn install_service_canisters(identity: BasicIdentity, url: String, canister_ids: CanisterIds, test_mode: bool) {
    let principal = identity.sender().unwrap();
    let agent = build_ic_agent(url, identity).await;
    let management_canister = build_management_canister(&agent);

    install_service_canisters_impl(principal, &canister_ids, &management_canister, test_mode).await;
}

async fn install_service_canisters_impl(
    principal: Principal,
    canister_ids: &CanisterIds,
    management_canister: &Canister<'_, ManagementCanister>,
    test_mode: bool,
) {
    let controllers = vec![principal, canister_ids.root];
    futures::future::join5(
        set_controllers(management_canister, &canister_ids.user_index, controllers.clone()),
        set_controllers(management_canister, &canister_ids.group_index, controllers.clone()),
        set_controllers(management_canister, &canister_ids.notifications, controllers.clone()),
        set_controllers(
            management_canister,
            &canister_ids.online_users_aggregator,
            controllers.clone(),
        ),
        set_controllers(management_canister, &canister_ids.callback, controllers),
    )
    .await;

    let version = Version::min();

    let root_canister_wasm = get_canister_wasm(CanisterName::Root, version, false);
    let root_init_args = root_canister::init::Args {
        service_principals: vec![principal],
        user_index_canister_id: canister_ids.user_index,
        group_index_canister_id: canister_ids.group_index,
        notifications_canister_id: canister_ids.notifications,
        online_users_aggregator_canister_id: canister_ids.online_users_aggregator,
        open_storage_index_canister_id: canister_ids.open_storage_index,
        wasm_version: version,
        test_mode,
    };

    let user_index_canister_wasm = get_canister_wasm(CanisterName::UserIndex, version, false);
    let user_canister_wasm = get_canister_wasm(CanisterName::User, Version::min(), true);
    let user_index_init_args = user_index_canister::init::Args {
        service_principals: vec![principal],
        sms_service_principals: vec![principal],
        user_canister_wasm,
        group_index_canister_id: canister_ids.group_index,
        notifications_canister_ids: vec![canister_ids.notifications],
        online_users_aggregator_canister_id: canister_ids.online_users_aggregator,
        callback_canister_id: canister_ids.callback,
        open_storage_index_canister_id: canister_ids.open_storage_index,
        transaction_notifier_canister_id: canister_ids.transaction_notifier,
        ledger_canister_id: canister_ids.ledger,
        wasm_version: version,
        test_mode,
    };

    let group_index_canister_wasm = get_canister_wasm(CanisterName::GroupIndex, version, false);
    let group_canister_wasm = get_canister_wasm(CanisterName::Group, version, true);
    let group_index_init_args = group_index_canister::init::Args {
        service_principals: vec![principal],
        group_canister_wasm,
        notifications_canister_ids: vec![canister_ids.notifications],
        user_index_canister_id: canister_ids.user_index,
        callback_canister_id: canister_ids.callback,
        wasm_version: version,
        test_mode,
    };

    let notifications_canister_wasm = get_canister_wasm(CanisterName::Notifications, version, false);
    let notifications_init_args = notifications_canister::init::Args {
        push_service_principals: vec![principal],
        user_index_canister_id: canister_ids.user_index,
        wasm_version: version,
        test_mode,
    };

    let online_users_aggregator_canister_wasm = get_canister_wasm(CanisterName::OnlineUsersAggregator, version, false);
    let online_users_aggregator_init_args = online_users_aggregator_canister::init::Args {
        user_index_canister_id: canister_ids.user_index,
        wasm_version: version,
        test_mode,
    };

    let callback_canister_wasm = get_canister_wasm(CanisterName::Callback, version, false);
    let callback_init_args = callback_canister::init::Args {
        wasm_version: version,
        test_mode,
    };

    futures::future::join5(
        install_wasm(
            management_canister,
            &canister_ids.root,
            &root_canister_wasm.module,
            root_init_args,
        ),
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
            &canister_ids.notifications,
            &notifications_canister_wasm.module,
            notifications_init_args,
        ),
        install_wasm(
            management_canister,
            &canister_ids.online_users_aggregator,
            &online_users_aggregator_canister_wasm.module,
            online_users_aggregator_init_args,
        ),
    )
    .await;

    install_wasm(
        management_canister,
        &canister_ids.callback,
        &callback_canister_wasm.module,
        callback_init_args,
    )
    .await;

    println!("Canister wasms installed");
}
