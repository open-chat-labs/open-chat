use aws_config::BehaviorVersion;
use aws_sdk_sesv2::types::builders::EmailTemplateContentBuilder;
use aws_sdk_sesv2::Client as SesClient;
use lambda_runtime::{run, service_fn, Error, LambdaEvent};

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

const SUBJECT: &str = "OpenChat sign in link";
const MESSAGE_HTML: &str =
    "<p>Click here to sign in to OpenChat<p/><h4><a href=\"{{magic_link}}\">sign in link</a></h4>";

async fn function_handler(_event: LambdaEvent<u32>) -> Result<(), Error> {
    let aws_config = aws_config::load_defaults(BehaviorVersion::latest()).await;
    let ses_client = SesClient::new(&aws_config);

    ses_client
        .update_email_template()
        .template_name(TEMPLATE_NAME)
        .template_content(
            EmailTemplateContentBuilder::default()
                .subject(SUBJECT)
                .html(MESSAGE_HTML)
                .build(),
        )
        .send()
        .await?;

    Ok(())
}
