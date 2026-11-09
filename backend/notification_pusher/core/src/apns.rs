// Direct APNs pushes to the iOS app (#10398). The iOS app has no Firebase SDK, so the pusher
// signs its own provider token with the team's `.p8` key and talks HTTP/2 to Apple.

use ct_codecs::{Base64UrlSafeNoPadding, Encoder};
use p256::ecdsa::signature::Signer;
use p256::ecdsa::{Signature, SigningKey};
use p256::pkcs8::DecodePrivateKey;
use reqwest::RequestBuilder;
use serde::Deserialize;
use serde_json::{Map, Value, json};
use std::sync::RwLock;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use types::{ApnsToken, BodyType, CALL_RING_WINDOW_MS, Chat, Error, FcmData, TimestampMillis};

const PRODUCTION_HOST: &str = "https://api.push.apple.com";
const SANDBOX_HOST: &str = "https://api.sandbox.push.apple.com";

// Apple refuses a provider token older than an hour and throttles one refreshed more often than
// every 20 minutes
const PROVIDER_TOKEN_LIFETIME_SECS: u64 = 50 * 60;

// A push nobody received within an hour isn't worth showing, the same TTL as web push
const EXPIRATION_SECS: u64 = 60 * 60;

// APNs refuses payloads over 4 KB. The text appears twice, as the alert and in the data the
// Notification Service Extension renders from, so each copy is capped.
const MAX_BODY_CHARS: usize = 1000;

pub struct ApnsConfig {
    pub key_pem: String,
    pub key_id: String,
    pub team_id: String,
    pub topic: String,
}

pub struct ApnsClient {
    http: reqwest::Client,
    signing_key: SigningKey,
    key_id: String,
    team_id: String,
    topic: String,
    provider_token: RwLock<Option<(String, u64)>>,
}

#[derive(Debug, PartialEq, Eq)]
pub enum SendOutcome {
    Delivered,
    // The token will never work again, so it is removed
    RemoveToken,
    Failed(String),
}

impl ApnsClient {
    pub fn new(config: ApnsConfig) -> Result<Self, Error> {
        let signing_key = SigningKey::from_pkcs8_pem(&config.key_pem).map_err(|e| format!("Invalid APNs key: {e}"))?;
        let http = reqwest::Client::builder()
            .http2_prior_knowledge()
            .timeout(Duration::from_secs(30))
            .build()?;

        Ok(ApnsClient {
            http,
            signing_key,
            key_id: config.key_id,
            team_id: config.team_id,
            topic: config.topic,
            provider_token: RwLock::new(None),
        })
    }

    pub async fn send_alert(&self, token: &ApnsToken, payload: String, collapse_id: &str) -> SendOutcome {
        let request = self
            .request(token, self.topic.clone(), "alert", now_secs() + EXPIRATION_SECS, payload)
            .header("apns-collapse-id", collapse_id);
        self.send(request).await
    }

    // A ring. PushKit pushes go to the app's `.voip` topic, and Apple drops one that can't be
    // delivered before the ring window ends.
    pub async fn send_voip(&self, token: &ApnsToken, payload: String, expires_at_secs: u64) -> SendOutcome {
        let request = self.request(token, format!("{}.voip", self.topic), "voip", expires_at_secs, payload);
        self.send(request).await
    }

    fn request(
        &self,
        token: &ApnsToken,
        topic: String,
        push_type: &str,
        expires_at_secs: u64,
        payload: String,
    ) -> RequestBuilder {
        self.http
            .post(device_url(token))
            .bearer_auth(self.provider_token(now_secs()))
            .header("apns-topic", topic)
            .header("apns-push-type", push_type)
            .header("apns-priority", "10")
            .header("apns-expiration", expires_at_secs.to_string())
            .body(payload)
    }

    async fn send(&self, request: RequestBuilder) -> SendOutcome {
        let response = request.send().await;

        match response {
            Ok(response) => {
                let status = response.status().as_u16();
                if status == 200 {
                    return SendOutcome::Delivered;
                }
                let reason = response.json::<ErrorBody>().await.ok().map(|b| b.reason);
                if matches!(reason.as_deref(), Some("ExpiredProviderToken" | "InvalidProviderToken")) {
                    *self.provider_token.write().unwrap() = None;
                }
                outcome(status, reason.as_deref())
            }
            Err(error) => SendOutcome::Failed(error.to_string()),
        }
    }

    fn provider_token(&self, now: u64) -> String {
        if let Some((token, issued_at)) = self.provider_token.read().unwrap().as_ref()
            && now < issued_at + PROVIDER_TOKEN_LIFETIME_SECS
        {
            return token.clone();
        }

        let token = sign_provider_token(&self.signing_key, &self.key_id, &self.team_id, now);
        *self.provider_token.write().unwrap() = Some((token.clone(), now));
        token
    }
}

#[derive(Deserialize)]
struct ErrorBody {
    reason: String,
}

// The sandbox prefix picks the host and never reaches Apple
fn device_url(token: &ApnsToken) -> String {
    let host = if token.is_sandbox() { SANDBOX_HOST } else { PRODUCTION_HOST };
    format!("{host}/3/device/{}", token.device_token())
}

// Only a token APNs says is dead is removed. Anything else, a throttled push, a bad payload, a
// wrong topic, an outage, is our problem or a passing one, and the token stays.
pub fn outcome(status: u16, reason: Option<&str>) -> SendOutcome {
    match (status, reason) {
        (200, _) => SendOutcome::Delivered,
        (410, _) | (400, Some("BadDeviceToken")) => SendOutcome::RemoveToken,
        (status, reason) => SendOutcome::Failed(format!("{status} {}", reason.unwrap_or_default())),
    }
}

fn sign_provider_token(key: &SigningKey, key_id: &str, team_id: &str, now: u64) -> String {
    let header = json!({ "alg": "ES256", "kid": key_id });
    let claims = json!({ "iss": team_id, "iat": now });
    let signed = format!(
        "{}.{}",
        base64url(header.to_string().as_bytes()),
        base64url(claims.to_string().as_bytes())
    );
    let signature: Signature = key.sign(signed.as_bytes());
    format!("{signed}.{}", base64url(&signature.to_bytes()))
}

fn base64url(bytes: &[u8]) -> String {
    Base64UrlSafeNoPadding::encode_to_string(bytes).unwrap()
}

pub fn now_millis() -> TimestampMillis {
    SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis() as TimestampMillis
}

fn now_secs() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs()
}

/// The APNs alert for a notification, or None when it must not be shown as an alert. A ring is
/// for CallKit through a VoIP push, and a dismissal is never shown at all.
///
/// The alert carries the server's title and body for when the Notification Service Extension
/// can't run, and the same data an Android phone gets, which the extension renders from.
pub fn alert_payload(data: &FcmData) -> Option<String> {
    if data.call.is_some() || data.is_call_dismissal() {
        return None;
    }

    let mut data = data.clone();
    data.body = data.body.map(|b| truncate(b, MAX_BODY_CHARS));
    let title = title(&data);
    let body = body(&data);
    let thread_id = thread_id(&data.chat_id);

    let mut payload: Map<String, Value> = data.as_data().into_iter().map(|(k, v)| (k, Value::String(v))).collect();
    payload.insert(
        "aps".to_string(),
        json!({
            "alert": { "title": title, "body": body },
            "mutable-content": 1,
            "thread-id": thread_id,
            "sound": "default",
        }),
    );
    Some(Value::Object(payload).to_string())
}

/// The PushKit payload for a ring and when Apple should give up on it, in seconds. None for
/// anything else, as iOS makes the app report every VoIP push to CallKit (#10398 invariant 3).
pub fn voip_payload(data: &FcmData, now: TimestampMillis) -> Option<(String, u64)> {
    let call = data.call.as_ref()?;
    let ring_ends = call.started + CALL_RING_WINDOW_MS;
    if data.is_call_dismissal() || now >= ring_ends {
        return None;
    }
    let map: Map<String, Value> = data
        .clone()
        .as_data()
        .into_iter()
        .map(|(k, v)| (k, Value::String(v)))
        .collect();
    Some((Value::Object(map).to_string(), ring_ends / 1000))
}

// Notifications are grouped per chat
fn thread_id(chat: &Chat) -> String {
    match chat {
        Chat::Direct(user_id) => format!("direct:{user_id}"),
        Chat::Group(group_id) => format!("group:{group_id}"),
        Chat::Channel(community_id, channel_id) => format!("channel:{community_id}:{channel_id}"),
    }
}

// The same wording as the Android shell
fn title(data: &FcmData) -> String {
    let thread = if data.thread_root_message_index.is_some() { " // Thread" } else { "" };
    match data.chat_id {
        Chat::Direct(_) => data.sender_name.clone().unwrap_or_else(|| "OpenChat".to_string()),
        Chat::Group(_) => format!("{}{thread}", data.group_name.as_deref().unwrap_or_default()),
        Chat::Channel(..) => format!(
            "{}#{}{thread}",
            data.community_name.as_deref().unwrap_or_default(),
            data.channel_name.as_deref().unwrap_or_default()
        ),
    }
}

fn body(data: &FcmData) -> String {
    let sender = data.sender_name.as_deref().unwrap_or_default();
    let text = data.body.clone().unwrap_or_default();
    match data.body_type {
        BodyType::Reaction => format!("{sender} reacted with {text}"),
        BodyType::Tip => format!("{sender} sent a tip of {text}"),
        BodyType::Invite => format!("{sender} invited you to {text}"),
        BodyType::Message => {
            let message = message_text(data, text);
            match data.chat_id {
                Chat::Direct(_) => message,
                _ => format!("{sender}: {message}"),
            }
        }
    }
}

fn message_text(data: &FcmData, text: String) -> String {
    let caption = Some(text.clone()).filter(|t| !t.trim().is_empty());
    match data.message_type.as_deref() {
        Some("Image") => caption.unwrap_or_else(|| "📷 Photo".to_string()),
        Some("Video") => format!("🎥 {}", caption.unwrap_or_else(|| "Shared a video".to_string())),
        Some("Giphy") => format!("🎞️ {}", caption.unwrap_or_else(|| "Shared a GIF".to_string())),
        Some("Audio") => format!("🎙️ {}", caption.unwrap_or_else(|| "Shared audio".to_string())),
        Some("File") => format!(
            "📎 {}",
            data.file_name
                .clone()
                .filter(|f| !f.trim().is_empty())
                .or(caption)
                .unwrap_or_else(|| "Shared a file".to_string())
        ),
        _ => caption.unwrap_or(text),
    }
}

fn truncate(text: String, max_chars: usize) -> String {
    match text.char_indices().nth(max_chars) {
        Some((i, _)) => format!("{}…", &text[..i]),
        None => text,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use types::{CallDismissalKind, CallFacts, CanisterId, ChatId, MessageId, UserId, VideoCallType};

    fn alice() -> UserId {
        UserId::new(CanisterId::from_text("3skqk-iqaaa-aaaaf-aaa3q-cai").unwrap())
    }

    fn group() -> ChatId {
        ChatId::from(CanisterId::from_text("hnv5y-siaaa-aaaaf-aacza-cai").unwrap())
    }

    fn message() -> FcmData {
        FcmData::for_group(group())
            .set_group_name("Rust".to_string())
            .set_sender_id(alice())
            .set_sender_name(None, "alice".to_string())
            .set_message(Some("hello".to_string()))
            .set_message_type("Text".to_string())
    }

    fn parse(payload: Option<String>) -> Value {
        serde_json::from_str(&payload.expect("an alert")).unwrap()
    }

    fn ring(started: u64) -> FcmData {
        message().set_call(&CallFacts {
            message_id: MessageId::from(1u64),
            call_type: VideoCallType::Default,
            audio_only: false,
            started,
            is_public: false,
            member_count: 2,
        })
    }

    // #10398 invariant 3
    #[test]
    fn invariant_3_a_voip_push_is_only_for_a_ring_inside_its_window() {
        let started = 1_000_000;
        assert!(voip_payload(&ring(started), started).is_some());
        assert!(voip_payload(&ring(started), started + CALL_RING_WINDOW_MS - 1).is_some());
        assert_eq!(voip_payload(&ring(started), started + CALL_RING_WINDOW_MS), None);
        assert_eq!(voip_payload(&message(), started), None);

        let dismissal = FcmData::call_dismissal(Chat::Group(group()), MessageId::from(1u64), CallDismissalKind::Ended);
        assert_eq!(voip_payload(&dismissal, started), None);
    }

    #[test]
    fn a_voip_push_carries_the_decline_token_and_expires_with_the_ring() {
        let started = 1_000_000;
        let (payload, expires_at) = voip_payload(&ring(started).with_decline_token("jwt".to_string()), started).unwrap();
        let payload: Value = serde_json::from_str(&payload).unwrap();

        assert_eq!(payload["callDeclineToken"], "jwt");
        assert_eq!(payload["callMessageId"], "1");
        assert_eq!(expires_at, (started + CALL_RING_WINDOW_MS) / 1000);
    }

    // #10398 invariant 2
    #[test]
    fn invariant_2_no_alert_for_a_ring_or_a_dismissal() {
        let ring = message().set_call(&CallFacts {
            message_id: MessageId::from(1u64),
            call_type: VideoCallType::Default,
            audio_only: false,
            started: 0,
            is_public: false,
            member_count: 2,
        });
        let dismissal = FcmData::call_dismissal(Chat::Group(group()), MessageId::from(1u64), CallDismissalKind::Ended);

        assert_eq!(alert_payload(&ring), None);
        assert_eq!(alert_payload(&dismissal), None);
        assert!(alert_payload(&message()).is_some());
    }

    #[test]
    fn a_message_alert_has_the_fallback_text_a_thread_per_chat_and_the_android_data() {
        let payload = parse(alert_payload(&message()));
        let aps = &payload["aps"];

        assert_eq!(aps["alert"]["title"], "Rust");
        assert_eq!(aps["alert"]["body"], "alice: hello");
        assert_eq!(aps["mutable-content"], 1);
        assert_eq!(aps["thread-id"], format!("group:{}", group()));
        // The extension renders from the same keys the Android shell reads
        assert_eq!(payload["type"], "group");
        assert_eq!(payload["groupId"], group().to_string());
        assert_eq!(payload["senderName"], "alice");
        assert_eq!(payload["body"], "hello");
    }

    #[test]
    fn a_long_message_still_fits_in_an_apns_payload() {
        let long = message().set_message(Some("x".repeat(10_000)));
        assert!(alert_payload(&long).unwrap().len() < 4096);
    }

    // #10398 invariant 4
    #[test]
    fn invariant_4_a_sandbox_token_goes_to_the_sandbox_and_any_other_to_production() {
        let sandbox = ApnsToken("sandbox:abc123".to_string());
        let production = ApnsToken("abc123".to_string());

        assert_eq!(device_url(&sandbox), "https://api.sandbox.push.apple.com/3/device/abc123");
        assert_eq!(device_url(&production), "https://api.push.apple.com/3/device/abc123");
    }

    // #10398 invariant 5
    #[test]
    fn invariant_5_only_unregistered_and_bad_device_token_remove_the_token() {
        assert_eq!(outcome(200, None), SendOutcome::Delivered);
        assert_eq!(outcome(410, Some("Unregistered")), SendOutcome::RemoveToken);
        assert_eq!(outcome(400, Some("BadDeviceToken")), SendOutcome::RemoveToken);

        for (status, reason) in [
            (400, "DeviceTokenNotForTopic"),
            (400, "BadCollapseId"),
            (403, "ExpiredProviderToken"),
            (413, "PayloadTooLarge"),
            (429, "TooManyRequests"),
            (500, "InternalServerError"),
            (503, "ServiceUnavailable"),
        ] {
            assert!(
                matches!(outcome(status, Some(reason)), SendOutcome::Failed(_)),
                "{status} {reason}"
            );
        }
    }
}
