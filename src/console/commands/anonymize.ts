/**
 * Anonymize Command
 * Interactive data anonymization and PII detection
 */

import * as fs from "fs";
// import * as path from 'path'; // Reserved for future file processing

import {
  AnonymizationEngine,
  DEFAULT_ANONYMIZATION_OPTIONS,
  createAnonymizationEngine,
} from "../../anonymization";
import { ConsoleSession } from "../repl";

export class AnonymizeCommand {
  private engine: AnonymizationEngine;

  constructor() {
    this.engine = createAnonymizationEngine();
  }

  async execute(args: string[], _session: ConsoleSession): Promise<void> {
    const options = this.parseArguments(args);

    if (options.showHelp) {
      this.displayHelp();
      return;
    }

    if (options.showStats) {
      this.displayStats();
      return;
    }

    if (options.clearMappings) {
      this.engine.clearMappings();
      console.log("✅ Cleared all pseudonym mappings");
      return;
    }

    if (options.inputFile) {
      await this.anonymizeFile(options.inputFile, options);
      return;
    }

    if (options.inputText) {
      await this.anonymizeText(options.inputText, options);
      return;
    }

    // Interactive mode
    await this.runInteractiveMode();
  }

  private parseArguments(args: string[]): {
    showHelp: boolean;
    showStats: boolean;
    clearMappings: boolean;
    inputFile?: string;
    inputText?: string;
    outputFile?: string;
    detectOnly: boolean;
    enablePseudonyms: boolean;
  } {
    const options = {
      showHelp: false,
      showStats: false,
      clearMappings: false,
      detectOnly: false,
      enablePseudonyms: true,
    } as any;

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      switch (arg) {
        case "--help":
        case "-h":
          options.showHelp = true;
          break;
        case "--stats":
          options.showStats = true;
          break;
        case "--clear":
          options.clearMappings = true;
          break;
        case "--file":
        case "-f":
          if (i + 1 < args.length) {
            options.inputFile = args[i + 1];
            i++;
          }
          break;
        case "--output":
        case "-o":
          if (i + 1 < args.length) {
            options.outputFile = args[i + 1];
            i++;
          }
          break;
        case "--text":
        case "-t":
          if (i + 1 < args.length) {
            options.inputText = args[i + 1];
            i++;
          }
          break;
        case "--detect-only":
          options.detectOnly = true;
          break;
        case "--no-pseudonyms":
          options.enablePseudonyms = false;
          break;
        default:
          // Treat remaining args as input text if no other input specified
          if (!options.inputFile && !options.inputText) {
            options.inputText = args.slice(i).join(" ");
            break;
          }
      }
    }

    return options;
  }

  private async anonymizeFile(filePath: string, options: any): Promise<void> {
    try {
      console.log(`📄 Processing file: ${filePath}`);

      if (!fs.existsSync(filePath)) {
        console.log(`❌ File not found: ${filePath}`);
        return;
      }

      const content = fs.readFileSync(filePath, "utf8");

      if (options.detectOnly) {
        const piiResult = await this.engine.detectPII(content);
        this.displayPIIDetection(piiResult, filePath);
      } else {
        const anonymizationOptions = {
          ...DEFAULT_ANONYMIZATION_OPTIONS,
          enablePseudonyms: options.enablePseudonyms,
        };

        const result = await this.engine.anonymize(
          content,
          anonymizationOptions,
        );

        console.log("\n📊 Anonymization Results:");
        console.log(
          `   • Rules Applied: ${result.metadata.rulesApplied.join(", ")}`,
        );
        console.log(
          `   • Pseudonyms Created: ${result.metadata.pseudonymsUsed}`,
        );
        console.log(
          `   • Processing Time: ${result.metadata.processingTimeMs}ms`,
        );
        console.log(
          `   • Data Anonymized: ${result.metadata.isAnonymized ? "✅" : "❌"}`,
        );

        if (options.outputFile) {
          fs.writeFileSync(options.outputFile, result.data);
          console.log(
            `\n💾 Anonymized content saved to: ${options.outputFile}`,
          );
        } else {
          console.log("\n📄 Anonymized Content:");
          console.log("─".repeat(60));
          console.log(result.data);
          console.log("─".repeat(60));
        }
      }
    } catch (error) {
      console.log(
        `❌ Error processing file: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async anonymizeText(text: string, options: any): Promise<void> {
    try {
      console.log("📝 Processing text input...");

      if (options.detectOnly) {
        const piiResult = await this.engine.detectPII(text);
        this.displayPIIDetection(piiResult, "text input");
      } else {
        const anonymizationOptions = {
          ...DEFAULT_ANONYMIZATION_OPTIONS,
          enablePseudonyms: options.enablePseudonyms,
        };

        const result = await this.engine.anonymize(text, anonymizationOptions);

        console.log("\n📊 Anonymization Results:");
        console.log(`   • Original: "${text}"`);
        console.log(`   • Anonymized: "${result.data}"`);
        console.log(
          `   • Rules Applied: ${result.metadata.rulesApplied.join(", ")}`,
        );
        console.log(
          `   • Pseudonyms Created: ${result.metadata.pseudonymsUsed}`,
        );
        console.log(
          `   • Processing Time: ${result.metadata.processingTimeMs}ms`,
        );
      }
    } catch (error) {
      console.log(
        `❌ Error processing text: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private displayPIIDetection(result: any, source: string): void {
    console.log(`\n🔍 PII Detection Results for ${source}:`);
    console.log(`   • PII Found: ${result.hasPII ? "✅" : "❌"}`);
    console.log(`   • Confidence: ${(result.confidence * 100).toFixed(1)}%`);

    if (result.detectedTypes.length > 0) {
      console.log(`   • Types Detected: ${result.detectedTypes.join(", ")}`);

      console.log("\n📍 PII Locations:");
      result.locations.forEach((location: any, index: number) => {
        console.log(
          `   ${index + 1}. ${location.type}: "${location.value}" (pos ${location.startIndex}-${location.endIndex})`,
        );
      });
    } else {
      console.log("   • No PII detected");
    }
  }

  private displayStats(): void {
    const stats = this.engine.getStats();

    console.log("📊 Anonymization Engine Statistics:\n");
    console.log(`   • Total Operations: ${stats.totalProcessed}`);
    console.log(`   • Total Pseudonyms: ${stats.totalPseudonyms}`);
    console.log(
      `   • Average Processing Time: ${stats.averageProcessingTime.toFixed(2)}ms`,
    );
    console.log(`   • Error Rate: ${(stats.errorRate * 100).toFixed(2)}%`);

    if (Object.keys(stats.rulesUsage).length > 0) {
      console.log("\n📝 Rule Usage:");
      Object.entries(stats.rulesUsage).forEach(([rule, count]) => {
        console.log(`   • ${rule}: ${count} times`);
      });
    }
  }

  private async runInteractiveMode(): Promise<void> {
    console.log("🔐 Interactive Anonymization Mode");
    console.log(
      'Enter text to anonymize (or "help" for commands, "exit" to quit):\n',
    );

    const readline = require("readline");
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const processInput = async (input: string): Promise<void> => {
      const trimmed = input.trim();

      if (trimmed === "exit") {
        rl.close();
        return;
      }

      if (trimmed === "help") {
        this.displayInteractiveHelp();
        rl.prompt();
        return;
      }

      if (trimmed === "stats") {
        this.displayStats();
        rl.prompt();
        return;
      }

      if (trimmed === "clear") {
        this.engine.clearMappings();
        console.log("✅ Cleared all pseudonym mappings");
        rl.prompt();
        return;
      }

      if (trimmed.startsWith("detect ")) {
        const text = trimmed.substring(7);
        const result = await this.engine.detectPII(text);
        this.displayPIIDetection(result, "input");
        rl.prompt();
        return;
      }

      if (trimmed.length === 0) {
        rl.prompt();
        return;
      }

      try {
        const result = await this.engine.anonymize(
          trimmed,
          DEFAULT_ANONYMIZATION_OPTIONS,
        );
        console.log(`🔐 Anonymized: "${result.data}"`);
        if (result.metadata.rulesApplied.length > 0) {
          console.log(
            `📝 Rules applied: ${result.metadata.rulesApplied.join(", ")}`,
          );
        }
      } catch (error) {
        console.log(
          `❌ Error: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      rl.prompt();
    };

    rl.on("line", processInput);
    rl.prompt();
  }

  private displayHelp(): void {
    console.log("🔐 Anonymize Command Help\n");
    console.log("Usage: /anonymize [options] [text]");
    console.log("");
    console.log("Options:");
    console.log("  -f, --file <path>     Anonymize file content");
    console.log("  -o, --output <path>   Save output to file");
    console.log("  -t, --text <text>     Anonymize text directly");
    console.log("  --detect-only         Only detect PII, don't anonymize");
    console.log("  --no-pseudonyms       Use [REDACTED] instead of pseudonyms");
    console.log("  --stats               Show anonymization statistics");
    console.log("  --clear               Clear all pseudonym mappings");
    console.log("  -h, --help            Show this help");
    console.log("");
    console.log("Examples:");
    console.log('  /anonymize "Contact admin@example.com for help"');
    console.log("  /anonymize --file config.yaml --output config-safe.yaml");
    console.log('  /anonymize --detect-only --text "Server at 192.168.1.1"');
    console.log("  /anonymize --stats");
    console.log("");
    console.log("Interactive mode: /anonymize (no arguments)");
  }

  private displayInteractiveHelp(): void {
    console.log("\n🔐 Interactive Mode Commands:");
    console.log("  help         Show this help");
    console.log("  stats        Show anonymization statistics");
    console.log("  clear        Clear all pseudonym mappings");
    console.log("  detect <text> Detect PII in text");
    console.log("  exit         Exit interactive mode");
    console.log("  <text>       Anonymize text directly");
    console.log("");
  }
}
