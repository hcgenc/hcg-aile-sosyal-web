import type { Marker } from "@/context/map-context"
import { MapPin, User, Home, Clock, Users } from "lucide-react"

interface MarkerPopupProps {
  marker: Marker
}

export function MarkerPopup({ marker }: MarkerPopupProps) {
  // Önce hizmet türü rengini kullan, sonra ana kategori rengini
  let color = marker.subCategoryColor || marker.mainCategoryColor || "#3B82F6"
  
  // Hex rengi RGB'ye çevir
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 59, g: 130, b: 246 } // Default blue
  }

  const rgb = hexToRgb(color)
  
  // Dinamik CSS sınıfları oluştur
  const gradientFrom = `from-[${color}]`
  const gradientTo = `to-[${color}]/80`
  const textColor = `text-[${color}]/70`

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
      {/* Dynamic Header */}
      <div 
        className="p-3 flex items-center gap-3"
        style={{
          background: `linear-gradient(to right, ${color}, ${color}dd)`
        }}
      >
        <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
          <User className="h-5 w-5 text-white" />
        </div>
        <div className="text-white">
          <h3 className="font-bold text-base leading-tight">
            {marker.firstName} {lastName}
          </h3>
          <div className="text-white/80 text-xs flex items-center gap-3 mt-0.5">
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDate(marker.createdAt)}
            </div>
            {marker.gender && (
              <div className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {marker.gender}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="bg-gray-800 p-3 space-y-3">
        {/* Risk Factor & Service Type */}
        <div className="flex gap-2">
          <div className="flex-1 flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded-full shadow-sm"
              style={{ backgroundColor: marker.mainCategoryColor || "#3B82F6" }}
            ></div>
            <div className="text-xs text-gray-400">{marker.mainCategoryName}</div>
          </div>
          <div className="flex-1 flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded-full shadow-sm"
              style={{ backgroundColor: color }}
            ></div>
            <div className="text-xs text-gray-400">{marker.subCategoryName}</div>
          </div>
        </div>

        {/* Address */}
        <div className="flex items-start gap-2 pt-1">
          <Home 
            className="h-4 w-4 mt-0.5"
            style={{ color: `${color}aa` }}
          />
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
          <MapPin 
            className="h-4 w-4"
            style={{ color: `${color}aa` }}
          />
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
