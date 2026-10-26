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
    values = '\n'.join(
        f'{s}_{k}=' + ' '.join(shlex.quote(str(item)) for item in v)
        if isinstance(v, list) else f'{s}_{k}={shlex.quote(str(v))}'
        for s, opts in config.items() for k, v in opts.items())
    return values + '''
config_load() { :; }
config_get() { eval "local value=\\${${2}_${3}-}"; [ -n "$value" ] || value="${4-}"; export "$1=$value"; }
config_get_bool() { config_get "$@"; }
config_foreach() { [ "$2" != reverse_proxy ] || "$1" site; }
config_list_foreach() {
    local key="$1_$2" value item
    eval "value=\\${$key-}"
    for item in $value; do "$3" "$item"; done
}
network_get_subnets() {
    [ "$2" != lan ] || eval "$1=192.168.1.0/24"
    [ "$2" = lan ] || eval "$1="
}
network_get_subnets6() { eval "$1="; }
network_get_ipaddrs() {
    [ "$2" != lan ] || eval "$1=192.168.1.1"
    [ "$2" = lan ] || eval "$1="
}
network_get_ipaddrs6() { eval "$1="; }
network_get_device() { eval "$1=$2"; }
network_flush_cache() { :; }
'''


def run_generator(directory, management_network=None, **opts):
    main = {'management_http_port': 80}
    if management_network is None:
        main['management_network'] = ['lan']
    else:
        main['management_network'] = management_network
    config = {'main': main, 'site': {
        'domain': 'app.example.org', 'backend': '192.168.1.2', 'port': 3000,
        'certificate_source': 'acme', **opts}}
    if config['site']['certificate_source'] is None:
        del config['site']['certificate_source']
    if 'http_port' in opts:
        config['main']['management_http_port'] = opts.pop('http_port')
    script = (ROOT / 'root/usr/libexec/nginx-proxy-generate').read_text()
    script = script.replace('. /lib/functions.sh', config_stub(config)).replace('. /lib/functions/network.sh', '')
    ipcalc = directory / 'ipcalc.sh'
    ipcalc.write_text('''#!/bin/sh
case "$1" in
    192.168.193.151/24) echo NETWORK=192.168.193.0; echo PREFIX=24 ;;
    192.168.1.0/24) echo NETWORK=192.168.1.0; echo PREFIX=24 ;;
    *) exit 1 ;;
esac
''')
    ipcalc.chmod(0o755)
    script = script.replace('/bin/ipcalc.sh', shlex.quote(str(ipcalc)))
    ip = directory / 'ip'
    ip.write_text('''#!/bin/sh
[ "$*" = "-o -4 addr show dev zt scope global" ] && echo "23: zt inet 192.168.193.151/24 brd 192.168.193.255 scope global zt"
''')
    ip.chmod(0o755)
    script = script.replace('/etc/ssl/acme/', str(directory / 'certs') + '/')
    script = script.replace('/etc/nginx-proxy/certs/', str(directory / 'uploads') + '/')
    script = script.replace('(etc/nginx-proxy|', '(' + str(directory / 'uploads').lstrip('/') + '|')
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

    result, text = run_generator(directory, management_network=['zt'])
    assert result.returncode == 0, result.stderr
    assert 'allow 192.168.193.0/24;' in text
    assert 'server_name 192.168.193.151' in text

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
    # An old configuration has neither certificate_source nor acme_email.
    result, text = run_generator(directory, certificate_source=None, http_port=8081,
        certificate=str(certs / 'app.example.org.fullchain.crt'), private_key=str(certs / 'app.example.org.key'))
    assert result.returncode == 0, result.stderr
    assert 'listen 8081;' in text and 'listen 443 ssl;' in text
    uploads = directory / 'uploads'
    uploads.mkdir()
    (uploads / 'site_old.cert.pem').symlink_to(certs / 'app.example.org.fullchain.crt')
    (uploads / 'site_old.key').symlink_to(certs / 'app.example.org.key')
    result, text = run_generator(directory, certificate_source=None, cert_id='site_old')
    assert result.returncode == 0, result.stderr
    assert str(uploads / 'site_old.cert.pem') in text

    # ACME uses the previous manual certificate until its first issuance succeeds.
    result, text = run_generator(directory, domain='fallback.example.org', cert_id='site_old')
    assert result.returncode == 0, result.stderr
    assert str(uploads / 'site_old.cert.pem') in text
    assert 'listen 443 ssl;' in text and 'location / { return 503; }' not in text


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
    # Legacy manual sites need no new settings, email, or port-80 restriction.
    result = run({'main': {'enabled': 1, 'management_http_port': 8081}, 'site': {'domain': 'app.example.org'}})
    assert result.returncode == 0, result.stderr
    data = json.loads(db.read_text())
    assert data['other.enabled'] == '1' and 'global.account_email' not in data
    assert not any(key.startswith('nginx_proxy_') for key in data)
    # Missing emails get a usable domain-derived default, including old config files.
    result = run({'main': {'enabled': 1}, 'site': {'certificate_source': 'acme', 'domain': 'app.example.org'}})
    assert result.returncode == 0, result.stderr
    data = json.loads(db.read_text())
    assert data['global.account_email'] == 'admin@app.example.org'
    assert data['nginx_proxy_site.account_email'] == 'admin@app.example.org'
    result = run({'main': {'enabled': 1}, 'site': {'certificate_source': 'acme',
        'domain': 'app.example.org', 'acme_email': 'custom@example.org'}})
    assert result.returncode == 0, result.stderr
    assert json.loads(db.read_text())['nginx_proxy_site.account_email'] == 'custom@example.org'
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


def test_selected_renew(directory):
    proxy = {'main': {'enabled': 1},
        'site': {'certificate_source': 'acme', 'domain': 'app.example.org'},
        'second': {'certificate_source': 'acme', 'domain': 'other.example.org'}}
    helper = (ROOT / 'root/usr/libexec/nginx-proxy-acme').read_text()
    helper = helper.replace('. /lib/functions.sh', config_stub(proxy))
    helper = helper.replace('/var/run/nginx-proxy-acme', str(directory / 'request'))
    helper = helper.replace('/etc/ssl/acme/', str(directory / 'certs') + '/')
    (directory / 'request-site.log').write_text('selected site log')
    (directory / 'request-second.log').write_text('other site log')
    result = subprocess.run(['sh', '-s', '--', 'status', 'site'], input=helper, text=True, capture_output=True)
    assert result.returncode == 0, result.stderr
    assert 'selected site log' in result.stdout and 'other site log' not in result.stdout
    for section in ['missing', 'site;id', '../site', 'x' * 65]:
        result = subprocess.run(['sh', '-s', '--', 'status', section], input=helper, text=True, capture_output=True)
        assert result.returncode != 0

    # Optional real acme-common init script exercises the supported native API.
    native_path = os.environ.get('ACME_TEST_INIT')
    if native_path:
        native = Path(native_path).read_text().replace('"$IPKG_INSTROOT/usr/lib/acme/functions.sh"', '/dev/null')
    else:
        native = """run_dir=/unused
CHALLENGE_DIR=/unused
extra_command renew 'Renew certificates'
load_globals() { config_get account_email "$1" account_email; export account_email; }
get_cert() { config_get main_domain "$1" domains; export main_domain; "$HOOK" get; }
cleanup() { :; }
"""
    hook = directory / 'acme-hook'
    hook.write_text('#!/bin/sh\nprintf "%s:%s\\n" "$main_domain" "$account_email"\n')
    hook.chmod(0o755)
    native = native.replace('HOOK=/usr/lib/acme/hook', 'HOOK=' + shlex.quote(str(hook)))
    native += '\nrun_dir=' + shlex.quote(str(directory / 'native-run'))
    native += '\nCHALLENGE_DIR="$run_dir/challenge"\nHOOK=' + shlex.quote(str(hook)) + '\n'
    wrapper = directory / 'acme-init'
    wrapper.write_text(native)
    helper = helper.split('case "$1" in\n\tsync)', 1)[0]
    helper = helper.replace('. /etc/init.d/acme', '. ' + shlex.quote(str(wrapper)))
    helper += """
log() { :; }
config_load() {
    [ "$1" != acme ] || {
        globals_account_email=shared@example.org
        nginx_proxy_site_account_email=admin@app.example.org
        nginx_proxy_site_domains=app.example.org
        nginx_proxy_site_enabled=1
        nginx_proxy_site_validation_method=webroot
    }
}
config_foreach() {
    case "$2" in
        acme) "$1" globals ;;
        reverse_proxy) "$1" site; "$1" second ;;
        cert) "$1" nginx_proxy_site; "$1" unrelated ;;
    esac
}
select_site site
renew_site
"""
    result = subprocess.run(['sh', '-s'], input=helper, text=True, capture_output=True)
    assert result.returncode == 0, result.stderr
    assert result.stdout.strip() == 'app.example.org:admin@app.example.org', result.stdout


def test_package_lifecycle(directory):
    makefile = (ROOT / 'Makefile').read_text()
    calls = directory / 'package-calls'
    apply = directory / 'apply'
    apply.write_text('#!/bin/sh\necho "$1" >> ' + shlex.quote(str(calls)) + '\n')
    apply.chmod(0o755)

    def run(kind, **environment):
        script = makefile.split('define Package/luci-app-nginx/' + kind + '\n', 1)[1].split('\nendef', 1)[0]
        script = script.replace('$$', '$').replace('/usr/libexec/nginx-proxy-apply', str(apply))
        script = script.replace('$(uci -q get nginx_proxy.main.enabled)', '$TEST_ENABLED')
        calls.write_text('')
        env = dict(os.environ, IPKG_INSTROOT='', PKG_UPGRADE='', TEST_ENABLED='1')
        env.update(environment)
        result = subprocess.run(['sh', '-s'], input=script, text=True, env=env, capture_output=True)
        assert result.returncode == 0, result.stderr
        return calls.read_text().splitlines()

    assert run('prerm', PKG_UPGRADE='1') == []
    assert run('prerm') == ['disable']
    assert run('prerm', IPKG_INSTROOT='/offline') == []
    # Includes upgrades FROM old versions whose prerm already restored uhttpd.
    assert run('postinst', PKG_UPGRADE='1') == ['apply']
    assert run('postinst', TEST_ENABLED='0') == []
    assert run('postinst', IPKG_INSTROOT='/offline') == []


if __name__ == '__main__':
    with tempfile.TemporaryDirectory(prefix='nginx-acme-test-') as temp:
        directory = Path(temp)
        os.environ['PATH'] = str(directory) + ':' + os.environ['PATH']
        test_generator(directory)
        test_sync(directory)
        test_package_lifecycle(directory)
        test_selected_renew(directory)
    print('ACME bootstrap, certificate routing, validation, manual compatibility and UCI ownership checks passed.')
