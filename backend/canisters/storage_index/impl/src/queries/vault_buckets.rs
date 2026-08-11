use crate::read_state;
use canister_api_macros::query;
use storage_index_canister::vault_buckets::{Response::*, *};

// Deliberately unguarded: bucket canister ids are already public (every served file URL
// contains one), so enumerating them reveals nothing. Everything vault-sensitive behind these
// ids (vault_log, vault_file_chunk) is reviewer-gated on the buckets themselves.
#[query(candid = true, msgpack = true)]
fn vault_buckets(_args: Args) -> Response {
    read_state(|state| {
        Success(SuccessResult {
            buckets: state.data.buckets.iter().map(|b| b.canister_id).collect(),
        })
    })
}
