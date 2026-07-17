'use strict';
'require view';
'require rpc';
'require poll';

var callLogs = rpc.declare({
	object: 'luci.moontvplus',
	method: 'logs',
	params: [ 'limit' ],
	expect: { logs: '' }
});

return view.extend({
	load: function() {
		return callLogs(300);
	},

	render: function(result) {
		var output = E('textarea', {
			'class': 'cbi-input-textarea',
			style: 'width:100%;min-height:32rem;font-family:monospace',
			readonly: ''
		}, result.logs || _('No log entries.'));

		poll.add(function() {
			return callLogs(300).then(function(data) {
				output.value = data.logs || _('No log entries.');
				output.scrollTop = output.scrollHeight;
			});
		});

		return E('div', { 'class': 'cbi-map' }, [
			E('h2', {}, _('MoonTVPlus log')),
			E('div', { 'class': 'cbi-section' }, output)
		]);
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
