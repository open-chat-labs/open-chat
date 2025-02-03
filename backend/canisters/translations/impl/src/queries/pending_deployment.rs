use crate::guards::caller_is_deployment_operator;
use crate::RuntimeState;
use crate::{model::translations::TranslationStatus, read_state};
use canister_api_macros::query;
use canister_tracing_macros::trace;
use translations_canister::pending_deployment::{Response::*, *};

#[query(guard = "caller_is_deployment_operator", candid = true, msgpack = true)]
#[trace]
fn pending_deployment(_args: Args) -> Response {
    read_state(pending_deployment_impl)
}

fn pending_deployment_impl(state: &RuntimeState) -> Response {
    let pending = state.data.translations.pending_deployment();

    let latest_approval = pending
        .iter()
        .filter_map(|t| match &t.status {
            TranslationStatus::Approved(s) => Some(s.attribution.when),
            _ => None,
        })
        .max()
        .unwrap_or_default();

    let translations: Vec<_> = pending
        .iter()
        .map(|t| Translation {
            locale: t.locale.clone(),
            key: t.key.clone(),
            value: t.value.clone(),
        })
        .collect();

    Success(SuccessResponse {
        latest_approval,
        translations,
    })
}
