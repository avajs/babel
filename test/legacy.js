const os = require('os');
const path = require('path');
const test = require('ava');
const execa = require('execa');
const makeProvider = require('..');

const withProvider = (t, run) => run(t, makeProvider({
	negotiateProtocol(identifiers) {
		t.true(identifiers.includes('legacy'));
		return {identifier: 'legacy', ava: {version: '2.4.0'}, projectDir: __dirname};
	}
}));

test('negotiates legacy protocol', withProvider, t => t.plan(1));

test('validateConfig: ignore when babelConf and enhancementsOnly are false', withProvider, (t, provider) => {
	provider.validateConfig({babelConfig: false, compileEnhancements: false, enhancementsOnly: false});
	t.false(provider.isEnabled());
});

test('validateConfig: ignore when compileEnhancements is false, but enhancementsOnly is true', withProvider, (t, provider) => {
	provider.validateConfig({compileEnhancements: false, enhancementsOnly: true});
	t.false(provider.isEnabled());
});

test('validateConfig: throw when babelConfig is not false, undefined or a plain object', withProvider, (t, provider) => {
	t.snapshot(t.throws(() => provider.validateConfig({babelConfig: true, compileEnhancements: true, enhancementsOnly: false})));
	t.snapshot(t.throws(() => provider.validateConfig({babelConfig: null, compileEnhancements: true, enhancementsOnly: false})));
	t.snapshot(t.throws(() => provider.validateConfig({babelConfig: [], compileEnhancements: true, enhancementsOnly: false})));
});

test('validateConfig: babelConfig may be undefined', withProvider, (t, provider) => {
	provider.validateConfig({babelConfig: undefined, compileEnhancements: false, enhancementsOnly: false});
	t.true(provider.isEnabled());
});

test('validateConfig: throw when babelConfig contains keys other than \'extensions\' or \'testOptions\'', withProvider, (t, provider) => {
	t.snapshot(t.throws(() => provider.validateConfig({babelConfig: {foo: 1}, compileEnhancements: true, enhancementsOnly: false})));
});

test('validateConfig: throw when babelConfig.extensions contains empty strings', withProvider, (t, provider) => {
	t.snapshot(t.throws(() => provider.validateConfig({babelConfig: {extensions: ['']}, compileEnhancements: true, enhancementsOnly: false})));
});

test('validateConfig: throw when babelConfig.extensions contains non-strings', withProvider, (t, provider) => {
	t.snapshot(t.throws(() => provider.validateConfig({babelConfig: {extensions: [1]}, compileEnhancements: true, enhancementsOnly: false})));
});

test('validateConfig: throw when babelConfig.testOptions is not a plain object', withProvider, (t, provider) => {
	t.snapshot(t.throws(() => provider.validateConfig({babelConfig: {testOptions: null}, compileEnhancements: true, enhancementsOnly: false})));
	t.snapshot(t.throws(() => provider.validateConfig({babelConfig: {testOptions: []}, compileEnhancements: true, enhancementsOnly: false})));
	t.snapshot(t.throws(() => provider.validateConfig({babelConfig: {testOptions: true}, compileEnhancements: true, enhancementsOnly: false})));
});

test('getExtensions: defaults to an empty array', withProvider, (t, provider) => {
	provider.validateConfig({compileEnhancements: true, enhancementsOnly: false});
	t.deepEqual(provider.getExtensions(), []);
});

test('getExtensions: returns an empty array if config was invalid', withProvider, (t, provider) => {
	t.throws(() => provider.validateConfig({babelConfig: {extensions: [1]}, compileEnhancements: true, enhancementsOnly: false}));
	t.deepEqual(provider.getExtensions(), []);
});

test('getExtensions: returns configured extensions', withProvider, (t, provider) => {
	const extensions = ['js'];
	provider.validateConfig({babelConfig: {extensions}, compileEnhancements: true, enhancementsOnly: false});
	t.deepEqual(provider.getExtensions(), extensions);
});

test('getExtensions: always returns new arrays', withProvider, (t, provider) => {
	provider.validateConfig({compileEnhancements: true, enhancementsOnly: false});
	t.not(provider.getExtensions(), provider.getExtensions());
});

const compile = provider => {
	provider.validateConfig({compileEnhancements: true, enhancementsOnly: false});

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
	const {stdout} = await execa.node(path.join(__dirname, 'fixtures/install-and-load'), ['legacy', JSON.stringify(state)]);
	t.snapshot(stdout);
});
