const os = require('os');
const path = require('path');
const test = require('ava');
const execa = require('execa');
const pkg = require('../package.json');
const makeProvider = require('..');

const withProvider = (t, run) => run(t, makeProvider({
	negotiateProtocol(identifiers) {
		t.true(identifiers.includes('1'));
		return {
			ava: {version: '2.4.0'},
			identifier: '1',
			normalizeGlobPatterns: patterns => patterns,
			async findFiles({patterns}) {
				return patterns.map(file => path.join(__dirname, file));
			},
			projectDir: __dirname
		};
	}
}));

const validateConfig = (t, provider, config) => {
	const error = t.throws(() => provider.main({config}));
	error.message = error.message.replace(`v${pkg.version}`, 'v${pkg.version}'); // eslint-disable-line no-template-curly-in-string
	t.snapshot(error);
};

test('negotiates 1 protocol', withProvider, t => t.plan(1));

test('main() config validation: throw when babelConfig is not true or a plain object', withProvider, (t, provider) => {
	validateConfig(t, provider, false);
	validateConfig(t, provider, null);
	validateConfig(t, provider, []);
});

test('main() config validation: throw when babelConfig contains keys other than \'compileEnhancements\', \'extensions\' or \'testOptions\'', withProvider, (t, provider) => {
	validateConfig(t, provider, {foo: 1});
});

test('main() config validation: throw when babelConfig.compileEnhancements is not a boolean', withProvider, (t, provider) => {
	validateConfig(t, provider, {compileEnhancements: 1});
});

test('main() config validation: throw when babelConfig.extensions contains empty strings', withProvider, (t, provider) => {
	validateConfig(t, provider, {extensions: ['']});
});

test('main() config validation: throw when babelConfig.extensions contains non-strings', withProvider, (t, provider) => {
	validateConfig(t, provider, {extensions: [1]});
});

test('main() config validation: throw when babelConfig.extensions contains duplicates', withProvider, (t, provider) => {
	validateConfig(t, provider, {extensions: ['js', 'js']});
});

test('main() config validation: throw when babelConfig.testOptions is not a plain object', withProvider, (t, provider) => {
	validateConfig(t, provider, {testOptions: null});
	validateConfig(t, provider, {testOptions: []});
	validateConfig(t, provider, {testOptions: true});
});

test('main() config validation: babelConfig may be true', withProvider, (t, provider) => {
	t.notThrows(() => provider.main({config: true}));
});

test('main() config validation: babelConfig may be an empty object', withProvider, (t, provider) => {
	t.notThrows(() => provider.main({config: {}}));
});

test('main() extensions: defaults to [\'js\']', withProvider, (t, provider) => {
	t.deepEqual(provider.main({config: true}).extensions, ['js']);
});

test('main() extensions: returns configured extensions', withProvider, (t, provider) => {
	const extensions = ['js'];
	t.deepEqual(provider.main({config: {extensions}}).extensions, extensions);
});

test('main() extensions: always returns new arrays', withProvider, (t, provider) => {
	const main = provider.main({config: true});
	t.not(main.extensions, main.extensions);
});

const compile = async provider => {
	const cacheDir = os.tmpdir();
	const testFile = path.join(__dirname, 'fixtures/esm-export.js');
	const helperFile = path.join(__dirname, 'fixtures/esm-import.js');

	return {
		cacheDir,
		testFile,
		helperFile,
		state: await provider.main({
			config: {
				compileAsTests: ['fixtures/esm-import.js']
			}
		}).compile({
			cacheDir,
			files: [testFile]
		})
	};
};

test('main() compile: compiles all files', withProvider, async (t, provider) => {
	const {cacheDir, testFile, helperFile, state} = await compile(provider);
	t.assert(state[testFile].startsWith(cacheDir));
	t.assert(state[helperFile].startsWith(cacheDir));
});

test('worker(): load compiled files', withProvider, async (t, provider) => {
	const {state} = await compile(provider);
	const {stdout} = await execa.node(path.join(__dirname, 'fixtures/install-and-load'), ['1', JSON.stringify(state)]);
	t.snapshot(stdout);
});
