'use strict';
'require view';
'require form';
'require uci';
'require rpc';
'require poll';
'require ui';
'require network';

var callStatus = rpc.declare({ object: 'luci.nginx-proxy', method: 'status', expect: {} });
var callApply = rpc.declare({ object: 'luci.nginx-proxy', method: 'apply', expect: {} });

function statusMarkup(running) {
	return '<span id="nginx-proxy-status" style="color:' +
		(running ? 'var(--success-color,#238636)' : 'var(--error-color,#c00)') +
		'">' + (running ? _('Running') : _('Stopped')) + '</span>';
}

function validateDomain(sectionId, value) {
	if (!value || !/^(\*\.)?([A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$/.test(value))
		return _('Enter one valid domain name, optionally beginning with *.');
	return true;
}

return view.extend({
	load: function() {
		return Promise.all([ uci.load('nginx_proxy'), network.getNetworks(), callStatus() ]);
	},

	render: function(data) {
		var networks = data[1];
		var status = data[2];
		var m, s, o;

		m = this.map = new form.Map('nginx_proxy', _('Nginx Proxy'));

		s = m.section(form.NamedSection, 'main', 'global', _('Service'));
		s.anonymous = true;

		o = s.option(form.DummyValue, '_status', _('Status'));
		o.rawhtml = true;
		o.cfgvalue = function() { return statusMarkup(status.running); };

		o = s.option(form.Flag, 'enabled', _('Enabled'));
		o.rmempty = false;

		o = s.option(form.DynamicList, 'management_network', _('LuCI management networks'));
		o.rmempty = false;
		networks.forEach(function(net) {
			if (net.getName() !== 'loopback')
				o.value(net.getName(), net.getName());
		});

		o = s.option(form.Value, 'management_http_port', _('HTTP port'));
		o.datatype = 'port';
		o.default = '80';
		o.rmempty = false;

		o = s.option(form.Flag, 'management_https', _('HTTPS access to LuCI'));
		o.default = '0';

		o = s.option(form.Value, 'management_https_port', _('HTTPS port'));
		o.datatype = 'port';
		o.default = '443';
		o.rmempty = false;

		o = s.option(form.FileUpload, 'management_certificate', _('LuCI certificate (PEM)'));
		o.root_directory = '/etc/luci-uploads';
		o.enable_remove = false;
		o.depends('management_https', '1');

		o = s.option(form.FileUpload, 'management_private_key', _('LuCI private key (KEY/PEM)'));
		o.root_directory = '/etc/luci-uploads';
		o.enable_remove = false;
		o.depends('management_https', '1');

		o = s.option(form.Flag, 'open_firewall', _('Allow HTTP/HTTPS from WAN'));
		o.default = '1';
		o.rmempty = false;

		o = s.option(form.Value, 'firewall_zone', _('WAN firewall zone'));
		o.default = 'wan';
		o.depends('open_firewall', '1');

		s = m.section(form.GridSection, 'reverse_proxy', _('HTTPS reverse proxies'));
		s.addremove = true;
		s.anonymous = true;
		s.nodescriptions = true;

		o = s.option(form.Flag, 'enabled', _('Enabled'));
		o.default = '1';
		o.rmempty = false;

		o = s.option(form.Value, 'domain', _('Domain'));
		o.validate = validateDomain;
		o.rmempty = false;

		o = s.option(form.ListValue, 'scheme', _('Backend protocol'));
		o.value('http', 'HTTP');
		o.value('https', 'HTTPS');
		o.default = 'http';

		o = s.option(form.Value, 'backend', _('Backend address'));
		o.datatype = 'host';
		o.rmempty = false;

		o = s.option(form.Value, 'port', _('Backend port'));
		o.datatype = 'port';
		o.rmempty = false;

		o = s.option(form.FileUpload, 'certificate', _('Certificate (PEM)'));
		o.root_directory = '/etc/luci-uploads';
		o.enable_remove = false;
		o.modalonly = true;
		o.rmempty = false;

		o = s.option(form.FileUpload, 'private_key', _('Private key (KEY/PEM)'));
		o.root_directory = '/etc/luci-uploads';
		o.enable_remove = false;
		o.modalonly = true;
		o.rmempty = false;

		o = s.option(form.Flag, 'verify_tls', _('Verify backend certificate'));
		o.default = '0';
		o.modalonly = true;
		o.depends('scheme', 'https');

		poll.add(function() {
			return callStatus().then(function(result) {
				var node = document.getElementById('nginx-proxy-status');
				if (node) {
					node.textContent = result.running ? _('Running') : _('Stopped');
					node.style.color = result.running
						? 'var(--success-color,#238636)'
						: 'var(--error-color,#c00)';
				}
			});
		});

		return m.render();
	},

	handleSaveApply: function(ev, mode) {
		return this.handleSave(ev).then(function() {
			return uci.apply();
		}).then(function() {
			return callApply();
		}).then(function(result) {
			if (!result.success)
				throw new Error(result.error || _('Unable to apply nginx configuration'));
			ui.addNotification(null, E('p', {}, _('Nginx configuration applied')));
		}).catch(function(err) {
			ui.addNotification(null, E('p', {}, err.message), 'error');
		});
	},

	handleSave: function(ev) {
		return this.map.save(ev);
	},

	handleReset: function(ev) {
		return this.map.reset(ev);
	}
});
