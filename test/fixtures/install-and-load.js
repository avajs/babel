const path = require('path');
const makeProvider = require('../../index.js');

const provider = makeProvider({
	negotiateProtocol() {
		return {identifier: process.argv[2], ava: {version: '2.4.0'}, projectDir: path.resolve(__dirname, '..')};
	}
});

const worker = provider.worker({
	extensionsToLoadAsModules: [],
	state: JSON.parse(process.argv[3])
});

const ref = path.resolve(process.argv[4]);
if (worker.canLoad(ref)) {
	worker.load(ref, {requireFn: require});
}
