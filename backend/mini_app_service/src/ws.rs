// The website's WebSocket: it connects with one of its user's chat tokens, then follows cards, joins
// and opens games, and the service pushes it what changes
use crate::app::App;
use crate::now_millis;
use crate::protocol::{ClientMessage, ErrorCode, ServerMessage};
use axum::extract::State;
use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::response::Response;
use futures::stream::SplitStream;
use futures::{SinkExt, StreamExt};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::mpsc::channel;
use types::UserId;

// The first message must connect within this long
const CONNECT_TIMEOUT: Duration = Duration::from_secs(10);
// Keeps the connection open through load balancers, which close idle ones
const PING_INTERVAL: Duration = Duration::from_secs(30);
// A connection heard nothing from for this long, not even a pong, is closed
const READ_TIMEOUT: Duration = Duration::from_secs(90);
const MAX_MESSAGE_BYTES: usize = 16 * 1024;
// What's queued for a connection which reads slower than the service pushes. It's dropped if it fills.
const QUEUE_SIZE: usize = 256;

pub async fn connect(ws: WebSocketUpgrade, State(app): State<Arc<App>>) -> Response {
    ws.max_message_size(MAX_MESSAGE_BYTES)
        .on_upgrade(move |socket| serve(socket, app))
}

async fn serve(socket: WebSocket, app: Arc<App>) {
    let (mut sink, mut stream) = socket.split();

    let Some(user_id) = authenticate(&mut stream, &app).await else {
        let _ = sink
            .send(text(&ServerMessage::Error {
                code: ErrorCode::InvalidToken,
            }))
            .await;
        let _ = sink.close().await;
        return;
    };

    let (sender, mut receiver) = channel::<Arc<ServerMessage>>(QUEUE_SIZE);
    let id = app.hub.connect(user_id, sender);
    app.hub.send(id, ServerMessage::Connected { user_id });

    // Ends when the hub drops the connection, eg. as it stopped reading, closing the socket
    let writer = tokio::spawn(async move {
        let mut ping = tokio::time::interval(PING_INTERVAL);
        ping.tick().await;
        loop {
            tokio::select! {
                message = receiver.recv() => match message {
                    Some(message) => if sink.send(text(&message)).await.is_err() { break },
                    None => {
                        let _ = sink.close().await;
                        break;
                    }
                },
                _ = ping.tick() => if sink.send(Message::Ping(Default::default())).await.is_err() { break },
            }
        }
    });

    while let Ok(Some(Ok(message))) = tokio::time::timeout(READ_TIMEOUT, stream.next()).await {
        match message {
            Message::Text(text) => match serde_json::from_str::<ClientMessage>(text.as_str()) {
                // A join, a leave or a start waits on the bot, so holds up nothing else. The rest are
                // handled in order, so eg. an open then a close leave the game closed.
                Ok(message @ (ClientMessage::Join { .. } | ClientMessage::Leave { .. } | ClientMessage::Start { .. })) => {
                    let app = app.clone();
                    tokio::spawn(async move { app.handle(id, user_id, message).await });
                }
                Ok(message) => app.handle(id, user_id, message).await,
                Err(_) => app.hub.send(
                    id,
                    ServerMessage::Error {
                        code: ErrorCode::InvalidMessage,
                    },
                ),
            },
            Message::Close(_) => break,
            _ => {}
        }
    }

    for game in app.hub.disconnect(id) {
        app.push_card(&game).await;
    }
    writer.abort();
}

async fn authenticate(stream: &mut SplitStream<WebSocket>, app: &App) -> Option<UserId> {
    let Ok(Some(Ok(Message::Text(text)))) = tokio::time::timeout(CONNECT_TIMEOUT, stream.next()).await else {
        return None;
    };
    let ClientMessage::Connect { chat_token } = serde_json::from_str(text.as_str()).ok()? else {
        return None;
    };
    app.tokens.connection(&chat_token, now_millis())
}

fn text(message: &ServerMessage) -> Message {
    Message::Text(serde_json::to_string(message).expect("A message serializes").into())
}
