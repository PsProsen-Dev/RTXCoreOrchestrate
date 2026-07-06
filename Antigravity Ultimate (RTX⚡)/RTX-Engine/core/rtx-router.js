const ROUTING_MAP = {
  // Pattern → preferred CLI
  'git|repo|pr|issue|release|branch': 'gh_cli',
  'review|explain|refactor|debug':    'copilot_cli',
  'image|vision|creative|design':     'gemini-cli',
  'generate|scaffold|boilerplate':    'claude_code',
  'translate|math|chinese':           'claude_code',
  'search|web|research':              'gemini-cli',
};

function routeTask(taskDescription, mode = 'ULTRA') {
  const desc = taskDescription.toLowerCase();
  
  // In ULTRA mode, we prioritize high-tier agents
  if (mode === 'ULTRA') {
    if (desc.includes('code') || desc.includes('scaffold') || desc.includes('backend') || desc.includes('auth')) {
      return 'claude_code';
    }
  }
  
  for (const [pattern, cli] of Object.entries(ROUTING_MAP)) {
    if (new RegExp(pattern).test(desc)) return cli;
  }
  
  return mode === 'ULTRA' ? 'claude_code' : 'copilot_cli'; // default fallback CLI based on mode
}

module.exports = { routeTask, ROUTING_MAP };
