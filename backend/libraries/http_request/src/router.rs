use candid::Principal;
use std::{collections::HashMap, str::FromStr};
use types::{ChannelId, FileId, TimestampMillis, UserId};

pub enum Route {
    Avatar(Option<u128>),
    BotAvatar(UserId, Option<u128>),
    Banner(Option<u128>),
    ChannelAvatar((ChannelId, Option<u128>)),
    File(u128),
    Logs(Option<TimestampMillis>),
    Errors(Option<TimestampMillis>),
    Traces(Option<TimestampMillis>),
    Metrics,
    Other(String, HashMap<String, String>),
}

pub fn extract_route(path: &str) -> Route {
    let trimmed = path.trim_start_matches('/').trim_end_matches('/').to_lowercase();

    if trimmed.is_empty() {
        return Route::Other("".to_string(), HashMap::default());
    }

    let (path, qs) = trimmed.split_once('?').unwrap_or((&trimmed, ""));

    let parts: Vec<_> = path.split('/').collect();

    match parts[0] {
        "avatar" => {
            if let Some(user_id) = parts.get(1).and_then(|p| Principal::from_text(*p).ok()).map(UserId::from) {
                let blob_id = parts.get(2).and_then(|p| u128::from_str(p).ok());
                return Route::BotAvatar(user_id, blob_id);
            } else {
                let blob_id = parts.get(1).and_then(|p| u128::from_str(p).ok());
                return Route::Avatar(blob_id);
            }
        }
        "banner" => {
            let blob_id = parts.get(1).and_then(|p| u128::from_str(p).ok());
            return Route::Banner(blob_id);
        }
        "blobs" | "files" if parts.len() > 1 => {
            if let Ok(file_id) = FileId::from_str(parts[1]) {
                return Route::File(file_id);
            }
        }
        "channel" => {
            if let Some(channel_id) = parts.get(1).and_then(|p| u128::from_str(p).ok()) {
                if let Some(sub_route) = parts.get(2) {
                    if *sub_route == "avatar" {
                        let blob_id = parts.get(3).and_then(|p| u128::from_str(p).ok());
                        return Route::ChannelAvatar((channel_id.into(), blob_id));
                    }
                }
            }
        }
        "errors" => {
            let since = parts.get(1).and_then(|p| u64::from_str(p).ok());
            return Route::Errors(since);
        }
        "logs" => {
            let since = parts.get(1).and_then(|p| u64::from_str(p).ok());
            return Route::Logs(since);
        }
        "trace" => {
            let since = parts.get(1).and_then(|p| u64::from_str(p).ok());
            return Route::Traces(since);
        }
        "metrics" => return Route::Metrics,
        _ => (),
    }

    Route::Other(path.to_string(), parse_query(qs))
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
            Route::Avatar(Some(id)) => assert_eq!(BLOB_ID, id),
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
