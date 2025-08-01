"use strict";
/**
 * Configuration management for Proxmox API client
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadProxmoxConfig = loadProxmoxConfig;
exports.validateConfig = validateConfig;
exports.sanitizeConfig = sanitizeConfig;
const dotenv = __importStar(require("dotenv"));
// Load environment variables
dotenv.config();
/**
 * Load Proxmox configuration from environment variables
 */
function loadProxmoxConfig() {
    const requiredEnvVars = [
        'PROXMOX_HOST',
        'PROXMOX_USERNAME',
        'PROXMOX_TOKEN_ID',
        'PROXMOX_TOKEN_SECRET',
        'PROXMOX_NODE'
    ];
    const missing = requiredEnvVars.filter(varName => !process.env[varName]);
    if (missing.length > 0) {
        throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
    return {
        host: process.env.PROXMOX_HOST,
        port: parseInt(process.env.PROXMOX_PORT || '8006'),
        username: process.env.PROXMOX_USERNAME,
        tokenId: process.env.PROXMOX_TOKEN_ID,
        tokenSecret: process.env.PROXMOX_TOKEN_SECRET,
        node: process.env.PROXMOX_NODE,
        rejectUnauthorized: process.env.NODE_ENV === 'production'
    };
}
/**
 * Validate Proxmox configuration
 */
function validateConfig(config) {
    const errors = [];
    if (!config.host) {
        errors.push('Host is required');
    }
    if (!config.port || config.port < 1 || config.port > 65535) {
        errors.push('Port must be between 1 and 65535');
    }
    if (!config.username) {
        errors.push('Username is required');
    }
    if (!config.tokenId) {
        errors.push('Token ID is required');
    }
    if (!config.tokenSecret) {
        errors.push('Token secret is required');
    }
    if (!config.node) {
        errors.push('Node name is required');
    }
    return errors;
}
/**
 * Create a safe config object for logging (without sensitive data)
 */
function sanitizeConfig(config) {
    return {
        host: config.host,
        port: config.port,
        username: config.username,
        node: config.node,
        rejectUnauthorized: config.rejectUnauthorized,
    };
}
