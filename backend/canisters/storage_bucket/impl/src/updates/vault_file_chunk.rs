use crate::{RuntimeState, calc_chunk_count, mutate_state};
use canister_tracing_macros::trace;
use ic_cdk::update;
use storage_bucket_canister::vault_file_chunk::{Response::*, *};

const VAULT_CHUNK_SIZE_BYTES: u32 = 1 << 20; // 1MB

// Streams a quarantined blob to an allowlisted vault reviewer. Deliberately an update call (not
// a query) so that fetching cannot happen outside a logged session: chunk 0 is the deliberate
// "Review" act — it is logged and opens a sequential read session — and later chunks are served
// only in session order, so no bytes are ever fetched unlogged while log growth stays bounded
// to review acts.
// Perf note: blob_bytes copies the full blob per chunk call (matching the existing http_request
// pattern); a ranged read from stable storage is the eventual fix if vault media grows large.
#[update]
#[trace]
fn vault_file_chunk(args: Args) -> Response {
    mutate_state(|state| vault_file_chunk_impl(args, state))
}

fn vault_file_chunk_impl(args: Args, state: &mut RuntimeState) -> Response {
    let caller = state.env.caller();
    if !state.data.vault.is_reviewer(&caller) {
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
    let Some(bytes) = state.data.files.blob_bytes(&hash) else {
        return NotFound;
    };

    let total_size = bytes.len() as u64;
    let chunk_count = calc_chunk_count(VAULT_CHUNK_SIZE_BYTES, total_size);
    if args.chunk_index >= chunk_count {
        return NotFound;
    }

    let now = state.env.now();
    if !state
        .data
        .vault
        .authorize_view(args.file_id, caller, args.chunk_index, chunk_count, now)
    {
        return SessionRequired;
    }

    let start = (args.chunk_index as usize) * (VAULT_CHUNK_SIZE_BYTES as usize);
    let end = std::cmp::min(start + VAULT_CHUNK_SIZE_BYTES as usize, bytes.len());

    Success(SuccessResult {
        bytes: bytes[start..end].to_vec(),
        chunk_index: args.chunk_index,
        chunk_count,
        total_size,
        mime_type,
    })
}
