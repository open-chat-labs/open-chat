use async_trait::async_trait;
use types::Error;

#[async_trait]
pub trait SmsSender {
    async fn send(&self, phone_number: String, code: String) -> Result<(), Error>;
}
