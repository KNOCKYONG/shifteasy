#!/usr/bin/env python3
"""
Auto-answer drizzle-kit push prompts
"""

import subprocess
import sys
import time

def run_drizzle_push():
    """Run drizzle-kit push and auto-answer prompts"""
    
    process = subprocess.Popen(
        ['npx', 'drizzle-kit', 'push'],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        bufsize=0
    )
    
    output = []
    
    try:
        # Read output and look for prompts
        while True:
            # Read stdout
            line = process.stdout.readline()
            if line:
                print(line, end='')
                output.append(line)
                
                # Check for the prompt about shift_id
                if 'shift_id column' in line or 'create column' in line:
                    time.sleep(0.5)
                    # Send Enter to select first option (create column)
                    process.stdin.write('\n')
                    process.stdin.flush()
                    print("Auto-selected: create column")
            
            # Check if process has ended
            if process.poll() is not None:
                break
                
            time.sleep(0.1)
        
        # Get remaining output
        remaining_stdout, remaining_stderr = process.communicate()
        if remaining_stdout:
            print(remaining_stdout)
            output.append(remaining_stdout)
        if remaining_stderr:
            print(remaining_stderr, file=sys.stderr)
            
        return process.returncode
        
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        process.terminate()
        return 1

if __name__ == "__main__":
    exit_code = run_drizzle_push()
    sys.exit(exit_code)