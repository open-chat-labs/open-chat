use async_trait::async_trait;
use aws_sdk_dynamodb::Client;
use aws_sdk_dynamodb::types::AttributeValue;
use aws_types::sdk_config::SdkConfig;
use index_store::IndexStore;
use std::str::FromStr;
use types::Error;

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
    // The key attribute is named `canister_id` since that's what the keys were before there were others
    async fn get(&self, key: &str) -> Result<Option<u64>, Error> {
        let response = self
            .client
            .get_item()
            .table_name(&self.table_name)
            .key("canister_id", AttributeValue::S(key.to_string()))
            .send()
            .await?;

        if let Some(item) = response.item {
            let value = item.get("index").unwrap().as_n().unwrap();
            Ok(Some(u64::from_str(value).unwrap()))
        } else {
            Ok(None)
        }
    }

    async fn set(&self, key: &str, index: u64) -> Result<(), Error> {
        self.client
            .put_item()
            .table_name(&self.table_name)
            .item("canister_id", AttributeValue::S(key.to_string()))
            .item("index", AttributeValue::N(index.to_string()))
            .send()
            .await?;

        Ok(())
    }
}
