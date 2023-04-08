use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use user_index_canister::create_challenge::{Response::*, *};

#[update]
#[trace]
fn create_challenge(_args: Args) -> Response {
    NotRequired
}
