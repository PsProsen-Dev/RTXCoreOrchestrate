const RTXCliBridge = require('../core/rtx-cli-bridge');

async function runHealthCheck() {
  console.log("🔍 Running RTX-Engine CLI Health Check...");
  const bridge = new RTXCliBridge();
  const status = await bridge.healthCheck();
  
  console.log("\n📊 Health Report:");
  for (const [cli, result] of Object.entries(status)) {
    console.log(`  - [${cli.toUpperCase()}]: ${result}`);
  }
}

if (require.main === module) {
  runHealthCheck();
}

module.exports = runHealthCheck;
