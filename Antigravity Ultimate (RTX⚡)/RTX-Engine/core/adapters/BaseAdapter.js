const { spawn } = require('child_process');

class BaseAdapter {
  constructor(id, config) {
    this.id = id;
    this.cmd = config.cmd;
    this.capabilities = config.capabilities;
  }

  async run(input, ctx) {
    // Override this in specific adapters
    const args = this.buildArgs(input);
    return new Promise((resolve, reject) => {
      const p = spawn(this.cmd, args, { cwd: ctx.workspace, env: process.env });
      let out = '', err = '';
      
      p.stdout.on('data', d => out += d.toString());
      p.stderr.on('data', d => err += d.toString());
      
      p.on('close', code => {
        resolve({ code, out, err });
      });
      p.on('error', error => {
        reject({ code: -1, out, err: error.message });
      });
    });
  }
  
  buildArgs(input) {
    // Default fallback
    return [input.action];
  }
}

module.exports = BaseAdapter;
