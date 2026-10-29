// The bots' HTTPS API: registering a game, and updating it. Every call carries the bot's token from
// the LocalUserIndex.
use crate::app::{ApiError, App};
use crate::now_millis;
use crate::protocol::{RegisterArgs, UpdateArgs};
use axum::Json;
use axum::extract::State;
use axum::http::{HeaderMap, StatusCode, header};
use axum::response::{IntoResponse, Response};
use serde_json::json;
use std::sync::Arc;
use types::UserId;

// A state, with every player's part, is at most this big
pub const MAX_UPDATE_BYTES: usize = 64 * 1024;

pub async fn register(State(app): State<Arc<App>>, headers: HeaderMap, Json(args): Json<RegisterArgs>) -> Response {
    let result = match bot(&app, &headers) {
        Ok(bot) => app.register(bot, &args.registration).await,
        Err(error) => Err(error),
    };
    reply(result)
}

pub async fn update(State(app): State<Arc<App>>, headers: HeaderMap, Json(args): Json<UpdateArgs>) -> Response {
    let result = match bot(&app, &headers) {
        Ok(bot) => app.update(bot, args).await,
        Err(error) => Err(error),
    };
    reply(result)
}

// The service's public key, which bots verify its tokens with
pub async fn public_key(State(app): State<Arc<App>>) -> String {
    app.tokens.public_key_pem().to_string()
}

fn bot(app: &App, headers: &HeaderMap) -> Result<UserId, ApiError> {
    headers
        .get(header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.strip_prefix("Bearer "))
        .and_then(|token| app.tokens.bot(token, now_millis()))
        .ok_or(ApiError {
            status: 401,
            message: "Invalid bot token".to_string(),
        })
}

fn reply(result: Result<(), ApiError>) -> Response {
    match result {
        Ok(()) => Json(json!({})).into_response(),
        Err(error) => (
            StatusCode::from_u16(error.status).unwrap_or(StatusCode::INTERNAL_SERVER_ERROR),
            Json(json!({ "error": error.message })),
        )
            .into_response(),
    }
}
