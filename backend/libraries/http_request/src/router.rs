use candid::Principal;
use std::{
    collections::{HashMap, VecDeque},
    str::FromStr,
};
use types::{ChannelId, FileId, TimestampMillis, UserId};

pub enum Route {
    Avatar(AvatarRoute),
    Banner(Option<u128>),
    File(u128),
    Logs(Option<TimestampMillis>),
    Errors(Option<TimestampMillis>),
    Traces(Option<TimestampMillis>),
    Metrics,
    Other(String, HashMap<String, String>),
    Webhook(WebhookRoute),
}

pub struct AvatarRoute {
    pub channel_id: Option<ChannelId>,
    pub bot_id: Option<UserId>,
    pub blob_id: Option<u128>,
}

#[derive(Debug)]
pub struct WebhookRoute {
    pub channel_id: Option<ChannelId>,
    pub webhook_id: UserId,
    pub secret: String,
}

pub fn extract_route(path: &str) -> Route {
    let trimmed = path.trim_start_matches('/').trim_end_matches('/').to_lowercase();

    if trimmed.is_empty() {
        return Route::Other("".to_string(), HashMap::default());
    }

    let (path, qs) = trimmed.split_once('?').unwrap_or((&trimmed, ""));

    let mut parts: VecDeque<_> = path.split('/').collect();

    match parts.pop_front().unwrap_or_default() {
        "avatar" => return parse_avatar(&mut parts, None),
        "banner" => {
            let blob_id = parts.pop_front().and_then(|p| u128::from_str(p).ok());
            return Route::Banner(blob_id);
        }
        "blobs" | "files" if !parts.is_empty() => {
            if let Ok(file_id) = FileId::from_str(parts[0]) {
                return Route::File(file_id);
            }
        }
        "channel" => {
            if let Some(channel_id) = parts.pop_front().and_then(|p| u128::from_str(p).ok()) {
                if let Some(sub_route) = parts.pop_front() {
                    if sub_route == "avatar" {
                        return parse_avatar(&mut parts, Some(channel_id.into()));
                    }
                }
            }
        }
        "errors" => {
            let since = parts.pop_front().and_then(|p| u64::from_str(p).ok());
            return Route::Errors(since);
        }
        "logs" => {
            let since = parts.pop_front().and_then(|p| u64::from_str(p).ok());
            return Route::Logs(since);
        }
        "metrics" => return Route::Metrics,
        "trace" => {
            let since = parts.pop_front().and_then(|p| u64::from_str(p).ok());
            return Route::Traces(since);
        }
        "webhook" => {
            if let Some(webhook_id) = parts.pop_front().and_then(|p| Principal::from_text(p).ok()).map(UserId::from) {
                if let Some(secret) = parts.pop_front() {
                    return Route::Webhook(WebhookRoute {
                        channel_id: None,
                        webhook_id,
                        secret: secret.to_string(),
                    });
                }
            }
        }
        _ => (),
    }

    Route::Other(path.to_string(), parse_query(qs))
}

fn parse_avatar(parts: &mut VecDeque<&str>, channel_id: Option<ChannelId>) -> Route {
    let mut next = parts.pop_front();

    let mut route = AvatarRoute {
        channel_id,
        bot_id: None,
        blob_id: None,
    };

    if let Some(bot_id) = next.and_then(|p| Principal::from_text(p).ok()).map(UserId::from) {
        route.bot_id = Some(bot_id);
        next = parts.pop_front();
    };

    route.blob_id = next.and_then(|p| u128::from_str(p).ok());

    Route::Avatar(route)
}

fn parse_query(query: &str) -> HashMap<String, String> {
    query
        .split('&')
        .filter_map(|s| s.split_once('=').map(|t| (t.0.to_string(), t.1.to_string())))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn avatar() {
        const BLOB_ID: u128 = 367253521351235123;
        match extract_route(&format!("/avatar/{BLOB_ID}")) {
            Route::Avatar(a) => {
                assert_eq!(Some(BLOB_ID), a.blob_id);
                assert!(a.channel_id.is_none());
                assert!(a.bot_id.is_none());
            }
            _ => panic!(),
        }
    }

    #[test]
    fn channel_avatar() {
        let blob_id: u128 = 367253521351235123;
        let channel_id: ChannelId = ChannelId::from(253762346752364_u128);
        match extract_route(&format!("/channel/{channel_id}/avatar/{blob_id}")) {
            Route::Avatar(a) => {
                assert_eq!(Some(blob_id), a.blob_id);
                assert_eq!(Some(channel_id), a.channel_id);
                assert!(a.bot_id.is_none());
            }
            _ => panic!(),
        }
    }

    #[test]
    fn channel_bot_avatar() {
        let blob_id: u128 = 367253521351235123;
        let channel_id = ChannelId::from(253762346752364_u128);
        let bot_id = UserId::from(Principal::from_text("3e3x2-xyaaa-aaaaq-aaalq-cai").unwrap());
        match extract_route(&format!("/channel/{channel_id}/avatar/{bot_id}/{blob_id}")) {
            Route::Avatar(a) => {
                assert_eq!(Some(blob_id), a.blob_id);
                assert_eq!(Some(channel_id), a.channel_id);
                assert_eq!(Some(bot_id), a.bot_id);
            }
            _ => panic!(),
        }
    }

    #[test]
    fn webhook() {
        let webhook_id = UserId::from(Principal::from_text("3e3x2-xyaaa-aaaaq-aaalq-cai").unwrap());
        let secret = "secret";
        match extract_route(&format!("/webhook/{webhook_id}/{secret}")) {
            Route::Webhook(w) => {
                assert_eq!(webhook_id, w.webhook_id);
                assert_eq!(secret, w.secret);
                assert!(w.channel_id.is_none());
            }
            _ => panic!(),
        }
    }

    #[test]
    fn logs() {
        assert!(matches!(extract_route("/logs/1633649663014109000"), Route::Logs(_)));
    }

    #[test]
    fn other() {
        assert!(matches!(extract_route("blah"), Route::Other(_, _)));
    }

    #[test]
    fn querystring() {
        let route = extract_route("blah?abc=1");
        if let Route::Other(p, qs) = route {
            assert_eq!(&p, "blah");
            assert_eq!(qs.get("abc").unwrap(), "1");
        } else {
            panic!();
        }
    }
}
