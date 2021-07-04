const test = require('ava');
const babel = require('@babel/core');
const fn = require('../throws-helper.js');

function transform(input) {
	return babel.transform(input, {
		plugins: [fn],
		filename: '/some-file.js'
	});
}

function snapshotTransform(t, input) {
	const {code} = transform(input);
	t.snapshot(code.replace(/D:\\{2}/g, '/'), input);
}

test('creates a helper', snapshotTransform, 't.throws(foo())');

test('creates the helper only once', snapshotTransform, 't.throws(foo()); t.throws(bar());');

test('does nothing if it does not match', snapshotTransform, 't.is(foo());');

test('helps notThrows', snapshotTransform, 't.notThrows(baz())');

test('does not throw on generated code', t => {
	t.notThrows(() => {
		const statement = babel.types.expressionStatement(babel.types.callExpression(
			babel.types.memberExpression(
				babel.types.identifier('t'),
				babel.types.identifier('throws')
			),
			[babel.types.callExpression(
				babel.types.identifier('foo'),
				[]
			)]
		));

		const program = babel.types.program([statement]);

		babel.transformFromAst(program, null, {
			plugins: [fn],
			filename: 'some-file.js'
		});
	});
});
