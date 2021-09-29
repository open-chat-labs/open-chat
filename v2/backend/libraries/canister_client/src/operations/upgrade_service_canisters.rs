use crate::utils::{build_ic_agent, build_management_canister, delay, get_canister_wasm};
use crate::CanisterName;
use ic_agent::identity::BasicIdentity;
use ic_utils::interfaces::management_canister::builders::InstallMode;
use ic_utils::interfaces::ManagementCanister;
use ic_utils::Canister;
use types::{CanisterId, CanisterWasm, Version};

pub async fn upgrade_group_index_canister(identity: BasicIdentity, url: String, group_index_canister_id: CanisterId) {
    upgrade_root_canister(identity, url, group_index_canister_id, CanisterName::GroupIndex).await;
    println!("Group index canister upgraded");
}

pub async fn upgrade_user_index_canister(identity: BasicIdentity, url: String, user_index_canister_id: CanisterId) {
    upgrade_root_canister(identity, url, user_index_canister_id, CanisterName::UserIndex).await;
    println!("User index canister upgraded");
}

pub async fn upgrade_notifications_canister(identity: BasicIdentity, url: String, notifications_canister_id: CanisterId) {
    upgrade_root_canister(identity, url, notifications_canister_id, CanisterName::Notifications).await;
    println!("Notifications canister upgraded");
}

pub async fn upgrade_group_canister(
    identity: BasicIdentity,
    url: String,
    group_index_canister_id: CanisterId,
    version: Version,
) {
    let agent = build_ic_agent(url, identity).await;
    let canister_wasm = get_canister_wasm(CanisterName::Group);
    let args = group_index_canister::update_group_canister_wasm::Args {
        group_canister_wasm: CanisterWasm {
            module: canister_wasm.module,
            version,
        },
    };

    let response = group_index_canister_client::update_group_canister_wasm(&agent, &group_index_canister_id, &args).await;
    if !matches!(response, group_index_canister::update_group_canister_wasm::Response::Success) {
        panic!("{:?}", response);
    }
    println!("Group canister wasm upgraded to version {}", version);
}

pub async fn upgrade_user_canister(identity: BasicIdentity, url: String, user_index_canister_id: CanisterId, version: Version) {
    let agent = build_ic_agent(url, identity).await;
    let canister_wasm = get_canister_wasm(CanisterName::User);
    let args = user_index_canister::update_user_canister_wasm::Args {
        user_canister_wasm: CanisterWasm {
            module: canister_wasm.module,
            version,
        },
    };

    let response = user_index_canister_client::update_user_canister_wasm(&agent, &user_index_canister_id, &args).await;
    if !matches!(response, user_index_canister::update_user_canister_wasm::Response::Success) {
        panic!("{:?}", response);
    }
    println!("User canister wasm upgraded to version {}", version);
}

async fn upgrade_root_canister(identity: BasicIdentity, url: String, canister_id: CanisterId, canister_name: CanisterName) {
    let agent = build_ic_agent(url, identity).await;
    let management_canister = build_management_canister(&agent);
    let canister_wasm = get_canister_wasm(canister_name);

    upgrade_wasm(&management_canister, &canister_id, &canister_wasm.module).await;
}

async fn upgrade_wasm(management_canister: &Canister<'_, ManagementCanister>, canister_id: &CanisterId, wasm_bytes: &[u8]) {
    management_canister
        .install_code(canister_id, wasm_bytes)
        .with_mode(InstallMode::Upgrade)
        .call_and_wait(delay())
        .await
        .expect("Failed to upgrade wasm");
}
