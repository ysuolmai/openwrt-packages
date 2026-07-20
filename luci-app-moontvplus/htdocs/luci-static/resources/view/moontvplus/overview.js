'use strict';
'require view';
'require form';
'require rpc';
'require poll';
'require ui';

var callStatus = rpc.declare({
	object: 'luci.moontvplus',
	method: 'status',
	expect: {}
});

var callControl = rpc.declare({
	object: 'luci.moontvplus',
	method: 'control',
	params: [ 'action' ],
	expect: {}
});

var callCoreUpdateStart = rpc.declare({
	object: 'luci.moontvplus',
	method: 'core_update_start',
	params: [ 'component', 'force' ],
	expect: {}
});

var callCoreUpdateStatus = rpc.declare({
	object: 'luci.moontvplus',
	method: 'core_update_status',
	expect: {}
});

function statusText(status) {
	if (status.running)
		return E('span', { style: 'color:#16a34a;font-weight:600' }, _('Running'));
	return E('span', { style: 'color:#dc2626;font-weight:600' }, _('Stopped'));
}

function coreStatusText(status) {
	if (status.core_installed)
		return E('span', { style: 'color:#16a34a;font-weight:600' },
			status.core_version || _('Installed'));
	return E('span', { style: 'color:#dc2626;font-weight:600' }, _('Not installed'));
}

function fontStatusText(status) {
	return status.font_installed ? _('Installed') : _('Not installed');
}

return view.extend({
	load: function() {
		return callStatus();
	},

	render: function(status) {
		var m, s, o;
		var statusNode = E('span', {}, statusText(status));
		var coreNode = E('span', {}, coreStatusText(status));
		var fontNode = E('span', {}, fontStatusText(status));
		var updateLog = E('pre', {
			style: 'display:none;max-height:16em;overflow:auto;white-space:pre-wrap;margin-top:1em'
		});

		m = new form.Map('moontvplus', _('MoonTVPlus'),
			_('Run MoonTVPlus directly under procd without Docker. Apply changes before restarting the service.'));

		s = m.section(form.NamedSection, '_status');
		s.anonymous = true;
		s.render = function() {
			poll.add(function() {
				return Promise.all([ callStatus(), callCoreUpdateStatus() ]).then(function(results) {
					var current = results[0];
					var update = results[1];
					statusNode.replaceChildren(statusText(current));
					coreNode.replaceChildren(coreStatusText(current));
					fontNode.replaceChildren(fontStatusText(current));
					if (update.log) {
						updateLog.style.display = '';
						updateLog.textContent = update.log;
					}
				});
			});

			function controlButton(action, label, css) {
				return E('button', {
					'class': 'cbi-button ' + css,
					click: function(ev) {
						ev.preventDefault();
						ev.currentTarget.disabled = true;
						return callControl(action).then(function(result) {
							if (!result.success)
								throw new Error(result.error || _('Service action failed'));
							ui.addNotification(null, E('p', {}, _('Service action completed')));
							return callStatus();
						}).then(function(result) {
							statusNode.replaceChildren(statusText(result));
						}).catch(function(err) {
							ui.addNotification(null, E('p', {}, err.message), 'error');
						}).finally(function() {
							ev.currentTarget.disabled = false;
						});
					}
				}, label);
			}

			var open = E('button', {
				'class': 'cbi-button cbi-button-action',
				click: function(ev) {
					ev.preventDefault();
					var port = Number(document.querySelector('[data-widget-id="cbid.moontvplus.main.port"] input')?.value) || status.port || 3000;
					window.open(window.location.protocol + '//' + window.location.hostname + ':' + port + '/', '_blank', 'noopener');
				}
			}, _('Open MoonTVPlus'));

			function updateButton(component, label) {
				return E('button', {
					'class': 'cbi-button cbi-button-action',
					click: function(ev) {
						ev.preventDefault();
						ev.currentTarget.disabled = true;
						return callCoreUpdateStart(component, false).then(function(result) {
							if (!result.success)
								throw new Error(result.error || _('Unable to start the download'));
							ui.addNotification(null, E('p', {}, _('Download started')));
						}).catch(function(err) {
							ui.addNotification(null, E('p', {}, err.message), 'error');
						}).finally(function() {
							ev.currentTarget.disabled = false;
						});
					}
				}, label);
			}

			return E('div', { 'class': 'cbi-section' }, [
				E('p', {}, [ _('Service status') + ': ', statusNode ]),
				E('div', {}, [
					controlButton('start', _('Start'), 'cbi-button-positive'), ' ',
					controlButton('restart', _('Restart'), 'cbi-button-reload'), ' ',
					controlButton('stop', _('Stop'), 'cbi-button-negative'), ' ',
					open
				]),
				E('hr'),
				E('p', {}, [ _('Application core') + ': ', coreNode ]),
				E('p', {}, [ _('Optional subtitle font') + ': ', fontNode ]),
				E('div', {}, [
					updateButton('core', status.core_installed ? _('Update core') : _('Download core')), ' ',
					updateButton('font', status.font_installed ? _('Update subtitle font') : _('Download subtitle font'))
				]),
				updateLog
			]);
		};

		s = m.section(form.NamedSection, 'main', 'moontvplus', _('Basic settings'));
		s.addremove = false;

		o = s.option(form.Flag, 'enabled', _('Enable service'));
		o.default = '0';
		o.rmempty = false;

		o = s.option(form.Value, 'port', _('Listen port'));
		o.datatype = 'port';
		o.default = '3000';
		o.rmempty = false;

		o = s.option(form.Value, 'site_name', _('Site name'));
		o.default = 'MoonTVPlus';
		o.rmempty = false;

		o = s.option(form.Value, 'username', _('Administrator username'));
		o.default = 'admin';
		o.rmempty = false;

		o = s.option(form.Value, 'password', _('Administrator password'));
		o.password = true;
		o.default = 'admin';
		o.rmempty = false;
		o.description = _('The service refuses to start while this password is empty.');

		o = s.option(form.Flag, 'respawn', _('Restart after a crash'));
		o.default = '1';
		o.rmempty = false;

		s = m.section(form.NamedSection, 'main', 'moontvplus', _('Application core'));
		s.addremove = false;

		o = s.option(form.Value, 'core_dir', _('Core directory'));
		o.default = '/mnt/moontvplus/core';
		o.rmempty = false;
		o.description = _('Use persistent external storage when router flash space is limited.');

		o = s.option(form.Value, 'release_repo', _('Core release repository'));
		o.default = 'ysuolmai/openwrt-packages';
		o.rmempty = false;
		o.description = _('Save and apply repository or directory changes before downloading.');

		o = s.option(form.Value, 'release_tag', _('Core release tag'));
		o.default = 'moontvplus-core';
		o.rmempty = false;

		s = m.section(form.NamedSection, 'main', 'moontvplus', _('Storage'));
		s.addremove = false;

		o = s.option(form.ListValue, 'storage_type', _('Storage backend'));
		o.value('d1', _('Local SQLite'));
		o.value('redis', 'Redis');
		o.value('kvrocks', 'Kvrocks');
		o.value('upstash', 'Upstash Redis');
		o.default = 'd1';
		o.rmempty = false;

		o = s.option(form.Value, 'data_dir', _('Data directory'));
		o.default = '/etc/moontvplus';
		o.rmempty = false;
		o.description = _('Use persistent external storage on devices with limited flash endurance.');

		o = s.option(form.Value, 'redis_url', _('Redis URL'));
		o.depends('storage_type', 'redis');
		o.placeholder = 'redis://127.0.0.1:6379';

		o = s.option(form.Value, 'kvrocks_url', _('Kvrocks URL'));
		o.depends('storage_type', 'kvrocks');
		o.placeholder = 'redis://127.0.0.1:6666';

		o = s.option(form.Value, 'upstash_url', _('Upstash URL'));
		o.depends('storage_type', 'upstash');
		o.datatype = 'url';

		o = s.option(form.Value, 'upstash_token', _('Upstash token'));
		o.depends('storage_type', 'upstash');
		o.password = true;

		s = m.section(form.NamedSection, 'main', 'moontvplus', _('Features'));
		s.addremove = false;

		o = s.option(form.Flag, 'enable_tv_mode', _('Enable TV mode'));
		o.default = '1';
		o.rmempty = false;

		o = s.option(form.Flag, 'enable_offline_download', _('Enable server downloads'));
		o.default = '0';
		o.rmempty = false;

		o = s.option(form.Value, 'download_dir', _('Download directory'));
		o.default = '/mnt/moontvplus/downloads';
		o.depends('enable_offline_download', '1');
		o.rmempty = false;

		o = s.option(form.Flag, 'watch_room_enabled', _('Enable watch room'));
		o.default = '0';
		o.rmempty = false;

		o = s.option(form.ListValue, 'watch_room_server_type', _('Watch room server'));
		o.value('internal', _('Internal'));
		o.value('external', _('External'));
	o.default = 'internal';
	o.depends('watch_room_enabled', '1');

	o = s.option(form.Value, 'watch_room_external_url', _('External watch room URL'));
	o.datatype = 'url';
	o.placeholder = 'wss://example.com';
	o.depends({ watch_room_enabled: '1', watch_room_server_type: 'external' });

	o = s.option(form.Value, 'watch_room_external_auth', _('External watch room token'));
	o.password = true;
	o.depends({ watch_room_enabled: '1', watch_room_server_type: 'external' });

	o = s.option(form.Value, 'cron_password', _('Cron API password'));
		o.password = true;
		o.description = _('Leave empty to use the MoonTVPlus default.');

		return m.render();
	}
});
