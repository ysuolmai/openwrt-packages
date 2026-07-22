'use strict';
'require dom';
'require poll';
'require rpc';
'require ui';
'require view';

const callStatus = rpc.declare({object: 'luci.frp', method: 'core_status', expect: {'': {}}});
const callUpdateStart = rpc.declare({object: 'luci.frp', method: 'update_start', params: ['force'], expect: {'': {}}});
const callUpdateStatus = rpc.declare({object: 'luci.frp', method: 'update_status', expect: {'': {}}});

return view.extend({
	load: () => Promise.all([callStatus(), callUpdateStatus()]),
	render: function(data) {
		const version = E('strong');
		const state = E('span', {style: 'margin-left:.75rem'});
		const log = E('pre', {style: 'max-height:18rem;overflow:auto;white-space:pre-wrap'});
		const button = E('button', {class: 'btn cbi-button cbi-button-positive', type: 'button'});
		const renderStatus = s => dom.content(version, s.installed ? ('frpc ' + s.frpc + ' / frps ' + s.frps) : _('Core is not installed'));
		const renderUpdate = s => {
			button.disabled = !!s.running;
			dom.content(button, s.running ? _('Downloading...') : _('Download / update core'));
			dom.content(state, s.running ? _('Download in progress') : (s.result === 'success' ? _('Latest update succeeded') : (s.result === 'failed' ? _('Latest update failed') : '')));
			state.style.color = s.result === 'failed' ? 'red' : (s.result === 'success' ? 'green' : 'gray');
			dom.content(log, s.log || _('No download has been run yet.'));
		};
		button.addEventListener('click', ui.createHandlerFn(this, () => callUpdateStart(false).then(r => {
			if (!r.result && !r.running) throw new Error(_('Unable to start core download'));
			return callUpdateStatus().then(renderUpdate);
		}).catch(e => ui.addNotification(null, E('p', {}, e.message), 'error'))));
		renderStatus(data[0] || {}); renderUpdate(data[1] || {});
		poll.add(() => Promise.all([callStatus(), callUpdateStatus()]).then(r => { renderStatus(r[0]); renderUpdate(r[1]); }));
		return E('div', {class: 'cbi-map'}, [
			E('h2', {}, _('FRP core')),
			E('div', {class: 'cbi-section'}, [
				E('p', {}, [_('Installed version') + ': ', version]),
				E('p', {}, [button, state]),
				E('details', {}, [E('summary', {}, _('Download log')), log])
			])
		]);
	}
});
