const path = require('path');
const makeProvider = require('../..');

const provider = makeProvider({
	negotiateProtocol() {
		return {identifier: process.argv[2], ava: {version: '2.4.0'}, projectDir: path.resolve(__dirname, '..')};
	}
});

provider.worker({state: JSON.parse(process.argv[3])}).load('./esm-import', {requireFn: require});
