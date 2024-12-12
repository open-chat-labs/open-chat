use crate::{read_state, RuntimeState};
use http_request::{build_json_response, encode_logs, extract_route, Route};
use ic_cdk::query;
use serde::Serialize;
use std::collections::HashMap;
use types::{CanisterId, Cycles, CyclesTopUp, HttpRequest, HttpResponse, TimestampMillis};

#[query]
fn http_request(request: HttpRequest) -> HttpResponse {
    fn get_errors_impl(since: Option<TimestampMillis>) -> HttpResponse {
        encode_logs(canister_logger::export_errors(), since.unwrap_or(0))
    }

    fn get_logs_impl(since: Option<TimestampMillis>) -> HttpResponse {
        encode_logs(canister_logger::export_logs(), since.unwrap_or(0))
    }

    fn get_traces_impl(since: Option<TimestampMillis>) -> HttpResponse {
        encode_logs(canister_logger::export_traces(), since.unwrap_or(0))
    }

    fn get_metrics_impl(state: &RuntimeState) -> HttpResponse {
        build_json_response(&state.metrics())
    }

    fn get_top_ups(qs: HashMap<String, String>, state: &RuntimeState) -> HttpResponse {
        let canister_id = CanisterId::from_text(qs.get("canister_id").unwrap()).unwrap();

        let top_ups = if let Some(group) = state.data.local_groups.get(&canister_id.into()) {
            &group.cycle_top_ups
        } else if let Some(community) = state.data.local_communities.get(&canister_id.into()) {
            &community.cycle_top_ups
        } else {
            return HttpResponse::not_found();
        };

        let total = top_ups.iter().map(|c| c.amount).sum::<u128>() as f64 / 1_000_000_000_000f64;

        build_json_response(&TopUps { total, top_ups })
    }

    match extract_route(&request.url) {
        Route::Errors(since) => get_errors_impl(since),
        Route::Logs(since) => get_logs_impl(since),
        Route::Traces(since) => get_traces_impl(since),
        Route::Metrics => read_state(get_metrics_impl),
        Route::Other(p, qs) if p == "top_ups" => read_state(|state| get_top_ups(qs, state)),
        _ => HttpResponse::not_found(),
    }
}

#[derive(Serialize)]
struct TopUps<'a> {
    total: f64,
    top_ups: &'a [CyclesTopUp],
}
