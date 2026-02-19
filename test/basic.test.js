const { helper, makeSendgridNode } = require('./_helper');
require('should');

const { sendgridNode, state, reset, NODE_TYPE } = makeSendgridNode();

describe('sendgrid node', function () {
    beforeEach(() => reset());

    it('uses config.subject then topic then msg.subject', function (done) {
        const flow = [{
            id: 'n1',
            type: NODE_TYPE,
            from: 'from@example.com',
            to: 'to@example.com',
            subject: 'Config Subject'
        }];

        const credentials = { n1: { key: 'SG.fakekey' } };

        helper.load(sendgridNode, flow, credentials, function (err) {
            if (err) return done(err);

            helper.getNode('n1').receive({
                payload: 'Hello world!',
                topic: 'Topic Subject',
                subject: 'Msg Subject'
            });

            setImmediate(() => {
                try {
                    state.apiKeyCalls.should.eql(['SG.fakekey']);
                    state.sendCalls.should.have.length(1);

                    const data = state.sendCalls[0].data;
                    data.subject.should.equal('Config Subject');
                    data.text.should.equal('Hello world!');

                    done();
                } catch (e) {
                    done(e);
                }
            });
        });
    });

    it('sends html when config.content === "html"', function (done) {
        const flow = [{
            id: 'n1',
            type: NODE_TYPE,
            from: 'from@example.com',
            to: 'to@example.com',
            content: 'html'
        }];

        const credentials = { n1: { key: 'SG.fakekey' } };

        helper.load(sendgridNode, flow, credentials, function (err) {
            if (err) return done(err);

            helper.getNode('n1').receive({ payload: '<b>Hi</b>' });

            setImmediate(() => {
                try {
                    state.sendCalls.should.have.length(1);
                    const data = state.sendCalls[0].data;

                    data.should.have.property('html', '<b>Hi</b>');
                    done();
                } catch (e) {
                    done(e);
                }
            });
        });
    });
});
