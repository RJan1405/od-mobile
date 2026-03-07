module.exports = {
    presets: ['module:@react-native/babel-preset'],
    plugins: [
        [
            'module-resolver',
            {
                root: ['./src'],
                extensions: ['.ios.js', '.android.js', '.js', '.ts', '.tsx', '.json'],
                alias: {
                    '@': './src',
                    '@components': './src/components',
                    '@screens': './src/screens',
                    '@services': './src/services',
                    '@utils': './src/utils',
                    '@hooks': './src/hooks',
                    '@stores': './src/stores',
                    '@types': './src/types',
                    '@assets': './src/assets',
                },
            },
        ],
    ],
};
