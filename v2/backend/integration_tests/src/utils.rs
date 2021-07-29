use candid::Principal;
use ic_agent::agent::http_transport::ReqwestHttpReplicaV2Transport;
use ic_agent::identity::BasicIdentity;
use ic_agent::Agent;
use ic_fondue::ic_manager::IcEndpoint;
use ic_utils::interfaces::ManagementCanister;
use ic_utils::Canister;
use std::future::Future;
use tokio::runtime::Runtime as TRuntime;

const CONTROLLER_PEM: &'static str = include_str!("../keys/controller.pem");
const USER1_PEM: &'static str = include_str!("../keys/user1.pem");
const USER2_PEM: &'static str = include_str!("../keys/user2.pem");
const USER3_PEM: &'static str = include_str!("../keys/user3.pem");

pub enum TestIdentity {
    Controller,
    User1,
    User2,
    User3,
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
    let transport = ReqwestHttpReplicaV2Transport::create(url).expect("Failed to create Reqwest transport");
    let timeout = std::time::Duration::from_secs(60 * 5);

    let agent = Agent::builder()
        .with_transport(transport)
        .with_identity(identity)
        .with_ingress_expiry(Some(timeout))
        .build()
        .expect("Failed to build IC agent");

    agent.fetch_root_key().await.expect("Couldn't fetch root key");

    agent
}

pub fn build_management_canister(agent: &Agent) -> Canister<ManagementCanister> {
    Canister::builder()
        .with_agent(&agent)
        .with_canister_id(Principal::management_canister())
        .with_interface(ManagementCanister)
        .build()
        .unwrap()
}

pub async fn assert_all_ready(endpoints: &[&IcEndpoint], ctx: &fondue::pot::Context) {
    for &e in endpoints {
        e.assert_ready(ctx).await;
    }
}

// How `Agent` is instructed to wait for update calls.
pub fn delay() -> garcon::Delay {
    garcon::Delay::builder()
        .throttle(std::time::Duration::from_millis(500))
        .timeout(std::time::Duration::from_secs(60 * 5))
        .build()
}

pub fn block_on<F: Future>(f: F) -> F::Output {
    let rt = TRuntime::new().unwrap_or_else(|err| panic!("Could not create tokio runtime: {}", err));
    rt.block_on(f)
}
