// The website's WebSocket: it connects with a connection token, then follows cards, joins and opens
// games, and the service pushes it what changes
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
use tokio::sync::mpsc::unbounded_channel;
use types::UserId;

// The first message must connect within this long
const CONNECT_TIMEOUT: Duration = Duration::from_secs(10);
// Keeps the connection open through load balancers, which close idle ones
const PING_INTERVAL: Duration = Duration::from_secs(30);
const MAX_MESSAGE_BYTES: usize = 16 * 1024;

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

    let (sender, mut receiver) = unbounded_channel();
    let id = app.hub.connect(user_id, sender);
    app.hub.send(id, ServerMessage::Connected { user_id });

    let writer = tokio::spawn(async move {
        let mut ping = tokio::time::interval(PING_INTERVAL);
        ping.tick().await;
        loop {
            tokio::select! {
                message = receiver.recv() => match message {
                    Some(message) => if sink.send(text(&message)).await.is_err() { break },
                    None => break,
                },
                _ = ping.tick() => if sink.send(Message::Ping(Default::default())).await.is_err() { break },
            }
        }
    });

    while let Some(Ok(message)) = stream.next().await {
        match message {
            // Requests are handled at once, so a join waiting on its bot holds up nothing else
            Message::Text(text) => match serde_json::from_str::<ClientMessage>(text.as_str()) {
                Ok(message) => {
                    let app = app.clone();
                    tokio::spawn(async move { app.handle(id, user_id, message).await });
                }
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
    let ClientMessage::Connect { token } = serde_json::from_str(text.as_str()).ok()? else {
        return None;
    };
    app.tokens.connection(&token, now_millis())
}

fn text(message: &ServerMessage) -> Message {
    Message::Text(serde_json::to_string(message).expect("A message serializes").into())
}
