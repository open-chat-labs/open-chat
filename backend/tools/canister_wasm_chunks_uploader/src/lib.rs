use canister_agent_utils::{build_ic_agent, get_canister_wasm, CanisterName};
use ic_agent::Identity;
use types::{BuildVersion, CanisterId};

pub async fn upload_user_index_canister_wasm(
    identity: Box<dyn Identity>,
    url: String,
    openchat_installer: CanisterId,
    version: BuildVersion,
) {
    upload_wasm_to_openchat_installer(identity, url, openchat_installer, version, CanisterName::UserIndex).await;
}

pub async fn upload_group_index_canister_wasm(
    identity: Box<dyn Identity>,
    url: String,
    openchat_installer: CanisterId,
    version: BuildVersion,
) {
    upload_wasm_to_openchat_installer(identity, url, openchat_installer, version, CanisterName::GroupIndex).await;
}

pub async fn upload_notifications_index_canister_wasm(
    identity: Box<dyn Identity>,
    url: String,
    openchat_installer: CanisterId,
    version: BuildVersion,
) {
    upload_wasm_to_openchat_installer(identity, url, openchat_installer, version, CanisterName::NotificationsIndex).await;
}

pub async fn upload_local_user_index_canister_wasm(
    identity: Box<dyn Identity>,
    url: String,
    user_index_canister_id: CanisterId,
    version: BuildVersion,
) {
    let agent = build_ic_agent(url, identity).await;
    let canister_wasm = get_canister_wasm(CanisterName::LocalUserIndex, version);

    user_index_canister_client::upload_wasm_in_chunks(
        &agent,
        &user_index_canister_id,
        &canister_wasm.module,
        user_index_canister::ChildCanisterType::LocalUserIndex,
    )
    .await
    .unwrap();
}

pub async fn upload_local_group_index_canister_wasm(
    identity: Box<dyn Identity>,
    url: String,
    group_index_canister_id: CanisterId,
    version: BuildVersion,
) {
    let agent = build_ic_agent(url, identity).await;
    let canister_wasm = get_canister_wasm(CanisterName::LocalGroupIndex, version);

    group_index_canister_client::upload_wasm_in_chunks(
        &agent,
        &group_index_canister_id,
        &canister_wasm.module,
        group_index_canister::ChildCanisterType::LocalGroupIndex,
    )
    .await
    .unwrap();
}

pub async fn upload_user_canister_wasm(
    identity: Box<dyn Identity>,
    url: String,
    user_index_canister_id: CanisterId,
    version: BuildVersion,
) {
    let agent = build_ic_agent(url, identity).await;
    let canister_wasm = get_canister_wasm(CanisterName::User, version);

    user_index_canister_client::upload_wasm_in_chunks(
        &agent,
        &user_index_canister_id,
        &canister_wasm.module,
        user_index_canister::ChildCanisterType::User,
    )
    .await
    .unwrap();
}

pub async fn upload_group_canister_wasm(
    identity: Box<dyn Identity>,
    url: String,
    group_index_canister_id: CanisterId,
    version: BuildVersion,
) {
    let agent = build_ic_agent(url, identity).await;
    let canister_wasm = get_canister_wasm(CanisterName::Group, version);

    group_index_canister_client::upload_wasm_in_chunks(
        &agent,
        &group_index_canister_id,
        &canister_wasm.module,
        group_index_canister::ChildCanisterType::Group,
    )
    .await
    .unwrap();
}

pub async fn upload_community_canister_wasm(
    identity: Box<dyn Identity>,
    url: String,
    group_index_canister_id: CanisterId,
    version: BuildVersion,
) {
    let agent = build_ic_agent(url, identity).await;
    let canister_wasm = get_canister_wasm(CanisterName::Community, version);

    group_index_canister_client::upload_wasm_in_chunks(
        &agent,
        &group_index_canister_id,
        &canister_wasm.module,
        group_index_canister::ChildCanisterType::Community,
    )
    .await
    .unwrap();
}

async fn upload_wasm_to_openchat_installer(
    identity: Box<dyn Identity>,
    url: String,
    openchat_installer: CanisterId,
    version: BuildVersion,
    canister_name: CanisterName,
) {
    let agent = build_ic_agent(url, identity).await;
    let canister_wasm = get_canister_wasm(&canister_name, version);

    let canister_type = match canister_name {
        CanisterName::UserIndex => openchat_installer_canister::CanisterType::UserIndex,
        CanisterName::GroupIndex => openchat_installer_canister::CanisterType::GroupIndex,
        CanisterName::NotificationsIndex => openchat_installer_canister::CanisterType::NotificationsIndex,
        _ => unreachable!(),
    };

    openchat_installer_canister_client::upload_wasm_in_chunks(
        &agent,
        &openchat_installer,
        &canister_wasm.module,
        canister_type,
    )
    .await
    .unwrap();
}
