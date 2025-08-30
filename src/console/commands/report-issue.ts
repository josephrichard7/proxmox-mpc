/**
 * Report Issue Command
 * Generate comprehensive diagnostic reports for AI-assisted troubleshooting
 */

import * as fs from "fs";
import * as path from "path";

import { observability } from "../../observability";
import { ConsoleSession } from "../repl";

export class ReportIssueCommand {
  async execute(args: string[], session: ConsoleSession): Promise<void> {
    const diagnostics = observability.diagnostics;
    const logger = observability.logger;

    console.log("🔍 Collecting diagnostic information...\n");

    try {
      // Parse arguments
      const options = this.parseArguments(args);
      const userDescription =
        options.description || args.join(" ") || "General issue report";
      const useSafeMode = options.anonymize || options.safe;

      // Generate diagnostic snapshot (safe by default)
      const snapshotResult = useSafeMode
        ? await diagnostics.generateSafeSnapshot(
            session.workspace?.rootPath,
            options.operation,
            options.error,
          )
        : {
            data: await diagnostics.generateSnapshot(
              session.workspace?.rootPath,
              options.operation,
              options.error,
            ),
            metadata: {
              isAnonymized: false,
              rulesApplied: [],
              pseudonymsUsed: 0,
              processingTimeMs: 0,
              preservedStructure: true,
            },
          };

      const snapshot = snapshotResult.data;

      // Save report to diagnostics directory
      const reportPath = await this.saveReport(snapshot, userDescription);

      // Display report summary
      this.displayReportSummary(
        snapshot,
        reportPath,
        userDescription,
        snapshotResult.metadata,
      );

      // Generate AI collaboration prompt
      const aiPrompt = diagnostics.generateAIPrompt(snapshot, userDescription);
      this.displayAIPrompt(aiPrompt, reportPath, snapshotResult.metadata);

      logger.info(
        "Diagnostic report generated",
        {
          workspace: session.workspace?.rootPath,
          resourcesAffected: [],
        },
        {
          reportId: snapshot.id,
          reportPath,
          description: userDescription,
        },
      );
    } catch (error) {
      logger.error("Failed to generate diagnostic report", error as Error, {
        resourcesAffected: [],
      });
      console.log(
        `❌ Failed to generate diagnostic report: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private parseArguments(args: string[]): {
    description?: string;
    operation?: string;
    error?: any;
    includeFiles: boolean;
    anonymize: boolean;
    safe: boolean;
  } {
    const options = {
      includeFiles: true,
      anonymize: true,
      safe: false,
    } as any;

    // Join all args as description by default
    let description = "";

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      switch (arg) {
        case "--operation":
        case "-o":
          if (i + 1 < args.length) {
            options.operation = args[i + 1];
            i++;
          }
          break;
        case "--no-files":
          options.includeFiles = false;
          break;
        case "--no-anonymize":
          options.anonymize = false;
          break;
        case "--safe":
          options.safe = true;
          break;
        default:
          description += arg + " ";
      }
    }

    if (description.trim()) {
      options.description = description.trim();
    }

    return options;
  }

  private async saveReport(
    snapshot: any,
    userDescription: string,
  ): Promise<string> {
    const diagnosticsDir = path.join(process.cwd(), ".proxmox", "diagnostics");

    if (!fs.existsSync(diagnosticsDir)) {
      fs.mkdirSync(diagnosticsDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `issue-${timestamp}.json`;
    const reportPath = path.join(diagnosticsDir, filename);

    // Create comprehensive report
    const report = {
      metadata: {
        reportId: snapshot.id,
        timestamp: snapshot.timestamp,
        userDescription,
        version: this.getVersion(),
        reportType: "issue",
      },
      snapshot,
      userInfo: {
        description: userDescription,
        timestamp: new Date().toISOString(),
      },
    };

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    return reportPath;
  }

  private displayReportSummary(
    snapshot: any,
    reportPath: string,
    userDescription: string,
    anonymizationMeta?: any,
  ): void {
    console.log("📋 Issue Report Generated\n");

    console.log("📊 Report Contents:");
    console.log(`   • Report ID: ${snapshot.id}`);
    console.log(
      `   • Timestamp: ${new Date(snapshot.timestamp).toLocaleString()}`,
    );
    console.log(`   • User Description: "${userDescription}"`);
    console.log(`   • Operation Logs: ${snapshot.logs.length} entries`);
    console.log(
      `   • Performance Metrics: ${snapshot.metrics.length} data points`,
    );
    console.log(
      `   • Health Checks: ${snapshot.healthStatus.length} components`,
    );
    console.log(`   • System Information: Included`);

    if (anonymizationMeta && anonymizationMeta.isAnonymized) {
      console.log(
        `   • Data Anonymization: ✅ Applied (${anonymizationMeta.rulesApplied.length} rules, ${anonymizationMeta.pseudonymsUsed} pseudonyms)`,
      );
    }

    if (snapshot.workspaceInfo) {
      console.log(`   • Workspace Information: Included`);
    }

    if (snapshot.error) {
      console.log(
        `   • Error Details: ${snapshot.error.type} - ${snapshot.error.message}`,
      );
    }

    console.log(`\n📁 Report Location:`);
    console.log(`   ${reportPath}`);

    // File size
    try {
      const stats = fs.statSync(reportPath);
      const sizeKB = (stats.size / 1024).toFixed(1);
      console.log(`   Size: ${sizeKB} KB`);
    } catch (error) {
      // Ignore file size error
    }
  }

  private displayAIPrompt(
    aiPrompt: string,
    reportPath: string,
    anonymizationMeta?: any,
  ): void {
    console.log("\n🤖 AI Collaboration Ready\n");

    console.log("📤 Ready to share with AI assistants:");
    console.log(`   Report file: ${path.basename(reportPath)}`);
    console.log("");

    console.log("💡 Suggested AI Prompt:");
    console.log("─".repeat(80));
    console.log(aiPrompt);
    console.log("─".repeat(80));

    console.log("\n📋 Next Steps:");
    console.log("   1. Copy the suggested prompt above");
    console.log("   2. Attach or upload the report file");
    console.log("   3. Send to your AI assistant (Claude, ChatGPT, etc.)");
    console.log("   4. Follow the AI's recommendations");

    console.log("\n🔒 Privacy Note:");
    if (anonymizationMeta && anonymizationMeta.isAnonymized) {
      console.log(
        "   ✅ Data has been automatically anonymized for safe sharing",
      );
      console.log(
        `   • Applied ${anonymizationMeta.rulesApplied.length} anonymization rules`,
      );
      console.log(
        `   • Generated ${anonymizationMeta.pseudonymsUsed} consistent pseudonyms`,
      );
      console.log(
        "   • All PII (emails, IPs, hostnames, etc.) has been replaced",
      );
    } else {
      console.log(
        "   ⚠️  Raw data - contains potentially sensitive information",
      );
      console.log("   • Some basic redaction applied (passwords, tokens)");
      console.log("   • Use --safe flag for comprehensive anonymization");
    }

    console.log("\n💾 Report saved to:");
    console.log(`   ${reportPath}`);
  }

  private getVersion(): string {
    try {
      const packageJsonPath = path.join(
        __dirname,
        "..",
        "..",
        "..",
        "package.json",
      );
      if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(
          fs.readFileSync(packageJsonPath, "utf8"),
        );
        return packageJson.version || "unknown";
      }
    } catch (error) {
      // Ignore version retrieval error
    }
    return "unknown";
  }
}
