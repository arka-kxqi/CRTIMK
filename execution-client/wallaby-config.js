module.exports = function () {
    return {
        testFramework: 'ava',
        files: [
            '**/*.ts',
            '!tests/**/*.ts',
        ],
        tests: ['tests/**/*.ts'],
        debug: true,
        trace: true,
        env: {
            type: 'node',
        },

    };
};