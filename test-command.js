// Quick test to check if init command works
const { SlashCommandRegistry } = require('./dist/console/commands');

async function testInitCommand() {
  try {
    const registry = new SlashCommandRegistry();
    
    console.log('Available commands:', registry.getAvailableCommands());
    console.log('Has init command:', registry.has('init'));
    
    // Test session object (mimicking the session structure)
    const mockSession = {
      workspace: null,
      client: null,
      history: [],
      startTime: new Date()
    };
    
    console.log('Testing init command...');
    
    // This should work now with the bound method
    await registry.execute('init', [], mockSession);
    
  } catch (error) {
    console.error('Error testing init command:', error.message);
  }
}

testInitCommand();