use crate::guards::caller_is_multi_user_canister_migrating_to;
use crate::{PAGE_SIZE, RuntimeState, read_state};
use canister_api_macros::update;
use serde_bytes::ByteBuf;
use std::cmp::min;
use user_canister::c2c_export_user::{Response::*, *};

// Called by the MultiUser canister the user is being migrated to, to pull the user as they were
// serialized when the migration started
#[update(guard = "caller_is_multi_user_canister_migrating_to", msgpack = true)]
fn c2c_export_user(args: Args) -> Response {
    read_state(|state| c2c_export_user_impl(args, state))
}

fn c2c_export_user_impl(args: Args, state: &RuntimeState) -> Response {
    let bytes = state.data.migration.as_ref().map(|m| m.user.as_slice()).unwrap_or_default();
    let from = min(usize::try_from(args.from).unwrap_or(usize::MAX), bytes.len());
    let to = min(from.saturating_add(PAGE_SIZE as usize), bytes.len());

    Success(ByteBuf::from(bytes[from..to].to_vec()))
}
