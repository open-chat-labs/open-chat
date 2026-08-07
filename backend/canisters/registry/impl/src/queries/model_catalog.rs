use crate::{RuntimeState, read_state};
use canister_api_macros::query;
use canister_tracing_macros::trace;
use registry_canister::model_catalog::{Response::*, *};

// The current on-device model catalog. Empty `models` ⇒ the client uses its built-in default (fallback).
#[query(candid = true, msgpack = true)]
#[trace]
fn model_catalog(_args: Args) -> Response {
    read_state(model_catalog_impl)
}

fn model_catalog_impl(state: &RuntimeState) -> Response {
    Success(state.data.model_catalog.value.clone())
}
