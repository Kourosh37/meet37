use axum::{
    extract::{Request, State},
    middleware::Next,
    response::Response,
};
use redis::AsyncCommands;

use crate::{error::AppError, state::AppState};

pub async fn enforce_limits(
    State(state): State<AppState>,
    request: Request,
    next: Next,
) -> Result<Response, AppError> {
    if let Some(limit) = limit_for_request(&request) {
        let ip = client_ip(&request);
        let window = current_window();
        let key = format!("rate:{window}:{ip}:{}", limit.namespace);

        let mut conn = state.redis_client.get_multiplexed_async_connection().await?;
        let current: i64 = conn.incr(&key, 1).await?;
        if current == 1 {
            let _: () = conn.expire(&key, 60).await?;
        }

        if current > limit.requests_per_minute {
            return Err(AppError::TooManyRequests(format!(
                "rate limit exceeded for {}",
                limit.namespace
            )));
        }
    }

    Ok(next.run(request).await)
}

struct RateLimitRule {
    namespace: &'static str,
    requests_per_minute: i64,
}

fn limit_for_request(request: &Request) -> Option<RateLimitRule> {
    let method = request.method();
    let path = request.uri().path();

    if method == axum::http::Method::POST && path == "/rooms" {
        return Some(RateLimitRule {
            namespace: "create-room",
            requests_per_minute: 1200,
        });
    }

    if method == axum::http::Method::POST
        && path.starts_with("/rooms/")
        && path.ends_with("/join")
    {
        return Some(RateLimitRule {
            namespace: "join-room",
            requests_per_minute: 2400,
        });
    }

    if method == axum::http::Method::POST && path == "/files/upload-url" {
        return Some(RateLimitRule {
            namespace: "upload-url",
            requests_per_minute: 1800,
        });
    }

    None
}

fn client_ip(request: &Request) -> String {
    if let Some(forwarded_for) = request.headers().get("x-forwarded-for") {
        if let Ok(raw) = forwarded_for.to_str() {
            if let Some(first) = raw.split(',').next() {
                let ip = first.trim();
                if !ip.is_empty() {
                    return ip.to_owned();
                }
            }
        }
    }

    "unknown".to_owned()
}

fn current_window() -> i64 {
    let seconds = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or(0);

    (seconds / 60) as i64
}
