const fs = require('fs');
const path = require('path');
const {
  validateLecturerBenchmark
} = require('../src/services/lecturerBenchmarkValidation.service');

function resolveInputPath(inputPath) {
  if (!inputPath) {
    return null;
  }

  return path.isAbsolute(inputPath)
    ? inputPath
    : path.join(__dirname, '..', inputPath);
}

function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function main(argv = process.argv.slice(2)) {
  const inputPath = argv[0];
  if (!inputPath) {
    console.error('Usage: npm run validate:lecturer-benchmark -- <benchmark-json-path>');
    process.exitCode = 1;
    return null;
  }

  const resolvedPath = resolveInputPath(inputPath);
  if (!fs.existsSync(resolvedPath)) {
    console.error(`Benchmark file not found: ${inputPath}`);
    process.exitCode = 1;
    return null;
  }

  let benchmark;
  try {
    benchmark = readJsonFile(resolvedPath);
  } catch (error) {
    console.error(`Unable to read benchmark JSON: ${error.message}`);
    process.exitCode = 1;
    return null;
  }

  const result = validateLecturerBenchmark(benchmark);
  const output = {
    success: result.valid,
    file: path.relative(path.join(__dirname, '..'), resolvedPath).replace(/\\/g, '/'),
    summary: result.summary,
    errors: result.errors,
    privacyWarnings: result.privacyWarnings
  };

  console.log(JSON.stringify(output, null, 2));

  if (!result.valid) {
    process.exitCode = 1;
  }

  return result;
}

if (require.main === module) {
  main();
}

module.exports = {
  main,
  resolveInputPath
};
