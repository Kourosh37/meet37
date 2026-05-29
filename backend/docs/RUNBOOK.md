# Local Runbook

## Prerequisites

- Go 1.24 or newer.
- GCC toolchain for `github.com/mattn/go-sqlite3` because it uses CGO.
- PowerShell, Bash, or another shell.

## Install Dependencies

```bash
cd backend
go mod download
```

If a custom `GOPROXY` causes dependency resolution issues, use:

```bash
GOPROXY=https://proxy.golang.org,direct go mod download
```

PowerShell:

```powershell
$env:GOPROXY = "https://proxy.golang.org,direct"
go mod download
```

## Run Locally

```bash
cp .env.example .env
cd backend
go run ./cmd/server
```

By default, the service uses:

```text
PORT=8080
DB_PATH=/data/meet.db
```

For local development without writing to system `/data`, override:

```bash
DB_PATH=./data/meet.db go run ./cmd/server
```

PowerShell:

```powershell
$env:DB_PATH = "data/meet.db"
go run ./cmd/server
```

## Health Check

```bash
curl http://localhost:8080/health
```

Expected:

```text
ok
```

## Login As Admin

```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"change_me_strong_password"}'
```

Use the returned token for admin requests.

## Create A Public Room

```bash
curl -X POST http://localhost:8080/api/rooms \
  -H "Content-Type: application/json" \
  -d '{"name":"Demo","join_policy":"open","max_peers":20}'
```

The response includes a `host_token`. Keep it private.

## Common Local Issues

### SQLite CGO Build Fails

Install GCC.

On Windows, the current workspace has been tested with a GCC toolchain available on PATH.

### Port Already In Use

Set another port:

```bash
PORT=18080 go run ./cmd/server
```

### Database Permission Error

Use a writable DB path:

```bash
DB_PATH=./data/meet.db go run ./cmd/server
```

The backend creates parent directories automatically.
