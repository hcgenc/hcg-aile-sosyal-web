'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/context/auth-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle,
  DialogTrigger 
} from '@/components/ui/dialog'
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { 
  UserPlus, 
  Shield, 
  AlertTriangle, 
  CheckCircle, 
  Eye, 
  EyeOff, 
  Edit, 
  Trash2, 
  Users,
  Plus,
  Search,
  RefreshCw
} from 'lucide-react'
import { useRouter } from 'next/navigation'

interface City {
  value: string
  label: string
}

interface User {
  id: string
  username: string
  fullName: string
  role: string
  city: string
  createdAt: string
  updatedAt: string
}

const CITIES: City[] = [
  { value: 'Adana', label: 'Adana' },
  { value: 'Adıyaman', label: 'Adıyaman' },
  { value: 'Afyonkarahisar', label: 'Afyonkarahisar' },
  { value: 'Ağrı', label: 'Ağrı' },
  { value: 'Amasya', label: 'Amasya' },
  { value: 'Ankara', label: 'Ankara' },
  { value: 'Antalya', label: 'Antalya' },
  { value: 'Artvin', label: 'Artvin' },
  { value: 'Aydın', label: 'Aydın' },
  { value: 'Balıkesir', label: 'Balıkesir' },
  { value: 'Bilecik', label: 'Bilecik' },
  { value: 'Bingöl', label: 'Bingöl' },
  { value: 'Bitlis', label: 'Bitlis' },
  { value: 'Bolu', label: 'Bolu' },
  { value: 'Burdur', label: 'Burdur' },
  { value: 'Bursa', label: 'Bursa' },
  { value: 'Çanakkale', label: 'Çanakkale' },
  { value: 'Çankırı', label: 'Çankırı' },
  { value: 'Çorum', label: 'Çorum' },
  { value: 'Denizli', label: 'Denizli' },
  { value: 'Diyarbakır', label: 'Diyarbakır' },
  { value: 'Edirne', label: 'Edirne' },
  { value: 'Elazığ', label: 'Elazığ' },
  { value: 'Erzincan', label: 'Erzincan' },
  { value: 'Erzurum', label: 'Erzurum' },
  { value: 'Eskişehir', label: 'Eskişehir' },
  { value: 'Gaziantep', label: 'Gaziantep' },
  { value: 'Giresun', label: 'Giresun' },
  { value: 'Gümüşhane', label: 'Gümüşhane' },
  { value: 'Hakkâri', label: 'Hakkâri' },
  { value: 'Hatay', label: 'Hatay' },
  { value: 'Isparta', label: 'Isparta' },
  { value: 'Mersin', label: 'Mersin' },
  { value: 'İstanbul', label: 'İstanbul' },
  { value: 'İzmir', label: 'İzmir' },
  { value: 'Kars', label: 'Kars' },
  { value: 'Kastamonu', label: 'Kastamonu' },
  { value: 'Kayseri', label: 'Kayseri' },
  { value: 'Kırklareli', label: 'Kırklareli' },
  { value: 'Kırşehir', label: 'Kırşehir' },
  { value: 'Kocaeli', label: 'Kocaeli' },
  { value: 'Konya', label: 'Konya' },
  { value: 'Kütahya', label: 'Kütahya' },
  { value: 'Malatya', label: 'Malatya' },
  { value: 'Manisa', label: 'Manisa' },
  { value: 'Kahramanmaraş', label: 'Kahramanmaraş' },
  { value: 'Mardin', label: 'Mardin' },
  { value: 'Muğla', label: 'Muğla' },
  { value: 'Muş', label: 'Muş' },
  { value: 'Nevşehir', label: 'Nevşehir' },
  { value: 'Niğde', label: 'Niğde' },
  { value: 'Ordu', label: 'Ordu' },
  { value: 'Rize', label: 'Rize' },
  { value: 'Sakarya', label: 'Sakarya' },
  { value: 'Samsun', label: 'Samsun' },
  { value: 'Siirt', label: 'Siirt' },
  { value: 'Sinop', label: 'Sinop' },
  { value: 'Sivas', label: 'Sivas' },
  { value: 'Tekirdağ', label: 'Tekirdağ' },
  { value: 'Tokat', label: 'Tokat' },
  { value: 'Trabzon', label: 'Trabzon' },
  { value: 'Tunceli', label: 'Tunceli' },
  { value: 'Şanlıurfa', label: 'Şanlıurfa' },
  { value: 'Uşak', label: 'Uşak' },
  { value: 'Van', label: 'Van' },
  { value: 'Yozgat', label: 'Yozgat' },
  { value: 'Zonguldak', label: 'Zonguldak' },
  { value: 'Aksaray', label: 'Aksaray' },
  { value: 'Bayburt', label: 'Bayburt' },
  { value: 'Karaman', label: 'Karaman' },
  { value: 'Kırıkkale', label: 'Kırıkkale' },
  { value: 'Batman', label: 'Batman' },
  { value: 'Şırnak', label: 'Şırnak' },
  { value: 'Bartın', label: 'Bartın' },
  { value: 'Ardahan', label: 'Ardahan' },
  { value: 'Iğdır', label: 'Iğdır' },
  { value: 'Yalova', label: 'Yalova' },
  { value: 'Karabük', label: 'Karabük' },
  { value: 'Kilis', label: 'Kilis' },
  { value: 'Osmaniye', label: 'Osmaniye' },
  { value: 'Düzce', label: 'Düzce' }
]

export default function KullaniciIslemleriPage() {
  const { user } = useAuth()
  const router = useRouter()
  
  // State variables
  const [users, setUsers] = useState<User[]>([])
  const [filteredUsers, setFilteredUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [message, setMessage] = useState<{type: 'success' | 'error' | 'info', text: string} | null>(null)
  
  // Add user modal state
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [addFormData, setAddFormData] = useState({
    username: '',
    password: '',
    fullName: '',
    role: '',
    city: ''
  })
  const [addLoading, setAddLoading] = useState(false)
  const [showAddPassword, setShowAddPassword] = useState(false)
  
  // Edit user modal state
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [editFormData, setEditFormData] = useState({
    username: '',
    fullName: '',
    role: '',
    city: ''
  })
  const [editLoading, setEditLoading] = useState(false)
  
  // Delete user modal state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deletingUser, setDeletingUser] = useState<User | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  // Admin yetkisi kontrolü
  useEffect(() => {
    if (user && user.role !== 'admin') {
      router.push('/')
    }
  }, [user, router])

  // Kullanıcıları yükle
  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('auth_token')
      if (!token) return

      const response = await fetch('/api/users', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        // Admin kullanıcıyı hariç tut
        const nonAdminUsers = data.users.filter((u: User) => u.role !== 'admin')
        setUsers(nonAdminUsers)
        setFilteredUsers(nonAdminUsers)
      } else {
        const error = await response.json()
        setMessage({ type: 'error', text: error.error || 'Kullanıcılar yüklenemedi' })
      }
    } catch (error) {
      console.error('Error fetching users:', error)
      setMessage({ type: 'error', text: 'Bağlantı hatası' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user && user.role === 'admin') {
      fetchUsers()
    }
  }, [user])

  // Arama fonksiyonu
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredUsers(users)
    } else {
      const filtered = users.filter(u => 
        u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.city.toLowerCase().includes(searchTerm.toLowerCase())
      )
      setFilteredUsers(filtered)
    }
  }, [searchTerm, users])

  // Sadece admin kullanıcılar erişebilir
  if (!user || user.role !== 'admin') {
    return (
      <div className="container mx-auto px-4 py-8">
        <Alert variant="destructive">
          <Shield className="h-4 w-4" />
          <AlertDescription>
            Bu sayfaya erişim yetkiniz yok. Sadece sistem yöneticileri kullanıcı işlemlerini gerçekleştirebilir.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  // API request helper
  const makeAuthenticatedRequest = async (url: string, options: RequestInit = {}) => {
    const token = localStorage.getItem('auth_token')
    if (!token) {
      setMessage({ type: 'error', text: 'Oturum süreniz dolmuş. Lütfen tekrar giriş yapın.' })
      return null
    }

    return await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers
      }
    })
  }

  const getRoleBadge = (role: string) => {
    switch(role) {
      case 'editor':
        return <Badge variant="default" className="bg-blue-100 text-blue-800">Editör</Badge>
      case 'normal':
        return <Badge variant="secondary" className="bg-gray-100 text-gray-800">Normal</Badge>
      default:
        return <Badge variant="outline">{role}</Badge>
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('tr-TR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Kullanıcı İşlemleri
          </CardTitle>
          <CardDescription>
            Sistemdeki kullanıcıları yönetin. Yeni kullanıcı ekleyin, mevcut kullanıcıları düzenleyin veya silin.
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          {message && (
            <Alert 
              variant={message.type === 'error' ? 'destructive' : 'default'} 
              className="mb-6"
            >
              {message.type === 'success' ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                <AlertTriangle className="h-4 w-4" />
              )}
              <AlertDescription>{message.text}</AlertDescription>
            </Alert>
          )}

          {/* Actions Bar */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Kullanıcı adı, ad soyad veya şehir ile ara..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button
                onClick={() => fetchUsers()}
                variant="outline"
                size="sm"
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Yenile
              </Button>
              
              <Button size="sm" onClick={() => setShowAddDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Yeni Kullanıcı
              </Button>
            </div>
          </div>

          {/* Users Table */}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin mr-2" />
              <span>Kullanıcılar yükleniyor...</span>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kullanıcı Adı</TableHead>
                    <TableHead>Ad Soyad</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Şehir</TableHead>
                    <TableHead>Kayıt Tarihi</TableHead>
                    <TableHead className="text-right">İşlemler</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                        {searchTerm ? 'Arama kriterlerine uygun kullanıcı bulunamadı.' : 'Henüz kullanıcı bulunmuyor.'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredUsers.map((userData) => (
                      <TableRow key={userData.id}>
                        <TableCell className="font-medium">
                          @{userData.username}
                        </TableCell>
                        <TableCell>{userData.fullName}</TableCell>
                        <TableCell>{getRoleBadge(userData.role)}</TableCell>
                        <TableCell>📍 {userData.city}</TableCell>
                        <TableCell>{formatDate(userData.createdAt)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setEditingUser(userData)
                                setEditFormData({
                                  username: userData.username,
                                  fullName: userData.fullName,
                                  role: userData.role,
                                  city: userData.city
                                })
                                setShowEditDialog(true)
                              }}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setDeletingUser(userData)
                                setShowDeleteDialog(true)
                              }}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Statistics */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-blue-100 rounded-lg border border-blue-200">
              <div className="text-2xl font-bold text-blue-700">{users.filter(u => u.role === 'editor').length}</div>
              <div className="text-sm text-blue-600">Editör</div>
            </div>
            <div className="text-center p-4 bg-slate-100 rounded-lg border border-slate-200">
              <div className="text-2xl font-bold text-slate-700">{users.filter(u => u.role === 'normal').length}</div>
              <div className="text-sm text-slate-600">Normal Kullanıcı</div>
            </div>
            <div className="text-center p-4 bg-emerald-100 rounded-lg border border-emerald-200">
              <div className="text-2xl font-bold text-emerald-700">{users.length}</div>
              <div className="text-sm text-emerald-600">Toplam Kullanıcı</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Add User Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Yeni Kullanıcı Ekle</DialogTitle>
            <DialogDescription>
              Sisteme yeni bir kullanıcı ekleyin. Tüm alanlar zorunludur.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="add-username" className="text-right">
                Kullanıcı Adı
              </Label>
              <Input
                id="add-username"
                placeholder="Kullanıcı Adı"
                value={addFormData.username}
                onChange={(e) => setAddFormData(prev => ({ ...prev, username: e.target.value }))}
                className="col-span-3"
                minLength={3}
                required
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="add-password" className="text-right">
                Şifre
              </Label>
              <div className="col-span-3 relative">
                <Input
                  id="add-password"
                  type={showAddPassword ? 'text' : 'password'}
                  placeholder="Güçlü bir şifre"
                  value={addFormData.password}
                  onChange={(e) => setAddFormData(prev => ({ ...prev, password: e.target.value }))}
                  minLength={6}
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowAddPassword(!showAddPassword)}
                >
                  {showAddPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="add-fullname" className="text-right">
                Ad Soyad
              </Label>
              <Input
                id="add-fullname"
                placeholder="Ad Soyad"
                value={addFormData.fullName}
                onChange={(e) => setAddFormData(prev => ({ ...prev, fullName: e.target.value }))}
                className="col-span-3"
                required
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="add-role" className="text-right">
                Rol
              </Label>
              <Select
                value={addFormData.role}
                onValueChange={(value) => setAddFormData(prev => ({ ...prev, role: value }))}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Rol seçin" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal Kullanıcı</SelectItem>
                  <SelectItem value="editor">Editör</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="add-city" className="text-right">
                Şehir
              </Label>
              <Select
                value={addFormData.city}
                onValueChange={(value) => setAddFormData(prev => ({ ...prev, city: value }))}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Şehir seçin" />
                </SelectTrigger>
                <SelectContent>
                  {CITIES.map((city) => (
                    <SelectItem key={city.value} value={city.value}>
                      {city.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => {
                setShowAddDialog(false)
                setAddFormData({
                  username: '',
                  password: '',
                  fullName: '',
                  role: '',
                  city: ''
                })
              }}
            >
              İptal
            </Button>
            <Button 
              type="submit" 
              onClick={async () => {
                // Add user logic here
                if (!addFormData.username || !addFormData.password || !addFormData.fullName || !addFormData.role || !addFormData.city) {
                  setMessage({ type: 'error', text: 'Lütfen tüm alanları doldurun' })
                  return
                }

                setAddLoading(true)
                try {
                  const response = await makeAuthenticatedRequest('/api/users', {
                    method: 'POST',
                    body: JSON.stringify(addFormData)
                  })

                  if (response && response.ok) {
                    setMessage({ type: 'success', text: 'Kullanıcı başarıyla eklendi' })
                    setShowAddDialog(false)
                    setAddFormData({
                      username: '',
                      password: '',
                      fullName: '',
                      role: '',
                      city: ''
                    })
                    fetchUsers()
                  } else {
                    const error = await response?.json()
                    setMessage({ type: 'error', text: error?.error || 'Kullanıcı eklenemedi' })
                  }
                } catch (error) {
                  setMessage({ type: 'error', text: 'Bağlantı hatası' })
                } finally {
                  setAddLoading(false)
                }
              }}
              disabled={addLoading}
            >
              {addLoading ? 'Ekleniyor...' : 'Kullanıcı Ekle'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Kullanıcı Düzenle</DialogTitle>
            <DialogDescription>
              {editingUser?.username} kullanıcısının bilgilerini düzenleyin.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-username" className="text-right">
                Kullanıcı Adı
              </Label>
              <Input
                id="edit-username"
                value={editFormData.username}
                onChange={(e) => setEditFormData(prev => ({ ...prev, username: e.target.value }))}
                className="col-span-3"
                minLength={3}
                required
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-fullname" className="text-right">
                Ad Soyad
              </Label>
              <Input
                id="edit-fullname"
                value={editFormData.fullName}
                onChange={(e) => setEditFormData(prev => ({ ...prev, fullName: e.target.value }))}
                className="col-span-3"
                required
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-role" className="text-right">
                Rol
              </Label>
              <Select
                value={editFormData.role}
                onValueChange={(value) => setEditFormData(prev => ({ ...prev, role: value }))}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal Kullanıcı</SelectItem>
                  <SelectItem value="editor">Editör</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-city" className="text-right">
                Şehir
              </Label>
              <Select
                value={editFormData.city}
                onValueChange={(value) => setEditFormData(prev => ({ ...prev, city: value }))}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CITIES.map((city) => (
                    <SelectItem key={city.value} value={city.value}>
                      {city.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => {
                setShowEditDialog(false)
                setEditingUser(null)
              }}
            >
              İptal
            </Button>
            <Button 
              type="submit" 
              onClick={async () => {
                if (!editingUser || !editFormData.username || !editFormData.fullName || !editFormData.role || !editFormData.city) {
                  setMessage({ type: 'error', text: 'Lütfen tüm alanları doldurun' })
                  return
                }

                setEditLoading(true)
                try {
                  const response = await makeAuthenticatedRequest(`/api/users/${editingUser.id}`, {
                    method: 'PUT',
                    body: JSON.stringify(editFormData)
                  })

                  if (response && response.ok) {
                    setMessage({ type: 'success', text: 'Kullanıcı başarıyla güncellendi' })
                    setShowEditDialog(false)
                    setEditingUser(null)
                    fetchUsers()
                  } else {
                    const error = await response?.json()
                    setMessage({ type: 'error', text: error?.error || 'Kullanıcı güncellenemedi' })
                  }
                } catch (error) {
                  setMessage({ type: 'error', text: 'Bağlantı hatası' })
                } finally {
                  setEditLoading(false)
                }
              }}
              disabled={editLoading}
            >
              {editLoading ? 'Güncelleniyor...' : 'Güncelle'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Kullanıcı Sil</DialogTitle>
            <DialogDescription>
              Bu işlem geri alınamaz. {deletingUser?.fullName} ({deletingUser?.username}) kullanıcısını silmek istediğinizden emin misiniz?
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Dikkat!</strong> Bu kullanıcının tüm verileri kalıcı olarak silinecektir.
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => {
                setShowDeleteDialog(false)
                setDeletingUser(null)
              }}
            >
              İptal
            </Button>
            <Button 
              type="submit" 
              variant="destructive"
              onClick={async () => {
                if (!deletingUser) return

                setDeleteLoading(true)
                try {
                  const response = await makeAuthenticatedRequest(`/api/users/${deletingUser.id}`, {
                    method: 'DELETE'
                  })

                  if (response && response.ok) {
                    setMessage({ type: 'success', text: 'Kullanıcı başarıyla silindi' })
                    setShowDeleteDialog(false)
                    setDeletingUser(null)
                    fetchUsers()
                  } else {
                    const error = await response?.json()
                    setMessage({ type: 'error', text: error?.error || 'Kullanıcı silinemedi' })
                  }
                } catch (error) {
                  setMessage({ type: 'error', text: 'Bağlantı hatası' })
                } finally {
                  setDeleteLoading(false)
                }
              }}
              disabled={deleteLoading}
            >
              {deleteLoading ? 'Siliniyor...' : 'Evet, Sil'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
} 