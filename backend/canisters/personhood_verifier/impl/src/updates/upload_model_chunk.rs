use crate::guards::caller_can_upload_model_chunks;
use crate::model::models::{AppendChunkResult, MAX_CHUNK_BYTES};
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use personhood_verifier_canister::upload_model_chunk::{Response::*, *};

// Inert until a hash-pinned commit_model activates the upload, hence the
// wider whitelist guard: in production the dev team uploads chunks directly
// (~180 x 1MB calls for the embedding model - far too many for proposals)
// and only the activation goes through governance
#[update(guard = "caller_can_upload_model_chunks", candid = true, msgpack = true)]
#[trace]
fn upload_model_chunk(args: Args) -> Response {
    mutate_state(|state| upload_model_chunk_impl(args, state))
}

fn upload_model_chunk_impl(args: Args, state: &mut RuntimeState) -> Response {
    if args.chunk.len() > MAX_CHUNK_BYTES {
        return ChunkTooLarge;
    }
    match state
        .data
        .models
        .append_chunk(args.kind, args.chunk_index, args.chunk.into_vec())
    {
        AppendChunkResult::Success => Success,
        AppendChunkResult::UnexpectedIndex { expected } => UnexpectedChunkIndex { expected },
    }
}
