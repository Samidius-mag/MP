const axios = require('axios');

async function checkServerStatus() {
  const baseUrl = process.env.SERVER_URL || 'http://localhost:3001';
  
  console.log('🔍 Checking server status...');
  console.log(`Server URL: ${baseUrl}`);
  
  try {
    // Проверяем health check
    console.log('\n1. Checking health endpoint...');
    const healthResponse = await axios.get(`${baseUrl}/api/health`);
    console.log('✅ Health check:', healthResponse.data);
    
    // Проверяем auth endpoint
    console.log('\n2. Checking auth endpoint...');
    try {
      const authResponse = await axios.get(`${baseUrl}/api/auth/status`);
      console.log('✅ Auth endpoint:', authResponse.data);
    } catch (error) {
      console.log('⚠️  Auth endpoint error:', error.response?.status, error.response?.data?.error || error.message);
    }
    
    // Проверяем admin endpoint (без авторизации)
    console.log('\n3. Checking admin endpoint (without auth)...');
    try {
      const adminResponse = await axios.get(`${baseUrl}/api/admin/users`);
      console.log('✅ Admin endpoint accessible:', adminResponse.data);
    } catch (error) {
      console.log('⚠️  Admin endpoint error (expected without auth):', error.response?.status, error.response?.data?.error || error.message);
    }
    
    // Проверяем client endpoint (без авторизации)
    console.log('\n4. Checking client endpoint (without auth)...');
    try {
      const clientResponse = await axios.get(`${baseUrl}/api/client/orders`);
      console.log('✅ Client endpoint accessible:', clientResponse.data);
    } catch (error) {
      console.log('⚠️  Client endpoint error (expected without auth):', error.response?.status, error.response?.data?.error || error.message);
    }
    
    // Проверяем pricing endpoint (должен быть отключен)
    console.log('\n5. Checking pricing endpoint (should be disabled)...');
    try {
      const pricingResponse = await axios.get(`${baseUrl}/api/pricing/settings`);
      console.log('⚠️  Pricing endpoint accessible (unexpected):', pricingResponse.data);
    } catch (error) {
      if (error.code === 'ECONNREFUSED' || error.response?.status === 404) {
        console.log('✅ Pricing endpoint properly disabled');
      } else {
        console.log('⚠️  Pricing endpoint error:', error.response?.status, error.response?.data?.error || error.message);
      }
    }
    
    console.log('\n✅ Server status check completed!');
    
  } catch (error) {
    console.error('❌ Server check failed:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('💡 Server is not running. Please start the server first.');
    } else if (error.code === 'ENOTFOUND') {
      console.log('💡 Server URL is incorrect or server is not accessible.');
    }
  }
}

checkServerStatus();




