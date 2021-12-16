use async_trait::async_trait;
use aws_sdk_sns::{Client, Config};
use sms_sender_core::SmsSender;
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
        self.client
            .publish()
            .phone_number(phone_number)
            .message(format!(
                "Your OpenChat confirmation code is {}. This code will expire in 1 hour.",
                code
            ))
            .send()
            .await?;

        Ok(())
    }
}
