const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class RTXCliBridge {
  constructor() {
    const registryPath = path.join(__dirname, '../config/cli-registry.json');
    this.registry = JSON.parse(fs.readFileSync(registryPath, 'utf-8'));
  }

  async dispatch(cliName, command, args = {}) {
    const cli = this.registry[cliName];
    if (!cli) throw new Error(`Unknown CLI: ${cliName}`);
    
    const fullCmd = `${cli.cmd} ${command}`;
    return new Promise((resolve, reject) => {
      // Use standard shell on Windows (pwsh/cmd) or bash on Linux/Mac
      const shell = process.platform === 'win32' ? 'pwsh.exe' : 'bash';
      const shellArgs = process.platform === 'win32' ? ['-Command', fullCmd] : ['-c', fullCmd];
      
      const proc = spawn(shell, shellArgs);
      let stdout = '', stderr = '';
      
      proc.stdout.on('data', d => stdout += d.toString());
      proc.stderr.on('data', d => stderr += d.toString());
      proc.on('close', code => {
        resolve({ success: code === 0, output: stdout, error: stderr });
      });
    });
  }

  // Health check — kaunse CLIs installed hain
  async healthCheck() {
    const status = {};
    const checkCommand = process.platform === 'win32' ? 'where' : 'which';
    
    for (const [name, cfg] of Object.entries(this.registry)) {
      try {
        const binName = cfg.cmd.split(' ')[0];
        execSync(`${checkCommand} ${binName}`, { stdio: 'ignore' });
        status[name] = '✅ available';
      } catch {
        status[name] = '❌ not installed';
      }
    }
    return status;
  }
}

module.exports = RTXCliBridge;
