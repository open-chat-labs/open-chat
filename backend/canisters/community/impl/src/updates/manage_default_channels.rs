use crate::run_regular_jobs;
use canister_tracing_macros::trace;
use community_canister::manage_default_channels::{Response::*, *};
use ic_cdk_macros::update;

#[update]
#[trace]
fn manage_default_channels(_args: Args) -> Response {
    run_regular_jobs();
    Success
}
