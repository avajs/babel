const path = require('path');
const makeProvider = require('../..');

const provider = makeProvider({
	negotiateProtocol() {
		return {identifier: process.argv[2], ava: {version: '2.4.0'}, projectDir: path.resolve(__dirname, '..')};
	}
});

provider.installHook(JSON.parse(process.argv[3]));
require('./esm-import'); // eslint-disable-line import/no-unassigned-import
