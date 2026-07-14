use crate::{RuntimeState, read_state};
use canister_api_macros::query;
use canister_tracing_macros::trace;
use personhood_verifier_canister::model_info::{Response::*, *};

#[query(msgpack = true)]
#[trace]
fn model_info(_args: Args) -> Response {
    read_state(model_info_impl)
}

fn model_info_impl(state: &RuntimeState) -> Response {
    Success(ModelInfo {
        current_model_version: state.data.current_model_version,
        enrolled_embeddings: state.data.embeddings.count(state.data.current_model_version) as u64,
    })
}
