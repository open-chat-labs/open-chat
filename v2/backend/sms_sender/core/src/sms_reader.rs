use async_trait::async_trait;
use types::Error;
use user_index_canister::sms_messages;

#[async_trait]
pub trait SmsReader {
    async fn get(&self, from_index: u64) -> Result<sms_messages::SuccessResult, Error>;
    async fn remove(&self, up_to_index: u64) -> Result<(), Error>;
}
