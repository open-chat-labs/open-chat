use crate::env;
use email_magic_links::SignedMagicLink;
use email_sender_core::EmailSender;
use sign_in_with_email_canister::EmailSenderConfig;
use std::sync::OnceLock;

static EMAIL_SENDER: OnceLock<Box<dyn EmailSender>> = OnceLock::new();

pub fn init_from_config(config: EmailSenderConfig) {
    #[allow(unused_variables)]
    match config {
        EmailSenderConfig::Aws(aws) => {
            #[cfg(feature = "email_sender_aws")]
            {
                init(email_sender_aws::AwsEmailSender::new(
                    aws.region,
                    aws.function_url,
                    aws.access_key,
                    aws.secret_key,
                ));
            }

            #[cfg(not(feature = "email_sender_aws"))]
            panic!("Canister must be built with the \"aws\" feature enabled in order to use the AWS email sender");
        }
    }
}

pub fn init(email_sender: impl EmailSender + 'static) {
    EMAIL_SENDER
        .set(Box::new(email_sender))
        .unwrap_or_else(|_| panic!("Email sender already set"));
}

pub async fn send_magic_link(magic_link: SignedMagicLink) -> Result<(), String> {
    let sender = EMAIL_SENDER.get().expect("Email sender has not been set");

    sender.send(magic_link, env::now()).await
}
