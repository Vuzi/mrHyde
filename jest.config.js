module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  modulePathIgnorePatterns: ['dist'],
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testMatch: ['**/*.test.ts'],
  moduleNameMapper: {
    "^@root/(.*)$": "<rootDir>/src/$1"
  }
}
