use async_trait::async_trait;
use aws_sdk_dynamodb::Client;
use aws_sdk_dynamodb::types::AttributeValue;
use aws_types::sdk_config::SdkConfig;
use index_store::IndexStore;
use std::str::FromStr;
use types::{CanisterId, Error};

#[derive(Clone)]
pub struct DynamoDbIndexStore {
    client: Client,
    table_name: String,
}

impl DynamoDbIndexStore {
    pub fn build(config: &SdkConfig, table_name: String) -> DynamoDbIndexStore {
        let client = Client::new(config);

        DynamoDbIndexStore { client, table_name }
    }
}

#[async_trait]
impl IndexStore for DynamoDbIndexStore {
    async fn get(&self, canister_id: CanisterId) -> Result<Option<u64>, Error> {
        let response = self
            .client
            .get_item()
            .table_name(&self.table_name)
            .key("canister_id", AttributeValue::S(canister_id.to_string()))
            .send()
            .await?;

        if let Some(item) = response.item {
            let value = item.get("index").unwrap().as_n().unwrap();
            Ok(Some(u64::from_str(value).unwrap()))
        } else {
            Ok(None)
        }
    }

    async fn set(&self, canister_id: CanisterId, index: u64) -> Result<(), Error> {
        self.client
            .put_item()
            .table_name(&self.table_name)
            .item("canister_id", AttributeValue::S(canister_id.to_string()))
            .item("index", AttributeValue::N(index.to_string()))
            .send()
            .await?;

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use aws_sdk_dynamodb::config::retry::RetryConfig;
    use aws_sdk_dynamodb::config::timeout::TimeoutConfig;
    use aws_sdk_dynamodb::config::{BehaviorVersion, Credentials, Region, SharedCredentialsProvider};
    use serde_json::{Value, json};
    use std::io::{Read, Write};
    use std::net::TcpListener;
    use std::thread::{self, JoinHandle};
    use std::time::{Duration, Instant};

    // Explicit, synthetic credentials prevent these tests from reading a local
    // AWS profile, querying instance metadata, or contacting a real AWS service.
    fn test_config(endpoint: &str) -> SdkConfig {
        SdkConfig::builder()
            .behavior_version(BehaviorVersion::latest())
            .region(Region::new("us-east-1"))
            .credentials_provider(SharedCredentialsProvider::new(Credentials::new(
                "synthetic-access-key",
                "synthetic-secret-key",
                None,
                None,
                "offline-test",
            )))
            .endpoint_url(endpoint)
            .retry_config(RetryConfig::standard().with_max_attempts(1))
            .timeout_config(TimeoutConfig::builder().operation_timeout(Duration::from_secs(5)).build())
            .build()
    }

    fn local_response(body: Value) -> (String, JoinHandle<(String, Value)>) {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        listener.set_nonblocking(true).unwrap();
        let endpoint = format!("http://{}", listener.local_addr().unwrap());
        let handle = thread::spawn(move || {
            let deadline = Instant::now() + Duration::from_secs(10);
            let mut stream = loop {
                match listener.accept() {
                    Ok((stream, _)) => break stream,
                    Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => {
                        assert!(Instant::now() < deadline, "No local DynamoDB request received");
                        thread::sleep(Duration::from_millis(10));
                    }
                    Err(error) => panic!("Local test listener failed: {error}"),
                }
            };
            stream.set_read_timeout(Some(Duration::from_secs(5))).unwrap();
            stream.set_write_timeout(Some(Duration::from_secs(5))).unwrap();
            let mut request = Vec::new();
            let (header_end, content_length) = loop {
                let mut buffer = [0; 4096];
                let count = stream.read(&mut buffer).unwrap();
                assert!(count > 0, "Local request ended before its headers");
                request.extend_from_slice(&buffer[..count]);
                assert!(request.len() < 64 * 1024, "Unexpectedly large local request");
                if let Some(index) = request.windows(4).position(|window| window == b"\r\n\r\n") {
                    let headers = String::from_utf8_lossy(&request[..index]);
                    let length = headers
                        .lines()
                        .find_map(|line| {
                            let (name, value) = line.split_once(':')?;
                            name.eq_ignore_ascii_case("content-length")
                                .then(|| value.trim().parse::<usize>().unwrap())
                        })
                        .unwrap();
                    assert!(length < 64 * 1024, "Unexpectedly large local request body");
                    break (index + 4, length);
                }
            };
            while request.len() < header_end + content_length {
                let mut buffer = [0; 4096];
                let count = stream.read(&mut buffer).unwrap();
                assert!(count > 0, "Local request ended before its body");
                request.extend_from_slice(&buffer[..count]);
            }
            let headers = String::from_utf8(request[..header_end].to_vec()).unwrap();
            let request_body = serde_json::from_slice(&request[header_end..header_end + content_length]).unwrap();
            let response_body = serde_json::to_string(&body).unwrap();
            write!(
                stream,
                "HTTP/1.1 200 OK\r\nContent-Type: application/x-amz-json-1.0\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                response_body.len(),
                response_body
            )
            .unwrap();
            (headers, request_body)
        });
        (endpoint, handle)
    }

    #[test]
    fn constructs_default_https_client_without_legacy_connector() {
        // Construction does not perform DNS resolution or make an HTTP request.
        let config = test_config("https://dynamodb.example.invalid");
        let store = DynamoDbIndexStore::build(&config, "synthetic-indexes".to_string());
        assert_eq!(store.client.config().region().unwrap().as_ref(), "us-east-1");
        assert_eq!(store.table_name, "synthetic-indexes");
    }

    #[tokio::test(flavor = "current_thread")]
    async fn modern_client_preserves_get_item_request_and_result() {
        let (endpoint, request) = local_response(json!({"Item": {"index": {"N": "42"}}}));
        let store = DynamoDbIndexStore::build(&test_config(&endpoint), "synthetic-indexes".to_string());
        let canister_id = CanisterId::anonymous();
        assert_eq!(store.get(canister_id).await.unwrap(), Some(42));
        let (headers, body) = request.join().unwrap();
        assert!(
            headers
                .to_ascii_lowercase()
                .contains("x-amz-target: dynamodb_20120810.getitem")
        );
        assert!(headers.contains("AWS4-HMAC-SHA256"));
        assert_eq!(
            body,
            json!({"TableName": "synthetic-indexes", "Key": {"canister_id": {"S": canister_id.to_string()}}})
        );
    }

    #[tokio::test(flavor = "current_thread")]
    async fn modern_client_preserves_put_item_request() {
        let (endpoint, request) = local_response(json!({}));
        let store = DynamoDbIndexStore::build(&test_config(&endpoint), "synthetic-indexes".to_string());
        let canister_id = CanisterId::anonymous();
        store.set(canister_id, 42).await.unwrap();
        let (headers, body) = request.join().unwrap();
        assert!(
            headers
                .to_ascii_lowercase()
                .contains("x-amz-target: dynamodb_20120810.putitem")
        );
        assert_eq!(
            body,
            json!({"TableName": "synthetic-indexes", "Item": {"canister_id": {"S": canister_id.to_string()}, "index": {"N": "42"}}})
        );
    }
}
