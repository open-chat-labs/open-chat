use candid::{CandidType, Func, Nat};
use serde::Deserialize;
use serde_bytes::ByteBuf;
use std::borrow::Cow;

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct HeaderField(pub String, pub String);

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct HttpRequest {
    pub method: String,
    pub url: String,
    pub headers: Vec<(String, String)>,
    pub body: ByteBuf,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct HttpResponse {
    pub status_code: u16,
    pub headers: Vec<HeaderField>,
    pub body: Cow<'static, ByteBuf>,
    pub streaming_strategy: Option<StreamingStrategy>,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct Token {
    pub key: String,
    pub content_encoding: String,
    pub index: Nat,
    // The sha ensures that a client doesn't stream part of one version of an asset
    // followed by part of a different asset, even if not checking the certificate.
    pub sha256: Option<ByteBuf>,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub enum StreamingStrategy {
    Callback { callback: Func, token: Token },
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct StreamingCallbackHttpResponse {
    pub body: ByteBuf,
    pub token: Option<Token>,
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
            streaming_strategy: None,
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
        let mut headers = vec![HeaderField("Location".to_string(), location.to_owned())];

        if let Some(max_age) = max_age {
            let value = format!("public, max-age={max_age}");
            headers.push(HeaderField("Cache-Control".to_owned(), value));
        }

        HttpResponse {
            status_code,
            headers,
            body: Cow::default(),
            streaming_strategy: None,
        }
    }
}
