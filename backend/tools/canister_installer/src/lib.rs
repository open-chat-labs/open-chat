use candid::{Encode, Principal};
use canister_agent_utils::{CanisterIds, CanisterName, build_ic_agent, get_canister_wasm, install_wasm, set_controllers};
use constants::{CHAT_LEDGER_CANISTER_ID, SNS_GOVERNANCE_CANISTER_ID};
use ic_agent::{Agent, Identity};
use ic_utils::interfaces::ManagementCanister;
use identity_canister::WEBAUTHN_ORIGINATING_CANISTER;
use sha256::sha256;
use types::{BuildVersion, Cycles};

const T: Cycles = 1_000_000_000_000;

pub async fn install_service_canisters(identity: Box<dyn Identity>, url: String, canister_ids: CanisterIds, test_mode: bool) {
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
    let video_call_operators =
        vec![Principal::from_text("wp3oc-ig6b4-6xvef-yoj27-qt3kw-u2xmp-qbvuv-2grco-s2ndy-wv3ud-7qe").unwrap()];

    futures::future::join_all(vec![
        set_controllers(management_canister, &canister_ids.openchat_installer, controllers.clone()),
        set_controllers(
            management_canister,
            &canister_ids.user_index,
            vec![canister_ids.openchat_installer],
        ),
        set_controllers(
            management_canister,
            &canister_ids.group_index,
            vec![canister_ids.openchat_installer],
        ),
        set_controllers(
            management_canister,
            &canister_ids.notifications_index,
            vec![canister_ids.openchat_installer],
        ),
        set_controllers(
            management_canister,
            &canister_ids.local_user_index,
            vec![canister_ids.registry],
        ),
    ])
    .await;

    let version = BuildVersion::min();

    let openchat_installer_canister_wasm = get_canister_wasm(CanisterName::OpenChatInstaller, version);
    let openchat_installer_init_args = openchat_installer_canister::init::Args {
        governance_principals: vec![principal],
        upload_wasm_chunks_whitelist: Vec::new(),
        user_index_canister_id: canister_ids.user_index,
        group_index_canister_id: canister_ids.group_index,
        notifications_index_canister_id: canister_ids.notifications_index,
        identity_canister_id: canister_ids.identity,
        proposals_bot_canister_id: canister_ids.proposals_bot,
        airdrop_bot_canister_id: canister_ids.airdrop_bot,
        online_users_canister_id: canister_ids.online_users,
        cycles_dispenser_canister_id: canister_ids.cycles_dispenser,
        storage_index_canister_id: canister_ids.storage_index,
        escrow_canister_id: canister_ids.escrow,
        event_relay_canister_id: canister_ids.event_relay,
        registry_canister_id: canister_ids.registry,
        translations_canister_id: canister_ids.translations,
        website_canister_id: canister_ids.website,
        nns_governance_canister_id: canister_ids.nns_governance,
        internet_identity_canister_id: canister_ids.nns_internet_identity,
        ic_root_key: agent.read_root_key(),
        wasm_version: version,
        test_mode,
    };

    install_wasm(
        management_canister,
        &canister_ids.openchat_installer,
        &openchat_installer_canister_wasm.module,
        Encode!(&openchat_installer_init_args).unwrap(),
    )
    .await;

    let user_index_canister_wasm = get_canister_wasm(CanisterName::UserIndex, version);
    let group_index_canister_wasm = get_canister_wasm(CanisterName::GroupIndex, version);
    let notifications_index_canister_wasm = get_canister_wasm(CanisterName::NotificationsIndex, version);

    futures::future::try_join_all([
        openchat_installer_canister_client::upload_wasm_in_chunks(
            agent,
            &canister_ids.openchat_installer,
            &user_index_canister_wasm.module,
            openchat_installer_canister::CanisterType::UserIndex,
        ),
        openchat_installer_canister_client::upload_wasm_in_chunks(
            agent,
            &canister_ids.openchat_installer,
            &group_index_canister_wasm.module,
            openchat_installer_canister::CanisterType::GroupIndex,
        ),
        openchat_installer_canister_client::upload_wasm_in_chunks(
            agent,
            &canister_ids.openchat_installer,
            &notifications_index_canister_wasm.module,
            openchat_installer_canister::CanisterType::NotificationsIndex,
        ),
    ])
    .await
    .unwrap();

    openchat_installer_canister_client::install_canisters(
        agent,
        &canister_ids.openchat_installer,
        &openchat_installer_canister::install_canisters::Args {
            user_index_wasm_hash: sha256(&user_index_canister_wasm.module),
            group_index_wasm_hash: sha256(&group_index_canister_wasm.module),
            notifications_index_wasm_hash: sha256(&notifications_index_canister_wasm.module),
            video_call_operators: video_call_operators.clone(),
            push_service_principals: vec![principal],
            wasm_version: version,
        },
    )
    .await
    .unwrap();

    let identity_canister_wasm = get_canister_wasm(CanisterName::Identity, version);
    let identity_init_args = identity_canister::init::Args {
        governance_principals: vec![principal],
        user_index_canister_id: canister_ids.user_index,
        cycles_dispenser_canister_id: canister_ids.cycles_dispenser,
        originating_canisters: vec![
            canister_ids.nns_internet_identity,
            canister_ids.sign_in_with_email,
            canister_ids.sign_in_with_ethereum,
            canister_ids.sign_in_with_solana,
            WEBAUTHN_ORIGINATING_CANISTER,
        ],
        skip_captcha_whitelist: vec![
            canister_ids.nns_internet_identity,
            canister_ids.sign_in_with_email,
            WEBAUTHN_ORIGINATING_CANISTER,
        ],
        ic_root_key: agent.read_root_key(),
        wasm_version: version,
        test_mode,
    };

    let translations_canister_wasm = get_canister_wasm(CanisterName::Translations, version);
    let translations_init_args = translations_canister::init::Args {
        deployment_operators: vec![principal],
        user_index_canister_id: canister_ids.user_index,
        cycles_dispenser_canister_id: canister_ids.cycles_dispenser,
        wasm_version: version,
        test_mode,
    };

    let online_users_canister_wasm = get_canister_wasm(CanisterName::OnlineUsers, version);
    let online_users_init_args = online_users_canister::init::Args {
        user_index_canister_id: canister_ids.user_index,
        airdrop_bot_canister_id: canister_ids.airdrop_bot,
        event_relay_canister_id: canister_ids.event_relay,
        cycles_dispenser_canister_id: canister_ids.cycles_dispenser,
        sync_online_minutes_to_airdrop_bot_increment: 60,
        wasm_version: version,
        test_mode,
    };

    let proposals_bot_canister_wasm = get_canister_wasm(CanisterName::ProposalsBot, version);
    let proposals_bot_init_args = proposals_bot_canister::init::Args {
        service_owner_principals: vec![principal],
        user_index_canister_id: canister_ids.user_index,
        group_index_canister_id: canister_ids.group_index,
        registry_canister_id: canister_ids.registry,
        nns_governance_canister_id: canister_ids.nns_governance,
        sns_wasm_canister_id: canister_ids.nns_sns_wasm,
        cycles_dispenser_canister_id: canister_ids.cycles_dispenser,
        wasm_version: version,
        test_mode,
    };

    let airdrop_bot_canister_wasm = get_canister_wasm(CanisterName::AirdropBot, version);
    let airdrop_bot_init_args = airdrop_bot_canister::init::Args {
        admins: vec![principal],
        user_index_canister_id: canister_ids.user_index,
        local_user_index_canister_id: canister_ids.local_user_index,
        online_users_canister_id: canister_ids.online_users,
        chat_ledger_canister_id: CHAT_LEDGER_CANISTER_ID,
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
            canister_ids.online_users,
            canister_ids.proposals_bot,
            canister_ids.storage_index,
        ],
        registry_canister_id: canister_ids.registry,
        max_top_up_amount: 20 * T,
        min_interval: 5 * 60 * 1000, // 5 minutes
        min_cycles_balance: 200 * T,
        icp_burn_amount_e8s: 1_000_000_000, // 10 ICP
        ledger_canister: canister_ids.nns_ledger,
        cycles_minting_canister: canister_ids.nns_cmc,
        wasm_version: version,
        test_mode,
    };

    let registry_canister_wasm = get_canister_wasm(CanisterName::Registry, version);
    let registry_init_args = registry_canister::init::Args {
        user_index_canister_id: canister_ids.user_index,
        group_index_canister_id: canister_ids.group_index,
        notifications_index_canister_id: canister_ids.notifications_index,
        event_relay_canister_id: canister_ids.event_relay,
        governance_principals: vec![principal],
        proposals_bot_canister_id: canister_ids.proposals_bot,
        nns_ledger_canister_id: canister_ids.nns_ledger,
        nns_governance_canister_id: canister_ids.nns_governance,
        nns_root_canister_id: canister_ids.nns_root,
        sns_wasm_canister_id: canister_ids.nns_sns_wasm,
        nns_index_canister_id: canister_ids.nns_index,
        escrow_canister_id: canister_ids.escrow,
        cycles_dispenser_canister_id: canister_ids.cycles_dispenser,
        cycles_minting_canister_id: canister_ids.nns_cmc,
        wasm_version: version,
        test_mode,
    };

    let market_maker_canister_wasm = get_canister_wasm(CanisterName::MarketMaker, version);
    let market_maker_init_args = market_maker_canister::init::Args {
        user_index_canister_id: canister_ids.user_index,
        cycles_dispenser_canister_id: canister_ids.cycles_dispenser,
        icp_ledger_canister_id: canister_ids.nns_ledger,
        chat_ledger_canister_id: CHAT_LEDGER_CANISTER_ID,
        wasm_version: version,
        test_mode,
    };

    let neuron_controller_canister_wasm = get_canister_wasm(CanisterName::NeuronController, version);
    let neuron_controller_init_args = neuron_controller_canister::init::Args {
        governance_principals: vec![principal],
        nns_governance_canister_id: canister_ids.nns_governance,
        nns_ledger_canister_id: canister_ids.nns_ledger,
        cycles_minting_canister_id: canister_ids.nns_cmc,
        cycles_dispenser_canister_id: canister_ids.cycles_dispenser,
        wasm_version: version,
        test_mode,
    };

    let escrow_canister_wasm = get_canister_wasm(CanisterName::Escrow, version);
    let escrow_init_args = escrow_canister::init::Args {
        registry_canister_id: canister_ids.registry,
        cycles_dispenser_canister_id: canister_ids.cycles_dispenser,
        wasm_version: version,
        test_mode,
    };

    let event_relay_canister_wasm = get_canister_wasm(CanisterName::EventRelay, version);
    let event_relay_init_args = event_relay_canister::init::Args {
        push_events_whitelist: vec![
            canister_ids.user_index,
            canister_ids.online_users,
            canister_ids.local_user_index,
        ],
        event_store_canister_id: canister_ids.event_store,
        cycles_dispenser_canister_id: canister_ids.cycles_dispenser,
        registry_canister_id: canister_ids.registry,
        chat_ledger_canister_id: CHAT_LEDGER_CANISTER_ID,
        chat_governance_canister_id: SNS_GOVERNANCE_CANISTER_ID,
        wasm_version: version,
        test_mode,
    };

    let event_store_canister_wasm = get_canister_wasm(CanisterName::EventStore, version);
    let event_store_init_args = event_store_canister::InitArgs {
        push_events_whitelist: vec![canister_ids.event_relay],
        read_events_whitelist: vec![principal],
        time_granularity: None,
    };

    let sign_in_with_email_wasm = get_canister_wasm(CanisterName::SignInWithEmail, version);
    let sign_in_with_email_init_args = sign_in_with_email_canister_test_utils::default_init_args();

    let sign_in_with_ethereum_wasm = get_canister_wasm(CanisterName::SignInWithEthereum, version);
    let sign_in_with_ethereum_init_args = siwe::SettingsInput {
        domain: "oc.app".to_string(),
        uri: "https://oc.app".to_string(),
        salt: "OpenChat".to_string(),
        chain_id: None,
        scheme: None,
        statement: None,
        sign_in_expires_in: None,
        session_expires_in: None,
        targets: None,
        runtime_features: None,
    };

    let sign_in_with_solana_wasm = get_canister_wasm(CanisterName::SignInWithSolana, version);
    let sign_in_with_solana_init_args = siws::SettingsInput {
        domain: "oc.app".to_string(),
        uri: "https://oc.app".to_string(),
        salt: "OpenChat".to_string(),
        chain_id: None,
        scheme: None,
        statement: None,
        sign_in_expires_in: None,
        session_expires_in: None,
        targets: None,
        runtime_features: None,
    };

    futures::future::join_all([
        install_wasm(
            management_canister,
            &canister_ids.identity,
            &identity_canister_wasm.module,
            Encode!(&identity_init_args).unwrap(),
        ),
        install_wasm(
            management_canister,
            &canister_ids.online_users,
            &online_users_canister_wasm.module,
            Encode!(&online_users_init_args).unwrap(),
        ),
        install_wasm(
            management_canister,
            &canister_ids.proposals_bot,
            &proposals_bot_canister_wasm.module,
            Encode!(&proposals_bot_init_args).unwrap(),
        ),
        install_wasm(
            management_canister,
            &canister_ids.storage_index,
            &storage_index_canister_wasm.module,
            Encode!(&storage_index_init_args).unwrap(),
        ),
        install_wasm(
            management_canister,
            &canister_ids.cycles_dispenser,
            &cycles_dispenser_canister_wasm.module,
            Encode!(&cycles_dispenser_init_args).unwrap(),
        ),
        install_wasm(
            management_canister,
            &canister_ids.registry,
            &registry_canister_wasm.module,
            Encode!(&registry_init_args).unwrap(),
        ),
        install_wasm(
            management_canister,
            &canister_ids.market_maker,
            &market_maker_canister_wasm.module,
            Encode!(&market_maker_init_args).unwrap(),
        ),
        install_wasm(
            management_canister,
            &canister_ids.neuron_controller,
            &neuron_controller_canister_wasm.module,
            Encode!(&neuron_controller_init_args).unwrap(),
        ),
        install_wasm(
            management_canister,
            &canister_ids.escrow,
            &escrow_canister_wasm.module,
            Encode!(&escrow_init_args).unwrap(),
        ),
        install_wasm(
            management_canister,
            &canister_ids.translations,
            &translations_canister_wasm.module,
            Encode!(&translations_init_args).unwrap(),
        ),
        install_wasm(
            management_canister,
            &canister_ids.event_relay,
            &event_relay_canister_wasm.module,
            Encode!(&event_relay_init_args).unwrap(),
        ),
        install_wasm(
            management_canister,
            &canister_ids.event_store,
            &event_store_canister_wasm.module,
            Encode!(&event_store_init_args).unwrap(),
        ),
        install_wasm(
            management_canister,
            &canister_ids.sign_in_with_email,
            &sign_in_with_email_wasm.module,
            Encode!(&sign_in_with_email_init_args).unwrap(),
        ),
        install_wasm(
            management_canister,
            &canister_ids.sign_in_with_ethereum,
            &sign_in_with_ethereum_wasm.module,
            Encode!(&sign_in_with_ethereum_init_args).unwrap(),
        ),
        install_wasm(
            management_canister,
            &canister_ids.sign_in_with_solana,
            &sign_in_with_solana_wasm.module,
            Encode!(&sign_in_with_solana_init_args).unwrap(),
        ),
        install_wasm(
            management_canister,
            &canister_ids.airdrop_bot,
            &airdrop_bot_canister_wasm.module,
            Encode!(&airdrop_bot_init_args).unwrap(),
        ),
    ])
    .await;

    let user_canister_wasm = get_canister_wasm(CanisterName::User, version);
    let group_canister_wasm = get_canister_wasm(CanisterName::Group, version);
    let community_canister_wasm = get_canister_wasm(CanisterName::Community, version);
    let local_user_index_canister_wasm = get_canister_wasm(CanisterName::LocalUserIndex, version);

    futures::future::try_join4(
        user_index_canister_client::upload_wasm_in_chunks(
            agent,
            &canister_ids.user_index,
            &local_user_index_canister_wasm.module,
            user_index_canister::ChildCanisterType::LocalUserIndex,
        ),
        user_index_canister_client::upload_wasm_in_chunks(
            agent,
            &canister_ids.user_index,
            &user_canister_wasm.module,
            user_index_canister::ChildCanisterType::User,
        ),
        group_index_canister_client::upload_wasm_in_chunks(
            agent,
            &canister_ids.group_index,
            &group_canister_wasm.module,
            group_index_canister::ChildCanisterType::Group,
        ),
        group_index_canister_client::upload_wasm_in_chunks(
            agent,
            &canister_ids.group_index,
            &community_canister_wasm.module,
            group_index_canister::ChildCanisterType::Community,
        ),
    )
    .await
    .unwrap();

    user_index_canister_client::upgrade_local_user_index_canister_wasm(
        agent,
        &canister_ids.user_index,
        &user_index_canister::upgrade_local_user_index_canister_wasm::Args {
            version,
            wasm_hash: sha256(&local_user_index_canister_wasm.module),
            filter: None,
        },
    )
    .await
    .unwrap();

    futures::future::try_join3(
        user_index_canister_client::upgrade_user_canister_wasm(
            agent,
            &canister_ids.user_index,
            &user_index_canister::upgrade_user_canister_wasm::Args {
                version,
                wasm_hash: sha256(&user_canister_wasm.module),
                filter: None,
            },
        ),
        group_index_canister_client::upgrade_group_canister_wasm(
            agent,
            &canister_ids.group_index,
            &group_index_canister::upgrade_group_canister_wasm::Args {
                version,
                wasm_hash: sha256(&group_canister_wasm.module),
                filter: None,
            },
        ),
        group_index_canister_client::upgrade_community_canister_wasm(
            agent,
            &canister_ids.group_index,
            &group_index_canister::upgrade_community_canister_wasm::Args {
                version,
                wasm_hash: sha256(&community_canister_wasm.module),
                filter: None,
            },
        ),
    )
    .await
    .unwrap();

    registry_canister_client::expand_onto_subnet(
        agent,
        &canister_ids.registry,
        &registry_canister::expand_onto_subnet::Args {
            subnet_id: Principal::anonymous(),
            local_user_index: Some(canister_ids.local_user_index),
        },
    )
    .await
    .unwrap();

    for _ in 0..20 {
        tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;
        let registry_canister::subnets::Response::Success(subnets) =
            registry_canister_client::subnets(agent, &canister_ids.registry, &registry_canister::subnets::Args {})
                .await
                .unwrap();

        if !subnets.is_empty() {
            break;
        }
    }

    println!("Canister wasms installed");
}

mod siwe {
    use candid::CandidType;

    #[expect(dead_code)]
    #[derive(CandidType)]
    pub enum RuntimeFeature {
        IncludeUriInSeed,
        DisableEthToPrincipalMapping,
        DisablePrincipalToEthMapping,
    }

    #[derive(CandidType)]
    pub struct SettingsInput {
        pub domain: String,
        pub uri: String,
        pub salt: String,
        pub chain_id: Option<u32>,
        pub scheme: Option<String>,
        pub statement: Option<String>,
        pub sign_in_expires_in: Option<u64>,
        pub session_expires_in: Option<u64>,
        pub targets: Option<Vec<String>>,
        pub runtime_features: Option<Vec<RuntimeFeature>>,
    }
}

mod siws {
    use candid::CandidType;

    #[expect(dead_code)]
    #[derive(CandidType)]
    pub enum RuntimeFeature {
        IncludeUriInSeed,
        DisableSolToPrincipalMapping,
        DisablePrincipalToSolMapping,
    }

    #[derive(CandidType)]
    pub struct SettingsInput {
        pub domain: String,
        pub uri: String,
        pub salt: String,
        pub chain_id: Option<String>,
        pub scheme: Option<String>,
        pub statement: Option<String>,
        pub sign_in_expires_in: Option<u64>,
        pub session_expires_in: Option<u64>,
        pub targets: Option<Vec<String>>,
        pub runtime_features: Option<Vec<RuntimeFeature>>,
    }
}
