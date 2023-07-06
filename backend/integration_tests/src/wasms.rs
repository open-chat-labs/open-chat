use crate::utils::local_bin;
use lazy_static::lazy_static;
use std::fs::File;
use std::io::Read;
use types::{CanisterWasm, Version};

lazy_static! {
    pub static ref COMMUNITY: CanisterWasm = get_canister_wasm("community");
    pub static ref CYCLES_DISPENSER: CanisterWasm = get_canister_wasm("cycles_dispenser");
    pub static ref CYCLES_MINTING_CANISTER: CanisterWasm = get_canister_wasm("cycles_minting_canister");
    pub static ref GROUP: CanisterWasm = get_canister_wasm("group");
    pub static ref GROUP_INDEX: CanisterWasm = get_canister_wasm("group_index");
    pub static ref ICP_LEDGER: CanisterWasm = get_canister_wasm("icp_ledger");
    pub static ref LOCAL_GROUP_INDEX: CanisterWasm = get_canister_wasm("local_group_index");
    pub static ref LOCAL_USER_INDEX: CanisterWasm = get_canister_wasm("local_user_index");
    pub static ref NOTIFICATIONS: CanisterWasm = get_canister_wasm("notifications");
    pub static ref NOTIFICATIONS_INDEX: CanisterWasm = get_canister_wasm("notifications_index");
    pub static ref ONLINE_USERS: CanisterWasm = get_canister_wasm("online_users");
    pub static ref PROPOSALS_BOT: CanisterWasm = get_canister_wasm("proposals_bot");
    pub static ref REGISTRY: CanisterWasm = get_canister_wasm("registry");
    pub static ref SNS_WASM: CanisterWasm = get_canister_wasm("sns_wasm");
    pub static ref STORAGE_BUCKET: CanisterWasm = get_canister_wasm("storage_bucket");
    pub static ref STORAGE_INDEX: CanisterWasm = get_canister_wasm("storage_index");
    pub static ref USER: CanisterWasm = get_canister_wasm("user");
    pub static ref USER_INDEX: CanisterWasm = get_canister_wasm("user_index");
}

fn get_canister_wasm(canister_name: &str) -> CanisterWasm {
    let module = read_file_from_local_bin(&format!("{canister_name}.wasm.gz"));

    CanisterWasm {
        version: Version::min(),
        module,
    }
}

fn read_file_from_local_bin(file_name: &str) -> Vec<u8> {
    let mut file_path = local_bin();
    file_path.push(file_name);

    let mut file = File::open(&file_path).unwrap_or_else(|_| panic!("Failed to open file: {}", file_path.to_str().unwrap()));
    let mut bytes = Vec::new();
    file.read_to_end(&mut bytes).expect("Failed to read file");
    bytes
}
