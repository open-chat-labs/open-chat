use crate::{read_state, RuntimeState};
use http_request::{build_json_response, encode_logs, extract_route, Route};
use ic_cdk_macros::query;
use serde::Serialize;
use std::collections::BTreeMap;
use types::{BuildVersion, HttpRequest, HttpResponse, TimestampMillis, UserId};

#[query]
fn http_request(request: HttpRequest) -> HttpResponse {
    fn get_logs_impl(since: Option<TimestampMillis>) -> HttpResponse {
        encode_logs(canister_logger::export_logs(), since.unwrap_or(0))
    }

    fn get_traces_impl(since: Option<TimestampMillis>) -> HttpResponse {
        encode_logs(canister_logger::export_traces(), since.unwrap_or(0))
    }

    fn get_metrics_impl(state: &RuntimeState) -> HttpResponse {
        build_json_response(&state.metrics())
    }

    fn get_user_canister_versions(state: &RuntimeState) -> HttpResponse {
        let mut map = BTreeMap::new();
        for (user_id, user) in state.data.local_users.iter() {
            let version = map.entry(user.wasm_version).or_insert(UserCanisterVersion {
                version: user.wasm_version,
                count: 0,
                users: Vec::new(),
            });
            version.count += 1;
            if version.users.len() < 100 {
                version.users.push(*user_id);
            }
        }
        let vec: Vec<_> = map.values().collect();
        build_json_response(&vec)
    }

    match extract_route(&request.url) {
        Route::Logs(since) => get_logs_impl(since),
        Route::Traces(since) => get_traces_impl(since),
        Route::Metrics => read_state(get_metrics_impl),
        Route::Other(p, _) if p == "user_canister_versions" => read_state(get_user_canister_versions),
        _ => HttpResponse::not_found(),
    }
}

#[derive(Serialize)]
struct UserCanisterVersion {
    version: BuildVersion,
    count: u32,
    users: Vec<UserId>,
}
