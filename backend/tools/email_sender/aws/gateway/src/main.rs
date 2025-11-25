use aws_config::BehaviorVersion;
use aws_lambda_events::lambda_function_urls::LambdaFunctionUrlRequest;
use aws_sdk_sns::Client as SnsClient;
use lambda_runtime::{run, service_fn, Error, LambdaEvent};

#[tokio::main]
async fn main() -> Result<(), Error> {
    tracing_subscriber::fmt()
        .with_max_level(tracing::Level::INFO)
        .with_target(false)
        .without_time()
        .init();

    run(service_fn(function_handler)).await
}

async fn function_handler(event: LambdaEvent<LambdaFunctionUrlRequest>) -> Result<(), Error> {
    let aws_config = aws_config::load_defaults(BehaviorVersion::latest()).await;
    let sns_client = SnsClient::new(&aws_config);
    let target_arn = std::env::var("SNS_TARGET_ARN").unwrap();

    sns_client
        .publish()
        .target_arn(target_arn)
        .message(event.payload.body.unwrap())
        .message_group_id("0")
        .send()
        .await?;

    Ok(())
}
