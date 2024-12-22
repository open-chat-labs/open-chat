use candid::CandidType;
use canister_agent_utils::{build_ic_agent, get_canister_wasm, CanisterName};
use ic_agent::Identity;
use ic_utils::call::AsyncCall;
use ic_utils::interfaces::management_canister::builders::InstallMode;
use ic_utils::interfaces::management_canister::CanisterStatus;
use ic_utils::interfaces::ManagementCanister;
use sha256::sha256;
use types::{BuildVersion, CanisterId, CanisterWasm, UpgradeCanisterWasmArgs, UpgradeChunkedCanisterWasmArgs};

pub async fn upgrade_group_index_canister(
    identity: Box<dyn Identity>,
    url: String,
    group_index_canister_id: CanisterId,
    version: BuildVersion,
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
    identity: Box<dyn Identity>,
    url: String,
    user_index_canister_id: CanisterId,
    version: BuildVersion,
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
    identity: Box<dyn Identity>,
    url: String,
    notifications_index_canister_id: CanisterId,
    version: BuildVersion,
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

pub async fn upgrade_identity_canister(
    identity: Box<dyn Identity>,
    url: String,
    identity_canister_id: CanisterId,
    version: BuildVersion,
) {
    upgrade_top_level_canister(
        identity,
        url,
        identity_canister_id,
        version,
        identity_canister::post_upgrade::Args { wasm_version: version },
        CanisterName::Identity,
    )
    .await;

    println!("Identity canister upgraded");
}

pub async fn upgrade_translations_canister(
    identity: Box<dyn Identity>,
    url: String,
    translations_canister_id: CanisterId,
    version: BuildVersion,
) {
    upgrade_top_level_canister(
        identity,
        url,
        translations_canister_id,
        version,
        translations_canister::post_upgrade::Args { wasm_version: version },
        CanisterName::Translations,
    )
    .await;

    println!("Translations canister upgraded");
}

pub async fn upgrade_online_users_canister(
    identity: Box<dyn Identity>,
    url: String,
    online_users_canister_id: CanisterId,
    version: BuildVersion,
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
    identity: Box<dyn Identity>,
    url: String,
    proposals_bot_canister_id: CanisterId,
    version: BuildVersion,
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

pub async fn upgrade_airdrop_bot_canister(
    identity: Box<dyn Identity>,
    url: String,
    airdrop_bot_canister_id: CanisterId,
    version: BuildVersion,
) {
    upgrade_top_level_canister(
        identity,
        url,
        airdrop_bot_canister_id,
        version,
        airdrop_bot_canister::post_upgrade::Args { wasm_version: version },
        CanisterName::AirdropBot,
    )
    .await;

    println!("Airdrop bot canister upgraded");
}

pub async fn upgrade_greet_bot_canister(_identity: Box<dyn Identity>, _url: String, _greet_bot_canister_id: CanisterId) {
    // TODO
    // upgrade_top_level_canister(
    //     identity,
    //     url,
    //     greet_bot_canister_id,
    //     version,
    //     greet_bot_canister_impl::init::InitOrUpgradeArgs {  },
    //     CanisterName::AirdropBot,
    // )
    // .await;

    println!("Greet bot canister upgraded");
}

pub async fn upgrade_storage_index_canister(
    identity: Box<dyn Identity>,
    url: String,
    storage_index_canister_id: CanisterId,
    version: BuildVersion,
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
    identity: Box<dyn Identity>,
    url: String,
    cycles_dispenser_canister_id: CanisterId,
    version: BuildVersion,
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

pub async fn upgrade_registry_canister(
    identity: Box<dyn Identity>,
    url: String,
    registry_canister_id: CanisterId,
    version: BuildVersion,
) {
    upgrade_top_level_canister(
        identity,
        url,
        registry_canister_id,
        version,
        registry_canister::post_upgrade::Args { wasm_version: version },
        CanisterName::Registry,
    )
    .await;

    println!("Registry canister upgraded");
}

pub async fn upgrade_market_maker_canister(
    identity: Box<dyn Identity>,
    url: String,
    market_maker_canister_id: CanisterId,
    version: BuildVersion,
) {
    upgrade_top_level_canister(
        identity,
        url,
        market_maker_canister_id,
        version,
        market_maker_canister::post_upgrade::Args { wasm_version: version },
        CanisterName::MarketMaker,
    )
    .await;

    println!("Market maker canister upgraded");
}

pub async fn upgrade_neuron_controller_canister(
    identity: Box<dyn Identity>,
    url: String,
    neuron_controller_canister_id: CanisterId,
    version: BuildVersion,
) {
    upgrade_top_level_canister(
        identity,
        url,
        neuron_controller_canister_id,
        version,
        neuron_controller_canister::post_upgrade::Args { wasm_version: version },
        CanisterName::NeuronController,
    )
    .await;

    println!("Neuron controller canister upgraded");
}

pub async fn upgrade_escrow_canister(
    identity: Box<dyn Identity>,
    url: String,
    escrow_canister_id: CanisterId,
    version: BuildVersion,
) {
    upgrade_top_level_canister(
        identity,
        url,
        escrow_canister_id,
        version,
        escrow_canister::post_upgrade::Args { wasm_version: version },
        CanisterName::Escrow,
    )
    .await;

    println!("Escrow canister upgraded");
}

pub async fn upgrade_event_relay_canister(
    identity: Box<dyn Identity>,
    url: String,
    event_relay_canister_id: CanisterId,
    version: BuildVersion,
) {
    upgrade_top_level_canister(
        identity,
        url,
        event_relay_canister_id,
        version,
        event_relay_canister::post_upgrade::Args { wasm_version: version },
        CanisterName::EventRelay,
    )
    .await;

    println!("Event relay canister upgraded");
}

pub async fn upgrade_event_store_canister(
    identity: Box<dyn Identity>,
    url: String,
    event_store_canister_id: CanisterId,
    version: BuildVersion,
) {
    upgrade_top_level_canister(identity, url, event_store_canister_id, version, (), CanisterName::EventStore).await;

    println!("Event store canister upgraded");
}

pub async fn upgrade_local_group_index_canister(
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

    let args = UpgradeChunkedCanisterWasmArgs {
        version,
        wasm_hash: sha256(&canister_wasm.module),
        filter: None,
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

    let args = UpgradeChunkedCanisterWasmArgs {
        version,
        wasm_hash: sha256(&canister_wasm.module),
        filter: None,
    };

    let response = group_index_canister_client::upgrade_group_canister_wasm(&agent, &group_index_canister_id, &args)
        .await
        .unwrap();

    if !matches!(response, group_index_canister::upgrade_group_canister_wasm::Response::Success) {
        panic!("{response:?}");
    }
    println!("Group canister wasm upgraded to version {version}");
}

pub async fn upgrade_community_canister(
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

    let args = UpgradeChunkedCanisterWasmArgs {
        version,
        wasm_hash: sha256(&canister_wasm.module),
        filter: None,
    };

    let response = group_index_canister_client::upgrade_community_canister_wasm(&agent, &group_index_canister_id, &args)
        .await
        .unwrap();

    if !matches!(
        response,
        group_index_canister::upgrade_community_canister_wasm::Response::Success
    ) {
        panic!("{response:?}");
    }
    println!("Community canister wasm upgraded to version {version}");
}

pub async fn upgrade_user_canister(
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

    let args = UpgradeChunkedCanisterWasmArgs {
        version,
        wasm_hash: sha256(&canister_wasm.module),
        filter: None,
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

    let args = UpgradeChunkedCanisterWasmArgs {
        version,
        wasm_hash: sha256(&canister_wasm.module),
        filter: None,
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
    identity: Box<dyn Identity>,
    url: String,
    notifications_index_canister_id: CanisterId,
    version: BuildVersion,
) {
    let agent = build_ic_agent(url, identity).await;
    let canister_wasm = get_canister_wasm(CanisterName::Notifications, version);
    let args = UpgradeCanisterWasmArgs {
        wasm: CanisterWasm {
            version,
            module: canister_wasm.module,
        },
        filter: None,
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
    identity: Box<dyn Identity>,
    url: String,
    storage_index_canister_id: CanisterId,
    version: BuildVersion,
) {
    let agent = build_ic_agent(url, identity).await;
    let canister_wasm = get_canister_wasm(CanisterName::StorageBucket, version);
    let args = UpgradeCanisterWasmArgs {
        wasm: CanisterWasm {
            version,
            module: canister_wasm.module,
        },
        filter: None,
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

pub async fn upgrade_sign_in_with_email_canister(
    identity: Box<dyn Identity>,
    url: String,
    sign_in_with_email_canister_id: CanisterId,
    version: BuildVersion,
) {
    upgrade_top_level_canister(
        identity,
        url,
        sign_in_with_email_canister_id,
        version,
        sign_in_with_email_canister::InitOrUpgradeArgs::Upgrade(sign_in_with_email_canister::UpgradeArgs {
            email_sender_public_key_pem: None,
            email_sender_config: None,
        }),
        CanisterName::SignInWithEmail,
    )
    .await;

    println!("sign_in_with_email_canister upgraded");
}

async fn upgrade_top_level_canister<A: CandidType + Send + Sync>(
    identity: Box<dyn Identity>,
    url: String,
    canister_id: CanisterId,
    version: BuildVersion,
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
        .with_mode(InstallMode::Upgrade(None))
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
