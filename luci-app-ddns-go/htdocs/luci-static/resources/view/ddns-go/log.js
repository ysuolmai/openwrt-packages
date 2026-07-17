'use strict';
'require view';
'require rpc';
'require poll';
'require dom';

var callLogs = rpc.declare({
	object: 'luci.ddns-go',
	method: 'logs',
	params: [ 'limit' ],
	expect: { logs: '' }
});

return view.extend({
	load: function() {
		return callLogs(300);
	},

	update: function() {
		var self = this;
		return callLogs(300).then(function(logs) {
			dom.content(self.output, logs || _('No log entries'));
			self.output.scrollTop = self.output.scrollHeight;
		});
	},

	render: function(logs) {
		var self = this;
		self.output = E('pre', { 'class': 'ddns-log' }, logs || _('No log entries'));
		poll.add(function() { return self.update(); }, 5);
		return E('div', {}, [
			E('style', {}, '.ddns-log{box-sizing:border-box;width:100%;height:min(70vh,720px);overflow:auto;margin:0;padding:12px;border:1px solid var(--border-color-medium,#ccc);background:var(--background-color-lowest,#fff);font:12px/1.5 monospace;white-space:pre-wrap;word-break:break-word}'),
			E('h2', {}, _('DDNS-GO Log')),
			self.output
		]);
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
