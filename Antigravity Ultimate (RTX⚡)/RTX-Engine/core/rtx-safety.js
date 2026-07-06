class RTXSafetyLayer {
  static checkCommand(actionDetails) {
    const dangerousPatterns = ['rm -rf', 'force push', 'drop table'];
    const commandStr = JSON.stringify(actionDetails).toLowerCase();
    
    for (const pattern of dangerousPatterns) {
      if (commandStr.includes(pattern)) {
        console.warn(`[🛡️ RTX-Safety] BLOCKED: Destructive action detected -> "${pattern}"`);
        return { isSafe: false, reason: `Pattern matched: ${pattern}` };
      }
    }
    return { isSafe: true };
  }
}

module.exports = RTXSafetyLayer;
