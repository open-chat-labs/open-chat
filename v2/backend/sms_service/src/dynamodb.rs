use aws_sdk_dynamodb::model::AttributeValue;
use aws_sdk_dynamodb::{Blob, Client};
use lambda_runtime::Error;
use std::str::FromStr;
use types::CanisterId;

pub struct DynamoDbClient {
    client: Client,
}

impl DynamoDbClient {
    pub fn build() -> DynamoDbClient {
        let client = Client::from_env();

        DynamoDbClient { client }
    }

    pub async fn get_sms_index_processed_up_to(&self, canister_id: CanisterId) -> Result<Option<u64>, Error> {
        let response = self
            .client
            .get_item()
            .table_name("sms_stream_indexes")
            .key("canister_id", AttributeValue::B(Blob::new(canister_id.as_slice().to_vec())))
            .send()
            .await?;

        if let Some(item) = response.item {
            let value = item.get("index").unwrap().as_n().unwrap();
            Ok(Some(u64::from_str(value).unwrap()))
        } else {
            Ok(None)
        }
    }

    pub async fn set_sms_index_processed_up_to(&self, canister_id: CanisterId, sms_index: u64) -> Result<(), Error> {
        self.client
            .put_item()
            .table_name("sms_stream_indexes")
            .item("canister_id", AttributeValue::B(Blob::new(canister_id.as_slice().to_vec())))
            .item("index", AttributeValue::N(sms_index.to_string()))
            .send()
            .await?;

        Ok(())
    }
}
