use candid::CandidType;
use canister_agent_utils::{build_ic_agent, get_canister_wasm, CanisterName};
use ic_agent::identity::BasicIdentity;
use ic_utils::call::AsyncCall;
use ic_utils::interfaces::management_canister::builders::InstallMode;
use ic_utils::interfaces::management_canister::CanisterStatus;
use ic_utils::interfaces::ManagementCanister;
use types::{CanisterId, CanisterWasm, UpgradeCanisterWasmArgs, Version};

pub async fn upgrade_group_index_canister(
    identity: BasicIdentity,
    url: String,
    group_index_canister_id: CanisterId,
    version: Version,
) {
    upgrade_top_level_canister(
        identity,
        url,
        group_index_canister_id,
        version,
        group_index_canister::post_upgrade::Args { wasm_version: version },
        CanisterName::GroupIndex,
    )
    .await;

    println!("Group index canister upgraded");
}

pub async fn upgrade_user_index_canister(
    identity: BasicIdentity,
    url: String,
    user_index_canister_id: CanisterId,
    version: Version,
) {
    upgrade_top_level_canister(
        identity,
        url,
        user_index_canister_id,
        version,
        user_index_canister::post_upgrade::Args { wasm_version: version },
        CanisterName::UserIndex,
    )
    .await;

    println!("User index canister upgraded");
}

pub async fn upgrade_notifications_index_canister(
    identity: BasicIdentity,
    url: String,
    notifications_index_canister_id: CanisterId,
    version: Version,
) {
    upgrade_top_level_canister(
        identity,
        url,
        notifications_index_canister_id,
        version,
        notifications_index_canister::post_upgrade::Args { wasm_version: version },
        CanisterName::NotificationsIndex,
    )
    .await;

    println!("Notifications index canister upgraded");
}

pub async fn upgrade_online_users_canister(
    identity: BasicIdentity,
    url: String,
    online_users_canister_id: CanisterId,
    version: Version,
) {
    upgrade_top_level_canister(
        identity,
        url,
        online_users_canister_id,
        version,
        online_users_canister::post_upgrade::Args { wasm_version: version },
        CanisterName::OnlineUsers,
    )
    .await;

    println!("Online users canister upgraded");
}

pub async fn upgrade_proposals_bot_canister(
    identity: BasicIdentity,
    url: String,
    proposals_bot_canister_id: CanisterId,
    version: Version,
) {
    upgrade_top_level_canister(
        identity,
        url,
        proposals_bot_canister_id,
        version,
        proposals_bot_canister::post_upgrade::Args { wasm_version: version },
        CanisterName::ProposalsBot,
    )
    .await;

    println!("Proposals bot canister upgraded");
}

pub async fn upgrade_storage_index_canister(
    identity: BasicIdentity,
    url: String,
    storage_index_canister_id: CanisterId,
    version: Version,
) {
    upgrade_top_level_canister(
        identity,
        url,
        storage_index_canister_id,
        version,
        storage_index_canister::post_upgrade::Args { wasm_version: version },
        CanisterName::StorageIndex,
    )
    .await;

    println!("Storage index canister upgraded");
}

pub async fn upgrade_cycles_dispenser_canister(
    identity: BasicIdentity,
    url: String,
    cycles_dispenser_canister_id: CanisterId,
    version: Version,
) {
    upgrade_top_level_canister(
        identity,
        url,
        cycles_dispenser_canister_id,
        version,
        cycles_dispenser_canister::post_upgrade::Args { wasm_version: version },
        CanisterName::CyclesDispenser,
    )
    .await;

    println!("Cycles dispenser canister upgraded");
}

pub async fn upgrade_exchange_client_canister(
    identity: BasicIdentity,
    url: String,
    exchange_client_canister_id: CanisterId,
    version: Version,
) {
    upgrade_top_level_canister(
        identity,
        url,
        exchange_client_canister_id,
        version,
        exchange_client_canister::post_upgrade::Args { wasm_version: version },
        CanisterName::ExchangeClient,
    )
    .await;

    println!("Exchange client canister upgraded");
}

pub async fn upgrade_local_group_index_canister(
    identity: BasicIdentity,
    url: String,
    group_index_canister_id: CanisterId,
    version: Version,
) {
    let agent = build_ic_agent(url, identity).await;
    let canister_wasm = get_canister_wasm(CanisterName::LocalGroupIndex, version);
    let args = UpgradeCanisterWasmArgs {
        wasm: CanisterWasm {
            version,
            module: canister_wasm.module,
        },
        filter: None,
        use_for_new_canisters: None,
    };

    let response =
        group_index_canister_client::upgrade_local_group_index_canister_wasm(&agent, &group_index_canister_id, &args)
            .await
            .unwrap();

    if !matches!(
        response,
        group_index_canister::upgrade_local_group_index_canister_wasm::Response::Success
    ) {
        panic!("{response:?}");
    }
    println!("Local group index canister wasm upgraded to version {version}");
}

pub async fn upgrade_group_canister(
    identity: BasicIdentity,
    url: String,
    group_index_canister_id: CanisterId,
    version: Version,
) {
    let agent = build_ic_agent(url, identity).await;
    let canister_wasm = get_canister_wasm(CanisterName::Group, version);
    let args = UpgradeCanisterWasmArgs {
        wasm: CanisterWasm {
            version,
            module: canister_wasm.module,
        },
        filter: None,
        use_for_new_canisters: None,
    };

    let response = group_index_canister_client::upgrade_group_canister_wasm(&agent, &group_index_canister_id, &args)
        .await
        .unwrap();

    if !matches!(response, group_index_canister::upgrade_group_canister_wasm::Response::Success) {
        panic!("{response:?}");
    }
    println!("Group canister wasm upgraded to version {version}");
}

pub async fn upgrade_user_canister(identity: BasicIdentity, url: String, user_index_canister_id: CanisterId, version: Version) {
    let agent = build_ic_agent(url, identity).await;
    let canister_wasm = get_canister_wasm(CanisterName::User, version);
    let args = UpgradeCanisterWasmArgs {
        wasm: CanisterWasm {
            version,
            module: canister_wasm.module,
        },
        filter: None,
        use_for_new_canisters: None,
    };

    let response = user_index_canister_client::upgrade_user_canister_wasm(&agent, &user_index_canister_id, &args)
        .await
        .unwrap();

    if !matches!(response, user_index_canister::upgrade_user_canister_wasm::Response::Success) {
        panic!("{response:?}");
    }
    println!("User canister wasm upgraded to version {version}");
}

pub async fn upgrade_local_user_index_canister(
    identity: BasicIdentity,
    url: String,
    user_index_canister_id: CanisterId,
    version: Version,
) {
    let agent = build_ic_agent(url, identity).await;
    let canister_wasm = get_canister_wasm(CanisterName::LocalUserIndex, version);
    let args = UpgradeCanisterWasmArgs {
        wasm: CanisterWasm {
            version,
            module: canister_wasm.module,
        },
        filter: None,
        use_for_new_canisters: None,
    };

    let response = user_index_canister_client::upgrade_local_user_index_canister_wasm(&agent, &user_index_canister_id, &args)
        .await
        .unwrap();

    if !matches!(
        response,
        user_index_canister::upgrade_local_user_index_canister_wasm::Response::Success
    ) {
        panic!("{response:?}");
    }
    println!("Local user index canister wasm upgraded to version {version}");
}

pub async fn upgrade_notifications_canister(
    identity: BasicIdentity,
    url: String,
    notifications_index_canister_id: CanisterId,
    version: Version,
) {
    let agent = build_ic_agent(url, identity).await;
    let canister_wasm = get_canister_wasm(CanisterName::Notifications, version);
    let args = UpgradeCanisterWasmArgs {
        wasm: CanisterWasm {
            version,
            module: canister_wasm.module,
        },
        filter: None,
        use_for_new_canisters: None,
    };

    let response = notifications_index_canister_client::upgrade_notifications_canister_wasm(
        &agent,
        &notifications_index_canister_id,
        &args,
    )
    .await
    .unwrap();

    if !matches!(
        response,
        notifications_index_canister::upgrade_notifications_canister_wasm::Response::Success
    ) {
        panic!("{response:?}");
    }
    println!("Notifications canister wasm upgraded to version {version}");
}

pub async fn upgrade_storage_bucket_canister(
    identity: BasicIdentity,
    url: String,
    storage_index_canister_id: CanisterId,
    version: Version,
) {
    let agent = build_ic_agent(url, identity).await;
    let canister_wasm = get_canister_wasm(CanisterName::StorageBucket, version);
    let args = UpgradeCanisterWasmArgs {
        wasm: CanisterWasm {
            version,
            module: canister_wasm.module,
        },
        filter: None,
        use_for_new_canisters: None,
    };

    let response = storage_index_canister_client::upgrade_bucket_canister_wasm(&agent, &storage_index_canister_id, &args)
        .await
        .unwrap();

    if !matches!(
        response,
        storage_index_canister::upgrade_bucket_canister_wasm::Response::Success
    ) {
        panic!("{response:?}");
    }
    println!("Storage bucket canister wasm upgraded to version {version}");
}

async fn upgrade_top_level_canister<A: CandidType + Send + Sync>(
    identity: BasicIdentity,
    url: String,
    canister_id: CanisterId,
    version: Version,
    args: A,
    canister_name: CanisterName,
) {
    let agent = build_ic_agent(url, identity).await;
    let management_canister = ManagementCanister::create(&agent);
    let canister_wasm = get_canister_wasm(canister_name, version);

    upgrade_wasm(&management_canister, &canister_id, &canister_wasm.module, args).await;
}

async fn upgrade_wasm<A: CandidType + Send + Sync>(
    management_canister: &ManagementCanister<'_>,
    canister_id: &CanisterId,
    wasm_bytes: &[u8],
    args: A,
) {
    println!("Stopping canister {canister_id}");
    management_canister
        .stop_canister(canister_id)
        .call_and_wait()
        .await
        .expect("Failed to stop canister");

    loop {
        let (canister_status,) = management_canister
            .canister_status(canister_id)
            .call_and_wait()
            .await
            .expect("Failed to call 'canister_status'");

        if canister_status.status == CanisterStatus::Stopped {
            break;
        }
        println!("Waiting for canister to stop");
    }
    println!("Canister stopped");

    println!("Upgrading wasm for canister {canister_id}");
    match management_canister
        .install_code(canister_id, wasm_bytes)
        .with_mode(InstallMode::Upgrade)
        .with_arg(args)
        .call_and_wait()
        .await
    {
        Ok(_) => println!("Wasm upgraded"),
        Err(error) => println!("Upgrade failed: {error:?}"),
    };

    println!("Starting canister {canister_id}");
    management_canister
        .start_canister(canister_id)
        .call_and_wait()
        .await
        .expect("Failed to start canister");
    println!("Canister started");
}
