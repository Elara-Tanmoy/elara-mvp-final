# Elara Proxy Service

Secure web proxy service for the Elara Security Platform.

## Features

- Validates URLs for security (blocks localhost, private IPs, internal domains)
- Fetches web content safely
- Returns sanitized responses
- 30-second timeout on requests
- 10MB max response size
- Comprehensive logging

## Endpoints

### POST /proxy
Proxy a web request

**Request:**
```json
{
  "url": "https://example.com",
  "sessionId": "abc123"
}
```

**Response:**
```json
{
  "success": true,
  "content": "HTML content...",
  "statusCode": 200,
  "headers": {},
  "contentLength": 1234,
  "finalUrl": "https://example.com"
}
```

### POST /validate
Validate a URL without fetching

**Request:**
```json
{
  "url": "https://example.com"
}
```

**Response:**
```json
{
  "success": true,
  "valid": true,
  "url": "https://example.com"
}
```

### GET /health
Health check endpoint

## Environment Variables

- `PORT` - Port to run on (default: 8080)
- `CORS_ORIGIN` - Allowed CORS origin (default: *)

## Deployment

### Local Development
```bash
pip install -r requirements.txt
python app.py
```

### Docker
```bash
docker build -t elara-proxy .
docker run -p 8080:8080 elara-proxy
```

### Render.com
Configured in `render.yaml` at project root.
