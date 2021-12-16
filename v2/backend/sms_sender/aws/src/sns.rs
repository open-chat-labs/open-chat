use async_trait::async_trait;
use aws_sdk_sns::model::MessageAttributeValue;
use aws_sdk_sns::{Client, Config};
use sms_sender_core::SmsSender;
use std::collections::HashMap;
use types::Error;

pub struct SnsClient {
    client: Client,
}

impl SnsClient {
    pub fn build(config: Config) -> SnsClient {
        let client = Client::from_conf(config);

        SnsClient { client }
    }
}

#[async_trait]
impl SmsSender for SnsClient {
    async fn send(&self, phone_number: String, code: String) -> Result<(), Error> {
        let sender = MessageAttributeValue::builder()
            .data_type("String")
            .string_value("OpenChat")
            .build();

        let message_attributes: HashMap<_, _> = vec![("AWS.SNS.SMS.SenderID".to_string(), sender)].into_iter().collect();

        self.client
            .publish()
            .phone_number(phone_number)
            .message(format!("OpenChat confirmation code: {}", code))
            .set_message_attributes(Some(message_attributes.clone()))
            .send()
            .await?;

        Ok(())
    }
}
