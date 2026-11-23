const path = require('node:path');

function dataPath(filename) {
    const directory = process.env.CSJ_DATA_DIR;
    if (directory && !path.isAbsolute(directory)) {
        throw new Error('CSJ_DATA_DIR deve ser um caminho absoluto.');
    }
    return path.join(/* turbopackIgnore: true */ directory || process.cwd(), filename);
}

module.exports = { dataPath };
