export interface MainCategory {
  id: string
  name: string
  color: string
}

export interface SubCategory {
  id: string
  name: string
  mainCategoryId: string
  color: string
}
