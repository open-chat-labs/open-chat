use types::{HttpRequest, HttpResponse, StreamingCallbackHttpResponse, Token};

pub type Args = HttpRequest;
pub type Response = HttpResponse;

pub type StreamingCallbackArgs = Token;
pub type StreamingCallbackResponse = StreamingCallbackHttpResponse;
