use crate::guards::caller_is_multi_user_canister_migrating_to;
use canister_api_macros::update;
use constants::ONE_MB;
use serde_bytes::ByteBuf;
use user_canister::c2c_export_user_stable_memory::{Response::*, *};

// Called by the MultiUser canister the user is being migrated to, to pull the entries in the stable
// memory map, all of which are the user's. The canister is frozen, so they can't change meanwhile.
#[update(guard = "caller_is_multi_user_canister_migrating_to", msgpack = true)]
fn c2c_export_user_stable_memory(args: Args) -> Response {
    let result = stable_memory_map::read_all_entries(args.after.as_deref().map(|k| k.as_slice()), ONE_MB as usize);

    Success(SuccessResult {
        entries: result
            .entries
            .into_iter()
            .map(|(key, value)| (ByteBuf::from(key), ByteBuf::from(value)))
            .collect(),
        finished: result.finished,
    })
}
