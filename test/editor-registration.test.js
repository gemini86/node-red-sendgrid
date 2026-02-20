const fs = require('fs');
const path = require('path');
require('should');

describe('node registration metadata', function () {
    it('keeps package.json, node.js, and node.html node type names aligned', function () {
        const root = path.resolve(__dirname, '..');
        const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
        const nodeRedNodes = (pkg['node-red'] && pkg['node-red'].nodes) || {};

        Object.keys(nodeRedNodes).should.have.length(1);

        const nodeTypeFromPackage = Object.keys(nodeRedNodes)[0];
        const runtimePath = path.join(root, nodeRedNodes[nodeTypeFromPackage]);
        const editorPath = runtimePath.replace(/\.js$/i, '.html');

        const runtimeSource = fs.readFileSync(runtimePath, 'utf8');
        const editorSource = fs.readFileSync(editorPath, 'utf8');

        const runtimeTypeMatch = runtimeSource.match(/registerType\(\s*["']([^"']+)["']/);
        should.exist(runtimeTypeMatch, 'src/node.js must call RED.nodes.registerType("<type>", ...)');
        runtimeTypeMatch[1].should.equal(nodeTypeFromPackage);

        const editorTypeMatch = editorSource.match(/RED\.nodes\.registerType\(\s*["']([^"']+)["']/);
        should.exist(editorTypeMatch, 'src/node.html must call RED.nodes.registerType("<type>", ...)');
        editorTypeMatch[1].should.equal(nodeTypeFromPackage);

        const templateNameMatches = Array.from(editorSource.matchAll(/data-template-name\s*=\s*["']([^"']+)["']/g));
        templateNameMatches.length.should.be.aboveOrEqual(1, 'src/node.html must define a data-template-name');
        templateNameMatches.forEach((m) => m[1].should.equal(nodeTypeFromPackage));

        const helpNameMatches = Array.from(editorSource.matchAll(/data-help-name\s*=\s*["']([^"']+)["']/g));
        helpNameMatches.forEach((m) => m[1].should.equal(nodeTypeFromPackage));

        const i18nMatches = Array.from(editorSource.matchAll(/data-i18n\s*=\s*["']([^"']+)["']/g));
        i18nMatches
            .map((m) => m[1])
            .filter((value) => !value.includes('node-red:'))
            .map((value) => value.replace(/^\[[^\]]+\]/, '').trim())
            .filter(Boolean)
            .forEach((key) => key.startsWith(nodeTypeFromPackage + '.').should.equal(true));
    });
});
