use crate::client::{create_canister, create_canister_with_id, install_canister};
use crate::env::VIDEO_CALL_OPERATOR;
use crate::utils::tick_many;
use crate::{CanisterIds, T, TestEnv, client, wasms};
use candid::{CandidType, Nat, Principal};
use constants::{CHAT_LEDGER_CANISTER_ID, CHAT_SYMBOL, CHAT_TRANSFER_FEE, SNS_GOVERNANCE_CANISTER_ID};
use ic_ledger_types::{AccountIdentifier, BlockIndex, DEFAULT_SUBACCOUNT, Tokens};
use icrc_ledger_types::icrc::generic_metadata_value::MetadataValue;
use icrc_ledger_types::icrc1::account::Account;
use identity_canister::WEBAUTHN_ORIGINATING_CANISTER;
use pocket_ic::{PocketIc, PocketIcBuilder, PocketIcState};
use rand::{Rng, SeedableRng, rngs::StdRng};
use sha256::sha256;
use std::collections::{HashMap, HashSet};
use std::env;
use std::path::Path;
use std::sync::OnceLock;
use std::time::Instant;
use storage_index_canister::init::CyclesDispenserConfig;
use testing::NNS_INTERNET_IDENTITY_CANISTER_ID;
use types::{BuildVersion, CanisterId, CanisterWasm, Hash};

pub static POCKET_IC_BIN: &str = "./pocket-ic";

// This base state is set at the end of the initialization process, so each thread (other than
// the one doing the initialization) waits until the state is available at which point they
// create their own PocketIC instance which is initialized with this state.
static BASE_STATE: OnceLock<(PocketIcState, CanisterIds)> = OnceLock::new();

pub fn setup_new_env(seed: Option<Hash>) -> TestEnv {
    verify_pocket_ic_exists();

    let controller = Principal::from_text("xuxyr-xopen-chatx-xxxbu-cai").unwrap();

    let (state, canister_ids) = BASE_STATE.get_or_init(|| initialize_base_state(controller, seed));

    let env = PocketIcBuilder::new().with_read_only_state(state).build();

    TestEnv {
        env,
        canister_ids: canister_ids.clone(),
        controller,
    }
}

fn initialize_base_state(controller: Principal, seed: Option<Hash>) -> (PocketIcState, CanisterIds) {
    let started = Instant::now();

    // This thread is first, so it is the only one which will run the full initialization
    println!("Initialization starting");

    let mut env = PocketIcBuilder::new()
        .with_nns_subnet()
        .with_sns_subnet()
        .with_application_subnet()
        .with_state(PocketIcState::new())
        .build();

    println!("PocketIC instance ready. Installing canisters...");

    let ticks: u8 = seed.map_or(0, |s| StdRng::from_seed(s).r#gen());
    tick_many(&mut env, ticks as usize);

    let canister_ids = install_canisters(&mut env, controller);
    let duration = Instant::now().duration_since(started);

    println!("Initialization complete. Took: {}s", duration.as_secs());

    let state = env.drop_and_take_state().unwrap();

    (state, canister_ids)
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
        CHAT_SYMBOL.to_string(),
        CHAT_TRANSFER_FEE as u64,
        Some(CHAT_LEDGER_CANISTER_ID.to_text().as_str()),
        Vec::new(),
    );
    let chat_governance_canister_id = SNS_GOVERNANCE_CANISTER_ID;

    let openchat_installer_canister_id = create_canister(env, controller);
    let user_index_canister_id = create_canister(env, openchat_installer_canister_id);
    let group_index_canister_id = create_canister(env, openchat_installer_canister_id);
    let notifications_index_canister_id = create_canister(env, openchat_installer_canister_id);
    let identity_canister_id = create_canister(env, controller);
    let online_users_canister_id = create_canister(env, controller);
    let airdrop_bot_canister_id = create_canister(env, controller);
    let proposals_bot_canister_id = create_canister(env, controller);
    let storage_index_canister_id = create_canister(env, controller);
    let cycles_dispenser_canister_id = create_canister(env, controller);
    let registry_canister_id = create_canister(env, controller);
    let escrow_canister_id = create_canister(env, controller);
    let translations_canister_id = create_canister(env, controller);
    let event_relay_canister_id = create_canister(env, controller);
    let event_store_canister_id = create_canister(env, controller);
    let sign_in_with_email_canister_id = create_canister(env, controller);
    let website_canister_id = create_canister(env, controller);

    let community_canister_wasm = wasms::COMMUNITY.clone();
    let cycles_dispenser_canister_wasm = wasms::CYCLES_DISPENSER.clone();
    let cycles_minting_canister_wasm = wasms::CYCLES_MINTING_CANISTER.clone();
    let escrow_canister_wasm = wasms::ESCROW.clone();
    let event_relay_canister_wasm = wasms::EVENT_RELAY.clone();
    let event_store_canister_wasm = wasms::EVENT_STORE.clone();
    let group_canister_wasm = wasms::GROUP.clone();
    let group_index_canister_wasm = wasms::GROUP_INDEX.clone();
    let icp_ledger_canister_wasm = wasms::ICP_LEDGER.clone();
    let identity_canister_wasm = wasms::IDENTITY.clone();
    let local_user_index_canister_wasm = wasms::LOCAL_USER_INDEX.clone();
    let notifications_index_canister_wasm = wasms::NOTIFICATIONS_INDEX.clone();
    let online_users_canister_wasm = wasms::ONLINE_USERS.clone();
    let openchat_installer_canister_wasm = wasms::OPENCHAT_INSTALLER.clone();
    let proposals_bot_canister_wasm = wasms::PROPOSALS_BOT.clone();
    let airdrop_bot_canister_wasm = wasms::AIRDROP_BOT.clone();
    let registry_canister_wasm = wasms::REGISTRY.clone();
    let sign_in_with_email_canister_wasm = wasms::SIGN_IN_WITH_EMAIL.clone();
    let sns_wasm_canister_wasm = wasms::SNS_WASM.clone();
    let storage_bucket_canister_wasm = wasms::STORAGE_BUCKET.clone();
    let storage_index_canister_wasm = wasms::STORAGE_INDEX.clone();
    let translations_canister_wasm = wasms::TRANSLATIONS.clone();
    let user_canister_wasm = wasms::USER.clone();
    let user_index_canister_wasm = wasms::USER_INDEX.clone();

    let wasm_version = BuildVersion::min();
    let test_mode = true;

    let openchat_installer_init_args = openchat_installer_canister::init::Args {
        governance_principals: vec![controller],
        upload_wasm_chunks_whitelist: Vec::new(),
        user_index_canister_id,
        group_index_canister_id,
        notifications_index_canister_id,
        identity_canister_id,
        proposals_bot_canister_id,
        airdrop_bot_canister_id,
        online_users_canister_id,
        cycles_dispenser_canister_id,
        storage_index_canister_id,
        escrow_canister_id,
        event_relay_canister_id,
        registry_canister_id,
        translations_canister_id,
        website_canister_id,
        nns_governance_canister_id,
        internet_identity_canister_id: NNS_INTERNET_IDENTITY_CANISTER_ID,
        ic_root_key: env.root_key().unwrap(),
        wasm_version,
        test_mode,
    };
    install_canister(
        env,
        controller,
        openchat_installer_canister_id,
        openchat_installer_canister_wasm,
        openchat_installer_init_args,
    );

    client::openchat_installer::happy_path::upload_wasm_in_chunks(
        env,
        controller,
        openchat_installer_canister_id,
        &user_index_canister_wasm.module,
        openchat_installer_canister::CanisterType::UserIndex,
    );

    client::openchat_installer::happy_path::upload_wasm_in_chunks(
        env,
        controller,
        openchat_installer_canister_id,
        &group_index_canister_wasm.module,
        openchat_installer_canister::CanisterType::GroupIndex,
    );

    client::openchat_installer::happy_path::upload_wasm_in_chunks(
        env,
        controller,
        openchat_installer_canister_id,
        &notifications_index_canister_wasm.module,
        openchat_installer_canister::CanisterType::NotificationsIndex,
    );

    client::openchat_installer::happy_path::install_canisters(
        env,
        controller,
        openchat_installer_canister_id,
        sha256(&user_index_canister_wasm.module),
        sha256(&group_index_canister_wasm.module),
        sha256(&notifications_index_canister_wasm.module),
        vec![VIDEO_CALL_OPERATOR],
        vec![controller],
        wasm_version,
    );

    let identity_init_args = identity_canister::init::Args {
        governance_principals: vec![controller],
        user_index_canister_id,
        cycles_dispenser_canister_id,
        originating_canisters: vec![
            NNS_INTERNET_IDENTITY_CANISTER_ID,
            sign_in_with_email_canister_id,
            WEBAUTHN_ORIGINATING_CANISTER,
        ],
        skip_captcha_whitelist: vec![
            NNS_INTERNET_IDENTITY_CANISTER_ID,
            sign_in_with_email_canister_id,
            WEBAUTHN_ORIGINATING_CANISTER,
        ],
        ic_root_key: env.root_key().unwrap(),
        wasm_version,
        test_mode,
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
        wasm_version,
        test_mode,
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
        airdrop_bot_canister_id,
        event_relay_canister_id,
        cycles_dispenser_canister_id,
        sync_online_minutes_to_airdrop_bot_increment: 1,
        wasm_version,
        test_mode,
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
        wasm_version,
        test_mode,
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
        wasm_version,
        test_mode,
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
            online_users_canister_id,
            proposals_bot_canister_id,
            storage_index_canister_id,
        ],
        registry_canister_id,
        max_top_up_amount: 20 * T,
        min_interval: 5 * 60 * 1000, // 5 minutes
        min_cycles_balance: 200 * T,
        icp_burn_amount_e8s: 1_000_000_000, // 10 ICP
        ledger_canister: nns_ledger_canister_id,
        cycles_minting_canister: cycles_minting_canister_id,
        wasm_version,
        test_mode,
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
        group_index_canister_id,
        notifications_index_canister_id,
        event_relay_canister_id,
        governance_principals: vec![controller],
        proposals_bot_canister_id,
        nns_ledger_canister_id,
        nns_root_canister_id,
        nns_governance_canister_id,
        nns_index_canister_id,
        sns_wasm_canister_id,
        escrow_canister_id,
        cycles_dispenser_canister_id,
        cycles_minting_canister_id,
        wasm_version,
        test_mode,
    };
    install_canister(
        env,
        controller,
        registry_canister_id,
        registry_canister_wasm,
        registry_init_args,
    );

    let escrow_init_args = escrow_canister::init::Args {
        registry_canister_id,
        cycles_dispenser_canister_id,
        wasm_version,
        test_mode,
    };
    install_canister(env, controller, escrow_canister_id, escrow_canister_wasm, escrow_init_args);

    let event_relay_init_args = event_relay_canister::init::Args {
        push_events_whitelist: vec![user_index_canister_id, online_users_canister_id],
        event_store_canister_id,
        cycles_dispenser_canister_id,
        registry_canister_id,
        chat_ledger_canister_id,
        chat_governance_canister_id,
        wasm_version,
        test_mode,
    };
    install_canister(
        env,
        controller,
        event_relay_canister_id,
        event_relay_canister_wasm,
        event_relay_init_args,
    );

    let event_store_init_args = event_store_canister::InitArgs {
        push_events_whitelist: vec![event_relay_canister_id],
        read_events_whitelist: vec![controller],
        time_granularity: None,
    };
    install_canister(
        env,
        controller,
        event_store_canister_id,
        event_store_canister_wasm,
        event_store_init_args,
    );

    let sign_in_with_email_init_args = sign_in_with_email_canister_test_utils::default_init_args();
    install_canister(
        env,
        controller,
        sign_in_with_email_canister_id,
        sign_in_with_email_canister_wasm,
        sign_in_with_email_init_args,
    );

    client::user_index::happy_path::upgrade_user_canister_wasm(env, controller, user_index_canister_id, user_canister_wasm);
    client::user_index::happy_path::upgrade_local_user_index_canister_wasm(
        env,
        controller,
        user_index_canister_id,
        local_user_index_canister_wasm,
    );

    client::group_index::happy_path::upgrade_group_canister_wasm(env, controller, group_index_canister_id, group_canister_wasm);
    client::group_index::happy_path::upgrade_community_canister_wasm(
        env,
        controller,
        group_index_canister_id,
        community_canister_wasm,
    );

    client::storage_index::happy_path::upgrade_bucket_canister_wasm(
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
        governance_canister_id: nns_governance_canister_id,
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

    let application_subnet = *env.topology().get_app_subnets().first().unwrap();

    client::cmc::set_authorized_subnetwork_list(
        env,
        nns_governance_canister_id,
        cycles_minting_canister_id,
        &cycles_minting_canister::set_authorized_subnetwork_list::Args {
            who: None,
            subnets: vec![application_subnet],
        },
    );

    let sns_wasm_canister_init_args = SnsWasmCanisterInitPayload::default();
    install_canister(
        env,
        controller,
        sns_wasm_canister_id,
        sns_wasm_canister_wasm,
        sns_wasm_canister_init_args,
    );

    // Top up the CyclesDispenser with 10k ICP
    client::ledger::happy_path::transfer(
        env,
        controller,
        nns_ledger_canister_id,
        cycles_dispenser_canister_id,
        10_000 * 100_000_000,
    );

    // Top up the Registry with 10 ICP
    client::ledger::happy_path::transfer(
        env,
        controller,
        nns_ledger_canister_id,
        registry_canister_id,
        10 * 100_000_000,
    );

    let subnet = client::registry::happy_path::expand_onto_subnet(env, controller, registry_canister_id, application_subnet);

    let airdrop_bot_init_args = airdrop_bot_canister::init::Args {
        admins: vec![controller],
        user_index_canister_id,
        local_user_index_canister_id: subnet.local_user_index,
        online_users_canister_id,
        chat_ledger_canister_id,
        wasm_version,
        test_mode,
    };
    install_canister(
        env,
        controller,
        airdrop_bot_canister_id,
        airdrop_bot_canister_wasm,
        airdrop_bot_init_args,
    );

    // Tick a load of times so that all the child canisters have time to get installed
    tick_many(env, 10);

    let canister_ids = CanisterIds {
        openchat_installer: openchat_installer_canister_id,
        user_index: user_index_canister_id,
        group_index: group_index_canister_id,
        notifications_index: notifications_index_canister_id,
        identity: identity_canister_id,
        online_users: online_users_canister_id,
        proposals_bot: proposals_bot_canister_id,
        airdrop_bot: airdrop_bot_canister_id,
        storage_index: storage_index_canister_id,
        cycles_dispenser: cycles_dispenser_canister_id,
        registry: registry_canister_id,
        escrow: escrow_canister_id,
        translations: translations_canister_id,
        event_relay: event_relay_canister_id,
        event_store: event_store_canister_id,
        sign_in_with_email: sign_in_with_email_canister_id,
        icp_ledger: nns_ledger_canister_id,
        chat_ledger: chat_ledger_canister_id,
        cycles_minting_canister: cycles_minting_canister_id,
        subnets: vec![subnet],
    };

    println!("Test env setup complete. {canister_ids:?}");

    canister_ids
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
        pub initial_balances: Vec<(Account, Nat)>,
        pub transfer_fee: Nat,
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
        initial_balances: initial_balances.into_iter().map(|(k, v)| (k, v.into())).collect(),
        transfer_fee: transfer_fee.into(),
        token_name,
        token_symbol,
        metadata: vec![("icrc1:logo".to_string(), MetadataValue::Text("logo".to_string()))],
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

fn verify_pocket_ic_exists() {
    let path = match env::var_os("POCKET_IC_BIN") {
        None => {
            unsafe {
                env::set_var("POCKET_IC_BIN", POCKET_IC_BIN);
            }
            POCKET_IC_BIN.to_string()
        }
        Some(path) => path
            .clone()
            .into_string()
            .unwrap_or_else(|_| panic!("Invalid string path for {path:?}")),
    };

    if !Path::new(&path).exists() {
        panic!("Could not find the PocketIC binary to run canister integration tests.

I looked for it at {:?}. You can specify another path with the environment variable POCKET_IC_BIN (note that I run from {:?}).

Running the testing script will automatically place the PocketIC binary at the right place to be run without setting the POCKET_IC_BIN environment variable:
    ./scripts/run-integration-tests.sh", &path, &env::current_dir().map(|x| x.display().to_string()).unwrap_or_else(|_| "an unknown directory".to_string()));
    }
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
