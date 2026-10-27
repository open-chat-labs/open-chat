use crate::{State, read_state};
use canister_logger::LogEntry;
use ic_cdk::query;
use ic_ledger_types::{AccountIdentifier, DEFAULT_SUBACCOUNT};
use serde::Serialize;
use std::io::Write;
use types::{Cycles, HeaderField, HttpRequest, HttpResponse, TimestampMillis};

#[query]
fn http_request(request: HttpRequest) -> HttpResponse {
    let path = request.url.trim_matches('/').to_lowercase();

    match path.as_str() {
        "ledger_account" => read_state(get_ledger_account_impl),
        "logs" => encode_logs(canister_logger::export_logs()),
        "metrics" => read_state(|state| to_json_response(&state.metrics())),
        "trace" => encode_logs(canister_logger::export_traces()),
        "latest_top_ups" => read_state(get_latest_top_ups_impl),
        "cycles_balance_samples" => read_state(get_cycles_balance_samples_impl),
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

fn get_cycles_balance_samples_impl(state: &State) -> HttpResponse {
    let samples: Vec<_> = state
        .data
        .cycles_balance_samples
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
