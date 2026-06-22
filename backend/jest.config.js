const isFocusedEnvConfigRun = process.argv.some(arg =>
  arg.replace(/\\/g, '/').includes('src/config/env.test.js')
);
const isFocusedLecturerBenchmarkValidationRun = process.argv.some(arg =>
  arg.replace(/\\/g, '/').includes('src/services/lecturerBenchmarkValidation.service.test.js')
);

module.exports = {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  collectCoverageFrom: isFocusedEnvConfigRun
    ? ['src/config/env.js']
    : (isFocusedLecturerBenchmarkValidationRun
        ? ['src/services/lecturerBenchmarkValidation.service.js']
        : [
            'src/**/*.js',
            '!src/**/*.test.js',
            '!src/server.js', // Exclude server entry point from coverage
            '!src/config/env.js', // Exclude env config from coverage
          ]),
  testMatch: [
    '**/__tests__/**/*.js',
    '**/?(*.)+(spec|test).js'
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },
  testTimeout: 10000,
  verbose: true,
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js']
};
