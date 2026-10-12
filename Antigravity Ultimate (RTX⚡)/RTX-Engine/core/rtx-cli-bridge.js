const { spawn, execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class RTXCliBridge {
  constructor() {
    const registryPath = path.join(__dirname, '../config/cli-registry.json');
    this.registry = JSON.parse(fs.readFileSync(registryPath, 'utf-8'));
  }

  /**
   * Dispatches a command to a registered CLI — argv-safe, no shell involved.
   *
   * P0 security fix: previously this built `bash -c "${cmd} ${command}"` via
   * string concatenation (command-injection surface). Now the binary and every
   * argument are passed as argv elements with `shell: false`, so no shell
   * parsing, globbing, or metacharacter expansion can occur.
   *
   * @param {string} cliName - registry key (e.g. 'claude_code', 'gh_cli')
   * @param {string} command - single sub-command token (whitespace-split if multi-word)
   * @param {string[]} extraArgs - additional argv elements (already split, never joined)
   */
  async dispatch(cliName, command, extraArgs = []) {
    const cli = this.registry[cliName];
    if (!cli) throw new Error(`Unknown CLI: ${cliName}`);

    // Split the registry cmd itself (e.g. "gh copilot" → bin "gh", base ["copilot"])
    // — registry is repo-controlled config; user input never lands in `bin`.
    const [bin, ...baseArgs] = String(cli.cmd).split(/\s+/).filter(Boolean);
    const cmdArgs = String(command).split(/\s+/).filter(Boolean);
    const argv = [...baseArgs, ...cmdArgs, ...(Array.isArray(extraArgs) ? extraArgs : [])];

    return new Promise((resolve, reject) => {
      // shell: false — no shell parsing; argv passed directly to the binary.
      const proc = spawn(bin, argv, { shell: false });
      let stdout = '', stderr = '';

      proc.stdout.on('data', d => stdout += d.toString());
      proc.stderr.on('data', d => stderr += d.toString());
      proc.on('close', code => {
        resolve({ success: code === 0, output: stdout, error: stderr });
      });
      proc.on('error', err => reject(err));
    });
  }

  // Health check — kaunse CLIs installed hain
  // P0 security fix: argv-array lookup instead of `${checkCommand} ${binName}` string.
  async healthCheck() {
    const status = {};
    const checkCommand = process.platform === 'win32' ? 'where' : 'which';

    for (const [name, cfg] of Object.entries(this.registry)) {
      try {
        const binName = String(cfg.cmd).split(/\s+/)[0];
        execFileSync(checkCommand, [binName], { stdio: 'ignore' });
        status[name] = '✅ available';
      } catch {
        status[name] = '❌ not installed';
      }
    }
    return status;
  }
}

module.exports = RTXCliBridge;
