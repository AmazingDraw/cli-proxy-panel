import { apiClient } from './client';

export interface UsageRecordItem {
  api_key: string;
  alias: string;
  auth_id: string;
  auth_index: string;
  auth_type: string;
  executor_type: string;
  failed: boolean;
  id: string;
  latency_ms: number;
  model: string;
  provider: string;
  reasoning_effort: string;
  service_tier: string;
  source: string;
  timestamp: string;
  tokens: {
    cache_creation_tokens: number;
    cache_read_tokens: number;
    cached_tokens: number;
    input_tokens: number;
    output_tokens: number;
    reasoning_tokens: number;
    total_tokens: number;
  };
  ttft_ms: number;
}

export type UsageStatisticsResponse = Record<string, Record<string, UsageRecordItem[]>>;

export const usageStatisticsApi = {
  /**
   * 获取所有使用统计数据并打平为列表
   */
  async getUsage(): Promise<UsageRecordItem[]> {
    const rawData = await apiClient.get<UsageStatisticsResponse>(
      '/plugins/usage-statistics/usage'
    );
    
    const records: UsageRecordItem[] = [];
    if (!rawData) return records;

    // 遍历外层 API Key
    for (const apiKey of Object.keys(rawData)) {
      const modelsData = rawData[apiKey];
      if (!modelsData) continue;

      // 遍历内层 Model
      for (const modelKey of Object.keys(modelsData)) {
        const items = modelsData[modelKey];
        if (Array.isArray(items)) {
          records.push(...items);
        }
      }
    }

    // 按照时间戳倒序排列
    return records.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  },

  /**
   * 删除指定的请求记录
   */
  async deleteUsage(ids: string[]): Promise<{ ok: boolean }> {
    return apiClient.delete<{ ok: boolean }>(
      '/plugins/usage-statistics/usage',
      { data: { ids } }
    );
  },
};
