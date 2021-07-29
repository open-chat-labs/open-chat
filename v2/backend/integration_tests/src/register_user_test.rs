use ic_fondue::internet_computer::{InternetComputer, Subnet};
use ic_registry_subnet_type::SubnetType;
use ic_fondue::ic_manager::{IcHandle, IcManager};
use crate::utils::*;
use fondue::pot;
use ic_agent::Identity;

pub fn config() -> InternetComputer {
    InternetComputer::new()
        .add_fast_single_node_subnet(SubnetType::System)
        .add_fast_single_node_subnet(SubnetType::Application)
}

pub fn setup() -> pot::Setup<IcManager> {
    // Box::new(|man, ctx| {
    //     ekg::basic_monitoring(
    //         ctx,
    //         &mut man.handle().pipeline_registry.as_ref().unwrap().clone(),
    //     );
    // })
    Box::new(|_man, _ctx| {})
}

pub fn register_user_test(handle: IcHandle, ctx: &fondue::pot::Context) {
    block_on(register_user_test_impl(handle, ctx));
}

async fn register_user_test_impl(handle: IcHandle, ctx: &fondue::pot::Context) {
    let endpoints: Vec<_> = handle.public_api_endpoints.iter().collect();

    assert_all_ready(&endpoints, ctx).await;

    let url = handle.public_api_endpoints
        .into_iter()
        .find(|e| e.initial_subnet_type == SubnetType::Application)
        .map(|e| e.url)
        .expect("Failed to find verified application subnet");

    let identity = build_identity(TestIdentity::Controller);

    // panic!(format!("{:?}", identity.sender().map(|p| p.to_text())));

    let agent = build_ic_agent(url.to_string(), identity).await;
    let management_canister = build_management_canister(&agent);

    let canister_id = management_canister
        .create_canister()
        .as_provisional_create_with_amount(None)
        .call_and_wait(delay())
        .await
        .expect("Failed to create canister");
}