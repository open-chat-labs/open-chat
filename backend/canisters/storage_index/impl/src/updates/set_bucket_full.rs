use crate::guards::caller_is_service_principal;
use crate::{mutate_state, RuntimeState};
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use storage_index_canister::set_bucket_full::{Response::*, *};

// dfx canister --network ic call index set_bucket_full '(record { bucket = principal "r2x27-giaaa-aaaaf-aabba-cai"; full = true })'
#[update(guard = "caller_is_service_principal")]
#[trace]
fn set_bucket_full(args: Args) -> Response {
    mutate_state(|state| set_bucket_full_impl(args, state))
}

fn set_bucket_full_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    runtime_state.data.buckets.set_full(args.bucket, args.full);
    Success
}
