use crate::{RuntimeState, calc_chunk_count, mutate_state};
use canister_tracing_macros::trace;
use ic_cdk::update;
use storage_bucket_canister::vault_file_chunk::{Response::*, *};

const VAULT_CHUNK_SIZE_BYTES: u32 = 1 << 20; // 1MB

// Streams a quarantined blob to an allowlisted vault reviewer. Deliberately an update call (not
// a query) so that every fetch writes an entry to the vault's tamper-evident access log — each
// log entry corresponds 1:1 to an explicit, deliberate review act.
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

    let Some(hash) = state.data.vault.hash_for_file(&args.file_id) else {
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

    let mime_type = state.data.files.get(&args.file_id).map(|f| f.mime_type).unwrap_or_default();

    let now = state.env.now();
    state.data.vault.log_view(args.file_id, caller, args.chunk_index, now);

    Success(SuccessResult {
        bytes: bytes[start..end].to_vec(),
        chunk_index: args.chunk_index,
        chunk_count,
        total_size,
        mime_type,
    })
}
