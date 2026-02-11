/**
 * AutoCount API Client Instance
 * Singleton instance for use throughout the application
 */

import { createAutoCountApiClient, AutoCountApiClient } from './autocount-api-client';

let apiClient: AutoCountApiClient | null = null;

export function getAutoCountApiClient(): AutoCountApiClient {
  if (!apiClient) {
    const baseUrl = process.env.AUTOCOUNT_API_BASE_URL;
    const apiKey = process.env.AUTOCOUNT_API_KEY;

    if (!baseUrl || !apiKey) {
      throw new Error(
        'AutoCount API configuration missing. Please set AUTOCOUNT_API_BASE_URL and AUTOCOUNT_API_KEY environment variables.'
      );
    }

    apiClient = createAutoCountApiClient({
      baseUrl,
      apiKey,
      timeout: 30000,
    });
  }

  return apiClient;
}

