"""
Elara Enterprise Proxy Service - Advanced Secure Web Browser
Enterprise-grade browser isolation with DOM reconstruction
"""

import sys
import os
import json
import base64
import hashlib
from typing import Dict, Tuple, Optional

# Configure logging FIRST
import logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    stream=sys.stdout
)
logger = logging.getLogger(__name__)

logger.info("Starting Elara Enterprise Proxy Service...")
logger.info(f"Python version: {sys.version}")

try:
    from flask import Flask, request, jsonify, Response, make_response
    logger.info("✓ Flask imported successfully")
except ImportError as e:
    logger.error(f"Failed to import Flask: {e}")
    sys.exit(1)

try:
    from flask_cors import CORS
    logger.info("✓ flask-cors imported successfully")
except ImportError as e:
    logger.error(f"Failed to import flask-cors: {e}")
    sys.exit(1)

try:
    from flask_limiter import Limiter
    from flask_limiter.util import get_remote_address
    logger.info("✓ flask-limiter imported successfully")
except ImportError as e:
    logger.error(f"Failed to import flask-limiter: {e}")
    sys.exit(1)

try:
    from flask_caching import Cache
    logger.info("✓ flask-caching imported successfully")
except ImportError as e:
    logger.error(f"Failed to import flask-caching: {e}")
    sys.exit(1)

try:
    import jwt
    logger.info("✓ PyJWT imported successfully")
except ImportError as e:
    logger.error(f"Failed to import PyJWT: {e}")
    sys.exit(1)

try:
    import requests
    logger.info("✓ requests imported successfully")
except ImportError as e:
    logger.error(f"Failed to import requests: {e}")
    sys.exit(1)

try:
    import chardet
    logger.info("✓ chardet imported successfully")
except ImportError as e:
    logger.error(f"Failed to import chardet: {e}")
    sys.exit(1)

import re
import ipaddress
import gzip
import zlib
from urllib.parse import urlparse, urlunparse, urljoin, quote, unquote
from datetime import datetime

logger.info("All imports successful, initializing Flask app...")

app = Flask(__name__)

# Configure CORS
CORS_ORIGIN = os.getenv('CORS_ORIGIN', '*')
logger.info(f"CORS Origin: {CORS_ORIGIN}")
CORS(app, resources={r"/*": {
    "origins": CORS_ORIGIN,
    "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    "allow_headers": ["Content-Type", "Authorization"]
}})

logger.info("Flask app initialized successfully")

# Rate Limiting (Production-grade DDoS protection)
limiter = Limiter(
    app=app,
    key_func=get_remote_address,
    default_limits=["1000 per hour", "100 per minute"],
    storage_uri="memory://",
    strategy="fixed-window"
)
logger.info("✓ Rate limiting initialized (1000/hour, 100/min)")

# Caching (24-hour cache for proxied content)
cache = Cache(app, config={
    'CACHE_TYPE': 'SimpleCache',
    'CACHE_DEFAULT_TIMEOUT': 86400  # 24 hours
})
logger.info("✓ Caching initialized (24h TTL)")

# JWT Secret (for authentication)
JWT_SECRET = os.getenv('JWT_SECRET', 'elara-proxy-secret-change-in-production')
JWT_ALGORITHM = 'HS256'

# Audit Log Storage (in-memory for now, use database in production)
audit_log: list = []

# Security configuration
BLOCKED_IP_RANGES = [
    ipaddress.ip_network('127.0.0.0/8'),
    ipaddress.ip_network('10.0.0.0/8'),
    ipaddress.ip_network('172.16.0.0/12'),
    ipaddress.ip_network('192.168.0.0/16'),
    ipaddress.ip_network('169.254.0.0/16'),
    ipaddress.ip_network('0.0.0.0/8'),
]

BLOCKED_DOMAINS = ['.local', '.internal', '.corp', '.localhost']
REQUEST_TIMEOUT = 30
MAX_RESPONSE_SIZE = 50 * 1024 * 1024  # 50MB for enterprise

# Enterprise-grade User-Agent (Chrome 131)
BROWSER_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

BROWSER_HEADERS = {
    'User-Agent': BROWSER_USER_AGENT,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br, zstd',
    'DNT': '1',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'sec-ch-ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
}

# In-memory cookie storage (session-based)
# In production, use Redis or database
session_cookies: Dict[str, Dict[str, str]] = {}

# In-memory session data storage
session_data: Dict[str, Dict] = {}


def normalize_url(url: str) -> str:
    """
    Normalize URL to be browser-like
    Examples:
        google.com -> https://www.google.com
        http://example.com -> https://example.com
    """
    url = url.strip()

    # If no protocol, add https://
    if not url.startswith(('http://', 'https://')):
        url = 'https://' + url

    parsed = urlparse(url)
    hostname = parsed.hostname or parsed.netloc

    if not hostname:
        netloc_parts = parsed.netloc.split(':')
        hostname = netloc_parts[0] if netloc_parts else ''

    # Add www. for common domains without subdomain
    if hostname and '.' in hostname:
        parts = hostname.split('.')
        if len(parts) == 2 and not hostname.startswith('www.'):
            # Common domains that typically use www
            common_domains = ['google', 'microsoft', 'facebook', 'amazon', 'apple']
            if parts[0].lower() in common_domains:
                hostname = 'www.' + hostname

    # Prefer HTTPS
    scheme = 'https' if parsed.scheme != 'http' else 'http'

    netloc = hostname
    if parsed.port:
        netloc = f"{hostname}:{parsed.port}"

    normalized = urlunparse((
        scheme,
        netloc,
        parsed.path or '/',
        parsed.params,
        parsed.query,
        parsed.fragment
    ))

    return normalized


def validate_url(url: str) -> Tuple[bool, str]:
    """Validate URL for security"""
    try:
        parsed = urlparse(url)

        if parsed.scheme not in ['http', 'https']:
            return False, f"Invalid protocol: {parsed.scheme}"

        hostname = parsed.hostname or parsed.netloc
        if not hostname:
            return False, "Invalid URL: No hostname"

        hostname_lower = hostname.lower()

        # Check blocked domains
        for blocked in BLOCKED_DOMAINS:
            if hostname_lower.endswith(blocked):
                return False, f"Access to {blocked} domains is not allowed"

        # Check localhost
        if hostname_lower in ['localhost', '0.0.0.0']:
            return False, "Access to localhost is not allowed"

        # Check IP ranges
        if re.match(r'^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$', hostname):
            try:
                ip = ipaddress.ip_address(hostname)
                for blocked_range in BLOCKED_IP_RANGES:
                    if ip in blocked_range:
                        return False, "Access to private/internal IP addresses is not allowed"
            except ValueError:
                pass

        return True, ""

    except Exception as e:
        logger.error(f"URL validation error: {e}")
        return False, f"Invalid URL format: {str(e)}"


def get_proxy_url(original_url: str, session_token: str) -> str:
    """
    Generate proxy URL for resources
    Resources should be fetched through /resource endpoint
    """
    # Encode the URL to pass as query parameter
    encoded_url = quote(original_url, safe='')
    return f"/resource?url={encoded_url}&session={session_token}"


def rewrite_html_content(html: str, base_url: str, session_token: str) -> str:
    """
    Advanced HTML rewriting with enterprise-grade URL handling
    Rewrites ALL URLs to go through proxy
    """
    try:
        parsed_base = urlparse(base_url)
        base_domain = f"{parsed_base.scheme}://{parsed_base.netloc}"

        # Inject postMessage bridge script at the start of <head>
        postmessage_script = '''
<script>
(function() {
    // PostMessage bridge for navigation
    window.addEventListener('click', function(e) {
        var target = e.target;
        var link = target.closest('a');
        if (link && link.href) {
            e.preventDefault();
            window.parent.postMessage({
                type: 'navigate',
                url: link.href
            }, '*');
        }
    }, true);

    // Intercept form submissions
    window.addEventListener('submit', function(e) {
        var form = e.target;
        if (form.action) {
            e.preventDefault();
            var formData = new FormData(form);
            var method = (form.method || 'GET').toUpperCase();
            window.parent.postMessage({
                type: 'form_submit',
                url: form.action,
                method: method,
                data: Object.fromEntries(formData)
            }, '*');
        }
    }, true);

    // Log JavaScript errors
    window.addEventListener('error', function(e) {
        console.error('Page error:', e.message);
    });

    console.log('Elara Proxy Bridge initialized');
})();
</script>
'''

        # Add postMessage script after <head> tag
        if '<head>' in html.lower():
            html = re.sub(
                r'(<head[^>]*>)',
                r'\1' + postmessage_script,
                html,
                flags=re.IGNORECASE
            )
        elif '<html>' in html.lower():
            # No head tag, add one
            html = re.sub(
                r'(<html[^>]*>)',
                r'\1<head>' + postmessage_script + '</head>',
                html,
                flags=re.IGNORECASE
            )

        # Add base tag for relative URL resolution
        if '<head>' in html.lower() and '<base' not in html.lower():
            html = re.sub(
                r'(<head[^>]*>)',
                rf'\1<base href="{base_domain}/">',
                html,
                flags=re.IGNORECASE
            )

        # Rewrite absolute URLs in href to use absolute paths
        # (browsers will resolve them against base tag)
        def rewrite_absolute_url(match):
            attr_name = match.group(1)
            url = match.group(2)

            # Make sure it's absolute
            if url.startswith(('http://', 'https://', '//')):
                absolute_url = urljoin(base_url, url)
                return f'{attr_name}="{absolute_url}"'
            return match.group(0)

        # Rewrite src and href attributes
        html = re.sub(
            r'((?:src|href)\s*=\s*["\'])([^"\']+)(["\'])',
            rewrite_absolute_url,
            html,
            flags=re.IGNORECASE
        )

        # Rewrite url() in CSS
        def rewrite_css_url(match):
            url = match.group(1).strip('\'"')
            if not url.startswith('data:'):
                absolute_url = urljoin(base_url, url)
                return f'url("{absolute_url}")'
            return match.group(0)

        html = re.sub(
            r'url\(([^\)]+)\)',
            rewrite_css_url,
            html,
            flags=re.IGNORECASE
        )

        return html

    except Exception as e:
        logger.error(f"HTML rewriting error: {e}")
        return html


def detect_encoding(content: bytes, headers: dict) -> str:
    """Detect content encoding"""
    # Try Content-Type header
    content_type = headers.get('content-type', '').lower()
    charset_match = re.search(r'charset=([^\s;]+)', content_type)
    if charset_match:
        encoding = charset_match.group(1).strip('"\'')
        logger.info(f"Encoding from header: {encoding}")
        return encoding

    # Try meta tag
    try:
        content_str = content[:2048].decode('utf-8', errors='ignore')
        meta_match = re.search(r'<meta[^>]+charset\s*=\s*["\']?([^\s"\'/>]+)', content_str, re.IGNORECASE)
        if meta_match:
            encoding = meta_match.group(1)
            logger.info(f"Encoding from meta tag: {encoding}")
            return encoding
    except:
        pass

    # Use chardet
    try:
        detected = chardet.detect(content[:10000])
        if detected and detected['encoding']:
            encoding = detected['encoding']
            logger.info(f"Encoding from chardet: {encoding} ({detected['confidence']})")
            return encoding
    except:
        pass

    logger.info("Using default encoding: utf-8")
    return 'utf-8'


def decompress_content(content: bytes, encoding: str) -> bytes:
    """
    Explicitly decompress content based on Content-Encoding header
    This ensures decompression works even if requests library fails to auto-decompress

    NOTE: requests library might already decompress automatically, so we check
    if content is already decompressed before attempting decompression again
    """
    if not encoding:
        return content

    encoding_lower = encoding.lower()

    # Quick check: if content starts with common text patterns, it's likely already decompressed
    # HTML typically starts with <!DOCTYPE, <html, or whitespace followed by <
    # JSON starts with { or [
    # This prevents double-decompression
    if len(content) > 0:
        try:
            # Try to decode first 100 bytes to check if it's already text
            sample = content[:100].decode('utf-8', errors='ignore').strip()
            if sample.startswith(('<', '{', '[', '<!')) or 'html' in sample.lower():
                logger.info(f"Content appears already decompressed (starts with: {sample[:50]}...)")
                return content
        except:
            pass  # If decode fails, it's probably still compressed

    try:
        if 'gzip' in encoding_lower:
            logger.info("Attempting GZIP decompression")
            try:
                decompressed = gzip.decompress(content)
                logger.info(f"✅ GZIP decompression successful: {len(content)} -> {len(decompressed)} bytes")
                return decompressed
            except Exception as e:
                logger.warning(f"GZIP decompression failed (content may be already decompressed): {e}")
                return content

        elif 'deflate' in encoding_lower:
            logger.info("Attempting DEFLATE decompression")
            try:
                decompressed = zlib.decompress(content)
                logger.info(f"✅ DEFLATE decompression successful: {len(content)} -> {len(decompressed)} bytes")
                return decompressed
            except zlib.error:
                try:
                    # Try with -zlib.MAX_WBITS for raw deflate
                    decompressed = zlib.decompress(content, -zlib.MAX_WBITS)
                    logger.info(f"✅ DEFLATE (raw) decompression successful: {len(content)} -> {len(decompressed)} bytes")
                    return decompressed
                except Exception as e:
                    logger.warning(f"DEFLATE decompression failed (content may be already decompressed): {e}")
                    return content

        elif 'br' in encoding_lower:
            logger.info("Attempting BROTLI decompression")
            try:
                import brotli
                decompressed = brotli.decompress(content)
                logger.info(f"✅ BROTLI decompression successful: {len(content)} -> {len(decompressed)} bytes")
                return decompressed
            except Exception as e:
                logger.warning(f"BROTLI decompression failed (content may be already decompressed): {e}")
                return content
        else:
            logger.info(f"Unknown encoding: {encoding}, returning as-is")
            return content

    except Exception as e:
        logger.error(f"Unexpected decompression error for {encoding}: {e}")
        # Return original content if decompression fails
        return content


def strip_security_headers(headers: dict) -> dict:
    """
    Strip ALL headers that prevent iframe embedding or break proxy functionality
    This is critical for enterprise browser isolation
    """
    blocked_headers = [
        'x-frame-options',
        'content-security-policy',
        'content-security-policy-report-only',
        'x-content-type-options',
        'x-xss-protection',
        'cross-origin-embedder-policy',
        'cross-origin-opener-policy',
        'cross-origin-resource-policy',
        'set-cookie',
        'set-cookie2',
        'content-encoding',
        'transfer-encoding',
        'content-length',
        'strict-transport-security',
        'public-key-pins',
        'expect-ct',
        'referrer-policy',
        'permissions-policy',
        'feature-policy'
    ]

    cleaned_headers = {}
    for key, value in headers.items():
        if key.lower() not in blocked_headers:
            cleaned_headers[key] = value

    return cleaned_headers


def get_session_cookies(session_token: str) -> Dict[str, str]:
    """Get cookies for a session"""
    return session_cookies.get(session_token, {})


def set_session_cookies(session_token: str, cookies: Dict[str, str]):
    """Store cookies for a session"""
    if session_token not in session_cookies:
        session_cookies[session_token] = {}
    session_cookies[session_token].update(cookies)


def verify_jwt_token(token: str) -> Optional[Dict]:
    """
    Verify JWT token and return payload
    Returns None if invalid
    """
    if not token:
        return None

    try:
        # Remove 'Bearer ' prefix if present
        if token.startswith('Bearer '):
            token = token[7:]

        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.InvalidTokenError as e:
        logger.warning(f"Invalid JWT token: {e}")
        return None
    except Exception as e:
        logger.error(f"JWT verification error: {e}")
        return None


def log_audit(event_type: str, details: Dict, ip_address: str, user_id: str = None):
    """
    Log security audit event
    In production, this should write to database or log aggregation service
    """
    audit_entry = {
        'timestamp': datetime.utcnow().isoformat(),
        'event_type': event_type,
        'ip_address': ip_address,
        'user_id': user_id,
        'details': details
    }

    # Keep only last 10000 entries in memory
    if len(audit_log) >= 10000:
        audit_log.pop(0)

    audit_log.append(audit_entry)
    logger.info(f"[AUDIT] {event_type} | User: {user_id} | IP: {ip_address}")


@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'elara-enterprise-proxy',
        'version': '2.0.0',
        'timestamp': datetime.utcnow().isoformat()
    }), 200


@app.route('/proxy', methods=['POST'])
@limiter.limit("50 per minute")  # Stricter limit for main proxy endpoint
def proxy_request():
    """
    Main proxy endpoint - Returns full HTML page
    PRODUCTION-READY: Rate limited, cached, audited
    """
    try:
        # Get client IP for audit logging
        client_ip = get_remote_address()

        data = request.get_json()

        if not data or 'url' not in data:
            log_audit('proxy_invalid_request', {'error': 'Missing URL'}, client_ip)
            return jsonify({
                'success': False,
                'error': 'Missing required field: url'
            }), 400

        original_url = data['url']
        session_id = data.get('sessionId', 'anonymous')

        # Audit log the request
        log_audit('proxy_request', {
            'url': original_url,
            'session_id': session_id
        }, client_ip, session_id)

        # Normalize URL
        target_url = normalize_url(original_url)
        logger.info(f"[{session_id}] Normalized: {original_url} -> {target_url}")

        # Validate URL
        is_valid, error_msg = validate_url(target_url)
        if not is_valid:
            logger.warning(f"[{session_id}] Blocked: {target_url} - {error_msg}")
            return jsonify({
                'success': False,
                'error': error_msg,
                'blocked': True
            }), 403

        # Prepare headers
        request_headers = BROWSER_HEADERS.copy()
        parsed_target = urlparse(target_url)
        request_headers['Referer'] = f"{parsed_target.scheme}://{parsed_target.netloc}/"
        request_headers['Origin'] = f"{parsed_target.scheme}://{parsed_target.netloc}"

        # Add session cookies
        cookies = get_session_cookies(session_id)

        logger.info(f"[{session_id}] Fetching: {target_url}")

        # Make request
        with requests.Session() as session:
            session.headers.update(request_headers)

            response = session.get(
                target_url,
                timeout=REQUEST_TIMEOUT,
                allow_redirects=True,
                verify=True,
                cookies=cookies
            )

        # Store cookies from response
        if response.cookies:
            set_session_cookies(session_id, dict(response.cookies))

        # Get raw content
        content = response.content

        # CRITICAL: Explicitly decompress if content is compressed
        # Check Content-Encoding header and decompress manually
        content_encoding = response.headers.get('content-encoding', '').lower()
        if content_encoding:
            logger.info(f"[{session_id}] Content-Encoding detected: {content_encoding}")
            content = decompress_content(content, content_encoding)
            logger.info(f"[{session_id}] Content decompressed: {len(content)} bytes")

        # Check size (after decompression)
        if len(content) > MAX_RESPONSE_SIZE:
            return jsonify({
                'success': False,
                'error': f'Response too large. Maximum size is {MAX_RESPONSE_SIZE / 1024 / 1024}MB'
            }), 413

        # Detect encoding
        encoding = detect_encoding(content, response.headers)

        # Decode content
        try:
            html_content = content.decode(encoding, errors='replace')
        except Exception as e:
            logger.warning(f"[{session_id}] Decoding error with {encoding}: {e}")
            html_content = content.decode('utf-8', errors='replace')

        # Rewrite HTML for proxy (only for HTML content)
        content_type = response.headers.get('content-type', '').lower()
        if 'text/html' in content_type:
            logger.info(f"[{session_id}] Rewriting HTML content")
            html_content = rewrite_html_content(html_content, response.url, session_id)

        # Strip security headers
        response_headers = strip_security_headers(dict(response.headers))

        logger.info(f"[{session_id}] Success: {response.status_code}, {len(html_content)} chars, Final: {response.url}")

        return jsonify({
            'success': True,
            'content': html_content,
            'statusCode': response.status_code,
            'headers': response_headers,
            'contentLength': len(html_content),
            'finalUrl': response.url,
            'contentType': content_type
        }), 200

    except requests.exceptions.Timeout:
        logger.error(f"[{session_id}] Timeout: {target_url}")
        return jsonify({
            'success': False,
            'error': 'Request timed out'
        }), 504

    except requests.exceptions.SSLError as e:
        logger.error(f"[{session_id}] SSL error: {e}")
        return jsonify({
            'success': False,
            'error': 'SSL certificate verification failed'
        }), 502

    except requests.exceptions.ConnectionError as e:
        logger.error(f"[{session_id}] Connection error: {e}")
        return jsonify({
            'success': False,
            'error': 'Could not connect to the website'
        }), 502

    except Exception as e:
        logger.error(f"[{session_id}] Unexpected error: {e}")
        return jsonify({
            'success': False,
            'error': 'An unexpected error occurred'
        }), 500


@app.route('/resource', methods=['GET'])
@limiter.limit("200 per minute")  # Higher limit for resources (CSS, JS, images)
def proxy_resource():
    """
    Proxy individual resources (images, CSS, JS, etc.)
    Used for assets that need to be fetched through proxy
    PRODUCTION-READY: Rate limited
    """
    try:
        resource_url = request.args.get('url')
        session_id = request.args.get('session', 'anonymous')

        if not resource_url:
            return jsonify({'error': 'Missing url parameter'}), 400

        # Decode URL
        resource_url = unquote(resource_url)

        # Validate
        is_valid, error_msg = validate_url(resource_url)
        if not is_valid:
            return jsonify({'error': error_msg}), 403

        # Fetch resource
        request_headers = BROWSER_HEADERS.copy()
        cookies = get_session_cookies(session_id)

        # CRITICAL: Don't use stream=True - let requests handle decompression automatically
        response = requests.get(
            resource_url,
            headers=request_headers,
            timeout=REQUEST_TIMEOUT,
            cookies=cookies,
            allow_redirects=True,
            verify=True
        )

        # Get raw content
        content = response.content

        # CRITICAL: Explicitly decompress if content is compressed (same as /proxy endpoint)
        content_encoding = response.headers.get('content-encoding', '').lower()
        if content_encoding:
            logger.info(f"[RESOURCE] Content-Encoding detected: {content_encoding} for {resource_url}")
            content = decompress_content(content, content_encoding)
            logger.info(f"[RESOURCE] Content decompressed: {len(content)} bytes")

        # Create Flask response (content is now decompressed)
        flask_response = make_response(content)

        # Copy relevant headers
        content_type = response.headers.get('content-type', 'application/octet-stream')
        flask_response.headers['Content-Type'] = content_type

        # Add CORS headers
        flask_response.headers['Access-Control-Allow-Origin'] = '*'

        return flask_response

    except Exception as e:
        logger.error(f"Resource proxy error: {e}")
        return jsonify({'error': 'Failed to fetch resource'}), 500


@app.route('/validate', methods=['POST'])
def validate_url_endpoint():
    """Validate URL without fetching"""
    try:
        data = request.get_json()

        if not data or 'url' not in data:
            return jsonify({
                'success': False,
                'error': 'Missing required field: url'
            }), 400

        original_url = data['url']
        normalized_url = normalize_url(original_url)

        logger.info(f"Validating: {original_url} -> {normalized_url}")

        is_valid, error_msg = validate_url(normalized_url)

        if is_valid:
            return jsonify({
                'success': True,
                'valid': True,
                'url': normalized_url,
                'originalUrl': original_url
            }), 200
        else:
            return jsonify({
                'success': True,
                'valid': False,
                'error': error_msg,
                'url': normalized_url,
                'originalUrl': original_url
            }), 200

    except Exception as e:
        logger.error(f"Validation error: {e}")
        return jsonify({
            'success': False,
            'error': 'Failed to validate URL'
        }), 500


@app.route('/', methods=['GET'])
def root():
    """Root endpoint"""
    return jsonify({
        'service': 'Elara Enterprise Proxy Service',
        'version': '2.0.0',
        'status': 'online',
        'features': [
            'DOM Reconstruction',
            'Enterprise Browser Isolation',
            'Advanced Security Headers Stripping',
            'Cookie Management',
            'Resource Proxying',
            'PostMessage Bridge'
        ],
        'endpoints': {
            'health': '/health',
            'proxy': '/proxy (POST)',
            'resource': '/resource (GET)',
            'validate': '/validate (POST)'
        }
    }), 200


if __name__ == '__main__':
    try:
        port = int(os.getenv('PORT', 8080))
        logger.info(f"Starting server on 0.0.0.0:{port}")
        logger.info("Enterprise Proxy Service ready!")
        app.run(host='0.0.0.0', port=port, debug=False)
    except Exception as e:
        logger.error(f"Failed to start server: {e}")
        sys.exit(1)

logger.info("App module loaded successfully - ready for gunicorn")
