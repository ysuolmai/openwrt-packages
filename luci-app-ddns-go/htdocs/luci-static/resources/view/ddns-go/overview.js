'use strict';
'require view';
'require form';
'require uci';
'require rpc';
'require poll';
'require ui';
'require dom';

var callStatus = rpc.declare({ object: 'luci.ddns-go', method: 'status', expect: {} });
var callGetConfig = rpc.declare({ object: 'luci.ddns-go', method: 'get_config', expect: { config: {} } });
var callSetConfig = rpc.declare({ object: 'luci.ddns-go', method: 'set_config', params: [ 'config' ], expect: {} });
var callSetEnabled = rpc.declare({ object: 'luci.ddns-go', method: 'set_enabled', params: [ 'enabled' ], expect: {} });
var callRun = rpc.declare({ object: 'luci.ddns-go', method: 'run', expect: {} });

var providers = [
	[ 'alidns', 'Aliyun' ], [ 'aliesa', 'Aliyun ESA' ], [ 'tencentcloud', 'Tencent Cloud' ],
	[ 'trafficroute', 'TrafficRoute' ], [ 'dnspod', 'DNSPod' ], [ 'dnsla', 'DNSLA' ],
	[ 'cloudflare', 'Cloudflare' ], [ 'huaweicloud', 'Huawei Cloud' ], [ 'callback', 'Callback' ],
	[ 'baiducloud', 'Baidu Cloud' ], [ 'porkbun', 'Porkbun' ], [ 'godaddy', 'GoDaddy' ],
	[ 'namecheap', 'Namecheap' ], [ 'namesilo', 'NameSilo' ], [ 'vercel', 'Vercel' ],
	[ 'dynadot', 'Dynadot' ], [ 'dynv6', 'Dynv6' ], [ 'spaceship', 'Spaceship' ],
	[ 'nowcn', 'Now.cn' ], [ 'eranet', 'Eranet' ], [ 'tnethk', 'TnetHK' ],
	[ 'gcore', 'Gcore' ], [ 'edgeone', 'EdgeOne' ], [ 'nsone', 'IBM NS1' ],
	[ 'name_com', 'Name.com' ], [ 'rainyun', 'RainYun' ], [ 'hipmdnsmgr', 'HiPM DNS' ],
	[ 'cloudns', 'ClouDNS' ]
];

function emptyAddressConfig(version) {
	return {
		Enable: false,
		GetType: 'url',
		URL: version === 4 ? 'https://myip.ipip.net' : 'https://speed.neu6.edu.cn/getIP.php',
		NetInterface: '',
		Cmd: '',
		Domains: [],
		Ipv6Reg: ''
	};
}

function emptyProvider() {
	return {
		Name: '',
		Ipv4: emptyAddressConfig(4),
		Ipv6: emptyAddressConfig(6),
		DNS: { Name: 'cloudflare', ID: '', Secret: '', ExtParam: '' },
		TTL: '',
		HttpInterface: ''
	};
}

function normalizeConfig(config) {
	config = config || {};
	config.DnsConf = Array.isArray(config.DnsConf) ? config.DnsConf : [];
	config.WebhookURL = config.WebhookURL || '';
	config.WebhookRequestBody = config.WebhookRequestBody || '';
	config.WebhookHeaders = config.WebhookHeaders || '';
	config.NotAllowWanAccess = true;
	config.Username = '';
	config.Password = '';
	config.Lang = config.Lang || 'zh-cn';
	return config;
}

function providerLabel(name) {
	for (var i = 0; i < providers.length; i++)
		if (providers[i][0] === name)
			return providers[i][1];
	return name || '-';
}

function inputRow(label, value, options) {
	options = options || {};
	var control;
	if (options.select) {
		control = E('select', { 'class': 'cbi-input-select' }, options.select.map(function(item) {
			return E('option', { value: item[0], selected: item[0] === value ? '' : null }, item[1]);
		}));
	} else if (options.textarea) {
		control = E('textarea', { 'class': 'cbi-input-textarea', rows: options.rows || 3 }, value || '');
	} else if (options.checkbox) {
		control = E('input', { type: 'checkbox', checked: value ? '' : null });
	} else {
		control = E('input', {
			type: options.password ? 'password' : 'text',
			'class': 'cbi-input-text',
			value: value == null ? '' : value,
			placeholder: options.placeholder || ''
		});
	}
	return { node: E('label', { 'class': 'ddns-field' }, [ E('span', {}, label), control ]), control: control };
}

return view.extend({
	load: function() {
		return Promise.all([ uci.load('ddns-go'), callGetConfig(), callStatus() ]);
	},

	renderStatus: function(status) {
		var self = this;
		var text = status.running ? _('Running') : _('Stopped');
		var state = E('span', { 'class': status.running ? 'ddns-state running' : 'ddns-state stopped' }, text);
		var version = E('span', { 'class': 'ddns-version' }, status.version ? 'v' + status.version : '');
		var toggle = E('input', {
			type: 'checkbox',
			'class': 'cbi-input-checkbox',
			checked: self.serviceEnabled ? '' : null,
			change: function() {
				var requested = toggle.checked;
				toggle.disabled = true;
				return callSetEnabled(requested).then(function(result) {
					if (!result.saved)
						throw new Error(result.error || _('Unable to change service state'));
					self.serviceEnabled = result.enabled;
					self.updateEditorState();
					ui.addNotification(null, E('p', {}, result.enabled ? _('Service enabled') : _('Service disabled')));
					if (result.enabled)
						window.setTimeout(function() { location.reload(); }, 800);
				}).catch(function(err) {
					toggle.checked = self.serviceEnabled;
					ui.addNotification(null, E('p', {}, err.message), 'error');
				}).finally(function() {
					toggle.disabled = false;
					self.refreshStatus();
				});
			}
		});
		var serviceSwitch = E('label', { 'class': 'ddns-service-switch' }, [ toggle, E('span', {}, _('Enabled')) ]);
		var run = E('button', {
			'class': 'cbi-button cbi-button-action',
			disabled: !status.running || status.updating ? '' : null,
			click: function(ev) {
				ev.preventDefault();
				run.disabled = true;
				return callRun().then(function(result) {
					if (!result.started)
						throw new Error(result.error || _('Update failed'));
					ui.addNotification(null, E('p', {}, _('Update started')));
				}).catch(function(err) {
					ui.addNotification(null, E('p', {}, err.message), 'error');
				}).finally(function() { self.refreshStatus(); });
			}
		}, status.updating ? _('Updating...') : _('Update now'));
		this.statusNode = E('div', { 'class': 'ddns-status' }, [ serviceSwitch, state, version, run ]);
		return this.statusNode;
	},

	updateEditorState: function() {
		if (this.engineNode)
			this.engineNode.hidden = !this.serviceEnabled;
	},

	refreshStatus: function() {
		var self = this;
		return callStatus().then(function(status) {
			if (self.statusNode && self.statusNode.parentNode) {
				var previous = self.statusNode;
				previous.parentNode.replaceChild(self.renderStatus(status), previous);
			}
		});
	},

	openProvider: function(index) {
		var self = this;
		var original = index == null ? emptyProvider() : self.config.DnsConf[index];
		var item = JSON.parse(JSON.stringify(original));
		item.Ipv4 = Object.assign(emptyAddressConfig(4), item.Ipv4 || {});
		item.Ipv6 = Object.assign(emptyAddressConfig(6), item.Ipv6 || {});
		item.DNS = Object.assign({ Name: 'cloudflare', ID: '', Secret: '', ExtParam: '' }, item.DNS || {});

		var name = inputRow(_('Name'), item.Name);
		var provider = inputRow(_('Provider'), item.DNS.Name, { select: providers });
		var id = inputRow(_('Account ID'), item.DNS.ID);
		var secret = inputRow(_('Secret'), item.DNS.Secret, { password: true });
		var ext = inputRow(_('Extra parameter'), item.DNS.ExtParam);
		var ttl = inputRow(_('TTL'), item.TTL);
		var httpInterface = inputRow(_('Outbound interface'), item.HttpInterface);

		function addressFields(address, version) {
			var enabled = inputRow(version === 4 ? _('Enable IPv4') : _('Enable IPv6'), address.Enable, { checkbox: true });
			var getType = inputRow(_('Address source'), address.GetType, { select: [ [ 'url', _('URL') ], [ 'netInterface', _('Interface') ], [ 'cmd', _('Command') ] ] });
			var url = inputRow(_('URL'), address.URL);
			var iface = inputRow(_('Interface'), address.NetInterface);
			var cmd = inputRow(_('Command'), address.Cmd);
			var regex = version === 6 ? inputRow(_('IPv6 regular expression'), address.Ipv6Reg) : null;
			var domains = inputRow(_('Domains'), (address.Domains || []).join('\n'), { textarea: true, rows: 4 });
			return {
				node: E('div', { 'class': 'ddns-address' }, [ E('h4', {}, version === 4 ? 'IPv4' : 'IPv6'), enabled.node, getType.node, url.node, iface.node, cmd.node, regex ? regex.node : '', domains.node ]),
				read: function() {
					return {
						Enable: enabled.control.checked,
						GetType: getType.control.value,
						URL: url.control.value.trim(),
						NetInterface: iface.control.value.trim(),
						Cmd: cmd.control.value.trim(),
						Ipv6Reg: regex ? regex.control.value.trim() : '',
						Domains: domains.control.value.split(/\r?\n/).map(function(v) { return v.trim(); }).filter(Boolean)
					};
				}
			};
		}

		var ipv4 = addressFields(item.Ipv4, 4);
		var ipv6 = addressFields(item.Ipv6, 6);
		ui.showModal(index == null ? _('Add provider') : _('Edit provider'), [
			E('div', { 'class': 'ddns-grid' }, [ name.node, provider.node, id.node, secret.node, ext.node, ttl.node, httpInterface.node ]),
			E('div', { 'class': 'ddns-ip-grid' }, [ ipv4.node, ipv6.node ]),
			E('div', { 'class': 'right' }, [
				E('button', { 'class': 'cbi-button', click: ui.hideModal }, _('Cancel')), ' ',
				E('button', { 'class': 'cbi-button cbi-button-positive', click: function() {
					item.Name = name.control.value.trim();
					item.DNS = { Name: provider.control.value, ID: id.control.value.trim(), Secret: secret.control.value, ExtParam: ext.control.value.trim() };
					item.TTL = ttl.control.value.trim();
					item.HttpInterface = httpInterface.control.value.trim();
					item.Ipv4 = ipv4.read();
					item.Ipv6 = ipv6.read();
					if (index == null)
						self.config.DnsConf.push(item);
					else
						self.config.DnsConf[index] = item;
					ui.hideModal();
					self.renderProviders();
				} }, _('Save'))
			])
		]);
	},

	renderProviders: function() {
		var self = this;
		var rows = self.config.DnsConf.map(function(item, index) {
			var domains = [].concat(item.Ipv4 && item.Ipv4.Domains || [], item.Ipv6 && item.Ipv6.Domains || []);
			return E('tr', {}, [
				E('td', {}, item.Name || '-'),
				E('td', {}, providerLabel(item.DNS && item.DNS.Name)),
				E('td', {}, domains.join(', ') || '-'),
				E('td', { 'class': 'cbi-section-actions' }, [
					E('button', { 'class': 'cbi-button cbi-button-edit', click: function(ev) { ev.preventDefault(); self.openProvider(index); } }, _('Edit')), ' ',
					E('button', { 'class': 'cbi-button cbi-button-negative', click: function(ev) { ev.preventDefault(); self.config.DnsConf.splice(index, 1); self.renderProviders(); } }, _('Delete'))
				])
			]);
		});
		if (!rows.length)
			rows.push(E('tr', {}, E('td', { colspan: 4, 'class': 'center' }, _('No providers configured'))));
		var table = E('table', { 'class': 'table' }, [ E('tr', { 'class': 'tr table-titles' }, [ E('th', {}, _('Name')), E('th', {}, _('Provider')), E('th', {}, _('Domains')), E('th', {}) ]) ].concat(rows));
		dom.content(self.providersNode, table);
	},

	saveEngineConfig: function(button) {
		var self = this;
		button.disabled = true;
		self.config.WebhookURL = self.webhookURL.value.trim();
		self.config.WebhookRequestBody = self.webhookBody.value;
		self.config.WebhookHeaders = self.webhookHeaders.value;
		return callSetConfig(self.config).then(function(result) {
			if (!result.saved)
				throw new Error(result.error || _('Save failed'));
			ui.addNotification(null, E('p', {}, _('Configuration saved')));
		}).catch(function(err) {
			ui.addNotification(null, E('p', {}, err.message), 'error');
		}).finally(function() { button.disabled = false; });
	},

	render: function(data) {
		var self = this;
		self.serviceEnabled = uci.get('ddns-go', 'main', 'enabled') === '1';
		self.config = normalizeConfig(data[1]);
		var m = new form.Map('ddns-go', _('DDNS-GO'));
		var s = m.section(form.NamedSection, 'main', 'service', _('Service'));
		s.anonymous = true;
		var o = s.option(form.Value, 'interval', _('Update interval'));
		o.datatype = 'range(30,86400)';
		o.default = '300';
		o = s.option(form.Value, 'cache_times', _('Cache comparisons'));
		o.datatype = 'range(1,100)';
		o.default = '5';
		o = s.option(form.Flag, 'skip_verify', _('Skip certificate verification'));
		o = s.option(form.Value, 'dns', _('DNS server'));
		o.datatype = 'ipaddr';
		o.rmempty = true;
		o = s.option(form.Button, '_save', _('Service settings'));
		o.inputstyle = 'apply';
		o.inputtitle = _('Save service settings');
		o.onclick = function() {
			return this.map.save(null, true).then(function() {
				return ui.changes.apply(true);
			}).then(function() {
				return callSetEnabled(self.serviceEnabled);
			});
		};

		self.providersNode = E('div');
		self.webhookURL = E('input', { 'class': 'cbi-input-text', value: self.config.WebhookURL });
		self.webhookBody = E('textarea', { 'class': 'cbi-input-textarea', rows: 4 }, self.config.WebhookRequestBody);
		self.webhookHeaders = E('textarea', { 'class': 'cbi-input-textarea', rows: 3 }, self.config.WebhookHeaders);
		var save = E('button', { 'class': 'cbi-button cbi-button-positive', click: function(ev) { ev.preventDefault(); self.saveEngineConfig(save); } }, _('Save provider configuration'));

		poll.add(function() { return self.refreshStatus(); }, 5);
		return m.render().then(function(mapNode) {
			self.engineNode = E('div', {}, [
				E('div', { 'class': 'cbi-section' }, [
					E('h3', {}, _('DNS providers')),
					self.providersNode,
					E('div', { 'class': 'ddns-actions' }, E('button', { 'class': 'cbi-button cbi-button-add', click: function(ev) { ev.preventDefault(); self.openProvider(null); } }, _('Add provider')))
				]),
				E('div', { 'class': 'cbi-section ddns-webhook' }, [
					E('h3', {}, _('Webhook')),
					E('label', { 'class': 'ddns-field' }, [ E('span', {}, _('URL')), self.webhookURL ]),
					E('label', { 'class': 'ddns-field' }, [ E('span', {}, _('Request body')), self.webhookBody ]),
					E('label', { 'class': 'ddns-field' }, [ E('span', {}, _('Headers')), self.webhookHeaders ]),
					E('div', { 'class': 'ddns-actions' }, save)
				])
			]);
			var root = E('div', {}, [
				E('style', {}, '.ddns-status{display:flex;align-items:center;gap:12px;margin:0 0 16px}.ddns-service-switch{display:inline-flex;align-items:center;gap:7px;font-weight:600}.ddns-service-switch input{margin:0}.ddns-state{font-weight:600}.ddns-state.running{color:#16803a}.ddns-state.stopped{color:#b42318}.ddns-version{color:#667085}.ddns-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.ddns-ip-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px;margin-top:18px}.ddns-field{display:flex;flex-direction:column;gap:5px;min-width:0}.ddns-field input,.ddns-field select,.ddns-field textarea{width:100%;box-sizing:border-box}.ddns-address h4{margin:0 0 10px}.ddns-address{display:grid;gap:10px}.ddns-webhook{display:grid;gap:12px}.ddns-actions{margin-top:14px;text-align:right}@media(max-width:700px){.ddns-grid,.ddns-ip-grid{grid-template-columns:1fr}.ddns-status{flex-wrap:wrap}.table{display:block;overflow-x:auto}}'),
				self.renderStatus(data[2]),
				mapNode,
				self.engineNode
			]);
			self.renderProviders();
			self.updateEditorState();
			return root;
		});
	}
});
