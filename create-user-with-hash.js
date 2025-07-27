require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcrypt');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function createUserWithHashedPassword(username, plainPassword, role = 'normal', fullName = null) {
  console.log('🔧 CREATING USER WITH HASHED PASSWORD');
  console.log('====================================');
  
  if (!supabaseUrl || !supabaseKey) {
    console.log('❌ Missing Supabase credentials');
    return;
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  try {
    // Hash password with bcrypt
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(plainPassword, saltRounds);
    
    console.log(`Creating user: ${username}`);
    console.log(`Role: ${role}`);
    console.log(`Full Name: ${fullName || username}`);
    
    // Insert user with hashed password
    const { data, error } = await supabase
      .from('users')
      .insert({
        username,
        password: passwordHash,
        role,
        full_name: fullName || username,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select();
    
    if (error) {
      console.log('❌ Error creating user:', error);
      return;
    }
    
    console.log('✅ User created successfully!');
    console.log('User ID:', data[0].id);
    console.log('Username:', data[0].username);
    console.log('Role:', data[0].role);
    console.log('Password hash length:', data[0].password.length);
    
    return data[0];
    
  } catch (error) {
    console.log('❌ Catch error:', error);
  }
}

// Usage examples:
async function createSampleUsers() {
  // Normal kullanıcı
  await createUserWithHashedPassword('john_doe', 'securepass123', 'normal', 'John Doe');
  
  // Editor kullanıcı
  await createUserWithHashedPassword('admin_user', 'adminpass456', 'editor', 'Admin User');
  
  // Basit kullanıcı
  await createUserWithHashedPassword('simple', 'simple123', 'normal', 'Simple User');
}

// Eğer script direkt çalıştırılıyorsa örnek kullanıcıları oluştur
if (require.main === module) {
  // Komut satırından kullanım: node create-user-with-hash.js username password role "Full Name"
  const args = process.argv.slice(2);
  
  if (args.length >= 2) {
    const [username, password, role = 'normal', fullName] = args;
    createUserWithHashedPassword(username, password, role, fullName);
  } else {
    console.log('Usage: node create-user-with-hash.js <username> <password> [role] ["Full Name"]');
    console.log('Example: node create-user-with-hash.js newuser mypassword editor "New User"');
    console.log('\nCreating sample users instead...');
    createSampleUsers();
  }
}

module.exports = { createUserWithHashedPassword }; 