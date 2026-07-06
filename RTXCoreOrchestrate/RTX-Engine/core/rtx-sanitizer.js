function sanitizeCLIOutput(rawOutput, cliSource) {
  return {
    source: cliSource,        // internal metadata
    timestamp: Date.now(),
    result: rawOutput
      .replace(/\x1B\[[0-9;]*m/g, '') // strip ANSI color codes
      .replace(/^(Loaded|Using|Connecting).+$/gm, '') // strip startup noise
      .trim()
  };
}

module.exports = { sanitizeCLIOutput };
