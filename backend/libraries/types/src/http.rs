use candid::{CandidType, Nat, define_function};
use serde::Deserialize;
use serde_bytes::ByteBuf;

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct HeaderField(pub String, pub String);

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct HttpRequest {
    pub method: String,
    pub url: String,
    pub headers: Vec<(String, String)>,
    #[serde(with = "serde_bytes")]
    pub body: Vec<u8>,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct HttpResponse {
    pub status_code: u16,
    pub headers: Vec<HeaderField>,
    #[serde(with = "serde_bytes")]
    pub body: Vec<u8>,
    pub streaming_strategy: Option<StreamingStrategy>,
    pub upgrade: Option<bool>,
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

define_function!(pub CallbackFunc : (Token) -> (HttpResponse) query);

#[derive(CandidType, Deserialize, Clone, Debug)]
pub enum StreamingStrategy {
    Callback { callback: CallbackFunc, token: Token },
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct StreamingCallbackHttpResponse {
    #[serde(with = "serde_bytes")]
    pub body: Vec<u8>,
    pub token: Option<Token>,
}

impl HttpRequest {
    pub fn header(&self, key: &str) -> Option<&String> {
        self.headers.iter().find(|(k, _)| k.eq_ignore_ascii_case(key)).map(|(_, v)| v)
    }
}

impl HttpResponse {
    pub fn status_code(code: u16) -> HttpResponse {
        HttpResponse {
            status_code: code,
            headers: Vec::new(),
            body: Vec::new(),
            streaming_strategy: None,
            upgrade: None,
        }
    }

    pub fn gone() -> HttpResponse {
        HttpResponse::status_code(410)
    }

    pub fn not_found() -> HttpResponse {
        HttpResponse::status_code(404)
    }

    pub fn bad_request(text: &str) -> HttpResponse {
        HttpResponse {
            status_code: 400,
            headers: Vec::new(),
            body: text.as_bytes().to_vec(),
            streaming_strategy: None,
            upgrade: None,
        }
    }

    pub fn range_not_satisfiable() -> HttpResponse {
        HttpResponse::status_code(416)
    }

    pub fn upgrade() -> HttpResponse {
        HttpResponse {
            status_code: 200,
            headers: Vec::new(),
            body: Vec::new(),
            streaming_strategy: None,
            upgrade: Some(true),
        }
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
            body: Vec::new(),
            streaming_strategy: None,
            upgrade: None,
        }
    }
}
