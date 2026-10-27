use crate::{State, read_state};
use canister_logger::LogEntry;
use ic_cdk::query;
use ic_ledger_types::{AccountIdentifier, DEFAULT_SUBACCOUNT};
use serde::Serialize;
use std::io::Write;
use types::{Cycles, HeaderField, HttpRequest, HttpResponse, TimestampMillis};

#[query]
fn http_request(request: HttpRequest) -> HttpResponse {
    let url = request.url.to_lowercase();
    let (path, query) = url.split_once('?').unwrap_or((&url, ""));

    match path.trim_matches('/') {
        "ledger_account" => read_state(get_ledger_account_impl),
        "logs" => encode_logs(canister_logger::export_logs()),
        "metrics" => read_state(|state| to_json_response(&state.metrics())),
        "trace" => encode_logs(canister_logger::export_traces()),
        "latest_top_ups" => read_state(get_latest_top_ups_impl),
        "cycles_balance_samples" => {
            let since: Option<TimestampMillis> = query.split('&').find_map(|param| param.strip_prefix("since=")?.parse().ok());
            read_state(|state| get_cycles_balance_samples_impl(since, state))
        }
        _ => HttpResponse::not_found(),
    }
}

fn encode_logs(logs: Vec<LogEntry>) -> HttpResponse {
    let mut body = Vec::new();

    for log in logs {
        writeln!(&mut body, "{}", log.message).unwrap();
    }

    HttpResponse {
        status_code: 200,
        headers: vec![
            HeaderField("Content-Type".to_string(), "text/plain".to_string()),
            HeaderField("Content-Length".to_string(), body.len().to_string()),
        ],
        body,
        streaming_strategy: None,
        upgrade: None,
    }
}

fn to_json_response<T: Serialize>(data: &T) -> HttpResponse {
    let body = serde_json::to_string(data).unwrap().into_bytes();

    HttpResponse {
        status_code: 200,
        headers: vec![
            HeaderField("Content-Type".to_string(), "application/json".to_string()),
            HeaderField("Content-Length".to_string(), body.len().to_string()),
        ],
        body,
        streaming_strategy: None,
        upgrade: None,
    }
}

fn get_ledger_account_impl(state: &State) -> HttpResponse {
    let ledger_account = AccountIdentifier::new(&state.env.canister_id(), &DEFAULT_SUBACCOUNT).to_string();

    let body = ledger_account.into_bytes();

    HttpResponse {
        status_code: 200,
        headers: vec![
            HeaderField("Content-Type".to_string(), "text/plain".to_string()),
            HeaderField("Content-Length".to_string(), body.len().to_string()),
        ],
        body,
        streaming_strategy: None,
        upgrade: None,
    }
}

fn get_latest_top_ups_impl(state: &State) -> HttpResponse {
    let top_ups = state.data.canisters.latest_top_ups(200);

    to_json_response(&top_ups)
}

// The samples taken at or after `since` if given, else all of them. They're held in the order they
// were taken, so in time order.
fn get_cycles_balance_samples_impl(since: Option<TimestampMillis>, state: &State) -> HttpResponse {
    let all = &state.data.cycles_balance_samples;
    let start = since.map_or(0, |since| all.partition_point(|s| s.timestamp < since));
    let samples: Vec<_> = all[start..]
        .iter()
        .map(|s| CyclesBalanceSample {
            timestamp: s.timestamp,
            cycles_balance: s.value,
        })
        .collect();

    to_json_response(&samples)
}

#[derive(Serialize)]
struct CyclesBalanceSample {
    timestamp: TimestampMillis,
    cycles_balance: Cycles,
}
