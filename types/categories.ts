export interface MainCategory {
  id: string
  name: string
}

export interface SubCategory {
  id: string
  name: string
  mainCategoryId: string
}
