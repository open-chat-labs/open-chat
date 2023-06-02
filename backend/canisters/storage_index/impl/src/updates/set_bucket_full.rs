use crate::guards::caller_is_governance_principal;
use crate::{mutate_state, RuntimeState};
use canister_api_macros::proposal;
use canister_tracing_macros::trace;
use storage_index_canister::set_bucket_full::{Response::*, *};

// dfx canister --network ic call index set_bucket_full '(record { bucket = principal "r2x27-giaaa-aaaaf-aabba-cai"; full = true })'
#[proposal(guard = "caller_is_governance_principal")]
#[trace]
fn set_bucket_full(args: Args) -> Response {
    mutate_state(|state| set_bucket_full_impl(args, state))
}

fn set_bucket_full_impl(args: Args, state: &mut RuntimeState) -> Response {
    state.data.buckets.set_full(args.bucket, args.full);
    Success
}
