const path = require('path');
const test = require('ava');
const execa = require('execa');
const tempy = require('tempy');
const pkg = require('../package.json');
const makeProvider = require('..');

const withProvider = (t, run) => run(t, makeProvider({
	negotiateProtocol(identifiers, {version}) {
		t.true(identifiers.includes('ava-3'));
		t.is(version, pkg.version);
		return {
			ava: {version: '3.0.0'},
			identifier: 'ava-3',
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

test('negotiates ava-3 protocol', withProvider, t => t.plan(2));

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

test('main() extensions: defaults to [\'cjs\', \'js\']', withProvider, (t, provider) => {
	t.deepEqual(provider.main({config: true}).extensions, ['cjs', 'js']);
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
	const cacheDir = tempy.directory();
	const cjsTestFile = path.join(__dirname, 'fixtures/esm-import.cjs');
	const jsTestFile = path.join(__dirname, 'fixtures/esm-import.js');
	const helperFile = path.join(__dirname, 'fixtures/esm-export.js');

	return {
		cacheDir,
		cjsTestFile,
		jsTestFile,
		helperFile,
		state: await provider.main({
			config: {
				compileAsTests: ['fixtures/esm-export.js']
			}
		}).compile({
			cacheDir,
			files: [cjsTestFile, jsTestFile]
		})
	};
};

test('main() compile: compiles all files', withProvider, async (t, provider) => {
	const {cacheDir, cjsTestFile, jsTestFile, helperFile, state} = await compile(provider);
	t.assert(state.lookup[cjsTestFile].startsWith(cacheDir));
	t.assert(state.lookup[jsTestFile].startsWith(cacheDir));
	t.assert(state.lookup[helperFile].startsWith(cacheDir));
});

test('worker(): load compiled files', withProvider, async (t, provider) => {
	const {state} = await compile(provider);
	for await (const file of ['esm-import.cjs', 'esm-import.js']) {
		const {stdout, stderr} = await execa.node(
			path.join(__dirname, 'fixtures/install-and-load'),
			['ava-3', JSON.stringify(state), file],
			{cwd: path.join(__dirname, 'fixtures')}
		);
		if (stderr.length > 0) {
			t.log(stderr);
		}

		t.snapshot(stdout, file);
	}
});

test('supports all stage-4 syntax', withProvider, async (t, provider) => {
	await t.notThrowsAsync(provider.main({
		config: {
			testOptions: {
				presets: [
					[`module:${require.resolve('../stage-4')}`, false]
				]
			}
		}
	}).compile({
		cacheDir: tempy.directory(),
		files: [path.join(__dirname, 'fixtures/syntax.js')]
	}));
});
