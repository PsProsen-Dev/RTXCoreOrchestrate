const BaseAdapter = require('./BaseAdapter');

class ClaudeAdapter extends BaseAdapter {
  buildArgs(input) {
    // claude --prompt "details"
    return ['--prompt', input.details || input.action];
  }
}

module.exports = ClaudeAdapter;
