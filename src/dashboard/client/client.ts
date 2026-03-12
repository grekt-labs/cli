import { http } from "#/context/http"
import type { PBRecord, PBListResponse } from "@grekt/engine"

const REQUEST_TIMEOUT_MS = 5_000

export class DashboardClient {
  private baseUrl: string
  private token: string

  constructor(baseUrl: string, token: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "")
    this.token = token
  }

  async findRecord(collection: string, filter: string): Promise<PBRecord | null> {
    const params = new URLSearchParams({ filter, perPage: "1" })
    const response = await this.request<PBListResponse>(
      `/api/collections/${collection}/records?${params.toString()}`,
    )

    return response.items.length > 0 ? response.items[0] : null
  }

  async createRecord(collection: string, data: Record<string, unknown>): Promise<PBRecord> {
    return this.request<PBRecord>(`/api/collections/${collection}/records`, {
      method: "POST",
      body: JSON.stringify(data),
    })
  }

  async updateRecord(collection: string, id: string, data: Record<string, unknown>): Promise<PBRecord> {
    return this.request<PBRecord>(`/api/collections/${collection}/records/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    })
  }

  async listRecords(collection: string, filter: string): Promise<PBRecord[]> {
    const allItems: PBRecord[] = []
    let page = 1

    while (true) {
      const params = new URLSearchParams({ filter, page: String(page), perPage: "200" })
      const response = await this.request<PBListResponse>(
        `/api/collections/${collection}/records?${params.toString()}`,
      )

      allItems.push(...response.items)

      if (page >= response.totalPages) {
        break
      }

      page++
    }

    return allItems
  }

  async deleteRecord(collection: string, id: string): Promise<void> {
    await this.requestRaw(`/api/collections/${collection}/records/${id}`, {
      method: "DELETE",
    })
  }

  async upsertByFilter(collection: string, filter: string, data: Record<string, unknown>): Promise<PBRecord> {
    const existing = await this.findRecord(collection, filter)

    if (existing) {
      return this.updateRecord(collection, existing.id, data)
    }

    return this.createRecord(collection, data)
  }

  private async requestRaw(path: string, options?: RequestInit): Promise<Response> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${this.token}`,
    }

    const response = await http.fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: { ...headers, ...options?.headers },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })

    if (!response.ok) {
      const body = await response.text().catch(() => "")
      throw new Error(`PocketBase ${response.status}: ${body}`)
    }

    return response
  }

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const response = await this.requestRaw(path, options)
    return response.json() as Promise<T>
  }
}
