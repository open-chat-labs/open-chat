use crate::lifecycle::{init_env, init_state, UPGRADE_BUFFER_SIZE};
use crate::memory::get_upgrades_memory;
use crate::{read_state, Data};
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use ic_base_types::PrincipalId;
use ic_cdk_macros::post_upgrade;
use ic_icrc1::Account;
use ic_stable_structures::reader::{BufferedReader, Reader};
use local_user_index_canister::post_upgrade::Args;
use std::time::Duration;
use tracing::info;
use types::CanisterId;
use utils::cycles::init_cycles_dispenser_client;

#[post_upgrade]
#[trace]
fn post_upgrade(args: Args) {
    let env = init_env();

    let memory = get_upgrades_memory();
    let reader = BufferedReader::new(UPGRADE_BUFFER_SIZE, Reader::new(&memory, 0));

    let (data, logs, traces): (Data, Vec<LogEntry>, Vec<LogEntry>) = serializer::deserialize(reader).unwrap();

    canister_logger::init_with_logs(data.test_mode, logs, traces);

    init_cycles_dispenser_client(data.cycles_dispenser_canister_id);
    init_state(env, data, args.wasm_version);

    info!(version = %args.wasm_version, "Post-upgrade complete");

    let (this_canister_id, test_mode) = read_state(|state| (state.env.canister_id(), state.data.test_mode));

    ic_cdk_timers::set_timer(Duration::default(), move || {
        ic_cdk::spawn(transfer_ckbtc_to_satoshi_dice_bot(this_canister_id, test_mode))
    });
}

async fn transfer_ckbtc_to_satoshi_dice_bot(this_canister_id: CanisterId, test_mode: bool) {
    let satoshi_dice_bot_canister_id =
        CanisterId::from_text(if test_mode { "uuw5d-uiaaa-aaaar-anzeq-cai" } else { "wznbi-caaaa-aaaar-anvea-cai" }).unwrap();

    let ckbtc_client = ic_icrc1_client::ICRC1Client {
        ledger_canister_id: CanisterId::from_text("mxzaz-hqaaa-aaaar-qaada-cai").unwrap(),
        runtime: ic_icrc1_client_cdk::CdkRuntime,
    };

    let balance = ckbtc_client
        .balance_of(Account::from(PrincipalId(this_canister_id)))
        .await
        .unwrap();

    let args = ic_icrc1::endpoints::TransferArg {
        from_subaccount: None,
        to: Account::from(PrincipalId(satoshi_dice_bot_canister_id)),
        fee: None,
        created_at_time: None,
        memo: None,
        amount: (balance / 5).into(),
    };

    let transfer_result = ckbtc_client.transfer(args.clone()).await;

    info!(?args, ?transfer_result, "Attempted to transfer ckBTC to the SatoshiDice bot");
}
