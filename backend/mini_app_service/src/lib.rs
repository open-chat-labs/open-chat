// The MiniApp service: it sits between the website and the bots which host games in messages. Bots post
// their cards through it, players join through it, spectators watch through it, and only it writes a
// game's card. The protocol is in backend/docs/mini_app_service_protocol.md.
use crate::app::App;
use axum::Router;
use axum::extract::DefaultBodyLimit;
use axum::routing::{get, post};
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use types::TimestampMillis;

pub mod app;
pub mod bot_api;
pub mod bots;
pub mod cards;
pub mod config;
pub mod games;
pub mod hub;
pub mod protocol;
pub mod store;
pub mod tokens;
pub mod ws;

pub fn router(app: Arc<App>) -> Router {
    Router::new()
        .route("/ws", get(ws::connect))
        .route("/public_key", get(bot_api::public_key))
        .route("/health", get(|| async { "ok" }))
        .route("/bot/post", post(bot_api::post))
        .route(
            "/bot/update",
            post(bot_api::update).layer(DefaultBodyLimit::max(bot_api::MAX_UPDATE_BYTES)),
        )
        .with_state(app)
}

pub fn now_millis() -> TimestampMillis {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("The clock is after 1970")
        .as_millis() as TimestampMillis
}
