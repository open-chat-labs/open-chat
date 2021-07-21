use crate::dynamodb::DynamoDbClient;
use crate::ic_agent::IcAgent;
use crate::read_env_var;
use lambda_runtime::Error;
use shared::types::CanisterId;

pub async fn run(canister_id: CanisterId) -> Result<(), Error> {
    let dynamodb_client = DynamoDbClient::build();

    let ic_identity_pem = read_env_var("IC_IDENTITY_PEM")?;
    let ic_agent = IcAgent::build(&ic_identity_pem)?;
    let maybe_notification_index_processed_up_to = dynamodb_client.get_notification_index_processed_up_to(canister_id).await?;

    if let Some(notification_index_processed_up_to) = maybe_notification_index_processed_up_to {
        ic_agent
            .remove_notifications(canister_id, notification_index_processed_up_to)
            .await?;
    }

    Ok(())
}
