use std::env;

use crate::error::AppError;

#[derive(Debug, Clone)]
pub struct AppConfig {
    pub port: u16,
    pub database_url: String,
    pub redis_url: String,
}

impl AppConfig {
    pub fn from_env() -> Result<Self, AppError> {
        let port = env::var("PORT")
            .ok()
            .and_then(|raw| raw.parse::<u16>().ok())
            .unwrap_or(8080);
        let database_url = required_var("DATABASE_URL")?;
        let redis_url = required_var("REDIS_URL")?;

        Ok(Self {
            port,
            database_url,
            redis_url,
        })
    }
}

fn required_var(name: &str) -> Result<String, AppError> {
    env::var(name).map_err(|_| AppError::Config(format!("missing required env var `{name}`")))
}
