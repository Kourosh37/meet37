use std::env;

use crate::error::AppError;

#[derive(Debug, Clone)]
pub struct AppConfig {
    pub port: u16,
}

impl AppConfig {
    pub fn from_env() -> Result<Self, AppError> {
        let port = env::var("PORT")
            .ok()
            .and_then(|raw| raw.parse::<u16>().ok())
            .unwrap_or(8080);

        Ok(Self { port })
    }
}
