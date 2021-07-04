const fs = require('fs');
const test = require('ava');
const proxyquire = require('proxyquire');

const {dependencies} = require('../package.json');

test('plugins are dependencies', t => {
	const set = new Set(Object.keys(dependencies));
	for (const file of fs.readdirSync('./stage-4-plugins')) {
		if (file.endsWith('.json')) {
			for (const plugin of require(`../stage-4-plugins/${file}`)) {
				t.true(set.has(plugin), `${file} plugin ${plugin}`);
			}
		}
	}
});

const buildPreset = (node, v8, options) => proxyquire('../stage-4', {
	'./stage-4-plugins/best-match': proxyquire('../stage-4-plugins/best-match', {
		process: {
			versions: {node, v8}
		}
	})
})(null, options);

function buildsCorrectPreset(t, node, v8, mapping) {
	const {plugins} = buildPreset(node, v8);
	for (const [index, module] of require(mapping).entries()) {
		t.is(require(module).default, plugins[index], `${module} at index ${index}`);
	}
}

buildsCorrectPreset.title = (_, node) => `builds correct preset for Node.js ${node}`;

for (const [node, v8, mapping] of [
	['not-v8-at-all', null, '../stage-4-plugins/v8-6.8.json'],
	['10.18.0', '6.8.275.32-node.54', '../stage-4-plugins/v8-6.8.json']
]) {
	test(buildsCorrectPreset, node, v8, mapping);
}

test('@babel/plugin-transform-modules-commonjs can be disabled', t => {
	const {plugins} = buildPreset('8.9.4', '6.1.534.50', {modules: false});
	t.false(new Set(plugins).has(require('@babel/plugin-transform-modules-commonjs').default));
});

test('@babel/plugin-proposal-dynamic-import can be disabled', t => {
	const {plugins} = buildPreset('8.9.4', '6.1.534.50', {modules: false});
	t.false(new Set(plugins).has(require('@babel/plugin-proposal-dynamic-import').default));
});
