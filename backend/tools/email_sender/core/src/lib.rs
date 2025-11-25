use async_trait::async_trait;
use email_magic_links::SignedMagicLink;

#[async_trait]
pub trait EmailSender: Send + Sync {
    async fn send(&self, magic_link: SignedMagicLink, now_millis: u64) -> Result<(), String>;
}

#[derive(Default)]
pub struct NullEmailSender {}

#[async_trait]
impl EmailSender for NullEmailSender {
    async fn send(&self, _magic_link: SignedMagicLink, _now_millis: u64) -> Result<(), String> {
        Ok(())
    }
}
