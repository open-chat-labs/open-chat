use aws_config::BehaviorVersion;
use aws_lambda_events::event::sqs::SqsEvent;
use aws_lambda_events::sqs::SqsMessage;
use aws_sdk_sesv2::types::builders::{DestinationBuilder, EmailContentBuilder, TemplateBuilder};
use aws_sdk_sesv2::Client as SesClient;
use lambda_runtime::{run, service_fn, Error, LambdaEvent};
use magic_links::SignedMagicLink;
use rsa::pkcs1::DecodeRsaPrivateKey;
use rsa::RsaPrivateKey;
use serde::Serialize;
use tracing::{error, info};

const TEMPLATE_NAME: &str = "MagicLink";

#[tokio::main]
async fn main() -> Result<(), Error> {
    tracing_subscriber::fmt()
        .with_max_level(tracing::Level::INFO)
        .with_target(false)
        .without_time()
        .init();

    run(service_fn(function_handler)).await
}

async fn function_handler(event: LambdaEvent<SqsEvent>) -> Result<(), Error> {
    let aws_config = aws_config::load_defaults(BehaviorVersion::latest()).await;
    let ses_client = SesClient::new(&aws_config);
    let rsa_private_key_pem = std::env::var("RSA_PRIVATE_KEY_PEM")?.replace("\\n", "\n");
    let rsa_private_key = RsaPrivateKey::from_pkcs1_pem(&rsa_private_key_pem)?;

    for event in event.payload.records {
        if let Err(error) = process_record(event, rsa_private_key.clone(), &ses_client).await {
            error!(?error, "Error processing record");
        }
    }

    Ok(())
}

async fn process_record(
    message: SqsMessage,
    rsa_private_key: RsaPrivateKey,
    ses_client: &SesClient,
) -> Result<(), Error> {
    let body = message.body.unwrap_or_default();

    info!("Processing SQS Message: {body}");

    let magic_link: SignedMagicLink = serde_json::from_str(&body)?;
    let email = magic_link.magic_link.email().to_string();

    let signed = magic_link.sign(rsa_private_key);

    let querystring = signed.build_querystring();
    let magic_link_url = format!("https://oc.app/home{querystring}");
    let template_data = TemplateData {
        magic_link: magic_link_url,
    };

    match ses_client
        .send_email()
        .from_email_address("noreply@oc.app")
        .destination(DestinationBuilder::default().to_addresses(email).build())
        .content(
            EmailContentBuilder::default()
                .template(
                    TemplateBuilder::default()
                        .template_name(TEMPLATE_NAME)
                        .template_data(serde_json::to_string(&template_data).unwrap())
                        .build(),
                )
                .build(),
        )
        .send()
        .await
    {
        Ok(_) => {
            info!("Successfully sent email");
            Ok(())
        }
        Err(error) => {
            error!(?error, "Failed to send email");
            Err(error.into())
        }
    }
}

#[derive(Serialize)]
struct TemplateData {
    magic_link: String,
}
