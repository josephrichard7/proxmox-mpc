/**
 * Proxmox-specific Anonymization Rules
 * Defines patterns and rules for Proxmox infrastructure data
 */

import { AnonymizationRule } from "../types/anonymization-types";

export const PROXMOX_RULES: AnonymizationRule[] = [
  // Email addresses
  {
    type: "email",
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    replacement: "pseudonym",
    category: "personal_data",
    preserveFormat: true,
    priority: 100,
  },

  // IP addresses (IPv4)
  {
    type: "ip_address",
    pattern:
      /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,
    replacement: "pseudonym",
    category: "network_data",
    preserveFormat: true,
    priority: 90,
  },

  // Hostnames and domain names
  {
    type: "hostname",
    pattern:
      /\b(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}\b/g,
    replacement: "pseudonym",
    category: "network_data",
    preserveFormat: true,
    priority: 85,
  },

  // Server/VM hostnames (without domain)
  {
    type: "hostname",
    pattern:
      /\b[a-zA-Z0-9][a-zA-Z0-9-]*(?:server|node|vm|host|proxmox|pve)[a-zA-Z0-9-]*\b/gi,
    replacement: "pseudonym",
    category: "infrastructure_data",
    preserveFormat: true,
    priority: 80,
  },

  // UUIDs
  {
    type: "uuid",
    pattern:
      /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
    replacement: "pseudonym",
    category: "system_data",
    preserveFormat: true,
    priority: 75,
  },

  // Passwords and secrets
  {
    type: "password",
    pattern: /(?:password|pwd|pass|secret|token|key)\s*[:=]\s*[^\s\n\r,;}]+/gi,
    replacement: "redact",
    category: "credentials",
    preserveFormat: false,
    priority: 95,
  },

  // API tokens
  {
    type: "token",
    pattern: /\b[A-Za-z0-9]{20,}\b/g,
    replacement: "redact",
    category: "credentials",
    preserveFormat: false,
    priority: 70,
  },

  // Usernames in various contexts
  {
    type: "username",
    pattern:
      /\b(?:user|username|login|admin|root|operator)[@:=\s]+[a-zA-Z0-9._-]+/gi,
    replacement: "pseudonym",
    category: "personal_data",
    preserveFormat: true,
    priority: 65,
  },

  // File paths containing usernames
  {
    type: "path",
    pattern: /\/(?:home|users|usr)\/[a-zA-Z0-9._-]+(?:\/[^\s]*)?/g,
    replacement: "pseudonym",
    category: "filesystem_data",
    preserveFormat: true,
    priority: 60,
  },

  // MAC addresses
  {
    type: "custom_pattern",
    pattern:
      /\b[0-9a-fA-F]{2}:[0-9a-fA-F]{2}:[0-9a-fA-F]{2}:[0-9a-fA-F]{2}:[0-9a-fA-F]{2}:[0-9a-fA-F]{2}\b/g,
    replacement: "pseudonym",
    category: "network_data",
    preserveFormat: true,
    priority: 55,
  },
];

/**
 * Get rules by category
 */
export function getRulesByCategory(category: string): AnonymizationRule[] {
  return PROXMOX_RULES.filter((rule) => rule.category === category);
}

/**
 * Get rules by type
 */
export function getRulesByType(type: string): AnonymizationRule[] {
  return PROXMOX_RULES.filter((rule) => rule.type === type);
}

/**
 * Get high-priority rules
 */
export function getHighPriorityRules(minPriority = 80): AnonymizationRule[] {
  return PROXMOX_RULES.filter((rule) => rule.priority >= minPriority);
}
