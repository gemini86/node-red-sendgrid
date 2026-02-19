const { helper, makeSendgridNode } = require('./_helper');
require('should');

const { sendgridNode, state, reset, NODE_TYPE } = makeSendgridNode();

describe('sendgrid node attachments', function () {
    beforeEach(() => reset());

    it('normalizes buffer attachments and sends them', function (done) {
        const flow = [{
            id: 'n1',
            type: NODE_TYPE,
            from: 'from@example.com',
            to: 'to@example.com',
            skipBadAtts: false
        }];

        const credentials = { n1: { key: 'SG.fakekey' } };

        helper.load(sendgridNode, flow, credentials, function (err) {
            if (err) return done(err);

            const buf = Buffer.from('%PDF-1.4\nhello');
            helper.getNode('n1').receive({ payload: 'Hello', attachments: [buf] });

            setImmediate(() => {
                try {
                    state.sendCalls.should.have.length(1);
                    const data = state.sendCalls[0].data;

                    data.should.have.property('attachments');
                    data.attachments.should.have.length(1);

                    data.attachments[0].should.have.property('content').which.is.a.String();
                    data.attachments[0].should.have.property('filename').which.is.a.String();
                    data.attachments[0].filename.should.match(/^attachment-1\.(pdf|bin)$/);
                    data.attachments[0].should.have.property('type').which.is.a.String();

                    done();
                } catch (e) {
                    done(e);
                }
            });
        });
    });

    it('accepts attachment objects (base64 content) and infers type from filename when missing', function (done) {
        const flow = [{
            id: 'n1',
            type: NODE_TYPE,
            from: 'from@example.com',
            to: 'to@example.com',
            skipBadAtts: false
        }];

        const credentials = { n1: { key: 'SG.fakekey' } };

        helper.load(sendgridNode, flow, credentials, function (err) {
            if (err) return done(err);

            const base64 = Buffer.from('hello').toString('base64');
            helper.getNode('n1').receive({
                payload: 'Hello',
                attachments: [{
                    content: base64,
                    filename: 'note.txt',
                    disposition: 'attachment'
                }]
            });

            setImmediate(() => {
                try {
                    state.sendCalls.should.have.length(1);
                    const att = state.sendCalls[0].data.attachments[0];

                    att.filename.should.equal('note.txt');
                    att.content.should.equal(base64);
                    att.type.should.equal('text/plain');

                    done();
                } catch (e) {
                    done(e);
                }
            });
        });
    });

    it("accepts attachment objects with Buffer content", function (done) {
        const flow = [{ id: "n1", type: NODE_TYPE, from: "a@b.com", to: "c@d.com" }];
        const credentials = { n1: { key: "SG.fakekey" } };

        helper.load(sendgridNode, flow, credentials, function (err) {
            if (err) return done(err);

            helper.getNode("n1").receive({
                payload: "hi",
                attachments: [{
                    filename: "x.png",
                    type: "image/png",
                    content: Buffer.from([0x01, 0x02, 0x03]),
                }]
            });

            setImmediate(() => {
                const data = state.sendCalls[0].data;
                data.attachments[0].content.should.equal(Buffer.from([0x01, 0x02, 0x03]).toString("base64"));
                done();
            });
        });
    });

    it('skips bad attachments when skipBadAtts is true', function (done) {
        const flow = [{
            id: 'n1',
            type: NODE_TYPE,
            from: 'from@example.com',
            to: 'to@example.com',
            skipBadAtts: true
        }];

        const credentials = { n1: { key: 'SG.fakekey' } };

        helper.load(sendgridNode, flow, credentials, function (err) {
            if (err) return done(err);

            helper.getNode('n1').receive({
                payload: 'Hello',
                attachments: [
                    Buffer.from('%PDF-1.4\nhello'),
                    12345
                ]
            });

            setImmediate(() => {
                try {
                    state.sendCalls.should.have.length(1);
                    const data = state.sendCalls[0].data;

                    data.should.have.property('attachments');
                    data.attachments.should.have.length(1);

                    done();
                } catch (e) {
                    done(e);
                }
            });
        });
    });

    it('fails on bad attachments when skipBadAtts is false', function (done) {
        const flow = [{
            id: 'n1',
            type: NODE_TYPE,
            from: 'from@example.com',
            to: 'to@example.com',
            skipBadAtts: false
        }];

        const credentials = { n1: { key: 'SG.fakekey' } };

        helper.load(sendgridNode, flow, credentials, function (err) {
            if (err) return done(err);

            const n1 = helper.getNode('n1');

            n1.on('call:error', function () {
                try {
                    state.sendCalls.should.have.length(0);
                    done();
                } catch (e) {
                    done(e);
                }
            });

            n1.receive({ payload: 'Hello', attachments: [12345] });
        });
    });
});
