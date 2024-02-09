use canister_agent_utils::{build_ic_agent, get_dfx_identity};
use itertools::Itertools;
use serde_json::{Map, Value};
use std::{
    collections::{hash_map::Entry, HashMap},
    error::Error,
    fs,
};
use translations_canister::pending_deployment::{Response, SuccessResponse, Translation};
use types::{CanisterId, Empty, TimestampMillis};

use crate::Config;

pub async fn run(config: Config) -> Result<(), Box<dyn Error + Send + Sync>> {
    let mut translations = read_translations_from_files(&config.directory).await?;

    let corrections =
        read_latest_translation_corrections(&config.url, &config.controller, &config.translations_canister_id).await?;

    let any_corrections = !corrections.translations.is_empty();

    merge_translations(&mut translations, corrections.translations)?;

    write_translation_files(&config.directory, translations).await?;

    // Don't overwrite the latest approval timestamp if there are no corrections
    if any_corrections {
        write_latest_approval(&config.directory, corrections.latest_approval).await?;
    }

    Ok(())
}

async fn read_translations_from_files(
    path: &str,
) -> Result<HashMap<String, HashMap<String, String>>, Box<dyn Error + Send + Sync>> {
    let mut files = HashMap::new();

    let paths = fs::read_dir(path)?;

    for entry in paths {
        let entry = entry?;
        let meta = entry.metadata()?;
        if meta.is_file() {
            let filename = entry.file_name().into_string().unwrap();
            let parts: Vec<_> = filename.split('.').collect();
            if parts.len() == 2 && parts[1] == "json" {
                let locale = parts[0];
                let path_buf = entry.path();
                let path = path_buf.to_str().unwrap();
                let file = read_translations_from_file(path).await?;
                files.insert(locale.to_string(), file);
            }
        }
    }

    Ok(files)
}

async fn read_translations_from_file(path: &str) -> Result<HashMap<String, String>, Box<dyn Error + Send + Sync>> {
    fn parse_object(
        key_prefix: &str,
        object: Map<String, Value>,
        translations: &mut HashMap<String, String>,
    ) -> Result<(), Box<dyn Error + Send + Sync>> {
        for (key, value) in object {
            let full_key = if key_prefix.is_empty() { key } else { format!("{key_prefix}.{key}") };
            match value {
                Value::String(s) => {
                    translations.insert(full_key, s);
                }
                Value::Object(o) => parse_object(&full_key, o, translations)?,
                _ => return Err("Syntax error")?,
            }
        }

        Ok(())
    }

    let mut translations = HashMap::new();

    let file = fs::read_to_string(path)?;
    let json: Value = serde_json::from_str(&file)?;

    let Value::Object(object) = json else {
        return Err("Syntax error")?;
    };

    parse_object("", object, &mut translations)?;

    Ok(translations)
}

async fn read_latest_translation_corrections(
    url: &str,
    controller: &str,
    translations_canister_id: &CanisterId,
) -> Result<SuccessResponse, Box<dyn Error + Send + Sync>> {
    let identity = get_dfx_identity(controller);
    let agent = build_ic_agent(url.to_string(), identity).await;

    translations_canister_client::pending_deployment(&agent, translations_canister_id, &Empty {})
        .await
        .map(|response| match response {
            Response::Success(result) => Ok(result),
        })?
}

fn merge_translations(
    translations: &mut HashMap<String, HashMap<String, String>>,
    corrections: Vec<Translation>,
) -> Result<(), Box<dyn Error + Send + Sync>> {
    for correction in corrections {
        let locale = correction.locale;
        let Some(file) = translations.get_mut(&locale) else {
            Err(format!("Locale not found: {locale}"))?
        };

        match file.entry(correction.key) {
            Entry::Occupied(mut o) => {
                o.insert(correction.value);
            }
            Entry::Vacant(v) => {
                let key = v.into_key();
                Err(format!("Key not found: {locale} {key}"))?
            }
        }
    }

    Ok(())
}

async fn write_translation_files(
    path: &str,
    data: HashMap<String, HashMap<String, String>>,
) -> Result<(), Box<dyn Error + Send + Sync>> {
    fn build_object(translations: Vec<&(String, String)>, depth: usize) -> Value {
        let mut map = Map::new();

        for (key, group) in &translations.into_iter().group_by(|(k, _)| k.split('.').nth(depth).unwrap()) {
            let group_vec: Vec<_> = group.collect();
            let (k0, v0) = group_vec[0];

            let value = if group_vec.len() == 1 && k0.matches('.').count() <= depth {
                Value::String(v0.clone())
            } else {
                build_object(group_vec, depth + 1)
            };

            map.insert(key.to_string(), value);
        }

        Value::Object(map)
    }

    for (locale, translations) in data {
        let mut translations: Vec<_> = translations.into_iter().collect();
        translations.sort_by(|(k1, _), (k2, _)| k1.partial_cmp(k2).unwrap());

        let object = build_object(translations.iter().collect(), 0);

        let text = serde_json::to_string_pretty(&object)?;
        fs::write(format!("{path}/{locale}.json"), text)?;
    }
    Ok(())
}

async fn write_latest_approval(path: &str, timestamp: TimestampMillis) -> Result<(), Box<dyn Error + Send + Sync>> {
    let text = serde_json::to_string_pretty(&timestamp)?;
    fs::write(format!("{path}/latest-approval.txt"), text)?;
    Ok(())
}
