use crate::guards::caller_is_user_controller;
use crate::{RuntimeState, mutate_state};
use canister_tracing_macros::trace;
use ic_cdk::update;
use storage_index_canister::c2c_user_ids_migrated::*;
use types::SuccessOnly;

// Passes the users migrated to MultiUser canisters on to every bucket, which replaces each one's old
// id with their new one among its files' accessors, so that the canister now holding them can delete
// those files
#[update(guard = "caller_is_user_controller")]
#[trace]
fn c2c_user_ids_migrated(args: Args) -> Response {
    mutate_state(|state| c2c_user_ids_migrated_impl(args, state))
}

fn c2c_user_ids_migrated_impl(args: Args, state: &mut RuntimeState) -> Response {
    state.push_user_ids_migrated_to_buckets(args.user_ids);
    SuccessOnly::Success
}
