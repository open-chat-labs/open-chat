use candid::CandidType;
use serde::{Deserialize, Serialize};
use serde_bytes::ByteBuf;
use std::borrow::Cow;

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct HeaderField(pub String, pub String);

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct HttpRequest {
    pub method: String,
    pub url: String,
    pub headers: Vec<(String, String)>,
    pub body: ByteBuf,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct HttpResponse {
    pub status_code: u16,
    pub headers: Vec<HeaderField>,
    pub body: Cow<'static, ByteBuf>,
}

impl HttpRequest {
    pub fn header(&self, key: &str) -> Option<&String> {
        let key_lower = key.to_lowercase();
        self.headers
            .iter()
            .find(|(k, _)| k.to_lowercase() == key_lower)
            .map(|(_, v)| v)
    }
}

impl HttpResponse {
    pub fn status_code(code: u16) -> HttpResponse {
        HttpResponse {
            status_code: code,
            headers: Vec::new(),
            body: Cow::default(),
        }
    }

    pub fn gone() -> HttpResponse {
        HttpResponse::status_code(410)
    }

    pub fn not_found() -> HttpResponse {
        HttpResponse::status_code(404)
    }

    pub fn moved_permanently(location: &str) -> HttpResponse {
        HttpResponse::moved(301, location, None)
    }

    pub fn moved_temporarily(location: &str, max_age: Option<u32>) -> HttpResponse {
        HttpResponse::moved(302, location, max_age)
    }

    fn moved(status_code: u16, location: &str, max_age: Option<u32>) -> HttpResponse {
        let mut headers = vec![HeaderField("Location".to_owned(), location.to_owned())];

        if let Some(max_age) = max_age {
            let value = format!("public, max-age={max_age}");
            headers.push(HeaderField("Cache-Control".to_owned(), value));
        }

        HttpResponse {
            status_code,
            headers,
            body: Cow::default(),
        }
    }
}
