var sgMail = require('@sendgrid/mail');
const { normalizeAttachments } = require('../utils/attachments-normalize');

const MAX_ERROR_VALUE_LENGTH = 100;

module.exports = function (RED) {
    'use strict';
    function SendGridNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        node.on('input', function (msg, send, done) {
            send = send || function () {
                node.send.apply(node, arguments);
            };
            node.status({fill: "blue", shape: "dot", text: "gemini86-sendgrid.status.sending"});
            var body;
            
            // Parse template data with error handling
            var templateData;
            var templateDataSource;
            var templateDataSourceName;
            
            if (config.templateData !== undefined) {
                templateDataSource = config.templateData;
                templateDataSourceName = 'config';
            } else if (msg.templateData !== undefined) {
                templateDataSource = msg.templateData;
                templateDataSourceName = 'message';
            } else {
                templateDataSource = '{}';
                templateDataSourceName = 'default';
            }
            
            if (typeof templateDataSource === 'object') {
                templateData = templateDataSource;
            } else {
                try {
                    templateData = JSON.parse(templateDataSource);
                } catch (err) {
                    node.status({fill: "red", shape: "ring", text: "gemini86-sendgrid.status.sendfail"});
                    const sourceStr = String(templateDataSource);
                    const truncatedSource = sourceStr.length > MAX_ERROR_VALUE_LENGTH 
                        ? sourceStr.substring(0, MAX_ERROR_VALUE_LENGTH) + '...'
                        : sourceStr;
                    const errorMsg = `Invalid template data JSON from ${templateDataSourceName}: ${err.message}. Received: ${truncatedSource}`;
                    if (done) {
                        return done(errorMsg);
                    } else {
                        return node.error(errorMsg, msg);
                    }
                }
            }
            
            var data = {
                from: config.from || msg.from,
                to: (to => Array.isArray(to) ? to : to.split(/[,; ]+/g))(msg.to || config.to || ''),
                cc: (msg.cc || '').split(/[,; ]+/g),
                bcc: (msg.bcc || '').split(/[,; ]+/g),
                subject: msg.topic || msg.subject || 'Message from Node-RED',
                templateId: config.templateId || msg.templateId,
                dynamic_template_data: templateData,
            };
            if(!data.templateId) {
                // Always use msg.attachments for attachments
                if (msg.attachments) {
                    try {
                        const { attachments, errors } = normalizeAttachments(msg.attachments, {
                            onError: config.skipBadAtts ? 'skip' : 'fail',
                            baseName: 'attachment',
                            sniffBuffers: true,
                            inferTypeFromFilename: true,
                        });
                        if (attachments.length > 0) {
                            data.attachments = attachments;
                        }
                        if (errors && errors.length > 0) {
                            const errMsg = errors.map(e => `Attachment at index ${e.index}: ${e.message}`).join('; ');
                            if (config.skipBadAtts) {
                                node.warn(`Some attachments were skipped: ${errMsg}`);
                            } else {
                                throw new Error(errMsg);
                            }
                        }
                    } catch (err) {
                        if (config.skipBadAtts) {
                            node.warn(`Attachment normalization error: ${err && err.message ? err.message : err}`);
                        } else {
                            node.status({fill: "red", shape: "ring", text: "gemini86-sendgrid.status.sendfail"});
                            if (done) {
                                return done(err.toString());
                            } else {
                                return node.error(err.toString(), msg);
                            }
                        }
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
                    node.status({fill: "red", shape: "ring", text: "gemini86-sendgrid.status.sendfail"});
                    if (done) {
                        done(err.toString());
                    } else {
                        node.error(err.toString(), msg);
                    }
                } else {
                    if (done) {
                        done();
                    }
                    node.status({fill: "green", shape: "dot", text: "gemini86-sendgrid.status.sent"});
                    setTimeout(function () {
                        node.status({});
                    }, 1000);
                }
            });
        });
    }
    RED.nodes.registerType("gemini86-sendgrid", SendGridNode, {
        credentials: {
            key: {type: "password"}
        },
        defaults: {
            skipBadAtts: { value: false }
        }
    });
};
