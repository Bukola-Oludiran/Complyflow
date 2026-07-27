import type { ComplyFlowConfig } from '@complyflow/shared';

let _config: ComplyFlowConfig | null = null;

export function setConfig(config: ComplyFlowConfig): void {
  _config = config;
}

export function getConfig(): ComplyFlowConfig {
  if (!_config) {
    throw new Error('ComplyFlow SDK not initialized. Call comply.init() first.');
  }
  return _config;
}

export function isInitialized(): boolean {
  return _config !== null;
}
