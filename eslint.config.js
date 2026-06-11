import pluginNode from 'eslint-plugin-n';

export default [
    {
        files: ['**/*.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: {
                console: 'readonly',
                process: 'readonly',
                Buffer: 'readonly',
                __dirname: 'readonly',
                __filename: 'readonly',
                global: 'readonly',
                module: 'readonly',
                require: 'readonly',
                exports: 'readonly',
            },
        },
        plugins: {
            n: pluginNode,
        },
        rules: {
            'n/no-missing-import': 'off',
            'n/no-unpublished-import': 'off',
            'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
            'no-console': 'off',
        },
    },
    {
        ignores: ['node_modules/', 'dist/', 'coverage/', '.seo/', '*.md'],
    },
];