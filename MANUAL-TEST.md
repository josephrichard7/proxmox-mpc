# Manual Testing Guide for Interactive Input

## Testing the Fixed Interactive Input

The double character echo issue in the `/init` command has been fixed. Here's how to test it:

### Test 1: Basic Console Startup
```bash
cd /any/directory
proxmox-mpc
```

**Expected**: Console starts with welcome message and `proxmox-mpc>` prompt.

### Test 2: Interactive /init Command
```bash
proxmox-mpc> /init
```

**Expected**: 
- Prompts for server details one by one
- No character duplication when typing
- Password input shows asterisks (`*`) instead of actual characters
- Creates `.proxmox/` directory with config and database

### Test 3: Input Validation
Try these inputs during `/init`:
- Empty inputs (should use defaults)
- Inputs with spaces (should be trimmed)
- Special characters in passwords
- Ctrl+C to cancel (should exit gracefully)

### Test 4: Configuration Result
After `/init` completes, check:
```bash
cat .proxmox/config.yml
ls -la .proxmox/
```

**Expected**: 
- Valid YAML configuration with your inputs
- SQLite database file created
- Proper directory structure

## What Was Fixed

1. **Readline Interface Conflict**: The main console and init command were competing for stdin. Fixed by sharing the same readline interface through the session object.

2. **Character Echo Issues**: Password input now properly uses raw mode to prevent character duplication while still allowing backspace and proper termination.

3. **Input Handling**: All prompts now use the same readline interface, preventing conflicts and ensuring consistent behavior.

## Architecture Changes

- `ConsoleSession` now includes `rl: readline.Interface` property
- `InitCommand` uses the session's readline interface instead of creating its own
- Password input properly manages raw mode and input echoing
- All interactive prompts share the same event loop

The interactive experience should now be smooth and professional, similar to other CLI tools.