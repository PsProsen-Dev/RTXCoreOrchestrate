const fs = require('fs');
const path = require('path');

class RTXFileManager {
  constructor(sessionId) {
    this.baseDir = path.join(__dirname, '../workspaces');
    this.workspace = path.join(this.baseDir, sessionId);
    
    if (!fs.existsSync(this.baseDir)) fs.mkdirSync(this.baseDir);
    if (!fs.existsSync(this.workspace)) fs.mkdirSync(this.workspace);
  }

  getWorkspacePath() {
    return this.workspace;
  }
  
  registerArtifact(filename, content) {
    const fullPath = path.join(this.workspace, filename);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    
    fs.writeFileSync(fullPath, content);
    console.log(`[📁 RTX-File] Created artifact: @[${filename}]`);
    return `@[${filename}]`;
  }
}

module.exports = RTXFileManager;
