require('should');

const { normalizeAttachments } = require('../src/utils/attachments-normalize');

describe('normalizeAttachments utility', function () {
    it('is available under src/utils and normalizes buffer attachments', function () {
        const { attachments, errors } = normalizeAttachments([Buffer.from('%PDF-1.4\nhello')]);

        errors.should.have.length(0);
        attachments.should.have.length(1);
        attachments[0].filename.should.equal('attachment-1.pdf');
        attachments[0].type.should.equal('application/pdf');
        attachments[0].content.should.equal(Buffer.from('%PDF-1.4\nhello').toString('base64'));
    });
});
