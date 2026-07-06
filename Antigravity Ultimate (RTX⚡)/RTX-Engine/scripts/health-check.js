/**
 * RTX Health Check — CLI Binary Availability Scanner
 *
 * Team Discussion Final Decision:
 * - Antigravity 2.0 (RTX⚡): health-check ALAG file (SRP — not in rtx-safety.js)
 * - Antigravity IDE (RTX⚡): Coordinator confirms — graceful fallback to mock mode
 * - Ultron (RTX⚡):          Version output captures for compatibility verification
 *
 * RTXCoreFramework Section 8.10 — Safety & Health Check Layer
 *
 * Usage: node scripts/health-check.js
 * Programmatic: const { checkAll } = require('./health-check'); await checkAll();
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ─── CLI Registry to Check ────────────────────────────────────────────────────

const CLI_REGISTRY = [
  {
    id:      'claude_code',
    cmd:     'claude',
    versionFlag: '--version',
    description: 'Anthropic Claude CLI — required for <role_thinker> tasks',
    required: false,
  },
  {
    id:      'gh_cli',
    cmd:     'gh',
    versionFlag: '--version',
    description: 'GitHub CLI — required for repo/PR/deploy tasks',
    required: false,
  },
  {
    id:      'copilot_cli',
    cmd:     'github-copilot-cli',
    versionFlag: '--version',
    description: 'GitHub Copilot CLI — required for <role_worker> code generation',
    required: false,
  },
  {
    id:      'node',
    cmd:     'node',
    versionFlag: '--version',
    description: 'Node.js runtime — REQUIRED for RTX-Engine',
    required: true,
  },
  {
    id:      'git',
    cmd:     'git',
    versionFlag: '--version',
    description: 'Git — required for repository operations',
    required: false,
  },
];

// ─── Single CLI Check ─────────────────────────────────────────────────────────

function checkCLI(entry) {
  try {
    const output = execSync(`${entry.cmd} ${entry.versionFlag} 2>&1`, {
      encoding: 'utf8',
      timeout: 5000,
      shell: process.platform === 'win32' ? 'powershell.exe' : false,
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();

    const version = output.split('\n')[0].trim();
    return { available: true, version, error: null };
  } catch (err) {
    return {
      available: false,
      version:   null,
      error:     err.code === 'ENOENT' ? 'Binary not found on PATH' : err.message,
    };
  }
}

// ─── Full Health Check ────────────────────────────────────────────────────────

async function checkAll(silent = false) {
  if (!silent) {
    console.log('\n🔍 [RTX-HealthCheck] Scanning CLI binary availability...\n');
    console.log('─'.repeat(60));
  }

  const results = {};
  let allRequiredAvailable = true;

  for (const entry of CLI_REGISTRY) {
    const result = checkCLI(entry);
    results[entry.id] = {
      ...result,
      cmd:         entry.cmd,
      description: entry.description,
      required:    entry.required,
      mockMode:    !result.available,
    };

    if (!silent) {
      const icon   = result.available ? '✅' : (entry.required ? '❌' : '⚠️ ');
      const status = result.available
        ? result.version
        : `NOT FOUND${entry.required ? ' (REQUIRED!)' : ' → mock mode'}`;
      console.log(`  ${icon}  [${entry.id.padEnd(14)}] ${entry.cmd.padEnd(24)} ${status}`);
    }

    if (entry.required && !result.available) {
      allRequiredAvailable = false;
    }
  }

  if (!silent) {
    console.log('─'.repeat(60));
    if (allRequiredAvailable) {
      console.log('\n✅ [RTX-HealthCheck] All REQUIRED binaries present. Engine is go! 🚀');
    } else {
      console.log('\n❌ [RTX-HealthCheck] Missing REQUIRED binaries. RTX-Engine cannot start.');
    }

    const mockCLIs = Object.entries(results)
      .filter(([, r]) => !r.available && !r.required)
      .map(([id]) => id);

    if (mockCLIs.length > 0) {
      console.log(`\n🧪 [RTX-HealthCheck] Mock mode CLIs: [${mockCLIs.join(', ')}]`);
      console.log(`   Install them to enable live execution.`);
    }
    console.log('');
  }

  const reportPath = path.join(__dirname, 'health-report.json');
  fs.writeFileSync(reportPath, JSON.stringify({ checkedAt: new Date().toISOString(), results }, null, 2));

  return { allRequiredAvailable, results };
}

function isAvailable(toolId) {
  const reportPath = path.join(__dirname, 'health-report.json');

  if (fs.existsSync(reportPath)) {
    try {
      const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
      const ageMs  = Date.now() - new Date(report.checkedAt).getTime();
      if (ageMs < 60000 && report.results[toolId]) {
        return report.results[toolId].available;
      }
    } catch (_) { /* fall through */ }
  }

  const entry = CLI_REGISTRY.find(e => e.id === toolId);
  if (!entry) return false;
  return checkCLI(entry).available;
}

if (require.main === module) {
  checkAll(false).then(({ allRequiredAvailable }) => {
    process.exit(allRequiredAvailable ? 0 : 1);
  });
}

module.exports = { checkAll, checkCLI, isAvailable, CLI_REGISTRY };
