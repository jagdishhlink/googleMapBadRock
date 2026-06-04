export function createGeneratedFile(path, content, language = 'javascript') {
  return { path, content, language };
}

export function createProjectFiles(files = [], dependencies = {}, devDependencies = {}) {
  return { files, dependencies, devDependencies };
}

export function createVerificationIssue(filePath, line, message, severity = 'error', suggestion = '') {
  return { filePath, line, message, severity, suggestion };
}

export function createVerificationResult(isValid, issues = [], buildOutput = '') {
  return { isValid, issues, buildOutput };
}
