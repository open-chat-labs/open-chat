use aws_sdk_sns::model::MessageAttributeValue;
use aws_sdk_sns::Client;
use lambda_runtime::Error;
use std::collections::HashMap;
use types::confirmation_code_sms::ConfirmationCodeSms;

pub struct SnsClient {
    client: Client,
}

impl SnsClient {
    pub fn build() -> SnsClient {
        let client = Client::from_env();

        SnsClient { client }
    }

    pub async fn push_messages(&self, messages: Vec<ConfirmationCodeSms>) -> Result<(), Error> {
        let sender = MessageAttributeValue::builder()
            .data_type("String")
            .string_value("OpenChat")
            .build();
        let message_attributes: HashMap<_, _> = vec![("AWS.SNS.SMS.SenderID".to_string(), sender)].into_iter().collect();

        let futures: Vec<_> = messages
            .into_iter()
            .map(|m| {
                self.client
                    .publish()
                    .phone_number(m.phone_number)
                    .message(format!("Confirmation code: {}", m.confirmation_code))
                    .set_message_attributes(Some(message_attributes.clone()))
                    .send()
            })
            .collect();

        futures::future::join_all(futures).await;

        Ok(())
    }
}
