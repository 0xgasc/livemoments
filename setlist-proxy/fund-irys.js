require('dotenv').config();
const { Uploader } = require('@irys/upload');
const { Ethereum } = require('@irys/upload-ethereum');
const { formatEther, parseEther } = require('ethers');

async function fundIrysAccount() {
  try {
    console.log('💸 Funding Irys account...');
    
    // Connect to Irys
    const irysUploader = await Uploader(Ethereum)
      .withWallet(process.env.PRIVATE_KEY)
      .withRpc(process.env.SEPOLIA_RPC)
      .devnet();
    
    console.log(`🏦 Irys wallet address: ${irysUploader.address}`);
    
    // Check current balance
    const currentBalance = await irysUploader.getBalance();
    console.log(`💰 Current Irys balance: ${currentBalance} wei`);
    
    // Fund with 0.01 ETH (should be plenty for testing)
    const fundAmount = parseEther('0.2'); // 0.01 ETH
    console.log(`💸 Funding with ${formatEther(fundAmount)} ETH...`);
    
    const fundResult = await irysUploader.fund(fundAmount);
    console.log('✅ Fund transaction complete!');
    console.log('📄 Fund receipt:', fundResult);
    
    // Check new balance
    const newBalance = await irysUploader.getBalance();
    console.log(`💰 New Irys balance: ${newBalance} wei`);
    
    if (newBalance > 0) {
      console.log('🎉 Success! Irys account is now funded');
      console.log('✅ You can now run uploads');
    } else {
      console.log('⚠️  Balance still 0, there might be an issue');
    }
    
  } catch (error) {
    console.error('❌ Funding error:', error.message);
    
    if (error.message.includes('insufficient funds')) {
      console.log('💡 Make sure your wallet has enough Sepolia ETH');
    } else if (error.message.includes('gas')) {
      console.log('💡 Gas estimation issue - try with a smaller amount');
    }
  }
}

fundIrysAccount();