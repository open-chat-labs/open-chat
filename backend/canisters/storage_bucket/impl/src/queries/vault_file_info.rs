use crate::{RuntimeState, read_state};
use canister_api_macros::query;
use storage_bucket_canister::vault_file_info::{Response::*, *};

#[query(candid = true, msgpack = true)]
fn vault_file_info(args: Args) -> Response {
    read_state(|state| vault_file_info_impl(args, state))
}

fn vault_file_info_impl(args: Args, state: &RuntimeState) -> Response {
    if !state.data.vault.is_reviewer(&state.env.caller()) {
        return NotAuthorized;
    }

    let Some((hash, mime_type)) = state
        .data
        .vault
        .record_for_file(&args.file_id)
        .map(|r| (r.hash, r.mime_type.clone()))
    else {
        return NotFound;
    };
    let size = state.data.files.data_size(&hash).unwrap_or_default();

    Success(SuccessResult {
        hash: hex::encode(hash),
        mime_type,
        size,
    })
}
