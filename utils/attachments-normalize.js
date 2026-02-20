// normalize-attachments.js (CommonJS)
// Uses @sendgrid/helpers Attachment class
// No ESM. No file-type.

const { classes } = require('@sendgrid/helpers');
const Attachment = classes.Attachment;

/**
 * Minimal, dependency-free MIME lookup from filename extension.
 * (Add more as you want.)
 */
function mimeFromFilename(filename) {
    const ext = String(filename).split('.').pop().toLowerCase();
    const map = {
        pdf: 'application/pdf',
        png: 'image/png',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        gif: 'image/gif',
        webp: 'image/webp',
        txt: 'text/plain',
        csv: 'text/csv',
        json: 'application/json',
        xml: 'application/xml',
        zip: 'application/zip',
        gz: 'application/gzip',
        mp3: 'audio/mpeg',
        wav: 'audio/wav',
        mp4: 'video/mp4',
    };
    return Object.prototype.hasOwnProperty.call(map, ext) ? map[ext] : null; // fallback to null if not found
}

/**
 * Basic, dependency-free extension + mime sniff from buffer magic bytes.
 * Best-effort only (intentionally limited).
 */
function sniffFromBuffer(buf) {
    if (!Buffer.isBuffer(buf) || buf.length < 4) return null;

    // PDF: %PDF
    if (buf.slice(0, 4).toString('ascii') === '%PDF') return { ext: 'pdf', mime: 'application/pdf' };

    // PNG
    if (buf.length >= 8 &&
        buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47 &&
        buf[4] === 0x0D && buf[5] === 0x0A && buf[6] === 0x1A && buf[7] === 0x0A) {
        return { ext: 'png', mime: 'image/png' };
    }

    // JPEG
    if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return { ext: 'jpg', mime: 'image/jpeg' };

    // GIF
    if (buf.length >= 6) {
        const gif = buf.slice(0, 6).toString('ascii');
        if (gif === 'GIF87a' || gif === 'GIF89a') return { ext: 'gif', mime: 'image/gif' };
    }

    // WebP: RIFF....WEBP
    if (buf.length >= 12 &&
        buf.slice(0, 4).toString('ascii') === 'RIFF' &&
        buf.slice(8, 12).toString('ascii') === 'WEBP') {
        return { ext: 'webp', mime: 'image/webp' };
    }

    // ZIP: PK..
    if (buf[0] === 0x50 && buf[1] === 0x4B && (buf[2] === 0x03 || buf[2] === 0x05 || buf[2] === 0x07)) {
        return { ext: 'zip', mime: 'application/zip' };
    }

    // GZIP: 1F 8B
    if (buf[0] === 0x1F && buf[1] === 0x8B) return { ext: 'gz', mime: 'application/gzip' };

    // MP3: ID3 or frame sync
    if (buf.slice(0, 3).toString('ascii') === 'ID3' || (buf[0] === 0xFF && (buf[1] & 0xE0) === 0xE0)) {
        return { ext: 'mp3', mime: 'audio/mpeg' };
    }

    // WAV: RIFF....WAVE
    if (buf.length >= 12 &&
        buf.slice(0, 4).toString('ascii') === 'RIFF' &&
        buf.slice(8, 12).toString('ascii') === 'WAVE') {
        return { ext: 'wav', mime: 'audio/wav' };
    }

    // MP4-ish: ftyp
    if (buf.length >= 12 && buf.slice(4, 8).toString('ascii') === 'ftyp') return { ext: 'mp4', mime: 'video/mp4' };

    return null;
}

/**
 * Normalize msg.attachments (array of SendGrid attachment objects OR Buffers)
 * into SendGrid attachment objects (with base64 content).
 *
 * @param {any[]|undefined|null} input
 * @param {object} opts
 * @param {"fail"|"skip"} [opts.onError="fail"]
 * @param {string} [opts.baseName="attachment"]
 * @param {string} [opts.defaultExt="bin"]
 * @param {string} [opts.defaultMime="application/octet-stream"]
 * @param {boolean} [opts.sniffBuffers=true]  // try to set ext/mime from buffer
 * @param {boolean} [opts.inferTypeFromFilename=true] // fill missing type from filename ext
 * @returns {{ attachments: object[], errors: {index:number, message:string}[] }}
 */
function normalizeAttachments(input, opts = {}) {
    const {
        onError = 'fail',
        baseName = 'attachment',
        defaultExt = 'bin',
        defaultMime = 'application/octet-stream',
        sniffBuffers = true,
        inferTypeFromFilename = true,
    } = opts;

    if (input == null) return { attachments: [], errors: [] };
    if (!Array.isArray(input)) throw new Error('msg.attachments must be an array');

    const attachments = [];
    const errors = [];

    for (let i = 0; i < input.length; i++) {
        const item = input[i];

        try {
            // Case 1: Buffer -> build Attachment via helpers
            if (Buffer.isBuffer(item)) {
                const idx = i + 1;

                const detected = sniffBuffers ? sniffFromBuffer(item) : null;
                const ext = detected?.ext || defaultExt;
                const mimeType = detected?.mime || defaultMime;

                const a = new Attachment();
                a.setDisposition('attachment'); // ensures Buffer -> base64 when setContent(Buffer)
                a.setFilename(`${baseName}-${idx}.${ext}`);
                a.setType(mimeType);
                a.setFileContent(item);

                attachments.push(a.toJSON());
                continue;
            }

            // Case 2: Object -> validate + normalize (and optionally infer type from filename)
            if (item && typeof item === 'object') {
                // Enforce spec-ish: must have filename
                if (typeof item.filename !== 'string' || !item.filename.trim()) throw new Error('"filename" is required');

                // Infer missing type from filename ext (optional)
                const type = item.type || (inferTypeFromFilename ? mimeFromFilename(item.filename) : undefined);

                const a = new Attachment();
                a.setDisposition(item.disposition || 'attachment');
                a.setFilename(item.filename);
                if (type) a.setType(type);
                Buffer.isBuffer(item.content) ? a.setFileContent(item.content) : a.setContent(item.content); // Auto base64 or Buffer
                if (item.content_id) a.setContentId(item.content_id);

                attachments.push(a.toJSON());
                continue;
            }

            throw new Error('Attachment must be a Buffer or an attachment object');
        } catch (err) {
            const info = { index: i, message: err?.message || String(err) };
            errors.push(info);
            if (onError === 'fail') {
                const e = new Error(`Attachment normalization failed at index ${i}: ${info.message}`);
                e.attachmentError = info;
                throw e;
            }
            // onError === 'skip' => just drop this attachment
        }
    }

    return { attachments, errors };
}

module.exports = { normalizeAttachments };
