use std::str::FromStr;
use types::TimestampMillis;

pub enum Route {
    Avatar(Option<u128>),
    Blob(u128),
    Logs(Option<TimestampMillis>),
    Other,
}

pub fn extract_route(path: &str) -> Route {
    let path = path.trim_start_matches('/').trim_end_matches('/').to_lowercase();

    if path.is_empty() {
        return Route::Other;
    }
    let parts: Vec<_> = path.split('/').collect();

    match parts[0] {
        "avatar" => {
            let blob_id = parts.get(1).map(|p| u128::from_str(p).ok()).flatten();
            Route::Avatar(blob_id)
        }
        "blob_id" if parts.len() > 1 => {
            if let Ok(blob_id) = u128::from_str(parts[1]) {
                Route::Blob(blob_id)
            } else {
                Route::Other
            }
        }
        "logs" => {
            let since = parts.get(1).map(|p| u64::from_str(p).ok()).flatten();
            Route::Logs(since)
        }
        _ => Route::Other,
    }
}
