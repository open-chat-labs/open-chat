use aws_sdk_dynamodb::model::AttributeValue;
use aws_sdk_dynamodb::{Blob, Client};
use lambda_runtime::Error;
use shared::types::notifications::Subscription;
use shared::types::CanisterId;
use std::str::FromStr;

pub struct DynamoDbClient {
    client: Client,
}

impl DynamoDbClient {
    pub fn build() -> DynamoDbClient {
        let config = aws_sdk_dynamodb::Config::builder().build();

        let client = Client::from_conf(config);

        DynamoDbClient { client }
    }

    pub async fn get_event_index(&self, canister_id: CanisterId) -> Result<u64, Error> {
        match self
            .client
            .get_item()
            .table_name("push_notification_stream_indexes")
            .key("canister_id", AttributeValue::B(Blob::new(canister_id.as_slice().to_vec())))
            .send()
            .await
        {
            Ok(response) => {
                if let Some(item) = response.item {
                    let value = item.get("index").unwrap().as_n().unwrap();
                    Ok(u64::from_str(value).unwrap())
                } else {
                    Ok(0)
                }
            }
            Err(error) => Err(error.into()),
        }
    }

    pub async fn set_event_index(&self, canister_id: CanisterId, event_index: u64) -> Result<(), Error> {
        self.client
            .put_item()
            .table_name("push_notification_stream_indexes")
            .item("canister_id", AttributeValue::B(Blob::new(canister_id.as_slice().to_vec())))
            .item("index", AttributeValue::N(event_index.to_string()))
            .send()
            .await
            .map(|_| ())
            .map_err(|e| e.into())
    }

    pub async fn update_subscriptions(&self, _subscriptions: Vec<Subscription>) -> Result<(), Error> {
        unimplemented!()
    }
}
