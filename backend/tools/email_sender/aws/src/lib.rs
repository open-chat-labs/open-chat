use async_trait::async_trait;
use email_magic_links::SignedMagicLink;
use email_sender_core::EmailSender;
use http::HeaderMap;
use ic_cdk::query;
use ic_cdk_management_canister::{
    HttpHeader, HttpMethod, HttpRequest, HttpRequestResult, TransformArgs, TransformContext, TransformFunc,
};
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

    fn build_request(&self, magic_link: SignedMagicLink, now_millis: u64) -> HttpRequest {
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

        HttpRequest::new(url)
            .with_method(HttpMethod::POST)
            .with_headers(headers)
            .with_body(body.into_bytes())
            .with_max_response_bytes(5 * 1024) // 5KB
            .with_transform(TransformContext {
                function: TransformFunc::new(
                    ic_cdk::api::canister_self(),
                    "aws_email_sender_transform_http_response".to_string(),
                ),
                context: Vec::new(),
            })
            // The transform only copies the status, so this is still far more than it needs, but
            // without it the cycles held for each email would be sized for the query instruction limit
            .with_expected_transform_instructions(100_000_000)
    }
}

#[async_trait]
impl EmailSender for AwsEmailSender {
    async fn send(&self, magic_link: SignedMagicLink, now_millis: u64) -> Result<(), String> {
        let resp = self
            .build_request(magic_link, now_millis)
            .send()
            .await
            .map_err(|e| format!("{e:?}"))?;

        if u32::try_from(resp.status.0.clone()).unwrap() == 200u32 {
            Ok(())
        } else {
            Err(format!("Response code: {resp:?}"))
        }
    }
}

#[query(name = "aws_email_sender_transform_http_response")]
fn transform_http_response(args: TransformArgs) -> HttpRequestResult {
    HttpRequestResult {
        status: args.response.status,
        ..Default::default()
    }
}
