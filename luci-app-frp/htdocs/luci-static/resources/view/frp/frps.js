'use strict';
'require view';
'require dom';
'require form';
'require rpc';
'require uci';
'require tools.widgets as widgets';
'require view.frp.core as coreView';
'require view.frp.save as saveGuard';

//	[Widget, Option, Title, Description, {Param: 'Value'}],
const startupConf = [
	[form.Flag, 'stdout', _('Log stdout')],
	[form.Flag, 'stderr', _('Log stderr')],
	[widgets.UserSelect, 'user', _('Run daemon as user')],
	[widgets.GroupSelect, 'group', _('Run daemon as group')],
	[form.Flag, 'respawn', _('Respawn when crashed')],
	[form.DynamicList, 'env', _('Environment variable'), _('OS environments pass to frp for config file template, see %s'.format(`<a href="https://github.com/fatedier/frp#configuration-file-template">frp README</a>`)), {placeholder: 'ENV_NAME=value'}],
	[form.DynamicList, 'conf_inc', _('Additional configs'), _('TOML fragments appended to the generated configuration'), {placeholder: '/etc/frp/frps.d/custom.toml'}]
];

const commonConf = [
	[form.Value, 'bind_addr', _('Bind address'), _('BindAddr specifies the address that the server binds to.<br />By default, this value is "0.0.0.0".'), {datatype: 'ipaddr'}],
	[form.Value, 'bind_port', _('Bind port'), _('BindPort specifies the port that the server listens on.<br />By default, this value is 7000.'), {datatype: 'port'}],
	[form.Value, 'kcp_bind_port', _('KCP bind port'), _('BindKcpPort specifies the KCP port that the server listens on. If this value is 0, the server will not listen for KCP connections.<br />By default, this value is 0.'), {datatype: 'port'}],
	[form.Value, 'quic_bind_port', _('QUIC bind port'), _('BindQuicPort specifies the QUIC port that the server listens on. If this value is 0, the server will not listen for QUIC connections.<br />By default, this value is 0.'), {datatype: 'port'}],
	[form.Value, 'proxy_bind_addr', _('Proxy bind address'), _('ProxyBindAddr specifies the address that the proxy binds to. This value may be the same as BindAddr.<br />By default, this value is "0.0.0.0".'), {datatype: 'ipaddr'}],
	[form.Value, 'vhost_http_port', _('Vhost HTTP port'), _('VhostHttpPort specifies the port that the server listens for HTTP Vhost requests. If this value is 0, the server will not listen for HTTP requests.<br />By default, this value is 0.'), {datatype: 'port'}],
	[form.Value, 'vhost_https_port', _('Vhost HTTPS port'), _('VhostHttpsPort specifies the port that the server listens for HTTPS Vhost requests. If this value is 0, the server will not listen for HTTPS requests.<br />By default, this value is 0.'), {datatype: 'port'}],
	[form.Value, 'vhost_http_timeout', _('Vhost HTTP timeout'), _('VhostHttpTimeout specifies the response header timeout for the Vhost HTTP server, in seconds.<br />By default, this value is 60.'), {datatype: 'uinteger'}],
	[form.Value, 'dashboard_addr', _('Dashboard address'), _('DashboardAddr specifies the address that the dashboard binds to.<br />By default, this value is "0.0.0.0".'), {datatype: 'ipaddr'}],
	[form.Value, 'dashboard_port', _('Dashboard port'), _('DashboardPort specifies the port that the dashboard listens on. If this value is 0, the dashboard will not be started.<br />By default, this value is 0.'), {datatype: 'port'}],
	[form.Value, 'dashboard_user', _('Dashboard user'), _('DashboardUser specifies the username that the dashboard will use for login.<br />By default, this value is "admin".')],
	[form.Value, 'dashboard_pwd', _('Dashboard password'), _('DashboardPwd specifies the password that the dashboard will use for login.<br />By default, this value is "admin".'), {password: true}],
	[form.Flag, 'dashboard_tls_mode', _('Dashboard TLS mode'), _('Enable or disable TLS encryption for the dashboard. When enabled, HTTPS is used for secure communication.'), {datatype: 'bool'}],
	[form.Value, 'dashboard_tls_cert_file', _('Dashboard TLS certificate'), _('Dashboard TLS Cert File specifies the path to the TLS certificate file for enabling HTTPS access.<br />Required if HTTPS is enabled.'), {datatype: 'filepath'}],
    [form.Value, 'dashboard_tls_key_file', _('Dashboard TLS private key'), _('Dashboard TLS Key File specifies the path to the TLS private key file for enabling HTTPS access.<br />Required if HTTPS is enabled.'), {datatype: 'filepath'}],
	[form.Value, 'assets_dir', _('Assets dir'), _('AssetsDir specifies the local directory that the dashboard will load resources from. If this value is "", assets will be loaded from the bundled executable using statik.<br />By default, this value is "".')],
	[form.Value, 'log_file', _('Log file'), _('LogFile specifies a file where logs will be written to. This value will only be used if LogWay is set appropriately.<br />By default, this value is "console".')],
	[form.ListValue, 'log_level', _('Log level'), _('LogLevel specifies the minimum log level. Valid values are "trace", "debug", "info", "warn", and "error".<br />By default, this value is "info".'), {values: ['trace', 'debug', 'info', 'warn', 'error']}],
	[form.Value, 'log_max_days', _('Log max days'), _('LogMaxDays specifies the maximum number of days to store log information before deletion. This is only used if LogWay == "file".<br />By default, this value is 0.'), {datatype: 'uinteger'}],
	[form.Flag, 'disable_log_color', _('Disable log color'), _('DisableLogColor disables log colors when LogWay == "console" when set to true.<br />By default, this value is false.'), {datatype: 'bool', default: 'true'}],
	[form.Value, 'token', _('Token'), _('Token specifies the authorization token used to authenticate keys received from clients. Clients must have a matching token to be authorized to use the server.<br />By default, this value is "".')],
	[form.Value, 'subdomain_host', _('Subdomain host'), _('SubDomainHost specifies the domain that will be attached to sub-domains requested by the client when using Vhost proxying. For example, if this value is set to "frps.com" and the client requested the subdomain "test", the resulting URL would be "test.frps.com".<br />By default, this value is "".')],
	[form.Flag, 'tcp_mux', _('TCP mux'), _('TcpMux toggles TCP stream multiplexing. This allows multiple requests from a client to share a single TCP connection.<br />By default, this value is true.'), {datatype: 'bool', default: 'true'}],
	[form.Value, 'custom_404_page', _('Custom 404 page'), _('Custom404Page specifies a path to a custom 404 page to display. If this value is "", a default page will be displayed.<br />By default, this value is "".')],
	[form.Value, 'allow_ports', _('Allow ports'), _('AllowPorts specifies a set of ports that clients are able to proxy to. If the length of this value is 0, all ports are allowed.<br />By default, this value is an empty set.')],
	[form.Value, 'max_ports_per_client', _('Max ports per client'), _('MaxPortsPerClient specifies the maximum number of ports a single client may proxy to. If this value is 0, no limit will be applied.<br />By default, this value is 0.'), {datatype: 'uinteger'}],
	[form.Value, 'heartbeat_timeout', _('Heartbeat timeout'), _('HeartBeatTimeout specifies the maximum time to wait for a heartbeat before terminating the connection. It is not recommended to change this value.<br />By default, this value is 90.'), {datatype: 'uinteger'}],
	[form.DynamicList, '_', _('Additional settings'), _('This list can be used to append TOML settings which are not included in this LuCI.'), {placeholder: 'key = "value"'}]
];

function setParams(o, params) {
	if (!params) return;
	for (let key in params) {
		let val = params[key];
		if (key === 'values') {
			for (let v of val) {
				let args = v;
				if (!Array.isArray(args))
					args = [args];
				o.value.apply(o, args);
			}
		} else if (key === 'depends') {
			if (!Array.isArray(val))
				val = [val];
			for (let v of val) {
				let args = v;
				if (!Array.isArray(args))
					args = [args];
				o.depends.apply(o, args);
			}
		} else {
			o[key] = params[key];
		}
	}
	if (params['datatype'] === 'bool') {
		o.enabled = 'true';
		o.disabled = 'false';
	}
}

function defTabOpts(s, t, opts, params) {
	for (let opt of opts) {
		const o = s.taboption(t, opt[0], opt[1], opt[2], opt[3]);
		setParams(o, opt[4]);
		setParams(o, params);
	}
}

function defOpts(s, opts, params) {
	for (let opt of opts) {
		const o = s.option(opt[0], opt[1], opt[2], opt[3]);
		setParams(o, opt[4]);
		setParams(o, params);
	}
}

const callServiceList = rpc.declare({
	object: 'service',
	method: 'list',
	params: ['name'],
	expect: { '': {} }
});

function getServiceStatus() {
		return L.resolveDefault(callServiceList('frps'), {}).then(function (res) {
		const instances = res.frps && res.frps.instances;
		return Object.keys(instances || {}).some(function (name) {
			return instances[name].running === true;
		});
	});
}

function dashboardUrl() {
	const port = uci.get('frps', 'common', 'dashboard_port');
	if (!port || port === '0')
		return null;

	const tls = String(uci.get('frps', 'common', 'dashboard_tls_mode') || '').toLowerCase();
	const scheme = ['1', 'true', 'on', 'yes'].includes(tls) ? 'https' : 'http';
	const bind = uci.get('frps', 'common', 'dashboard_addr');
	let host = (!bind || bind === '0.0.0.0' || bind === '::') ? window.location.hostname : bind;

	if (host.includes(':') && host[0] !== '[')
		host = `[${host}]`;

	return `${scheme}://${host}:${port}/`;
}

function renderStatus(isRunning) {
	const status = E('em', {}, E('span', { style: `color:${isRunning ? 'green' : 'red'}` },
		E('strong', {}, [_('frp Server'), ' ', isRunning ? _('RUNNING') : _('NOT RUNNING')])));
	const url = isRunning && dashboardUrl();

	if (!url)
		return status;

	return [status, ' ', E('a', {
		class: 'btn cbi-button cbi-button-action',
		href: url,
		target: '_blank',
		rel: 'noopener noreferrer'
	}, _('Open Dashboard'))];
}

return view.extend({
	render() {
		let m, s, o, ss;

		m = new form.Map('frps', _('frp Server'));
		saveGuard.guard(m);

		s = m.section(form.NamedSection, '_status');
		s.anonymous = true;
		s.render = function (section_id) {
			L.Poll.add(function () {
				return L.resolveDefault(getServiceStatus()).then(function(res) {
					const target = document.getElementById('service_status');
					if (target) dom.content(target, renderStatus(res));
				});
			});

			return E('div', { class: 'cbi-map' },
				E('fieldset', { class: 'cbi-section'}, [
					E('p', { id: 'service_status' }, _('Collecting data ...'))
				])
			);
		}

		s = m.section(form.NamedSection, 'common', 'conf');
		s.dynamic = true;

		s.tab('common', _('Common settings'));
		s.tab('init', _('Startup settings'));

		o = s.taboption('common', form.Flag, 'enabled', _('Enabled'));
		o.default = '0';
		o.rmempty = false;
		o.cfgvalue = function (section_id) {
			const value = this.super('cfgvalue', arguments);
			const init = uci.sections('frps', 'init')[0];
			return value ?? init?.enabled ?? '0';
		};

		defTabOpts(s, 'common', commonConf, {optional: true});

		o = s.taboption('init', form.SectionValue, 'init', form.TypedSection, 'init', _('Startup settings'));
		s = o.subsection;
		s.anonymous = true;
		s.dynamic = true;

		defOpts(s, startupConf);

		return Promise.all([m.render(), coreView.load().then(function(data) { return coreView.render(data); })]).then(function(parts) {
			return E('div', {}, [ parts[1], parts[0] ]);
		});
	}
});
