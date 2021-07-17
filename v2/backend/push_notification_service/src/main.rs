use lambda_runtime::{handler_fn, Context, Error};
use log::LevelFilter;
use serde::{Deserialize, Serialize};
use simple_logger::SimpleLogger;

#[tokio::main]
async fn main() -> Result<(), Error> {
    let func = handler_fn(my_handler);
    lambda_runtime::run(func).await?;
    Ok(())
}

pub async fn my_handler(ctx: Context) -> Result<(), Error> {
    let dynamodb_client = DynamoDbClient::new(Region::UsEast1);


    Ok(resp)
}