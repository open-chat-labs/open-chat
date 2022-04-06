use crate::utils::{build_ic_agent, build_management_canister, delay, get_canister_wasm};
use crate::CanisterName;
use candid::CandidType;
use ic_agent::identity::BasicIdentity;
use ic_utils::call::AsyncCall;
use ic_utils::interfaces::management_canister::builders::InstallMode;
use ic_utils::interfaces::ManagementCanister;
use ic_utils::Canister;
use types::{CanisterId, CanisterWasm, Version};

pub async fn upgrade_root_canister(identity: BasicIdentity, url: String, root_canister_id: CanisterId, version: Version) {
    upgrade_top_level_canister(
        identity,
        url,
        root_canister_id,
        version,
        root_canister::post_upgrade::Args { wasm_version: version },
        CanisterName::Root,
    )
    .await;
    println!("Root canister upgraded");
}

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

pub async fn upgrade_user_index_canister(identity: BasicIdentity, url: String, root_canister_id: CanisterId, version: Version) {
    let agent = build_ic_agent(url, identity).await;
    let user_index_canister_wasm = get_canister_wasm(CanisterName::UserIndex, version, true);
    let args = root_canister::upgrade_user_index_canister::Args {
        user_index_canister_wasm,
    };
    root_canister_client::upgrade_user_index_canister(&agent, &root_canister_id, &args)
        .await
        .unwrap_or_else(|e| panic!("Failed to upgrade user_index canister. Error: {e:?}"));
    println!("User index canister upgraded");
}

pub async fn upgrade_notifications_canister(
    identity: BasicIdentity,
    url: String,
    notifications_canister_id: CanisterId,
    version: Version,
) {
    upgrade_top_level_canister(
        identity,
        url,
        notifications_canister_id,
        version,
        notifications_canister::post_upgrade::Args { wasm_version: version },
        CanisterName::Notifications,
    )
    .await;
    println!("Notifications canister upgraded");
}

pub async fn upgrade_online_users_aggregator_canister(
    identity: BasicIdentity,
    url: String,
    online_users_aggregator_canister_id: CanisterId,
    version: Version,
) {
    upgrade_top_level_canister(
        identity,
        url,
        online_users_aggregator_canister_id,
        version,
        online_users_aggregator_canister::post_upgrade::Args { wasm_version: version },
        CanisterName::OnlineUsersAggregator,
    )
    .await;

    println!("Online users aggregator canister upgraded");
}

pub async fn upgrade_callback_canister(
    identity: BasicIdentity,
    url: String,
    callback_canister_id: CanisterId,
    version: Version,
) {
    upgrade_top_level_canister(
        identity,
        url,
        callback_canister_id,
        version,
        callback_canister::post_upgrade::Args { wasm_version: version },
        CanisterName::Callback,
    )
    .await;

    println!("Callback canister upgraded");
}

pub async fn upgrade_ledger_sync_canister(
    identity: BasicIdentity,
    url: String,
    ledger_sync_canister_id: CanisterId,
    version: Version,
) {
    upgrade_top_level_canister(
        identity,
        url,
        ledger_sync_canister_id,
        version,
        ledger_sync_canister::post_upgrade::Args { wasm_version: version },
        CanisterName::LedgerSync,
    )
    .await;

    println!("Ledger sync canister upgraded");
}

pub async fn upgrade_group_canister(
    identity: BasicIdentity,
    url: String,
    group_index_canister_id: CanisterId,
    version: Version,
) {
    let agent = build_ic_agent(url, identity).await;
    let canister_wasm = get_canister_wasm(CanisterName::Group, version, true);
    let args = group_index_canister::upgrade_group_canister_wasm::Args {
        group_canister_wasm: CanisterWasm {
            version,
            compressed: canister_wasm.compressed,
            module: canister_wasm.module,
        },
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
    let canister_wasm = get_canister_wasm(CanisterName::User, version, true);
    let args = user_index_canister::upgrade_user_canister_wasm::Args {
        user_canister_wasm: CanisterWasm {
            version,
            compressed: canister_wasm.compressed,
            module: canister_wasm.module,
        },
    };

    let response = user_index_canister_client::upgrade_user_canister_wasm(&agent, &user_index_canister_id, &args)
        .await
        .unwrap();

    if !matches!(response, user_index_canister::upgrade_user_canister_wasm::Response::Success) {
        panic!("{response:?}");
    }
    println!("User canister wasm upgraded to version {version}");
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
    let management_canister = build_management_canister(&agent);
    let canister_wasm = get_canister_wasm(canister_name, version, false);

    upgrade_wasm(&management_canister, &canister_id, &canister_wasm.module, args).await;
}

async fn upgrade_wasm<A: CandidType + Send + Sync>(
    management_canister: &Canister<'_, ManagementCanister>,
    canister_id: &CanisterId,
    wasm_bytes: &[u8],
    args: A,
) {
    println!("Stopping canister {canister_id}");
    management_canister
        .stop_canister(canister_id)
        .call_and_wait(delay())
        .await
        .expect("Failed to stop canister");
    println!("Canister stopped");

    println!("Upgrading wasm for canister {}", canister_id);
    match management_canister
        .install_code(canister_id, wasm_bytes)
        .with_mode(InstallMode::Upgrade)
        .with_arg(args)
        .call_and_wait(delay())
        .await
    {
        Ok(_) => println!("Wasm upgraded"),
        Err(error) => println!("Upgrade failed: {error:?}"),
    };

    println!("Starting canister {}", canister_id);
    management_canister
        .start_canister(canister_id)
        .call_and_wait(delay())
        .await
        .expect("Failed to start canister");
    println!("Canister started");
}
