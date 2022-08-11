use crate::utils::{create_empty_canister, delay, install_wasm, read_file_from_local_bin};
use candid::CandidType;
use ic_agent::Agent;
use ic_utils::interfaces::ManagementCanister;
use types::{CanisterId, Cycles};

pub async fn create_cycles_wallet(management_canister: &ManagementCanister<'_>) -> CanisterId {
    print!("Creating cycles wallet canister... ");
    let cycles_wallet_canister_id = create_empty_canister(management_canister).await;
    println!("Ok. Canister id: {}", cycles_wallet_canister_id);
    let cycles_wallet_wasm = read_file_from_local_bin("cycles_wallet.wasm");
    print!("Installing cycles wallet... ");
    install_wasm(management_canister, &cycles_wallet_canister_id, &cycles_wallet_wasm, ()).await;
    println!("Ok");
    cycles_wallet_canister_id
}

pub async fn send_cycles(agent: &Agent, cycles_wallet_canister_id: &CanisterId, recipient: CanisterId, cycles: Cycles) {
    agent
        .update(cycles_wallet_canister_id, "wallet_send")
        .with_arg(
            candid::encode_one(SendCyclesArgs {
                amount: cycles as u64,
                canister: recipient,
            })
            .unwrap(),
        )
        .call_and_wait(delay())
        .await
        .unwrap();
}

#[derive(CandidType)]
struct SendCyclesArgs {
    canister: CanisterId,
    amount: u64,
}
