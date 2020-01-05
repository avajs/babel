const {runInNewContext} = require('vm');
const test = require('ava');
const babel = require('@babel/core');
const empower = require('empower-core');
const throwsHelper = require('../throws-helper');
const buildPreset = require('../transform-test-files');

const ESPOWER_PATTERNS = require('../espower-patterns.json');

test('throws-helper is included', t => {
	const {plugins} = buildPreset(babel);
	t.true(plugins.includes(throwsHelper));
});

test('resulting preset transforms assertion patterns', t => {
	const {code} = babel.transform(`
		const value = 'value'

		// "Execute" the patterns. Hardcode them here, otherwise it's cheating.
		t.assert(value)
	`, {
		ast: false,
		babelrc: false,
		filename: __filename,
		presets: [buildPreset]
	});

	const appliedPatterns = [];
	// Create a stub assertion object that can be enhanced using empower-core
	const assert = ESPOWER_PATTERNS
		.map(p => /^t\.(.+)\(/.exec(p)[1]) // eslint-disable-line prefer-named-capture-group
		.reduce((assert, name) => {
			assert[name] = () => {};
			return assert;
		}, {});

	runInNewContext(code, {
		t: empower(assert, {
			onSuccess({matcherSpec: {pattern}, powerAssertContext}) {
				if (powerAssertContext) { // Only available if the empower plugin transformed the assertion
					appliedPatterns.push(pattern);
				}
			},
			patterns: ESPOWER_PATTERNS
		})
	});
	t.deepEqual(appliedPatterns, ESPOWER_PATTERNS);
});

test('the espower plugin can be disabled', t => {
	const expected = 't.assert(value);';
	const {code} = babel.transform(expected, {
		ast: false,
		babelrc: false,
		presets: [[require.resolve('../transform-test-files'), {powerAssert: false}]]
	});
	t.is(code, expected);
});
