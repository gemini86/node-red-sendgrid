var sgMail = require('@sendgrid/mail');
var fileType = require('file-type');

module.exports = function (RED) {
    'use strict';
    function SendGridNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        node.on('input', function (msg, send, done) {
            send = send || function () {
                node.send.apply(node, arguments);
            };
            node.status({fill: "blue", shape: "dot", text: "sendgrid.status.sending"});
            var body;
            var data = {
                from: config.from || msg.from,
                to: (to => Array.isArray(to) ? to : to.split(/[,; ]+/g))(msg.to || config.to || ''),
                cc: (msg.cc || '').split(/[,; ]+/g),
                bcc: (msg.bcc || '').split(/[,; ]+/g),
                subject: msg.topic || msg.title || 'Message from Node-RED',
                templateId: config.templateId || msg.templateId,
                dynamic_template_data: (data => typeof data === 'object' ? data : JSON.parse(data))(config.templateData || msg.templateData || '{}'),
            };
            if(!config.templateId) {
                // Always use msg.attachments for attachments
                if (msg.attachments) {
                    let attachments = [];
                    if (Buffer.isBuffer(msg.attachments)) {
                        // Single buffer as attachment
                        let ext = "bin";
                        try {
                            const ft = fileType(msg.attachments);
                            if (ft && ft.ext) ext = ft.ext;
                        } catch (e) {
                            node.warn("Could not determine file type for attachment (single buffer): " + (e && e.message ? e.message : e));
                        }
                        attachments.push({
                            content: msg.attachments.toString('base64'),
                            filename: msg.filename || ("attachment." + ext)
                        });
                    } else if (Array.isArray(msg.attachments)) {
                        // Array of attachments
                        msg.attachments.forEach((att, i) => {
                            if (Buffer.isBuffer(att)) {
                                let ext = "bin";
                                try {
                                    const ft = fileType(att);
                                    if (ft && ft.ext) ext = ft.ext;
                                } catch (e) {
                                    node.warn("Could not determine file type for attachment at index " + i + ": " + (e && e.message ? e.message : e));
                                }
                                attachments.push({
                                    content: att.toString('base64'),
                                    filename: (att.filename || (msg.filenames && msg.filenames[i]) || ("attachment" + (i+1) + "." + ext))
                                });
                            } else if (att && att.content && att.filename) {
                                // Already in SendGrid format
                                attachments.push(att);
                            }
                        });
                    } else if (msg.attachments.content && msg.attachments.filename) {
                        // Already in SendGrid format
                        attachments.push(msg.attachments);
                    }
                    if (attachments.length > 0) {
                        data.attachments = attachments;
                    }
                }
                // msg.payload is always the body
                body = msg.payload ? msg.payload.toString() : " ";
                if (config.content === "html") {
                    data.html = body;
                } else {
                    data.text = body;
                }
            }

            sgMail.setApiKey(node.credentials.key);
            sgMail.send(data, config.multiple, function (err) {
                if (err) {
                    node.status({fill: "red", shape: "ring", text: "sendgrid.status.sendfail"});
                    if (done) {
                        done(err.toString());
                    } else {
                        node.error(err.toString(), msg);
                    }
                } else {
                    if (done) {
                        done();
                    }
                    setTimeout(function () {
                        node.status({});
                    }, 1000);
                }
            });
        });
    }
    RED.nodes.registerType("sendgrid", SendGridNode, {
        credentials: {
            key: {type: "password"}
        }
    });
};
