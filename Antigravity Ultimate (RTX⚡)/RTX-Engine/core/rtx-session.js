class RTXSession {
  constructor(sessionId) {
    this.id = sessionId;
    this.history = [];        // CLI call history
    this.cliOutputs = {};     // per-CLI raw results (hidden from user)
    this.synthesized = [];    // clean user-facing results
    this.activeSpecialists = new Set();
  }

  log(cliName, input, output) {
    this.history.push({ cli: cliName, input, output, ts: Date.now() });
    this.cliOutputs[cliName] = output;
  }
}

module.exports = RTXSession;
