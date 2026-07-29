use crate::read_state;
use canister_api_macros::query;
use storage_index_canister::vault_buckets::{Response::*, *};

#[query(candid = true, msgpack = true)]
fn vault_buckets(_args: Args) -> Response {
    read_state(|state| {
        Success(SuccessResult {
            buckets: state.data.buckets.iter().map(|b| b.canister_id).collect(),
        })
    })
}
