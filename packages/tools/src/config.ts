import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import yaml from 'js-yaml';

// Type definitions for configuration
export interface NetworkConfig {
  myIp: string;
  grandma2Primary: string;
  grandma2Secondary: string;
  broadcast: string;
  subnet: string;
}

export interface ArtNetConfig {
  port: number;
  refreshRateHz: number;
}

export interface Config {
  network: NetworkConfig;
  artnet: ArtNetConfig;
}

// Get the directory of this module to find config.yaml
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const configPath = join(__dirname, '..', 'config.yaml');

// Load and parse the YAML config file
const configFile = readFileSync(configPath, 'utf8');
export const config: Config = yaml.load(configFile) as Config;

// Convenience exports
export const { network, artnet } = config;

// Calculate refresh interval in milliseconds from Hz
export const refreshIntervalMs = Math.round(1000 / artnet.refreshRateHz);
