use std::str::FromStr;
use types::{FileId, TimestampMillis};

pub enum Route {
    Avatar(Option<u128>),
    File(u128),
    Logs(Option<TimestampMillis>),
    Traces(Option<TimestampMillis>),
    Metrics,
    Other(String, String),
}

pub fn extract_route(path: &str) -> Route {
    let trimmed = path.trim_start_matches('/').trim_end_matches('/').to_lowercase();

    if trimmed.is_empty() {
        return Route::Other("".to_string(), "".to_string());
    }

    let (path, qs) = trimmed.split_once("?").unwrap_or((&trimmed, ""));

    let parts: Vec<_> = path.split('/').collect();

    match parts[0] {
        "avatar" => {
            let blob_id = parts.get(1).and_then(|p| u128::from_str(p).ok());
            Route::Avatar(blob_id)
        }
        "blobs" | "files" if parts.len() > 1 => {
            if let Ok(file_id) = FileId::from_str(parts[1]) {
                Route::File(file_id)
            } else {
                Route::Other(path.to_string(), qs.to_string())
            }
        }
        "logs" => {
            let since = parts.get(1).and_then(|p| u64::from_str(p).ok());
            Route::Logs(since)
        }
        "trace" => {
            let since = parts.get(1).and_then(|p| u64::from_str(p).ok());
            Route::Traces(since)
        }
        "metrics" => Route::Metrics,
        _ => Route::Other(path.to_string(), qs.to_string()),
    }
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
        assert!(matches!(extract_route("blah"), Route::Other(_)));
    }
}
