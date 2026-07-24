use crate::{RuntimeState, calc_chunk_count, mutate_state};
use canister_tracing_macros::trace;
use ic_cdk::update;
use storage_bucket_canister::vault_file_chunk::{Response::*, *};

const VAULT_CHUNK_SIZE_BYTES: u32 = 1 << 20; // 1MB

// Streams a quarantined blob to an allowlisted vault reviewer. Deliberately an update call (not
// a query) so that fetching cannot happen without writing to the vault's tamper-evident access
// log. Only the first chunk of a fetch is logged: chunk 0 corresponds 1:1 with the reviewer's
// explicit "Review" action, and subsequent chunks are its mechanical continuation (this also
// bounds log growth to deliberate review acts).
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

    let start = (args.chunk_index as usize) * (VAULT_CHUNK_SIZE_BYTES as usize);
    let end = std::cmp::min(start + VAULT_CHUNK_SIZE_BYTES as usize, bytes.len());

    if args.chunk_index == 0 {
        let now = state.env.now();
        state.data.vault.log_view(args.file_id, caller, args.chunk_index, now);
    }

    Success(SuccessResult {
        bytes: bytes[start..end].to_vec(),
        chunk_index: args.chunk_index,
        chunk_count,
        total_size,
        mime_type,
    })
}
