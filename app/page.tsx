import { Map } from "@/components/map"
import { FilterPanel } from "@/components/filter-panel"
import { DatabaseStatus } from "@/components/database-status"
import { ActiveFilters } from "@/components/active-filters"

export default function HomePage() {
  return (
    <main className="relative w-full h-screen bg-gray-900">
      <div className="absolute top-16 left-16 right-16 z-[900] max-w-3xl mx-auto">
        <DatabaseStatus />
      </div>
      <Map />
      <FilterPanel />
      <ActiveFilters />
    </main>
  )
}
