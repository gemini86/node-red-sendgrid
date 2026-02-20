// test/_helper.js
const helper = require('node-red-node-test-helper');
const proxyquire = require('proxyquire');

helper.init(require.resolve('node-red'));

before(function () { return helper.startServer(); });
after(function () { return helper.stopServer(); });
afterEach(function () { return helper.unload(); });

function makeSendgridNode() {
    const state = {
        sendCalls: [],
        apiKeyCalls: [],
    };

    const mockSend = function (data, multiple, cb) {
        state.sendCalls.push({ data, multiple });
        if (typeof multiple === 'function') cb = multiple;

        const result = [{ statusCode: 202 }];
        if (typeof cb === 'function') setImmediate(() => cb(null, result));
        return Promise.resolve(result);
    };

    const mockSetApiKey = function (key) {
        state.apiKeyCalls.push(key);
    };

    const sendgridNode = proxyquire('../src/node.js', {
        '@sendgrid/mail': { send: mockSend, setApiKey: mockSetApiKey },
    });

    // ✅ Capture what the module *actually* registers
    let NODE_TYPE;
    sendgridNode({
        nodes: {
            registerType: (t) => { NODE_TYPE = t; },
            // minimal stubs; just enough so the module can define itself
            createNode: () => { },
            getNode: () => ({}),
        },
        log: { info() { }, warn() { }, error() { }, debug() { } },
    });

    if (!NODE_TYPE) {
        throw new Error('Could not detect NODE_TYPE from registerType() in ../src/node.js');
    }

    function reset() {
        state.sendCalls = [];
        state.apiKeyCalls = [];
    }

    return { sendgridNode, state, reset, NODE_TYPE };
}

module.exports = { helper, makeSendgridNode };
