const BaseAdapter = require('./BaseAdapter');

class ClaudeAdapter extends BaseAdapter {
  buildArgs(input) {
    // Exact command: claude -p "prompt here" --output-format json
    return ['-p', input.details || input.action, '--output-format', 'json'];
  }
}

module.exports = ClaudeAdapter;
