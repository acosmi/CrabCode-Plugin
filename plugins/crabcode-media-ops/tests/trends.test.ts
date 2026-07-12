import { describe, expect, test } from 'bun:test'
import { clusterHandler } from '../src/tools/trends.ts'

describe('Chinese topic clustering', () => {
  test('clusters differently worded Chinese titles about the same event', async () => {
    const env = await clusterHandler({ signals: [
      { id: '1', title: '字节跳动发布豆包新模型，推理能力升级', hotScore: 10 },
      { id: '2', title: '豆包推理模型正式升级，字节发布新版本', hotScore: 8 },
      { id: '3', title: '新能源汽车销量继续增长', hotScore: 7 },
    ] })
    expect((env.data as any).clusterCount).toBe(2)
    expect((env.data as any).clusters.some((cluster: any) => cluster.size === 2)).toBe(true)
  })

  test('does not merge unrelated Chinese stories that share generic words', async () => {
    const env = await clusterHandler({ signals: [
      { id: '1', title: '某手机品牌发布新款折叠屏', hotScore: 5 },
      { id: '2', title: '教育部门发布新学期招生通知', hotScore: 4 },
    ] })
    expect((env.data as any).clusterCount).toBe(2)
  })
})
