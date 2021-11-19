use crate::{CanisterName, TestIdentity};
use candid::{CandidType, Principal};
use ic_agent::agent::http_transport::ReqwestHttpReplicaV2Transport;
use ic_agent::identity::BasicIdentity;
use ic_agent::Agent;
use ic_utils::interfaces::ManagementCanister;
use ic_utils::Canister;
use std::fs::File;
use std::io::Read;
use std::path::{Path, PathBuf};
use types::{CanisterId, CanisterWasm, Version};

const CONTROLLER_PEM: &str = include_str!("../keys/controller.pem");
const USER1_PEM: &str = include_str!("../keys/user1.pem");
const USER2_PEM: &str = include_str!("../keys/user2.pem");
const USER3_PEM: &str = include_str!("../keys/user3.pem");

pub fn get_dfx_identity(name: &str) -> BasicIdentity {
    let home_dir = dirs::home_dir().expect("Failed to get home directory");
    let pem_file_path = home_dir.join(Path::new(&format!(".config/dfx/identity/{}/identity.pem", name)));
    BasicIdentity::from_pem_file(pem_file_path).expect("Failed to create identity")
}

pub fn build_identity(identity: TestIdentity) -> BasicIdentity {
    let pem = match identity {
        TestIdentity::Controller => CONTROLLER_PEM,
        TestIdentity::User1 => USER1_PEM,
        TestIdentity::User2 => USER2_PEM,
        TestIdentity::User3 => USER3_PEM,
    };

    BasicIdentity::from_pem(pem.as_bytes()).expect("Failed to create identity")
}

pub async fn build_ic_agent(url: String, identity: BasicIdentity) -> Agent {
    let mainnet = is_mainnet(&url);
    let transport = ReqwestHttpReplicaV2Transport::create(url).expect("Failed to create Reqwest transport");
    let timeout = std::time::Duration::from_secs(60 * 5);

    let agent = Agent::builder()
        .with_transport(transport)
        .with_identity(identity)
        .with_ingress_expiry(Some(timeout))
        .build()
        .expect("Failed to build IC agent");

    if !mainnet {
        agent.fetch_root_key().await.expect("Couldn't fetch root key");
    }

    agent
}

pub fn build_management_canister(agent: &Agent) -> Canister<ManagementCanister> {
    Canister::builder()
        .with_agent(agent)
        .with_canister_id(Principal::management_canister())
        .with_interface(ManagementCanister)
        .build()
        .unwrap()
}

const TEN_TRILLION: u64 = 10_000_000_000_000;
pub async fn create_empty_canister(management_canister: &Canister<'_, ManagementCanister>) -> CanisterId {
    let (canister_id,) = management_canister
        .create_canister()
        .as_provisional_create_with_amount(Some(TEN_TRILLION))
        .call_and_wait(delay())
        .await
        .expect("Failed to create canister");

    canister_id
}

pub async fn install_wasm<A: CandidType + Sync + Send>(
    management_canister: &Canister<'_, ManagementCanister>,
    canister_id: &CanisterId,
    wasm_bytes: &[u8],
    init_args: A,
) {
    management_canister
        .install_code(canister_id, wasm_bytes)
        .with_arg(init_args)
        .call_and_wait(delay())
        .await
        .expect("Failed to install wasm");
}

pub fn get_canister_wasm(canister_name: CanisterName, version: Version, compressed: bool) -> CanisterWasm {
    let mut file_name = canister_name.to_string() + "_canister_impl-opt.wasm";
    if compressed {
        file_name += ".xz";
    }
    let bytes = read_file_from_local_bin(&file_name);

    CanisterWasm {
        module: bytes,
        compressed,
        version,
    }
}

pub fn read_file_from_local_bin(file_name: &str) -> Vec<u8> {
    let mut file_path =
        PathBuf::from(std::env::var("CARGO_MANIFEST_DIR").expect("Failed to read CARGO_MANIFEST_DIR env variable"));
    file_path.push("local-bin");
    file_path.push(&file_name);

    let mut file = File::open(&file_path).unwrap_or_else(|_| panic!("Failed to open file: {}", file_path.to_str().unwrap()));
    let mut bytes = Vec::new();
    file.read_to_end(&mut bytes).expect("Failed to read file");
    bytes
}

// How `Agent` is instructed to wait for update calls.
pub fn delay() -> garcon::Delay {
    garcon::Delay::builder()
        .throttle(std::time::Duration::from_millis(500))
        .timeout(std::time::Duration::from_secs(60 * 5))
        .build()
}

pub fn is_mainnet(url: &str) -> bool {
    url.contains("ic0.app")
}
