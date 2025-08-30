/**
 * Privacy Command
 * Privacy and data protection information
 */

import { AnonymizationEngine } from "../../anonymization";
import { ConsoleSession } from "../repl";

export class PrivacyCommand {
  private engine: AnonymizationEngine;

  constructor() {
    this.engine = AnonymizationEngine.getInstance();
  }

  async execute(args: string[], _session: ConsoleSession): Promise<void> {
    const options = this.parseArguments(args);

    if (options.showPseudonyms) {
      this.displayPseudonymInfo();
      return;
    }

    if (options.showRules) {
      this.displayRulesInfo();
      return;
    }

    if (options.showMappings) {
      this.displayMappings();
      return;
    }

    // Default: show privacy overview
    this.displayPrivacyOverview();
  }

  private parseArguments(args: string[]): {
    showPseudonyms: boolean;
    showRules: boolean;
    showMappings: boolean;
  } {
    const options = {
      showPseudonyms: false,
      showRules: false,
      showMappings: false,
    };

    for (const arg of args) {
      switch (arg) {
        case "--pseudonyms":
        case "-p":
          options.showPseudonyms = true;
          break;
        case "--rules":
        case "-r":
          options.showRules = true;
          break;
        case "--mappings":
        case "-m":
          options.showMappings = true;
          break;
      }
    }

    return options;
  }

  private displayPrivacyOverview(): void {
    console.log("🔒 Privacy & Data Protection Overview\n");

    console.log("📋 Data Anonymization System:");
    console.log(
      "   • Automatically detects and anonymizes PII (Personally Identifiable Information)",
    );
    console.log(
      "   • Uses consistent pseudonyms to maintain data relationships",
    );
    console.log(
      "   • Supports safe sharing of diagnostic data with AI assistants",
    );
    console.log(
      "   • Preserves data structure while protecting sensitive information",
    );
    console.log("");

    console.log("🔍 PII Types Detected & Anonymized:");
    console.log(
      "   • Email addresses (admin@example.com → user123@company.local)",
    );
    console.log("   • IP addresses (192.168.1.100 → 10.0.1.50)");
    console.log("   • Hostnames (server-01 → srv-a1b2c3)");
    console.log("   • UUIDs (123e4567-... → f47ac10b-...)");
    console.log("   • Usernames (admin → user456)");
    console.log("   • File paths (/home/user/... → /home/dir789/...)");
    console.log("   • Passwords & tokens ([REDACTED])");
    console.log("");

    console.log("🛡️ Security Features:");
    console.log(
      "   • Deterministic pseudonym generation (same input → same output)",
    );
    console.log("   • No reverse mapping possible (pseudonyms are one-way)");
    console.log("   • Salted hashing for additional security");
    console.log("   • Configurable anonymization rules");
    console.log("");

    console.log("📊 Current Session Statistics:");
    const stats = this.engine.getStats();
    console.log(`   • Operations Performed: ${stats.totalProcessed}`);
    console.log(`   • Pseudonyms Generated: ${stats.totalPseudonyms}`);
    console.log(
      `   • Average Processing Time: ${stats.averageProcessingTime.toFixed(2)}ms`,
    );
    console.log(
      `   • Success Rate: ${((1 - stats.errorRate) * 100).toFixed(1)}%`,
    );
    console.log("");

    console.log("🚀 Available Commands:");
    console.log(
      "   • /anonymize                    Interactive anonymization tool",
    );
    console.log(
      "   • /report-issue --safe          Generate safe diagnostic reports",
    );
    console.log("   • /privacy --pseudonyms         Show pseudonym examples");
    console.log("   • /privacy --rules              Show anonymization rules");
    console.log(
      "   • /privacy --mappings           Show current mappings (if any)",
    );
    console.log("");

    console.log("💡 Usage Tips:");
    console.log("   • Always use --safe flag when sharing diagnostic data");
    console.log("   • Pseudonyms remain consistent within the same session");
    console.log(
      "   • Clear mappings with /anonymize --clear for fresh pseudonyms",
    );
    console.log("   • Test anonymization with /anonymize --detect-only");
  }

  private displayPseudonymInfo(): void {
    console.log("🔤 Pseudonym Generation Examples\n");

    console.log("📧 Email Addresses:");
    console.log("   admin@example.com     → user123@company.local");
    console.log("   user.name@domain.org  → user456@example.org");
    console.log("   support@company.co.uk → user789@test.com");
    console.log("");

    console.log("🌐 IP Addresses:");
    console.log("   192.168.1.100  → 10.0.1.50");
    console.log("   172.16.0.1     → 192.168.2.25");
    console.log("   10.0.0.5       → 172.16.1.75");
    console.log("");

    console.log("🖥️  Hostnames:");
    console.log("   proxmox-server-01     → srv-a1b2c3");
    console.log("   db-primary.internal   → host-d4e5f6");
    console.log("   web-frontend-prod     → node-g7h8i9");
    console.log("");

    console.log("🆔 UUIDs:");
    console.log(
      "   123e4567-e89b-12d3-a456-426614174000  → f47ac10b-58cc-4372-a567-0e02b2c3d479",
    );
    console.log("");

    console.log("👤 Usernames:");
    console.log("   admin      → user123");
    console.log("   operator   → admin456");
    console.log("   root       → service789");
    console.log("");

    console.log("📁 File Paths:");
    console.log("   /home/admin/config.yml     → /home/dir123/file456.yml");
    console.log("   /usr/local/bin/script.sh   → /usr/local/bin/file789.sh");
    console.log("");

    console.log("🔒 Sensitive Data:");
    console.log("   password: secret123    → password: [REDACTED]");
    console.log("   token: abc123def456    → token: [REDACTED]");
    console.log("   apiKey: xyz789         → apiKey: [REDACTED]");
    console.log("");

    console.log("✨ Key Features:");
    console.log("   • Maintains original format (email looks like email)");
    console.log("   • Consistent within session (same input → same output)");
    console.log("   • Preserves data relationships and structure");
    console.log("   • No way to reverse pseudonyms back to original values");
  }

  private displayRulesInfo(): void {
    console.log("📜 Anonymization Rules Configuration\n");

    console.log("🎯 Rule Categories:");
    console.log("   • Personal Data: emails, usernames, names");
    console.log("   • Network Data: IP addresses, hostnames, MAC addresses");
    console.log("   • Infrastructure: server names, VM identifiers");
    console.log("   • System Data: UUIDs, paths, identifiers");
    console.log("   • Credentials: passwords, tokens, API keys");
    console.log("   • Filesystem: user paths, configuration files");
    console.log("");

    console.log("⚙️ Rule Processing:");
    console.log("   • Rules are applied in priority order (higher first)");
    console.log("   • Multiple rules can match the same data");
    console.log(
      "   • Replacement strategies: pseudonym, redact, hash, generic",
    );
    console.log("   • Format preservation maintains data usability");
    console.log("");

    console.log("🔍 Pattern Matching:");
    console.log("   • Email: Complex regex matching various email formats");
    console.log("   • IP: IPv4 addresses with word boundary detection");
    console.log("   • Hostname: FQDN and simple hostnames");
    console.log("   • UUID: Standard UUID v4 format detection");
    console.log("   • Custom: Proxmox-specific server naming patterns");
    console.log("");

    console.log("🛡️ Security Levels:");
    console.log("   • High Priority (90-100): Passwords, tokens, API keys");
    console.log("   • Medium Priority (70-89): PII like emails, IPs");
    console.log("   • Lower Priority (50-69): General identifiers, paths");
    console.log("");

    console.log("🎛️ Configuration Options:");
    console.log(
      "   • enablePseudonyms: Use consistent pseudonyms vs [REDACTED]",
    );
    console.log("   • preserveStructure: Keep original data structure");
    console.log("   • maxProcessingTime: Timeout for large datasets");
    console.log("   • hashSalt: Custom salt for additional security");
    console.log("   • enabledRules: Selective rule activation");
  }

  private displayMappings(): void {
    const mappings = this.engine["pseudonymManager"]?.getAllMappings() || [];

    console.log(`🗂️  Current Pseudonym Mappings (${mappings.length} total)\n`);

    if (mappings.length === 0) {
      console.log("   No pseudonym mappings found in current session.");
      console.log("   Mappings are created when data is anonymized.");
      console.log("");
      console.log("💡 To create mappings:");
      console.log('   /anonymize "Contact admin@example.com for help"');
      console.log('   /report-issue --safe "Test issue with sensitive data"');
      return;
    }

    // Group mappings by type
    const byType = mappings.reduce((acc: any, mapping) => {
      if (!acc[mapping.type]) acc[mapping.type] = [];
      acc[mapping.type].push(mapping);
      return acc;
    }, {});

    Object.entries(byType).forEach(([type, typeMappings]: [string, any]) => {
      console.log(`📝 ${type.toUpperCase()} (${typeMappings.length}):`);
      typeMappings.slice(0, 5).forEach((mapping: any) => {
        const truncatedOriginal =
          mapping.originalValue.length > 30
            ? mapping.originalValue.substring(0, 27) + "..."
            : mapping.originalValue;
        const truncatedPseudonym =
          mapping.pseudonym.length > 30
            ? mapping.pseudonym.substring(0, 27) + "..."
            : mapping.pseudonym;
        console.log(`   ${truncatedOriginal} → ${truncatedPseudonym}`);
      });

      if (typeMappings.length > 5) {
        console.log(`   ... and ${typeMappings.length - 5} more`);
      }
      console.log("");
    });

    console.log("🔧 Management Commands:");
    console.log("   /anonymize --clear      Clear all mappings");
    console.log("   /anonymize --stats      Show detailed statistics");
    console.log("");

    console.log("⚠️  Privacy Notice:");
    console.log("   • Mappings are session-specific and not persisted");
    console.log("   • Pseudonyms are consistent within the current session");
    console.log("   • Restart the console to get fresh pseudonyms");
  }
}
