use crate::dynamodb::DynamoDbClient;
use crate::ic_agent::IcAgent;
use crate::read_env_var;
use lambda_runtime::Error;
use types::CanisterId;

pub async fn run(canister_id: CanisterId) -> Result<(), Error> {
    let dynamodb_client = DynamoDbClient::build();

    let ic_identity_pem = read_env_var("IC_IDENTITY_PEM")?;
    let ic_agent = IcAgent::build(&ic_identity_pem)?;
    let maybe_sms_index_processed_up_to = dynamodb_client.get_sms_index_processed_up_to(canister_id).await?;

    if let Some(sms_index_processed_up_to) = maybe_sms_index_processed_up_to {
        ic_agent.remove_sms_messages(canister_id, sms_index_processed_up_to).await?;
    }

    Ok(())
}
