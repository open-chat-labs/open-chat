use crate::guards::caller_is_governance_principal;
use crate::model::models::{AppendChunkResult, MAX_CHUNK_BYTES};
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use personhood_verifier_canister::upload_model_chunk::{Response::*, *};

// Inert until a hash-pinned commit_model activates the upload
#[update(guard = "caller_is_governance_principal", candid = true, msgpack = true)]
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
