'use strict';
'require view';
'require form';
'require uci';
'require rpc';
'require poll';
'require ui';
'require network';

var callStatus = rpc.declare({ object: 'luci.nginx-proxy', method: 'status', expect: {} });
var callAcmeStatus = rpc.declare({ object: 'luci.nginx-proxy', method: 'acme_status', params: [ 'section' ], expect: {} });
var callAcmeStart = rpc.declare({ object: 'luci.nginx-proxy', method: 'acme_start', params: [ 'section' ], expect: {} });
var callApply = rpc.declare({ object: 'luci.nginx-proxy', method: 'apply', expect: {} });
var callUpload = rpc.declare({
	object: 'luci.nginx-proxy',
	method: 'upload',
	params: [ 'section', 'kind' ],
	expect: {}
});

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

function uploadTlsFile(kind, ev, sectionId) {
	var label = kind === 'pem' ? 'PEM' : 'KEY';
	var storageId = 'main';
	if (sectionId !== 'main') {
		storageId = uci.get('nginx_proxy', sectionId, 'cert_id');
		if (!storageId) {
			storageId = 'site_' + Date.now().toString(36) +
				Math.random().toString(36).substring(2, 10);
			uci.set('nginx_proxy', sectionId, 'cert_id', storageId);
		}
	}
	return ui.uploadFile('/tmp/nginx-proxy-upload', ev.target).then(function() {
		return callUpload(storageId, kind);
	}).then(function(result) {
		if (!result.success)
			throw new Error(result.error || _('Upload failed'));
		ui.addNotification(null, E('p', {}, _('%s uploaded').format(label)));
	}).catch(function(err) {
		ui.addNotification(null, E('p', {}, err.message), 'error');
	});
}

return view.extend({
	load: function() {
		return Promise.all([ uci.load('nginx_proxy'), network.getNetworks(), callStatus() ]);
	},

	render: function(data) {
		var networks = data[1];
		var status = data[2];
		var m, s, o;
		var page = this;

		function setDefaultEmail(map, sectionId, domain) {
			var option = map.lookupOption('acme_email', sectionId)[0];
			var widget = option && option.getUIElement(sectionId);
			if (!widget || !domain || domain.indexOf('*') >= 0) return;
			var oldDomain = uci.get('nginx_proxy', sectionId, 'domain');
			var value = widget.getValue();
			if (!value || value === widget.nginxDefaultEmail ||
				(oldDomain && value === 'admin@' + oldDomain.toLowerCase())) {
				widget.nginxDefaultEmail = 'admin@' + domain.toLowerCase();
				widget.setValue(widget.nginxDefaultEmail);
			}
		}

		function refreshAcmeStatus(sectionId) {
			return callAcmeStatus(sectionId).then(function(result) {
				var text = result.output || result.error || _('Awaiting certificate');
				Array.from(document.querySelectorAll('[data-nginx-acme-section]'))
					.filter(function(node) { return node.getAttribute('data-nginx-acme-section') === sectionId; })
					.forEach(function(node) { node.textContent = text; });
			});
		}

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

		o = s.option(form.Button, '_management_pem', 'PEM');
		o.inputstyle = 'action';
		o.inputtitle = _('Upload PEM');
		o.onclick = L.bind(uploadTlsFile, null, 'pem');
		o.depends('management_https', '1');

		o = s.option(form.Button, '_management_key', 'KEY');
		o.inputstyle = 'action';
		o.inputtitle = _('Upload KEY');
		o.onclick = L.bind(uploadTlsFile, null, 'key');
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
		o.onchange = function(ev, sectionId, value) { setDefaultEmail(this.map, sectionId, value); };
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

		o = s.option(form.ListValue, 'certificate_source', _('Certificate source'));
		o.onchange = function(ev, sectionId) {
			var domain = this.map.lookupOption('domain', sectionId)[0].formvalue(sectionId);
			setDefaultEmail(this.map, sectionId, domain);
		};
		o.value('manual', _('Manual upload'));
		o.value('acme', _('Let’s Encrypt (HTTP-01)'));
		o.default = 'manual';
		o.rmempty = false;

		o = s.option(form.Value, 'acme_email', _('ACME account email'));
		o.modalonly = true;
		o.depends('certificate_source', 'acme');
		o.cfgvalue = function(sectionId) {
			var domain = uci.get('nginx_proxy', sectionId, 'domain');
			return uci.get('nginx_proxy', sectionId, 'acme_email') ||
				uci.get('nginx_proxy', 'main', 'acme_email') || (domain ? 'admin@' + domain.toLowerCase() : '');
		};
		o.description = _('Defaults to admin@your-domain. HTTP-01 requires public TCP port 80 and a domain pointing to this router. Wildcards are not supported.');

		o = s.option(form.Button, '_acme_start', _('Let’s Encrypt'));
		o.modalonly = true;
		o.depends('certificate_source', 'acme');
		o.inputtitle = _('Request / check certificate');
		o.inputstyle = 'action';
		o.onclick = function(ev, sectionId) {
			var modalMap = this.map;
			var parentMap = modalMap.parent || page.map;
			ui.addNotification(null, E('p', {}, _('Saving domain settings and starting the certificate check…')));
			return modalMap.save(null, true).then(function() {
				return parentMap.load().then(L.bind(parentMap.reset, parentMap));
			}).then(function() {
				return page.applyConfig();
			}).then(function(applied) {
				if (!applied) return;
				return callAcmeStart(sectionId).then(function(result) {
					if (!result.success) throw new Error(result.error);
					ui.addNotification(null, E('p', {}, _('Certificate check started for this domain. Renewal runs daily.')));
					return refreshAcmeStatus(sectionId);
				});
			}).catch(function(err) {
				ui.addNotification(null, E('p', {}, err.message), 'error');
			});
		};

		o = s.option(form.DummyValue, '_acme_status', _('Certificate status / recent log'));
		o.modalonly = true;
		o.depends('certificate_source', 'acme');
		o.renderWidget = function(sectionId) {
			return E('pre', { 'data-nginx-acme-section': sectionId, style: 'white-space:pre-wrap;overflow-wrap:anywhere' },
				_('Awaiting certificate'));
		};

		o = s.option(form.Button, '_pem', 'PEM');
		o.inputstyle = 'action';
		o.inputtitle = _('Upload PEM');
		o.onclick = L.bind(uploadTlsFile, null, 'pem');
		o.modalonly = true;
		o.depends('certificate_source', 'manual');

		o = s.option(form.Button, '_key', 'KEY');
		o.inputstyle = 'action';
		o.inputtitle = _('Upload KEY');
		o.onclick = L.bind(uploadTlsFile, null, 'key');
		o.modalonly = true;
		o.depends('certificate_source', 'manual');

		o = s.option(form.Flag, 'verify_tls', _('Verify backend certificate'));
		o.default = '0';
		o.modalonly = true;
		o.depends('scheme', 'https');

		poll.add(function() {
			return Promise.all(Array.from(document.querySelectorAll('[data-nginx-acme-section]')).map(function(node) {
				var sectionId = node.getAttribute('data-nginx-acme-section');
				return refreshAcmeStatus(sectionId);
			}));
		}, 10);

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
		return this.handleSave(ev).then(L.bind(this.applyConfig, this));
	},

	applyConfig: function() {
		return uci.apply().catch(function(err) {
			if (err === 5 || (err && (err.code === 5 || /ubus code 5/.test(err.message || ''))))
				return;
			throw err;
		}).then(function() {
			return callApply();
		}).then(function(result) {
			if (!result.success)
				throw new Error(result.error || _('Unable to apply nginx configuration'));
			ui.addNotification(null, E('p', {}, _('Nginx configuration applied')));
			return true;
		}).catch(function(err) {
			ui.addNotification(null, E('p', {}, err.message), 'error');
			return false;
		});
	},

	handleSave: function(ev) {
		return this.map.save(ev);
	},

	handleReset: function(ev) {
		return this.map.reset(ev);
	}
});
