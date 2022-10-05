use crate::utils::{
    build_ic_agent, create_empty_canister, get_canister_wasm, get_open_storage_canister_wasm, install_wasm, set_controllers,
};
use crate::{CanisterIds, CanisterName, OpenStorageCanisterName, OpenStorageInitArgs};
use candid::Principal;
use ic_agent::identity::BasicIdentity;
use ic_agent::Identity;
use ic_utils::interfaces::ManagementCanister;
use types::{CanisterId, Version};

const NNS_GOVERNANCE_CANISTER_ID: CanisterId = Principal::from_slice(&[0, 0, 0, 0, 0, 0, 0, 1, 1, 1]);

pub async fn create_and_install_service_canisters(identity: BasicIdentity, url: String, test_mode: bool) -> CanisterIds {
    let principal = identity.sender().unwrap();
    let agent = build_ic_agent(url, identity).await;
    let management_canister = ManagementCanister::create(&agent);

    let (user_index_canister_id, group_index_canister_id, notifications_canister_id, online_users_aggregator_canister_id) =
        futures::future::join4(
            create_empty_canister(&management_canister),
            create_empty_canister(&management_canister),
            create_empty_canister(&management_canister),
            create_empty_canister(&management_canister),
        )
        .await;

    let (callback_canister_id, proposals_bot_canister_id, open_storage_index_canister_id, ledger_canister_id) =
        futures::future::join4(
            create_empty_canister(&management_canister),
            create_empty_canister(&management_canister),
            create_empty_canister(&management_canister),
            create_empty_canister(&management_canister),
        )
        .await;

    println!("user_index canister id: {user_index_canister_id}");
    println!("group_index canister id: {group_index_canister_id}");
    println!("notifications canister id: {notifications_canister_id}");
    println!("users_online_aggregator canister id: {online_users_aggregator_canister_id}");
    println!("callback canister id: {callback_canister_id}");
    println!("proposals_bot canister id: {proposals_bot_canister_id}");
    println!("open_storage_index canister id: {open_storage_index_canister_id}");
    println!("ledger canister id: {ledger_canister_id}");

    let canister_ids = CanisterIds {
        user_index: user_index_canister_id,
        group_index: group_index_canister_id,
        notifications: notifications_canister_id,
        online_users_aggregator: online_users_aggregator_canister_id,
        callback: callback_canister_id,
        proposals_bot: proposals_bot_canister_id,
        open_storage_index: open_storage_index_canister_id,
        ledger: ledger_canister_id,
    };

    install_service_canisters_impl(principal, &canister_ids, &management_canister, test_mode).await;

    canister_ids
}

pub async fn install_service_canisters(identity: BasicIdentity, url: String, canister_ids: CanisterIds, test_mode: bool) {
    let principal = identity.sender().unwrap();
    let agent = build_ic_agent(url, identity).await;
    let management_canister = ManagementCanister::create(&agent);

    install_service_canisters_impl(principal, &canister_ids, &management_canister, test_mode).await;
}

async fn install_service_canisters_impl(
    principal: Principal,
    canister_ids: &CanisterIds,
    management_canister: &ManagementCanister<'_>,
    test_mode: bool,
) {
    let controllers = vec![principal];
    futures::future::join_all(vec![
        set_controllers(management_canister, &canister_ids.user_index, controllers.clone()),
        set_controllers(management_canister, &canister_ids.group_index, controllers.clone()),
        set_controllers(management_canister, &canister_ids.notifications, controllers.clone()),
        set_controllers(
            management_canister,
            &canister_ids.online_users_aggregator,
            controllers.clone(),
        ),
        set_controllers(management_canister, &canister_ids.callback, controllers.clone()),
        set_controllers(management_canister, &canister_ids.proposals_bot, controllers.clone()),
        set_controllers(management_canister, &canister_ids.open_storage_index, controllers),
    ])
    .await;

    let version = Version::min();

    let user_index_canister_wasm = get_canister_wasm(CanisterName::UserIndex, version);
    let user_canister_wasm = get_canister_wasm(CanisterName::User, Version::min());
    let user_index_init_args = user_index_canister::init::Args {
        service_principals: vec![principal],
        sms_service_principals: vec![principal],
        user_canister_wasm,
        group_index_canister_id: canister_ids.group_index,
        notifications_canister_ids: vec![canister_ids.notifications],
        online_users_aggregator_canister_id: canister_ids.online_users_aggregator,
        callback_canister_id: canister_ids.callback,
        open_storage_index_canister_id: canister_ids.open_storage_index,
        ledger_canister_id: canister_ids.ledger,
        proposals_bot_user_id: canister_ids.proposals_bot.into(),
        wasm_version: version,
        test_mode,
    };

    let group_index_canister_wasm = get_canister_wasm(CanisterName::GroupIndex, version);
    let group_canister_wasm = get_canister_wasm(CanisterName::Group, version);
    let group_index_init_args = group_index_canister::init::Args {
        service_principals: vec![principal],
        group_canister_wasm,
        notifications_canister_ids: vec![canister_ids.notifications],
        user_index_canister_id: canister_ids.user_index,
        callback_canister_id: canister_ids.callback,
        wasm_version: version,
        test_mode,
    };

    let notifications_canister_wasm = get_canister_wasm(CanisterName::Notifications, version);
    let notifications_init_args = notifications_canister::init::Args {
        push_service_principals: vec![principal],
        user_index_canister_id: canister_ids.user_index,
        wasm_version: version,
        test_mode,
    };

    let online_users_aggregator_canister_wasm = get_canister_wasm(CanisterName::OnlineUsersAggregator, version);
    let online_users_aggregator_init_args = online_users_aggregator_canister::init::Args {
        user_index_canister_id: canister_ids.user_index,
        wasm_version: version,
        test_mode,
    };

    let callback_canister_wasm = get_canister_wasm(CanisterName::Callback, version);
    let callback_init_args = callback_canister::init::Args {
        wasm_version: version,
        test_mode,
    };

    let proposals_bot_canister_wasm = get_canister_wasm(CanisterName::ProposalsBot, version);
    let proposals_bot_init_args = proposals_bot_canister::init::Args {
        service_owner_principals: vec![principal],
        user_index_canister_id: canister_ids.user_index,
        group_index_canister_id: canister_ids.group_index,
        nns_governance_canister_id: NNS_GOVERNANCE_CANISTER_ID,
        wasm_version: version,
        test_mode,
    };

    let open_storage_index_canister_wasm = get_open_storage_canister_wasm(OpenStorageCanisterName::Index, version);
    let open_storage_index_init_args = OpenStorageInitArgs {
        service_principals: vec![principal, canister_ids.user_index, canister_ids.group_index],
        bucket_canister_wasm: get_open_storage_canister_wasm(OpenStorageCanisterName::Bucket, version),
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
        install_wasm(
            management_canister,
            &canister_ids.callback,
            &callback_canister_wasm.module,
            callback_init_args,
        ),
    )
    .await;

    futures::future::join(
        install_wasm(
            management_canister,
            &canister_ids.proposals_bot,
            &proposals_bot_canister_wasm.module,
            proposals_bot_init_args,
        ),
        install_wasm(
            management_canister,
            &canister_ids.open_storage_index,
            &open_storage_index_canister_wasm.module,
            open_storage_index_init_args,
        ),
    )
    .await;

    println!("Canister wasms installed");
}
