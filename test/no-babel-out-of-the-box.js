const os = require('os');
const path = require('path');
const test = require('ava');
const execa = require('execa');
const makeProvider = require('..');

const withProvider = (t, run) => run(t, makeProvider({
	negotiateProtocol(identifiers) {
		t.true(identifiers.includes('noBabelOutOfTheBox'));
		return {identifier: 'noBabelOutOfTheBox', ava: {version: '2.4.0'}, projectDir: __dirname};
	}
}));

test('negotiates noBabelOutOfTheBox protocol', withProvider, t => t.plan(1));

test('validateConfig: throw when babelConfig is not true or a plain object', withProvider, (t, provider) => {
	t.snapshot(t.throws(() => provider.validateConfig(false)));
	t.snapshot(t.throws(() => provider.validateConfig(null)));
	t.snapshot(t.throws(() => provider.validateConfig([])));
});

test('validateConfig: throw when babelConfig contains keys other than \'compileEnhancements\', \'extensions\' or \'testOptions\'', withProvider, (t, provider) => {
	t.snapshot(t.throws(() => provider.validateConfig({foo: 1})));
});

test('validateConfig: throw when babelConfig.compileEnhancements is not a boolean', withProvider, (t, provider) => {
	t.snapshot(t.throws(() => provider.validateConfig({compileEnhancements: 1})));
});

test('validateConfig: throw when babelConfig.extensions contains empty strings', withProvider, (t, provider) => {
	t.snapshot(t.throws(() => provider.validateConfig({extensions: ['']})));
});

test('validateConfig: throw when babelConfig.extensions contains non-strings', withProvider, (t, provider) => {
	t.snapshot(t.throws(() => provider.validateConfig({extensions: [1]})));
});

test('validateConfig: throw when babelConfig.extensions contains duplicates', withProvider, (t, provider) => {
	t.snapshot(t.throws(() => provider.validateConfig({extensions: ['js', 'js']})));
});

test('validateConfig: throw when babelConfig.testOptions is not a plain object', withProvider, (t, provider) => {
	t.snapshot(t.throws(() => provider.validateConfig({testOptions: null})));
	t.snapshot(t.throws(() => provider.validateConfig({testOptions: []})));
	t.snapshot(t.throws(() => provider.validateConfig({testOptions: true})));
});

test('validateConfig: babelConfig may be true', withProvider, (t, provider) => {
	provider.validateConfig(true);
	t.true(provider.isEnabled());
});

test('validateConfig: babelConfig may be an empty object', withProvider, (t, provider) => {
	provider.validateConfig({});
	t.true(provider.isEnabled());
});

test('getExtensions: defaults to [\'js\']', withProvider, (t, provider) => {
	provider.validateConfig(true);
	t.deepEqual(provider.getExtensions(), ['js']);
});

test('getExtensions: returns an empty array if config was invalid', withProvider, (t, provider) => {
	t.throws(() => provider.validateConfig(false));
	t.deepEqual(provider.getExtensions(), []);
});

test('getExtensions: returns configured extensions', withProvider, (t, provider) => {
	const extensions = ['js'];
	provider.validateConfig({extensions});
	t.deepEqual(provider.getExtensions(), extensions);
});

test('getExtensions: always returns new arrays', withProvider, (t, provider) => {
	provider.validateConfig(true);
	t.not(provider.getExtensions(), provider.getExtensions());
});

const compile = provider => {
	provider.validateConfig(true);

	const cacheDir = os.tmpdir();
	const testFile = path.join(__dirname, 'fixtures/esm-export.js');
	const helperFile = path.join(__dirname, 'fixtures/esm-import.js');

	return {
		cacheDir,
		testFile,
		helperFile,
		state: provider.compile({
			cacheDir,
			testFiles: [testFile],
			helperFiles: [helperFile]
		})
	};
};

test('compile: compiles all files', withProvider, (t, provider) => {
	const {cacheDir, testFile, helperFile, state} = compile(provider);
	t.assert(state[testFile].startsWith(cacheDir));
	t.assert(state[helperFile].startsWith(cacheDir));
});

test('installHook: load compiled files', withProvider, async (t, provider) => {
	const {state} = compile(provider);
	const {stdout} = await execa.node(path.join(__dirname, 'fixtures/install-and-load'), ['noBabelOutOfTheBox', JSON.stringify(state)]);
	t.snapshot(stdout);
});
