use ic_cdk::{query, update};
use ic_http_certification::{HttpRequest, HttpResponse};
use serde::Serialize;
use std::str;

use crate::{
    definition::definition,
    execute::{execute, ExecuteResponse},
};

#[query]
fn http_request(request: HttpRequest) -> HttpResponse {
    if request.method.to_ascii_uppercase() == "GET" {
        // Return the `bot definition` regardless of the path
        let body = to_json(&definition());

        return text_response(200, body);
    }

    if request.method.to_ascii_uppercase() == "POST" {
        if let Ok(path) = request.get_path() {
            if path == "/execute" {
                return upgrade();
            }
        }
    }

    not_found()
}

#[update]
async fn http_request_update(request: HttpRequest) -> HttpResponse {
    if request.method.to_ascii_uppercase() == "POST" {
        if let Ok(path) = request.get_path() {
            if path == "/execute" {
                let (status_code, body) = match str::from_utf8(&request.body) {
                    Ok(access_token) => match execute(access_token).await {
                        ExecuteResponse::Success(result) => (200, to_json(&result)),
                        ExecuteResponse::BadRequest(bad_request) => (400, to_json(&bad_request)),
                        ExecuteResponse::InternalError(internal_error) => (500, to_json(&internal_error)),
                    },
                    Err(error) => (400, format!("Invalid access token: {:?}", error)),
                };

                return text_response(status_code, body);
            }
        }
    }

    not_found()
}

fn text_response(status_code: u16, body: String) -> HttpResponse {
    HttpResponse {
        status_code,
        headers: vec![
            ("content-type".to_string(), "text/plain".to_string()),
            ("content-length".to_string(), body.len().to_string()),
            ("Access-Control-Allow-Origin".to_string(), "*".to_string()),
            ("Access-Control-Allow-Headers".to_string(), "*".to_string()),
        ],
        body: body.into_bytes(),
        upgrade: Some(false),
    }
}

fn not_found() -> HttpResponse {
    HttpResponse {
        status_code: 404,
        headers: Vec::new(),
        body: Vec::new(),
        upgrade: None,
    }
}

fn upgrade() -> HttpResponse {
    HttpResponse {
        status_code: 200,
        headers: vec![
            ("Access-Control-Allow-Origin".to_string(), "*".to_string()),
            ("Access-Control-Allow-Headers".to_string(), "*".to_string()),
        ],
        body: Vec::new(),
        upgrade: Some(true),
    }
}

fn to_json<T>(value: &T) -> String
where
    T: ?Sized + Serialize,
{
    serde_json::to_string(value).unwrap()
}
