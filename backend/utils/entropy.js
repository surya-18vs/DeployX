// Shannon entropy — used to flag high-randomness strings (likely secrets/keys)
// that don't match a known provider pattern.
function shannonEntropy(str) {
  if (!str || str.length === 0) return 0;
  const freq = {};
  for (const ch of str) freq[ch] = (freq[ch] || 0) + 1;
  const len = str.length;
  return Object.values(freq).reduce((sum, count) => {
    const p = count / len;
    return sum - p * Math.log2(p);
  }, 0);
}

// Masks a secret for safe display: keeps first 4 and last 2 chars.
function maskSecret(value) {
  if (!value) return "";
  if (value.length <= 8) return "*".repeat(value.length);
  return `${value.slice(0, 4)}${"*".repeat(Math.min(value.length - 6, 20))}${value.slice(-2)}`;
}

module.exports = { shannonEntropy, maskSecret };