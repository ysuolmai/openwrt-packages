#!/usr/bin/env python3
"""Run actual shell helpers against temporary UCI/network stubs; no CA requests."""
import json
import os
from pathlib import Path
import shlex
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]


def config_stub(config):
    values = '\n'.join(f'{s}_{k}={shlex.quote(str(v))}' for s, opts in config.items() for k, v in opts.items())
    return values + '''
config_load() { :; }
config_get() { eval "local value=\\${${2}_${3}-}"; [ -n "$value" ] || value="${4-}"; export "$1=$value"; }
config_get_bool() { config_get "$@"; }
config_foreach() { [ "$2" != reverse_proxy ] || "$1" site; }
config_list_foreach() {
    echo '        allow 192.168.1.0/24;' >> "$ALLOW"
    echo '192.168.1.1' >> "$NAMES"
}
network_flush_cache() { :; }
'''


def run_generator(directory, **opts):
    config = {'main': {'management_http_port': 80}, 'site': {
        'domain': 'app.example.org', 'backend': '192.168.1.2', 'port': 3000,
        'certificate_source': 'acme', **opts}}
    if 'http_port' in opts:
        config['main']['management_http_port'] = opts.pop('http_port')
    script = (ROOT / 'root/usr/libexec/nginx-proxy-generate').read_text()
    script = script.replace('. /lib/functions.sh', config_stub(config)).replace('. /lib/functions/network.sh', '')
    script = script.replace('/etc/ssl/acme/', str(directory / 'certs') + '/')
    # Keep the production validation whitelist, just map its ACME alternative to the fixture path.
    script = script.replace('|etc/ssl|', '|' + str(directory / 'certs').lstrip('/') + '|')
    output = directory / 'nginx.conf'
    result = subprocess.run(['sh', '-s', '--', str(output)], input=script, text=True, capture_output=True)
    return result, output.read_text() if output.exists() else ''


def check_nginx(directory, text, pending):
    image = os.environ.get('NGINX_TEST_IMAGE')
    if not image:
        return
    config = directory / 'nginx-integration.conf'
    config.write_text(text)
    challenge = directory / 'challenge/.well-known/acme-challenge'
    challenge.mkdir(parents=True, exist_ok=True)
    (challenge / 'test-token').write_text('acme-proof')
    args = ['docker', 'run', '--rm', '--network', 'none',
            '-v', f'{directory}:{directory}:ro',
            '-v', f'{directory / "challenge"}:/var/run/acme/challenge:ro', image]
    subprocess.run(args + ['nginx', '-t', '-c', str(config)], check=True)
    container = subprocess.check_output(args[:2] + ['-d'] + args[2:] +
        ['nginx', '-c', str(config), '-g', 'daemon off;'], text=True).strip()
    try:
        command = ['docker', 'exec', container, 'wget', '-qO-',
                   '--header=Host: app.example.org',
                   'http://127.0.0.1/.well-known/acme-challenge/test-token']
        assert subprocess.check_output(command, text=True) == 'acme-proof'
        if pending:
            # Pending certificates must never proxy application traffic over HTTP.
            result = subprocess.run(['docker', 'exec', container, 'wget', '-SO-',
                '--header=Host: app.example.org', 'http://127.0.0.1/'], capture_output=True, text=True)
            assert '503' in result.stderr
    finally:
        subprocess.run(['docker', 'rm', '-f', container], check=True, stdout=subprocess.DEVNULL)


def test_generator(directory):
    result, text = run_generator(directory)
    assert result.returncode == 0, result.stderr
    assert 'location ^~ /.well-known/acme-challenge/' in text
    assert 'try_files $uri =404;' in text
    assert 'location / { return 503; }' in text
    assert 'ssl_certificate ' not in text and 'proxy_pass http://192.168.1.2' not in text

    check_nginx(directory, text, pending=True)

    certs = directory / 'certs'
    certs.mkdir()
    subprocess.run(['openssl', 'req', '-x509', '-newkey', 'rsa:2048', '-nodes',
        '-subj', '/CN=app.example.org', '-days', '1',
        '-out', str(certs / 'app.example.org.fullchain.crt'),
        '-keyout', str(certs / 'app.example.org.key')],
        check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    result, text = run_generator(directory)
    assert result.returncode == 0, result.stderr
    assert 'listen 443 ssl;' in text and 'proxy_pass http://192.168.1.2:3000;' in text
    assert 'location / { return 308 https://$host:443$request_uri; }' in text
    assert 'location / { return 503; }' not in text
    check_nginx(directory, text, pending=False)
    result, text = run_generator(directory, domain='APP.EXAMPLE.ORG')
    assert result.returncode == 0 and 'listen 443 ssl;' in text

    result, _ = run_generator(directory, domain='*.example.org')
    assert result.returncode != 0 and 'wildcard' in result.stderr
    result, _ = run_generator(directory, http_port=8081)
    assert result.returncode != 0 and 'port 80' in result.stderr
    result, _ = run_generator(directory, domain='x;bad.example.org')
    assert result.returncode != 0 and 'invalid domain' in result.stderr
    result, _ = run_generator(directory, certificate_source='manual')
    assert result.returncode != 0 and 'certificate is missing' in result.stderr
    # Existing uploaded/path-based certificates continue to work without ACME.
    result, text = run_generator(directory, certificate_source='manual',
        certificate=str(certs / 'app.example.org.fullchain.crt'), private_key=str(certs / 'app.example.org.key'))
    assert result.returncode == 0, result.stderr
    assert 'proxy_pass http://192.168.1.2:3000;' in text


def test_sync(directory):
    db = directory / 'uci.json'
    initial = {'other': 'cert', 'other.enabled': '1', 'nginx_proxy_old': 'cert',
               'nginx_proxy_old.enabled': '1', 'global': 'acme'}
    uci = directory / 'uci'
    uci.write_text('''#!/usr/bin/env python3
import json, os, sys
p=os.environ['TEST_UCI_DB']
d=json.load(open(p)); args=[a for a in sys.argv[1:] if a != '-q']; cmd=args[0]
if cmd == 'show':
 for k,v in d.items(): print('acme.'+k+'='+v)
elif cmd == 'delete':
 k=args[1].removeprefix('acme.'); d={a:b for a,b in d.items() if a != k and not a.startswith(k+'.')}
elif cmd in ['set','add_list']:
 k,v=args[1].removeprefix('acme.').split('=',1); d[k]=v
elif cmd != 'commit': raise Exception(args)
json.dump(d,open(p,'w'))
''')
    uci.chmod(0o755)
    env = dict(os.environ, PATH=str(directory) + ':' + os.environ['PATH'], TEST_UCI_DB=str(db))
    config = {'main': {'enabled': 1, 'acme_email': 'owner@example.org'},
              'site': {'certificate_source': 'acme', 'domain': 'app.example.org'}}

    def run(config, mode=None):
        script = (ROOT / 'root/usr/libexec/nginx-proxy-acme').read_text()
        script = script.replace('. /lib/functions.sh', config_stub(config))
        script = script.replace('[ -x /etc/init.d/acme ]', 'true')
        script = script.replace('mkdir -p /var/run/acme/challenge', ':')
        for service in ['acme', 'cron']:
            script = script.replace('/etc/init.d/' + service, 'true')
        return subprocess.run(['sh', '-s', '--', 'sync'] + ([mode] if mode else []), input=script, env=env, text=True, capture_output=True)

    db.write_text(json.dumps(initial))
    result = run(config)
    assert result.returncode == 0, result.stderr
    data = json.loads(db.read_text())
    assert data['other.enabled'] == '1' and 'nginx_proxy_old' not in data
    assert data['nginx_proxy_site.domains'] == 'app.example.org'
    assert data['nginx_proxy_site.validation_method'] == 'webroot'
    assert data['global.account_email'] == 'owner@example.org'

    before = db.read_text()
    config['site']['domain'] = '*.example.org'
    result = run(config)
    assert result.returncode != 0 and db.read_text() == before
    config['site']['domain'] = 'app.example.org'
    config['main']['acme_email'] = "bad'email"
    result = run(config)
    assert result.returncode != 0 and db.read_text() == before
    # Uninstall explicitly disables owned jobs even when the UCI enabled flag is still 1.
    result = run(config, 'disable')
    assert result.returncode == 0, result.stderr
    data = json.loads(db.read_text())
    assert data['other.enabled'] == '1' and 'nginx_proxy_site' not in data


if __name__ == '__main__':
    with tempfile.TemporaryDirectory(prefix='nginx-acme-test-') as temp:
        directory = Path(temp)
        test_generator(directory)
        test_sync(directory)
    print('ACME bootstrap, certificate routing, validation, manual compatibility and UCI ownership checks passed.')
