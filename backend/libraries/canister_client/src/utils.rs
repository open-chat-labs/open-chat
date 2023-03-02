use crate::TestIdentity;
use candid::{CandidType, Principal};
use ic_agent::agent::http_transport::ReqwestHttpReplicaV2Transport;
use ic_agent::identity::BasicIdentity;
use ic_agent::Agent;
use ic_utils::interfaces::ManagementCanister;
use itertools::Itertools;
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
    let pem_file_path = home_dir.join(Path::new(&format!(".config/dfx/identity/{name}/identity.pem")));
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

pub async fn set_controllers(
    management_canister: &ManagementCanister<'_>,
    canister_id: &CanisterId,
    controllers: Vec<Principal>,
) {
    let mut request = management_canister.update_settings(canister_id);
    for controller in controllers {
        request = request.with_controller(controller);
    }
    request.call_and_wait().await.expect("Failed to set controllers");
}

pub async fn install_wasm<A: CandidType + Sync + Send>(
    management_canister: &ManagementCanister<'_>,
    canister_id: &CanisterId,
    wasm_bytes: &[u8],
    init_args: A,
) {
    management_canister
        .install_code(canister_id, wasm_bytes)
        .with_arg(init_args)
        .call_and_wait()
        .await
        .expect("Failed to install wasm");
}

pub fn get_canister_wasm(canister_name: impl ToString, version: Version) -> CanisterWasm {
    let mut local_bin_path =
        PathBuf::from(std::env::var("CARGO_MANIFEST_DIR").expect("Failed to read CARGO_MANIFEST_DIR env variable"));
    local_bin_path.push("local-bin");

    let file_name = file_by_prefix(&canister_name.to_string(), &local_bin_path)
        .unwrap_or_else(|| panic!("Couldn't find file for canister '{}'", canister_name.to_string()));

    let file_path = local_bin_path.join(file_name);
    let bytes = read_file(file_path);

    CanisterWasm { module: bytes, version }
}

pub fn read_file(file_path: PathBuf) -> Vec<u8> {
    let mut file = File::open(&file_path).unwrap_or_else(|_| panic!("Failed to open file: {}", file_path.to_str().unwrap()));
    let mut bytes = Vec::new();
    file.read_to_end(&mut bytes).expect("Failed to read file");
    bytes
}

pub fn is_mainnet(url: &str) -> bool {
    url.contains("ic0.app")
}

fn file_by_prefix(file_name_prefix: &str, dir: &PathBuf) -> Option<String> {
    let dir = std::fs::read_dir(dir).unwrap();

    dir.filter_map(|f| f.ok())
        .filter_map(|f| f.file_name().to_str().map(|s| s.to_string()))
        .filter(|f| f.starts_with(file_name_prefix))
        .sorted_unstable_by_key(|f| f.len())
        .next()
}
