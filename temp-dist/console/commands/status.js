"use strict";
/**
 * Status Command
 * Shows project and server status information
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.StatusCommand = void 0;
const api_1 = require("../../api");
class StatusCommand {
    async execute(args, session) {
        console.log('📊 Project Status\n');
        // Show workspace status
        if (session.workspace) {
            console.log('📁 Workspace Information:');
            console.log(`   Project: ${session.workspace.name}`);
            console.log(`   Location: ${session.workspace.rootPath}`);
            console.log(`   Config: ${session.workspace.configPath}`);
            console.log(`   Database: ${session.workspace.databasePath}`);
            // Show server configuration
            console.log('\n🖥️  Server Configuration:');
            console.log(`   Host: ${session.workspace.config.host}:${session.workspace.config.port}`);
            console.log(`   Username: ${session.workspace.config.username}`);
            console.log(`   Node: ${session.workspace.config.node}`);
            console.log(`   SSL Verification: ${session.workspace.config.rejectUnauthorized ? 'Enabled' : 'Disabled'}`);
            // Test server connectivity
            console.log('\n🔌 Server Connectivity:');
            try {
                const client = new api_1.ProxmoxClient(session.workspace.config);
                const result = await client.connect();
                if (result.success) {
                    console.log('   Status: ✅ Connected');
                    console.log(`   Version: ${result.version}`);
                    console.log(`   Endpoint: ${result.details?.endpoint}`);
                    console.log(`   Nodes: ${result.details?.nodes}`);
                    // Cache client for future use
                    session.client = client;
                }
                else {
                    console.log('   Status: ❌ Connection failed');
                    console.log(`   Error: ${result.error}`);
                }
            }
            catch (error) {
                console.log('   Status: ❌ Connection error');
                console.log(`   Error: ${error instanceof Error ? error.message : String(error)}`);
            }
            // Show infrastructure overview (if connected)
            if (session.client) {
                await this.showInfrastructureOverview(session.client, session.workspace.config.node);
            }
        }
        else {
            console.log('❌ No workspace detected');
            console.log('   Current directory is not a Proxmox project');
            console.log('\n💡 Use /init to create a new workspace');
            console.log('   or navigate to an existing project directory');
        }
        // Show session information
        console.log('\n⏱️  Session Information:');
        console.log(`   Started: ${session.startTime.toLocaleString()}`);
        console.log(`   Commands executed: ${session.history.length}`);
        console.log(`   Uptime: ${this.formatDuration(Date.now() - session.startTime.getTime())}`);
        console.log('');
    }
    async showInfrastructureOverview(client, defaultNode) {
        console.log('\n🏗️  Infrastructure Overview:');
        try {
            // Get nodes
            const nodes = await client.getNodes();
            console.log(`   Nodes: ${nodes.length} total`);
            // Get VMs and containers from all nodes
            let totalVMs = 0;
            let totalContainers = 0;
            let runningVMs = 0;
            let runningContainers = 0;
            for (const node of nodes) {
                try {
                    const [vms, containers] = await Promise.all([
                        client.getVMs(node.node),
                        client.getContainers(node.node)
                    ]);
                    totalVMs += vms.length;
                    totalContainers += containers.length;
                    runningVMs += vms.filter(vm => vm.status === 'running').length;
                    runningContainers += containers.filter(c => c.status === 'running').length;
                }
                catch (error) {
                    console.log(`   ⚠️  Failed to get resources from node ${node.node}`);
                }
            }
            console.log(`   VMs: ${totalVMs} total (${runningVMs} running)`);
            console.log(`   Containers: ${totalContainers} total (${runningContainers} running)`);
            // Show storage information
            try {
                const storage = await client.getStoragePools();
                console.log(`   Storage Pools: ${storage.length} total`);
            }
            catch (error) {
                console.log('   Storage Pools: Unable to retrieve');
            }
        }
        catch (error) {
            console.log('   Unable to retrieve infrastructure information');
        }
    }
    formatDuration(milliseconds) {
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        if (hours > 0) {
            return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
        }
        else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        }
        else {
            return `${seconds}s`;
        }
    }
}
exports.StatusCommand = StatusCommand;
