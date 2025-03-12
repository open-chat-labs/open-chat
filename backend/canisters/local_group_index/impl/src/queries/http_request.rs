use crate::{read_state, RuntimeState};
use http_request::{build_json_response, encode_logs, extract_route, Route};
use ic_cdk::query;
use serde::Serialize;
use std::collections::{BTreeMap, HashMap};
use types::{BuildVersion, CanisterId, CyclesTopUpHumanReadable, HttpRequest, HttpResponse, TimestampMillis};

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

        build_json_response(&TopUps {
            total,
            top_ups: top_ups.iter().map(|c| c.into()).collect(),
        })
    }

    fn get_group_canister_versions(state: &RuntimeState) -> HttpResponse {
        let mut map = BTreeMap::new();
        for (group_id, group) in state.data.local_groups.iter() {
            let version = map.entry(group.wasm_version).or_insert(CanisterVersion {
                version: group.wasm_version,
                count: 0,
                canisters: Vec::new(),
            });
            version.count += 1;
            if version.canisters.len() < 100 {
                version.canisters.push((*group_id).into());
            }
        }
        let vec: Vec<_> = map.values().collect();
        build_json_response(&vec)
    }

    fn get_community_canister_versions(state: &RuntimeState) -> HttpResponse {
        let mut map = BTreeMap::new();
        for (community_id, community) in state.data.local_communities.iter() {
            let version = map.entry(community.wasm_version).or_insert(CanisterVersion {
                version: community.wasm_version,
                count: 0,
                canisters: Vec::new(),
            });
            version.count += 1;
            if version.canisters.len() < 100 {
                version.canisters.push((*community_id).into());
            }
        }
        let vec: Vec<_> = map.values().collect();
        build_json_response(&vec)
    }

    match extract_route(&request.url) {
        Route::Errors(since) => get_errors_impl(since),
        Route::Logs(since) => get_logs_impl(since),
        Route::Traces(since) => get_traces_impl(since),
        Route::Metrics => read_state(get_metrics_impl),
        Route::Other(p, qs) if p == "top_ups" => read_state(|state| get_top_ups(qs, state)),
        Route::Other(p, _) if p == "group_canister_versions" => read_state(get_group_canister_versions),
        Route::Other(p, _) if p == "community_canister_versions" => read_state(get_community_canister_versions),
        _ => HttpResponse::not_found(),
    }
}

#[derive(Serialize)]
struct TopUps {
    total: f64,
    top_ups: Vec<CyclesTopUpHumanReadable>,
}

#[derive(Serialize)]
struct CanisterVersion {
    version: BuildVersion,
    count: u32,
    canisters: Vec<CanisterId>,
}
