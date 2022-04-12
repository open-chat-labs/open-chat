use async_trait::async_trait;
use aws_sdk_dynamodb::model::AttributeValue;
use aws_sdk_dynamodb::Client;
use aws_types::sdk_config::SdkConfig;
use index_store::IndexStore;
use std::str::FromStr;
use types::{CanisterId, Error};

pub struct DynamoDbIndexStore {
    client: Client,
    table_name: String,
    canister_id_attr: AttributeValue,
}

impl DynamoDbIndexStore {
    pub fn build(config: &SdkConfig, table_name: String, canister_id: CanisterId) -> DynamoDbIndexStore {
        let client = Client::new(config);

        DynamoDbIndexStore {
            client,
            table_name,
            canister_id_attr: AttributeValue::S(canister_id.to_string()),
        }
    }
}

#[async_trait]
impl IndexStore for DynamoDbIndexStore {
    async fn get(&self) -> Result<Option<u64>, Error> {
        let response = self
            .client
            .get_item()
            .table_name(&self.table_name)
            .key("canister_id", self.canister_id_attr.clone())
            .send()
            .await?;

        if let Some(item) = response.item {
            let value = item.get("index").unwrap().as_n().unwrap();
            Ok(Some(u64::from_str(value).unwrap()))
        } else {
            Ok(None)
        }
    }

    async fn set(&self, index: u64) -> Result<(), Error> {
        self.client
            .put_item()
            .table_name(&self.table_name)
            .item("canister_id", self.canister_id_attr.clone())
            .item("index", AttributeValue::N(index.to_string()))
            .send()
            .await?;

        Ok(())
    }
}
