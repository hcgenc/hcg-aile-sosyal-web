export interface Province {
  id: number
  name: string
}

export interface District {
  id: number
  name: string
  provinceId: number
}

export interface Neighborhood {
  id: number
  name: string
  districtId: number
}
