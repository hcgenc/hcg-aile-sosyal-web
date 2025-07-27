"use client"

import { useMemo } from "react"
import { Users, MapPin, Tag, TrendingUp, Home, Activity } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import type { Marker } from "@/context/map-context"

interface ServiceStatisticsProps {
  addresses: Marker[]
  isLoading: boolean
}

export function ServiceStatistics({ addresses, isLoading }: ServiceStatisticsProps) {
  const statistics = useMemo(() => {
    if (!addresses || addresses.length === 0) {
      return {
        total: 0,
        genderDistribution: { male: 0, female: 0, other: 0 },
        topProvinces: [],
        topCategories: [],
        topDistricts: [],
        recentAdditions: 0
      }
    }

    // Total count
    const total = addresses.length

    // Gender distribution
    const genderDistribution = addresses.reduce(
      (acc, addr) => {
        if (addr.gender === "Erkek") acc.male++
        else if (addr.gender === "Kadın") acc.female++
        else acc.other++
        return acc
      },
      { male: 0, female: 0, other: 0 }
    )

    // Top provinces
    const provinceCounts = addresses.reduce((acc, addr) => {
      acc[addr.province] = (acc[addr.province] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    
    const topProvinces = Object.entries(provinceCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([name, count]) => ({ name, count }))

    // Top categories
    const categoryCounts = addresses.reduce((acc, addr) => {
      const category = addr.mainCategoryName || "Diğer"
      acc[category] = (acc[category] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    
    const topCategories = Object.entries(categoryCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([name, count]) => ({ name, count }))

    // Top districts
    const districtCounts = addresses.reduce((acc, addr) => {
      const key = `${addr.district} (${addr.province})`
      acc[key] = (acc[key] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    
    const topDistricts = Object.entries(districtCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([name, count]) => ({ name, count }))

    // Recent additions (last 7 days)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const recentAdditions = addresses.filter(
      addr => new Date(addr.createdAt) > sevenDaysAgo
    ).length

    return {
      total,
      genderDistribution,
      topProvinces,
      topCategories,
      topDistricts,
      recentAdditions
    }
  }, [addresses])

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
        {[...Array(6)].map((_, i) => (
          <Card key={i} className="bg-gray-800 border-gray-700">
            <CardContent className="p-6">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-700 rounded w-3/4 mb-3"></div>
                <div className="h-8 bg-gray-700 rounded w-1/2"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  const StatCard = ({ icon: Icon, label, value, color, subtitle }: {
    icon: any
    label: string
    value: string | number
    color: string
    subtitle?: string
  }) => (
    <Card className="bg-gray-800 border-gray-700 hover:border-gray-600 transition-all hover:shadow-lg">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-3">
          <div className={`p-2 rounded-lg ${color}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-400 mb-1">{label}</p>
          <p className="text-2xl font-bold text-gray-100">{value}</p>
          {subtitle && (
            <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
          )}
        </div>
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-6 mb-8">
      {/* Main statistics grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard
          icon={Users}
          label="Toplam Kayıt"
          value={statistics.total.toLocaleString('tr-TR')}
          color="bg-blue-900/50 text-blue-400"
        />
        
        <StatCard
          icon={Users}
          label="Erkek"
          value={statistics.genderDistribution.male.toLocaleString('tr-TR')}
          color="bg-cyan-900/50 text-cyan-400"
          subtitle={`%${statistics.total > 0 ? Math.round((statistics.genderDistribution.male / statistics.total) * 100) : 0}`}
        />
        
        <StatCard
          icon={Users}
          label="Kadın"
          value={statistics.genderDistribution.female.toLocaleString('tr-TR')}
          color="bg-pink-900/50 text-pink-400"
          subtitle={`%${statistics.total > 0 ? Math.round((statistics.genderDistribution.female / statistics.total) * 100) : 0}`}
        />
        
        <StatCard
          icon={MapPin}
          label="İl Sayısı"
          value={Object.keys(addresses.reduce((acc, addr) => {
            acc[addr.province] = true
            return acc
          }, {} as Record<string, boolean>)).length}
          color="bg-green-900/50 text-green-400"
        />
        
        <StatCard
          icon={Home}
          label="İlçe Sayısı"
          value={Object.keys(addresses.reduce((acc, addr) => {
            acc[`${addr.district}-${addr.province}`] = true
            return acc
          }, {} as Record<string, boolean>)).length}
          color="bg-purple-900/50 text-purple-400"
        />
        
        <StatCard
          icon={Activity}
          label="Son 7 Gün"
          value={statistics.recentAdditions}
          color="bg-orange-900/50 text-orange-400"
          subtitle="Yeni kayıt"
        />
      </div>

      {/* Detailed statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Top provinces */}
        <Card className="bg-gray-800 border-gray-700">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <MapPin className="h-5 w-5 text-green-400" />
              <h3 className="text-lg font-semibold text-gray-100">En Çok Kayıt - İller</h3>
            </div>
            <div className="space-y-3">
              {statistics.topProvinces.length > 0 ? (
                statistics.topProvinces.map((province, index) => (
                  <div key={province.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold text-gray-600">
                        {index === 0 ? "🥇" : index === 1 ? "🥈" : "🥉"}
                      </span>
                      <span className="text-sm text-gray-300">{province.name}</span>
                    </div>
                    <span className="text-sm font-medium text-gray-400">
                      {province.count} kayıt
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500">Henüz veri yok</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Top categories */}
        <Card className="bg-gray-800 border-gray-700">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Tag className="h-5 w-5 text-purple-400" />
              <h3 className="text-lg font-semibold text-gray-100">En Çok Kayıt - Risk Faktörleri</h3>
            </div>
            <div className="space-y-3">
              {statistics.topCategories.length > 0 ? (
                statistics.topCategories.map((category, index) => (
                  <div key={category.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold text-gray-600">
                        {index === 0 ? "🥇" : index === 1 ? "🥈" : "🥉"}
                      </span>
                      <span className="text-sm text-gray-300">{category.name}</span>
                    </div>
                    <span className="text-sm font-medium text-gray-400">
                      {category.count} kayıt
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500">Henüz veri yok</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Top districts */}
        <Card className="bg-gray-800 border-gray-700">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Home className="h-5 w-5 text-orange-400" />
              <h3 className="text-lg font-semibold text-gray-100">En Çok Kayıt - İlçeler</h3>
            </div>
            <div className="space-y-3">
              {statistics.topDistricts.length > 0 ? (
                statistics.topDistricts.map((district, index) => (
                  <div key={district.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold text-gray-600">
                        {index === 0 ? "🥇" : index === 1 ? "🥈" : "🥉"}
                      </span>
                      <span className="text-sm text-gray-300">{district.name}</span>
                    </div>
                    <span className="text-sm font-medium text-gray-400">
                      {district.count} kayıt
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500">Henüz veri yok</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}