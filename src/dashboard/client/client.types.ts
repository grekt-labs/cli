export interface PBRecord {
  id: string
  collectionId: string
  collectionName: string
  created: string
  updated: string
  [key: string]: unknown
}

export interface PBListResponse {
  page: number
  perPage: number
  totalPages: number
  totalItems: number
  items: PBRecord[]
}

export interface PBAuthResponse {
  token: string
  record: PBRecord
}
