const { uploadFileToIrys, checkBalance } = require('./your-irys-module'); // Update this path
const fs = require('fs');

async function testIrysSetup() {
  try {
    console.log('🔧 Testing Irys setup...');
    
    // Test 1: Create a small test buffer
    const testBuffer = Buffer.from('Hello Irys! This is a test upload.', 'utf8');
    console.log(`📁 Test buffer size: ${testBuffer.length} bytes`);
    
    // Test 2: Check pricing and balance
    console.log('\n💰 Checking balance and pricing...');
    const balanceInfo = await checkBalance(testBuffer.length);
    
    if (!balanceInfo.hasSufficientFunds) {
      console.log('⚠️  Insufficient funds for upload');
      console.log(`Need: ${balanceInfo.price} wei`);
      console.log(`Have: ${balanceInfo.balance} wei`);
      console.log('\n💡 You may need to fund your account with Sepolia ETH first');
      return;
    }
    
    // Test 3: Upload the test file
    console.log('\n🚀 Uploading test file...');
    const result = await uploadFileToIrys(testBuffer, 'test.txt');
    
    console.log('\n🎉 Success!');
    console.log('📄 File ID:', result.id);
    console.log('🌐 Gateway URL:', result.url);
    console.log('🔗 AR URL:', result.arUrl);
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    
    // Common error troubleshooting
    if (error.message.includes('Currency not supported')) {
      console.log('\n💡 Troubleshooting: Currency error usually means:');
      console.log('   - Wrong network configuration');
      console.log('   - RPC URL issues');
      console.log('   - Private key format problems');
    }
    
    if (error.message.includes('insufficient funds') || error.message.includes('balance')) {
      console.log('\n💡 You need Sepolia ETH in your wallet');
      console.log('   - Get testnet ETH from: https://sepoliafaucet.com/');
      console.log('   - Or: https://faucet.quicknode.com/ethereum/sepolia');
    }
  }
}

// Run the test
testIrysSetup();