-- Turkish Map Application Database Schema
-- Supabase (PostgreSQL) Veritabanı Şeması
-- Oluşturulma Tarihi: 2025-07-23

-- =====================================================
-- EXTENSIONS (Eklentiler)
-- =====================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- TABLOLAR
-- =====================================================

-- 1. Ana Kategoriler Tablosu
CREATE TABLE IF NOT EXISTS main_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    color VARCHAR(7) NOT NULL CHECK (color ~* '^#[0-9A-F]{6}$'),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Alt Kategoriler Tablosu
CREATE TABLE IF NOT EXISTS sub_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    main_category_id UUID NOT NULL,
    color VARCHAR(7) CHECK (color IS NULL OR color ~* '^#[0-9A-F]{6}$'),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT fk_main_category 
        FOREIGN KEY (main_category_id) 
        REFERENCES main_categories(id) 
        ON DELETE CASCADE
);

-- 3. Adresler Tablosu
CREATE TABLE IF NOT EXISTS addresses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    province VARCHAR(100) NOT NULL,
    district VARCHAR(100) NOT NULL,
    neighborhood VARCHAR(100) NOT NULL,
    address TEXT NOT NULL,
    latitude DOUBLE PRECISION NOT NULL CHECK (latitude >= -90 AND latitude <= 90),
    longitude DOUBLE PRECISION NOT NULL CHECK (longitude >= -180 AND longitude <= 180),
    main_category_id UUID NOT NULL,
    sub_category_id UUID NOT NULL,
    gender VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT fk_address_main_category 
        FOREIGN KEY (main_category_id) 
        REFERENCES main_categories(id) 
        ON DELETE RESTRICT,
    CONSTRAINT fk_address_sub_category 
        FOREIGN KEY (sub_category_id) 
        REFERENCES sub_categories(id) 
        ON DELETE RESTRICT
);

-- 4. Kullanıcılar Tablosu
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL, -- plain text password
    role VARCHAR(20) DEFAULT 'normal' CHECK (role IN ('admin', 'editor', 'normal')),
    full_name VARCHAR(255),
    city VARCHAR(100),
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. API Anahtarları Tablosu
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_name VARCHAR(100) NOT NULL,
    api_key TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Sistem Logları Tablosu
CREATE TABLE IF NOT EXISTS logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    username VARCHAR(50) NOT NULL,
    action VARCHAR(255) NOT NULL,
    details TEXT,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Uygulama Durumu Tablosu
CREATE TABLE IF NOT EXISTS app_is_active (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    maintenance_message TEXT,
    updated_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT fk_app_updated_by 
        FOREIGN KEY (updated_by) 
        REFERENCES users(id) 
        ON DELETE SET NULL
);

-- =====================================================
-- INDEXLER
-- =====================================================

-- Performans için önemli indexler
CREATE INDEX idx_addresses_province ON addresses(province);
CREATE INDEX idx_addresses_district ON addresses(district);
CREATE INDEX idx_addresses_categories ON addresses(main_category_id, sub_category_id);
CREATE INDEX idx_addresses_location ON addresses(latitude, longitude);
CREATE INDEX idx_sub_categories_main ON sub_categories(main_category_id);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_logs_user_id ON logs(user_id);
CREATE INDEX idx_logs_created_at ON logs(created_at DESC);
CREATE INDEX idx_api_keys_service ON api_keys(service_name);
CREATE INDEX idx_app_is_active_status ON app_is_active(is_active);

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Tüm tablolar için RLS'i etkinleştir
ALTER TABLE main_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE sub_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_is_active ENABLE ROW LEVEL SECURITY;

-- Ana Kategoriler - Herkes okuyabilir
CREATE POLICY "main_categories_read_all" ON main_categories
    FOR SELECT USING (true);

-- Alt Kategoriler - Herkes okuyabilir
CREATE POLICY "sub_categories_read_all" ON sub_categories
    FOR SELECT USING (true);

-- Adresler - Herkes okuyabilir
CREATE POLICY "addresses_read_all" ON addresses
    FOR SELECT USING (true);

-- Kullanıcılar - Sadece service role erişebilir
CREATE POLICY "users_service_role_only" ON users
    USING (auth.role() = 'service_role');

-- API Anahtarları - Sadece service role erişebilir
CREATE POLICY "api_keys_service_role_only" ON api_keys
    USING (auth.role() = 'service_role');

-- Loglar - Sadece service role erişebilir
CREATE POLICY "logs_service_role_only" ON logs
    USING (auth.role() = 'service_role');

-- Uygulama Durumu - Herkes okuyabilir, sadece service role yazabilir
CREATE POLICY "app_is_active_read_all" ON app_is_active
    FOR SELECT USING (true);

CREATE POLICY "app_is_active_service_role_write" ON app_is_active
    FOR ALL USING (auth.role() = 'service_role');

-- =====================================================
-- FUNCTIONS (Fonksiyonlar)
-- =====================================================

-- Otomatik updated_at güncelleme fonksiyonu
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- =====================================================
-- TRIGGERS (Tetikleyiciler)
-- =====================================================

-- users tablosu için updated_at trigger
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- api_keys tablosu için updated_at trigger
CREATE TRIGGER update_api_keys_updated_at BEFORE UPDATE ON api_keys
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- app_is_active tablosu için updated_at trigger
CREATE TRIGGER update_app_is_active_updated_at BEFORE UPDATE ON app_is_active
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- VARSAYILAN VERİLER
-- =====================================================

-- Varsayılan admin kullanıcısı (şifre: admin123 - düz metin)
INSERT INTO users (username, password, role, full_name, city) 
VALUES (
    'admin',
    'admin123',
    'admin',
    'Sistem Yöneticisi',
    'Aksaray'
) ON CONFLICT (username) DO NOTHING;

-- Yandex Maps API anahtarı
INSERT INTO api_keys (service_name, api_key, description, is_active)
VALUES (
    'Yandex Maps',
    '8dfaff59-549d-4522-8491-f4026a7d3f0f',
    'Yandex Maps API anahtarı - Harita servisleri için',
    true
) ON CONFLICT DO NOTHING;

-- Varsayılan uygulama durumu - aktif
INSERT INTO app_is_active (is_active, maintenance_message)
VALUES (
    true,
    NULL
);

-- =====================================================
-- ÖRNEK KATEGORİLER VE VERİLER
-- =====================================================

-- Örnek ana kategoriler
INSERT INTO main_categories (name, color) VALUES
    ('Sağlık Hizmetleri', '#FF6B6B'),
    ('Eğitim Kurumları', '#4ECDC4'),
    ('Sosyal Hizmetler', '#45B7D1'),
    ('Kamu Kuruluşları', '#96CEB4'),
    ('Ticari İşletmeler', '#FFEAA7'),
    ('Ulaşım', '#DDA0DD'),
    ('Acil Durumlar', '#FF4757')
ON CONFLICT DO NOTHING;

-- Örnek alt kategoriler (Ana kategoriler oluşturulduktan sonra eklenir)
INSERT INTO sub_categories (name, main_category_id, color) 
SELECT 'Hastane', mc.id, '#FF5252'
FROM main_categories mc WHERE mc.name = 'Sağlık Hizmetleri'
ON CONFLICT DO NOTHING;

INSERT INTO sub_categories (name, main_category_id, color) 
SELECT 'Aile Sağlığı Merkezi', mc.id, '#FF7043'
FROM main_categories mc WHERE mc.name = 'Sağlık Hizmetleri'
ON CONFLICT DO NOTHING;

INSERT INTO sub_categories (name, main_category_id, color) 
SELECT 'Eczane', mc.id, '#FF8A65'
FROM main_categories mc WHERE mc.name = 'Sağlık Hizmetleri'
ON CONFLICT DO NOTHING;

INSERT INTO sub_categories (name, main_category_id, color) 
SELECT 'İlkokul', mc.id, '#26A69A'
FROM main_categories mc WHERE mc.name = 'Eğitim Kurumları'
ON CONFLICT DO NOTHING;

INSERT INTO sub_categories (name, main_category_id, color) 
SELECT 'Ortaokul', mc.id, '#42A5F5'
FROM main_categories mc WHERE mc.name = 'Eğitim Kurumları'
ON CONFLICT DO NOTHING;

INSERT INTO sub_categories (name, main_category_id, color) 
SELECT 'Lise', mc.id, '#5C6BC0'
FROM main_categories mc WHERE mc.name = 'Eğitim Kurumları'
ON CONFLICT DO NOTHING;

INSERT INTO sub_categories (name, main_category_id, color) 
SELECT 'SYDV', mc.id, '#29B6F6'
FROM main_categories mc WHERE mc.name = 'Sosyal Hizmetler'
ON CONFLICT DO NOTHING;

INSERT INTO sub_categories (name, main_category_id, color) 
SELECT 'Muhtarlık', mc.id, '#66BB6A'
FROM main_categories mc WHERE mc.name = 'Kamu Kuruluşları'
ON CONFLICT DO NOTHING;

INSERT INTO sub_categories (name, main_category_id, color) 
SELECT 'Belediye', mc.id, '#8BC34A'
FROM main_categories mc WHERE mc.name = 'Kamu Kuruluşları'
ON CONFLICT DO NOTHING;

-- Örnek HCG kullanıcısı (Aksaray odaklı)
INSERT INTO users (username, password, role, full_name, city) 
VALUES (
    'HCG',
    '123456',
    'admin',
    'Hüseyin Genç',
    'Aksaray'
) ON CONFLICT (username) DO NOTHING;

-- =====================================================
-- YARDIMCI SORGULAR
-- =====================================================

-- Kategori istatistikleri görünümü
CREATE OR REPLACE VIEW category_statistics AS
SELECT 
    mc.id AS main_category_id,
    mc.name AS main_category_name,
    mc.color AS main_category_color,
    COUNT(DISTINCT sc.id) AS sub_category_count,
    COUNT(DISTINCT a.id) AS address_count
FROM main_categories mc
LEFT JOIN sub_categories sc ON mc.id = sc.main_category_id
LEFT JOIN addresses a ON mc.id = a.main_category_id
GROUP BY mc.id, mc.name, mc.color;

-- Şehir bazlı adres sayıları görünümü
CREATE OR REPLACE VIEW city_address_counts AS
SELECT 
    province,
    COUNT(*) AS address_count,
    COUNT(DISTINCT district) AS district_count,
    COUNT(DISTINCT neighborhood) AS neighborhood_count
FROM addresses
GROUP BY province
ORDER BY address_count DESC;

-- Kullanıcı aktivite özeti görünümü
CREATE OR REPLACE VIEW user_activity_summary AS
SELECT 
    u.id,
    u.username,
    u.role,
    u.full_name,
    u.city,
    u.last_login,
    COUNT(DISTINCT l.id) AS total_actions,
    MAX(l.created_at) AS last_action
FROM users u
LEFT JOIN logs l ON u.id = l.user_id
GROUP BY u.id, u.username, u.role, u.full_name, u.city, u.last_login;

-- =====================================================
-- GÜVENLİK VE PERFORMANS ÖNERİLERİ
-- =====================================================

-- 1. Supabase Dashboard'dan service role key'i güvenli bir şekilde saklayın
-- 2. Tüm API istekleri server-side proxy üzerinden yapılmalı
-- 3. Rate limiting için Kong veya Supabase Edge Functions kullanın
-- 4. Düzenli olarak VACUUM ve ANALYZE komutlarını çalıştırın:
--    VACUUM ANALYZE addresses;
--    VACUUM ANALYZE logs;

-- 5. Log tablosu büyüdükçe partitioning düşünün:
--    CREATE TABLE logs_2025 PARTITION OF logs 
--    FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');

-- 6. Backup stratejisi oluşturun:
--    pg_dump kullanarak düzenli yedekleme
--    Point-in-time recovery için WAL arşivleme

-- =====================================================
-- NOTLAR
-- =====================================================

-- Bu şema dosyası Turkish Map Application için tüm veritabanı
-- yapısını içerir. Supabase SQL Editor'de çalıştırabilirsiniz.
-- 
-- KURULUM TALİMATLARI:
-- 1. Supabase projenizde SQL Editor'ı açın
-- 2. Bu dosyanın tüm içeriğini kopyalayıp yapıştırın
-- 3. "Run" butonuna tıklayarak çalıştırın
-- 4. Tüm tablolar, indexler, politikalar ve örnek veriler otomatik oluşturulacak
-- 
-- VARSAYILAN GİRİŞ BİLGİLERİ:
-- Admin: username=admin, password=admin123
-- HCG: username=HCG, password=123456
-- 
-- PROJENİN ÖZELLİKLERİ:
-- - Aksaray odaklı harita sistemi
-- - Kategori bazlı adres yönetimi
-- - Rol tabanlı erişim kontrolü (admin/editor/normal)
-- - Güvenli proxy mimarisi
-- - Düz metin şifre sistemi (hash yok)
-- - Yandex Maps entegrasyonu
-- - Gerçek zamanlı adres filtreleme
-- - Audit log sistemi
-- 
-- Güvenlik açısından kritik noktalar:
-- - Service role key asla client tarafında kullanılmamalı
-- - Tüm hassas işlemler server-side proxy üzerinden yapılmalı
-- - RLS politikaları dikkatli bir şekilde yapılandırılmalı
-- - Kullanıcı şifreleri düz metin olarak saklanır (hash yok)
-- - API key'ler database'de güvenli şekilde saklanır