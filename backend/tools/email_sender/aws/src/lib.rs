#![allow(deprecated)]
use async_trait::async_trait;
use email_magic_links::SignedMagicLink;
use email_sender_core::EmailSender;
use http::HeaderMap;
use ic_cdk::api::management_canister::http_request::{
    CanisterHttpRequestArgument, HttpHeader, HttpMethod, HttpResponse, TransformArgs, TransformContext, TransformFunc,
};
use ic_cdk::query;
use time::OffsetDateTime;
use time::format_description::BorrowedFormatItem;
use time::macros::format_description;

pub struct AwsEmailSender {
    region: String,
    function_url: String,
    access_key: String,
    secret_key: String,
}

const LONG_DATETIME: &[BorrowedFormatItem] = format_description!("[year][month][day]T[hour][minute][second]Z");

impl AwsEmailSender {
    pub fn new(region: String, function_url: String, access_key: String, secret_key: String) -> AwsEmailSender {
        AwsEmailSender {
            region,
            function_url,
            access_key,
            secret_key,
        }
    }

    fn build_args(&self, magic_link: SignedMagicLink, now_millis: u64) -> CanisterHttpRequestArgument {
        let datetime = OffsetDateTime::from_unix_timestamp_nanos(now_millis as i128 * 1_000_000).unwrap();

        let host = self.function_url.trim_start_matches("https://");
        let url = format!("https://{host}");
        let body = serde_json::to_string(&magic_link).unwrap();

        let mut header_map = HeaderMap::new();
        header_map.insert("X-Amz-Date", datetime.format(&LONG_DATETIME).unwrap().parse().unwrap());
        header_map.insert("host", host.parse().unwrap());
        header_map.insert(http::header::CONTENT_TYPE, "application/json".parse().unwrap());
        header_map.insert(http::header::CONTENT_LENGTH, body.len().to_string().parse().unwrap());

        let signature = aws_sign_v4::AwsSign::new(
            "POST",
            &url,
            &datetime,
            &header_map,
            &self.region,
            &self.access_key,
            &self.secret_key,
            "lambda",
            &body,
        )
        .sign();

        header_map.insert(http::header::AUTHORIZATION, signature.parse().unwrap());

        let headers = header_map
            .into_iter()
            .map(|h| HttpHeader {
                name: h.0.unwrap().to_string(),
                value: h.1.to_str().unwrap().to_string(),
            })
            .collect();

        CanisterHttpRequestArgument {
            url,
            max_response_bytes: Some(5 * 1024), // 5KB
            method: HttpMethod::POST,
            headers,
            body: Some(body.as_bytes().to_vec()),
            transform: Some(TransformContext {
                function: TransformFunc::new(ic_cdk::id(), "aws_email_sender_transform_http_response".to_string()),
                context: Vec::new(),
            }),
        }
    }
}

#[async_trait]
impl EmailSender for AwsEmailSender {
    async fn send(&self, magic_link: SignedMagicLink, now_millis: u64) -> Result<(), String> {
        let args = self.build_args(magic_link, now_millis);

        let resp = ic_cdk::api::management_canister::http_request::http_request(args, 1_000_000_000)
            .await
            .map_err(|e| format!("{e:?}"))?;

        if u32::try_from(resp.clone().0.status.0).unwrap() == 200u32 {
            Ok(())
        } else {
            Err(format!("Response code: {resp:?}"))
        }
    }
}

#[query(name = "aws_email_sender_transform_http_response")]
fn transform_http_response(args: TransformArgs) -> HttpResponse {
    HttpResponse {
        status: args.response.status,
        ..Default::default()
    }
}
