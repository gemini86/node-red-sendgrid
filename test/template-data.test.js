const { helper, makeSendgridNode } = require('./_helper');
require('should');

const { sendgridNode, state, reset, NODE_TYPE } = makeSendgridNode();

describe('sendgrid node templates', function () {
    beforeEach(() => reset());

    it('uses config.templateData for dynamic template data', function (done) {
        const flow = [{
            id: 'n1',
            type: NODE_TYPE,
            from: 'from@example.com',
            to: 'to@example.com',
            templateId: 'd-1234567890abcdef1234567890abcdef',
            templateData: '{"customerName":"Rodney","orderId":"KEW-42"}'
        }];

        const credentials = { n1: { key: 'SG.fakekey' } };

        helper.load(sendgridNode, flow, credentials, function (err) {
            if (err) return done(err);

            helper.getNode('n1').receive({
                payload: 'Hello world!',
                templateData: { customerName: 'MessageValueShouldNotWin' }
            });

            setImmediate(() => {
                try {
                    state.apiKeyCalls.should.eql(['SG.fakekey']);
                    state.sendCalls.should.have.length(1);

                    const data = state.sendCalls[0].data;
                    data.templateId.should.equal('d-1234567890abcdef1234567890abcdef');
                    data.dynamic_template_data.should.eql({
                        customerName: 'Rodney',
                        orderId: 'KEW-42'
                    });

                    data.should.not.have.property('text');
                    data.should.not.have.property('html');

                    done();
                } catch (e) {
                    done(e);
                }
            });
        });
    });

    it('uses msg.templateId to send in dynamic template mode', function (done) {
        const flow = [{
            id: 'n1',
            type: NODE_TYPE,
            from: 'from@example.com',
            to: 'to@example.com'
        }];

        const credentials = { n1: { key: 'SG.fakekey' } };

        helper.load(sendgridNode, flow, credentials, function (err) {
            if (err) return done(err);

            helper.getNode('n1').receive({
                payload: 'Hello world!',
                templateId: 'd-fedcba0987654321fedcba0987654321',
                templateData: { firstName: 'Rodney', accountId: 'KE-1001' }
            });

            setImmediate(() => {
                try {
                    state.apiKeyCalls.should.eql(['SG.fakekey']);
                    state.sendCalls.should.have.length(1);

                    const data = state.sendCalls[0].data;
                    data.templateId.should.equal('d-fedcba0987654321fedcba0987654321');
                    data.dynamic_template_data.should.eql({
                        firstName: 'Rodney',
                        accountId: 'KE-1001'
                    });

                    data.should.not.have.property('text');
                    data.should.not.have.property('html');

                    done();
                } catch (e) {
                    done(e);
                }
            });
        });
    });
});
