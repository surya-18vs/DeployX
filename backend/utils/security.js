const { shannonEntropy, maskSecret } = require("./entropy");

// Known-provider secret patterns. Each gets a fixed severity — these are
// unambiguous, so false-positive risk is low and severity can be "critical"/"high".
const KNOWN_PATTERNS = [
  { type: "AWS access key ID", regex: /AKIA[0-9A-Z]{16}/g, severity: "critical" },
  { type: "AWS secret access key", regex: /(?:aws.{0,20})?secret.{0,3}(?:access)?.{0,3}key.{0,3}[:=]\s*['"]([0-9a-zA-Z/+]{40})['"]/gi, severity: "critical" },
  { type: "private key block", regex: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g, severity: "critical" },
  { type: "Stripe live key", regex: /(?:sk|pk)_live_[0-9a-zA-Z]{24,}/g, severity: "critical" },
  { type: "GitHub token", regex: /gh[pousr]_[A-Za-z0-9]{36,255}/g, severity: "high" },
  { type: "Slack token", regex: /xox[baprs]-[0-9A-Za-z-]{10,72}/g, severity: "high" },
  { type: "Google API key", regex: /AIza[0-9A-Za-z\-_]{35}/g, severity: "high" },
  { type: "JWT", regex: /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, severity: "medium" },
];

// Generic KEY = "value" assignments, checked further with entropy to cut noise.
const GENERIC_ASSIGNMENT = /\b([A-Z][A-Z0-9_]{2,40}(?:_KEY|_SECRET|_TOKEN|_PASSWORD|API_KEY))\s*[:=]\s*['"]([^'"]{8,200})['"]/g;

const ENTROPY_THRESHOLD = 4.0;
const MIN_ENTROPY_CANDIDATE_LEN = 20;

// Paths we scan but treat as expected-to-contain-secrets (still flagged,
// just labeled so the UI can explain *why* rather than alarm the user).
function isEnvFile(path) {
  const name = path.split("/").pop();
  return name === ".env" || /^\.env\.[^.]+$/.test(name);
}

function scanFileContent(path, content) {
  const findings = [];
  const lines = content.split("\n");

  lines.forEach((line, idx) => {
    for (const pattern of KNOWN_PATTERNS) {
      pattern.regex.lastIndex = 0;
      let match;
      while ((match = pattern.regex.exec(line)) !== null) {
        findings.push({
          file: path,
          line: idx + 1,
          type: pattern.type,
          severity: pattern.severity,
          match: maskSecret(match[1] || match[0]),
          expected: isEnvFile(path),
        });
      }
    }

    GENERIC_ASSIGNMENT.lastIndex = 0;
    let genMatch;
    while ((genMatch = GENERIC_ASSIGNMENT.exec(line)) !== null) {
      const value = genMatch[2];
      if (value.length >= MIN_ENTROPY_CANDIDATE_LEN && shannonEntropy(value) >= ENTROPY_THRESHOLD) {
        findings.push({
          file: path,
          line: idx + 1,
          type: `high-entropy value assigned to ${genMatch[1]}`,
          severity: isEnvFile(path) ? "low" : "medium",
          match: maskSecret(value),
          expected: isEnvFile(path),
        });
      }
    }
  });

  return findings;
}

// files: [{ path, content, isBinary }] — already decoded to utf8 text where relevant
function scanSecrets(files) {
  const findings = [];
  for (const f of files) {
    if (f.isBinary || f.skippedDir) continue;
    findings.push(...scanFileContent(f.path, f.content));
  }

  // Only *unexpected* critical/high findings (i.e. not inside a .env file,
  // which is allowed to hold real secrets locally) should block a deploy.
  const blocking = findings.filter(
    (f) => !f.expected && (f.severity === "critical" || f.severity === "high")
  );

  return {
    findings,
    blocking,
    hasBlockingIssues: blocking.length > 0,
  };
}

module.exports = { scanSecrets, isEnvFile };