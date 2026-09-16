use canister_api_macros::update;
use canister_tracing_macros::trace;
use user_canister::add_hot_group_exclusions;

#[update(msgpack = true)]
#[trace]
fn add_hot_group_exclusions(_args: add_hot_group_exclusions::Args) -> add_hot_group_exclusions::Response {
    unimplemented!()
}

#[update(msgpack = true)]
#[trace]
fn add_recommended_group_exclusions(_args: add_hot_group_exclusions::Args) -> add_hot_group_exclusions::Response {
    unimplemented!()
}
