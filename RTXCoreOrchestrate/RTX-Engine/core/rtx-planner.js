const { routeTask } = require('./rtx-router');

class RTXPlanner {
  async plan(taskDescription, registry, mode = 'ULTRA') {
    console.log(`\n🧠 [RTX-Planner] Analyzing goal: "${taskDescription}"`);
    console.log(`🧠 [RTX-Planner] Running Adaptive Agentic Scaffolding (AAS) in [${mode}] mode...`);
    
    const steps = [];
    const desc = taskDescription.toLowerCase();
    
    if (desc.includes('repo') || desc.includes('git') || desc.includes('github')) {
      steps.push({
        step: steps.length + 1,
        tool: routeTask('create git repository', mode),
        action: 'create_repo',
        details: 'Initialize local repository and synchronize with remote origin.'
      });
    }
    
    if (desc.includes('code') || desc.includes('backend') || desc.includes('script') || desc.includes('app')) {
      steps.push({
        step: steps.length + 1,
        tool: routeTask('scaffold codebase', mode),
        action: 'scaffold_codebase',
        details: 'Generate primary source directories and boilerplate dependencies.',
        requires_mcts: true
      });
    }
    
    if (desc.includes('auth') || desc.includes('login')) {
      steps.push({
        step: steps.length + 1,
        tool: routeTask('add auth login middleware', mode),
        action: 'inject_authentication',
        details: 'Configure secure token management and user authentication middlewares.'
      });
    }
    
    // In ULTRA mode, automatically inject specialized Verifier / Safety steps
    if (mode === 'ULTRA') {
      steps.push({
        step: steps.length + 1,
        tool: 'copilot_cli',
        action: 'run_verification_tests',
        details: 'Fugu-Ultra Verifier: Execute unit tests, lint checkers, and validation sweeps.'
      });
      steps.push({
        step: steps.length + 1,
        tool: 'claude_code',
        action: 'security_audit',
        details: 'Fugu-Ultra Verifier: Run static analysis check for credential leaks and code vulnerability vulnerabilities.'
      });
    }

    if (desc.includes('deploy') || desc.includes('publish')) {
      steps.push({
        step: steps.length + 1,
        tool: routeTask('deploy prod', mode),
        action: 'production_deploy',
        details: 'Deploy finalized workspace to hosting environments (e.g. Vercel, Netlify).'
      });
    }
    
    return { plan: steps };
  }
}

module.exports = RTXPlanner;
