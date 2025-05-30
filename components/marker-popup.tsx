import type { Marker } from "@/context/map-context"
import { MapPin, User, Home, Clock } from "lucide-react"

interface MarkerPopupProps {
  marker: Marker
}

export function MarkerPopup({ marker }: MarkerPopupProps) {
  // Risk faktörüne göre renk belirle
  let color = "#3B82F6"
  let gradientFrom = "from-blue-500"
  let gradientTo = "to-blue-600"
  let textColor = "text-blue-400"

  if (marker.mainCategoryName) {
    switch (marker.mainCategoryName) {
      case "Yaşlı":
        color = "#10B981"
        gradientFrom = "from-emerald-500"
        gradientTo = "to-emerald-600"
        textColor = "text-emerald-400"
        break
      case "Engelli":
        color = "#F59E0B"
        gradientFrom = "from-amber-500"
        gradientTo = "to-amber-600"
        textColor = "text-amber-400"
        break
      case "Kronik Hastalık":
        color = "#EF4444"
        gradientFrom = "from-red-500"
        gradientTo = "to-red-600"
        textColor = "text-red-400"
        break
      case "Sosyal Destek İhtiyacı":
        color = "#8B5CF6"
        gradientFrom = "from-violet-500"
        gradientTo = "to-violet-600"
        textColor = "text-violet-400"
        break
      case "Afet Mağduru":
        color = "#EC4899"
        gradientFrom = "from-pink-500"
        gradientTo = "to-pink-600"
        textColor = "text-pink-400"
        break
    }
  }

  // Tarih formatla
  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return ""
    const date = new Date(dateString)
    return new Intl.DateTimeFormat("tr-TR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(date)
  }

  const lastName = marker.lastName || ""

  return (
    <div className="w-full overflow-hidden rounded-lg bg-gray-800 text-gray-100">
      {/* Minimal Header */}
      <div className={`bg-gradient-to-r ${gradientFrom} ${gradientTo} p-3 flex items-center gap-3`}>
        <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
          <User className="h-5 w-5 text-white" />
        </div>
        <div className="text-white">
          <h3 className="font-bold text-base leading-tight">
            {marker.firstName} {lastName}
          </h3>
          <div className="text-white/80 text-xs flex items-center gap-1 mt-0.5">
            <Clock className="h-3 w-3" />
            {formatDate(marker.createdAt)}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="bg-gray-800 p-3 space-y-3">
        {/* Risk Factor & Service Type */}
        <div className="flex gap-2">
          <div className="flex-1 flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full`} style={{ backgroundColor: color }}></div>
            <div className="text-xs text-gray-400">{marker.mainCategoryName}</div>
          </div>
          <div className="flex-1 flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full`} style={{ backgroundColor: color }}></div>
            <div className="text-xs text-gray-400">{marker.subCategoryName}</div>
          </div>
        </div>

        {/* Address */}
        <div className="flex items-start gap-2 pt-1">
          <Home className={`h-4 w-4 mt-0.5 ${textColor}`} />
          <div className="flex-1">
            <div className="text-xs font-medium text-gray-500">Adres</div>
            <div className="text-sm text-gray-200">
              {marker.province}, {marker.district}, {marker.neighborhood}
            </div>
            <div className="text-xs text-gray-400 mt-1">{marker.address}</div>
          </div>
        </div>

        {/* Coordinates */}
        <div className="flex items-center gap-2 pt-1">
          <MapPin className={`h-4 w-4 ${textColor}`} />
          <div className="flex-1">
            <div className="text-xs font-medium text-gray-500">Koordinatlar</div>
            <div className="font-mono text-xs text-gray-300">
              {marker.latitude.toFixed(6)}, {marker.longitude.toFixed(6)}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
