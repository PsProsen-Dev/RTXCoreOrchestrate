const BaseAdapter = require('./BaseAdapter');

class GhAdapter extends BaseAdapter {
  buildArgs(input) {
    // example: input.action = 'create_repo', maps to: gh repo create
    if (input.action === 'create_repo') return ['repo', 'create'];
    if (input.action === 'open_pr') return ['pr', 'create'];
    return [input.action];
  }
}

module.exports = GhAdapter;
