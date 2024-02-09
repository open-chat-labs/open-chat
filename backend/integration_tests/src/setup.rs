use crate::client::{create_canister, create_canister_with_id, install_canister};
use crate::rng::random_principal;
use crate::utils::tick_many;
use crate::{client, wasms, CanisterIds, TestEnv, NNS_INTERNET_IDENTITY_CANISTER_ID, T};
use candid::{CandidType, Principal};
use ic_ledger_types::{AccountIdentifier, BlockIndex, Tokens, DEFAULT_SUBACCOUNT};
use icrc_ledger_types::icrc::generic_metadata_value::MetadataValue;
use icrc_ledger_types::icrc1::account::Account;
use pocket_ic::{PocketIc, PocketIcBuilder};
use std::collections::{HashMap, HashSet};
use std::env;
use std::path::Path;
use storage_index_canister::init::CyclesDispenserConfig;
use types::{BuildVersion, CanisterId, CanisterWasm};

pub static POCKET_IC_BIN: &str = "./pocket-ic";

pub fn setup_new_env() -> TestEnv {
    let path = match env::var_os("POCKET_IC_BIN") {
        None => {
            env::set_var("POCKET_IC_BIN", POCKET_IC_BIN);
            POCKET_IC_BIN.to_string()
        }
        Some(path) => path
            .clone()
            .into_string()
            .unwrap_or_else(|_| panic!("Invalid string path for {path:?}")),
    };

    if !Path::new(&path).exists() {
        println!("
        Could not find the PocketIC binary to run canister integration tests.

        I looked for it at {:?}. You can specify another path with the environment variable POCKET_IC_BIN (note that I run from {:?}).

        Running the testing script will automatically place the PocketIC binary at the right place to be run without setting the POCKET_IC_BIN environment variable:
            ./scripts/run-integration-tests.sh
        ", &path, &env::current_dir().map(|x| x.display().to_string()).unwrap_or_else(|_| "an unknown directory".to_string()));
    }

    let mut env = PocketIcBuilder::new()
        .with_nns_subnet()
        .with_sns_subnet()
        .with_application_subnet()
        .build();
    let controller = random_principal();
    let canister_ids = install_canisters(&mut env, controller);

    TestEnv {
        env,
        canister_ids,
        controller,
    }
}

fn install_canisters(env: &mut PocketIc, controller: Principal) -> CanisterIds {
    let nns_governance_canister_id = create_canister_with_id(env, controller, "rrkah-fqaaa-aaaaa-aaaaq-cai");
    let nns_ledger_canister_id = create_canister_with_id(env, controller, "ryjl3-tyaaa-aaaaa-aaaba-cai");
    let nns_root_canister_id = create_canister_with_id(env, controller, "r7inp-6aaaa-aaaaa-aaabq-cai");
    let cycles_minting_canister_id = create_canister_with_id(env, controller, "rkp4c-7iaaa-aaaaa-aaaca-cai");
    let sns_wasm_canister_id = create_canister_with_id(env, controller, "qaa6y-5yaaa-aaaaa-aaafa-cai");
    let nns_index_canister_id = create_canister_with_id(env, controller, "qhbym-qaaaa-aaaaa-aaafq-cai");
    let chat_ledger_canister_id = install_icrc_ledger(
        env,
        controller,
        "OpenChat".to_string(),
        "CHAT".to_string(),
        100000,
        Some("2ouva-viaaa-aaaaq-aaamq-cai"),
        Vec::new(),
    );

    let user_index_canister_id = create_canister(env, controller);
    let group_index_canister_id = create_canister(env, controller);
    let notifications_index_canister_id = create_canister(env, controller);
    let identity_canister_id = create_canister(env, controller);
    let online_users_canister_id = create_canister(env, controller);
    let proposals_bot_canister_id = create_canister(env, controller);
    let storage_index_canister_id = create_canister(env, controller);
    let cycles_dispenser_canister_id = create_canister(env, controller);
    let registry_canister_id = create_canister(env, controller);
    let escrow_canister_id = create_canister(env, controller);
    let translations_canister_id = create_canister(env, controller);
    let event_relay_canister_id = create_canister(env, controller);

    let local_user_index_canister_id = create_canister(env, user_index_canister_id);
    let local_group_index_canister_id = create_canister(env, group_index_canister_id);
    let notifications_canister_id = create_canister(env, notifications_index_canister_id);

    let community_canister_wasm = wasms::COMMUNITY.clone();
    let cycles_dispenser_canister_wasm = wasms::CYCLES_DISPENSER.clone();
    let cycles_minting_canister_wasm = wasms::CYCLES_MINTING_CANISTER.clone();
    let escrow_canister_wasm = wasms::ESCROW.clone();
    let event_relay_canister_wasm = wasms::EVENT_RELAY.clone();
    let group_canister_wasm = wasms::GROUP.clone();
    let group_index_canister_wasm = wasms::GROUP_INDEX.clone();
    let icp_ledger_canister_wasm = wasms::ICP_LEDGER.clone();
    let identity_canister_wasm = wasms::IDENTITY.clone();
    let local_group_index_canister_wasm = wasms::LOCAL_GROUP_INDEX.clone();
    let local_user_index_canister_wasm = wasms::LOCAL_USER_INDEX.clone();
    let notifications_canister_wasm = wasms::NOTIFICATIONS.clone();
    let notifications_index_canister_wasm = wasms::NOTIFICATIONS_INDEX.clone();
    let online_users_canister_wasm = wasms::ONLINE_USERS.clone();
    let proposals_bot_canister_wasm = wasms::PROPOSALS_BOT.clone();
    let registry_canister_wasm = wasms::REGISTRY.clone();
    let sns_wasm_canister_wasm = wasms::SNS_WASM.clone();
    let storage_bucket_canister_wasm = wasms::STORAGE_BUCKET.clone();
    let storage_index_canister_wasm = wasms::STORAGE_INDEX.clone();
    let translations_canister_wasm = wasms::TRANSLATIONS.clone();
    let user_canister_wasm = wasms::USER.clone();
    let user_index_canister_wasm = wasms::USER_INDEX.clone();

    let user_index_init_args = user_index_canister::init::Args {
        governance_principals: vec![controller],
        user_canister_wasm: CanisterWasm::default(),
        local_user_index_canister_wasm: CanisterWasm::default(),
        group_index_canister_id,
        notifications_index_canister_id,
        identity_canister_id,
        proposals_bot_canister_id,
        cycles_dispenser_canister_id,
        storage_index_canister_id,
        escrow_canister_id,
        event_relay_canister_id,
        nns_governance_canister_id,
        internet_identity_canister_id: NNS_INTERNET_IDENTITY_CANISTER_ID,
        translations_canister_id,
        wasm_version: BuildVersion::min(),
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
        governance_principals: vec![controller],
        group_canister_wasm: CanisterWasm::default(),
        community_canister_wasm: CanisterWasm::default(),
        local_group_index_canister_wasm: CanisterWasm::default(),
        user_index_canister_id,
        cycles_dispenser_canister_id,
        proposals_bot_user_id: proposals_bot_canister_id.into(),
        escrow_canister_id,
        wasm_version: BuildVersion::min(),
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
        governance_principals: vec![controller],
        push_service_principals: vec![controller],
        user_index_canister_id,
        authorizers: vec![user_index_canister_id, group_index_canister_id],
        cycles_dispenser_canister_id,
        notifications_canister_wasm: CanisterWasm::default(),
        wasm_version: BuildVersion::min(),
        test_mode: true,
    };
    install_canister(
        env,
        controller,
        notifications_index_canister_id,
        notifications_index_canister_wasm,
        notifications_index_init_args,
    );

    let identity_init_args = identity_canister::init::Args {
        governance_principals: vec![controller],
        user_index_canister_id,
        cycles_dispenser_canister_id,
        wasm_version: BuildVersion::min(),
        test_mode: true,
    };
    install_canister(
        env,
        controller,
        identity_canister_id,
        identity_canister_wasm,
        identity_init_args,
    );

    let translations_init_args = translations_canister::init::Args {
        user_index_canister_id,
        deployment_operators: vec![controller],
        cycles_dispenser_canister_id,
        wasm_version: BuildVersion::min(),
        test_mode: true,
    };
    install_canister(
        env,
        controller,
        translations_canister_id,
        translations_canister_wasm,
        translations_init_args,
    );

    let online_users_init_args = online_users_canister::init::Args {
        user_index_canister_id,
        event_relay_canister_id,
        cycles_dispenser_canister_id,
        wasm_version: BuildVersion::min(),
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
        registry_canister_id,
        nns_governance_canister_id,
        sns_wasm_canister_id,
        cycles_dispenser_canister_id,
        wasm_version: BuildVersion::min(),
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
        bucket_canister_wasm: CanisterWasm::default(),
        cycles_dispenser_config: CyclesDispenserConfig {
            canister_id: cycles_dispenser_canister_id,
            min_cycles_balance: 200 * T,
        },
        wasm_version: BuildVersion::min(),
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
        ledger_canister: nns_ledger_canister_id,
        cycles_minting_canister: cycles_minting_canister_id,
        wasm_version: BuildVersion::min(),
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
        user_index_canister_id,
        governance_principals: vec![controller],
        proposals_bot_canister_id,
        nns_ledger_canister_id,
        nns_root_canister_id,
        nns_governance_canister_id,
        nns_index_canister_id,
        sns_wasm_canister_id,
        cycles_dispenser_canister_id,
        wasm_version: BuildVersion::min(),
        test_mode: true,
    };
    install_canister(
        env,
        controller,
        registry_canister_id,
        registry_canister_wasm,
        registry_init_args,
    );

    let escrow_init_args = escrow_canister::init::Args {
        cycles_dispenser_canister_id,
        wasm_version: BuildVersion::min(),
        test_mode: true,
    };
    install_canister(env, controller, escrow_canister_id, escrow_canister_wasm, escrow_init_args);

    let event_relay_init_args = event_relay_canister::init::Args {
        push_events_whitelist: vec![],
        event_sink_canister_id: Principal::anonymous(),
        cycles_dispenser_canister_id,
        wasm_version: BuildVersion::min(),
        test_mode: true,
    };
    install_canister(
        env,
        controller,
        event_relay_canister_id,
        event_relay_canister_wasm,
        event_relay_init_args,
    );

    client::user_index::happy_path::upgrade_user_canister_wasm(env, controller, user_index_canister_id, user_canister_wasm);
    client::user_index::happy_path::upgrade_local_user_index_canister_wasm(
        env,
        controller,
        user_index_canister_id,
        local_user_index_canister_wasm,
    );
    client::user_index::happy_path::add_local_user_index_canister(
        env,
        controller,
        user_index_canister_id,
        local_user_index_canister_id,
        notifications_canister_id,
    );

    client::group_index::happy_path::upgrade_group_canister_wasm(env, controller, group_index_canister_id, group_canister_wasm);
    client::group_index::happy_path::upgrade_community_canister_wasm(
        env,
        controller,
        group_index_canister_id,
        community_canister_wasm,
    );
    client::group_index::happy_path::upgrade_local_group_index_canister_wasm(
        env,
        controller,
        group_index_canister_id,
        local_group_index_canister_wasm,
    );
    client::group_index::happy_path::add_local_group_index_canister(
        env,
        controller,
        group_index_canister_id,
        local_group_index_canister_id,
        local_user_index_canister_id,
        notifications_canister_id,
    );

    client::notifications_index::happy_path::upgrade_notifications_canister_wasm(
        env,
        controller,
        notifications_index_canister_id,
        notifications_canister_wasm,
    );
    client::notifications_index::happy_path::add_notifications_canister(
        env,
        controller,
        notifications_index_canister_id,
        notifications_canister_id,
        local_user_index_canister_id,
        local_group_index_canister_id,
    );

    client::storage_index::happy_path::upgrade_notifications_canister_wasm(
        env,
        controller,
        storage_index_canister_id,
        storage_bucket_canister_wasm,
    );

    let minting_account = AccountIdentifier::new(&controller, &DEFAULT_SUBACCOUNT);

    let icp_ledger_init_args = NnsLedgerCanisterInitPayload {
        minting_account: minting_account.to_string(),
        initial_values: HashMap::new(),
        send_whitelist: HashSet::new(),
        transfer_fee: Some(Tokens::from_e8s(10_000)),
    };
    install_canister(
        env,
        controller,
        nns_ledger_canister_id,
        icp_ledger_canister_wasm,
        icp_ledger_init_args,
    );

    let cycles_minting_canister_init_args = CyclesMintingCanisterInitPayload {
        ledger_canister_id: nns_ledger_canister_id,
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

    let sns_wasm_canister_init_args = SnsWasmCanisterInitPayload::default();
    install_canister(
        env,
        controller,
        sns_wasm_canister_id,
        sns_wasm_canister_wasm,
        sns_wasm_canister_init_args,
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
        identity: identity_canister_id,
        online_users: online_users_canister_id,
        proposals_bot: proposals_bot_canister_id,
        storage_index: storage_index_canister_id,
        cycles_dispenser: cycles_dispenser_canister_id,
        registry: registry_canister_id,
        escrow: escrow_canister_id,
        translations: translations_canister_id,
        event_relay: event_relay_canister_id,
        icp_ledger: nns_ledger_canister_id,
        chat_ledger: chat_ledger_canister_id,
        cycles_minting_canister: cycles_minting_canister_id,
    }
}

pub fn install_icrc_ledger(
    env: &mut PocketIc,
    controller: Principal,
    token_name: String,
    token_symbol: String,
    transfer_fee: u64,
    canister_id: Option<&str>,
    initial_balances: Vec<(Account, u64)>,
) -> CanisterId {
    #[derive(CandidType)]
    pub struct InitArgs {
        pub minting_account: Account,
        pub initial_balances: Vec<(Account, u64)>,
        pub transfer_fee: u64,
        pub token_name: String,
        pub token_symbol: String,
        pub metadata: Vec<(String, MetadataValue)>,
        pub archive_options: ArchiveOptions,
    }

    #[derive(CandidType)]
    pub enum LedgerArgument {
        Init(InitArgs),
    }

    #[derive(CandidType)]
    pub struct ArchiveOptions {
        pub trigger_threshold: usize,
        pub num_blocks_to_archive: usize,
        pub controller_id: Principal,
    }

    let args = LedgerArgument::Init(InitArgs {
        minting_account: Account::from(controller),
        initial_balances,
        transfer_fee,
        token_name,
        token_symbol,
        metadata: Vec::new(),
        archive_options: ArchiveOptions {
            trigger_threshold: 1000,
            num_blocks_to_archive: 1000,
            controller_id: controller,
        },
    });

    let canister_id = if let Some(id) = canister_id {
        create_canister_with_id(env, controller, id)
    } else {
        create_canister(env, controller)
    };
    install_canister(env, controller, canister_id, wasms::ICRC_LEDGER.clone(), args);

    canister_id
}

#[derive(CandidType)]
struct NnsLedgerCanisterInitPayload {
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

#[derive(CandidType, Default)]
struct SnsWasmCanisterInitPayload {
    allowed_principals: Vec<Principal>,
    access_controls_enabled: bool,
    sns_subnet_ids: Vec<Principal>,
}
