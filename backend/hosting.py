"""Explicit host/origin settings for a same-origin hosted demo."""
import os
import re
from urllib.parse import urlsplit


def hosting_settings():
    hosts = ['localhost', '127.0.0.1', '[::1]', 'testserver']
    configured = os.getenv('SMARTMAINT_ALLOWED_HOSTS', '').split(',')
    render_host = os.getenv('RENDER_EXTERNAL_HOSTNAME', '').strip()
    for host in [*configured, render_host]:
        host = host.strip().lower()
        if not host:
            continue
        if not re.fullmatch(r'[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?', host):
            raise ValueError('SMARTMAINT_ALLOWED_HOSTS requires exact hostnames, without URL, port or wildcard.')
        if host not in hosts:
            hosts.append(host)
    origin = os.getenv('SMARTMAINT_PUBLIC_ORIGIN', '').strip().rstrip('/')
    if not origin and render_host:
        origin = 'https://' + render_host.lower()
    if origin:
        parsed = urlsplit(origin)
        if (parsed.scheme != 'https' or not parsed.hostname or parsed.path or parsed.query
                or parsed.fragment or parsed.username or parsed.password or parsed.hostname not in hosts):
            raise ValueError('SMARTMAINT_PUBLIC_ORIGIN requires an HTTPS origin with an explicitly allowed hostname.')
    return hosts, origin
