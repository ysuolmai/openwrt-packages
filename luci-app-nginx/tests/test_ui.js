'use strict';
// Exercise the domain editor's save/request flow without a LuCI installation.
const fs = require('fs');
const assert = require('assert');
const calls = [];
const values = { main: {}, site: { domain: 'app.example.org' } };
let statusText = '';
const statusNode = {
	getAttribute: name => name === 'data-nginx-acme-section' ? 'site' : null,
	set textContent(value) { statusText = value; }
};
const document = {
	querySelectorAll: selector => {
		assert.equal(selector, '[data-nginx-acme-section]');
		return [statusNode];
	}
};
const uci = {
	get: (config, section, option) => values[section]?.[option],
	apply: async () => { calls.push('apply-uci'); }
};
class Map {
	constructor() { this.children = []; }
	section(type, name) {
		const section = { map: this, children: [], parse: async () => { calls.push('parse-global'); } };
		section.option = (type, name) => {
			const option = { option: name, map: this, value() {}, depends() {} };
			section.children.push(option);
			return option;
		};
		this.children.push(section);
		return section;
	}
	lookupOption(name) { return this.children.flatMap(s => s.children).filter(o => o.option === name); }
	async load() { calls.push('load-parent'); }
	async reset() { calls.push('reset-parent'); }
	async render() {}
}
const rpc = { declare: spec => async section => {
	calls.push([spec.method, section]);
	return spec.method === 'acme_status'
		? { output: 'app.example.org: check running' }
		: { success: true };
} };
const form = { Map };
const ui = { addNotification() {} };
const L = { bind: (fn, ctx, ...args) => fn.bind(ctx, ...args) };
const code = fs.readFileSync(require('path').join(__dirname, '../htdocs/luci-static/resources/view/nginx/overview.js'), 'utf8');
const page = new Function('view', 'form', 'uci', 'rpc', 'poll', 'ui', 'network', 'L', 'E', '_', 'document', code)(
	{ extend: object => object }, form, uci, rpc, { add() {} }, ui, {}, L, () => ({}), s => s, document);

(async () => {
	await page.render([null, [], { running: true }]);
	const email = page.map.lookupOption('acme_email')[0];
	assert.equal(email.cfgvalue('site'), 'admin@app.example.org');
	values.main.acme_email = 'legacy@example.org';
	assert.equal(email.cfgvalue('site'), 'legacy@example.org');
	values.site.acme_email = 'custom@example.org';
	assert.equal(email.cfgvalue('site'), 'custom@example.org');
	let emailValue = '';
	const widget = { getValue: () => emailValue, setValue: value => { emailValue = value; } };
	email.getUIElement = () => widget;
	const domain = page.map.lookupOption('domain')[0];
	domain.onchange.call(domain, {}, 'site', 'NEW.EXAMPLE.ORG');
	assert.equal(emailValue, 'admin@new.example.org');
	domain.onchange.call(domain, {}, 'site', 'changed.example.org');
	assert.equal(emailValue, 'admin@changed.example.org');
	emailValue = 'custom@example.org';
	domain.onchange.call(domain, {}, 'site', 'different.example.org');
	assert.equal(emailValue, 'custom@example.org');
	const button = page.map.lookupOption('_acme_start')[0];
	const modalMap = {
		parent: page.map,
		section: 'site',
		save: async () => { calls.push('save-modal'); }
	};
	calls.length = 0;
	await button.onclick.call({ map: modalMap }, {}, 'site');
	assert.deepEqual(calls, ['save-modal', 'load-parent', 'reset-parent',
		'apply-uci', ['apply', undefined], ['acme_start', 'site'], ['acme_status', 'site']]);
	assert.equal(statusText, 'app.example.org: check running');
	calls.length = 0;
	modalMap.save = async () => { throw new Error('invalid domain'); };
	await button.onclick.call({ map: modalMap }, {}, 'site');
	assert(!calls.some(call => Array.isArray(call) && call[0] === 'acme_start'));
	console.log('Domain editor email defaults, modal save order and scoped requests passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
