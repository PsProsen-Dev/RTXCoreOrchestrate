import subprocess
import shlex
import os
import json
from pathlib import Path

# =========================================================================
# RTX 2.0 (Fugu-Style) Local Conductor Prototype
# This script acts as the "TRINITY + Conductor" layer, orchestrating 
# other CLIs via background terminal commands and temp files.
# =========================================================================

class CLI_Swarm_Conductor:
    def __init__(self):
        # 1. CLI Registry (Role Mapping)
        self.registry = {
            "thinker": "claude",
            "worker_codegen": "gh copilot suggest",
            "worker_backup": "gemini"
        }
        self.temp_dir = Path("./fugu_scratchpads")
        self.temp_dir.mkdir(exist_ok=True)
        self.state_file = self.temp_dir / ".rtx_orchestration_state.json"

    def update_state(self, key: str, value: str) -> str:
        """Writes metadata to state JSON (State File Cleanliness)."""
        state = {}
        if self.state_file.exists():
            with open(self.state_file, "r", encoding="utf-8") as f:
                state = json.load(f)
        state[key] = value
        with open(self.state_file, "w", encoding="utf-8") as f:
            json.dump(state, f, indent=4)
        return str(self.state_file)
    
    def run_cli_silent(self, argv: list, role_name: str) -> str:
        """Executes a CLI silently in the background (YOLO Mode).

        P0 security fix: `argv` is a LIST, passed to subprocess with
        shell=False — no shell parsing, so metacharacters in prompts or
        goals cannot become shell syntax. Never pass a single string here
        (that was the old shell=True injection surface).
        """
        print(f"[Conductor] Routing to {role_name.upper()}...")
        print(f"   > Internal Command: `{' '.join(argv)}`")
        try:
            result = subprocess.run(
                argv,
                shell=False,
                capture_output=True,
                text=True,
                check=True
            )
            return result.stdout.strip()
        except subprocess.CalledProcessError as e:
            print(f"[ERROR] {role_name} CLI failed: {e.stderr}")
            return None

    def execute_goal(self, user_goal: str):
        print(f"Goal Registered: {user_goal}\n")
        
        # -------------------------------------------------------------
        # STEP 1: THINKER (Decompose & Plan)
        # -------------------------------------------------------------
        print("1. Waking up THINKER Agent...")
        # Update state JSON with the user goal
        state_path = self.update_state("current_goal", user_goal)
        
        # Build headless command for Thinker (Claude CLI)
        thinker_cli = self.registry["thinker"]
        # Mocking the actual cli call for the prototype
        # Mock headless call (prototype): argv list, never a shell string.
        # In reality: shlex.split(f"{thinker_cli} -p <prompt>") as the argv list.
        thinker_cmd = ["echo", "Plan: 1. Fetch data 2. Process data 3. Return JSON"]

        plan_output = self.run_cli_silent(thinker_cmd, "thinker")
        print(f"   [Thinker Output] -> {plan_output}\n")

        # -------------------------------------------------------------
        # STEP 2: WORKER (Code Generation)
        # -------------------------------------------------------------
        print("2. Waking up WORKER Agent...")
        # Update state JSON with the new plan
        state_path = self.update_state("current_plan", plan_output)
        
        worker_cli = self.registry["worker_codegen"]
        # Mocking gh copilot suggest
        # Mock headless call (prototype): argv list, never a shell string.
        # In reality: shlex.split(f"{worker_cli} <args>") as the argv list.
        worker_cmd = ["echo", "def process_data():\n    pass"]

        code_output = self.run_cli_silent(worker_cmd, "worker_codegen")
        
        # -------------------------------------------------------------
        # STEP 3: FALLBACK LOGIC
        # -------------------------------------------------------------
        if not code_output:
            print("Worker failed! Activating Backup Worker...")
            backup_cli = self.registry["worker_backup"]
            backup_cmd = ["echo", "def process_data_backup():\n    pass"]
            code_output = self.run_cli_silent(backup_cmd, "worker_backup")

        print(f"   [Worker Output] -> \n{code_output}\n")

        # -------------------------------------------------------------
        # STEP 4: SYNTHESIS
        # -------------------------------------------------------------
        print("[Conductor Synthesis] Task Complete. All agents successfully coordinated via Terminal.")

if __name__ == "__main__":
    conductor = CLI_Swarm_Conductor()
    conductor.execute_goal("Build a Python data processing script.")
