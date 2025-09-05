use base64::Engine;
use serde::Serialize;
use serde::de::DeserializeOwned;

pub fn from_value<T>(value: &T) -> String
where
    T: Serialize,
{
    let json = json::serialize(value).unwrap();
    base64::engine::general_purpose::STANDARD.encode(json)
}

pub fn to_value<T: DeserializeOwned>(text: &str) -> Result<T, Box<dyn std::error::Error + Sync + Send>> {
    let json = base64::engine::general_purpose::STANDARD.decode(text)?;
    let result = json::deserialize(&json)?;
    Ok(result)
}
