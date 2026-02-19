// test/_helper.js
const helper = require('node-red-node-test-helper');
const proxyquire = require('proxyquire');

helper.init(require.resolve('node-red'));

// Start/stop once for the whole suite (since this module is required by test files)
before(function () {
    return helper.startServer();
});

after(function () {
    return helper.stopServer();
});

afterEach(function () {
    return helper.unload();
});

/**
 * Factory: returns a proxyquired node module + stateful call capture.
 * Usage:
 *   const { helper, makeSendgridNode } = require('./_helper');
 *   const { sendgridNode, state, reset } = makeSendgridNode();
 */
function makeSendgridNode() {
    const state = {
        sendCalls: [],
        apiKeyCalls: [],
    };

    const mockSend = function (data, multiple, cb) {
        state.sendCalls.push({ data, multiple });

        // Support (data, cb) and (data, multiple, cb)
        if (typeof multiple === 'function') cb = multiple;

        const result = [{ statusCode: 202 }];
        if (typeof cb === 'function') setImmediate(() => cb(null, result));

        // Extra-safe if code ever awaits
        return Promise.resolve(result);
    };

    const mockSetApiKey = function (key) {
        state.apiKeyCalls.push(key);
    };

    const sendgridNode = proxyquire('../src/node.js', {
        '@sendgrid/mail': { send: mockSend, setApiKey: mockSetApiKey },
    });

    function reset() {
        state.sendCalls = [];
        state.apiKeyCalls = [];
    }

    return { sendgridNode, state, reset };
}

module.exports = { helper, makeSendgridNode };
